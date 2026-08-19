import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const version = process.env.VICTORIA3_VERSION || "1.13.11";
const database = path.join(root, "database", `vic3_${version}`);
const site = path.join(root, "site", "versions", version);
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(database, name), "utf8").replace(/^\uFEFF/, ""));
const readGlobal = (file, name) => {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox.window[name];
};

const journals = readJson("journal_entries.json");
const events = readJson("events.json");
const decisions = readJson("decisions.json");
const countries = new Set(readJson("countries.json").map((country) => country.tag || country.id).filter(Boolean));
const audit = readJson("content-country-association-audit.json");

for (const [kind, rows] of [["journal", journals], ["event", events], ["decision", decisions]]) {
  assert.ok(rows.every((row) => Array.isArray(row.country_scope)), `${kind} 缺少 country_scope`);
  assert.ok(rows.every((row) => Array.isArray(row.country_scope_evidence)), `${kind} 缺少 country_scope_evidence`);
  assert.ok(rows.every((row) => row.content_kind === (row.country_scope.length ? "flavor" : "generic")), `${kind} content_kind 与国家范围不一致`);
}

const index = readJson("content-index.json");
assert.equal(index.files.country_association_audit, "content-country-association-audit.json");
assert.equal(audit.content.journal.total, journals.length);
assert.equal(audit.content.event.total, events.length);
assert.equal(audit.content.decision.total, decisions.length);
assert.deepEqual(audit.unresolved_country_tags, []);

const chunk = readGlobal(path.join(site, "data-content.js"), "VIC3_DATA_CHUNK");
const dataIndex = readGlobal(path.join(site, "data-index.js"), "VIC3_DATA_INDEX");
const eventChunk = readGlobal(path.join(site, "data-events.js"), "VIC3_DATA_CHUNK");
assert.equal(chunk.journalEntries.length, journals.filter((row) => row.content_class === "game").length);
assert.equal(chunk.contentEvents.length, events.filter((row) => row.content_class === "game").length);
assert.equal(chunk.decisions.length, decisions.filter((row) => row.content_class === "game").length);
assert.ok(dataIndex.chunks.content, "原版数据索引缺少 content 数据块");
assert.ok(Object.keys(chunk.contentByCountry).length > 0, "原版国家反向索引为空");

const rowsByKind = {
  journals: new Map(chunk.journalEntries.map((row) => [row.id, row])),
  events: new Map(chunk.contentEvents.map((row) => [row.id, row])),
  decisions: new Map(chunk.decisions.map((row) => [row.id, row])),
};
for (const [tag, bucket] of Object.entries(chunk.contentByCountry)) {
  assert.ok(countries.has(tag), `反向索引包含未知国家 ${tag}`);
  for (const kind of ["journals", "events", "decisions"]) {
    for (const id of bucket[kind]) {
      const row = rowsByKind[kind].get(id);
      assert.ok(row, `${tag} 的 ${kind} 反向索引无法回查 ${id}`);
      assert.ok(row.country_scope.includes(tag), `${tag} 的 ${kind} 反向索引与正向范围不一致：${id}`);
    }
  }
}

for (const [kind, rows] of Object.entries(rowsByKind)) {
  for (const row of rows.values()) {
    for (const tag of row.country_scope) {
      if (!countries.has(tag)) continue;
      assert.ok(chunk.contentByCountry[tag]?.[kind]?.includes(row.id), `${kind}:${row.id} 缺少 ${tag} 反向索引`);
    }
  }
}

const siteEventById = new Map(eventChunk.events.map((row) => [row.key, row]));
for (const row of chunk.contentEvents) {
  const siteEvent = siteEventById.get(row.id);
  assert.ok(siteEvent, `事件块缺少 ${row.id}`);
  assert.deepEqual([...siteEvent.country_scope], [...row.country_scope], `事件块仍使用旧国家范围：${row.id}`);
  assert.equal(siteEvent.event_kind, row.content_kind, `事件块分类不一致：${row.id}`);
}

console.log(JSON.stringify({
  vanilla_content_country_contract: "ok",
  version,
  content: audit.content,
  countries_with_content: Object.keys(chunk.contentByCountry).length,
}, null, 2));
