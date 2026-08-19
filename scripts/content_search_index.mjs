import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const contentKinds = new Set(["journal", "event", "decision"]);

export function updateContentSearchIndex({ site, content }) {
  const searchFile = path.join(site, "search-index.js");
  const dataIndexFile = path.join(site, "data-index.js");
  const search = readGlobal(searchFile, "VIC3_SEARCH_INDEX");
  const contentEntries = createContentSearchEntries(content);
  search.entries = [
    ...(search.entries || []).filter((entry) => !contentKinds.has(entry.kind)),
    ...contentEntries,
  ];
  const searchSource = `window.VIC3_SEARCH_INDEX = ${JSON.stringify(search)};\n`;
  fs.writeFileSync(searchFile, searchSource, "utf8");

  if (fs.existsSync(dataIndexFile)) {
    const dataIndex = readGlobal(dataIndexFile, "VIC3_DATA_INDEX");
    dataIndex.locales = dataIndex.locales || {};
    dataIndex.locales.search_index = dataIndex.locales.search_index || { path: "search-index.js" };
    dataIndex.locales.search_index.sha256 = sha256(searchSource);
    fs.writeFileSync(dataIndexFile, `window.VIC3_DATA_INDEX = ${JSON.stringify(dataIndex)};\n`, "utf8");
  }

  return Object.fromEntries([...contentKinds].map((kind) => [kind, contentEntries.filter((entry) => entry.kind === kind).length]));
}

export function createContentSearchEntries(content) {
  const journalGroups = new Map((content.journalEntryGroups || []).map((group) => [contentId(group), group]));
  const journals = (content.journalEntries || []).map((row) => contentEntry({
    kind: "journal",
    row,
    nameField: "name",
    groupKey: row.group || "ungrouped",
    groupLocales: journalGroups.get(row.group || "")?.locales || {},
  }));
  const events = (content.contentEvents || []).map((row) => contentEntry({
    kind: "event",
    row,
    nameField: "title",
    groupKey: row.namespace || "ungrouped",
    groupLocales: localesFromFlat(row.group_locales),
  }));
  const decisions = (content.decisions || []).map((row) => contentEntry({
    kind: "decision",
    row,
    nameField: "name",
    groupKey: row.source_file || "ungrouped",
    groupLocales: localesFromFlat(row.group_locales),
  }));
  return [...journals, ...events, ...decisions];
}

function contentEntry({ kind, row, nameField, groupKey, groupLocales }) {
  const key = contentId(row);
  return {
    kind,
    id: `${kind}:${key}`,
    key,
    groupKey,
    names: localizedPair(row.locales, nameField, key),
    groupNames: localizedPair(groupLocales, "name", groupKey),
  };
}

function contentId(row) {
  return row?.id || row?.script_key || "";
}

function localesFromFlat(value = {}) {
  return {
    zhHans: { name: value.zhHans || "" },
    en: { name: value.en || "" },
  };
}

function localizedPair(locales = {}, field, fallback) {
  return {
    "zh-Hans": locales.zhHans?.[field] || locales.en?.[field] || fallback,
    en: locales.en?.[field] || locales.zhHans?.[field] || fallback,
  };
}

function readGlobal(file, name) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox.window[name];
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}
