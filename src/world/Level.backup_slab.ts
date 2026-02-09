import * as THREE from "three";
import type { Physics } from "../physics/Physics";
import { ASSETS } from "../config/assets";
import { PORTFOLIO_SECTIONS } from "../config/portfolio";
import { loadGLTF } from "../core/gltf";
import { coinMesh } from "./primitives";

type PlatformCandidate = {
  obj: THREE.Mesh;
  name: string;
  bbox: THREE.Box3;
  size: THREE.Vector3;
  center: THREE.Vector3;
  topY: number;
  area: number;
};

export class Level {
  scene = new THREE.Group();

  // Static colliders live on one fixed rigid-body
  private staticBody!: any;

  // Gameplay collections
  portals = new Map<string, { group: THREE.Group; sensor: any; teleportTo: THREE.Vector3 }>();
  coins = new Map<string, { mesh: THREE.Mesh; sensor: any; baseY: number }>();
  // Baked-in pickups inside Sweet_Land.glb (Coin_01.*, Gem_*, Box_*, etc.)
  bakedPickups = new Map<
    string,
    {
      mesh: THREE.Object3D;
      kind: string;
      basePos: THREE.Vector3;
      centerLocal: THREE.Vector3;
      baseY: number;
      baseRotY: number;
      maxDim: number;
      collected: boolean;

      // InstancedMesh support (optional)
      instanced?: boolean;
      instanceId?: number;
      baseMatrix?: THREE.Matrix4;
    }
  >();

  // Ladders detected from the world GLB (for Minecraft-style climbing)
  ladders: { bbox: THREE.Box3; center: THREE.Vector3; minY: number; maxY: number }[] = [];

  getLadderAt(pos: THREE.Vector3): { center: THREE.Vector3; minY: number; maxY: number } | null {
    let best: { center: THREE.Vector3; minY: number; maxY: number } | null = null;
    let bestD2 = Infinity;

    for (const l of this.ladders) {
      if (pos.y < l.minY - 0.6 || pos.y > l.maxY + 0.9) continue;
      if (pos.x < l.bbox.min.x - 0.8 || pos.x > l.bbox.max.x + 0.8) continue;
      if (pos.z < l.bbox.min.z - 0.8 || pos.z > l.bbox.max.z + 0.8) continue;

      const dx = l.center.x - pos.x;
      const dz = l.center.z - pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = { center: l.center, minY: l.minY, maxY: l.maxY };
      }
    }

    return best;
  }


  npcs = new Map<
    string,
    {
      group: THREE.Group;
      sensor: any;
      name: string;
      baseY: number;
      mixer?: THREE.AnimationMixer;
      actions?: { idle?: THREE.AnimationAction; talk?: THREE.AnimationAction };
      current?: THREE.AnimationAction | null;
    }
  >();

  private coinSpawn: { id: string; pos: THREE.Vector3 }[] = [];

  // Computed from the GLB world
  private _spawn = new THREE.Vector3(0, 3, 0);
  private _portalSpots = new Map<string, THREE.Vector3>();

  constructor(private physics: Physics) {}

  get spawn(): THREE.Vector3 {
    return this._spawn.clone();
  }

  get portalSpots(): Map<string, THREE.Vector3> {
    return this._portalSpots;
  }


  // Hardcoded portal placements (permanent)
  // (Captured via Shift+P after positioning: projects/work/collabs/contact)
  private static readonly HARD_PORTALS: Record<string, { x: number; y: number; z: number; rotY: number }> = {
    // Exact values printed by Shift+P
    projects: { x: -37.248, y: 5.98, z: 57.762, rotY: -1.5708 },
    work:     { x: -23.955, y: 12.166, z: -47.355, rotY: 3.1416 },
    collabs:  { x: 26.076,  y: 11.72,  z: -52.997, rotY: 20.4204 },
    contact:  { x: -38.896, y: 8.0,    z: 16.069,  rotY: 9.4248 },
  };

  private hardPortal(id: string): { pos: THREE.Vector3; rotY: number } | null {
    const p = (Level.HARD_PORTALS as any)[id];
    if (!p) return null;
    return { pos: new THREE.Vector3(p.x, p.y, p.z), rotY: Number(p.rotY) || 0 };
  }


  // Adds an extra waffle/cookie slab near the "work" portal area so you can chain the jump
  // from the tower platform -> (new slab) -> existing floating slab -> the jello platform.
    private addTowerJumpHelperSlab(root: THREE.Object3D): void {
    // Adds ONE extra waffle slab between an existing floating waffle slab and a nearby platform.
    // This is intentionally conservative: it finds a single "gap" and fills it, without touching anything else.

    if (!root) return;

    // Avoid duplicates if the slab already exists (e.g., hot reload).
    let already = false;
    root.traverse((o) => {
      const anyObj = o as any;
      if (anyObj?.isMesh && o.name === "JumpBridge_Slab02") already = true;
    });
    if (already) return;

    root.updateMatrixWorld(true);

    type WaffleCandidate = {
      mesh: THREE.Mesh;
      box: THREE.Box3;
      center: THREE.Vector3;
      size: THREE.Vector3;
      radius: number;
      topY: number;
      rotY: number;
    };

    const waffles: WaffleCandidate[] = [];
    const tmpBox = new THREE.Box3();
    const tmpSize = new THREE.Vector3();
    const tmpCenter = new THREE.Vector3();
    const tmpQuat = new THREE.Quaternion();
    const tmpEuler = new THREE.Euler();

    // Gather "waffle slab" meshes from the world.
    root.traverse((obj) => {
      const m = obj as any;
      if (!m?.isMesh) return;

      const name = String(m.name || "").toLowerCase();
      if (!(name.includes("waffle") || name.includes("platform_waffle") || name.includes("wafer"))) return;
      if (name.includes("jumpbridge_slab")) return;

      tmpBox.setFromObject(m);
      tmpBox.getSize(tmpSize);

      if (!isFinite(tmpSize.x) || !isFinite(tmpSize.y) || !isFinite(tmpSize.z)) return;
      if (tmpSize.x < 0.5 || tmpSize.z < 0.5) return;
      if (tmpSize.y > 1.25) return; // slab-like only

      tmpBox.getCenter(tmpCenter);
      const topY = tmpBox.max.y;

      // Ignore low / ground waffles; we're targeting the elevated bridge area.
      if (topY < 3.0) return;

      const radius = 0.5 * Math.max(tmpSize.x, tmpSize.z);

      (m as THREE.Object3D).getWorldQuaternion(tmpQuat);
      tmpEuler.setFromQuaternion(tmpQuat, "YXZ");

      waffles.push({
        mesh: m as THREE.Mesh,
        box: tmpBox.clone(),
        center: tmpCenter.clone(),
        size: tmpSize.clone(),
        radius,
        topY,
        rotY: tmpEuler.y,
      });
    });

    if (waffles.length === 0) {
      console.warn("[SweetLand] No waffle slabs found; cannot place JumpBridge_Slab02.");
      return;
    }

    const platforms = this.findPlatformCandidates(root);
    if (platforms.length === 0) {
      console.warn("[SweetLand] No platform candidates found; cannot place JumpBridge_Slab02.");
      return;
    }

    const dir = new THREE.Vector3();
    let best:
      | {
          waffle: WaffleCandidate;
          platform: PlatformCandidate;
          gap: number;
          dir: THREE.Vector3;
        }
      | null = null;

    // Pick ONE best waffle/platform pair that looks like an actual "jump gap".
    for (const w of waffles) {
      for (const p of platforms) {
        if (p.mesh === w.mesh) continue;

        // Same-ish height (tops line up)
        if (Math.abs(p.topY - w.topY) > 1.2) continue;

        // Only consider reasonably large flat platforms (not tiny props)
        if (p.area < 6.0) continue;

        dir.set(p.center.x - w.center.x, 0, p.center.z - w.center.z);
        const dist = dir.length();
        if (dist < 0.5 || dist > 14.0) continue;

        const platRadius = 0.5 * Math.max(p.size.x, p.size.z);
        const gap = dist - w.radius - platRadius;

        // The “missing slab” gap should be in a narrow band: not touching, not far away.
        if (gap < 0.8 || gap > 6.0) continue;

        // Prefer the tightest valid gap (most likely the one you’re staring at).
        if (!best || gap < best.gap) {
          best = { waffle: w, platform: p, gap, dir: dir.clone().normalize() };
        }
      }
    }

    if (!best) {
      console.warn("[SweetLand] No suitable waffle/platform gap found; cannot place JumpBridge_Slab02.");
      return;
    }

    const w = best.waffle;
    const p = best.platform;

    // Place the slab at the midpoint of the horizontal gap between the two surfaces.
    const slabCenter = w.center
      .clone()
      .add(best.dir.clone().multiplyScalar(w.radius + best.gap * 0.5));

    // Keep the top surface aligned with the existing waffle & platform.
    const slabTopY = Math.min(w.topY, p.topY);
    const slabY = slabTopY - w.size.y * 0.5 + 0.02;

    const sx = w.size.x;
    const sy = w.size.y;
    const sz = w.size.z;

    const geom = new THREE.BoxGeometry(sx, sy, sz);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xe2b36b,
      roughness: 0.85,
      metalness: 0.0,
    });

    const slab = new THREE.Mesh(geom, mat);
    slab.name = "JumpBridge_Slab02";
    slab.position.set(slabCenter.x, slabY, slabCenter.z);
    slab.rotation.y = w.rotY;
    slab.castShadow = true;
    slab.receiveShadow = true;

    root.add(slab);

    // Physics: add a simple box collider so you can land and walk on it.
    try {
      this.addBoxCollider(slab, { friction: 1.0, shrink: 0.98 });
    } catch (e) {
      console.warn("[SweetLand] Failed to add collider for JumpBridge_Slab02:", e);
    }

    console.log("[SweetLand] Added JumpBridge_Slab02 at", {
      x: slab.position.x,
      y: slab.position.y,
      z: slab.position.z,
      rotY: slab.rotation.y,
      fromWaffle: { x: w.center.x, y: w.center.y, z: w.center.z },
      toPlatform: { x: p.center.x, y: p.center.y, z: p.center.z },
      gap: best.gap,
    });
  }

