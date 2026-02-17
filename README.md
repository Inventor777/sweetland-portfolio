# Sweet Land Portfolio (starter)

This is a **copy/pasteable** Three.js + Rapier starter that gets you very close to a Bruno‑Simon‑style “playable portfolio website”:

✅ third-person controller (WASD, Shift, Space)  
✅ real platform collisions + autostep + snap-to-ground (Rapier character controller)  
✅ unstuck/warp-to-hub (`U`) + auto-warp if you fall forever  
✅ 4 portals (hotkeys `1–4`) → opens overlay panel with an iframe preview + “open in new tab”  
✅ coins + counter + reset (`R`)  
✅ NPCs you can talk to (`E`) with dialogue overlay  
✅ minimap (top-right) rendered from a second camera  

It ships with a *primitives-only* candy world so it runs immediately.  
When you’re ready, you can swap the primitives with your Sweet Land GLBs.

---

## 1) Install + run

```bash
npm install
npm run dev
```

Then open the local URL Vite prints.

---

## 2) Update the portfolio links

Edit:

- `src/config/portfolio.ts`

Put your real links for Projects / Work / Collabs / Contact.

> Note: some sites block iframe embedding. If the preview is blank, the “Open in new tab” button still works.

---

## 3) Swap in your Sweet Land models

1. Put your `.glb/.gltf` files in:
   - `public/models/sweetland/...`

2. Update:
   - `src/config/assets.ts`

This starter is already structured so we can attach a GLB avatar to the Player and GLB NPCs to the NPC placeholders next.

---

## 4) Make the world match your reference screenshots more closely

Tweak:

- `src/config/worldLayout.ts` (platform sizes/positions)
- `src/world/Level.ts` (river shape, landmarks, extra props, more stacked blocks, ramps)

If you want, we can do this step together:
- you tell me what the exact Sweet Land map prefab/GLB is called,
- and I’ll wire up **automatic GLB placement** + **colliders**.

---

## Controls

- **WASD** move
- **Shift** run
- **Space** jump
- **E** interact (portal/NPC when near)
- **1–4** teleport/open portal platforms
- **U** unstuck (warp to hub)
- **R** reset coins
- **Esc** close overlays / release pointer lock

---

## Next upgrades (what I recommend we do next)

1) Load your **avatar GLB** and drive real animations (idle/walk/run/jump).  
2) Replace portal primitives with Sweet Land portal props and match the hub layout 1:1.  
3) Add **coins SFX**, sparkle VFX, and “coin streak” feedback.  
4) Add a **map marker** system on the minimap for portals + player arrow.  
5) Add a “press F to open camera mode” for screenshots (shareable marketing).

When you’re ready, tell me:
- which GLB you want as the playable avatar (filename),
- and whether that GLB contains animations (idle/walk/run) — I’ll hook it up.


## Cloudflare Pages asset limit

Cloudflare Pages has a hard 25 MiB limit per deployed static asset.
Host `Sweet_Land.glb` in R2 at `/models/Sweet_Land.glb`.
Set `VITE_ASSET_BASE_URL` in Cloudflare Pages to your R2 public domain (example: `https://assets.imchloekang.com`).
Optional for local dev: set the same value in `.env.local`.
