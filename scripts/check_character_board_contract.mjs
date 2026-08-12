import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const index = read("site/versions/1.13.9/data-index.js");
const html = read("site/index.html");
const runtime = read("site/app/runtime.js");
const data = read("site/app/data.js");
const ui = read("site/app/ui.js");
const characters = read("site/app/characters.js");
const pools = read("site/app/name-pools.js");
const styles = read("site/styles/characters.css");

assert.match(html, /data-nav-view="character"/, "missing character navigation entry");
assert.match(html, /data-nav-view="name-pool"/, "missing name-pool navigation entry");
assert.match(index, /data-characters\.js/, "data index must register character chunk");
assert.match(index, /data-name-pools\.js/, "data index must register name-pool chunk");
assert.match(runtime, /let historicalCharacters = \[\];/, "runtime must store historical characters");
assert.match(runtime, /let namePools = \[\];/, "runtime must store name pools");
assert.match(data, /view === "character"/, "data loader must recognize character view");
assert.match(data, /view === "name-pool"/, "data loader must recognize name-pool view");
assert.match(ui, /renderCharacterBoard\(\)/, "ui must dispatch character board");
assert.match(ui, /renderNamePoolBoard\(\)/, "ui must dispatch name-pool board");
assert.match(characters, /function renderCharacterBoard\(/, "character board renderer missing");
assert.match(characters, /function renderHistoricalCharacterDetail\(/, "character detail renderer missing");
assert.match(pools, /function renderNamePoolBoard\(/, "name-pool board renderer missing");
assert.match(pools, /male_common_first_names/, "name-pool board must render fixed name pools");
assert.match(styles, /body\[data-view="character"\]/, "character board styles missing");
assert.match(styles, /body\[data-view="name-pool"\]/, "name-pool board styles missing");

console.log("character board contract check passed");