private findNearestWaffleSlab(world: THREE.Object3D, anchor: THREE.Vector3, minY: number = -Infinity): THREE.Mesh | null {
    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    let best: THREE.Mesh | null = null;
    let bestD = Infinity;

    world.traverse((o) => {
      const mesh = o as any as THREE.Mesh;
      if (!mesh || !(mesh as any).isMesh) return;

      const name = ((mesh.name || "") as string).toLowerCase();
      // Strong name hints first
      const nameHit = name.includes("waffle") || name.includes("cookie") || name.includes("biscuit") || name.includes("platform_waffle");

      // Bounding box tests (thin + not huge)
      box.setFromObject(mesh);
      box.getSize(size);
      box.getCenter(center);

        if (center.y < minY) return;

      // Must be in roughly the same vertical band as the anchor (upper area)
      if (center.y < anchor.y - 6 || center.y > anchor.y + 8) return;

      // Must be "slab-like": thin and medium-sized
      const maxXZ = Math.max(size.x, size.z);
      const minXZ = Math.min(size.x, size.z);
      const thin = size.y <= 1.0;
      const medium = maxXZ <= 10.0 && minXZ >= 1.5;

      if (!thin || !medium) return;

      // Distance gate: near the work-portal region only
      const dx = center.x - anchor.x;
      const dz = center.z - anchor.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 3.0 || d > 35.0) return;

      // If no name hint, require a squarish/rect slab footprint
      if (!nameHit) {
        if (maxXZ < 2.0) return;
        // Avoid very long bridges/ramps
        if (maxXZ / Math.max(0.0001, minXZ) > 2.5) return;
      }

      if (d < bestD) {
        bestD = d;
        best = mesh;
      }
    });

    return best;
  }

  async build(onProgress?: (p01: number) => void): Promise<void> {
    this.scene.name = "SweetLand";

    // Base rigidbody for all colliders
    this.staticBody = this.physics.world.createRigidBody(this.physics.R.RigidBodyDesc.fixed());

    // Safety catch plane far below (prevents falling forever if something goes wrong)
    {
      const desc = this.physics.R.ColliderDesc.cuboid(500, 1, 500)
        .setTranslation(0, -60, 0)
        .setFriction(1.0);
      this.physics.world.createCollider(desc, this.staticBody);
    }

    if (!ASSETS.world) {
      throw new Error("Missing ASSETS.world path (src/config/assets.ts).");
    }

    onProgress?.(0.02);

    // Load world GLB
    const gltf = await loadGLTF(ASSETS.world, {
      onProgress: (loaded, total) => {
        if (total > 0) onProgress?.(0.02 + 0.40 * (loaded / total));
      }
    });

    const world = gltf.scene;
    world.name = "SweetLandWorld";
    world.traverse((o) => {
      // Reduce snaggy visuals: still keep shadows for the big pieces
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
        // Improve PBR look a bit without changing your materials too much
        const mat = m.material as any;
        if (mat && typeof mat.roughness === "number") mat.roughness = Math.min(0.95, Math.max(0.25, mat.roughness));
      }
    });

    this.scene.add(world);
    onProgress?.(0.45);

    // Add an extra slab to make the tower jump chainable
    this.addTowerJumpHelperSlab(world);

    // Colliders from world meshes (walkables = trimesh, props = boxes).
    // Water surfaces must stay visual-only so the player can wade/submerge.
    this.ladders = [];
    const { walkables, props, waters } = this.collectMeshGroups(world);

    // Robust water-surface detection (covers cases where water was misclassified as walkable/prop).
    const isWaterSurface = (mesh: THREE.Mesh): boolean => {
      const name = (mesh.name || "").toLowerCase();
      const mat: any = (mesh as any).material;
      let matNames = "";
      if (Array.isArray(mat)) matNames = mat.map((mm) => mm?.name || "").join(" ").toLowerCase();
      else matNames = (mat?.name || "").toLowerCase();

      const lower = `${name} ${matNames}`;
      // NOTE: do NOT match "icecream"/"scoop" pickups — keep to water-ish words only.
      const WATERLIKE = /(water|river|lake|sea|ocean|pond|stream|canal|puddle|pool|frozenwater|icewater)/i;
      if (!WATERLIKE.test(lower)) return false;

      // Water surfaces in this world are large + very thin.
      const box = new THREE.Box3().setFromObject(mesh);
      const size = new THREE.Vector3();
      box.getSize(size);
      const area = size.x * size.z;
      return size.y <= 0.18 && area >= 8.0;
    };

    // Water: visual-only (no solid colliders). The riverbed/terrain below remains walkable.
    for (const w of waters) w.userData.isWaterSurface = true;

    // Walkables: trimesh (accurate platforms/bridges)
    for (const m of walkables) {
      if (isWaterSurface(m)) continue;
      this.addTrimeshCollider(m, { friction: 1.0 });
    }

    // Props: box colliders (fast + less snag)
    // Important: exclude truly giant backdrop meshes so we don't accidentally block navigation.
    for (const m of props) {
      const n = (m.name || "").toLowerCase();
      if (n.includes("backdrop") || n.includes("background") || n.includes("sky")) continue;
      if (isWaterSurface(m)) continue;

      // Measure once
      const box = new THREE.Box3().setFromObject(m);
      const size = new THREE.Vector3();
      box.getSize(size);
      const vol = size.x * size.y * size.z;
      const maxDim = Math.max(size.x, size.y, size.z);

      // Skip only truly giant backdrop/skybox meshes; keep big walls/buildings so the player can't walk through them.
      if ((vol > 25000 || maxDim > 250) && (n.includes("backdrop") || n.includes("background") || n.includes("sky") || n.includes("cloud") || n.includes("mountain") || n.includes("hill") || n.includes("terrain") || n.includes("landscape") || n.includes("distant"))) {
        continue;
      }

      
      // Candy-cane gates / arches:
      // - Candy canes should be solid.
      // - The blue "screen"/plasma should be pass-through.
      // Some gate assets use generic child mesh names (e.g. "Plane"), so use the full name chain (mesh + parents + materials).
      const deepLower = this.fullLower(m);
      const candyGateish =
        deepLower.includes("cane") ||
        deepLower.includes("candycane") ||
        deepLower.includes("candy-cane") ||
        deepLower.includes("gate") ||
        deepLower.includes("arch") ||
        deepLower.includes("portal");

      const looksTransparent = this.isTransparentMaterial((m as any).material);
      // Gate screens are often flat panels with generic names (e.g. "Plane") and sometimes opaque materials.
      // Detect them by shape under gate/arch/cane/portal groups so they remain pass-through.
      const __dimsGate = [size.x, size.y, size.z].sort((a, b) => a - b);
      const __aGate = __dimsGate[0];
      const __bGate = __dimsGate[1];
      const __cGate = __dimsGate[2];
      const __denGate = Math.max(__aGate, 1e-6);
      const __thinGatePanel =
        __aGate <= 0.22 &&
        __bGate / __denGate >= 2.4 &&
        __cGate / __denGate >= 6.0 &&
        __bGate >= 0.8 &&
        __cGate >= 1.6;

      const isGateScreen =
        deepLower.includes("doorplasma") ||
        deepLower.includes("door_01") ||
        deepLower.includes("door01") ||
        (candyGateish &&
          (deepLower.includes("plasma") ||
            deepLower.includes("screen") ||
            deepLower.includes("forcefield") ||
            deepLower.includes("shield") ||
            deepLower.includes("energy") ||
            deepLower.includes("glass") ||
            deepLower.includes("window") ||
            looksTransparent ||
            __thinGatePanel));

      if (isGateScreen) {
        continue;
      }

      // For the gate frame itself, add *frame* colliders (posts) so the opening remains walkable.
      // (We intentionally do NOT add a single solid collider for the whole gate mesh.)
      if (candyGateish && (deepLower.includes("gate") || deepLower.includes("arch") || deepLower.includes("cane"))) {
        this.addGateFrameColliders(m);
        continue;
      }

const mn = (((m.material as any)?.name ?? "") as string).toLowerCase();
      // Avoid adding tiny decorative glass/plasma shards as colliders (they can snag the player),
      // but do NOT skip large structural panels/walls (like the teal wall + rainbow panel area).
      const isLikelyWallPanel = n.includes("wall") || n.includes("panel") || n.includes("rainbow") || n.includes("teal");
      const looksLikeSmallPanel =
        !isLikelyWallPanel &&
        (n.includes("glass") || n.includes("plasma") || mn.includes("glass") || mn.includes("plasma")) &&
        maxDim < 1.9 &&
        vol < 10;
      if (looksLikeSmallPanel) continue;

      // Reduce seam-gaps on large structural pieces (prevents slipping into walls)
      const shrink = (maxDim > 12 || size.y > 6 || size.x * size.z > 40) ? 0.99 : 0.92;

      // Instanced meshes need per-instance colliders (otherwise Rapier gets one big incorrect box).
      if ((m as any).isInstancedMesh) {
        this.addInstancedBoxColliders(m as any, { friction: 0.9, shrink, maxInstances: 320 });
        continue;
      }

      this.addBoxCollider(m, { friction: 0.9, shrink });
    }

    onProgress?.(0.72);

    // Analyze platforms to find hub + 4 nearby portal platforms
    const platformCandidates = this.findPlatformCandidates(world);
    const hub = this.pickHubPlatform(platformCandidates);
    this._spawn = hub.center.clone();
    this._spawn.y = hub.topY + 1.4;

    const portalPlatforms = this.pickPortalPlatforms(platformCandidates, hub);

    // Place portals (Gate_01 if available, otherwise a primitive fallback label)
    await this.createPortals(portalPlatforms, onProgress);
    this.addJumpBridgeSlab(world);

    onProgress?.(0.86);

    // Coins + NPCs (placed relative to hub/portals)
    this.seedCoins(hub, portalPlatforms);
    await this.addNPCs(hub, onProgress);

    onProgress?.(1.0);
  }

  update(t: number): void {
    // coin idle motion
    for (const c of this.coins.values()) {
      c.mesh.rotation.y = t * 2.2;
      c.mesh.position.y = c.baseY + Math.sin(t * 3.5) * 0.12;
    }
    
    // baked pickup idle motion
    for (const p of this.bakedPickups.values()) {
      if (p.collected) continue;

      const obj: any = p.mesh as any;

      // InstancedMesh pickups (if any) are handled per-instance and we do not animate them here.
      if (p.instanced && obj?.isInstancedMesh && typeof p.instanceId === "number") continue;

      if (!p.mesh.visible) continue;

      p.mesh.rotation.y = p.baseRotY + t * 1.6;
      p.mesh.position.y = p.baseY + Math.sin(t * 2.6 + p.basePos.x * 0.25) * 0.08;
    }
// npc idle
    for (const n of this.npcs.values()) {
      n.group.position.y = n.baseY + Math.sin(t * 2.0 + n.group.position.x * 0.2) * 0.03;
      n.mixer?.update(1 / 60);
    }
  }

  // --- Coins
  respawnCoins(): void {
    for (const [id, c] of this.coins) {
      this.scene.remove(c.mesh);
      this.physics.untagCollider(c.sensor);
      this.physics.world.removeCollider(c.sensor, true);
      this.coins.delete(id);
    }
    for (const s of this.coinSpawn) this.createCoin(s.id, s.pos);
    this.respawnBakedPickups();
  }

  collectCoin(id: string): void {
    const c = this.coins.get(id);
    if (!c) return;
    this.scene.remove(c.mesh);
    this.physics.untagCollider(c.sensor);
    this.physics.world.removeCollider(c.sensor, true);
    this.coins.delete(id);
  }

    // --- Baked pickups (from Sweet_Land.glb)
  collectBakedPickup(id: string): void {
    const p = this.bakedPickups.get(id);
    if (!p || p.collected) return;
    p.collected = true;

    const obj: any = p.mesh as any;

    // InstancedMesh: hide just this instance by scaling it to ~0
    if (p.instanced && obj?.isInstancedMesh && typeof p.instanceId === "number") {
      const inst = obj as THREE.InstancedMesh;
      const m4 = new THREE.Matrix4();
      inst.getMatrixAt(p.instanceId, m4);

      // Save base matrix once so respawn can restore it
      if (!p.baseMatrix) p.baseMatrix = m4.clone();

      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scl = new THREE.Vector3();
      m4.decompose(pos, quat, scl);
      scl.setScalar(0.0001);
      m4.compose(pos, quat, scl);

      inst.setMatrixAt(p.instanceId, m4);
      (inst.instanceMatrix as any).needsUpdate = true;
      return;
    }

    // Regular Mesh/Group
    p.mesh.visible = false;
  }

  respawnBakedPickups(): void {
    for (const p of this.bakedPickups.values()) {
      p.collected = false;

      const obj: any = p.mesh as any;

      // InstancedMesh: restore original instance matrix
      if (p.instanced && obj?.isInstancedMesh && typeof p.instanceId === "number") {
        const inst = obj as THREE.InstancedMesh;
        if (p.baseMatrix) {
          inst.setMatrixAt(p.instanceId, p.baseMatrix);
          (inst.instanceMatrix as any).needsUpdate = true;
        }
        continue;
      }

      // Regular Mesh/Group
      p.mesh.visible = true;
      p.mesh.position.copy(p.basePos);
      p.mesh.rotation.y = p.baseRotY;
    }
  }

