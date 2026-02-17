/**
 * Sweet Land asset config.
 * These paths are relative to /public.
 *
 * This repo already contains the Sweet Land pack under:
 *   public/models/Sweet_Land_glb/...
 */
const ASSET_BASE = ((import.meta as any).env?.VITE_ASSET_BASE_URL || "https://assets.imchloekang.com").replace(/\/$/, "");

export const ASSETS = {
  // Full assembled world:
  world: `${ASSET_BASE}/models/Sweet_Land.glb`,

  // Playable avatar (picked for “main character energy” + full move set):
  playerAvatar: "/models/Sweet_Land_glb/Separate_assets_glb/Sweetie_01.glb",

  // Portal model (we'll add a floating label over it in code):
  portalModel: "/models/Sweet_Land_glb/Separate_assets_glb/Gate_01.glb",

  // NPCs (animated if clips exist in the GLB):
  npcModels: [
    "/models/Sweet_Land_glb/Separate_assets_glb/Candy_King.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/EyeBud_01.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/EyeBud_02.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/EyeBud_03.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/Gruumy_01.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/Gruumy_02.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/Gruumy_03.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/Gruumy_04.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/Gruumy_05.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/GummiBear_01.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/GummiBear_02.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/GummiBear_03.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/GummiBear_04.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/GummiBear_05.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/GummiBear_06.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/Marshie_01.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/Marshie_02.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/Marshie_03.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/Nutty_Knight.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/Sweetbloom_01.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/Sweetbloom_02.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/Sweetbloom_03.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/Sweetie_01.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/Sweetie_02.glb",
    "/models/Sweet_Land_glb/Separate_assets_glb/Sweetie_03.glb"
  ]};

/**
 * Animation name mapping.
 * Sweet Land characters usually contain these clip names, but we also allow fallbacks.
 */
export const ANIM = {
  idle: ["Idle", "idle", "Armature|Idle", "Idle_01", "Idle01"],
  walk: ["Walk", "walk", "Armature|Walk", "Walk_01"],
  run: ["Run", "run", "Armature|Run", "Run_01"],
  jump: ["Jump", "jump", "Armature|Jump", "Armature|JumpStart", "Jump_01"],
  talk: ["Talk", "talk", "Wave", "wave", "Greet", "greet", "Hello", "hello"]
};
