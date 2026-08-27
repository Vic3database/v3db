import assert from "node:assert/strict";
import fs from "node:fs";

const root = process.cwd();
const index = fs.readFileSync(`${root}/site/index.html`, "utf8");
const ui = fs.readFileSync(`${root}/site/app/ui.js`, "utf8");
const boards = fs.readFileSync(`${root}/site/app/boards.js`, "utf8");
const solver = fs.readFileSync(`${root}/site/app/company-solver.js`, "utf8");
const composer = fs.readFileSync(`${root}/site/app/company-composer.js`, "utf8");
assert.match(index, /<strong id="filterPanelTitle" data-i18n="ui\.filters">筛选<\/strong>/);
assert.match(ui, /function toolPanelTitle\(/);
assert.match(ui, /els\.filterPanelTitle\.textContent = title/);
assert.match(ui, /closest\("\.filters"\)\?\.setAttribute\("aria-label", title\)/);
assert.match(ui, /detailKind === "cultureIncorporation"/);
assert.match(ui, /detailKind === "companySolver"/);
assert.match(ui, /detailKind === "companyComposer"/);
console.log("tool panel title contract passed");