// --- NPC talk animation
  playNpcTalk(id: string): void {
    const npc = this.npcs.get(id);
    if (!npc?.actions) return;
    const talk = npc.actions.talk;
    const idle = npc.actions.idle;
    if (!talk) return;
    talk.reset();
    talk.setLoop(THREE.LoopOnce, 1);
    talk.clampWhenFinished = true;
    talk.fadeIn(0.12).play();
    if (npc.current && npc.current !== talk) npc.current.fadeOut(0.12);
    npc.current = talk;

    // Return to idle after
    const dur = talk.getClip().duration;
    window.setTimeout(() => {
      if (!idle) return;
      idle.reset().fadeIn(0.15).play();
      talk.fadeOut(0.15);
      npc.current = idle;
    }, Math.max(200, (dur * 1000) | 0));
  }

  // --- Helpers

private collectMeshGroups(
  root: THREE.Object3D
): { walkables: THREE.Mesh[]; props: THREE.Mesh[]; waters: THREE.Mesh[] } {
  const walkables: THREE.Mesh[] = [];
  const props: THREE.Mesh[] = [];
  const waters: THREE.Mesh[] = [];

  const WATER_RE = /(water|river|lake|sea|ocean)/i;

  // Names in this asset pack are inconsistent — treat the obvious ground/ramp pieces as walkable.
  const WALK_RE = /(platform|ground|bridge|stair|stairs|ramp|angle|path|road|floor|terrain|land|trampoline|slope|slide)/i;

  // Things we never want to classify as pickups.
  const STRUCTURAL_RE =
    /(wall|roof|house|building|tower|castle|gate|arch|cane|door|fence|rail|post|pillar|tree|bush|foliage|leaf|branch|mountain|hill|cloud|sky|backdrop|background|landscape|npc|character|lamp|sign)/i;

  // Explicit pickup words (covers the “uncollectible” props: question block, ring, dice, present, ice cream scoop, lightning bolt).
  const PICKUP_RE =
    /(coin|gem|crystal|diamond|jewel|dice|\bdie\b|ring|hoop|torus|present|gift|prize|reward|mystery|question|qmark|surprise|box|crate|chest|energy|lightning|bolt|zap|thunder|icecream|ice\s*cream|scoop|cone|cupcake|muffin|twist|swirl|twirl)/i;

  const getFullLower = (obj: THREE.Object3D): string => {
    const parts: string[] = [];
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      if (cur.name) parts.push(cur.name);
      cur = cur.parent;
    }

    // Material names help a lot in this pack
    const mat = (obj as any).material;
    if (Array.isArray(mat)) {
      for (const mm of mat) if (mm?.name) parts.push(mm.name);
    } else if (mat?.name) {
      parts.push(mat.name);
    }

    return parts.join(" ").toLowerCase();
  };

