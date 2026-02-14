import * as THREE from "three";
import { Input } from "../core/Input";
import { qs } from "../core/dom";
import { Physics } from "../physics/Physics";
import { Level } from "../world/Level";
import { Player } from "../player/Player";
import { ThirdPersonCamera } from "../player/ThirdPersonCamera";
import { UI } from "../ui/UI";
import { PORTFOLIO_SECTIONS } from "../config/portfolio";
import type { PortfolioSectionId } from "../config/portfolio";

type Focus =
  | { kind: "portal"; id: PortfolioSectionId }
  | { kind: "npc"; id: string }
  | null;

const NPC_DIALOGUE: Record<string, string[]> = {
  marshie: [
    "Hi! I'm Marshie.",
    "I live in Sweet Land and I'm here to guide you around.",
    "More quests and dialogue are coming soon ✨",
  ],
};


export class App {
  private canvas = qs<HTMLCanvasElement>("#c");
  private renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1200);
  private minimapCamera = new THREE.OrthographicCamera(-18, 18, 18, -18, 0.1, 600);

  private input = new Input(this.canvas);
  private physics = new Physics();
  private ui = new UI();

  private player!: Player;
  private tpc!: ThirdPersonCamera;
  private level!: Level;

  private focus: Focus = null;

  // NPC placement mode (Option A2)
  private npcPlaceActive = false;
  private npcPlaceList: { id: string; name: string }[] = [];
  private npcPlaceIndex = 0;
  private npcPlaceRotY = 0;
  private npcPlaceRay = new THREE.Raycaster();
  private npcPlaceMarker = new THREE.Group();
  private npcPlaceRing: THREE.Mesh | null = null;
  private npcPlaceArrow: THREE.ArrowHelper | null = null;

  // Reusable temp vectors (avoid allocations in the fixed loop)
  private _v1 = new THREE.Vector3();
  private _v2 = new THREE.Vector3();
  private _v3 = new THREE.Vector3();
  private _m4 = new THREE.Matrix4();

  private popFx: { mesh: THREE.Mesh; start: number; dur: number }[] = [];
  private audioCtx: AudioContext | null = null;

  // Interaction distances
  private pickupRadius = 1.15;
  private interactRadius = 2.35;

  private lastT = performance.now();
  private acc = 0;
  private fixedDt = 1 / 60;

  private coins = 0;

  async init(): Promise<void> {
    this.setupRenderer();
    this.setupScene();

    this.ui.setLoading(true);
    this.ui.setLoadingProgress(0);

    await this.physics.init();
    this.ui.setLoadingProgress(8);

    // Build world (loads Sweet_Land.glb + colliders + portals/NPCs)
    this.level = new Level(this.physics);
    await this.level.build((p01) => this.ui.setLoadingProgress(8 + p01 * 70));
    this.scene.add(this.level.scene);

    // Player
    this.player = new Player(this.physics, this.input);
    await this.player.spawn(this.level.spawn);
    this.scene.add(this.player.mesh);
    this.ui.setLoadingProgress(92);

    this.tpc = new ThirdPersonCamera(this.camera);

    // Collisions → gameplay
    // Gameplay interactions are handled via proximity checks (more reliable than sensor events in some Rapier builds).

    // Buttons / UI actions
    qs<HTMLButtonElement>("#resetCoinsBtn").addEventListener("click", () => this.resetCoins());

    // Pointer lock
    this.canvas.addEventListener("click", (e) => {
      if (this.npcPlaceActive) {
        e.preventDefault?.();
        this.placeSelectedNpcAtCrosshair();
        return;
      }
      if (this.uiIsBlocking()) return;
      if (document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock();
      this.ui.setLoading(false);
    });

    // Hotkeys
    window.addEventListener("keydown", (e) => {

    // --- NPC WALK-PLACE MODE (F7 to toggle) ---
    // Goal: select an NPC, walk your current character to the exact spot, press Enter to record feet X/Z + yaw.
    // Saves JSON into localStorage key: "sweetlandNpcPlacements" and prints to console.
    try {
      const self: any = (window as any);
      if (!self.__npcWalkPlace) {
        let saved: any = {};
        try {
          saved = JSON.parse(localStorage.getItem("sweetlandNpcPlacements") || "{}") || {};
        } catch (_) {}
        self.__npcWalkPlace = {
          active: false,
          idx: 0,
          saved,
        };
      }

      const st = self.__npcWalkPlace as { active: boolean; idx: number; saved: any };
      const hudId = "sweetland-npc-walk-place-hud";

      const ensureHud = () => {
        let hud = document.getElementById(hudId) as HTMLDivElement | null;
        if (!hud) {
          hud = document.createElement("div");
          hud.id = hudId;
          hud.style.position = "fixed";
          hud.style.left = "12px";
          hud.style.top = "12px";
          hud.style.zIndex = "99999";
          hud.style.padding = "10px 12px";
          hud.style.whiteSpace = "pre";
          hud.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
          hud.style.fontSize = "12px";
          hud.style.lineHeight = "1.35";
          hud.style.borderRadius = "10px";
          hud.style.maxWidth = "520px";
          hud.style.maxHeight = "70vh";
          hud.style.overflow = "auto";
          hud.style.background = "rgba(0,0,0,0.72)";
          hud.style.color = "white";
          hud.style.boxShadow = "0 8px 30px rgba(0,0,0,0.35)";
          hud.style.pointerEvents = "none";
          document.body.appendChild(hud);
        }
        return hud;
      };

      const getNpcList = (): Array<{ id: string; name: string }> => {
        // Prefer any existing placement list if you already have one.
        const fromExisting = self.npcPlaceList || self.npcList || self.npcsList;
        if (Array.isArray(fromExisting) && fromExisting.length) {
          const first = fromExisting[0];
          if (first && typeof first === "object" && ("id" in first)) {
            return fromExisting.map((x: any) => ({
              id: String(x.id),
              name: String(x.name ?? x.label ?? x.id),
            }));
          }
        }

        // Fall back: derive from level.npcs Map.
        const lvl = self.level;
        const out: Array<{ id: string; name: string }> = [];
        const npcs = lvl?.npcs;
        if (npcs && typeof npcs.forEach === "function") {
          npcs.forEach((npc: any, id: any) => {
            out.push({
              id: String(id),
              name: String(npc?.name ?? npc?.displayName ?? npc?.label ?? id),
            });
          });
        }
        out.sort((a, b) => a.name.localeCompare(b.name));
        return out;
      };

      const getPlayerObj = (): any => {
        // Try common names; if none exist, we'll use the camera.
        return (
          self.player?.group ||
          self.player ||
          self.hero?.group ||
          self.hero ||
          self.character?.group ||
          self.character ||
          self.avatar?.group ||
          self.avatar ||
          self.rig ||
          null
        );
      };

      const getFeetWorldPos = () => {
        const playerObj = getPlayerObj();
        const cam = self.camera || self.cam || self.camera3D;

        // Start from player (preferred), otherwise camera position.
        const p = new (THREE as any).Vector3();
        if (playerObj?.getWorldPosition) playerObj.getWorldPosition(p);
        else if (playerObj?.position) p.copy(playerObj.position);
        else if (cam?.position) p.copy(cam.position);

        // Raycast straight down to snap to whatever you're standing on.
        const origin = p.clone();
        origin.y += 2.0;
        const ray = new (THREE as any).Raycaster(origin, new (THREE as any).Vector3(0, -1, 0), 0, 50);

        const lvl = self.level;
        const candidates =
          lvl?.walkableMeshes ||
          lvl?.groundMeshes ||
          lvl?.colliderMeshes ||
          lvl?.colliders ||
          lvl?.platformMeshes ||
          null;

        let hits: any[] = [];
        if (Array.isArray(candidates) && candidates.length) {
          hits = ray.intersectObjects(candidates, true);
        } else if (self.scene?.children) {
          hits = ray.intersectObjects(self.scene.children, true);
        }

        // Pick the first visible hit.
        const hit = hits.find((h) => h && h.object && h.object.visible !== false);
        if (hit?.point) return hit.point.clone();

        return p;
      };

      const getYaw = () => {
        const playerObj = getPlayerObj();
        if (playerObj?.rotation && typeof playerObj.rotation.y === "number") {
          return playerObj.rotation.y;
        }
        const cam = self.camera || self.cam || self.camera3D;
        if (cam?.getWorldDirection) {
          const dir = new (THREE as any).Vector3();
          cam.getWorldDirection(dir);
          return Math.atan2(dir.x, dir.z);
        }
        return 0;
      };

      const renderHud = () => {
        const hud = ensureHud();
        const list = getNpcList();
        const sel = list.length ? list[((st.idx % list.length) + list.length) % list.length] : null;
        const savedJson = JSON.stringify(st.saved || {}, null, 2);

        hud.style.display = st.active ? "block" : "none";
        if (!st.active) return;

        const hudLines = [
          "NPC Walk-Place Mode (F7 toggle)",
          "-----------------------------",
          (sel ? ("Selected: " + sel.name + " (" + sel.id + ")") : "Selected: (none)"),
          "",
          "[ / ] cycle NPC",
          "ENTER: record placement",
          "C: copy placements JSON",
          "BACKSPACE: clear placements",
        ];
        hud.textContent = hudLines.join("\n");
      };

      const save = () => {
        try {
          localStorage.setItem("sweetlandNpcPlacements", JSON.stringify(st.saved || {}, null, 2));
        } catch (_) {}
      };

      const record = () => {
        const list = getNpcList();
        if (!list.length) {
          console.warn("[SweetLand] No NPCs found for walk-place list.");
          return;
        }

        st.idx = ((st.idx % list.length) + list.length) % list.length;
        const sel = list[st.idx];
        const lvl = self.level;

        const feetWorld = getFeetWorldPos();
        const rotY = getYaw();

        // Convert to the NPC parent local-space when possible (important if the level is grouped/scaled).
        let posLocal = feetWorld.clone();
        let npc: any = null;
        try {
          npc = lvl?.npcs?.get?.(sel.id) ?? lvl?.npcs?.get?.(String(sel.id));
        } catch (_) {}

        if (npc?.group?.parent?.worldToLocal) {
          npc.group.parent.updateMatrixWorld(true);
          posLocal = npc.group.parent.worldToLocal(feetWorld.clone());
        }

        // Apply immediately (and also store for export).
        if (typeof lvl?.setNpcPlacement === "function") {
          // Signature in this project tends to be: (id, posLocal, rotY, snapToGround?)
          lvl.setNpcPlacement(sel.id, posLocal, rotY, true);
        } else if (npc?.group) {
          npc.group.position.copy(posLocal);
          npc.group.rotation.y = rotY;
        }

        st.saved = st.saved || {};
        st.saved[sel.id] = {
          x: Number(posLocal.x.toFixed(3)),
          y: Number(posLocal.y.toFixed(3)),
          z: Number(posLocal.z.toFixed(3)),
          rotY: Number(rotY.toFixed(4)),
        };
        save();

        console.log("[SweetLand] WALK-PLACE:", sel.name, sel.id, st.saved[sel.id]);
        renderHud();
      };

      // Toggle
      if (e.code === "F7" || e.code === "Slash" || e.key === "/" || e.code === "NumpadDivide") {
        st.active = !st.active;
        renderHud();
        e.preventDefault?.();
        // Stop further handling for this key.
        return;
      }

      // When active, intercept only our keys so we don't break movement controls.
      if (st.active) {
        if (e.code === "BracketLeft") {
          const list = getNpcList();
          st.idx = list.length ? (st.idx - 1 + list.length) % list.length : 0;
          renderHud();
          e.preventDefault?.();
          return;
        }
        if (e.code === "BracketRight") {
          const list = getNpcList();
          st.idx = list.length ? (st.idx + 1) % list.length : 0;
          renderHud();
          e.preventDefault?.();
          return;
        }
        if (e.code === "Enter") {
          record();
          e.preventDefault?.();
          return;
        }
        if (e.code === "Backspace") {
          st.saved = {};
          save();
          console.log("[SweetLand] WALK-PLACE: cleared saved placements.");
          renderHud();
          e.preventDefault?.();
          return;
        }
        if (e.code === "KeyC") {
          const text = JSON.stringify(st.saved || {}, null, 2);
          if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(
              () => console.log("[SweetLand] WALK-PLACE: copied JSON to clipboard."),
              () => console.warn("[SweetLand] WALK-PLACE: clipboard copy failed.")
            );
          } else {
            console.log("[SweetLand] WALK-PLACE JSON:", text);
          }
          e.preventDefault?.();
          return;
        }
      }
    } catch (err) {
      console.warn("[SweetLand] NPC walk-place injection error:", err);
    }
    // --- end NPC WALK-PLACE MODE ---


    // __slPlayableNpcHotkeysV4
    // Fix spam if an older patch left npcPlaceActive reads in this handler:
    try { if (typeof (npcPlaceActive as any) === "undefined") { let npcPlaceActive: any = false; void npcPlaceActive; } } catch (_) {}

    try {
      const __k = (e.key || "").toLowerCase();
      const __c = (e.code || "");
      if (__k === "c" || __c === "KeyC") { e.preventDefault(); e.stopPropagation(); __slPilotToggleV4(); return; }
      if (__k === "g" || __c === "KeyG") { e.preventDefault(); e.stopPropagation(); __slSavePlacementV4(); return; }
      if (__k === "m" || __c === "KeyM") { /* M reserved for music (disabled character swap hotkey) */ }
    } catch (_) {}

          if (e.repeat) return;

      // NPC placement controls (Option A2)
      if (e.code === "KeyP") {
        e.preventDefault();
        this.toggleNpcPlacement();
        return;
      }
      if (this.npcPlaceActive) {
        if (e.code === "KeyN") {
          e.preventDefault();
          this.cycleNpcPlacement();
          return;
        }
        if (e.code === "Enter") {
          e.preventDefault();
          this.dumpNpcPlacements();
          return;
        }
        // While placing, ignore other one-off interaction keys.
      }

      // Respawn / warp to hub
      if (e.code === "KeyR") this.warpToHub();

      // Reset coins
      if (e.code === "KeyR") this.resetCoins();

      // Interact
      if (e.code === "KeyE") this.interact();

      // Teleport to portal platforms 1-4 (per your spec)
      for (const sec of PORTFOLIO_SECTIONS) {
        if (e.code === sec.hotkey) this.teleportToSection(sec.id);
      }
    });

    this.resize();
    window.addEventListener("resize", () => this.resize());

    this.ui.setLoadingProgress(100);
    // ✅ Wait for the first click (user gesture) then hide loading + lock mouse
    window.addEventListener(
      "pointerdown",
      () => {
        this.ensureAudio();
        this.ui.setLoading(false);              // hide the blur overlay
        this.canvas.requestPointerLock?.();     // enable mouse-look
      },
      { once: true }
    );


    // Start loop
    requestAnimationFrame((t) => this.frame(t));
  }

  private setupRenderer(): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
  }

  private setupScene(): void {
    this.scene.background = new THREE.Color(0x7bc8ff);

    // Sky dome
    const skyGeo = new THREE.SphereGeometry(420, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({ color: 0x7bc8ff, side: THREE.BackSide });

    // NPC placement mode: mouse wheel rotates the selected NPC.
    window.addEventListener(
      "wheel",
      (e) => {
        if (!this.npcPlaceActive) return;
        e.preventDefault();
        const dir = e.deltaY > 0 ? 1 : -1;
        this.rotateSelectedNpc(dir);
      },
      { passive: false }
    );

    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);

    // Puffy clouds (billboard sprites)
    const cloudTex = (() => {
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 256;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, c.width, c.height);

      const blob = (x: number, y: number, r: number, a: number) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,255,255,${a})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      };

      // Cluster of soft circles
      blob(170, 145, 95, 0.75);
      blob(250, 118, 110, 0.78);
      blob(330, 150, 85, 0.72);
      blob(230, 165, 120, 0.55);
      blob(285, 165, 100, 0.50);

      return new THREE.CanvasTexture(c);
    })();
    cloudTex.colorSpace = THREE.SRGBColorSpace;

    const cloudGroup = new THREE.Group();
    cloudGroup.name = "clouds";
    this.scene.add(cloudGroup);

    for (let i = 0; i < 14; i++) {
      const mat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false });
      mat.opacity = 0.9;
      mat.rotation = (Math.random() - 0.5) * 0.6;

      const s = new THREE.Sprite(mat);
      const a = (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const r = 260 + Math.random() * 110;
      s.position.set(Math.cos(a) * r, 95 + Math.random() * 55, Math.sin(a) * r);
      const sc = 55 + Math.random() * 65;
      s.scale.set(sc, sc * 0.55, 1);
      cloudGroup.add(s);
    }

    // Lights
    const amb = new THREE.AmbientLight(0xffffff, 0.72);
    this.scene.add(amb);

    const sun = new THREE.DirectionalLight(0xffffff, 1.05);
    sun.position.set(18, 45, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 220;
    sun.shadow.camera.left = -120;
    sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120;
    sun.shadow.camera.bottom = -120;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0xfff5fb, 0.25);
    fill.position.set(-18, 18, -18);
    this.scene.add(fill);
  
    this.setupNpcPlacementHelpers();
}

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private frame(tNow: number): void {
    const dt = Math.min(0.05, (tNow - this.lastT) / 1000);
    this.lastT = tNow;

    // Mouse look
    const { dx, dy } = this.input.consumeMouseDelta();
    if (dx || dy) this.tpc.updateFromMouse(dx, dy);

    // Auto-respawn if falling forever
    if (this.player.position.y < -55) this.warpToHub();

    // Fixed-step physics for stability
    this.acc += dt;
    while (this.acc >= this.fixedDt) {
      this.fixedUpdate(this.fixedDt, tNow / 1000);
      this.acc -= this.fixedDt;
    }

    this.render();

    requestAnimationFrame((t) => this.frame(t));
  }

  private fixedUpdate(dt: number, t: number): void {
    // Ladder proximity (Minecraft-style climbing)
    const ladder = this.level.getLadderAt(this.player.position);
    this.player.setLadder(ladder);

    this.player.update(dt, this.tpc.yaw);

    this.physics.step();

    this.player.syncFromPhysics();

    this.level.update(t);

    this.updateInteractions();

    this.updatePopFx(t);

    this.tpc.update(this.player.position, dt);

    this.updateMinimapCamera();

    this.updateNpcPlacementMarker();
  }


  private interact(): void {
    if (this.npcPlaceActive) return;
    if (!this.focus) return;

    if (this.focus.kind === "npc") {
      const npc = this.level.npcs.get(this.focus.id);
      const npcName = npc?.name ?? "Friend";
      const lines = NPC_DIALOGUE[this.focus.id] ?? ["Hi! (Dialogue coming soon.)"];
      this.ui.openDialogue(npcName, lines);
      return;
    }

    // NOTE: We can add portal/other interactions here later.
  }

  private updateInteractions(): void {
    // --- Collectibles (always active)
    const pt = this.player.body.translation();
    this._v1.set(pt.x, pt.y, pt.z);

    const basePickupR2 = this.pickupRadius * this.pickupRadius;

    // Procedural coins we spawned
    const coinsToCollect: string[] = [];
    for (const [id, c] of this.level.coins) {
      // coin mesh position is in world coords (Level.scene)
      const dx = c.mesh.position.x - this._v1.x;
      const dy = c.mesh.position.y - this._v1.y;
      const dz = c.mesh.position.z - this._v1.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 <= basePickupR2) coinsToCollect.push(id);
    }
    for (const id of coinsToCollect) {
      const c = this.level.coins.get(id);
      if (!c) continue;
      const popPos = c.mesh.position.clone();
      this.level.collectCoin(id);
      this.coins += 1;
      this.ui.setCoins(this.coins);
      this.triggerPopFx(popPos);
      this.playPopSound();
    }

    // Baked-in pickups (discovered in Level.ts)
