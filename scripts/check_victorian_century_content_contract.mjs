import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const database = path.join(root, "database", "victorian_century");
const indexFile = path.join(database, "content-index.json");
assert.ok(fs.existsSync(indexFile), "VC merged content index must exist");
const index = JSON.parse(fs.readFileSync(indexFile, "utf8"));
assert.equal(index.dataset, "Victorian Century merged content");
for (const kind of ["journal_entries", "journal_entry_groups", "events", "decisions"]) {
  const file = path.join(database, `${kind}.json`);
  assert.ok(fs.existsSync(file), `${kind} data file must exist`);
  const rows = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(rows.length, index.counts[kind], `${kind} count must match index`);
  assert.ok(rows.length > 0, `${kind} must not be empty`);
  assert.ok(rows.every((row) => Array.isArray(row.sources) && row.sources.length > 0), `${kind} rows must include source provenance`);
  assert.ok(rows.some((row) => row.sources.includes("vanilla")), `${kind} must retain vanilla content`);
  if (kind !== "journal_entry_groups") assert.ok(rows.some((row) => row.sources.includes("vc")), `${kind} must include VC content`);
}

const journalEntries = JSON.parse(fs.readFileSync(path.join(database, "journal_entries.json"), "utf8"));
assert.ok(journalEntries.some((row) => row.id === "meiji_restoration" && row.sources.includes("vc")), "VC REPLACE_OR_CREATE 日志必须进入合并数据");
assert.equal(journalEntries.find((row) => row.id === "meiji_restoration")?.group, "je_group_meiji_restoration", "VC REPLACE_OR_CREATE 日志必须完成字段解析");
assert.match(journalEntries.find((row) => row.id === "je_meiji_restoration")?.is_shown_when_inactive_raw || "", /c:JAP\s*\?=/, "VC REPLACE_OR_CREATE 覆盖日志必须保留显示条件");

const events = JSON.parse(fs.readFileSync(path.join(database, "events.json"), "utf8"));
assert.ok(events.some((event) => event.sources.includes("vanilla") && event.sources.includes("vc")), "events must expose an overridden vanilla definition");
assert.ok(events.some((event) => event.sources.length === 1 && event.sources[0] === "vc"), "events must expose a VC-only definition");
assert.ok(index.counts.events_game <= index.counts.events, "event game count must be bounded");
console.log(JSON.stringify({ victorian_century_content_contract: "ok", counts: index.counts }, null, 2));
