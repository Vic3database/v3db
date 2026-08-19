import assert from "node:assert/strict";
import fs from "node:fs";
import { eventGroupNames } from "./event_group_names.mjs";

const version = process.argv[2] || "1.13.9";
const events = JSON.parse(fs.readFileSync(`database/vic3_${version}/events.json`, "utf8"))
  .filter((event) => event.content_class === "game");
const namespaces = [...new Set(events.map((event) => event.namespace || String(event.id || "").split(".")[0]))];

assert.equal(namespaces.length, version === "1.13.9" ? 352 : 353, "vanilla event namespaces changed");
assert.deepEqual(
  Object.keys(eventGroupNames).filter((namespace) => namespaces.includes(namespace)).sort(),
  namespaces.sort(),
  "every vanilla event namespace must have a curated group name",
);
assert.equal(eventGroupNames["1848"].zhHans, "人民之春", "1848 must use the official Springtime of the Peoples term");
assert.equal(eventGroupNames.federation_of_india.zhHans, "印度联邦", "the India federation namespace must use its proper name");
assert.equal(eventGroupNames.fsa_events.zhHans, "美利坚自由邦", "FSA namespaces must use the official country-tag name");
assert.equal(eventGroupNames.gg_core.zhHans, "大博弈", "Great Game namespaces must use the official named concept");
if (version !== "1.13.9") assert.equal(eventGroupNames.treaty_port_inheritance_events.zhHans, "特许港继承", "1.13.10 and later treaty port namespaces must have a curated name");
assert.ok(namespaces.every((namespace) => eventGroupNames[namespace].en), "each group must retain a readable English label");

console.log(JSON.stringify({ event_group_names_contract: "ok", groups: namespaces.length }, null, 2));
