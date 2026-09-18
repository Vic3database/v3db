import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("site/app/state-statistics.js", "utf8");
const context = { console };
vm.runInNewContext(`${source}\nthis.summarizeStateRegions = summarizeStateRegions;`, context);

const summary = context.summarizeStateRegions([
  {
    key: "STATE_A",
    starting_population: 100,
    arable_land: 10,
    capped_resources: [{ key: "building_iron_mine", amount: 8 }],
    discoverable_resources: [{ key: "building_oil_rig", undiscovered_amount: 20 }],
    arable_resources: [{ key: "building_wheat_farm" }],
  },
  {
    key: "STATE_B",
    starting_population: 250,
    arable_land: 12,
    capped_resources: [{ key: "building_iron_mine", amount: 4 }],
    discoverable_resources: [{ key: "building_oil_rig", undiscovered_amount: 60 }],
    arable_resources: [{ key: "building_wheat_farm" }, { key: "building_rye_farm" }],
  },
]);

assert.equal(summary.stateCount, 2);
assert.equal(summary.population, 350);
assert.equal(summary.arableLand, 22);
assert.equal(summary.cappedResources.get("building_iron_mine").amount, 12);
assert.equal(summary.discoverableResources.get("building_oil_rig").undiscovered_amount, 80);
assert.equal(JSON.stringify(summary.discoverableResources.get("building_oil_rig").regions), JSON.stringify(["STATE_A", "STATE_B"]));
assert.equal(summary.arableResources.get("building_wheat_farm").regions.length, 2);
assert.equal(summary.arableResources.get("building_rye_farm").regions.length, 1);

console.log("state statistics logic: passed");
