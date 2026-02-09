import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Physics } from "../physics/Physics";

/** Create a simple candy tower landmark (mesh only). */
export function candyTower(materialBase: THREE.Material, materialTop: THREE.Material): THREE.Group {
  const g = new THREE.Group();

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 4.2, 16), materialBase);
  base.castShadow = true;
  base.receiveShadow = true;
  base.position.y = 2.1;

  const top = new THREE.Mesh(new THREE.ConeGeometry(1.25, 2.2, 18), materialTop);
  top.castShadow = true;
  top.receiveShadow = true;
  top.position.y = 5.1;

  g.add(base, top);
  return g;
}

export function lollipop(materialStick: THREE.Material, materialCandy: THREE.Material): THREE.Group {
  const g = new THREE.Group();

  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.8, 10), materialStick);
  stick.position.y = 1.4;
  stick.castShadow = true;

  const candy = new THREE.Mesh(new THREE.SphereGeometry(0.7, 18, 12), materialCandy);
  candy.position.y = 2.8;
  candy.castShadow = true;

  g.add(stick, candy);
  return g;
}

export function donut(material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.55, 16, 30), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function coinMesh(): THREE.Mesh {
  const geo = new THREE.TorusGeometry(0.35, 0.12, 10, 20);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffd86e, roughness: 0.35, metalness: 0.25, emissive: 0x332200, emissiveIntensity: 0.25 });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = false;
  return m;
}

export function portalMesh(label: string): THREE.Group {
  const g = new THREE.Group();

  const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65 });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x6ee7ff, roughness: 0.25, emissive: 0x3fd7ff, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 });

  // Candy-cane-ish arch
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.18, 16, 60, Math.PI), frameMat);
  arch.rotation.x = Math.PI * 0.5;
  arch.position.y = 1.6;
  arch.castShadow = true;

  const left = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.6, 12), frameMat);
  left.position.set(-1.6, 0.8, 0);
  left.castShadow = true;

  const right = left.clone();
  right.position.x = 1.6;

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2, 1, 1), glowMat);
  plane.position.y = 1.35;
  plane.rotation.y = Math.PI;
  plane.receiveShadow = false;

  // Sign
  const sign = document.createElement("canvas");
  sign.width = 512;
  sign.height = 256;
  const ctx = sign.getContext("2d")!;
  ctx.fillStyle = "rgba(18,24,33,0.80)";
  ctx.fillRect(0, 0, sign.width, sign.height);
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, sign.width - 24, sign.height - 24);
  ctx.fillStyle = "white";
  ctx.font = "bold 68px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 256, 128);

  const tex = new THREE.CanvasTexture(sign);
  tex.colorSpace = THREE.SRGBColorSpace;
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  signMesh.position.set(0, 3.05, 0);
  signMesh.rotation.y = Math.PI;

  g.add(arch, left, right, plane, signMesh);
  return g;
}

export function addStaticBoxCollider(
  physics: Physics,
  body: RAPIER.RigidBody,
  halfExtents: { x: number; y: number; z: number },
  pos: { x: number; y: number; z: number },
  rot?: THREE.Quaternion
): RAPIER.Collider {
  const R = physics.R;
  const desc = R.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
    .setTranslation(pos.x, pos.y, pos.z)
    .setFriction(1.0);

  if (rot) desc.setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w });
  return physics.world.createCollider(desc, body);
}
