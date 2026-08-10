import fs from "node:fs";
import path from "node:path";
import { readSiteAppSource } from "./site_frontend_sources.mjs";

const root = process.cwd();
const appSource = readSiteAppSource(root);
const indexSource = fs.readFileSync(path.join(root, "site", "index.html"), "utf8").replace(/^\uFEFF/, "");
const failures = [];

const setView = functionSource("setView");
const resetBoardView = functionSource("resetBoardView");
const changeBoard = functionSource("changeBoard");
const applyHash = functionSource("applyHash");

assert(resetBoardView, "missing resetBoardView helper");
assert(changeBoard, "missing shared changeBoard helper");
assert(/state\.resultsPanelMode\s*=\s*"side"/.test(resetBoardView), "board-view reset should restore the results panel");
assert(/document\.body\.classList\.remove\("filters-collapsed"\)/.test(resetBoardView), "board-view reset should reveal the filter panel");
assert(/updatePanelToggleState\(\)/.test(resetBoardView), "board-view reset should synchronize panel button labels");
assert(/state\.view\s*!==\s*view[\s\S]*resetBoardView\(\)/.test(changeBoard), "changing boards should reset the previous board layout");
assert(/changeBoard\(view,\s*view === "region" \? "stateRegion" : view\)/.test(setView), "navigation should use the shared board change helper");
assert(!/state\.view\s*=/.test(applyHash), "hash routing should use the shared board change helper");
assert(/changeBoard\("company", "company"\)/.test(applyHash), "company hash routing should reset a previous board layout");
assert(/app\/ui\.js\?v=20260810-interest-group-tooltip-layout1/.test(indexSource), "UI script cache version should cover board-view reset");

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({ board_view_reset: "ok" }, null, 2));

function functionSource(name) {
  const start = appSource.indexOf(`function ${name}`);
  if (start < 0) return "";
  const signatureEnd = appSource.indexOf(")", start);
  const bodyStart = appSource.indexOf("{", signatureEnd);
  if (bodyStart < 0) return "";
  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    const char = appSource[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return appSource.slice(start, index + 1);
    }
  }
  return appSource.slice(start);
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}
