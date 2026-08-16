import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { readSiteAppSource } from "./site_frontend_sources.mjs";

const root = process.cwd();
const outputs = [
  "site/versions/1.13.10",
  "site/vc",
  "Victorian Century Database",
];
const expectedSamples = [
  { kind: "journal", key: "je_abolish_monarchy", name: "消灭君主制", groupKey: "je_group_internal_affairs" },
  { kind: "event", key: "1848.1", name: "审判", groupKey: "1848" },
  { kind: "decision", key: "revive_olympic_games_decision", name: "重启奥林匹克运动会", groupKey: "common/decisions/00_decisions.txt" },
];
const reports = [];

for (const relative of outputs) {
  const output = path.join(root, relative);
  const content = readGlobal(path.join(output, "data-content.js"), "VIC3_DATA_CHUNK");
  const search = readGlobal(path.join(output, "search-index.js"), "VIC3_SEARCH_INDEX");
  const expectedCounts = {
    journal: content.journalEntries.length,
    event: content.contentEvents.length,
    decision: content.decisions.length,
  };
  const indexedCounts = Object.fromEntries(Object.keys(expectedCounts).map((kind) => [
    kind,
    search.entries.filter((entry) => entry.kind === kind).length,
  ]));
  assert.deepEqual(indexedCounts, expectedCounts, `${relative} content search counts must match data-content.js`);

  const qing = search.entries.find((entry) => entry.kind === "country" && entry.key === "CHI");
  assert.ok(qing?.aliases?.["zh-Hans"]?.includes("大清"), `${relative} content update must preserve country aliases`);
  const barracks = search.entries.find((entry) => entry.kind === "building" && entry.key === "building_barrack");
  assert.deepEqual(barracks?.internalAliases, ["building_barracks"], `${relative} content update must preserve building compatibility aliases`);

  for (const sample of expectedSamples) {
    const entry = search.entries.find((candidate) => candidate.kind === sample.kind && candidate.key === sample.key);
    assert.ok(entry, `${relative} must index ${sample.kind} ${sample.key}`);
    assert.ok(entry.names?.["zh-Hans"]?.includes(sample.name), `${relative} ${sample.key} must retain its Chinese title`);
    assert.ok(entry.names?.en && entry.names.en !== sample.key, `${relative} ${sample.key} must retain its English title`);
    assert.equal(entry.groupKey, sample.groupKey, `${relative} ${sample.key} must retain its group key`);
    assert.ok(entry.groupNames?.["zh-Hans"], `${relative} ${sample.key} must retain its Chinese group name`);
    assert.ok(entry.groupNames?.en, `${relative} ${sample.key} must retain its English group name`);
  }
  for (const entry of search.entries.filter((candidate) => ["journal", "event", "decision"].includes(candidate.kind))) {
    for (const forbidden of ["raw", "description", "options", "sourceFile", "detailText"]) {
      assert.ok(!(forbidden in entry), `${relative} ${entry.id} must not embed detailed field ${forbidden}`);
    }
  }
  reports.push({ output: relative, indexed: indexedCounts });
}

const html = fs.readFileSync(path.join(root, "site", "index.html"), "utf8");
const app = readSiteAppSource(root);
const zh = fs.readFileSync(path.join(root, "site", "locales", "ui.zh-Hans.js"), "utf8");
const en = fs.readFileSync(path.join(root, "site", "locales", "ui.en.js"), "utf8");
assert.match(html, /id="globalSearchDetailedToggle"/, "global search must expose a detailed-search toggle");
assert.match(html, /styles\.css\?v=20260816-global-search-row-height1/, "styles.css must use the global-search-row-height cache version");
for (const asset of ["locales/manifest.js", "app/runtime.js", "app/ui.js"]) {
  assert.match(html, new RegExp(`${asset.replaceAll(".", "\\.")}\\?v=20260816-global-content-search1`), `${asset} must use the global-content-search cache version`);
}
for (const asset of ["app/boards.js", "app/presentation.js"]) {
  assert.match(html, new RegExp(`${asset.replaceAll(".", "\\.")}\\?v=20260816-global-search-aliases1`), `${asset} must use the global-search-alias cache version`);
}
const styles = fs.readFileSync(path.join(root, "site", "styles.css"), "utf8");
assert.match(styles, /styles\/dialogs\.css\?v=20260816-global-search-row-height1/, "the dialog stylesheet import must use the row-height cache version");
assert.match(app, /function ensureGlobalSearchDetailCache\s*\(/, "global search must lazily build its detailed field cache");
assert.match(app, /function globalSearchMatchExcerpt\s*\(/, "detailed matches must render a bounded excerpt");
assert.match(app, /kind === "journal"[^\n]*replaceHash\(`\/journal\//, "journal search results must navigate to journal details");
assert.match(app, /kind === "event"[^\n]*replaceHash\(`\/event\//, "event search results must navigate to event details");
assert.match(app, /kind === "decision"[^\n]*replaceHash\(`\/decision\//, "decision search results must navigate to decision details");
for (const [source, label] of [[zh, "详细搜索"], [en, "Detailed search"]]) {
  assert.ok(source.includes(label), `locale bundle must include ${label}`);
}
for (const [kind, zhLabel, enLabel] of [["journal", "日志", "Journal"], ["event", "事件", "Event"], ["decision", "决议", "Decision"]]) {
  assert.match(zh, new RegExp(`"entity\\.${kind}": "${zhLabel}"`));
  assert.match(en, new RegExp(`"entity\\.${kind}": "${enLabel}"`));
}

console.log(JSON.stringify({ global_content_search: "ok", reports }, null, 2));

function readGlobal(file, globalName) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  return context.window[globalName];
}
