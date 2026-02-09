import * as THREE from "three";
import type { Physics } from "../physics/Physics";
import { Input } from "../core/Input";
import { ASSETS, ANIM } from "../config/assets";
import { loadGLTF } from "../core/gltf";
import { findClipByNames, fadeTo } from "../core/anim";

type MoveState = "idle" | "walk" | "run" | "jump";

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

  // Ladder climbing (Minecraft-style)
  private onLadder = false;
  private ladderCenter = new THREE.Vector3();
  private ladderMinY = -Infinity;
  private ladderMaxY = Infinity;
  private ladderCooldown = 0;
  grounded = false;
  private wasGrounded = true;

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

  constructor(private physics: Physics, private input: Input) {}

  async spawn(pos: THREE.Vector3): Promise<void> {
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

    // Load avatar GLB (non-blocking if it fails)
    await this.loadAvatar();
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

      // Scale avatar to match capsule height (~1.7-1.9)
      const b = new THREE.Box3().setFromObject(model);
      const sz = new THREE.Vector3();
      b.getSize(sz);
      const targetH = 1.85;
      const sc = sz.y > 0 ? targetH / sz.y : 1;
      model.scale.setScalar(sc);

      // Recompute & put feet on ground and center x/z
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
        const jump = findClipByNames(gltf.animations, ANIM.jump);

        if (idle) this.actions.idle = this.mixer.clipAction(idle);
        if (walk) this.actions.walk = this.mixer.clipAction(walk);
        if (run) this.actions.run = this.mixer.clipAction(run);
        if (jump) {
          const a = this.mixer.clipAction(jump);
          a.setLoop(THREE.LoopOnce, 1);
          a.clampWhenFinished = true;
          this.actions.jump = a;
        }

        // Start idle if available
        if (this.actions.idle) {
          this.actions.idle.play();
          this.current = this.actions.idle;
          this.state = "idle";
        }
      }
    } catch (e) {
      console.warn("Failed to load avatar:", e);
    }
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
  }

  update(dt: number, cameraYaw: number): void {
    const forward = (this.input.down("KeyW") ? 1 : 0) + (this.input.down("KeyS") ? -1 : 0);
    const right = (this.input.down("KeyD") ? 1 : 0) + (this.input.down("KeyA") ? -1 : 0);

    const v = new THREE.Vector3(right, 0, forward);
    if (v.lengthSq() > 0) v.normalize();

    // rotate by camera yaw so WASD matches view direction
    const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), cameraYaw);
    v.applyQuaternion(rot);

    this.running = this.input.down("ShiftLeft") || this.input.down("ShiftRight");
    const speed = this.running ? this.runSpeed : this.walkSpeed;
    const effectiveSpeed = this.onLadder ? Math.min(speed, 2.8) : speed;

    // Ladder cooldown (prevents instantly re-attaching after jumping off)
    if (this.ladderCooldown > 0) this.ladderCooldown = Math.max(0, this.ladderCooldown - dt);

    const onLadder = this.onLadder && this.ladderCooldown <= 0;

    // Jump / climb
    if (onLadder) {
      const climb = (this.input.down("KeyW") ? 1 : 0) + (this.input.down("KeyS") ? -1 : 0);
      const climbSpeed = 4.6;
      const slideSpeed = -1.2;

      if (this.input.down("Space")) {
        // Jump off ladder
        this.velY = this.jumpSpeed;
        this.onLadder = false;
        this.ladderCooldown = 0.25;
      } else {
        this.velY = climb !== 0 ? climb * climbSpeed : slideSpeed;
        const tNow = this.body.translation();
        if (tNow.y > this.ladderMaxY + 0.35 && climb > 0) this.onLadder = false;
      }
    } else {
      // Jump
      if (this.grounded && this.input.down("Space")) {
        this.velY = this.jumpSpeed;
      }

      // Gravity
      this.velY += this.gravity * dt;
    }

    this.moveLen = v.length();

    let yDisp = this.velY * dt;

    // Small downward bias while grounded helps keep contact on ramps (reduces "hopping").
    if (this.grounded && !this.input.down("Space") && !this.onLadder) yDisp = Math.min(yDisp, -0.25 * dt);

    let xDisp = v.x * effectiveSpeed * dt;
    let zDisp = v.z * effectiveSpeed * dt;

    // Gentle stick to ladder center so you don't bounce off
    if (this.onLadder) {
      const tNow = this.body.translation();
      const dx = this.ladderCenter.x - tNow.x;
      const dz = this.ladderCenter.z - tNow.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.001) {
        const pullVel = Math.min(dist, 0.8) * 6.0;
        xDisp += (dx / dist) * pullVel * dt;
        zDisp += (dz / dist) * pullVel * dt;
      }
    }

    const desired = { x: xDisp, y: yDisp, z: zDisp };

    const filterFlags = this.physics.R.QueryFilterFlags.EXCLUDE_SENSORS;
    this.controller.computeColliderMovement(this.collider, desired, filterFlags);

    const m = this.controller.computedMovement();

    const t = this.body.translation();
    const next = { x: t.x + m.x, y: t.y + m.y, z: t.z + m.z };
    this.body.setNextKinematicTranslation(next);

    this.grounded = this.controller.computedGrounded();

    if (this.onLadder) {
      // While on ladder we treat you as airborne to avoid jump logic jitter.
      this.grounded = false;
      this.velY = Math.max(-6.5, Math.min(6.5, this.velY));
    } else {
      if (this.grounded && this.velY < 0) this.velY = 0;
    }

    // Visual sync
    this.mesh.position.set(t.x, t.y - 0.8, t.z);

    // Face movement direction
    if (v.lengthSq() > 0.0001) {
      const yaw = Math.atan2(v.x, v.z);
      this.mesh.rotation.y = yaw;
    }

    // Update animation state
    this.updateAnim(dt);
  }

  private updateAnim(dt: number): void {
    if (this.mixer) this.mixer.update(dt);

    const airborne = !this.grounded;

    // Jump trigger when leaving ground
    if (airborne && this.wasGrounded && this.actions.jump) {
      this.state = "jump";
      fadeTo(this.current, this.actions.jump, 0.08);
      this.current = this.actions.jump ?? this.current;
    }

    // Land -> choose locomotion
    if (!airborne && !this.wasGrounded) {
      // landed
      this.state = "idle";
    }

    if (!airborne) {
      const moving = this.moveLen > 0.05;
      const desired: MoveState = !moving ? "idle" : this.running ? "run" : "walk";

      if (desired !== this.state) {
        this.state = desired;
        const next = this.actions[desired] ?? this.actions.idle ?? null;
        if (next) {
          fadeTo(this.current, next, 0.12);
          this.current = next;
        }
      }
    }

    this.wasGrounded = this.grounded;
  }

  syncFromPhysics(): void {
    const t = this.body.translation();
    this.mesh.position.set(t.x, t.y - 0.8, t.z);
  }
}