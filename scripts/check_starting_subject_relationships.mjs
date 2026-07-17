import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const countries = JSON.parse(fs.readFileSync(path.join(root, "database", "vic3_1.13.9", "countries.json"), "utf8").replace(/^\uFEFF/, ""));
const byTag = new Map(countries.map((country) => [country.tag, country]));

for (const [tag, overlord, type] of [
  ["BIC", "GBR", "chartered_company"],
  ["TIB", "CHI", "vassal"],
  ["TRI", "TUR", "puppet"],
  ["HUN", "AUS", "crown_land"],
]) {
  const country = byTag.get(tag);
  assert.equal(country?.starting_subject?.overlord_tag, overlord, `${tag} should retain its direct starting overlord`);
  assert.equal(country?.starting_subject?.type, type, `${tag} should retain its starting subject type`);
  assert.equal(country?.starting_subject?.uses_overlord_color, true, `${tag} should use its overlord color`);
}

for (const [tag, type] of [["ABU", "protectorate"], ["KOR", "tributary"]]) {
  const country = byTag.get(tag);
  assert.equal(country?.starting_subject?.type, type, `${tag} should retain its excluded subject type`);
  assert.equal(country?.starting_subject?.uses_overlord_color, false, `${tag} should retain its own color`);
}

console.log(JSON.stringify({
  checked: "database/vic3_1.13.9/countries.json",
  starting_subject_relationships: "ok",
}, null, 2));
