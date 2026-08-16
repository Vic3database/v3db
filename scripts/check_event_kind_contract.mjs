import fs from "node:fs";
import { buildEventKindContext, classifyEventEvidence, classifyEventKind } from "./event_kind.mjs";

const events = JSON.parse(fs.readFileSync("database/vic3_1.13.9/events.json", "utf8"))
  .filter((event) => event.content_class === "game");
const journals = JSON.parse(fs.readFileSync("database/vic3_1.13.9/journal_entries.json", "utf8"))
  .filter((journal) => journal.content_class === "game");
const context = buildEventKindContext(events, journals);
const byId = new Map(events.map((event) => [event.id, event]));

const expected = {
  "1848.1": "generic",
  "1848.2": "generic",
  "1848.4": "generic",
  "1848.12": "generic",
  "federation_of_india.1": "flavor",
  "acw_je_events.2": "flavor",
  "fsa_events.1": "flavor",
  "generals.1": "generic",
  "historical_events.1": "generic",
  "election_generic.1": "generic",
};

for (const [id, kind] of Object.entries(expected)) {
  const event = byId.get(id);
  if (!event) throw new Error(`missing event ${id}`);
  if (classifyEventKind(event, context) !== kind) throw new Error(`${id} should be ${kind}`);
}

const counts = events.reduce((result, event) => {
  const kind = classifyEventKind(event, context);
  result[kind] = (result[kind] || 0) + 1;
  return result;
}, {});
if (counts.generic + counts.flavor !== events.length) throw new Error("event kind partition is incomplete");
const acwEvidence = classifyEventEvidence(byId.get("acw_je_events.2"), context);
if (!acwEvidence.countries.includes("USA")) throw new Error("American Civil War event should expose country scope");
console.log(JSON.stringify({ event_kind_contract: "ok", events: events.length, counts }, null, 2));
