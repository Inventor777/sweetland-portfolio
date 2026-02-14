import * as THREE from "three";
import type { Physics } from "../physics/Physics";
import { Input } from "../core/Input";
import { ASSETS, ANIM } from "../config/assets";
import { loadGLTF } from "../core/gltf";
import { findClipByNames, fadeTo } from "../core/anim";

type MoveState = "idle" | "walk" | "run" | "jump";

type JumpBoneRole =
  | "spine"
  | "chest"
  | "neck"
  | "upperArm"
  | "foreArm"
  | "thigh"
  | "shin";

type JumpTarget = {
  obj: THREE.Object3D;           // can be Bone OR regular Object3D
  role: JumpBoneRole;
  side: -1 | 0 | 1;              // -1 left, +1 right, 0 center
};

export class Player {
  mesh = new THREE.Group();

  body!: any;
  collider!: any;
  controller!: any;

  // Movement config
  walkSpeed = 6.0;
  runSpeed = 9.5;
  jumpSpeed = 10.0;
  gravity = -22.0;

  // state
  private velY = 0;
  private groundIgnoreTimer = 0;
  private coyoteTimer = 0;

  // Ladder climbing (Minecraft-style)
  private onLadder = false;
  private ladderCenter = new THREE.Vector3();
  private ladderMinY = -Infinity;
  private ladderMaxY = Infinity;
  private ladderCooldown = 0;
  grounded = false;
  private wasGrounded = true;

  // Double-jump config
  private jumpsUsed = 0;
  private readonly maxJumps = 2;
  private readonly doubleJumpMultiplier = 0.9; // weaker 2nd jump
  private jumpWasDown = false;

  // Visual model + animation
  private placeholder: THREE.Object3D | null = null;
  private modelRoot: THREE.Object3D | null = null;

  private mixer: THREE.AnimationMixer | null = null;
  private actions: Partial<Record<MoveState, THREE.AnimationAction>> = {};
  private current: THREE.AnimationAction | null = null;
  private state: MoveState = "idle";

  // movement info (for animation)
  private moveLen = 0;
  private running = false;

  // Jump animation gating:
  private jumpAnimLock = 0;
  private jumpActive = false;
  private jumpActiveTime = 0;

  // Clip debug
  private __loggedJumpPick = false;

  // Jump overlay action (ADDs a visible pose via mixer, so it cannot be overwritten by other mixer updates)
  private jumpOverlayAction: THREE.AnimationAction | null = null;

  // Overlay blending (0..1)
  private jumpOverlayAlpha = 0;
  private jumpOverlayTarget = 0;
  private jumpOverlayRateUp = 16;   // faster = snappier pose
  private jumpOverlayRateDown = 12;

  // Squash/stretch on the player GROUP (separate from model mixer)
  private meshBaseScale = new THREE.Vector3(1, 1, 1);

  // Pose targets for overlay
  private jumpTargets: JumpTarget[] = [];

  // temporary helpers
  private __tmpV = new THREE.Vector3();
  private __tmpQ = new THREE.Quaternion();

  constructor(private physics: Physics, private input: Input) {}

