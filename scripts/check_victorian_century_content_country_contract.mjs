import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const database = path.join(root, "database", "victorian_century");
const auditFile = path.join(database, "content-country-association-audit.json");
assert.ok(fs.existsSync(auditFile), "缺少内容国家关联审计文件");

const collections = {
  journal: JSON.parse(fs.readFileSync(path.join(database, "journal_entries.json"), "utf8")),
  event: JSON.parse(fs.readFileSync(path.join(database, "events.json"), "utf8")),
  decision: JSON.parse(fs.readFileSync(path.join(database, "decisions.json"), "utf8")),
};
const countries = readJson(path.join(database, "countries.json"));
const validTags = new Set(countries.map((country) => country.tag || country.id));

for (const [kind, rows] of Object.entries(collections)) {
  assert.ok(rows.every((row) => Array.isArray(row.country_scope)), `${kind} 缺少 country_scope`);
  assert.ok(rows.every((row) => Array.isArray(row.country_scope_evidence)), `${kind} 缺少 country_scope_evidence`);
  assert.ok(rows.every((row) => row.content_kind === (row.country_scope.length ? "flavor" : "generic")), `${kind} 的 content_kind 与范围不一致`);
  if (kind === "event") assert.ok(rows.every((row) => row.event_kind === row.content_kind), "事件性质未同步到 event_kind");
  for (const row of rows) for (const tag of row.country_scope) assert.ok(validTags.has(tag), `${kind}:${row.id} 使用无法解析的国家标签 ${tag}`);
}

const byId = (kind) => new Map(collections[kind].map((row) => [row.id, row]));
assert.deepEqual(byId("journal").get("alexander_reform").country_scope, ["RUS"]);
assert.deepEqual(byId("decision").get("aus_integrate_crown_lands_decision").country_scope, ["AUS"]);
assert.ok(!byId("decision").get("decision_demand_hungary_revoke_laws").country_scope.includes("HUN"));
assert.deepEqual(byId("event").get("1848.4").country_scope, []);

const audit = JSON.parse(fs.readFileSync(auditFile, "utf8"));
assert.equal(audit.dataset, "Victorian Century merged content");
assert.equal(audit.unresolved_country_tags.length, 0);
assert.ok(audit.relations.total > 0);
assert.ok(Array.isArray(audit.invalid_targets));
const baseline = audit.vanilla_1_13_11_event_baseline;
assert.equal(baseline.total, 2239);
assert.equal(baseline.flavor, 473);
assert.ok(Array.isArray(baseline.reclassified_scopes));

const contentDataFile = path.join(root, "Victorian Century Database", "data-content.js");
assert.ok(fs.existsSync(contentDataFile), "独立站缺少 data-content.js");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(contentDataFile, "utf8"), sandbox, { filename: contentDataFile });
const chunk = sandbox.window.VIC3_DATA_CHUNK;
assert.ok(chunk.contentByCountry && Object.keys(chunk.contentByCountry).length > 0, "内容块缺少国家反向索引");
for (const [field, kind, idField] of [
  ["journalEntries", "journals", "id"],
  ["contentEvents", "events", "id"],
  ["decisions", "decisions", "id"],
]) {
  const rows = chunk[field];
  const byRowId = new Map(rows.map((row) => [row[idField], row]));
  for (const row of rows) for (const tag of row.country_scope || []) {
    assert.ok(chunk.contentByCountry[tag]?.[kind]?.includes(row[idField]), `${tag}/${kind}/${row[idField]} 缺少反向索引`);
  }
  for (const [tag, bucket] of Object.entries(chunk.contentByCountry)) for (const id of bucket[kind]) {
    assert.ok(byRowId.get(id)?.country_scope.includes(tag), `${tag}/${kind}/${id} 与正向范围不一致`);
  }
}

console.log(JSON.stringify({
  victorian_century_content_country_contract: "ok",
  flavor: Object.fromEntries(Object.entries(collections).map(([kind, rows]) => [kind, rows.filter((row) => row.content_kind === "flavor").length])),
  evidence: audit.evidence,
  countries_with_content: audit.countries_with_content,
  baseline_reclassified: baseline.reclassified_scopes.length,
}, null, 2));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}
