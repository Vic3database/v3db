import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { extractModifierNames, parseModifierDefinitions } from "./event_effects.mjs";

const eventSource = fs.readFileSync("site/app/events.js", "utf8");
const eventDataSource = fs.readFileSync("site/versions/1.13.9/data-events.js", "utf8");
const localeSource = fs.readFileSync("site/versions/1.13.9/locale-events.zh-Hans.js", "utf8");
const englishLocaleSource = fs.readFileSync("site/versions/1.13.9/locale-events.en.js", "utf8");
const gapReport = fs.readFileSync("docs/audits/1.13.9-event-modifier-localization-gaps.md", "utf8");
const events = JSON.parse(fs.readFileSync("database/vic3_1.13.9/events.json", "utf8"));
const event = events.find((item) => item.id === "1848.1");
const option = event.options.find((item) => item.name_key === "1848.1.b");

assert.deepEqual(extractModifierNames(option.raw), ["regicide_averted"], "event option modifier reference must be extracted");

const source = "regicide_averted = {\n  icon = gfx/interface/icons/timed_modifier_icons/modifier_documents_positive.dds\n  country_law_enactment_success_add = 0.10\n  country_law_enactment_speed_mult = -0.2\n}";
const definitions = parseModifierDefinitions(source);
assert.deepEqual(definitions.get("regicide_averted"), [
  { key: "country_law_enactment_success_add", value_raw: "0.10" },
  { key: "country_law_enactment_speed_mult", value_raw: "-0.2" },
], "modifier definition effects must be extracted");

assert.doesNotMatch(eventSource, /<code>\$\{escapeHtml\(modifier\.name\)\}<\/code>/, "event effects must not expose internal modifier keys");
assert.doesNotMatch(eventSource, /const labels =/, "event UI must not maintain a partial handwritten modifier label list");
assert.match(eventDataSource, /"key":"unit_morale_recovery_mult","value_raw":"[^"}]+","loc":"modifier:unit_morale_recovery_mult\.name"/, "generated event effects must reference a localized morale recovery name");
assert.match(eventDataSource, /"key":"unit_occupation_mult","value_raw":"[^"}]+","loc":"modifier:unit_occupation_mult\.name"/, "generated event effects must reference a localized occupation name");

const localeSandbox = { window: {} };
vm.runInNewContext(localeSource, localeSandbox, { filename: "locale-events.zh-Hans.js" });
const messages = localeSandbox.window.VIC3_LOCALE_CHUNKS["zh-Hans:event:locale-events"].messages;
assert.equal(messages["modifier:unit_morale_recovery_mult.name"], "士气恢复", "morale recovery must use the official simplified-Chinese term");
assert.equal(messages["modifier:unit_occupation_mult.name"], "战斗占领", "occupation must use the official simplified-Chinese term");
assert.equal(Object.keys(messages).filter((key) => key.startsWith("modifier:")).length, 378, "all official modifier terms referenced by event options must be included in the event locale chunk");
assert.equal(messages["modifier:state_russian_standard_of_living_add.name"], undefined, "modifiers without an official term must not receive an invented translation");
const englishLocaleSandbox = { window: {} };
vm.runInNewContext(englishLocaleSource, englishLocaleSandbox, { filename: "locale-events.en.js" });
const englishMessages = englishLocaleSandbox.window.VIC3_LOCALE_CHUNKS["en:event:locale-events"].messages;
assert.equal(englishMessages["modifier:interest_group_pol_str_mult.name"], "利益集团政治力量", "an official simplified-Chinese term must remain available when the English modifier file lacks the same key");
assert.equal((gapReport.match(/^\| `(?:country|state)_[a-z0-9_]+` \|/gm) || []).length, 22, "the localization-gap report must retain every unnamed event modifier");

console.log(JSON.stringify({ event_effects_contract: "ok" }, null, 2));