  async spawn(pos: THREE.Vector3): Promise<void> {
    this.meshBaseScale.copy(this.mesh.scale);

    // Placeholder capsule (hidden once GLB loads)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xff76c4, roughness: 0.55, emissive: 0x16070e, emissiveIntensity: 0.25 });

    const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.8, 10, 18), bodyMat);
    capsule.castShadow = true;
    capsule.position.y = 0.9;

    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 14), accentMat);
    hat.castShadow = true;
    hat.position.set(0, 1.95, 0);
    hat.rotation.z = Math.PI * 0.04;

    const ph = new THREE.Group();
    ph.add(capsule, hat);
    this.placeholder = ph;
    this.mesh.add(ph);

    // Physics: kinematic position-based body + capsule collider
    const R = this.physics.R;
    this.body = this.physics.world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y, pos.z)
    );

    this.collider = this.physics.world.createCollider(
      R.ColliderDesc.capsule(0.45, 0.35).setFriction(0.0),
      this.body
    );

    this.collider.setActiveEvents(R.ActiveEvents.COLLISION_EVENTS);

    // Character controller
    this.controller = this.physics.world.createCharacterController(0.06);
    this.controller.setSlideEnabled(true);
    this.controller.enableAutostep(0.35, 0.22, true);
    this.controller.enableSnapToGround(0.35);
    this.controller.setMaxSlopeClimbAngle((70 * Math.PI) / 180);
    this.controller.setMinSlopeSlideAngle((45 * Math.PI) / 180);

    // Tag player collider so gameplay can detect overlaps
    this.physics.tagCollider(this.collider, { kind: "other", id: "player" });

    await this.loadAvatar();
  }

  // ---- Jump clip selection (bind + motion score) ----

  private clipBindStats(clip: THREE.AnimationClip, root: THREE.Object3D): { bound: number; total: number; quat: number } {
    const PB: any = (THREE as any).PropertyBinding;
    const parse = PB?.parseTrackName ? PB.parseTrackName.bind(PB) : null;

    let bound = 0;
    let total = 0;
    let quat = 0;

    for (const tr of clip.tracks) {
      total++;
      const nm = String((tr as any).name || "");
      if (nm.toLowerCase().includes("quaternion")) quat++;

      if (!parse) { bound++; continue; }

      const info = parse(nm);
      const nodeName = info?.nodeName;
      if (!nodeName) { bound++; continue; }
      if (root.getObjectByName(nodeName)) bound++;
    }

    return { bound, total, quat };
  }

  private clipMotionScore(clip: THREE.AnimationClip): number {
    const dur = Math.max(0.0001, clip.duration);
    const sampleTimes = [0, dur * 0.33, dur * 0.66, dur];
    let score = 0;

    for (const tr of clip.tracks as any[]) {
      const name = String(tr.name || "").toLowerCase();
      const values: number[] = tr.values || [];
      const times: number[] = tr.times || [];
      if (!values.length || !times.length) continue;

      const idxForTime = (t: number) => {
        let best = 0, bestDt = Infinity;
        for (let i = 0; i < times.length; i++) {
          const d = Math.abs(times[i] - t);
          if (d < bestDt) { bestDt = d; best = i; }
        }
        return best;
      };

      if (name.includes("quaternion")) {
        const qs = sampleTimes.map((t) => {
          const i = idxForTime(t), off = i * 4;
          return new THREE.Quaternion(values[off], values[off + 1], values[off + 2], values[off + 3]).normalize();
        });
        for (let i = 1; i < qs.length; i++) {
          const dot = Math.min(1, Math.max(-1, qs[i - 1].dot(qs[i])));
          const ang = 2 * Math.acos(Math.abs(dot));
          score += ang;
        }
      } else if (name.includes(".position")) {
        const ps = sampleTimes.map((t) => {
          const i = idxForTime(t), off = i * 3;
          return new THREE.Vector3(values[off], values[off + 1], values[off + 2]);
        });
        for (let i = 1; i < ps.length; i++) score += ps[i - 1].distanceTo(ps[i]);
      }
    }

    return score;
  }

  private pickBestJumpClip(anims: THREE.AnimationClip[], root: THREE.Object3D): THREE.AnimationClip | null {
    const hints = Array.isArray(ANIM.jump) ? ANIM.jump : (ANIM.jump ? [ANIM.jump] : []);
    const hintL = hints.map((h) => String(h).toLowerCase()).filter(Boolean);

    const candidates = anims.filter((c) => {
      const n = c.name.toLowerCase();
      return n.includes("jump") || hintL.some((h) => n === h || n.includes(h));
    });

    if (!candidates.length) return null;

    const ranked = candidates.map((c) => {
      const st = this.clipBindStats(c, root);
      const ratio = st.bound / Math.max(1, st.total);
      const motion = this.clipMotionScore(c);
      const score = ratio * 100000 + motion * 100 + st.quat;
      return { c, st, ratio, motion, score };
    }).sort((a, b) => b.score - a.score);

    const best = ranked[0];

    if (!this.__loggedJumpPick) {
      this.__loggedJumpPick = true;
      const top = ranked.slice(0, 4).map((r) =>
        `${r.c.name} bind=${r.st.bound}/${r.st.total} quat=${r.st.quat} motion=${r.motion.toFixed(2)} dur=${r.c.duration.toFixed(2)}`
      );
    }

    if (best.ratio < 0.25) return null;
    return best.c;
  }

  // ---- Jump overlay target selection (works for Bones OR rigid parts) ----

  private lateralAxisFromObjects(objs: THREE.Object3D[]): "x" | "z" {
    const xs: number[] = [];
    const zs: number[] = [];
    for (const o of objs) {
      o.getWorldPosition(this.__tmpV);
      xs.push(this.__tmpV.x);
      zs.push(this.__tmpV.z);
    }
    const spreadX = Math.max(...xs) - Math.min(...xs);
    const spreadZ = Math.max(...zs) - Math.min(...zs);
    return spreadX >= spreadZ ? "x" : "z";
  }

  private addTarget(obj: THREE.Object3D | null, role: JumpBoneRole, side: -1 | 0 | 1): void {
    if (!obj) return;
    if (!obj.name) return;
    if (this.jumpTargets.some((t) => t.obj === obj)) return;
    this.jumpTargets.push({ obj, role, side });
  }

  private selectJumpTargets(root: THREE.Object3D): void {
    this.jumpTargets = [];

    // First try: use SkinnedMesh skeleton bones (usually best)
    let bones: THREE.Bone[] = [];
    root.traverse((o: any) => {
      if (bones.length) return;
      if (o && o.isSkinnedMesh && o.skeleton && Array.isArray(o.skeleton.bones) && o.skeleton.bones.length) {
        bones = o.skeleton.bones as THREE.Bone[];
      }
    });

    // Helper: name-based pick
    const pickByName = (list: THREE.Object3D[], patterns: RegExp[], side: -1 | 0 | 1): THREE.Object3D | null => {
      const sideOk = (name: string) => {
        const n = name.toLowerCase();
        if (side === 0) return true;
        const isL = /(^|[\._-])l($|[\._-])|left/.test(n);
        const isR = /(^|[\._-])r($|[\._-])|right/.test(n);
        return side < 0 ? isL && !isR : isR && !isL;
      };

      for (const obj of list) {
        const n = (obj.name || "").toLowerCase();
        if (!n) continue;
        if (!sideOk(n)) continue;
        if (patterns.some((p) => p.test(n))) return obj;
      }
      return null;
    };

    const listForNames: THREE.Object3D[] = bones.length ? bones : [];
    const spine = pickByName(listForNames, [/spine/, /hips/, /pelvis/], 0);
    const chest = pickByName(listForNames, [/chest/, /upperchest/, /torso/], 0);
    const neck = pickByName(listForNames, [/neck/, /head/], 0);

    const lUpperArm = pickByName(listForNames, [/upperarm/, /shoulder/, /clavicle/], -1);
    const rUpperArm = pickByName(listForNames, [/upperarm/, /shoulder/, /clavicle/], 1);
    const lForeArm = pickByName(listForNames, [/forearm/, /lowerarm/], -1);
    const rForeArm = pickByName(listForNames, [/forearm/, /lowerarm/], 1);

    const lThigh = pickByName(listForNames, [/thigh/, /upperleg/, /upleg/], -1);
    const rThigh = pickByName(listForNames, [/thigh/, /upperleg/, /upleg/], 1);
    const lShin = pickByName(listForNames, [/shin/, /lowerleg/, /calf/], -1);
    const rShin = pickByName(listForNames, [/shin/, /lowerleg/, /calf/], 1);

    this.addTarget(spine, "spine", 0);
    this.addTarget(chest, "chest", 0);
    this.addTarget(neck, "neck", 0);
    this.addTarget(lUpperArm, "upperArm", -1);
    this.addTarget(rUpperArm, "upperArm", 1);
    this.addTarget(lForeArm, "foreArm", -1);
    this.addTarget(rForeArm, "foreArm", 1);
    this.addTarget(lThigh, "thigh", -1);
    this.addTarget(rThigh, "thigh", 1);
    this.addTarget(lShin, "shin", -1);
    this.addTarget(rShin, "shin", 1);

    // If skeleton-based selection is thin, fall back to scanning ALL objects in the scenegraph
    if (this.jumpTargets.length < 6) {
      const all: THREE.Object3D[] = [];
      root.traverse((o) => { if (o && o.name) all.push(o); });
      root.updateMatrixWorld(true);

      const axis = this.lateralAxisFromObjects(all);

      // world-y bounds
      let minY = Infinity, maxY = -Infinity;
      for (const o of all) {
        o.getWorldPosition(this.__tmpV);
        minY = Math.min(minY, this.__tmpV.y);
        maxY = Math.max(maxY, this.__tmpV.y);
      }
      const rangeY = Math.max(0.0001, maxY - minY);

      const scored = all.map((o) => {
        o.getWorldPosition(this.__tmpV);
        const x = axis === "x" ? this.__tmpV.x : this.__tmpV.z;
        const y = this.__tmpV.y;
        return { o, x, y };
      });

      const upper = scored.filter((s) => s.y >= minY + rangeY * 0.62);
      const lower = scored.filter((s) => s.y <= minY + rangeY * 0.45);

      const leftMostUpper = upper.slice().sort((a, b) => a.x - b.x)[0]?.o ?? null;
      const rightMostUpper = upper.slice().sort((a, b) => b.x - a.x)[0]?.o ?? null;
      const leftMostLower = lower.slice().sort((a, b) => a.x - b.x)[0]?.o ?? null;
      const rightMostLower = lower.slice().sort((a, b) => b.x - a.x)[0]?.o ?? null;

      const centerCandidates = scored.slice().sort((a, b) => Math.abs(a.x) - Math.abs(b.x));
      const centerAt = (frac: number) => {
        const ty = minY + rangeY * frac;
        let best: THREE.Object3D | null = null;
        let bestD = Infinity;
        for (const s of centerCandidates.slice(0, 40)) {
          const d = Math.abs(s.y - ty);
          if (d < bestD) { bestD = d; best = s.o; }
        }
        return best;
      };

      this.addTarget(centerAt(0.55), "spine", 0);
      this.addTarget(centerAt(0.70), "chest", 0);
      this.addTarget(centerAt(0.88), "neck", 0);

      this.addTarget(leftMostUpper, "upperArm", -1);
      this.addTarget(rightMostUpper, "upperArm", 1);
      this.addTarget(leftMostLower, "thigh", -1);
      this.addTarget(rightMostLower, "thigh", 1);
    }
  }

  private buildJumpOverlayAction(): void {
    if (!this.mixer || !this.modelRoot) return;
    if (!this.jumpTargets.length) return;

    // Build an additive clip that ramps to a constant "tuck + arms up" pose.
    const tracks: THREE.KeyframeTrack[] = [];
    const times = [0, 0.001, 1.0]; // identity at 0, pose immediately after, then hold

    const makeDelta = (role: JumpBoneRole, side: -1 | 0 | 1): THREE.Quaternion => {
      const q = new THREE.Quaternion();
      const axX = new THREE.Vector3(1, 0, 0);
      const axZ = new THREE.Vector3(0, 0, 1);
      const s = side;

      // Exaggerated so it reads at distance.
      if (role === "spine") {
        q.multiply(new THREE.Quaternion().setFromAxisAngle(axX, -0.22));
      } else if (role === "chest") {
        q.multiply(new THREE.Quaternion().setFromAxisAngle(axX, -0.40));
      } else if (role === "neck") {
        q.multiply(new THREE.Quaternion().setFromAxisAngle(axX, 0.14));
      } else if (role === "upperArm") {
        q.multiply(new THREE.Quaternion().setFromAxisAngle(axX, -1.25));
        q.multiply(new THREE.Quaternion().setFromAxisAngle(axZ, 0.55 * s));
      } else if (role === "foreArm") {
        q.multiply(new THREE.Quaternion().setFromAxisAngle(axX, -0.70));
        q.multiply(new THREE.Quaternion().setFromAxisAngle(axZ, 0.18 * s));
      } else if (role === "thigh") {
        q.multiply(new THREE.Quaternion().setFromAxisAngle(axX, 0.90));
        q.multiply(new THREE.Quaternion().setFromAxisAngle(axZ, -0.16 * s));
      } else if (role === "shin") {
        q.multiply(new THREE.Quaternion().setFromAxisAngle(axX, -1.05));
      }

      return q.normalize();
    };

    for (const t of this.jumpTargets) {
      // IMPORTANT: Track name must match PropertyBinding resolution under modelRoot.
      // Using object.name is valid as long as names are unique (typical for rigs).
      const nodeName = t.obj.name;
      if (!nodeName) continue;

      const d = makeDelta(t.role, t.side);

      // identity -> delta -> delta
      const values = [
        0, 0, 0, 1,
        d.x, d.y, d.z, d.w,
        d.x, d.y, d.z, d.w
      ];

      tracks.push(new THREE.QuaternionKeyframeTrack(`${nodeName}.quaternion`, times, values));
    }

    if (!tracks.length) return;

    const clip = new THREE.AnimationClip("__SweetLandJumpOverlay", 1.0, tracks);

    const AU: any = (THREE as any).AnimationUtils;
    if (AU && typeof AU.makeClipAdditive === "function") {
      AU.makeClipAdditive(clip);
    }

    const act = this.mixer.clipAction(clip);
    act.enabled = true;
    act.setLoop(THREE.LoopRepeat, Infinity);
    act.clampWhenFinished = false;
    act.setEffectiveWeight(0);
    act.play();

    // Freeze time at "pose" keyframe zone; we control intensity by weight only.
    act.time = 0.01;
    act.setEffectiveTimeScale(0);

    // Ensure additive blend
    (act as any).blendMode = (THREE as any).AdditiveAnimationBlendMode ?? (act as any).blendMode;

    this.jumpOverlayAction = act;
  }

  private approach(current: number, target: number, rate: number, dt: number): number {
    const d = target - current;
    const step = rate * dt;
    if (Math.abs(d) <= step) return target;
    return current + Math.sign(d) * step;
  }

  private applyJumpSquashStretch(alpha: number): void {
    // v10: disabled stretch (keep model scale normal)
    if ((this as any).meshBaseScale) {
      (this as any).mesh.scale.copy((this as any).meshBaseScale);
    }
  }

  // ---- Avatar load ----

  
  // ---- EXAGGERATE the existing jump clip (guaranteed binding) ----
  // We do NOT guess bone names. We re-use the clip's *exact track names* (already confirmed to bind).
  private makeJumpVisClip(src: THREE.AnimationClip, factor = 3.2): THREE.AnimationClip {
    const tracks: THREE.KeyframeTrack[] = [];
        const maxAngle = 3.05; // radians (~175deg) safety clamp (v9)
    let keptArm = 0;
    let keptLeg = 0;

    for (const tr of src.tracks as any[]) {
      const name = String(tr.name || "");
      const lname = name.toLowerCase();

      // v9: boost limbs more than spine using track name (no bone guessing)
      const boost =
        /upperarm|forearm|hand|arm\b/.test(lname) ? factor * 1.55 :
        /thigh|upleg|upperleg|shin|lowerleg|leg\b/.test(lname) ? factor * 1.35 :
        factor;
      // Only rotate bones. Ignore position/scale to avoid root motion fighting physics.
      if (!lname.includes("quaternion")) continue;

            // v11: limb-only exaggeration (skip body; allow shoulder/clavicle rigs)
      const isArm = /upperarm|forearm|hand|shoulder|clavicle|arm\b/.test(lname);
      const isLeg = /thigh|upleg|upperleg|shin|lowerleg|calf|foot|toe|leg\b/.test(lname);
      const isBody = /hips|pelvis|spine|chest|torso|neck|head|root/.test(lname);
      if (isBody) continue;
      if (!isArm && !isLeg) continue;
      if (isArm) keptArm++; else keptLeg++;
const times: number[] = Array.from(tr.times || []);
      const values: number[] = Array.from(tr.values || []);
      if (values.length < 8) continue;

      const q0 = new THREE.Quaternion(values[0], values[1], values[2], values[3]).normalize();
      const q0inv = q0.clone().invert();

      const out: number[] = new Array(values.length);

      for (let i = 0; i < times.length; i++) {
        const off = i * 4;
        const q = new THREE.Quaternion(values[off], values[off + 1], values[off + 2], values[off + 3]).normalize();

        // delta from first key
        const dq = q0inv.clone().multiply(q).normalize();

        // axis-angle from dq
        const w = Math.min(1, Math.max(-1, dq.w));
        let angle = 2 * Math.acos(w);
        if (angle > Math.PI) angle = 2 * Math.PI - angle;

        let ax = dq.x, ay = dq.y, az = dq.z;
        const s = Math.sqrt(Math.max(1e-12, 1 - w * w));
        if (s > 1e-6) { ax /= s; ay /= s; az /= s; } else { ax = 1; ay = 0; az = 0; }

                const angle2 = Math.min(maxAngle, angle * boost);

        const dq2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(ax, ay, az), angle2).normalize();
        const q2 = q0.clone().multiply(dq2).normalize();

        out[off] = q2.x;
        out[off + 1] = q2.y;
        out[off + 2] = q2.z;
        out[off + 3] = q2.w;
      }

      tracks.push(new THREE.QuaternionKeyframeTrack(name, times, out));
    }

    const clip = new THREE.AnimationClip(src.name + "__vis", src.duration, tracks);
    clip.optimize();