const getSelfLower = (obj: THREE.Object3D): string => {
  const parts: string[] = [];
  if (obj.name) parts.push(obj.name);

  const mat = (obj as any).material;
  if (Array.isArray(mat)) {
    for (const mm of mat) if (mm?.name) parts.push(mm.name);
  } else if (mat?.name) {
    parts.push(mat.name);
  }

  return parts.join(" ").toLowerCase();
};

  root.updateMatrixWorld(true);

  root.traverse((o) => {
    const anyObj: any = o as any;
    if (!anyObj?.isMesh) return;

    const m = o as THREE.Mesh;
    const geom = m.geometry as THREE.BufferGeometry;
    if (!geom?.attributes?.position) return;

    // Skip invisible
    if ((m.material as any)?.visible === false) return;

    const lower = getFullLower(m);
    const selfLower = getSelfLower(m);

    // Water
    if (WATER_RE.test(lower)) {
      waters.push(m);
      return;
    }

    // Measure (world)
    const box = new THREE.Box3().setFromObject(m);
    const size = new THREE.Vector3();
    const centerW = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(centerW);

    const vol = size.x * size.y * size.z;
    if (!isFinite(vol) || vol < 0.002) return;

    const area = size.x * size.z;
    const maxDim = Math.max(size.x, size.y, size.z);

    // Ladders: register climb volumes (still treated as props)
    const isLadder = /(ladder|climb|rope|rung)/i.test(lower);
    if (isLadder && size.y > 0.8 && size.y < 18 && maxDim < 10) {
      const cc = new THREE.Vector3();
      box.getCenter(cc);
      this.ladders.push({ bbox: box.clone(), center: cc, minY: box.min.y, maxY: box.max.y });
    }


    // Gate / portal "screen" panels must never become walkables (or they get trimesh colliders and block the player).
    // Some of these meshes have generic names/materials, so we also use a thin-panel shape heuristic.
    if (lower.indexOf("doorplasma") !== -1 || lower.indexOf("door_01") !== -1 || lower.indexOf("door01") !== -1) {
      props.push(m);
      return;
    }
    const __gateish =
      lower.indexOf("cane") !== -1 ||
      lower.indexOf("candycane") !== -1 ||
      lower.indexOf("candy-cane") !== -1 ||
      lower.indexOf("gate") !== -1 ||
      lower.indexOf("arch") !== -1 ||
      lower.indexOf("portal") !== -1;
    if (__gateish) {
      const __dims = [size.x, size.y, size.z].sort((a, b) => a - b);
      const __a = __dims[0];
      const __b = __dims[1];
      const __c = __dims[2];
      const __den = Math.max(__a, 1e-6);
      const __thinPanel =
        __a <= 0.22 &&
        __b / __den >= 2.4 &&
        __c / __den >= 6.0 &&
        __b >= 0.8 &&
        __c >= 1.6;
      const __looksTransparent = this.isTransparentMaterial((m as any).material);
      const __screenish =
        lower.indexOf("plasma") !== -1 ||
        lower.indexOf("screen") !== -1 ||
        lower.indexOf("forcefield") !== -1 ||
        lower.indexOf("shield") !== -1 ||
        lower.indexOf("energy") !== -1 ||
        lower.indexOf("glass") !== -1 ||
        lower.indexOf("window") !== -1 ||
        __looksTransparent ||
        __thinPanel;
      if (__screenish) {
        props.push(m);
        return;
      }
    }

    // Walkables BEFORE pickups so ramps never get misclassified again.
// BUT: never classify pickups (especially baked coins / props under bridges) as walkables,
// or they become solid/non-collectible.
const keywordPickupEarly = PICKUP_RE.test(selfLower);
const coinLike = /coin/i.test(selfLower);

// Use full path for walkable tags so bridge/stair meshes nested under groups still count,
// but never let small pickup-like meshes become walkables.
const smallPropLike = maxDim <= 1.8 && vol <= 10 && area <= 4;
const walkableByName = WALK_RE.test(lower) && !keywordPickupEarly && !smallPropLike;

const notWalkableLike = STRUCTURAL_RE.test(selfLower);
    const maxXZ = Math.max(size.x, size.z);
    const minXZ = Math.min(size.x, size.z);
    const aspect = minXZ > 1e-6 ? maxXZ / minXZ : 999;

    // Heuristic: broad-ish surfaces with modest thickness are walkable (ramps/platform slabs).
    const looksLikeRampOrPlatform =
      !walkableByName &&
      !notWalkableLike &&
      !keywordPickupEarly &&
      size.y > 0.12 &&
      size.y < 1.6 &&
      area > 6.0 &&
      (aspect > 1.25 || area > 18);

    if (walkableByName || looksLikeRampOrPlatform) {
      walkables.push(m);
      return;
    }

    // Baked pickups
    // Hard safety: never treat very large meshes as pickups.
    // Some baked coins are larger "floor coins" (area > 22) — still treat them as pickups.
    const smallEnough =
      maxDim >= 0.05 &&
      maxDim <= 6.0 &&
      vol <= 260 &&
      (area <= 22 || (coinLike && area <= 80));

    // Don't ever treat gates/arches/doors/fences as pickups.
    const excludedByStructure = STRUCTURAL_RE.test(selfLower) || isLadder;

    const keywordPickup = PICKUP_RE.test(selfLower);

    // Fallback pickup heuristic: tiny decorative props become collectible (helps when names are missing).
    const fallbackPickup = !excludedByStructure && maxDim <= 2.4 && vol <= 18 && area <= 8;

    if ((keywordPickup || fallbackPickup) && smallEnough) {
      // InstancedMesh support (rare in this repo, but supported)
      if ((m as any).isInstancedMesh) {
        const inst = m as unknown as THREE.InstancedMesh;
        const ibox = (geom.boundingBox ?? (geom.computeBoundingBox(), geom.boundingBox))!.clone();
        const cLocal = new THREE.Vector3();
        ibox.getCenter(cLocal);

        const m4 = new THREE.Matrix4();
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scl = new THREE.Vector3();

        const count = Math.min(inst.count ?? 0, 220);
        for (let i = 0; i < count; i++) {
          inst.getMatrixAt(i, m4);
          m4.decompose(pos, quat, scl);

          // Approximate instance size by scale
          const sx = Math.abs(scl.x);
          const sy = Math.abs(scl.y);
          const sz = Math.abs(scl.z);

          const instMaxDim = maxDim * Math.max(sx, sy, sz);
          if (instMaxDim > 6.0) continue;

          const id = `inst::${inst.uuid}::${i}`;
          if (this.bakedPickups.has(id)) continue;

          this.bakedPickups.set(id, {
            mesh: inst,
            kind: keywordPickup ? "pickup" : "pickup",
            basePos: pos.clone(),
            centerLocal: cLocal.clone(),
            baseY: pos.y,
            baseRotY: 0,
            maxDim: instMaxDim,
            collected: false,
            instanced: true,
            instanceId: i,
            baseMatrix: m4.clone()
          });
        }
        return;
      }

      // Regular mesh: store bounds center in local space (pivot is often offset in this pack)
      const centerLocal = (m as any).worldToLocal(centerW.clone());
      const id = `${m.name || "pickup"}::${m.uuid}`;

      if (!this.bakedPickups.has(id)) {
        // Rough kind classification (not critical to gameplay, but keeps future tuning easier)
        const kind =
          /coin/i.test(selfLower) ? "coin" :
          /(gem|crystal|diamond|jewel)/i.test(selfLower) ? "gem" :
          /(question|mystery|qmark)/i.test(selfLower) ? "mystery" :
          /(dice|\bdie\b)/i.test(selfLower) ? "dice" :
          /(ring|hoop|torus)/i.test(selfLower) ? "ring" :
          /(present|gift|prize|reward|box|crate|chest)/i.test(selfLower) ? "box" :
          /(energy|lightning|bolt|zap|thunder)/i.test(selfLower) ? "energy" :
          /(icecream|ice\s*cream|scoop|cone)/i.test(selfLower) ? "treat" :
          "pickup";

        this.bakedPickups.set(id, {
          mesh: m,
          kind,
          basePos: m.position.clone(),
          centerLocal,
          baseY: m.position.y,
          baseRotY: m.rotation.y,
          maxDim,
          collected: false
        });
      }
      return;
    }

    props.push(m);
  });

  return { walkables, props, waters };
}
  // Build a lowercase "full name" including this object, its parents, and material names.
  // This avoids missing important keywords when meshes have generic names (e.g. "Plane") but their parent is "Gate_*".
  private fullLower(obj: THREE.Object3D): string {
    const parts: string[] = [];
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      if (cur.name) parts.push(cur.name);
      cur = cur.parent as any;
    }
    const mat: any = (obj as any).material;
    if (mat) {
      if (Array.isArray(mat)) {
        for (const mm of mat) if (mm?.name) parts.push(mm.name);
      } else if (mat?.name) {
        parts.push(mat.name);
      }
    }
    return parts.join(" ").toLowerCase();
  }

  private isTransparentMaterial(mat: any): boolean {
    const one = (m: any): boolean => {
      if (!m) return false;
      if (m.transparent === true) return true;
      const op = typeof m.opacity === "number" ? m.opacity : 1;
      if (op < 0.995) return true;
      if (m.depthWrite === false) return true;
      const at = typeof m.alphaTest === "number" ? m.alphaTest : 0;
      if (at > 0) return true;
      return false;
    };
    return Array.isArray(mat) ? mat.some(one) : one(mat);
  }




  private addTrimeshCollider(mesh: THREE.Mesh, opts?: { friction?: number }): void {
    const geom = mesh.geometry as THREE.BufferGeometry;
    const posAttr = geom.attributes.position as THREE.BufferAttribute;

    const verts: number[] = new Array(posAttr.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld);
      verts[i * 3 + 0] = v.x;
      verts[i * 3 + 1] = v.y;
      verts[i * 3 + 2] = v.z;
    }

    let indices: number[];
    if (geom.index) {
      indices = Array.from(geom.index.array as any);
    } else {
      indices = Array.from({ length: posAttr.count }, (_, i) => i);
    }

    // Rapier expects triangle indices
    if (indices.length < 3) return;

    const friction = opts?.friction ?? 0.9;
    const desc = this.physics.R.ColliderDesc.trimesh(verts, indices)
      .setTranslation(0, 0, 0)
      .setFriction(friction);

    this.physics.world.createCollider(desc, this.staticBody);

    // Safety core for large walkable meshes: a slightly-shrunk box inside the trimesh
    // helps prevent the player from slipping into cracks between adjacent tris/parts.
    try {
      const bb = new THREE.Box3().setFromObject(mesh);
      const s = new THREE.Vector3();
      const c = new THREE.Vector3();
      bb.getSize(s);
      bb.getCenter(c);
      const area = s.x * s.z;
      const maxD = Math.max(s.x, s.y, s.z);
      if (area > 65 && s.y < 10 && maxD > 10) {
        const shrink = 0.985;
        const hx = (s.x * shrink) / 2;
        const hy = (s.y * shrink) / 2;
        const hz = (s.z * shrink) / 2;
        const core = this.physics.R.ColliderDesc.cuboid(hx, hy, hz)
          .setTranslation(c.x, c.y, c.z)
          .setFriction(opts.friction);
        this.physics.world.createCollider(core, this.staticBody);
      }
    } catch {
      // ignore
    }
  }

  private addGateFrameColliders(mesh: THREE.Mesh): void {
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Determine "width" axis in XZ plane
    const widthAxis: "x" | "z" = size.x >= size.z ? "x" : "z";
    const depthAxis: "x" | "z" = widthAxis === "x" ? "z" : "x";

    const width = widthAxis === "x" ? size.x : size.z;
    const depth = depthAxis === "x" ? size.x : size.z;

        // Posts on left/right (keep them slim so the opening is always walkable)
    const halfH = Math.max(size.y * 0.5 * 0.95, 0.8);
    const halfD = Math.max(depth * 0.5 * 0.45, 0.14);

    const minGap = 1.25; // player capsule needs room
    let postW = Math.min(0.85, Math.max(0.18, width * 0.10));
    const maxPostWForGap = (width - minGap) / 2;
    if (Number.isFinite(maxPostWForGap)) {
      postW = Math.max(0.14, Math.min(postW, maxPostWForGap));
    }
    if (postW <= 0.06) return;

    const offset = Math.max(0, width * 0.5 - postW * 0.5);

const mk = (sign: number) => {
      const cx = widthAxis === "x" ? center.x + sign * offset : center.x;
      const cz = widthAxis === "z" ? center.z + sign * offset : center.z;

      const hx = widthAxis === "x" ? postW * 0.5 : halfD;
      const hz = widthAxis === "z" ? postW * 0.5 : halfD;

      const desc = this.physics.R.ColliderDesc.cuboid(hx, halfH, hz)
        .setTranslation(cx, center.y, cz)
        .setFriction(1.0);

      this.physics.world.createCollider(desc, this.staticBody);
    };

    mk(-1);
    mk(1);
  }

  private addBoxCollider(mesh: THREE.Mesh, opts: { friction: number; shrink: number }): void {
        const fullName = this.fullLower(mesh);

    // Don't add solid colliders to our runtime portals (they have explicit sensors + pillar colliders).
    if (fullName.includes("portal")) return;

    // Gate/portal "screen" surfaces should be pass-through (no solid collider).
    const candyGateish =
      fullName.includes("cane") ||
      fullName.includes("candycane") ||
      fullName.includes("candy-cane") ||
      fullName.includes("gate") ||
      fullName.includes("arch") ||
      fullName.includes("portal");

    const looksTransparent = this.isTransparentMaterial((mesh as any).material);
    const screenishByName =
      fullName.includes("doorplasma") ||
      fullName.includes("door_01") ||
      fullName.includes("door01") ||
      (candyGateish &&
        (fullName.includes("plasma") ||
          fullName.includes("screen") ||
          fullName.includes("forcefield") ||
          fullName.includes("shield") ||
          fullName.includes("energy") ||
          fullName.includes("glass") ||
          fullName.includes("window") ||
          looksTransparent));
    if (screenishByName) return;

    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Additional safety: some gate screens are opaque but are still a very thin panel.
    if (candyGateish) {
      const __dimsGate = [size.x, size.y, size.z].sort((a, b) => a - b);
      const __a = __dimsGate[0];
      const __b = __dimsGate[1];
      const __c = __dimsGate[2];
      const __den = Math.max(__a, 1e-6);
      const __thinGatePanel =
        __a <= 0.22 &&
        __b / __den >= 2.4 &&
        __c / __den >= 6.0 &&
        __b >= 0.8 &&
        __c >= 1.6;
      if (__thinGatePanel) return;
    }

    // Skip extremely small props
    const vol = size.x * size.y * size.z;
    if (vol < 0.02) return;

    // Shrink to reduce snagging
    size.multiplyScalar(opts.shrink);

    // Clamp very thin colliders (fixes the teal wall / rainbow panel "walk inside" bug)
    const minThin = 0.28;
    size.x = Math.max(size.x, minThin);
    size.z = Math.max(size.z, minThin);
    size.y = Math.max(size.y, 0.10);

    const desc = this.physics.R.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
      .setTranslation(center.x, center.y, center.z)
      .setFriction(opts.friction);

    this.physics.world.createCollider(desc, this.staticBody);
  }

