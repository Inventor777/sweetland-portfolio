import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("public/models");
const OUT = path.join(ROOT, "manifest.json");
const exts = new Set([".glb", ".gltf"]);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (exts.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

fs.mkdirSync(ROOT, { recursive: true });

const files = walk(ROOT)
  .map((abs) => {
    const rel = abs.replace(ROOT, "").split(path.sep).join("/");
    return `/models${rel}`;
  })
  .sort((a, b) => a.localeCompare(b));

const manifest = {
  generatedAt: new Date().toISOString(),
  root: "/models",
  count: files.length,
  files
};

fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2), "utf8");
console.log(`✅ Wrote ${OUT} (${files.length} files)`);
