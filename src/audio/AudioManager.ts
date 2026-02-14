import type { PortfolioSectionId } from "../config/portfolio";

// --- Music start offsets (seconds) ---
const START_OFFSETS: Record<string, number> = {
  candyvale: 15,
  wonderland: 15,
};

function applyStartOffset(audio: HTMLAudioElement, key: string) {
  const offset = START_OFFSETS[key.toLowerCase()];
  if (!offset) return;

  const trySeek = () => {
    if (Number.isFinite(audio.duration) && audio.duration > offset) {
      try { audio.currentTime = offset; } catch {}
    }
  };

  // Sometimes this works immediately
  trySeek();

  // More reliable once metadata is ready
  const onMeta = () => {
    trySeek();
    audio.removeEventListener("loadedmetadata", onMeta);
    audio.removeEventListener("canplay", onMeta);
  };
  audio.addEventListener("loadedmetadata", onMeta);
  audio.addEventListener("canplay", onMeta);
}


type ZoneId = "hub" | "village" | "river" | "outskirts" | "portals" | "portal_approach";

const MUSIC_STORAGE_KEY = "sweetland:musicMuted";

// Exact filenames from the OST zip (no renaming required)
const OST_WAV_BY_ZONE: Record<ZoneId, string> = {
  hub: "1. Wonderland - Sweet Land OST.wav",
  village: "3. Enchant - Sweet Land OST.wav",
  river: "9. Sweet Paradise - Sweet Land OST.wav",
  outskirts: "10. Melanchoney - Sweet Land OST.wav",
  portals: "2. Fairyland - Sweet Land OST.wav",
  portal_approach: "11. Spright - Sweet Land OST.wav",
};

const OST_WAV_BY_PORTAL: Partial<Record<PortfolioSectionId, string>> = {
  projects: "8. Whirl - Sweet Land OST.wav",
  work: "5. Jubilee - Sweet Land OST.wav",
  collabs: "7. Bubblebounce - Sweet Land OST.wav",
  contact: "2. Fairyland - Sweet Land OST.wav",
};

