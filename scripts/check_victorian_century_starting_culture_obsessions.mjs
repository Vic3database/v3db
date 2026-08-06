import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const database = path.resolve(
  process.env.VICTORIAN_CENTURY_DATABASE || "database/victorian_century",
);
const read = (file) => JSON.parse(
  fs.readFileSync(path.join(database, file), "utf8").replace(/^\uFEFF/, ""),
);
const index = read("index.json");
const rows = (key) => read(index.files[key]);
const cultures = rows("cultures");
const goods = rows("goods");
const cultureByKey = new Map(cultures.map((culture) => [culture.key, culture]));
const goodByKey = new Map(goods.map((good) => [good.key, good]));
const obsessionKeys = (culture) => (culture.obsessions || []).map((item) => item.key).sort();
const startingKeys = (culture) => (culture.starting_obsessions || []).map((item) => item.key).sort();

const northGerman = cultureByKey.get("north_german");
assert.equal(cultures.filter((culture) => culture.starting_obsessions?.length).length, 55);
assert.equal(cultures.reduce((total, culture) => total + (culture.starting_obsessions?.length || 0), 0), 93);
assert(northGerman, "North German culture is missing");
assert.deepEqual(obsessionKeys(northGerman), ["liquor", "meat", "porcelain"]);
assert.deepEqual(startingKeys(northGerman), ["liquor", "porcelain"]);
assert(
  northGerman.starting_obsessions
    .find((item) => item.key === "liquor")
    ?.sources
    .some((source) => source.key === "stabilize_british_empire" && source.country_tags.includes("GBR")),
  "North German liquor must identify the British Empire journal source",
);

const british = cultureByKey.get("british");
assert(british, "British culture is missing");
assert.deepEqual(obsessionKeys(british), ["furniture", "luxury_clothes", "tea"]);
assert.deepEqual(startingKeys(british), ["furniture", "luxury_clothes"]);

for (const key of ["liquor", "porcelain", "furniture", "luxury_clothes"]) {
  const good = goodByKey.get(key);
  assert(good, `Good is missing: ${key}`);
  assert(
    good.obsessed_cultures?.some((culture) => culture.key === (key === "liquor" || key === "porcelain" ? "north_german" : "british")),
    `${key} must include its 1836 obsessed culture`,
  );
  assert(
    good.starting_obsessed_cultures?.some((culture) => culture.key === (key === "liquor" || key === "porcelain" ? "north_german" : "british")),
    `${key} must identify its opening obsession relationship`,
  );
}

console.log(JSON.stringify({
  victorian_century_starting_culture_obsessions: "ok",
  cultures_with_starting_obsessions: cultures.filter((culture) => culture.starting_obsessions?.length).length,
}, null, 2));
