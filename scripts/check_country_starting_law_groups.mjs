import assert from "node:assert/strict";
import fs from "node:fs";

const countries = JSON.parse(fs.readFileSync("database/vic3_1.13.11/countries.json", "utf8").replace(/^\uFEFF/, ""));
const laws = JSON.parse(fs.readFileSync("database/vic3_1.13.11/laws.json", "utf8").replace(/^\uFEFF/, ""));
const lawByKey = new Map(laws.map((law) => [law.key, law]));

for (const tag of ["CHI", "AUS", "GBR", "JAP"]) {
  const country = countries.find((item) => item.tag === tag);
  assert.ok(country, `${tag} must exist`);
  const startingLaws = country.starting_laws || [];
  const groups = new Set(startingLaws.map((law) => lawByKey.get(law.key)?.group_key).filter(Boolean));
  const regularGroups = new Set([...groups].filter((group) => !["lawgroup_caste_hegemony", "lawgroup_edo_social_system"].includes(group)));
  assert.equal(regularGroups.size, 24, `${tag} must expose all 24 regular starting law groups`);
  assert.equal(startingLaws.length, tag === "JAP" ? 25 : 24, `${tag} must expose one starting law per applicable group`);
  assert.deepEqual(new Set(startingLaws.map((law) => law.category)), new Set(["power_structure", "economy", "human_rights"]), `${tag} must expose all three law categories`);
}

const china = countries.find((country) => country.tag === "CHI");
assert.equal(china.starting_laws.find((law) => law.key === "law_peasant_levies")?.source, "law_group_default", "China must expose the army default law");
assert.equal(china.starting_laws.find((law) => law.key === "law_no_schools")?.source, "law_group_default", "China must expose the education default law");

const nonStarting = countries.find((country) => country.status?.exists_at_start === false && country.status?.has_history_country_file === true);
assert.equal(nonStarting?.starting_laws?.length, 0, "countries absent in 1836 must not expose starting laws");

console.log("country_starting_law_groups: ok");
