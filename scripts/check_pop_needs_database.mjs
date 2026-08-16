import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const database = path.resolve(process.argv[2] || "database/vic3_1.13.9");
const mode = process.argv[3] || "vanilla";
assert(["vanilla", "vc"].includes(mode), `unsupported needs database mode: ${mode}`);

const index = readJson(path.join(database, "index.json"));
assert(index.files?.pop_needs, "database index must expose pop_needs.json");
assert(index.files?.buy_packages, "database index must expose buy_packages.json");

const needs = readJson(path.join(database, index.files.pop_needs));
const packages = readJson(path.join(database, index.files.buy_packages));
const relationCount = needs.reduce((sum, need) => sum + (need.entries || []).length, 0);

assert.equal(needs.length, 15, "database must expose all 15 pop needs");
assert.equal(relationCount, mode === "vc" ? 53 : 52, `${mode} goods relation count changed`);
assert.deepEqual(packages.map((row) => row.level), Array.from({ length: 99 }, (_, index) => index + 1), "buy packages must cover wealth 1 through 99 once each");
assert(packages.every((row) => Number.isFinite(row.political_strength)), "every buy package must expose political strength");
assert(packages.every((row) => row.values && typeof row.values === "object"), "every buy package must expose need values");
assert(packages.every((row) => row.total === Object.values(row.values).reduce((sum, value) => sum + value, 0)), "buy package totals must equal their need values");

const needKeys = new Set(needs.map((need) => need.key));
for (const row of packages) {
  for (const key of Object.keys(row.values)) assert(needKeys.has(key), `wealth ${row.level} references missing need ${key}`);
}

if (mode === "vanilla") {
  assert.equal(packages.find((row) => row.level === 1)?.values?.popneed_basic_food, 90, "vanilla wealth 1 basic food changed");
  assert.equal(packages.find((row) => row.level === 20)?.values?.popneed_communication, 16, "vanilla wealth 20 communication changed");
} else {
  assert.equal(packages.find((row) => row.level === 62)?.values?.popneed_services, 5284, "VC wealth 62 services changed");
  assert(needs.find((need) => need.key === "popneed_services")?.entries?.some((entry) => entry.goods_key === "fine_art"), "VC services must include fine art");
}

console.log(JSON.stringify({
  pop_needs_database: "ok",
  mode,
  needs: needs.length,
  relations: relationCount,
  wealth_levels: packages.length,
}, null, 2));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}
