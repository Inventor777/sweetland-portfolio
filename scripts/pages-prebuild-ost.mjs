import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

const MAX = 25 * 1024 * 1024;
const RATES = [22050, 16000, 12000];

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, "public");
const OST = path.join(PUBLIC, "audio", "ost");
const BACKUP = path.join(ROOT, "audio_source", "ost");

function toPosix(p) { return p.split(path.sep).join("/"); }
function statSize(p) { return fs.statSync(p).size; }

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const a = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(a));
    else if (e.isFile()) out.push(a);
  }
  return out;
}

function runFfmpeg(args) {
  if (!ffmpegPath) throw new Error("ffmpeg-static did not provide a binary path");
  const r = spawnSync(ffmpegPath, args, { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function moveToBackup(absPath) {
  const rel = path.relative(OST, absPath);
  const dest = path.join(BACKUP, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) fs.rmSync(dest, { force: true });
  fs.renameSync(absPath, dest);
  return dest;
}

function downsampleWav(srcWav, destWav) {
  for (const rate of RATES) {
    const tmp = destWav + ".tmp.wav";
    if (fs.existsSync(tmp)) fs.rmSync(tmp, { force: true });

    runFfmpeg(["-y", "-i", srcWav, "-vn", "-ac", "1", "-ar", String(rate), "-c:a", "pcm_s16le", "-f", "wav", tmp]);

    if (statSize(tmp) < MAX) {
      if (fs.existsSync(destWav)) fs.rmSync(destWav, { force: true });
      fs.renameSync(tmp, destWav);
      return rate;
    }
    fs.rmSync(tmp, { force: true });
  }
  throw new Error(`Could not get under 25 MiB: ${toPosix(path.relative(ROOT, destWav))}`);
}

function main() {
  if (!fs.existsSync(OST)) {
    console.log("[pages-prebuild-ost] public/audio/ost not found; skipping");
    return;
  }
  fs.mkdirSync(BACKUP, { recursive: true });

  const oversized = walk(OST).filter((p) => statSize(p) > MAX);
  for (const abs of oversized) {
    const rel = toPosix(path.relative(ROOT, abs));
    const ext = path.extname(abs).toLowerCase();

    if (ext === ".wav") {
      const src = moveToBackup(abs);
      const rate = downsampleWav(src, abs);
      console.log(`[pages-prebuild-ost] downsampled ${rel} (rate=${rate}Hz, mono)`);
    } else {
      moveToBackup(abs);
      console.log(`[pages-prebuild-ost] moved oversized non-wav ${rel} -> audio_source/`);
    }
  }

  const still = walk(PUBLIC).filter((p) => statSize(p) > MAX);
  if (still.length) {
    console.error("[pages-prebuild-ost] Oversized files still in public/:");
    for (const p of still.slice(0, 20)) {
      console.error(` - ${toPosix(path.relative(ROOT, p))} (${(statSize(p)/1024/1024).toFixed(2)} MiB)`);
    }
    process.exit(1);
  }
  console.log("[pages-prebuild-ost] OK: no public assets > 25 MiB");
}

try { main(); } catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
