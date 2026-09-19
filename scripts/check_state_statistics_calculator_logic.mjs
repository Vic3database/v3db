import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("site/app/state-statistics.js", "utf8");
const context = { console };
vm.runInNewContext(`${source}\nthis.summarizeStateRegions = summarizeStateRegions;\nthis.stateStatisticsResourceGroupKey = stateStatisticsResourceGroupKey;`, context);

const summary = context.summarizeStateRegions([
  {
    key: "STATE_A",
    starting_population: 100,
    arable_land: 10,
    capped_resources: [{ key: "building_iron_mine", amount: 8 }],
    discoverable_resources: [{ key: "building_oil_rig", undiscovered_amount: 20 }],
    arable_resources: [{ key: "building_wheat_farm" }],
    starting_owners: [{ tag: "AAA" }],
    starting_population_by_owner: [{ tag: "AAA", population: 100 }],
  },
  {
    key: "STATE_B",
    starting_population: 250,
    arable_land: 12,
    capped_resources: [{ key: "building_iron_mine", amount: 4 }],
    discoverable_resources: [{ key: "building_oil_rig", undiscovered_amount: 60 }],
    arable_resources: [{ key: "building_wheat_farm" }, { key: "building_rye_farm" }],
    starting_owners: [{ tag: "AAA" }, { tag: "BBB" }],
    starting_population_by_owner: [{ tag: "AAA", population: 150 }, { tag: "BBB", population: 100 }],
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
assert.equal(context.stateStatisticsResourceGroupKey({ key: "building_iron_mine" }), "mining");
assert.equal(context.stateStatisticsResourceGroupKey({ key: "building_gold_field" }), "mining");
assert.equal(context.stateStatisticsResourceGroupKey({ key: "building_oil_rig" }), "oil");
assert.equal(context.stateStatisticsResourceGroupKey({ key: "building_wheat_farm" }), "staples");
assert.equal(summary.startingOwners.get("AAA").population, 250);
assert.equal(summary.startingOwners.get("AAA").regions.length, 2);
assert.equal(summary.startingOwners.get("AAA").cappedResources.get("building_iron_mine").amount, 12);
assert.equal(summary.startingOwners.get("BBB").population, 100);
const splitSummary = context.summarizeStateRegions([
  { key: "STATE_SPLIT", starting_population: 1000, starting_population_by_owner: [{ tag: "FRA", population: 300 }, { tag: "SAR", population: 700 }], starting_owners: [{ tag: "FRA" }, { tag: "SAR" }], arable_land: 20, capped_resources: [{ key: "building_iron_mine", amount: 10 }], discoverable_resources: [], arable_resources: [{ key: "building_wheat_farm" }] },
]);
assert.equal(splitSummary.countryPopulation.get("FRA"), 300);
assert.equal(splitSummary.splitStateCount, 1);
assert.equal(splitSummary.splitResourceExcluded, true);

console.log("state statistics logic: passed");
