import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const site = path.join(root, "site");
const index = fs.readFileSync(path.join(site, "index.html"), "utf8");

const appFiles = [
  "app/runtime.js",
  "app/data.js",
  "app/ui.js",
  "app/boards.js",
  "app/filters.js",
  "app/presentation.js",
  "app/map.js",
  "app/components.js",
  "app/bootstrap.js",
];

const styleFiles = [
  "styles/foundation.css",
  "styles/filters.css",
  "styles/map.css",
  "styles/records.css",
  "styles/shell.css",
  "styles/home.css",
  "styles/dialogs.css",
  "styles/technology.css",
];

for (const file of appFiles) {
  assert.ok(fs.existsSync(path.join(site, file)), `missing script section: ${file}`);
}

for (const file of styleFiles) {
  assert.ok(fs.existsSync(path.join(site, file)), `missing style section: ${file}`);
}

const appOrder = appFiles.map((file) => index.indexOf(`src="${file}`));
assert.ok(appOrder.every((position) => position >= 0), "index must load every application section");
assert.ok(appOrder.every((position, index) => index === 0 || appOrder[index - 1] < position), "application sections must keep their dependency order");

const styleEntry = fs.readFileSync(path.join(site, "styles.css"), "utf8");
for (const file of styleFiles) {
  assert.match(styleEntry, new RegExp(`@import\\s+url\\(["']?\\.?/?${file.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`), `styles entry must import ${file}`);
}

assert.ok(fs.readFileSync(path.join(site, "app.js"), "utf8").length < 800, "app.js must remain a small compatibility entry");
assert.ok(styleEntry.length < 1400, "styles.css must remain a small style entry");
assert.doesNotMatch(styleEntry, /:root\s*\{/, "styles.css must not retain foundation rules");

console.log("frontend_file_split: ok");
