import { LoadingManager } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Minimal GLB/GLTF loader helper.
 * (No DRACO here — add DRACOLoader only if you need it.)
 */
export function loadGLTF(
  url: string,
  opts?: {
    manager?: LoadingManager;
    onProgress?: (loaded: number, total: number) => void;
  }
): Promise<GLTF> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader(opts?.manager);
    loader.load(
      url,
      (gltf) => resolve(gltf),
      (ev) => opts?.onProgress?.(ev.loaded, ev.total || 0),
      (err) => reject(err)
    );
  });
}
