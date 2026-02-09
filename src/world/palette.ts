import * as THREE from "three";

export type PaletteKey =
  | "peach"
  | "pink"
  | "mint"
  | "lavender"
  | "sky"
  | "banana"
  | "tangerine"
  | "waffle"
  | "water"
  | "snow";

export function makePalette(): Record<PaletteKey, THREE.MeshStandardMaterial> {
  // NOTE: we intentionally keep this super “Sweet Land” pastel.
  const mk = (hex: number, rough = 0.85, metal = 0.0) =>
    new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal });

  const water = new THREE.MeshStandardMaterial({
    color: 0x7fd6ff,
    roughness: 0.25,
    metalness: 0.05,
    transparent: true,
    opacity: 0.85
  });

  return {
    peach: mk(0xffc7a2),
    pink: mk(0xff84c6),
    mint: mk(0x9ef5d9),
    lavender: mk(0xb9a6ff),
    sky: mk(0x8fd4ff),
    banana: mk(0xfff2a8),
    tangerine: mk(0xffb46b),
    waffle: mk(0xf2c37a, 0.95),
    water,
    snow: mk(0xffffff, 0.95)
  };
}
