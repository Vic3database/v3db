import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const app = fs.readFileSync(path.join(root, "site", "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "site", "styles.css"), "utf8");

assert.match(app, /function renderTechnologyBoard\(/, "technology board renderer must exist");
assert.match(app, /function renderTechnologyDetail\(/, "technology detail renderer must exist");
assert.match(app, /technologyGraphLayout/, "technology graph layout must exist");
assert.match(app, /data-technology-key/, "technology nodes must expose stable keys");
assert.match(app, /data-technology-target/, "technology detail links must expose targets");
assert.match(styles, /technology-graph-viewport/, "desktop graph viewport styles must exist");
assert.match(styles, /technology-local-graph/, "narrow-screen local graph styles must exist");

console.log(JSON.stringify({ technology_board_contract: "ok" }, null, 2));