private addInstancedBoxColliders(
  mesh: THREE.InstancedMesh,
  opts: { friction: number; shrink: number; maxInstances?: number }
): void {
    const fullName = this.fullLower(mesh);

  // Skip portals and gate/portal "screen" surfaces (pass-through)
  if (fullName.includes("portal")) return;

  const candyGateish =
    fullName.includes("cane") ||
    fullName.includes("candycane") ||
    fullName.includes("candy-cane") ||
    fullName.includes("gate") ||
    fullName.includes("arch") ||
    fullName.includes("portal");

  const looksTransparent = this.isTransparentMaterial((mesh as any).material);
  const screenishByName =
    fullName.includes("doorplasma") ||
    fullName.includes("door_01") ||
    fullName.includes("door01") ||
    (candyGateish &&
      (fullName.includes("plasma") ||
        fullName.includes("screen") ||
        fullName.includes("glass") ||
        fullName.includes("window") ||
        fullName.includes("forcefield") ||
        fullName.includes("energy") ||
        fullName.includes("shield") ||
        looksTransparent));
  if (screenishByName) return;

  const geom = mesh.geometry as THREE.BufferGeometry;
  if (!geom) return;

  if (!geom.boundingBox) geom.computeBoundingBox();
  const bbox = geom.boundingBox!;
  const sizeLocal = new THREE.Vector3();
  const centerLocal = new THREE.Vector3();
  bbox.getSize(sizeLocal);

  if (candyGateish) {
    const __dimsGate = [sizeLocal.x, sizeLocal.y, sizeLocal.z].sort((a, b) => a - b);
    const __a = __dimsGate[0];
    const __b = __dimsGate[1];
    const __c = __dimsGate[2];
    const __den = Math.max(__a, 1e-6);
    const __thinGatePanel =
      __a <= 0.22 &&
      __b / __den >= 2.4 &&
      __c / __den >= 6.0 &&
      __b >= 0.8 &&
      __c >= 1.6;
    if (__thinGatePanel) return;
  }

  bbox.getCenter(centerLocal);

  const maxCount = Math.min(mesh.count ?? 0, opts.maxInstances ?? 260);
  const instM = new THREE.Matrix4();
  const worldM = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();

  for (let i = 0; i < maxCount; i++) {
    mesh.getMatrixAt(i, instM);

    // world = mesh.matrixWorld * instM
    worldM.copy(mesh.matrixWorld).multiply(instM);
    worldM.decompose(pos, quat, scl);

    const sx = Math.abs(scl.x);
    const sy = Math.abs(scl.y);
    const sz = Math.abs(scl.z);

    const size = new THREE.Vector3(sizeLocal.x * sx, sizeLocal.y * sy, sizeLocal.z * sz);
    const vol = size.x * size.y * size.z;
    if (!isFinite(vol) || vol < 0.02) continue;

    size.multiplyScalar(opts.shrink);

    // Clamp thin pieces so you can't slip through
    const minThin = 0.28;
    size.x = Math.max(size.x, minThin);
    size.z = Math.max(size.z, minThin);
    size.y = Math.max(size.y, 0.10);

    const centerW = centerLocal.clone().applyMatrix4(worldM);

    const desc = this.physics.R.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
      .setTranslation(centerW.x, centerW.y, centerW.z)
      .setFriction(opts.friction);

    this.physics.world.createCollider(desc, this.staticBody);
  }
}
  private findPlatformCandidates(root: THREE.Object3D): PlatformCandidate[] {
    const list: PlatformCandidate[] = [];
    const re = /platform|bridge|ground|floor|path|road|angle|ramp|stairs/i;

    root.updateMatrixWorld(true);

    root.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      const m = o as THREE.Mesh;
      const name = m.name || "";
      if (!re.test(name)) return;

      const bbox = new THREE.Box3().setFromObject(m);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      bbox.getSize(size);
      bbox.getCenter(center);

      // Flat-ish surfaces
      if (size.x * size.z < 6) return;
      if (size.y > 8) return;

      list.push({
        obj: m,
        name,
        bbox,
        size,
        center,
        topY: bbox.max.y,
        area: size.x * size.z
      });
    });

    // Sort by area desc
    list.sort((a, b) => b.area - a.area);
    return list;
  }

  private pickHubPlatform(candidates: PlatformCandidate[]): PlatformCandidate {
    // Prefer big platform near origin
    let best = candidates[0];
    let bestScore = -Infinity;
    for (const c of candidates.slice(0, 40)) {
      const d = c.center.length();
      const score = c.area - d * 0.35; // big + near center
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best!;
  }

  private pickPortalPlatforms(candidates: PlatformCandidate[], hub: PlatformCandidate): Record<string, PlatformCandidate> {
    // Choose 4 platforms around the hub in quadrants: NW, NE, SW, SE
    const picks: Record<string, PlatformCandidate | null> = { NW: null, NE: null, SW: null, SE: null };

    const hubC = hub.center.clone();
    for (const c of candidates.slice(0, 120)) {
      if (c === hub) continue;
      const dx = c.center.x - hubC.x;
      const dz = c.center.z - hubC.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 12 || dist > 120) continue;

      const key =
        dx < 0 && dz < 0 ? "NW" :
        dx >= 0 && dz < 0 ? "NE" :
        dx < 0 && dz >= 0 ? "SW" : "SE";

      const cur = picks[key as keyof typeof picks];
      // pick the biggest area in each quadrant
      if (!cur || c.area > cur.area) picks[key as keyof typeof picks] = c;
    }

    // Fallback: if any quadrant missing, just pick next best
    const used = new Set<PlatformCandidate>([hub]);
    for (const k of Object.keys(picks) as (keyof typeof picks)[]) {
      if (picks[k]) used.add(picks[k]!);
    }
    for (const k of Object.keys(picks) as (keyof typeof picks)[]) {
      if (picks[k]) continue;
      const fallback = candidates.find((c) => !used.has(c) && Math.hypot(c.center.x - hubC.x, c.center.z - hubC.z) > 12);
      if (fallback) {
        picks[k] = fallback;
        used.add(fallback);
      }
    }

    // Map to portfolio IDs
    // Projects=NW, Work=NE, Collabs=SW, Contact=SE
    const out: Record<string, PlatformCandidate> = {
      projects: picks.NW!,
      work: picks.NE!,
      collabs: picks.SW!,
      contact: picks.SE!
    };

    // Teleport spots
    this._portalSpots.set("projects", out.projects.center.clone().setY(out.projects.topY + 1.4));
    this._portalSpots.set("work", out.work.center.clone().setY(out.work.topY + 1.4));
    this._portalSpots.set("collabs", out.collabs.center.clone().setY(out.collabs.topY + 1.4));
    this._portalSpots.set("contact", out.contact.center.clone().setY(out.contact.topY + 1.4));

    return out;
  }

  private addJumpBridgeSlab(world: THREE.Object3D) {
  try {
        // Make sure transforms are current before we do any world-space math
    world.updateMatrixWorld(true);

    // Avoid duplicates (hot reload / hard refresh)
    {
      let exists = false;
      world.traverse((o) => {
        if ((o as any)?.isMesh && (o as any).name === "jump_bridge_slab") exists = true;
      });
      if (exists) return;
    }

const ladders: any[] = (this as any).ladders || [];
    if (!ladders.length) return;

    const slabCandidates: {
      mesh: THREE.Mesh;
      center: THREE.Vector3;
      size: THREE.Vector3;
      keyword: number;
    }[] = [];

    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    world.traverse((obj) => {
      const mesh = obj as any as THREE.Mesh;
      if (!mesh || !(mesh as any).isMesh || !mesh.geometry) return;
      // Skip invisible meshes/materials (cloning them would make the new slab invisible)
      if ((mesh as any).visible === false) return;
      const matAny: any = (mesh as any).material;
      if (Array.isArray(matAny)) {
        if (matAny.some((mm) => mm && (mm.visible === false || (mm.opacity !== undefined && mm.opacity <= 0.01)))) return;
      } else if (matAny && (matAny.visible === false || (matAny.opacity !== undefined && matAny.opacity <= 0.01))) {
        return;
      }


      box.setFromObject(mesh);
      box.getSize(size);
      box.getCenter(center);

      const sx = size.x, sy = size.y, sz = size.z;
      const area = sx * sz;

      // “slab-like” filter (small-ish, thin-ish, floating)
      if (sy < 0.08 || sy > 3.0) return;
      if (sx < 2.0 || sz < 2.0 || sx > 22.0 || sz > 22.0) return;
      if (area < 8.0 || area > 260.0) return;
      if (center.y < 3.0) return;

      const name = (mesh.name || "").toLowerCase();
      const keyword =
        /waffle|cookie|biscuit|cracker/.test(name) ? 5 :
        /slab|platform|step/.test(name) ? 2 : 0;

      slabCandidates.push({
        mesh,
        center: center.clone(),
        size: size.clone(),
        keyword
      });
    });

    if (!slabCandidates.length) {
      console.warn("[SweetLand] No slab candidates found.");
      return;
    }

    // Pick the best (ladder, slab) pair: close in XZ, similar height
    let best: { slab: any; ladder: any; score: number } | null = null;

    for (const slab of slabCandidates) {
      for (const ladder of ladders) {
        if (!ladder?.center || !ladder?.bbox) continue;

        const lc = ladder.center as THREE.Vector3;
        const dx = slab.center.x - lc.x;
        const dz = slab.center.z - lc.z;
        const dist = Math.hypot(dx, dz);

        // Ignore crazy far / too close pairs
        if (dist < 4 || dist > 40) continue;

        const ladderMaxY = (ladder.maxY ?? ladder.bbox.max.y) as number;
        const yAlign = Math.abs(slab.center.y - ladderMaxY);

        const score = dist + yAlign * 2 - slab.keyword * 1.5;

        if (!best || score < best.score) best = { slab, ladder, score };
      }
    }

    if (!best) {
      console.warn("[SweetLand] No ladder+slab pair found for bridge.");
      return;
    }

    const slabMesh = best.slab.mesh as THREE.Mesh;
    const slabCenter = best.slab.center as THREE.Vector3;
    const ladder = best.ladder;
    const ladderCenter = ladder.center as THREE.Vector3;
    const ladderBox = ladder.bbox as THREE.Box3;

    // Choose a stable “from” point on the platform near this ladder.
    // The ladder's center often sits inside a wall, so we find the nearest flat platform mesh and use its edge
    // facing the target slab. This prevents the bridge slab from spawning inside the tower/wall (invisible).
    const targetY = slabCenter.y;

    const platformPoint = (() => {
      const toSlabDir = slabCenter.clone().sub(ladderCenter);
      const axis = Math.abs(toSlabDir.x) >= Math.abs(toSlabDir.z) ? "x" : "z";
      const offset = 2.2; // push out from the platform edge so we don't embed in the wall

      let bestPlat: { box: THREE.Box3; score: number } | null = null;
      const tmpBox = new THREE.Box3();
      const tmpSize = new THREE.Vector3();
      const tmpCenter = new THREE.Vector3();

      world.traverse((obj) => {
        const mesh = obj as any as THREE.Mesh;
        if (!mesh || !(mesh as any).isMesh || !mesh.geometry) return;
        if ((mesh as any).visible === false) return;

        tmpBox.setFromObject(mesh);
        tmpBox.getSize(tmpSize);
        tmpBox.getCenter(tmpCenter);

        const sx = tmpSize.x, sy = tmpSize.y, sz = tmpSize.z;
        const area = sx * sz;

        // Big-ish, flat-ish surface
        if (sy < 0.05 || sy > 6.0) return;
        if (sx < 2.5 || sz < 2.5) return;
        if (area < 16.0) return;

        const dist = Math.hypot(tmpCenter.x - ladderCenter.x, tmpCenter.z - ladderCenter.z);
        if (dist > 12) return;

        const topY = tmpBox.max.y;
        const score = dist + Math.abs(topY - targetY) * 2.0;

        if (!bestPlat || score < bestPlat.score) bestPlat = { box: tmpBox.clone(), score };
      });

      const b = bestPlat?.box ?? ladderBox;
      const p = ladderCenter.clone();
      p.y = targetY;

      if (axis === "x") {
        const sign = Math.sign(toSlabDir.x) || 1;
        p.x = (sign > 0 ? b.max.x : b.min.x) + sign * offset;
        if (bestPlat) p.z = THREE.MathUtils.clamp(p.z, b.min.z + 0.2, b.max.z - 0.2);
      } else {
        const sign = Math.sign(toSlabDir.z) || 1;
        p.z = (sign > 0 ? b.max.z : b.min.z) + sign * offset;
        if (bestPlat) p.x = THREE.MathUtils.clamp(p.x, b.min.x + 0.2, b.max.x - 0.2);
      }

      // Debug: where we think the platform edge is
      console.log("[SweetLand] Bridge from-point", {
        x: p.x.toFixed(3),
        y: p.y.toFixed(3),
        z: p.z.toFixed(3),
      });

      return p;
    })();

    // Place bridge slab between platformPoint and existing slab
    const newPosWorld = platformPoint.clone().lerp(slabCenter, 0.5);
    newPosWorld.y = targetY + 0.25; // lift to avoid z-fighting / embedding
// Idempotency: if we've already spawned our bridge slab (e.g., React StrictMode double-build),
    // don't create a duplicate (which would also duplicate physics colliders).
    const existingBridge = world.getObjectByName("jump_bridge_slab");
    if (existingBridge) {
      console.log("[SweetLand] Bridge slab already present; skipping duplicate.");
      return;
    }

    // Create a clearly-visible brown slab (do NOT clone arbitrary platform meshes, which can be invisible or overlap existing geometry)
    // Size is based on the chosen slab candidate but clamped to stay "slab-like".
    const w = Math.min(10, Math.max(5, (best.slab.size?.x ?? 7) * 0.75));
    const d = Math.min(8, Math.max(3, (best.slab.size?.z ?? 4) * 0.75));
    const h = 0.6;

    const geom = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x6b3f2a,
      roughness: 0.9,
      metalness: 0.0,
    });

    const bridge = new THREE.Mesh(geom, mat);
    bridge.name = "jump_bridge_slab";
    bridge.castShadow = true;
    bridge.receiveShadow = true;

    // Place in the GLTF root's LOCAL space (newPosWorld is in scene world coords)
    const localPos = world.worldToLocal(newPosWorld.clone());
    bridge.position.copy(localPos);