const bakedToCollect: { id: string; pos: THREE.Vector3 }[] = [];
for (const [id, p] of this.level.bakedPickups) {
  if (p.collected) continue;

  const isInstanced =
    (p as any).instanced &&
    (p.mesh as any)?.isInstancedMesh &&
    typeof (p as any).instanceId === "number";

  if (!isInstanced && !p.mesh.visible) continue;

  const cl = (p as any).centerLocal as THREE.Vector3 | undefined;

  if (isInstanced) {
    const inst = p.mesh as unknown as THREE.InstancedMesh;
    inst.updateWorldMatrix(true, false);

    // instanceWorld = inst.matrixWorld * instanceMatrix
    inst.getMatrixAt((p as any).instanceId, this._m4);
    this._m4.multiplyMatrices(inst.matrixWorld, this._m4);

    if (cl) this._v2.copy(cl).applyMatrix4(this._m4);
    else this._v2.set(0, 0, 0).applyMatrix4(this._m4);
  } else {
    (p.mesh as any).updateWorldMatrix(true, false);
    if (cl) this._v2.copy(cl).applyMatrix4((p.mesh as any).matrixWorld);
    else p.mesh.getWorldPosition(this._v2);
  }

  const dx = this._v2.x - this._v1.x;
  const dy = this._v2.y - this._v1.y;
  const dz = this._v2.z - this._v1.z;
  const d2 = dx * dx + dy * dy + dz * dz;

  const r = Math.min(2.8, Math.max(this.pickupRadius, p.maxDim ? p.maxDim * 0.75 : this.pickupRadius));
  const r2 = r * r;

  if (d2 <= r2) bakedToCollect.push({ id, pos: this._v2.clone() });
}

