
const fs = require("fs");

const file = "src/world/Level.ts";
if (!fs.existsSync(file)) {
  console.error("Missing file:", file);
  process.exit(1);
}

let t = fs.readFileSync(file, "utf8");

function replaceOnce(label, re, repl) {
  const before = t;
  t = t.replace(re, repl);
  if (t === before) {
    console.error("PATCH FAILED:", label);
    process.exit(1);
  }
  console.log("OK:", label);
}

// 1) Add bakedPickupSensors map (only if not already present)
if (!t.includes("bakedPickupSensors")) {
  replaceOnce(
    "insert bakedPickupSensors map",
    /(bakedPickups\s*=\s*new Map<string,\s*\{[\s\S]*?\}\>\(\);\s*\n)/,
    `$1\n  private bakedPickupSensors = new Map<string, any>();\n`
  );
}

// 2) Route "baked:" ids through collectCoin without changing App/Physics
replaceOnce(
  "update collectCoin to route baked pickups",
  /  collectCoin\(id: string\): void \{\n[\s\S]*?\n  \}\n/,
  `  collectCoin(id: string): void {
    // Baked pickups are tagged as coins with id prefix "baked:"
    if (id.startsWith("baked:")) {
      this.collectBakedPickup(id.slice("baked:".length));
      return;
    }

    const c = this.coins.get(id);
    if (!c) return;
    this.scene.remove(c.mesh);
    this.physics.untagCollider(c.sensor);
    this.physics.world.removeCollider(c.sensor, true);
    this.coins.delete(id);
  }\n`
);

// 3) When collecting a baked pickup, also remove its sensor so it can't re-trigger
replaceOnce(
  "update collectBakedPickup to remove sensor",
  /  collectBakedPickup\(id: string\): void \{\n[\s\S]*?\n  \}\n/,
  `  collectBakedPickup(id: string): void {
    const p = this.bakedPickups.get(id);
    if (!p || p.collected) return;
    p.collected = true;
    p.mesh.visible = false;

    const s = this.bakedPickupSensors.get(id);
    if (s) {
      this.physics.untagCollider(s);
      this.physics.world.removeCollider(s, true);
      this.bakedPickupSensors.delete(id);
    }
  }\n`
);

// 4) On respawn, rebuild baked pickup sensors (so everything can be collected again)
replaceOnce(
  "update respawnBakedPickups to recreate sensors",
  /  respawnBakedPickups\(\): void \{\n[\s\S]*?\n  \}\n/,
  `  respawnBakedPickups(): void {
    for (const [id, p] of this.bakedPickups.entries()) {
      p.collected = false;
      p.mesh.visible = true;
      p.mesh.position.copy(p.basePos);
      p.mesh.rotation.y = p.baseRotY;

      // Recreate sensor if it was removed on collect
      if (!this.bakedPickupSensors.has(id)) {
        p.mesh.updateMatrixWorld(true);
        const bb = new THREE.Box3().setFromObject(p.mesh);
        const c = new THREE.Vector3();
        const s = new THREE.Vector3();
        bb.getCenter(c);
        bb.getSize(s);

        const md = Math.max(s.x, s.y, s.z);
        const r = Math.max(0.55, Math.min(1.2, md * 0.35 + 0.1));

        const sensorDesc = this.physics.R.ColliderDesc.ball(r).setTranslation(c.x, c.y, c.z);
        const sensor = this.physics.world.createCollider(sensorDesc);
        sensor.setSensor(true);
        sensor.setActiveEvents(
          this.physics.R.ActiveEvents.COLLISION_EVENTS | this.physics.R.ActiveEvents.INTERSECTION_EVENTS
        );
        this.physics.tagCollider(sensor, { kind: "coin", id: "baked:" + id });
        this.bakedPickupSensors.set(id, sensor);
      }
    }
  }\n`
);

