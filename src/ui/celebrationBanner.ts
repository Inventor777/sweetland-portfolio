// UI-only runtime banner that triggers when collectibles reach milestones.
// Reads the on-screen HUD text (e.g. "Collectibles 73") so it doesn't matter where the count is stored.

type Milestone = { count: number; message: string; key: string };

const MILESTONES: Milestone[] = [
  {
    count: 70,
    key: "milestone_70",
    message:
      "Congratulations! You've collected almost all the collectibles in Chloe's Candy Castle!",
  },
  {
    count: 82,
    key: "milestone_82",
    message:
      "Congratulations! You've collected EVERY SINGLE COLLECTIBLE! Chloe thinks you're awesome!",
  },
];

const STORAGE_KEY = "sweetland_collectible_banner_shown_v2"; // [SweetLand] banner queue v1
const shown: Record<string, boolean> = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
})();

function markShown(key: string) {
  shown[key] = true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shown));
  } catch {}
}

function isShown(key: string) {
  return !!shown[key];
}

let bannerEl: HTMLDivElement | null = null;
let bannerTimer: number | null = null;

function ensureBannerEl(): HTMLDivElement {
  if (bannerEl && document.body.contains(bannerEl)) return bannerEl;

  const el = document.createElement("div");
  el.id = "sweetland-celebration-banner";
  el.style.position = "fixed";
  el.style.left = "50%";
  el.style.top = "10%";
  el.style.transform = "translateX(-50%)";
  el.style.padding = "14px 18px";
  el.style.borderRadius = "14px";
  el.style.zIndex = "999999";
  el.style.maxWidth = "min(720px, 92vw)";
  el.style.textAlign = "center";
  el.style.fontFamily =
    "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
  el.style.fontSize = "16px";
  el.style.lineHeight = "1.25";
  el.style.fontWeight = "700";
  el.style.color = "#2b1a14";
  el.style.background = "rgba(255, 255, 255, 0.92)";
  el.style.boxShadow = "0 12px 40px rgba(0,0,0,0.18)";
  el.style.border = "1px solid rgba(43,26,20,0.12)";
  el.style.backdropFilter = "blur(6px)";
  el.style.opacity = "0";
  el.style.transition = "opacity 180ms ease, transform 180ms ease";

  document.body.appendChild(el);
  bannerEl = el;
  return el;
}

function showBanner(message: string, ms = 4200) {
  const el = ensureBannerEl();
  el.textContent = message;

  // reset animation
  el.style.transform = "translateX(-50%) translateY(-6px)";
  el.style.opacity = "0";

  // next frame: fade in
  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateX(-50%) translateY(0px)";
  });

  if (bannerTimer) window.clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(-6px)";
  }, ms);
}

let cachedHudEl: HTMLElement | null = null;

function tryParseCollectiblesText(text: string): number | null {
  // Matches: "Collectibles 73" or "Collectibles: 73" or "Collectibles\n73"
  const m = text.match(/collectibles\s*[:]?\s*(\d{1,3})/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function findHudElement(): HTMLElement | null {
  // If we already found a good element, keep it.
  if (cachedHudEl && document.body.contains(cachedHudEl)) {
    const t = (cachedHudEl.textContent || "").trim();
    if (tryParseCollectiblesText(t) != null) return cachedHudEl;
  }

  // Scan common HUD node types. This is fast enough and avoids expensive TreeWalker.
  const nodes = document.querySelectorAll<HTMLElement>("button,div,span,p");
  const max = Math.min(nodes.length, 1800);
  for (let i = 0; i < max; i++) {
    const el = nodes[i];
    const t = (el.textContent || "").trim();
    const parsed = tryParseCollectiblesText(t);
    if (parsed != null) {
      cachedHudEl = el;
      return el;
    }
  }
  return null;
}

function inferCountFromHud(): number | null {
  const el = findHudElement();
  if (!el) return null;
  const t = (el.textContent || "").trim();
  return tryParseCollectiblesText(t);
}

let lastCount: number | null = null;

// Queue banners so multiple milestones crossed in one poll still show sequentially.
const __BANNER_QUEUE_MS = 4200;
const __BANNER_GAP_MS = 260;
let __bannerQueue: Milestone[] = [];
let __bannerShowing = false;

function __enqueueMilestone(m: Milestone) {
  if (isShown(m.key)) return;
  if (__bannerQueue.some((x) => x.key === m.key)) return;
  // Mark immediately so reloads don't re-spam; comment this out if you prefer "mark on display".
  markShown(m.key);
  __bannerQueue.push(m);
  __tryDrainBannerQueue();
}

function __tryDrainBannerQueue() {
  if (__bannerShowing) return;
  const next = __bannerQueue.shift();
  if (!next) return;
  __bannerShowing = true;
  showBanner(next.message, __BANNER_QUEUE_MS);
  window.setTimeout(() => {
    __bannerShowing = false;
    __tryDrainBannerQueue();
  }, __BANNER_QUEUE_MS + __BANNER_GAP_MS);
}


function tick() {
  const count = inferCountFromHud();

  if (typeof count === "number") {
    const prev = lastCount ?? 0;

    // Enqueue milestones crossed upward in this tick.
    for (const m of MILESTONES) {
      if (isShown(m.key)) continue;
      if (prev < m.count && count >= m.count) {
        __enqueueMilestone(m);
      }
    }

    lastCount = count;
  }

  window.setTimeout(tick, 350);
}

// [SweetLand] banner queue v1
export function installCollectibleBanner() {
  // Helpful devtools hook:
  //   __SweetLandBannerTest(70) or __SweetLandBannerTest(83)
  (window as any).__SweetLandBannerTest = (n: number) => {
    const m = MILESTONES.find((x) => x.count === n);
    showBanner(m ? m.message : `Banner test (${n})`);
  };

  // Start once DOM exists.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => tick(), { once: true });
  } else {
    tick();
  }

  console.log(
    "[SweetLand] Collectible banner installed (HUD-based). Milestones:",
    MILESTONES.map((m) => m.count).join(", ")
  );
}
