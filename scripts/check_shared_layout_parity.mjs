import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "site");
const vcRoots = [path.join(root, "Victorian Century Database"), path.join(root, "site", "vc")];
const sharedFiles = [
  "app/runtime.js",
  "app/ui.js",
  "app/presentation.js",
  "app/boards.js",
  "app/map.js",
  "styles/foundation.css",
  "styles/shell.css",
  "styles/map.css",
  "styles/records.css",
  "styles/events.css",
  "styles/company.css",
];

for (const relative of sharedFiles) {
  const source = fs.readFileSync(path.join(sourceRoot, relative));
  for (const vcRoot of vcRoots) {
    assert.ok(fs.existsSync(path.join(vcRoot, relative)), `${relative} must exist in ${path.relative(root, vcRoot)}`);
    assert.deepEqual(fs.readFileSync(path.join(vcRoot, relative)), source, `${relative} differs in ${path.relative(root, vcRoot)}`);
  }
}

for (const vcRoot of vcRoots) {
  const html = fs.readFileSync(path.join(vcRoot, "index.html"), "utf8");
  assert.match(html, /data-map-fullscreen/, `${path.relative(root, vcRoot)} must expose fullscreen map controls`);
  assert.match(html, /data-map-collapse/, `${path.relative(root, vcRoot)} must expose collapse map controls`);
  assert.match(html, /vc-theme\.css/, `${path.relative(root, vcRoot)} must retain the VC theme`);
}

console.log(JSON.stringify({ shared_layout_parity: "ok", files: sharedFiles.length, outputs: vcRoots.map((rootPath) => path.relative(root, rootPath)) }, null, 2));