for (const it of bakedToCollect) {
  const p = this.level.bakedPickups.get(it.id);
  if (!p || p.collected) continue;

  this.level.collectBakedPickup(it.id);
  this.coins += 1;
  this.ui.setCoins(this.coins);

  this.triggerPopFx(it.pos);
  this.playPopSound();
}

    // --- Focus / prompts (disabled while UI is open)
    if (this.npcPlaceActive) {
      // Placement mode owns the prompt; do not update focus.
      this.focus = null;
      this.updateNpcPlacementPrompt();
      return;
    }

    if (this.uiIsBlocking()) {
      if (this.focus !== null) {
        this.focus = null;
        this.ui.showPrompt(null);
      }
      return;
    }

    const interactR2 = this.interactRadius * this.interactRadius;
    let best: Focus = null;
    let bestD2 = Infinity;

    // Portals
    for (const [id, p] of this.level.portals) {
      p.group.getWorldPosition(this._v2);
      const dx = this._v2.x - this._v1.x;
      const dy = this._v2.y - this._v1.y;
      const dz = this._v2.z - this._v1.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 <= interactR2 && d2 < bestD2) {
        bestD2 = d2;
        best = { kind: "portal", id: id as PortfolioSectionId };
      }
    }

    // NPCs
    for (const [id, n] of this.level.npcs) {
      n.group.getWorldPosition(this._v2);
      const dx = this._v2.x - this._v1.x;
      const dy = this._v2.y - this._v1.y;
      const dz = this._v2.z - this._v1.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 <= interactR2 && d2 < bestD2) {
        bestD2 = d2;
        best = { kind: "npc", id };
      }
    }

    // Update focus + prompt if changed
    const same =
      (this.focus === null && best === null) ||
      (this.focus !== null && best !== null && this.focus.kind === best.kind && (this.focus as any).id === (best as any).id);

    if (!same) {
      this.focus = best;
      if (best === null) {
        this.ui.showPrompt(null);
      } else if (best.kind === "portal") {
        this.ui.showPrompt(`Enter ${String(best.id).toUpperCase()} portal`);
      } else if (best.kind === "npc") {
        const npc = this.level.npcs.get(best.id);
        this.ui.showPrompt(npc ? `Talk to ${npc.name}` : "Talk");
      }
    }
  }



  // -----------------------------
  // NPC Placement Mode (Option A2)
  // -----------------------------

  private setupNpcPlacementHelpers(): void {
    this.npcPlaceMarker.name = "npc_place_marker";

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1.05, 32),
      new THREE.MeshBasicMaterial({ color: 0xffff66, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI * 0.5;
    ring.renderOrder = 999;
    ring.visible = false;

    const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.05, 0), 1.25, 0xff66ff);
    arrow.visible = false;

    this.npcPlaceMarker.add(ring);
    this.npcPlaceMarker.add(arrow);
    this.scene.add(this.npcPlaceMarker);

    this.npcPlaceRing = ring;
    this.npcPlaceArrow = arrow;
  }

  private toggleNpcPlacement(): void {
    this.npcPlaceActive = !this.npcPlaceActive;

    if (this.npcPlaceActive) {
      this.npcPlaceList =
        (this.level as any)?.getNpcList?.() ??
        Array.from(this.level.npcs, ([id, n]) => ({ id, name: n.name })).sort((a, b) => a.name.localeCompare(b.name));

      this.npcPlaceIndex = 0;
      if (!this.npcPlaceList.length) {
        console.warn("[SweetLand] No NPCs found to place.");
        this.npcPlaceActive = false;
        return;
      }

      const sel = this.npcPlaceList[this.npcPlaceIndex];
      const npc = this.level.npcs.get(sel.id);
      this.npcPlaceRotY = npc ? npc.group.rotation.y : 0;

      console.log("[SweetLand] NPC placement mode ON.");
      console.log("  Controls: P toggle | N next NPC | Mouse wheel rotate | Click to place | G save here | C pilot | M main | Enter prints placements");

      this.updateNpcPlacementPrompt();
      this.updateNpcPlacementMarker();
    } else {
      console.log("[SweetLand] NPC placement mode OFF.");
      // The normal focus system will restore the prompt as you walk around.
      this.ui.showPrompt(null);
      if (this.npcPlaceRing) this.npcPlaceRing.visible = false;
      if (this.npcPlaceArrow) this.npcPlaceArrow.visible = false;
    }
  }

  private cycleNpcPlacement(): void {
    if (!this.npcPlaceActive) return;
    if (!this.npcPlaceList.length) return;

    this.npcPlaceIndex = (this.npcPlaceIndex + 1) % this.npcPlaceList.length;
    const sel = this.npcPlaceList[this.npcPlaceIndex];
    const npc = this.level.npcs.get(sel.id);
    this.npcPlaceRotY = npc ? npc.group.rotation.y : 0;

    this.updateNpcPlacementPrompt();
    this.updateNpcPlacementMarker();
  }

  private dumpNpcPlacements(): void {
    (this.level as any)?.dumpNpcPlacements?.();
  }

  private updateNpcPlacementPrompt(): void {
    if (!this.npcPlaceActive) return;
    const sel = this.npcPlaceList[this.npcPlaceIndex];
    if (!sel) return;

    this.ui.showPrompt(
      `PLACE NPC (${this.npcPlaceIndex + 1}/${this.npcPlaceList.length}): ${sel.name}  |  Click: place  |  Wheel: rotate  |  G: place here | C: pilot | M: main | N: next  |  Enter: print  |  P: exit`
    );
  }

  private updateNpcPlacementMarker(): void {
    if (!this.npcPlaceRing || !this.npcPlaceArrow) return;

    if (!this.npcPlaceActive || !this.npcPlaceList.length) {
      this.npcPlaceRing.visible = false;
      this.npcPlaceArrow.visible = false;
      return;
    }

    const sel = this.npcPlaceList[this.npcPlaceIndex];
    const npc = sel ? this.level.npcs.get(sel.id) : null;
    if (!npc) {
      this.npcPlaceRing.visible = false;
      this.npcPlaceArrow.visible = false;
      return;
    }

    const wp = new THREE.Vector3();
npc.group.getWorldPosition(wp);
this.npcPlaceMarker.position.set(wp.x, wp.y + 0.03, wp.z);
    this.npcPlaceRing.visible = true;

    const d = new THREE.Vector3(Math.sin(this.npcPlaceRotY), 0, Math.cos(this.npcPlaceRotY));
    if (d.lengthSq() < 1e-6) d.set(0, 0, 1);
    this.npcPlaceArrow.setDirection(d.normalize());
    this.npcPlaceArrow.visible = true;
  }

  private rotateSelectedNpc(dir: number): void {
    if (!this.npcPlaceActive) return;
    const sel = this.npcPlaceList[this.npcPlaceIndex];
    const npc = sel ? this.level.npcs.get(sel.id) : null;
    if (!sel || !npc) return;

    const step = Math.PI / 12; // 15 degrees
    this.npcPlaceRotY += step * dir;

    const twoPi = Math.PI * 2;
    while (this.npcPlaceRotY > twoPi) this.npcPlaceRotY -= twoPi;
    while (this.npcPlaceRotY < -twoPi) this.npcPlaceRotY += twoPi;

    // Persist rotation only (keep same position)
    (this.level as any)?.setNpcPlacement?.(sel.id, npc.group.position.clone(), this.npcPlaceRotY, true);

    this.updateNpcPlacementPrompt();
    this.updateNpcPlacementMarker();
  }

  private isObjectInNpc(obj: THREE.Object3D): boolean {
    let o: THREE.Object3D | null = obj;
    while (o) {
      if (this.level.npcs.has(o.name)) return true;
      o = o.parent;
    }
    return false;
  }

  private placeSelectedNpcAtCrosshair(): void {
    if (!this.npcPlaceActive) return;
    if (this.uiIsBlocking()) return;

    const sel = this.npcPlaceList[this.npcPlaceIndex];
    if (!sel) return;

    // Ray from the camera through the center of the screen (crosshair)
    this.camera.getWorldPosition(this._v2);
    this.camera.getWorldDirection(this._v3);
    this._v3.normalize();

    this.npcPlaceRay.set(this._v2, this._v3);
    this.npcPlaceRay.far = 250;

    const hits = this.npcPlaceRay.intersectObjects(this.level.scene.children, true);
    let point: THREE.Vector3 | null = null;
    for (const h of hits) {
      const obj = h.object as THREE.Object3D;
      if (!obj.visible) continue;
      if (obj.name?.startsWith("coin_")) continue;
      if (this.isObjectInNpc(obj)) continue;
      point = h.point.clone();
      break;
    }

    if (!point) {
      console.warn("[SweetLand] No surface hit; aim at a platform/ground and click again.");
      return;
    }

    const pos = point.clone();
    pos.y += 0.02; // tiny lift to avoid z-fighting with the surface

    // Convert world hit point -> NPC parent-local space (prevents offset placement)
const npc = this.level.npcs.get(sel.id);
let posLocal = pos.clone();
if (npc?.group.parent) {
  npc.group.parent.updateMatrixWorld(true);
  posLocal = npc.group.parent.worldToLocal(pos.clone());
}

const ok = (this.level as any)?.setNpcPlacement?.(sel.id, posLocal, this.npcPlaceRotY, true);

if (ok !== false) {
  if (npc) {
    npc.group.position.copy(posLocal);
    npc.group.rotation.y = this.npcPlaceRotY;
  }
}

console.log(`[SweetLand] Placed NPC ${sel.name} (${sel.id}) at { x: ${posLocal.x.toFixed(3)}, y: ${posLocal.y.toFixed(3)}, z: ${posLocal.z.toFixed(3)}, rotY: ${this.npcPlaceRotY.toFixed(4)} }`);

    this.updateNpcPlacementPrompt();
    this.updateNpcPlacementMarker();
  }
  private render(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.renderer.setViewport(0, 0, w, h);
    this.renderer.setScissorTest(false);
    this.renderer.render(this.scene, this.camera);

    // Minimap (top-right)
    const size = Math.min(w, h) * 0.26;
    const pad = 14;

    this.renderer.setScissorTest(true);
    this.renderer.setViewport(w - size - pad, h - size - pad, size, size);
    this.renderer.setScissor(w - size - pad, h - size - pad, size, size);
    this.renderer.render(this.scene, this.minimapCamera);
    this.renderer.setScissorTest(false);
  }

  private updateMinimapCamera(): void {
    const p = this.player.position;
    this.minimapCamera.position.set(p.x, p.y + 55, p.z);
    this.minimapCamera.up.set(0, 0, -1);
    this.minimapCamera.lookAt(p.x, p.y, p.z);
    this.minimapCamera.updateProjectionMatrix();
  }

  private uiIsBlocking(): boolean {
    const panelOpen = !qs<HTMLElement>("#panel").classList.contains("hidden");
    const dialogueOpen = !qs<HTMLElement>("#dialogue").classList.contains("hidden");
    return panelOpen || dialogueOpen;
  }

  private teleportToSection(id: PortfolioSectionId): void {
    const spot = this.level.portals.get(id)?.teleportTo;
    if (!spot) return;
    // teleport a little above to avoid embedding
    this.player.setPosition(spot.clone().add(new THREE.Vector3(0, 0.6, 0)));
  }

  private warpToHub(): void {
    this.player.setPosition(this.level.spawn);
  }

  private resetCoins(): void {
    this.coins = 0;
    this.ui.setCoins(this.coins);
    this.level.respawnCoins();
  }