// 5) Prevent ramps/platforms from being mistaken as pickups (causes spinning + disappearing)
replaceOnce(
  "insert skipPickupBecauseWalkable precheck",
  /const maxDim = Math\.max\(size\.x, size\.y, size\.z\);\n/,
  `const maxDim = Math.max(size.x, size.y, size.z);

      // Prevent walkable surfaces (ramps/platforms) from being mistaken as "pickups"
      const walkableByNamePre = isWalkableName(name) || isWalkableName(matName);
      const notWalkableLikePre = /wall|roof|house|tree|fence|lamp|sign|npc|character|foliage|leaf|stem|branch/i.test(lower);
      const looksLikeRampPre = !walkableByNamePre && !notWalkableLikePre && area > 3.5 && size.y > 0.18 && size.y < 4.2;
      const skipPickupBecauseWalkable = walkableByNamePre || looksLikeRampPre;

`
);

// gate the pickup classifier
replaceOnce(
  "gate pickup classification with skipPickupBecauseWalkable",
  /if \(\(isCoin \|\| isGem \|\| isBox \|\| isGift \|\| isMysteryBlock \|\| isDice \|\| isRing \|\| isSmallTreat \|\| isSmallCake\) && maxDim > 0\.05 && maxDim < 6\.5\) \{/,
  `if (!skipPickupBecauseWalkable && (isCoin || isGem || isBox || isGift || isMysteryBlock || isDice || isRing || isSmallTreat || isSmallCake) && maxDim > 0.05 && maxDim < 6.5) {`
);

// make baked pickup ids unique (avoid name collisions)
replaceOnce(
  "make baked pickup ids unique",
  /const id = name \|\| m\.uuid;/,
  `const id = name ? (name + "__" + m.uuid) : m.uuid;`
);

// 6) Create sensors for baked pickups at creation time (so question blocks/rings/dice/presents/icecream collect)
replaceOnce(
  "create sensors when baked pickups are registered",
  /(this\.bakedPickups\.set\(id,\s*\{\s*[\s\S]*?collected:\s*false\s*\}\);\s*)/,
  `$1
          // Sensor so the player can collect baked-in props
          if (!this.bakedPickupSensors.has(id)) {
            const bb2 = new THREE.Box3().setFromObject(m);
            const c2 = new THREE.Vector3();
            const s2 = new THREE.Vector3();
            bb2.getCenter(c2);
            bb2.getSize(s2);

            const md = Math.max(s2.x, s2.y, s2.z);
            const r = Math.max(0.55, Math.min(1.2, md * 0.35 + 0.1));

            const sensorDesc = this.physics.R.ColliderDesc.ball(r).setTranslation(c2.x, c2.y, c2.z);
            const sensor = this.physics.world.createCollider(sensorDesc);
            sensor.setSensor(true);
            sensor.setActiveEvents(
              this.physics.R.ActiveEvents.COLLISION_EVENTS | this.physics.R.ActiveEvents.INTERSECTION_EVENTS
            );
            this.physics.tagCollider(sensor, { kind: "coin", id: "baked:" + id });
            this.bakedPickupSensors.set(id, sensor);
          }
`
);

// 7) Fix wall fall-in: don't skip "glass" colliders globally + handle thin plane walls
replaceOnce(
  "stop skipping glass colliders (portal already skipped)",
  /if \(fullName\.includes\("portal"\) \|\| fullName\.includes\("glass"\)\) \{\n      return;\n    \}/,
  `if (fullName.includes("portal")) {
      return;
    }`
);

replaceOnce(
  "handle thin plane walls (avoid falling into walls)",
  /if \(vol < 0\.02\) return;/,
  `if (vol < 0.02) {
      // Some walls/signs are modeled as thin planes (almost zero volume).
      // Give them a minimum thickness so the player can't clip through/fall into them.
      const area = Math.max(size.x * size.y, size.y * size.z, size.x * size.z);
      const minDim = Math.min(size.x, size.y, size.z);
      const isThinLarge = area > 1.0 && size.y > 0.6 && minDim < 0.08;
      if (!isThinLarge) return;

      if (minDim === size.x) size.x = 0.25;
      else if (minDim === size.z) size.z = 0.25;
      else size.y = 0.25;
    }`
);

fs.writeFileSync(file, t, "utf8");
console.log("\nDONE. Patched:", file);
node scripts\patch-level-v3.cjs

npm run dev

cd /d C:\Users\david\Downloads\sweetland-portfolio
copy src\world\Level.ts src\world\Level.ts.bak
mkdir scripts 2>nul
copy con scripts\patch-level-v3.cjs
const fs = require("fs");

const file = "src/world/Level.ts";
if (!fs.existsSync(file)) {
  console.error("Missing file:", file);
  process.exit(1);
}

let t = fs.readFileSync(file, "utf8");

function replaceOnce(label, re, repl) {
  const before = t;
  t = t.replace(re, repl);
  if (t === before) {
    console.error("PATCH FAILED:", label);
    process.exit(1);
  }
  console.log("OK:", label);
}

// 1) Add bakedPickupSensors map (only if not already present)
if (!t.includes("bakedPickupSensors")) {
  replaceOnce(
    "insert bakedPickupSensors map",
    /(bakedPickups\s*=\s*new Map<string,\s*\{[\s\S]*?\}\>\(\);\s*\n)/,
    `$1\n  private bakedPickupSensors = new Map<string, any>();\n`
  );
}

// 2) Route "baked:" ids through collectCoin without changing App/Physics
replaceOnce(
  "update collectCoin to route baked pickups",
  /  collectCoin\(id: string\): void \{\n[\s\S]*?\n  \}\n/,
  `  collectCoin(id: string): void {
    // Baked pickups are tagged as coins with id prefix "baked:"
    if (id.startsWith("baked:")) {
      this.collectBakedPickup(id.slice("baked:".length));
      return;
    }

    const c = this.coins.get(id);
    if (!c) return;
    this.scene.remove(c.mesh);
    this.physics.untagCollider(c.sensor);
    this.physics.world.removeCollider(c.sensor, true);
    this.coins.delete(id);
  }\n`
);

// 3) When collecting a baked pickup, also remove its sensor so it can't re-trigger
replaceOnce(
  "update collectBakedPickup to remove sensor",
  /  collectBakedPickup\(id: string\): void \{\n[\s\S]*?\n  \}\n/,
  `  collectBakedPickup(id: string): void {
    const p = this.bakedPickups.get(id);
    if (!p || p.collected) return;
    p.collected = true;
    p.mesh.visible = false;

    const s = this.bakedPickupSensors.get(id);
    if (s) {
      this.physics.untagCollider(s);
      this.physics.world.removeCollider(s, true);
      this.bakedPickupSensors.delete(id);
    }
  }\n`
);

// 4) On respawn, rebuild baked pickup sensors (so everything can be collected again)
replaceOnce(
  "update respawnBakedPickups to recreate sensors",
  /  respawnBakedPickups\(\): void \{\n[\s\S]*?\n  \}\n/,
  `  respawnBakedPickups(): void {
    for (const [id, p] of this.bakedPickups.entries()) {
      p.collected = false;
      p.mesh.visible = true;
      p.mesh.position.copy(p.basePos);
      p.mesh.rotation.y = p.baseRotY;

      // Recreate sensor if it was removed on collect
      if (!this.bakedPickupSensors.has(id)) {
        p.mesh.updateMatrixWorld(true);
        const bb = new THREE.Box3().setFromObject(p.mesh);
        const c = new THREE.Vector3();
        const s = new THREE.Vector3();
        bb.getCenter(c);
        bb.getSize(s);

        const md = Math.max(s.x, s.y, s.z);
        const r = Math.max(0.55, Math.min(1.2, md * 0.35 + 0.1));

        const sensorDesc = this.physics.R.ColliderDesc.ball(r).setTranslation(c.x, c.y, c.z);
        const sensor = this.physics.world.createCollider(sensorDesc);
        sensor.setSensor(true);
        sensor.setActiveEvents(
          this.physics.R.ActiveEvents.COLLISION_EVENTS | this.physics.R.ActiveEvents.INTERSECTION_EVENTS
        );
        this.physics.tagCollider(sensor, { kind: "coin", id: "baked:" + id });
        this.bakedPickupSensors.set(id, sensor);
      }
    }
  }\n`
);

// 5) Prevent ramps/platforms from being mistaken as pickups (causes spinning + disappearing)
replaceOnce(
  "insert skipPickupBecauseWalkable precheck",
  /const maxDim = Math\.max\(size\.x, size\.y, size\.z\);\n/,
  `const maxDim = Math.max(size.x, size.y, size.z);

      // Prevent walkable surfaces (ramps/platforms) from being mistaken as "pickups"
      const walkableByNamePre = isWalkableName(name) || isWalkableName(matName);
      const notWalkableLikePre = /wall|roof|house|tree|fence|lamp|sign|npc|character|foliage|leaf|stem|branch/i.test(lower);
      const looksLikeRampPre = !walkableByNamePre && !notWalkableLikePre && area > 3.5 && size.y > 0.18 && size.y < 4.2;
      const skipPickupBecauseWalkable = walkableByNamePre || looksLikeRampPre;

`
);

// gate the pickup classifier
replaceOnce(
  "gate pickup classification with skipPickupBecauseWalkable",
  /if \(\(isCoin \|\| isGem \|\| isBox \|\| isGift \|\| isMysteryBlock \|\| isDice \|\| isRing \|\| isSmallTreat \|\| isSmallCake\) && maxDim > 0\.05 && maxDim < 6\.5\) \{/,
  `if (!skipPickupBecauseWalkable && (isCoin || isGem || isBox || isGift || isMysteryBlock || isDice || isRing || isSmallTreat || isSmallCake) && maxDim > 0.05 && maxDim < 6.5) {`
);

// make baked pickup ids unique (avoid name collisions)
replaceOnce(
  "make baked pickup ids unique",
  /const id = name \|\| m\.uuid;/,
  `const id = name ? (name + "__" + m.uuid) : m.uuid;`
);

// 6) Create sensors for baked pickups at creation time (so question blocks/rings/dice/presents/icecream collect)
replaceOnce(
  "create sensors when baked pickups are registered",
  /(this\.bakedPickups\.set\(id,\s*\{\s*[\s\S]*?collected:\s*false\s*\}\);\s*)/,
  `$1
          // Sensor so the player can collect baked-in props
          if (!this.bakedPickupSensors.has(id)) {
            const bb2 = new THREE.Box3().setFromObject(m);
            const c2 = new THREE.Vector3();
            const s2 = new THREE.Vector3();
            bb2.getCenter(c2);
            bb2.getSize(s2);

            const md = Math.max(s2.x, s2.y, s2.z);
            const r = Math.max(0.55, Math.min(1.2, md * 0.35 + 0.1));

            const sensorDesc = this.physics.R.ColliderDesc.ball(r).setTranslation(c2.x, c2.y, c2.z);
            const sensor = this.physics.world.createCollider(sensorDesc);
            sensor.setSensor(true);
            sensor.setActiveEvents(
              this.physics.R.ActiveEvents.COLLISION_EVENTS | this.physics.R.ActiveEvents.INTERSECTION_EVENTS
            );
            this.physics.tagCollider(sensor, { kind: "coin", id: "baked:" + id });
            this.bakedPickupSensors.set(id, sensor);
          }
`
);

// 7) Fix wall fall-in: don't skip "glass" colliders globally + handle thin plane walls
replaceOnce(
  "stop skipping glass colliders (portal already skipped)",
  /if \(fullName\.includes\("portal"\) \|\| fullName\.includes\("glass"\)\) \{\n      return;\n    \}/,
  `if (fullName.includes("portal")) {
      return;
    }`
);

replaceOnce(
  "handle thin plane walls (avoid falling into walls)",
  /if \(vol < 0\.02\) return;/,
  `if (vol < 0.02) {
      // Some walls/signs are modeled as thin planes (almost zero volume).
      // Give them a minimum thickness so the player can't clip through/fall into them.
      const area = Math.max(size.x * size.y, size.y * size.z, size.x * size.z);
      const minDim = Math.min(size.x, size.y, size.z);
      const isThinLarge = area > 1.0 && size.y > 0.6 && minDim < 0.08;
      if (!isThinLarge) return;

      if (minDim === size.x) size.x = 0.25;
      else if (minDim === size.z) size.z = 0.25;
      else size.y = 0.25;
    }`
);

fs.writeFileSync(file, t, "utf8");
console.log("\nDONE. Patched:", file);
