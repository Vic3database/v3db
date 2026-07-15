import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const app = fs.readFileSync(path.join(root, "site", "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "site", "styles.css"), "utf8");
const technologyChunk = readGlobal(path.join(root, "site", "versions", "1.13.9", "data-technologies.js"));

assert.match(app, /function renderTechnologyBoard\(/, "technology board renderer must exist");
assert.match(app, /function renderTechnologyDetail\(/, "technology detail renderer must exist");
assert.match(app, /technologyGraphLayout/, "technology graph layout must exist");
assert.match(app, /const technologyGraphLanes = 3/, "technology graph must limit each era to three horizontal lanes");
assert.match(app, /const eraTrackHeight = 390/, "technology graph must reserve a separate horizontal track for each era");
assert.match(app, /eraIndex \* eraTrackHeight/, "technology graph must stack era tracks vertically");
assert.match(app, /data-technology-key/, "technology nodes must expose stable keys");
assert.match(app, /data-technology-target/, "technology detail links must expose targets");
assert.match(app, /assets\/technologies\//, "technology nodes must use published technology icons");
assert.match(styles, /technology-graph-viewport/, "desktop graph viewport styles must exist");
assert.match(styles, /technology-local-graph/, "narrow-screen local graph styles must exist");
for (const technology of technologyChunk.technologies) {
  const iconFile = path.basename(technology.icon).replace(/\.dds$/i, ".png");
  assert(fs.existsSync(path.join(root, "site", "assets", "technologies", iconFile)), `${technology.key} must have a published PNG icon`);
}

console.log(JSON.stringify({ technology_board_contract: "ok" }, null, 2));

function readGlobal(file) {
  const source = fs.readFileSync(file, "utf8");
  const match = source.match(/window\.VIC3_DATA_CHUNK\s*=\s*(.+);\s*$/s);
  assert(match, "technology chunk must define VIC3_DATA_CHUNK");
  return JSON.parse(match[1]);
}