private ensureAudio(): void {
  if (this.audioCtx) return;
  const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  try {
    this.audioCtx = new AC();
    // some browsers start suspended until first gesture — pointerdown calls this
    if (this.audioCtx.state === "suspended") this.audioCtx.resume().catch(() => {});
  } catch {
    this.audioCtx = null;
  }
}

private playPopSound(): void {
  const ctx = this.audioCtx;
  if (!ctx) return;

  try {
    const t0 = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(520, t0);
    osc.frequency.exponentialRampToValueAtTime(240, t0 + 0.08);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t0 + 0.13);
  } catch {
    // ignore audio failures
  }
}

private triggerPopFx(pos: THREE.Vector3): void {
  // Simple "pop" — a tiny sphere that scales up and fades out
  const geom = new THREE.SphereGeometry(0.12, 10, 8);
  const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95 });
  const m = new THREE.Mesh(geom, mat);
  m.position.copy(pos);
  m.position.y += 0.35;
  this.scene.add(m);

  this.popFx.push({ mesh: m, start: performance.now() * 0.001, dur: 0.35 });
}

private updatePopFx(t: number): void {
  if (this.popFx.length === 0) return;
  const keep: typeof this.popFx = [];

  for (const fx of this.popFx) {
    const age = t - fx.start;
    const u = age / fx.dur;

    if (u >= 1) {
      this.scene.remove(fx.mesh);
      (fx.mesh.geometry as any)?.dispose?.();
      (fx.mesh.material as any)?.dispose?.();
      continue;
    }

    const s = 1 + u * 1.8;
    fx.mesh.scale.set(s, s, s);
    fx.mesh.position.y += 0.005;
    const mat = fx.mesh.material as any;
    if (mat) mat.opacity = 0.95 * (1 - u);

    keep.push(fx);
  }

  this.popFx = keep;
}
}