// Orient along the jump direction (platform -> target slab), purely in XZ
    const flatDir = slabCenter.clone().sub(platformPoint);
    flatDir.y = 0;
    if (flatDir.lengthSq() > 1e-6) {
      bridge.rotation.y = Math.atan2(flatDir.x, flatDir.z);
    }

    world.add(bridge);
    bridge.updateMatrixWorld(true);

    // (Debug) confirm where it ended up in world space
    {
      const wp = new THREE.Vector3();
      bridge.getWorldPosition(wp);
      console.log("[SweetLand] SECOND bridge slab actual world pos", {
        x: wp.x.toFixed(3), y: wp.y.toFixed(3), z: wp.z.toFixed(3)
      });
    }

    // Physics: simple box collider so it's always walkable
    this.addBoxCollider(bridge, { friction: 1.0, shrink: 0.98 });

console.log("[SweetLand] Added SECOND bridge slab at", {
      x: newPosWorld.x.toFixed(3),
      y: newPosWorld.y.toFixed(3),
      z: newPosWorld.z.toFixed(3),
    });
  } catch (e) {
    console.error("[SweetLand] Failed to add bridge slab", e);
  }
}

  private async createPortals(
    portalPlatforms: Record<string, PlatformCandidate>,
    onProgress?: (p01: number) => void
  ): Promise<void> {
    // Load portal model once (Gate_01), then clone 4x
    let portalBase: THREE.Object3D | null = null;
    try {
      if (ASSETS.portalModel) {
        const g = await loadGLTF(ASSETS.portalModel);
        portalBase = g.scene;
      }
    } catch {
      portalBase = null;
    }

    const ids = ["projects", "work", "collabs", "contact"] as const;

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const sec = PORTFOLIO_SECTIONS.find((s) => s.id === id)!;
      const platform = portalPlatforms[id];
      const hard = this.hardPortal(id);
      const pos = (hard ? hard.pos.clone() : platform.center.clone());
      pos.y = hard ? hard.pos.y : platform.topY; // sit on top

      // Keep teleport spot aligned with the portal position
      this._portalSpots.set(id, pos.clone().setY(pos.y + 1.4));

      const group = new THREE.Group();
      group.name = `portal_${id}`;
      group.position.copy(pos);
      group.rotation.y = hard ? hard.rotY : 0;

      // Model
      if (portalBase) {
        const clone = portalBase.clone(true);
        clone.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) {
            (o as THREE.Mesh).castShadow = true;
            (o as THREE.Mesh).receiveShadow = true;
          }
        });
        // Scale to a reasonable size (Gate is often big)
        const b = new THREE.Box3().setFromObject(clone);
        const s = new THREE.Vector3();
        b.getSize(s);
        const targetH = 5.2;
        const scale = s.y > 0 ? targetH / s.y : 1;
        clone.scale.setScalar(scale);
        group.add(clone);

        // Solid colliders for the candy-cane arch (pillars + top) — robust and rotation-correct for portals 1–4.
