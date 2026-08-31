import assert from "node:assert/strict";
import fs from "node:fs";

const extractor = fs.readFileSync("scripts/extract_vic3_countries.mjs", "utf8");
const builder = fs.readFileSync("scripts/build_wiki.mjs", "utf8");
const presentation = fs.readFileSync("site/app/presentation.js", "utf8");
const countries = JSON.parse(fs.readFileSync("database/vic3_1.13.11/countries.json", "utf8").replace(/^\uFEFF/, ""));

assert.match(extractor, /function loadStartingDiplomacy\s*\(/, "extractor must define starting diplomacy extraction");
assert.match(extractor, /set_relations/, "extractor must read starting relations");
assert.match(extractor, /create_bidirectional_truce/, "extractor must read starting truces");
assert.match(builder, /startingDiplomacy/, "site builder must expose starting diplomacy");
assert.match(presentation, /function countryDetailDiplomacyContent\s*\(/, "country detail must render starting diplomacy");

const china = countries.find((country) => country.tag === "CHI");
const britain = countries.find((country) => country.tag === "GBR");
const netherlands = countries.find((country) => country.tag === "NET");
assert.ok(china?.starting_diplomacy?.some((item) => item.target_tag === "TIB" && item.type === "subject" && item.subject_type === "vassal"), "China must expose Tibet as a starting subject relationship");
assert.ok(china?.starting_diplomacy?.some((item) => item.target_tag === "KOR" && item.type === "relation" && item.value === 50), "China must expose its starting relation with Korea");
assert.ok(britain?.starting_diplomacy?.some((item) => item.target_tag === "RUS" && item.type === "rivalry"), "Great Britain must expose its rivalry with Russia");
assert.ok(netherlands?.starting_diplomacy?.some((item) => item.target_tag === "BEL" && item.type === "truce" && item.months === 40), "Netherlands must expose its starting truce with Belgium");
assert.ok(china?.starting_diplomacy?.every((item) => item.source_line > 0), "starting diplomacy records must retain source lines");

console.log("country_starting_diplomacy: ok");
