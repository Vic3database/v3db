import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataRoot = path.join(root, "database", "vic3_1.13.9");
const index = JSON.parse(fs.readFileSync(path.join(dataRoot, "content-index.json"), "utf8"));

if (index.version !== "1.13.9") throw new Error(`unexpected version: ${index.version}`);
for (const [kind, expected] of [["journal_entries", 419], ["events", 2261], ["decisions", 60], ["journal_entry_groups", 27]]) {
  const rows = JSON.parse(fs.readFileSync(path.join(dataRoot, `${kind}.json`), "utf8"));
  if (expected !== null && rows.length !== expected) throw new Error(`${kind}: expected ${expected}, got ${rows.length}`);
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error(`${kind}: duplicate ids`);
  if (rows.some((row) => !row.source_file || !row.source_line || !row.raw)) throw new Error(`${kind}: incomplete source metadata`);
}

const journal = JSON.parse(fs.readFileSync(path.join(dataRoot, "journal_entries.json"), "utf8"));
const events = JSON.parse(fs.readFileSync(path.join(dataRoot, "events.json"), "utf8"));
const decisions = JSON.parse(fs.readFileSync(path.join(dataRoot, "decisions.json"), "utf8"));
const groups = JSON.parse(fs.readFileSync(path.join(dataRoot, "journal_entry_groups.json"), "utf8"));
const sources = JSON.parse(fs.readFileSync(path.join(dataRoot, "content-sources.json"), "utf8"));
if (!journal.some((row) => row.id === "je_abolish_monarchy" && row.locales?.en?.name)) throw new Error("journal localization missing");
if (!events.some((row) => row.id === "1848.1" && row.locales?.en?.title && row.locales?.zhHans?.title)) throw new Error("event localization missing");
if (!decisions.some((row) => row.id === "revive_olympic_games_decision" && row.locales?.en?.name)) throw new Error("decision localization missing");
if (index.counts.source_files.scanned.events !== 331) throw new Error("event subdirectories were not scanned");
if (!events.some((row) => row.source_file.includes("events/agitators_events/"))) throw new Error("nested event definitions missing");
const abolishMonarchy = journal.find((row) => row.id === "je_abolish_monarchy");
if (abolishMonarchy.group !== "je_group_internal_affairs" || !abolishMonarchy.complete_raw || !abolishMonarchy.triggered_event_ids?.includes("1848.2")) {
  throw new Error("journal display fields missing");
}
const regicide = events.find((row) => row.id === "1848.1");
if (regicide.event_type !== "country_event" || regicide.options?.length !== 2 || !regicide.trigger_raw || regicide.event_image?.video !== "europenorthamerica_springtime_of_nations") throw new Error("event display fields missing");
const olympics = decisions.find((row) => row.id === "revive_olympic_games_decision");
if (!olympics.is_shown_raw || !olympics.possible_raw || !olympics.when_taken_raw || !olympics.ai_chance_raw) throw new Error("decision display fields missing");
if (!groups.some((row) => row.id === "je_group_internal_affairs" && row.context === "country" && row.locales.en?.name === "Domestic Affairs" && row.locales.zhHans?.name === "国内事务")) {
  throw new Error("journal entry group data missing");
}
if (index.counts.journal_entries_game !== 418 || index.counts.events_game !== 2236 || index.counts.decisions_game !== 60) throw new Error("content classification counts changed");
if (index.coverage.events.en.title !== 2204 || index.coverage.events.zhHans.title !== 2204) throw new Error("event localization coverage changed");
if (index.distributions.event_types.country_event !== 2238 || index.distributions.event_types.state_event !== 14) throw new Error("event type distribution changed");
if (index.counts.event_options !== 4836) throw new Error("event option count changed");
if (sources.events.length !== 331 || sources.events.reduce((total, row) => total + row.definitions, 0) !== 2261) throw new Error("source manifest mismatch");
console.log(JSON.stringify({ ok: true, counts: index.counts }, null, 2));