// Note: we use a dedicated fixed rigid-body so the colliders rotate with the portal.
group.updateMatrixWorld(true);

// Compute bounds in portal-local space (not world AABB), so collider sizing is stable even when the portal is rotated.
const gateBoxWorld = new THREE.Box3().setFromObject(clone);
const invPortal = new THREE.Matrix4().copy(group.matrixWorld).invert();
const gateBox = gateBoxWorld.clone().applyMatrix4(invPortal);
const gateSize = new THREE.Vector3();
const gateCenter = new THREE.Vector3();
gateBox.getSize(gateSize);
gateBox.getCenter(gateCenter);

// Fixed body for this portal's solid colliders (rotation-aware).
const rotY = group.rotation.y;
const qy = Math.sin(rotY * 0.5);
const qw = Math.cos(rotY * 0.5);
const portalBody = this.physics.world.createRigidBody(
  this.physics.R.RigidBodyDesc.fixed()
    .setTranslation(group.position.x, group.position.y, group.position.z)
    .setRotation({ x: 0, y: qy, z: 0, w: qw })
);

// Heuristic sizes based on model bounds (portal-local).
const widthAxis: "x" | "z" = gateSize.x >= gateSize.z ? "x" : "z";
const depthAxis: "x" | "z" = widthAxis === "x" ? "z" : "x";
const width = widthAxis === "x" ? gateSize.x : gateSize.z;
const depth = depthAxis === "x" ? gateSize.x : gateSize.z;

// Make colliders slightly "fatter" than the visible candy cane so you don't visually clip into it.
const padW = 0.06;
const padD = 0.06;

const pillarW = Math.min(1.05, Math.max(0.34, width * 0.12));
const pillarD = Math.min(0.95, Math.max(0.34, depth * 0.32));
const pillarH = gateSize.y * 0.96;

const minW = widthAxis === "x" ? gateBox.min.x : gateBox.min.z;
const maxW = widthAxis === "x" ? gateBox.max.x : gateBox.max.z;

const left = minW + pillarW * 0.5;
const right = maxW - pillarW * 0.5;
const yCenter = gateBox.min.y + pillarH * 0.5;

const halfW = pillarW * 0.5;
const halfH = pillarH * 0.5;
const halfD = pillarD * 0.5;

const mkPillarLocal = (t: number) => {
  const x = widthAxis === "x" ? t : gateCenter.x;
  const z = widthAxis === "z" ? t : gateCenter.z;
  const hx = widthAxis === "x" ? halfW : halfD;
  const hz = widthAxis === "x" ? halfD : halfW;
  return this.physics.R.ColliderDesc.cuboid(hx + padW, halfH, hz + padD)
    .setTranslation(x, yCenter, z)
    .setFriction(1.1);
};

