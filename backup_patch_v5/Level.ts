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

    // Colliders from world meshes (walkables = trimesh, props = boxes, water = soft floor)
    this.ladders = [];
    const { walkables, props, waters } = this.collectMeshGroups(world);

    // Water: treat as walkable but slippery (soft floor)
    for (const w of waters) this.addTrimeshCollider(w, { friction: 0.15 });

    // Walkables: trimesh (accurate platforms/bridges)
    for (const m of walkables) this.addTrimeshCollider(m, { friction: 1.0 });

    // Props: box colliders (fast + less snag)
    // Important: exclude truly giant backdrop meshes so we don't accidentally block navigation.
    for (const m of props) {
      const n = (m.name || "").toLowerCase();
      if (n.includes("backdrop") || n.includes("background") || n.includes("sky")) continue;

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

      // Candy-cane gates / arches: add *frame* colliders so you can walk through the opening but not through the canes.
      if (n.includes("gate") || n.includes("arch") || n.includes("cane") || n.includes("door")) {
        this.addGateFrameColliders(m);
        continue;
      }

      // Some meshes/materials are marked "glass/plasma" in the asset pack even when they're structural.
      // Only skip them when they're small decorative panels.
      const mn = (((m.material as any)?.name ?? "") as string).toLowerCase();
      const looksLikeSmallPanel = (n.includes("glass") || n.includes("plasma") || mn.includes("glass") || mn.includes("plasma")) && maxDim < 8 && vol < 120;
      if (looksLikeSmallPanel) continue;

      // Reduce seam-gaps on large structural pieces (prevents slipping into walls)
      const shrink = (maxDim > 12 || size.y > 6 || size.x * size.z > 40) ? 0.99 : 0.92;
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
      if (p.collected || !p.mesh.visible) continue;
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
    p.mesh.visible = false;
  }

  respawnBakedPickups(): void {
    for (const p of this.bakedPickups.values()) {
      p.collected = false;
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
  private collectMeshGroups(root: THREE.Object3D): { walkables: THREE.Mesh[]; props: THREE.Mesh[]; waters: THREE.Mesh[] } {
    const walkables: THREE.Mesh[] = [];
    const props: THREE.Mesh[] = [];
    const waters: THREE.Mesh[] = [];

    const isWaterName = (n: string) => /water|river|lake|sea|ocean/i.test(n);
    const isWalkableName = (n: string) =>
      /platform|ground|bridge|stair|stairs|ramp|angle|path|road|floor|terrain|land/i.test(n);

    root.updateMatrixWorld(true);

    root.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      const m = o as THREE.Mesh;
      const name = m.name || "";
      const geom = m.geometry as THREE.BufferGeometry;
      if (!geom?.attributes?.position) return;

      // Measure once
      const box = new THREE.Box3().setFromObject(m);
      const size = new THREE.Vector3();
      box.getSize(size);
      const vol = size.x * size.y * size.z;
      if (!isFinite(vol) || vol < 0.002) return;

      // Skip invisible
      if ((m.material as any)?.visible === false) return;

      const area = size.x * size.z;
      const matName = ((m.material as any)?.name ?? "");
      const lower = (name + " " + matName).toLowerCase();
      const maxDim = Math.max(size.x, size.y, size.z);

      // Ladders: keep as prop colliders, but also register climb volumes
      const isLadder = /ladder|climb|rope|rung/i.test(lower);
      if (isLadder && size.y > 0.8 && size.y < 16 && maxDim < 8) {
        const bb = new THREE.Box3().setFromObject(m);
        const cc = new THREE.Vector3();
        bb.getCenter(cc);
        this.ladders.push({ bbox: bb, center: cc, minY: bb.min.y, maxY: bb.max.y });
      }

      // Water first
      if (isWaterName(name) || isWaterName(matName)) {
        waters.push(m);
        return;
      }

      // Walkables BEFORE baked pickups (prevents gingerbread ramps from being treated as collectibles)
      const walkableByName = isWalkableName(name) || isWalkableName(matName);

      // Some ramps/platform pieces aren't named consistently. If it's a broad, low-ish surface,
      // treat as walkable so you can smoothly walk up/down (especially gingerbread ramps).
      const notWalkableLike = /wall|roof|house|tree|fence|lamp|sign|npc|character|foliage|leaf|stem|branch/i.test(lower);
      const looksLikeRamp = !walkableByName && !notWalkableLike && area > 3.5 && size.y > 0.18 && size.y < 4.2;

      if (walkableByName || looksLikeRamp) {
        walkables.push(m);
        return;
      }

      // Baked-in pickups (pivot is often offset, so we store bounds-center in local space)
      const isCoin = /\bcoin\b/i.test(lower) || lower.includes("coin");
      const isGem = /gem|crystal|diamond|jewel/i.test(lower);
      const isBox = /\bbox\b|crate|chest|giftbox/i.test(lower);
      const isMysteryBlock = /question|questionmark|qmark|mystery|surprise|qblock/i.test(lower);
      const isDice = /dice|\bdie\b/i.test(lower);
      const isRing = /ring|hoop|torus/i.test(lower);
      const isGift = /gift|present|prize|reward/i.test(lower);
      const isEnergy = /lightning|bolt|zap|thunder/i.test(lower);

      const isCupcake = /cupcake|muffin|pastry/i.test(lower);
      const isDonut = /donut|doughnut/i.test(lower);
      const isCookie = /cookie|biscuit|star/i.test(lower);
      const isCandy = /candy|lollipop|gumdrop|marshmallow|chocolate|caramel|mint|sweet|sprinkle|ice\s*cream|sundae|cone|scoop/i.test(lower);
      const isFruit = /strawberry|cherry|banana/i.test(lower);
      const isCake = /\bcake\b/i.test(lower);

      const isTreat = isCupcake || isDonut || isCookie || isCandy || isFruit || isCake;
      const isSmallTreat = isTreat && maxDim < 4.8 && vol < 140;
      const isSmallCake = isCake && maxDim < 5.2 && vol < 220;

      if ((isCoin || isGem || isBox || isGift || isMysteryBlock || isDice || isRing || isEnergy || isSmallTreat || isSmallCake) && maxDim > 0.05 && maxDim < 6.5) {
        const centerW = new THREE.Vector3();
        box.getCenter(centerW);
        const centerLocal = m.worldToLocal(centerW.clone());

        const id = `${name || "pickup"}::${m.uuid}`;
        if (!this.bakedPickups.has(id)) {
          const kind = isCoin
            ? "coin"
            : isGem
              ? "gem"
              : isGift || isBox
                ? "box"
                : isMysteryBlock
                  ? "mystery"
                  : isEnergy
                    ? "energy"
                    : isSmallTreat || isSmallCake
                      ? "treat"
                      : isDice
                        ? "dice"
                        : isRing
                          ? "ring"
                          : "pickup";
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


  private addTrimeshCollider(mesh: THREE.Mesh, opts: { friction: number }): void {
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

    const desc = this.physics.R.ColliderDesc.trimesh(verts, indices)
      .setTranslation(0, 0, 0)
      .setFriction(opts.friction);

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

    // Post thickness (keep reasonable bounds)
    const postW = Math.min(Math.max(width * 0.22, 0.25), 1.15);
    const halfH = Math.max(size.y * 0.5 * 0.95, 0.8);
    const halfD = Math.max(depth * 0.5 * 0.55, 0.18);

    const offset = width * 0.5 - postW * 0.5;

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
    const matName = Array.isArray((mesh as any).material)
      ? ((mesh as any).material as any[]).map((mm) => mm?.name ?? "").join(" ")
      : ((mesh as any).material as any)?.name ?? "";
    const fullName = `${mesh.name ?? ""} ${matName}`.toLowerCase();

    // Don't add solid colliders to our runtime portals (they have explicit sensors + pillar colliders).
    if (fullName.includes("portal")) {
      return;
    }

    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Skip extremely small props
    const vol = size.x * size.y * size.z;
    if (vol < 0.02) return;

    // Shrink to reduce snagging
    size.multiplyScalar(opts.shrink);

    const desc = this.physics.R.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
      .setTranslation(center.x, center.y, center.z)
      .setFriction(opts.friction);

    this.physics.world.createCollider(desc, this.staticBody);
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
      const pos = platform.center.clone();
      pos.y = platform.topY; // sit on top

      const group = new THREE.Group();
      group.name = `portal_${id}`;
      group.position.copy(pos);

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

        // Solid colliders for the candy-cane pillars (so you can walk THROUGH the gate opening, but not ghost through the canes)
        group.updateMatrixWorld(true);
        const gateBox = new THREE.Box3().setFromObject(clone);
        const gateSize = new THREE.Vector3();
        const gateCenter = new THREE.Vector3();
        gateBox.getSize(gateSize);
        gateBox.getCenter(gateCenter);

        // Heuristic pillar sizes based on the gate model bounds
        const pillarW = Math.min(1.1, Math.max(0.35, gateSize.x * 0.16));
        const pillarD = Math.min(0.85, Math.max(0.35, gateSize.z * 0.25));
        const pillarH = gateSize.y * 0.95;

        const leftX = gateBox.min.x + pillarW * 0.5;
        const rightX = gateBox.max.x - pillarW * 0.5;
        const yCenter = gateBox.min.y + pillarH * 0.5;

        const halfW = pillarW * 0.5;
        const halfH = pillarH * 0.5;
        const halfD = pillarD * 0.5;

        const leftPillar = this.physics.R.ColliderDesc.cuboid(halfW, halfH, halfD)
          .setTranslation(leftX, yCenter, gateCenter.z)
          .setFriction(0.9);
        this.physics.world.createCollider(leftPillar, this.staticBody);

        const rightPillar = this.physics.R.ColliderDesc.cuboid(halfW, halfH, halfD)
          .setTranslation(rightX, yCenter, gateCenter.z)
          .setFriction(0.9);
        this.physics.world.createCollider(rightPillar, this.staticBody);
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

      const teleportTo = this._portalSpots.get(id) ?? group.position.clone().add(new THREE.Vector3(0, 2.0, 0));
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
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        pts.push(new THREE.Vector3(
          p.center.x + Math.cos(a) * 3.2,
          p.topY + 1.0,
          p.center.z + Math.sin(a) * 3.2
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