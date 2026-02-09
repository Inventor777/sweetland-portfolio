import * as THREE from "three";

export function findClipByNames(clips: THREE.AnimationClip[], names: string[]): THREE.AnimationClip | null {
  for (const n of names) {
    const c = clips.find((x) => x.name === n);
    if (c) return c;
  }
  // try case-insensitive contains
  for (const n of names) {
    const needle = n.toLowerCase();
    const c = clips.find((x) => x.name.toLowerCase().includes(needle));
    if (c) return c;
  }
  return null;
}

export function fadeTo(action: THREE.AnimationAction | null, next: THREE.AnimationAction | null, dur = 0.15): void {
  if (!next) return;
  if (action === next) return;
  next.reset().fadeIn(dur).play();
  if (action) action.fadeOut(dur);
}
