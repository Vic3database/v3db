import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const outputs = [
  "site/versions/1.13.10",
  "site/vc",
  "Victorian Century Database",
];
const reports = [];

for (const relative of outputs) {
  const search = readSearchIndex(path.join(root, relative, "search-index.js"));
  const entry = (kind, key) => {
    const found = search.entries.find((candidate) => candidate.kind === kind && candidate.key === key);
    assert.ok(found, `missing ${kind}:${key} in ${relative}`);
    return found;
  };

  assert.ok(entry("country", "CHI").aliases?.["zh-Hans"]?.includes("大清"));
  assert.ok(entry("country", "CHI").aliases?.en?.includes("Dai Ching"));
  assert.ok(entry("region", "STATE_ALSACE_LORRAINE").aliases?.["zh-Hans"]?.includes("埃尔萨斯‑洛林根"));
  assert.ok(entry("company", "company_basic_agriculture_1").aliases?.["zh-Hans"]?.includes("财团"));
  assert.deepEqual(Array.from(entry("building", "building_barrack").internalAliases || []), ["building_barracks"]);
  assert.equal(new Set(search.entries.map((item) => item.id)).size, search.entries.length);

  reports.push({
    output: relative,
    official_alias_entries: countByKind(search.entries.filter((item) => item.aliases)),
    internal_alias_entries: countByKind(search.entries.filter((item) => item.internalAliases)),
  });
}

console.log(JSON.stringify({ global_search_aliases: "ok", reports }, null, 2));

function readSearchIndex(file) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  return context.window.VIC3_SEARCH_INDEX;
}

function countByKind(entries) {
  return Object.fromEntries([...new Set(entries.map((item) => item.kind))]
    .sort()
    .map((kind) => [kind, entries.filter((item) => item.kind === kind).length]));
}
