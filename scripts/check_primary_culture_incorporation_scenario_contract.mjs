import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8").replace(/^\uFEFF/, "");
const presentation = read("site/app/presentation.js");
const map = read("site/app/map.js");
const runtime = read("site/app/runtime.js");

assert.match(presentation, /function countryPrimaryCultureScenarioForRoute\(country, route\)/);
assert.match(presentation, /function countryPrimaryCultureScenarioForOption\(country, group, option\)/);
assert.match(map, /function countryIncorporationPrimaryCultures\(selectedCountry\)/);
assert.match(runtime, /countryIncorporationScenario: null/);

const scenarioSource = presentation.match(/function countryPrimaryCultureScenarioForRoute\([\s\S]*?\n}\n\nfunction countryPrimaryCultureExpansionsHtml/);
assert.ok(scenarioSource, "scenario helpers should be grouped before the expansion renderer");
const context = { Set, JSON };
vm.runInNewContext(`${scenarioSource[0].replace(/\n\nfunction countryPrimaryCultureExpansionsHtml[\s\S]*$/, "")}
this.scenarioForRoute = countryPrimaryCultureScenarioForRoute;
this.scenarioForOption = countryPrimaryCultureScenarioForOption;`, context);

const country = { tag: "FRA", primaryCultures: ["french", "platinean"] };
const routeScenario = context.scenarioForRoute(country, { culture: "catalan", route_kind: "conditional", content_type: "scripted", content_id: "catalan_button", source_line: 80 });
assert.deepEqual(routeScenario.primaryCultures, ["catalan", "french", "platinean"]);
assert.equal(routeScenario.countryTag, "FRA");
assert.equal(routeScenario.kind, "conditional");
assert.ok(routeScenario.routeKey);
assert.ok(routeScenario.title);
assert.ok(Object.hasOwn(routeScenario, "condition"));
assert.ok(Object.hasOwn(routeScenario, "source"));

const replacementScenario = context.scenarioForRoute(country, { added_culture: "argentine", removed_culture: "platinean", route_kind: "replacement", content_type: "event", content_id: "replace", source_line: 4 });
assert.deepEqual(replacementScenario.primaryCultures, ["argentine", "french"]);

const optionScenario = context.scenarioForOption({ tag: "AFG", primaryCultures: ["pashtun", "tajik"] }, { id: "afghanistan_origin", options: [] }, { id: "maimana", added_primary_cultures: ["turkmen", "uzbek"] });
assert.deepEqual(optionScenario.primaryCultures, ["pashtun", "tajik", "turkmen", "uzbek"]);
assert.equal(optionScenario.kind, "exclusive");

console.log("primary culture incorporation scenario contract passed");
