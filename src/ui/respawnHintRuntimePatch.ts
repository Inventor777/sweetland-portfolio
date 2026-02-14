// src/ui/respawnHintRuntimePatch.ts
// Runtime-only text fixer for the HUD hint.
// Goal: UI says "R respawn" instead of "U unstuck", without needing to find where the string is authored.
//
// Safe + idempotent: only rewrites text that matches the unstuck hint pattern.

let started = false;

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function patchTextNodeText(s: string): string {
  const raw = s;
  const n = normalizeSpaces(raw);

  // Match patterns like:
  // "U unstuck", "U: unstuck", "(U) unstuck", "Press U to unstuck", etc.
  // Replace with "R respawn" (or "Press R to respawn").
  let out = raw;

  // Common "U unstuck" compact forms
  out = out.replace(/\bU\b\s*[:\-]?\s*unstuck\b/gi, "R respawn");

  // "Press U to ..." forms
  out = out.replace(/press\s+u\s+to\s+unstuck/gi, "press R to respawn");
  out = out.replace(/press\s+u\s+to\s+get\s+unstuck/gi, "press R to respawn");

  // Any remaining standalone "unstuck" in the same UI gets renamed to "respawn"
  // (kept conservative: only within the same text node we already touched by above rules)
  if (out !== raw) {
    out = out.replace(/\bunstuck\b/gi, "respawn");
  }

  return out;
}

function tryPatchElementText(el: HTMLElement): boolean {
  // Only patch leaf nodes that actually show text.
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let changed = false;
  const touched: Text[] = [];

  while (walker.nextNode()) {
    const t = walker.currentNode as Text;
    const v = t.nodeValue ?? "";
    if (!v) continue;

    // quick gate: only consider nodes containing 'unstuck' or 'Press U' or ' U '
    const lv = v.toLowerCase();
    if (lv.indexOf("unstuck") === -1 && lv.indexOf("press u") === -1 && !/\bU\b/.test(v)) continue;

    const next = patchTextNodeText(v);
    if (next !== v) {
      t.nodeValue = next;
      changed = true;
      touched.push(t);
    }
  }

  return changed;
}

function patchWholeDocumentOnce(): boolean {
  // Try to patch common HUD containers first, then fall back to body.
  const candidates: HTMLElement[] = [];

  const byId = ["hud", "ui", "overlay", "root", "app"];
  for (const id of byId) {
    const el = document.getElementById(id);
    if (el) candidates.push(el as HTMLElement);
  }

  // A lot of HUDs use fixed overlays; include any element that looks like "hint" or "help"
  document.querySelectorAll<HTMLElement>('[class*="hint"],[class*="help"],[class*="hud"],[data-hint],[data-help]').forEach((el) => {
    candidates.push(el);
  });

  // Dedup
  const seen = new Set<HTMLElement>();
  const uniq: HTMLElement[] = [];
  for (const c of candidates) {
    if (!seen.has(c)) {
      seen.add(c);
      uniq.push(c);
    }
  }

  let changed = false;
  for (const c of uniq) changed = tryPatchElementText(c) || changed;

  // fallback
  if (!changed) changed = tryPatchElementText(document.body as any);

  return changed;
}

export function installRespawnHintRuntimePatch() {
  if (started) return;
  started = true;

  // Patch ASAP + after a few frames (HUD might mount after init)
  const attempt = () => patchWholeDocumentOnce();

  attempt();
  requestAnimationFrame(() => attempt());
  setTimeout(() => attempt(), 250);
  setTimeout(() => attempt(), 1000);

  // Keep it correct if HUD rerenders (React/etc.)
  const obs = new MutationObserver(() => {
    attempt();
  });
  obs.observe(document.body, { subtree: true, childList: true, characterData: true });
}
