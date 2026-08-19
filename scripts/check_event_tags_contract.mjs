import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const version = process.argv[2] || "1.13.9";
const file = `site/versions/${version}/data-events.js`;
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
const events = sandbox.window.VIC3_DATA_CHUNK?.events || [];
assert.equal(events.length, version === "1.13.9" ? 2236 : 2239, "event tag contract must inspect all game events");

const allowed = ["legislation", "journal", "character", "politics", "war-diplomacy", "economy-production", "technology", "society-culture", "disaster-disease", "country-territory", "election"];
const counts = Object.fromEntries(allowed.map((tag) => [tag, 0]));
for (const event of events) {
  assert.ok(Array.isArray(event.tags), `${event.key} must expose a tags array`);
  for (const tag of event.tags) {
    assert.ok(allowed.includes(tag), `${event.key} has unknown event tag ${tag}`);
    counts[tag] += 1;
  }
}
for (const tag of allowed) assert.ok(counts[tag] > 0, `${tag} must classify at least one event`);

const eventByKey = new Map(events.map((event) => [event.key, event]));
assert.ok(eventByKey.get("1848.1")?.tags.includes("legislation"), "1848.1 must be classified as legislation");
assert.ok(eventByKey.get("1848.1")?.tags.includes("character"), "1848.1 must be classified as character-related");
const electionEvent = events.find((event) => /election/i.test(`${event.script?.trigger} ${event.script?.immediate} ${event.options.map((option) => option.script).join(" ")}`));
assert.ok(electionEvent?.tags.includes("election"), "an event with election script must be classified as election");

console.log(JSON.stringify({ event_tags_contract: "ok", events: events.length, counts }, null, 2));