this.physics.world.createCollider(mkPillarLocal(left), portalBody);
this.physics.world.createCollider(mkPillarLocal(right), portalBody);

// Top beam to prevent clipping into the curved arch.
const beamH = Math.min(0.45, Math.max(0.26, gateSize.y * 0.10));
const beamY = gateBox.max.y - beamH * 0.5 - 0.02;
const beamHalfW = width * 0.5 + 0.02;
const beamHalfD = pillarD * 0.5 + 0.06;

const beamHx = widthAxis === "x" ? beamHalfW : beamHalfD;
const beamHz = widthAxis === "x" ? beamHalfD : beamHalfW;

this.physics.world.createCollider(
  this.physics.R.ColliderDesc.cuboid(beamHx, beamH * 0.5, beamHz)
    .setTranslation(gateCenter.x, beamY, gateCenter.z)
    .setFriction(1.1),
  portalBody
);

      } else {
        // Fallback: simple arch
        const arch = new THREE.Mesh(
          new THREE.TorusGeometry(1.7, 0.22, 16, 60, Math.PI),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x111111, emissiveIntensity: 0.2 })
        );
        arch.rotation.x = Math.PI * 0.5;
        arch.position.y = 2.6;
        group.add(arch);
      }

      // Floating label (always)
      const label = this.makeFloatingLabel(sec.title);
      label.position.set(0, 5.6, 0);
      group.add(label);

      this.scene.add(group);

      // Sensor collider around portal
      const sensorDesc = this.physics.R.ColliderDesc.cylinder(1.6, 1.9)
        .setTranslation(group.position.x, group.position.y + 2.0, group.position.z);
      const sensor = this.physics.world.createCollider(sensorDesc);
      sensor.setSensor(true);
      sensor.setActiveEvents(this.physics.R.ActiveEvents.COLLISION_EVENTS | this.physics.R.ActiveEvents.INTERSECTION_EVENTS);
      this.physics.tagCollider(sensor, { kind: "portal", id });

      const teleportTo = pos.clone().add(new THREE.Vector3(0, 2.0, 0));
      this.portals.set(id, { group, sensor, teleportTo });

      onProgress?.(0.72 + 0.10 * ((i + 1) / ids.length));
    }
  }

  private makeFloatingLabel(text: string): THREE.Mesh {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(18,24,33,0.78)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
    ctx.fillStyle = "white";
    ctx.font = "900 72px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 1.7),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    mesh.rotation.y = Math.PI; // face camera-ish; camera can orbit so it's okay
    return mesh;
  }

  private seedCoins(hub: PlatformCandidate, portalPlatforms: Record<string, PlatformCandidate>): void {
    const pts: THREE.Vector3[] = [];
    // a small ring around hub spawn
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        hub.center.x + Math.cos(a) * 4.5,
        hub.topY + 1.2,
        hub.center.z + Math.sin(a) * 4.5
      ));
    }

    // around each portal
    const ids = ["projects", "work", "collabs", "contact"] as const;
    for (const id of ids) {
      const p = portalPlatforms[id];
      const hard = this.hardPortal(id);
      const cx = hard ? hard.pos.x : p.center.x;
      const cy = hard ? hard.pos.y : p.topY;
      const cz = hard ? hard.pos.z : p.center.z;

      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        pts.push(new THREE.Vector3(
          cx + Math.cos(a) * 3.2,
          cy + 1.0,
          cz + Math.sin(a) * 3.2
        ));
      }
    }

    this.coinSpawn = pts.map((p, i) => ({ id: `coin_${i}`, pos: p.clone() }));
    this.respawnCoins();
  }

  private createCoin(id: string, pos: THREE.Vector3): void {
    const mesh = coinMesh();
    mesh.position.copy(pos);
    mesh.name = id;
    this.scene.add(mesh);

    const sensorDesc = this.physics.R.ColliderDesc.ball(0.6).setTranslation(pos.x, pos.y, pos.z);
    const sensor = this.physics.world.createCollider(sensorDesc);
    sensor.setSensor(true);
    sensor.setActiveEvents(this.physics.R.ActiveEvents.COLLISION_EVENTS | this.physics.R.ActiveEvents.INTERSECTION_EVENTS);
    this.physics.tagCollider(sensor, { kind: "coin", id });

    this.coins.set(id, { mesh, sensor, baseY: pos.y });
  }

  private async addNPCs(hub: PlatformCandidate, onProgress?: (p01: number) => void): Promise<void> {
    const base = hub.center.clone();
    const y = hub.topY;

    const npcSpots = [
      { id: "npc_1", name: "Candy King", offset: new THREE.Vector3(-3.0, 0, -3.5), model: ASSETS.npcModels[0] },
      { id: "npc_2", name: "Marshie", offset: new THREE.Vector3(3.0, 0, -3.5), model: ASSETS.npcModels[1] },
      { id: "npc_3", name: "EyeBud", offset: new THREE.Vector3(-3.0, 0, 3.5), model: ASSETS.npcModels[2] },
      { id: "npc_4", name: "Gruumy", offset: new THREE.Vector3(3.0, 0, 3.5), model: ASSETS.npcModels[3] }
    ];

    for (let i = 0; i < npcSpots.length; i++) {
      const s = npcSpots[i];
      const pos = base.clone().add(s.offset);
      pos.y = y;

      const g = new THREE.Group();
      g.name = s.id;
      g.position.copy(pos);

      let mixer: THREE.AnimationMixer | undefined;
      let actions: { idle?: THREE.AnimationAction; talk?: THREE.AnimationAction } | undefined;
      let current: THREE.AnimationAction | null = null;

      try {
        if (s.model) {
          const gltf = await loadGLTF(s.model);
          const model = gltf.scene;
          model.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) {
              (o as THREE.Mesh).castShadow = true;
              (o as THREE.Mesh).receiveShadow = true;
            }
          });

          // Scale to a reasonable NPC height
          const b = new THREE.Box3().setFromObject(model);
          const sz = new THREE.Vector3();
          b.getSize(sz);
          const targetH = 2.2;
          const sc = sz.y > 0 ? targetH / sz.y : 1;
          model.scale.setScalar(sc);

          // Center on feet
          const b2 = new THREE.Box3().setFromObject(model);
          const c = new THREE.Vector3();
          b2.getCenter(c);
          model.position.sub(new THREE.Vector3(c.x, b2.min.y, c.z));

          g.add(model);

          if (gltf.animations?.length) {
            mixer = new THREE.AnimationMixer(model);
            // naive naming: pick first clip as idle if it contains "Idle"
            const idleClip = gltf.animations.find((a) => /idle/i.test(a.name)) ?? gltf.animations[0];
            const talkClip =
              gltf.animations.find((a) => /wave|talk|greet|hello/i.test(a.name)) ??
              gltf.animations.find((a) => /dance/i.test(a.name));

            actions = {
              idle: idleClip ? mixer.clipAction(idleClip) : undefined,
              talk: talkClip ? mixer.clipAction(talkClip) : undefined
            };

            if (actions.idle) {
              actions.idle.play();
              current = actions.idle;
            }
          }
        }
      } catch {
        // fallback: simple candy capsule npc
        const body = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.35, 0.75, 8, 16),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65 })
        );
        body.position.y = 0.9;
        body.castShadow = true;

        const head = new THREE.Mesh(
          new THREE.SphereGeometry(0.42, 20, 14),
          new THREE.MeshStandardMaterial({ color: 0xff6cc1, roughness: 0.55, emissive: 0x190810, emissiveIntensity: 0.25 })
        );
        head.position.y = 1.65;
        head.castShadow = true;

        g.add(body, head);
      }

      this.scene.add(g);

      // Solid collider (capsule) so the player cannot phase through NPCs.
      const npcBody = this.physics.world.createRigidBody(
        this.physics.R.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z)
      );
      const npcSolidDesc = this.physics.R.ColliderDesc.capsule(0.65, 0.45)
        .setTranslation(0, 1.05, 0)
        .setFriction(1.0);
      this.physics.world.createCollider(npcSolidDesc, npcBody);

// Sensor collider
      const sensorDesc = this.physics.R.ColliderDesc.ball(1.35).setTranslation(pos.x, pos.y + 1.1, pos.z);
      const sensor = this.physics.world.createCollider(sensorDesc);
      sensor.setSensor(true);
      sensor.setActiveEvents(this.physics.R.ActiveEvents.COLLISION_EVENTS | this.physics.R.ActiveEvents.INTERSECTION_EVENTS);
      this.physics.tagCollider(sensor, { kind: "npc", id: s.id });

      this.npcs.set(s.id, { group: g, sensor, name: s.name, baseY: pos.y, mixer, actions, current });

      onProgress?.(0.86 + 0.10 * ((i + 1) / npcSpots.length));
    }
  }
}