const SFX_URLS: Record<string, string> = {
  // Pickups
  coin: "/audio/sfx/PickUpItems/Coin.wav",
  pickup: "/audio/sfx/PickUpItems/Pick_up.wav",

  // Portals
  portal_in: "/audio/sfx/Teleport/Portal_in.wav",
  portal_out: "/audio/sfx/Teleport/Portal_out.wav",

  // Jumps / trampoline
  jump: "/audio/sfx/All_jump.wav",
  jump_spring: "/audio/sfx/Batut/All_jump_spring.wav",

  // NPC / ambient character loops (available; wiring optional)
  grummy_step: "/audio/sfx/Grummy/Grummy_Step.wav",
  grummy_run: "/audio/sfx/Grummy/Grummy_Run.wav",
  grummy_dance: "/audio/sfx/Grummy/Grummy_Dance.wav",
  grummy_dance_loop: "/audio/sfx/Grummy/Grummy_Dance_loop.wav",

  marshie_hi: "/audio/sfx/Marshie/Marshies_Hi.wav",
  marshie_step1: "/audio/sfx/Marshie/Marshies_Step1.wav",
  marshie_step2: "/audio/sfx/Marshie/Marshies_Step2.wav",
  marshie_step3: "/audio/sfx/Marshie/Marshies_Step3.wav",
  marshie_step4: "/audio/sfx/Marshie/Marshies_Step4.wav",
  marshie_dance: "/audio/sfx/Marshie/Marshies_Dance.wav",
  marshie_dance_loop: "/audio/sfx/Marshie/Marshies_dance_loop.wav",

  sweetbloom_idle_loop: "/audio/sfx/SweetBloom/Sweetbloom_idle_loop.wav",

  // Misc (file exists; keep as a key in case you want it later)
  music_sting: "/audio/sfx/music/music.wav",
};
function ostUrl(file: string): string {
  return encodeURI("/audio/ost/" + file);
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export class AudioManager {
  private musicMuted = false;
  private started = false;
  private portalPanelOpen = false;

  private currentZone: ZoneId | null = null;
  private currentTrackFile: string | null = null;

  private lastPos = { x: 0, y: 0, z: 0 };

  private readonly baseMusicVol = 0.182; // [SweetLand] volume scaled 0.8
  private readonly sfxVol = 0.52; // [SweetLand] volume scaled 0.8

  private a: HTMLAudioElement;
  private b: HTMLAudioElement;
  private active: HTMLAudioElement;
  private inactive: HTMLAudioElement;

  private fade:
    | { from: HTMLAudioElement; to: HTMLAudioElement; startMs: number; durMs: number; targetVol: number }
    | null = null;

  constructor() {
    try {
      this.musicMuted = window.localStorage.getItem(MUSIC_STORAGE_KEY) === "1";
    } catch {
      this.musicMuted = false;
    }

    this.a = this.makeMusicEl();
    this.b = this.makeMusicEl();
    this.active = this.a;
    this.inactive = this.b;

    this.updateMusicHint();
  }

  /** Call on the first user gesture (pointerdown) to allow autoplay. */
  onFirstGesture(): void {
    if (this.started) return;
    this.started = true;

    if (!this.musicMuted) {
      // Start with a safe default; zone selection takes over on update().
      this.setTrack(OST_WAV_BY_ZONE.hub, true);
    }

    this.updateMusicHint();
  }

  /** Toggle MUSIC mute (music only; SFX still play). Returns true if muted after toggling. */
  toggleMusicMute(): boolean {
    this.musicMuted = !this.musicMuted;

    try {
      window.localStorage.setItem(MUSIC_STORAGE_KEY, this.musicMuted ? "1" : "0");
    } catch {
      // ignore
    }

    if (this.musicMuted) {
      this.stopMusic();
    } else {
      // Keypress counts as a user gesture
      if (!this.started) this.started = true;

      if (this.currentTrackFile) {
        this.safePlay(this.active);
        this.active.volume = this.baseMusicVol;
      } else {
        this.setTrack(OST_WAV_BY_ZONE.hub, true);
      }
    }

    this.updateMusicHint();
    return this.musicMuted;
  }

  /** Play a SFX by key (safe no-op if missing). */
  playSfx(key: string): void {
    const url = SFX_URLS[key];
    if (!url) return;

    try {
      const el = new Audio(url);
      el.preload = "auto";
            // SWEETLAND_SFX_COLLECTIBLE_BOOST_V1
      var mul = (key === "coin" || key === "pickup") ? 1.2 : 1.0;
      el.volume = clamp01(this.sfxVol * mul);
      el.loop = false;
      if (typeof applyStartOffset === "function") applyStartOffset(el, key as any);
      el.play().catch(() => {});
    } catch {
      // ignore
    }
  }

  /** Portal preview opened (E). */
  onPortalPanelOpen(id?: PortfolioSectionId): void {
    if (!this.started) this.onFirstGesture();

    this.portalPanelOpen = true;
    this.playSfx("portal_in");

    if (this.musicMuted) return;

    const track = (id && OST_WAV_BY_PORTAL[id]) || OST_WAV_BY_ZONE.portals;
    this.setTrack(track);
  }

  /** Portal preview closed (Esc). */
  onPortalPanelClose(): void {
    this.portalPanelOpen = false;
    this.playSfx("portal_out");

    if (this.musicMuted) return;

    // Return to the zone system
    const zone = this.pickZone(this.lastPos, null);
    this.setZone(zone);
  }

  /** Call from App.fixedUpdate. */
  update(dt: number, playerPos: { x: number; y: number; z: number }, level?: any): void {
    this.lastPos = { x: playerPos.x, y: playerPos.y, z: playerPos.z };

    // Advance crossfade
    this.stepFade();

    if (!this.started || this.musicMuted) return;
    if (this.portalPanelOpen) return;

    const zone = this.pickZone(playerPos, level);
    this.setZone(zone);
  }

  // ----------------
  // Internals
  // ----------------

  private makeMusicEl(): HTMLAudioElement {
    const el = new Audio();
    el.preload = "none";
    el.loop = true;
    el.volume = 0;
    return el;
  }

  private stopMusic(): void {
    try {
      this.a.pause();
      this.b.pause();
      this.a.volume = 0;
      this.b.volume = 0;
    } catch {
      // ignore
    }
  }

  private safePlay(el: HTMLAudioElement): void {
    try {
      el.play().catch(() => {});
    } catch {
      // ignore
    }
  }

  private setZone(zone: ZoneId): void {
    if (this.currentZone === zone) return;
    this.currentZone = zone;

    const track = OST_WAV_BY_ZONE[zone] || OST_WAV_BY_ZONE.hub;
    this.setTrack(track);
  }

  private setTrack(file: string, immediate = false): void {
    if (!file) return;
    if (this.currentTrackFile === file && this.active.src) return;

    this.currentTrackFile = file;
    const url = ostUrl(file);

    if (immediate) {
      try {
        this.active.pause();
      } catch {}
      this.active.src = url;
      // SWEETLAND_AUDIO_CANDYVALE_OFFSET_V1
      this.safeSetTime(this.active, this.startOffsetForFile(file));
      this.active.volume = this.musicMuted ? 0 : this.baseMusicVol;
      this.safePlay(this.active);

      try {
        this.inactive.pause();
        this.inactive.volume = 0;
      } catch {}

      this.fade = null;
      return;
    }

    const from = this.active;
    const to = this.inactive;

    try {
      to.pause();
    } catch {}
    to.src = url;
    // SWEETLAND_AUDIO_CANDYVALE_OFFSET_V1
    this.safeSetTime(to, this.startOffsetForFile(file));
    to.volume = 0;
    this.safePlay(to);

    this.fade = {
      from,
      to,
      startMs: performance.now(),
      durMs: 900,
      targetVol: this.musicMuted ? 0 : this.baseMusicVol,
    };

    this.active = to;
    this.inactive = from;
  }

  private stepFade(): void {
    const f = this.fade;
    if (!f) return;

    const u = clamp01((performance.now() - f.startMs) / f.durMs);

    try {
      f.to.volume = f.targetVol * u;
      f.from.volume = f.targetVol * (1 - u);
    } catch {
      // ignore
    }

    if (u >= 1) {
      try {
        f.from.pause();
        f.from.currentTime = 0;
        f.from.volume = 0;
      } catch {
        // ignore
      }
      this.fade = null;
    }
  }

  private pickZone(pos: { x: number; y: number; z: number }, level?: any): ZoneId {
    const portalD2 = this.minPortalD2(pos, level);
    if (portalD2 != null && portalD2 <= 15 * 15) return "portals";
    if (portalD2 != null && portalD2 <= 28 * 28) return "portal_approach";

    if (pos.z > 25) return "village";
    if (pos.z < -25) return "river";
    if (Math.abs(pos.x) > 60 || Math.abs(pos.z) > 90) return "outskirts";
    return "hub";
  }

  private minPortalD2(pos: { x: number; z: number }, level?: any): number | null {
    try {
      const portals = level?.portals;
      if (!portals || typeof portals.values !== "function") return null;

      let best = Infinity;
      for (const p of portals.values()) {
        const t = p?.teleportTo;
        if (!t) continue;
        const dx = t.x - pos.x;
        const dz = t.z - pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < best) best = d2;
      }
      return isFinite(best) ? best : null;
    } catch {
      return null;
    }
  }
  // SWEETLAND_AUDIO_CANDYVALE_OFFSET_V1
  // Start Candyvale ~15s in (so it drops you into the groove, not the intro).
  private startOffsetForFile(file: string): number {
    try {
      const f = (file || "").toLowerCase();
      if (f.indexOf("candyvale") !== -1) return 15;
    } catch {}
    return 0;
  }

  private safeSetTime(el: HTMLAudioElement, t: number): void {
    try {
      if (!t || t <= 0) {
        el.currentTime = 0;
        return;
      }
      el.currentTime = t;
      return;
    } catch {}

    // If metadata is not loaded yet, try again once it is.
    try {
      const handler = () => {
        try { el.currentTime = t; } catch {}
        try { el.removeEventListener("loadedmetadata", handler as any); } catch {}
      };
      el.addEventListener("loadedmetadata", handler as any);
    } catch {}
  }

  private updateMusicHint(): void {
    try {
      const el = document.getElementById("musicHint");
      if (!el) return;
      const label = this.musicMuted ? "unmute" : "mute";
      el.innerHTML = '<span class="kbd">M</span> ' + label;
    } catch {
      // ignore
    }
  }
  // SWEETLAND_AUDIO_MUTE_V1: global mute toggle (BGM + SFX)
  private __slMuted = false;

  public toggleMute(): boolean {
    this.__slMuted = !this.__slMuted;
    try {
      // Prefer gain node if present
      const g = (this as any).masterGain || (this as any).gain || (this as any).mainGain;
      if (g && g.gain && typeof g.gain.value === "number") {
        if (this.__slMuted) {
          (this as any).__slPrevGain = g.gain.value;
          g.gain.value = 0;
        } else {
          const prev = (this as any).__slPrevGain;
          g.gain.value = (typeof prev === "number") ? prev : 1;
        }
      } else if ((this as any).ctx && typeof (this as any).ctx.suspend === "function") {
        if (this.__slMuted) (this as any).ctx.suspend();
        else (this as any).ctx.resume();
      }
    } catch {}
    return this.__slMuted;
  }

  public get muted(): boolean {
    return this.__slMuted;
  }

}
