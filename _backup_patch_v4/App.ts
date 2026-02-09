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

  // Reusable temp vectors (avoid allocations in the fixed loop)
  private _v1 = new THREE.Vector3();
  private _v2 = new THREE.Vector3();

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
    this.canvas.addEventListener("click", () => {
      if (this.uiIsBlocking()) return;
      if (document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock();
      this.ui.setLoading(false);
    });

    // Hotkeys
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;

      // Unstuck / warp to hub
      if (e.code === "KeyU") this.warpToHub();

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
    this.scene.background = new THREE.Color(0xf6d7ff);

    // Soft sky dome
    const skyGeo = new THREE.SphereGeometry(420, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({ color: 0xf7e8ff, side: THREE.BackSide });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);

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

    // Auto-unstuck if falling forever
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

    this.tpc.update(this.player.position, dt);

    this.updateMinimapCamera();
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
      // double-safety: only count if it still exists
      if (!this.level.coins.has(id)) continue;
      this.level.collectCoin(id);
      this.coins += 1;
      this.ui.setCoins(this.coins);
    }

    // Baked-in pickups (Coin_01.*, Gem_*, Box_*, small Cake_*) discovered in Level.ts
    const bakedToCollect: string[] = [];
    for (const [id, p] of this.level.bakedPickups) {
      if (p.collected || !p.mesh.visible) continue;
      p.mesh.getWorldPosition(this._v2);
      const dx = this._v2.x - this._v1.x;
      const dy = this._v2.y - this._v1.y;
      const dz = this._v2.z - this._v1.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      const r = Math.min(2.6, Math.max(this.pickupRadius, p.maxDim ? p.maxDim * 0.75 : this.pickupRadius));
      const r2 = r * r;
      if (d2 <= r2) bakedToCollect.push(id);
    }
    for (const id of bakedToCollect) {
      const p = this.level.bakedPickups.get(id);
      if (!p || p.collected) continue;
      this.level.collectBakedPickup(id);
      this.coins += 1;
      this.ui.setCoins(this.coins);
    }

    // --- Focus / prompts (disabled while UI is open)
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
}