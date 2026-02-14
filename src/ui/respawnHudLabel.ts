// Auto-fix HUD label to match Respawn key.
// Some builds generate the HUD text dynamically, so this runs at runtime and rewrites the label.
// Replaces: "U unstuck" -> "R respawn"
export function installRespawnHudLabel() {
  const from = /\bU\s+unstuck\b/gi;
  const to = "R respawn";

  const rewriteInNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent || "";
      if (from.test(t)) {
        node.textContent = t.replace(from, to);
      }
      return;
    }
    if (node instanceof HTMLElement) {
      // common places: pills, buttons, aria-labels, title
      const attrs = ["aria-label","title","data-tooltip","data-title"];
      for (const a of attrs) {
        const v = node.getAttribute(a);
        if (v && from.test(v)) node.setAttribute(a, v.replace(from, to));
      }
    }
  };

  const rewriteTree = (root: Node) => {
    rewriteInNode(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let n: Node | null = walker.nextNode();
    while (n) { rewriteInNode(n); n = walker.nextNode(); }
    if (root instanceof HTMLElement) {
      // also check direct children elements quickly
      const els = root.querySelectorAll("*");
      for (const el of Array.from(els)) rewriteInNode(el);
    }
  };

  const kick = () => {
    try {
      rewriteTree(document.body);
    } catch {}
  };

  // run now + for a few frames (HUD often mounts after first render)
  kick();
  let frames = 0;
  const raf = () => {
    frames++;
    kick();
    if (frames < 120) requestAnimationFrame(raf); // ~2s at 60fps
  };
  requestAnimationFrame(raf);

  // keep watching for UI re-renders
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "characterData" && m.target) rewriteInNode(m.target);
      if (m.type === "childList") {
        m.addedNodes.forEach((n) => rewriteTree(n));
      }
    }
  });
  try {
    obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  } catch {}
}
