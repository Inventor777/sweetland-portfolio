// apply_audio_patch.js
// Applies the Codex AudioManager patch into THIS repo working tree.

const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "src", "audio", "AudioManager.ts");
let s = fs.readFileSync(filePath, "utf8");

function die(msg) {
  console.error("PATCH_ABORT:", msg);
  process.exit(1);
}

if (!s.includes('const MUSIC_STORAGE_KEY = "sweetland:musicMuted";')) {
  die("Could not find MUSIC_STORAGE_KEY line (file layout unexpected).");
}

// 1) Add MUSIC_CROSSFADE_MS if missing
if (!s.includes("const MUSIC_CROSSFADE_MS")) {
  s = s.replace(
    /const MUSIC_STORAGE_KEY = "sweetland:musicMuted";(\r?\n)/,
    `const MUSIC_STORAGE_KEY = "sweetland:musicMuted";$1const MUSIC_CROSSFADE_MS = 250;$1`
  );
}

// 2) Ensure class has trackSwitchId
if (!s.includes("trackSwitchId")) {
  const reFade = /(private fade:\s*[\s\S]*?\|\s*\{\s*from:\s*HTMLAudioElement;[\s\S]*?\}\s*\|\s*null\s*=\s*null;\r?\n)/;
  if (!reFade.test(s)) die("Could not locate fade property block to insert trackSwitchId.");
  s = s.replace(reFade, `$1  private trackSwitchId = 0;\r\n`);
}

// 3) preload none -> auto
s = s.replace(/el\.preload\s*=\s*"none";/g, 'el.preload = "auto";');

// 4) Replace setTrack + add runWhenPlayable
const reSetTrackToStepFade =
  /private setTrack\(file: string, immediate = false\): void \{[\s\S]*?\}\r?\n\r?\n\s*private stepFade\(\): void \{/;

if (!reSetTrackToStepFade.test(s)) {
  die("Could not find setTrack() block to replace (file layout unexpected).");
}

const replacement =
`private setTrack(file: string, immediate = false): void {
    if (!file) return;
    if (this.currentTrackFile === file) return;

    const switchId = ++this.trackSwitchId;
    this.currentTrackFile = file;
    const url = ostUrl(file);

    const from = this.active;
    const to = this.inactive;
    const targetVol = this.musicMuted ? 0 : this.baseMusicVol;

    try {
      to.pause();
      to.currentTime = 0;
      to.volume = 0;
    } catch {}

    to.src = url;
    // SWEETLAND_AUDIO_CANDYVALE_OFFSET_V1
    this.safeSetTime(to, this.startOffsetForFile(file));
    to.volume = immediate ? targetVol : 0;
    try { to.load(); } catch {}

    this.runWhenPlayable(to, switchId, () => {
      this.safePlay(to);

      if (immediate) {
        try {
          from.pause();
          from.currentTime = 0;
          from.volume = 0;
        } catch {}
        to.volume = targetVol;
        this.fade = null;
      } else {
        this.fade = {
          from,
          to,
          startMs: performance.now(),
          durMs: MUSIC_CROSSFADE_MS,
          targetVol,
        };
      }

      this.active = to;
      this.inactive = from;
    });
  }

  private runWhenPlayable(el: HTMLAudioElement, switchId: number, onReady: () => void): void {
    const cleanup = () => {
      try { el.removeEventListener("loadedmetadata", ready); } catch {}
      try { el.removeEventListener("canplay", ready); } catch {}
    };

    const ready = () => {
      cleanup();
      if (switchId !== this.trackSwitchId) return;
      onReady();
    };

    if (el.readyState >= HTMLMediaElement.HAVE_METADATA) {
      ready();
      return;
    }

    el.addEventListener("loadedmetadata", ready);
    el.addEventListener("canplay", ready);
  }

  private stepFade(): void {`;

s = s.replace(reSetTrackToStepFade, replacement);

fs.writeFileSync(filePath, s, "utf8");
console.log("✅ Applied audio patch to", filePath);
