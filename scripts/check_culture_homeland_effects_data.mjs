import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { deriveCultureHomelandEffects } from "./culture_homeland_effects.mjs";

const root = process.cwd();
const vanilla = path.resolve(process.argv[2] || path.join(root, "..", "..", "database", "vic3_1.13.11"));
const victorianCentury = path.resolve(process.argv[3] || path.join(root, "..", "..", "database", "victorian_century"));
const site = process.argv[4] ? path.resolve(process.argv[4]) : "";
const expectedKeys = ["actions", "content_id", "content_kind", "dynamic_scope", "eligible_when", "id", "localization_key", "source_file", "source_line"];

for (const [label, database] of [["vanilla", vanilla], ["victorian-century", victorianCentury]]) {
  const effects = deriveCultureHomelandEffects(readContent(database));
  assert.ok(effects.length > 0, `${label} should derive homeland effects`);
  for (const effect of effects) assert.deepEqual(Object.keys(effect).sort(), expectedKeys, `${label} ${effect.id} schema`);
  verifySharedEffects(label, effects);
  if (label === "victorian-century") verifyVictorianCenturyEffects(effects);
}

if (site) {
  const chunk = readGlobal(path.join(site, "data-regions.js"), "VIC3_DATA_CHUNK");
  assert.ok(Array.isArray(chunk.cultureHomelandEffects));
  assert.ok(chunk.cultureHomelandEffects.some((effect) => effect.id === "event:manifest_destiny.1"));
}

console.log("culture homeland effects data passed");

function readContent(database) {
  return Object.fromEntries(["events", "journal_entries", "decisions"].map((file) => [file.replace("journal_entries", "journal").replace("events", "event").replace("decisions", "decision"), JSON.parse(fs.readFileSync(path.join(database, `${file}.json`), "utf8").replace(/^\uFEFF/, ""))]));
}

function verifySharedEffects(label, effects) {
  const firstDestiny = byId(effects, "event:manifest_destiny.1");
  assertAction(firstDestiny, "STATE_CALIFORNIA", ["yankee"], []);
  assertAction(firstDestiny, "STATE_ARIZONA", ["dixie"], []);
  const secondDestiny = byId(effects, "event:manifest_destiny.2");
  assertAction(secondDestiny, "STATE_OKLAHOMA", ["dixie"], []);
  assertAction(secondDestiny, "STATE_MONTANA", ["yankee"], []);
  assert.equal(byId(effects, "journal:je_oregon").dynamic_scope, false, `${label} Oregon should have fixed targets`);
  assert.equal(byId(effects, "event:fsa_events.1").dynamic_scope, true, `${label} FSA effect should be dynamic`);
  assert.equal(byId(effects, "journal:je_iberia").dynamic_scope, true, `${label} Iberia effect should be dynamic`);
}

function verifyVictorianCenturyEffects(effects) {
  const lombardy = byId(effects, "event:joi_flavor_aus.10");
  assertAction(lombardy, "STATE_LOMBARDY", ["south_german"], ["north_italian"]);
  assert.equal(byId(effects, "event:joi_flavor_tur.52").dynamic_scope, true, "VC Ottoman Armenian effect should be dynamic");
  assertAction(byId(effects, "journal:manifest_destiny_hawai"), "STATE_HAWAIIAN_ISLANDS", ["yankee"], []);
  assertAction(byId(effects, "decision:expand_deutsche_reich_states_to_poland"), "STATE_GREATER_POLAND", ["north_german"], []);
}

function byId(effects, id) {
  const effect = effects.find((item) => item.id === id);
  assert.ok(effect, `missing effect ${id}`);
  return effect;
}

function assertAction(effect, stateRegion, added, removed) {
  const action = effect.actions.find((item) => item.state_regions.includes(stateRegion));
  assert.ok(action, `${effect.id} should include ${stateRegion}`);
  assert.deepEqual(action.added_cultures, added);
  assert.deepEqual(action.removed_cultures, removed);
}

function readGlobal(file, globalName) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox.window[globalName];
}
