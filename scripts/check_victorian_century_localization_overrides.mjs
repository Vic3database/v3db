import assert from "node:assert/strict";
import fs from "node:fs";
import { withBaseGameLocalization } from "./lib/localization-overrides.mjs";

const baseGame = new Map([
  ["wood", "木材"],
  ["hardwood", "硬木"],
]);
const merged = new Map([
  ["wood", "伍德"],
  ["hardwood", "硬木"],
]);
const economy = withBaseGameLocalization(merged, baseGame, ["wood"], "zh-Hans");

assert.equal(merged.get("wood"), "伍德", "the shared catalog must retain the mod's character surname");
assert.equal(economy.get("wood"), "木材", "the economy catalog must retain the base-game goods name");
assert.equal(economy.get("hardwood"), "硬木", "unrelated economy localization must remain unchanged");

const extractor = fs.readFileSync("scripts/extract_vic3_countries.mjs", "utf8");
assert.match(extractor, /const economyLoc = modContentRoot[\s\S]+withBaseGameLocalization\(/, "the extractor must create a scoped economy catalog");
assert.match(extractor, /loadEconomyData\(\{[\s\S]+loc: economyLoc,/, "economy extraction must use the scoped catalog");

console.log(JSON.stringify({ victorian_century_localization_overrides: "ok" }, null, 2));
