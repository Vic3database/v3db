import assert from "node:assert/strict";
import fs from "node:fs";

const presentation = fs.readFileSync("site/app/presentation.js", "utf8");
const countryData = JSON.parse(fs.readFileSync("database/vic3_1.13.11/countries.json", "utf8").replace(/^\uFEFF/, ""));
const interestGroupData = JSON.parse(fs.readFileSync("database/vic3_1.13.11/interest_groups.json", "utf8").replace(/^\uFEFF/, ""));
const versionedIdeologyChunk = fs.readFileSync("site/versions/1.13.11/data-ideologies.js", "utf8");

assert.match(presentation, /function countryInterestGroupTabs\s*\(/, "country detail must define interest-group subtabs");
assert.match(presentation, /data-country-interest-group/, "interest-group subtabs must expose icon interaction targets");
assert.match(presentation, /function countryInterestGroupPanel\s*\(/, "country detail must define the selected interest-group panel");
assert.match(presentation, /country-interest-group-flavor-list/, "interest-group panel must render starting and potential flavors together");
assert.doesNotMatch(presentation, /<details class="country-interest-group-potential"/, "potential flavors must not use a separate collapsible section");
assert.match(presentation, /interestGroupVariants\(/, "country detail must reuse the existing interest-group flavor normalization");
assert.match(presentation, /active_traits[\s\S]*active_ideologies/, "interest-group panel must show starting traits and ideologies");
assert.match(presentation, /interestGroupStatusBadges/, "interest-group tabs must explain their status markers with text badges");
assert.match(presentation, /data-interest-group-status="flavor"/, "interest-group tabs must label flavored groups");
assert.match(presentation, /hasStartingFlavor: Boolean\(group\?\.display_name\?\.is_flavored\)/, "country interest-group flavor labels must require a flavored starting name");
assert.doesNotMatch(versionedIdeologyChunk, /vc_change_kind/, "the original Victoria 3 data chunk must not carry Victorian Century change tags");
assert.doesNotMatch(presentation, /hasStartingFlavor: Boolean\(group\?\.display_name\?\.is_flavored \|\| group\?\.applied_rules/, "ordinary condition rules must not create a flavor label");
assert.match(presentation, /vc\.badge\.adjusted/, "interest-group tabs must label Victorian Century adjustments");
assert.match(presentation, /country-interest-group-tab-name/, "interest-group status labels must sit below the group name");
assert.doesNotMatch(presentation, /country-interest-group-active-mark/, "interest-group tabs must not use unexplained dot markers");

const china = countryData.find((country) => country.tag === "CHI");
assert.equal(china?.interest_groups?.length, 8, "China must expose all eight interest groups");
const japan = countryData.find((country) => country.tag === "JAP");
assert.equal(japan?.interest_groups?.find((group) => group.key === "ig_armed_forces")?.display_name?.key, "ig_samurai", "Japan armed forces must start as Samurai before the fall-of-the-samurai event");
const japanLandowners = japan?.interest_groups?.find((group) => group.key === "ig_landowners");
assert.ok(japanLandowners?.applied_rules?.some((rule) => rule.added_ideologies?.some((item) => item.key === "ideology_japan_hierarchic")), "Japan starting interest-group rules must retain ideology changes");
assert.deepEqual(japanLandowners?.active_traits?.map((trait) => trait.key), ["ig_trait_outspoken_tozama", "ig_trait_fudai_support", "ig_trait_noblesse_oblige"], "Japan starting landowners must keep one trait per approval slot");
const japanShinto = interestGroupData.find((group) => group.key === "ig_devout")?.potential_flavors?.find((flavor) => flavor.key === "ig_shinto_monks");
assert.ok(japanShinto?.rules?.some((rule) => rule.added_ideologies?.some((item) => item.key === "ideology_shinto_moralist")), "Japan potential flavor rules must retain event or decision ideology changes");
assert.ok(japanShinto?.rules?.some((rule) => rule.traits?.some((item) => item.key === "ig_trait_haibutsu_kishaku")), "Japan potential flavor rules must retain event or decision traits");
const zaibatsu = interestGroupData.find((group) => group.key === "ig_industrialists")?.potential_flavors?.find((flavor) => flavor.key === "ig_zaibatsu");
assert.ok(zaibatsu?.trigger_event_ids?.includes("japan_politics.2"), "Zaibatsu potential flavor must link its triggering event");
assert.equal(zaibatsu?.trigger_interest_group_key, "ig_industrialists", "Zaibatsu potential flavor must link its source interest group");
assert.match(presentation, /interestGroupPotentialFlavorTriggerHtml/);
assert.doesNotMatch(presentation, /t\("board\.country\.potentialFlavorTrigger",[^\n]+,\s*\{\s*event:/, "trigger links must not be passed as an ignored third argument to t()");
assert.match(presentation, /data-country-interest-group-flavor-count/, "country detail must expose the potential flavor count");
assert.match(presentation, /countryInterestGroupStartingFlavor/, "country detail must build the starting flavor from the country record");
assert.match(presentation, /added_ideologies:[\s\S]*removed_ideologies:/, "starting and potential flavor cards must retain ideology changes");
assert.match(presentation, /#\/\$\{encodeURIComponent\(contentKind\)\}\/\$\{encodeURIComponent\(contentId\)\}/);
assert.match(presentation, /trigger_interest_group_flavor_key/);
assert.match(fs.readFileSync("site/app/boards.js", "utf8"), /variant\.trigger_event_ids = variant\.triggerEventIds \|\| flavor\.trigger_event_ids/);
const japaneseTransitions = [
  ["ig_intelligentsia", "ig_intelligentsia", "ig_rangakusha", "event", "japan_politics.1"],
  ["ig_industrialists", "ig_zaibatsu", "ig_gosho", "event", "japan_politics.2"],
  ["ig_petty_bourgeoisie", "ig_petty_bourgeoisie", "ig_chonin", "event", "japan_politics.3"],
  ["ig_armed_forces", "ig_armed_forces", "ig_samurai", "event", "meiji.3"],
  ["ig_landowners", "ig_kazoku", "ig_daimyo", "journal", "je_meiji_restoration"],
  ["ig_devout", "ig_shinto_monks", "ig_jisha", "decision", "shinto_decision"],
];
for (const [groupKey, targetKey, sourceFlavorKey, contentKind, contentId] of japaneseTransitions) {
  const flavor = interestGroupData.find((group) => group.key === groupKey)?.potential_flavors?.find((item) => item.key === targetKey);
  assert.ok(flavor, `${groupKey} must include ${targetKey}`);
  assert.equal(flavor.trigger_interest_group_flavor_key, sourceFlavorKey, `${targetKey} must retain its source flavor`);
  assert.equal(flavor.trigger_content_kind, contentKind, `${targetKey} must retain its trigger content kind`);
  assert.equal(flavor.trigger_content_id, contentId, `${targetKey} must retain its trigger content id`);
  assert.ok(flavor.loc?.triggerContentTitle, `${targetKey} must retain a localized trigger title`);
}
assert.ok(interestGroupData.some((group) => (group.potential_flavors || []).length > 0), "interest-group data must include potential flavors");
assert.ok(interestGroupData.flatMap((group) => group.potential_flavors || []).some((flavor) => Array.isArray(flavor.country_tags)), "potential flavors must retain applicable country tags");
assert.match(fs.readFileSync("site/app/boards.js", "utf8"), /variant\.countryTags = .*flavor\.country_tags/, "interest-group variant normalization must retain applicable country tags");

console.log("country_detail_interest_groups: ok");
