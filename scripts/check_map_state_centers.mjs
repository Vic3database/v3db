import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const mapSource = fs.readFileSync(path.join(root, "site/app/map.js"), "utf8").replace(/^\uFEFF/, "");
const context = {};

vm.runInNewContext(`
${functionSource(mapSource, "decodeMapRuns")}
${functionSource(mapSource, "computeMapStateCenters")}
this.decodeMapRuns = decodeMapRuns;
this.computeMapStateCenters = computeMapStateCenters;
`, context);

const interiorCenters = context.computeMapStateCenters(
  Uint16Array.from([0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0]),
  12,
  1,
  ["", "STATE_INTERIOR"],
);
assert.equal(interiorCenters.get("STATE_INTERIOR")?.x, 4, "interior state centers must remain arithmetic means");

const wrappedCenters = context.computeMapStateCenters(
  Uint16Array.from([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1]),
  12,
  1,
  ["", "STATE_CHUKOTKA"],
);
const chukotkaCenter = wrappedCenters.get("STATE_CHUKOTKA");
assert.ok(chukotkaCenter, "wrapped state center must exist");
assert.ok(
  Math.abs(chukotkaCenter.x - 11.5) < 0.001,
  `a state crossing the world seam must stay at the seam, received x=${chukotkaCenter.x}`,
);

const mapData = JSON.parse(read("site/versions/1.13.9/map-data.js").replace(/^window\.VIC3_MAP_DATA\s*=\s*/, "").replace(/;\s*$/, ""));
const actualCenters = context.computeMapStateCenters(
  context.decodeMapRuns(mapData.runs, mapData.width * mapData.height),
  mapData.width,
  mapData.height,
  mapData.stateKeys,
);
const actualChukotkaCenter = actualCenters.get("STATE_CHUKOTKA");
assert.ok(actualChukotkaCenter, "STATE_CHUKOTKA center must exist in 1.13.9 map data");
assert.ok(
  actualChukotkaCenter.x > mapData.width * 0.95,
  `STATE_CHUKOTKA center must remain near the right edge, received x=${actualChukotkaCenter.x}`,
);
assert.ok(
  Math.abs(actualChukotkaCenter.y - 302) < 2,
  `STATE_CHUKOTKA center y should remain near the visible region, received y=${actualChukotkaCenter.y}`,
);

console.log(JSON.stringify({ map_state_centers: "ok", chukotka_x: actualChukotkaCenter.x }));

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, "");
}

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`missing ${name}`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated ${name}`);
}
