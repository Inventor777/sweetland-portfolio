import type { PortfolioSectionId } from "./portfolio";

/**
 * The layout is intentionally "blocky" to resemble the Sweet Land reference images:
 * - Central hub built from stacked cubes
 * - River splitting through the middle
 * - Four nearby platforms where portals live (hotkeys 1–4 teleport there)
 *
 * Units: Three.js world units (tweak to taste).
 */

export type Vec3 = { x: number; y: number; z: number };

export type Platform = {
  name: string;
  center: Vec3;
  size: { x: number; y: number; z: number }; // x/z = width/depth, y = thickness
  colorKey?: string;
};

export type PortalSpot = {
  id: PortfolioSectionId;
  platformName: string;
  teleportTo: Vec3;    // where the player lands when using hotkeys
  lookAt?: Vec3;       // optional camera focus
};

export const SPAWN: Vec3 = { x: 0, y: 2.2, z: 0 };

export const PLATFORMS: Platform[] = [
  // Central hub blocks (stacked)
  { name: "hub_base", center: { x: 0, y: 0.5, z: 0 }, size: { x: 26, y: 1, z: 22 }, colorKey: "peach" },
  { name: "hub_mid", center: { x: 0, y: 1.25, z: -1 }, size: { x: 18, y: 0.5, z: 14 }, colorKey: "pink" },
  { name: "hub_top", center: { x: 0, y: 2.0, z: -2 }, size: { x: 10, y: 0.5, z: 8 }, colorKey: "mint" },

  // Four portal platforms around the hub (match reference “platform clusters”)
  { name: "plat_projects", center: { x: -18, y: 0.75, z: -6 }, size: { x: 12, y: 0.5, z: 10 }, colorKey: "lavender" },
  { name: "plat_work",     center: { x:  18, y: 0.75, z: -6 }, size: { x: 12, y: 0.5, z: 10 }, colorKey: "sky" },
  { name: "plat_collabs",  center: { x: -18, y: 0.75, z:  10 }, size: { x: 12, y: 0.5, z: 10 }, colorKey: "banana" },
  { name: "plat_contact",  center: { x:  18, y: 0.75, z:  10 }, size: { x: 12, y: 0.5, z: 10 }, colorKey: "tangerine" },

  // Bridges (flat, wide)
  { name: "bridge_nw", center: { x: -9.5, y: 0.65, z: -5 }, size: { x: 7, y: 0.3, z: 3 }, colorKey: "waffle" },
  { name: "bridge_ne", center: { x:  9.5, y: 0.65, z: -5 }, size: { x: 7, y: 0.3, z: 3 }, colorKey: "waffle" },
  { name: "bridge_sw", center: { x: -9.5, y: 0.65, z:  8 }, size: { x: 7, y: 0.3, z: 3 }, colorKey: "waffle" },
  { name: "bridge_se", center: { x:  9.5, y: 0.65, z:  8 }, size: { x: 7, y: 0.3, z: 3 }, colorKey: "waffle" }
];

export const PORTALS: PortalSpot[] = [
  {
    id: "projects",
    platformName: "plat_projects",
    teleportTo: { x: -18, y: 1.6, z: -6 }
  },
  {
    id: "work",
    platformName: "plat_work",
    teleportTo: { x: 18, y: 1.6, z: -6 }
  },
  {
    id: "collabs",
    platformName: "plat_collabs",
    teleportTo: { x: -18, y: 1.6, z: 10 }
  },
  {
    id: "contact",
    platformName: "plat_contact",
    teleportTo: { x: 18, y: 1.6, z: 10 }
  }
];
