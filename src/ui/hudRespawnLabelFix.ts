// Keeps existing HUD layout and only swaps the "U unstuck" hint to "R respawn".
// This targets the DOM element: #helpText (found via DevTools scan).
export function installHudRespawnLabelFix() {
  const apply = () => {
    const help = document.getElementById("helpText");
    if (!help) return false;

    // 1) Change the key chip from U -> R if present
    const kbds = help.querySelectorAll<HTMLElement>(".kbd");
    let changed = false;

    // Heuristic: if there is a text node containing "unstuck" anywhere in helpText,
    // then the kbd right before it is the one we want to change.
    // We'll do a simple scan of childNodes in order.
    const nodes = Array.from(help.childNodes);
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const txt = (n.nodeType === Node.TEXT_NODE) ? (n.nodeValue || "") : "";
      if (txt && txt.toLowerCase().includes("unstuck")) {
        // look backward for nearest element with class kbd
        for (let j = i; j >= 0; j--) {
          const prev = nodes[j];
          if (prev.nodeType === Node.ELEMENT_NODE) {
            const el = prev as HTMLElement;
            if (el.classList.contains("kbd")) {
              if (el.textContent && el.textContent.trim().toUpperCase() === "U") {
                el.textContent = "R";
                changed = true;
              }
              break;
            }
          }
        }
      }
    }

    // 2) Replace only text nodes containing 'unstuck' with 'respawn' (keeps DOM structure)
    const walker = document.createTreeWalker(help, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode as Text;
      const v = t.nodeValue || "";
      if (!v) continue;
      if (v.toLowerCase().includes("unstuck")) {
        const next = v.replace(/unstuck/gi, "respawn");
        if (next !== v) {
          t.nodeValue = next;
          changed = true;
        }
      }
      // Also handle any leftover compact "U unstuck" in a single text node
      if (v.includes("U") && v.toLowerCase().includes("respawn")) {
        // no-op
      }
    }

    return changed;
  };

  // Try immediately, then keep it correct if HUD re-renders
  apply();
  let tries = 0;
  const iv = window.setInterval(() => {
    tries++;
    const ok = apply();
    if (ok || tries > 300) window.clearInterval(iv);
  }, 50);

  const target = document.getElementById("hud") || document.body;
  const mo = new MutationObserver(() => apply());
  mo.observe(target, { childList: true, subtree: true, characterData: true });
}