return clip;
  }


  // ---- v12: GUARANTEED limb-only procedural jump clip (no body motion) ----
  // Builds a short LoopOnce clip using the avatar's *actual* bone names found in the scene.
  // This avoids cases where Sweeties_Jump__vis binds but still looks subtle or targets helper bones.
  private 
  // ---- v14: limb-only procedural jump (stronger, apex hold, skeleton-safe) ----
  private 
  // ---- SweetLand: procedural jump animation DISABLED (v16) ----
  private makeProceduralLimbJumpClip(..._args: any[]): any {
    // Jump animation is intentionally disabled; gameplay jump remains unchanged.
    return null;
  }



private async loadAvatar(): Promise<void> {
    if (!ASSETS.playerAvatar) return;

    try {
      const gltf = await loadGLTF(ASSETS.playerAvatar);
      const model = gltf.scene;

      model.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          (o as THREE.Mesh).castShadow = true;
          (o as THREE.Mesh).receiveShadow = true;
        }
      });

      // Scale avatar to match capsule height
      const b = new THREE.Box3().setFromObject(model);
      const sz = new THREE.Vector3();
      b.getSize(sz);
      const targetH = 1.85;
      const sc = sz.y > 0 ? targetH / sz.y : 1;
      model.scale.setScalar(sc);

      // Put feet on ground and center x/z
      const b2 = new THREE.Box3().setFromObject(model);
      const c = new THREE.Vector3();
      b2.getCenter(c);
      model.position.sub(new THREE.Vector3(c.x, b2.min.y, c.z));

      this.modelRoot = model;
      this.mesh.add(model);

      if (this.placeholder) this.placeholder.visible = false;

      // Animations
      if (gltf.animations && gltf.animations.length) {
        this.mixer = new THREE.AnimationMixer(model);

        const idle = findClipByNames(gltf.animations, ANIM.idle);
        const walk = findClipByNames(gltf.animations, ANIM.walk);
        const run = findClipByNames(gltf.animations, ANIM.run);
        const jumpBase = this.pickBestJumpClip(gltf.animations, model);

        if (idle) this.actions.idle = this.mixer.clipAction(idle);
        if (walk) this.actions.walk = this.mixer.clipAction(walk);
        if (run) this.actions.run = this.mixer.clipAction(run);

        if (jumpBase) {
                    const jumpProc = this.makeProceduralLimbJumpClip(model);
          const jumpClipToUse = jumpProc ?? this.makeJumpVisClip(jumpBase, 6.0);
          if (jumpProc) console.log("[SweetLand] Jump using procedural limb clip (v12).");
          const a = this.mixer.clipAction(jumpClipToUse);
          a.setLoop(THREE.LoopOnce, 1);
          a.clampWhenFinished = true;
          this.actions.jump = a;
        }

        // Build overlay targets + overlay action (this is the part that guarantees a visible jump)
        // v10: disabled legacy jump overlay system
// v10: disabled legacy jump overlay system
// Start idle if available
        if (this.actions.idle) {
          this.actions.idle.enabled = true;
          this.actions.idle.setEffectiveWeight(1);
          this.actions.idle.play();
          this.current = this.actions.idle;
          this.state = "idle";
        }
      }
    } catch (e) {
      console.warn("Failed to load avatar:", e);
    }
  }

  private triggerJumpAnim(): void {
    this.jumpAnimLock = 0.60;
    this.jumpActive = true;
    this.jumpActiveTime = 0;
    this.jumpOverlayTarget = 1;

    const a = this.actions.jump;
    if (!a) return;

    a.reset();
    a.enabled = true;
    (a as any).paused = false;
    a.setEffectiveTimeScale(1);
    a.setEffectiveWeight(1);
    a.play();

    if (this.current !== a) {
      fadeTo(this.current, a, 0.06);
      this.current = a;
    }
    this.state = "jump";
  }

  private endJumpAnim(): void {
    this.jumpActive = false;
    this.jumpActiveTime = 0;
    this.jumpAnimLock = 0;
    this.jumpOverlayTarget = 0;
      // v10: ensure scale reset
    if ((this as any).meshBaseScale) this.mesh.scale.copy((this as any).meshBaseScale);
}

  get position(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  setPosition(pos: THREE.Vector3): void {
    this.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
    this.body.setNextKinematicTranslation({ x: pos.x, y: pos.y, z: pos.z });
    this.velY = 0;
  }

  setLadder(ladder: { center: THREE.Vector3; minY: number; maxY: number } | null): void {
    if (this.ladderCooldown > 0) return;
    if (!ladder) {
      this.onLadder = false;
      return;
    }
    this.onLadder = true;
    this.ladderCenter.copy(ladder.center);
    this.ladderMinY = ladder.minY;
    this.ladderMaxY = ladder.maxY;

    if (this.jumpActive) this.endJumpAnim();
  }

  update(dt: number, cameraYaw: number): void {
    // Inputs
    const fIn = (this.input.down("KeyW") ? 1 : 0) + (this.input.down("KeyS") ? -1 : 0);
    const rIn = (this.input.down("KeyD") ? 1 : 0) + (this.input.down("KeyA") ? -1 : 0);

    // Build movement basis from camera yaw
    const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
    const camForward = new THREE.Vector3(0, 0, -1).applyQuaternion(yawQ);
    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(yawQ);

    const v = camForward.clone().multiplyScalar(fIn).add(camRight.clone().multiplyScalar(rIn));
    if (v.lengthSq() > 1) v.normalize();

    this.running = this.input.down("ShiftLeft") || this.input.down("ShiftRight");
    const speed = this.running ? this.runSpeed : this.walkSpeed;

    // Ladder cooldown
    if (this.ladderCooldown > 0) this.ladderCooldown = Math.max(0, this.ladderCooldown - dt);
    const onLadder = this.onLadder && this.ladderCooldown <= 0;

    // --- Vertical velocity
    if (onLadder) {
      const climb = fIn;
      const climbSpeed = 4.8;
      const slideSpeed = -1.2;

      if (this.input.down("Space")) {
        this.velY = this.jumpSpeed;
        this.onLadder = false;
        this.ladderCooldown = 0.30;
        this.triggerJumpAnim();
      } else {
        this.velY = climb !== 0 ? climb * climbSpeed : slideSpeed;
        const trNow = this.body.translation();
        ;(globalThis as any).__SweetLandPlayerPos = new THREE.Vector3(trNow.x, trNow.y, trNow.z); // SweetLand v24

        if (trNow.y > this.ladderMaxY + 0.40 && climb > 0) {
          this.onLadder = false;
          this.ladderCooldown = 0.35;
        }
      }
    } else {
      // v16: jump input (double jump reliable)

      (this as any).groundIgnoreTimer = Math.max(0, ((this as any).groundIgnoreTimer || 0) - dt);

      (this as any).coyoteTimer = this.grounded ? 0.10 : Math.max(0, ((this as any).coyoteTimer || 0) - dt);


      const __spaceDown = this.input.down("Space");

      const __jumpPressed = __spaceDown && !this.jumpWasDown;

      this.jumpWasDown = __spaceDown;


      if (__jumpPressed) {

        const __groundLike = this.grounded || ((this as any).coyoteTimer || 0) > 0;

        const __canJump = __groundLike || this.jumpsUsed < this.maxJumps;

        if (__canJump) {

          // If we're effectively grounded, start a fresh jump chain.

          if (__groundLike) this.jumpsUsed = 0;

          const __isDouble = !__groundLike && this.jumpsUsed > 0;

          const __mult = __isDouble ? this.doubleJumpMultiplier : 1;

          this.velY = this.jumpSpeed * __mult;

          this.jumpsUsed = Math.min(this.jumpsUsed + 1, this.maxJumps);

          // Ignore ground for a short window to prevent snap-to-ground from cancelling double-jump.

          (this as any).groundIgnoreTimer = 0.12;

          this.grounded = false;

          (this as any).coyoteTimer = 0;

        }

      }

      this.velY += this.gravity * dt;
    }

    // --- Desired displacement
    let yDisp = this.velY * dt;
    if (this.grounded && !this.input.down("Space") && !this.onLadder) yDisp = Math.min(yDisp, -0.25 * dt);

    let xDisp = v.x * speed * dt;
    let zDisp = v.z * speed * dt;

    // While on ladder: do NOT use horizontal input to avoid spinning/turning.
    if (onLadder) {
      xDisp = 0;
      zDisp = 0;

      const trNow = this.body.translation();
      const nearTop = trNow.y >= this.ladderMaxY - 0.35;

      // Top-out step
      if (nearTop && this.input.down("KeyW") && trNow.y >= this.ladderMaxY - 0.12) {
        this.onLadder = false;
        yDisp = Math.max(yDisp, 0.9 * dt);
        const fl = Math.hypot(v.x, v.z);
        if (fl > 0.001) {
          const launchSpeed = 2.4;
          xDisp = (v.x / fl) * launchSpeed * dt;
          zDisp = (v.z / fl) * launchSpeed * dt;
        }
      }

      // Keep centered on ladder
      if (!nearTop) {
        const dx = this.ladderCenter.x - trNow.x;
        const dz = this.ladderCenter.z - trNow.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.001) {
          const pullVel = Math.min(dist, 0.8) * 6.0;
          xDisp += (dx / dist) * pullVel * dt;
          zDisp += (dz / dist) * pullVel * dt;
        }
      }

      // Near top push out
      if (fIn > 0 && nearTop) {
        const out = new THREE.Vector3(trNow.x - this.ladderCenter.x, 0, trNow.z - this.ladderCenter.z);
        if (out.lengthSq() < 1e-6) out.set(camForward.x, 0, camForward.z);
        if (out.lengthSq() < 1e-6) out.set(0, 0, -1);
        out.normalize();

        const nudgeSpeed = 8.5;
        xDisp += out.x * nudgeSpeed * dt;
        zDisp += out.z * nudgeSpeed * dt;

        yDisp = Math.max(yDisp, 1.0 * dt);
      }
    }

    const desired = { x: xDisp, y: yDisp, z: zDisp };

    const filterFlags = this.physics.R.QueryFilterFlags.EXCLUDE_SENSORS;
    this.controller.computeColliderMovement(this.collider, desired, filterFlags);

    const m = this.controller.computedMovement();

    const tr = this.body.translation();
    let next = { x: tr.x + m.x, y: tr.y + m.y, z: tr.z + m.z };

    // Hard top-out
    if (onLadder && fIn > 0) {
      const nearTop = tr.y >= this.ladderMaxY - 0.35;
      const blockedUp = this.velY > 0.1 && m.y < 0.02;
      if (nearTop && blockedUp) {
        const out = new THREE.Vector3(tr.x - this.ladderCenter.x, 0, tr.z - this.ladderCenter.z);
        if (out.lengthSq() < 1e-6) out.set(camForward.x, 0, camForward.z);
        if (out.lengthSq() < 1e-6) out.set(0, 0, -1);
        out.normalize();

        next = {
          x: tr.x + out.x * 0.70,
          y: Math.max(tr.y, this.ladderMaxY) + 0.25,
          z: tr.z + out.z * 0.70
        };

        this.onLadder = false;
        this.ladderCooldown = 0.75;
        this.velY = 0;

        this.body.setTranslation(next, true);
      }
    }

    this.body.setNextKinematicTranslation(next);

    const __rawGrounded = this.controller.computedGrounded();


    this.grounded = __rawGrounded && (this as any).groundIgnoreTimer <= 0;


    if (this.grounded && !this.wasGrounded) this.jumpsUsed = 0;

    if (this.onLadder) {
      this.grounded = false;
      this.velY = Math.max(-6.5, Math.min(6.5, this.velY));
    } else {
      if (this.grounded && this.velY < 0) this.velY = 0;
    }

    this.moveLen = v.length();

    // Visual sync
    this.mesh.position.set(tr.x, tr.y - 0.8, tr.z);

    // Facing
    if (this.onLadder) {
      const yaw = Math.atan2(camForward.x, camForward.z);
      this.mesh.rotation.y = yaw;
    } else if (v.lengthSq() > 0.0001) {
      const yaw = Math.atan2(v.x, v.z);
      this.mesh.rotation.y = yaw;
    }

    this.updateAnim(dt);
  }

  private updateAnim(dt: number): void {
    if (this.mixer) this.mixer.update(dt);

    // tick down lock + jump active timer
    this.jumpAnimLock = Math.max(0, this.jumpAnimLock - dt);
    if (this.jumpActive) this.jumpActiveTime += dt;

    const airbornePhysics = !this.grounded && !this.onLadder;
    const airborne = airbornePhysics || (this.jumpAnimLock > 0 && !this.onLadder);

    if (this.jumpActive && this.grounded && this.velY <= 0 && this.jumpActiveTime > 0.12) {
      this.endJumpAnim();
    }

    const shouldBeJump =
      (this.jumpActive && !this.onLadder) ||
      (airborne && (!!this.actions.jump || !!this.jumpOverlayAction));

    // Blend overlay alpha
    this.jumpOverlayTarget = shouldBeJump ? 1 : 0;
    const rate = this.jumpOverlayTarget > this.jumpOverlayAlpha ? this.jumpOverlayRateUp : this.jumpOverlayRateDown;
    this.jumpOverlayAlpha = this.approach(this.jumpOverlayAlpha, this.jumpOverlayTarget, rate, dt);

    // Drive overlay action weight (this is the key fix: it lives INSIDE the mixer evaluation)
    if (this.jumpOverlayAction) {
      // v10: overlay forced off (using exaggerated jump clip)
      this.jumpOverlayAction.enabled = false;
      this.jumpOverlayAction.setEffectiveWeight(0);
    }
// Squash/stretch on the OUTER GROUP so nothing can overwrite it.
    this.applyJumpSquashStretch(this.jumpOverlayAlpha);

    if (shouldBeJump) {
      // Ensure jump action dominates if it exists
      const a = this.actions.jump;
      if (a) {
        this.actions.idle?.setEffectiveWeight(0);
        this.actions.walk?.setEffectiveWeight(0);
        this.actions.run?.setEffectiveWeight(0);
        a.setEffectiveWeight(1);

        if (this.state !== "jump") {
          a.enabled = true;
          (a as any).paused = false;
          a.play();
          fadeTo(this.current, a, 0.06);
          this.current = a;
          this.state = "jump";
        }
      }
      return;
    }

    // Ground locomotion
    const moving = this.moveLen > 0.05;
    const desired: MoveState = !moving ? "idle" : this.running ? "run" : "walk";

    this.actions.jump?.setEffectiveWeight(0);
    this.actions.idle?.setEffectiveWeight(desired === "idle" ? 1 : 0);
    this.actions.walk?.setEffectiveWeight(desired === "walk" ? 1 : 0);
    this.actions.run?.setEffectiveWeight(desired === "run" ? 1 : 0);

    if (desired !== this.state) {
      const next = this.actions[desired] ?? this.actions.idle ?? null;
      if (next) {
        next.enabled = true;
        next.play();
        fadeTo(this.current, next, 0.12);
        this.current = next;
      }
      this.state = desired;
    }

    this.wasGrounded = this.grounded;
  }

  syncFromPhysics(): void {
    const t = this.body.translation();
    this.mesh.position.set(t.x, t.y - 0.8, t.z);
  }
}
