import assert from "node:assert/strict";
import fs from "node:fs";
import { eventGroupNames } from "./event_group_names.mjs";

const events = JSON.parse(fs.readFileSync("database/vic3_1.13.9/events.json", "utf8"))
  .filter((event) => event.content_class === "game");
const namespaces = [...new Set(events.map((event) => event.namespace || String(event.id || "").split(".")[0]))];

assert.equal(namespaces.length, 352, "vanilla 1.13.9 events must retain 352 event namespaces");
assert.deepEqual(Object.keys(eventGroupNames).sort(), namespaces.sort(), "every event namespace must have a curated group name");
assert.equal(eventGroupNames["1848"].zhHans, "人民之春", "1848 must use the official Springtime of the Peoples term");
assert.equal(eventGroupNames.federation_of_india.zhHans, "印度联邦", "the India federation namespace must use its proper name");
assert.equal(eventGroupNames.fsa_events.zhHans, "美利坚自由邦", "FSA namespaces must use the official country-tag name");
assert.equal(eventGroupNames.gg_core.zhHans, "大博弈", "Great Game namespaces must use the official named concept");
assert.ok(namespaces.every((namespace) => eventGroupNames[namespace].en), "each group must retain a readable English label");

console.log(JSON.stringify({ event_group_names_contract: "ok", groups: namespaces.length }, null, 2));
