import assert from "node:assert/strict";
import fs from "node:fs";

const presentation = fs.readFileSync("site/app/presentation.js", "utf8");
const countryData = JSON.parse(fs.readFileSync("database/vic3_1.13.11/countries.json", "utf8").replace(/^\uFEFF/, ""));
const interestGroupData = JSON.parse(fs.readFileSync("database/vic3_1.13.11/interest_groups.json", "utf8").replace(/^\uFEFF/, ""));

assert.match(presentation, /function countryInterestGroupTabs\s*\(/, "country detail must define interest-group subtabs");
assert.match(presentation, /data-country-interest-group/, "interest-group subtabs must expose icon interaction targets");
assert.match(presentation, /function countryInterestGroupPanel\s*\(/, "country detail must define the selected interest-group panel");
assert.match(presentation, /country-interest-group-potential/, "interest-group panel must include the potential-flavor section");
assert.match(presentation, /<details class="country-interest-group-potential"/, "potential flavors must use a collapsible section");
assert.match(presentation, /interestGroupVariants\(/, "country detail must reuse the existing interest-group flavor normalization");
assert.match(presentation, /active_traits[\s\S]*active_ideologies/, "interest-group panel must show starting traits and ideologies");
assert.match(presentation, /interestGroupStatusBadges/, "interest-group tabs must explain their status markers with text badges");
assert.match(presentation, /data-interest-group-status="flavor"/, "interest-group tabs must label flavored groups");
assert.match(presentation, /vc\.badge\.adjusted/, "interest-group tabs must label Victorian Century adjustments");
assert.match(presentation, /country-interest-group-tab-name/, "interest-group status labels must sit below the group name");
assert.doesNotMatch(presentation, /country-interest-group-active-mark/, "interest-group tabs must not use unexplained dot markers");

const china = countryData.find((country) => country.tag === "CHI");
assert.equal(china?.interest_groups?.length, 8, "China must expose all eight interest groups");
assert.ok(interestGroupData.some((group) => (group.potential_flavors || []).length > 0), "interest-group data must include potential flavors");

console.log("country_detail_interest_groups: ok");
