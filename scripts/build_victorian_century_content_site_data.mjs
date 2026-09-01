import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { eventGroupNames } from "./event_group_names.mjs";
import { decisionGroupName } from "./decision_group_names.mjs";
import { buildContentByCountry } from "./content_country_scope.mjs";
import { updateContentSearchIndex } from "./content_search_index.mjs";

const root = process.cwd();
const database = path.resolve(readArg("--database", path.join(root, "database", "victorian_century")));
const site = path.resolve(readArg("--site", path.join(root, "Victorian Century Database")));
const indexFile = path.join(database, "content-index.json");
if (!fs.existsSync(indexFile)) throw new Error(`Missing merged VC content index: ${indexFile}`);
const index = JSON.parse(fs.readFileSync(indexFile, "utf8"));
const rows = (name) => JSON.parse(fs.readFileSync(path.join(database, `${name}.json`), "utf8"));
const value = {
  journalEntries: rows("journal_entries"),
  journalEntryGroups: rows("journal_entry_groups"),
  contentEvents: rows("events"),
  decisions: rows("decisions"),
};
const countriesFile = path.join(database, "countries.json");
const countries = JSON.parse(fs.readFileSync(countriesFile, "utf8").replace(/^\uFEFF/, ""));
const validCountryTags = countries.map((country) => country.tag || country.id).filter(Boolean);
value.contentByCountry = buildContentByCountry({
  journals: value.journalEntries,
  events: value.contentEvents,
  decisions: value.decisions,
}, validCountryTags);
for (const row of value.contentEvents) row.group_locales = eventGroupNames[row.namespace] || { zhHans: row.namespace || "", en: row.namespace || "" };
for (const row of value.decisions) row.group_locales = { zhHans: decisionGroupName(row.source_file, "zh-Hans"), en: decisionGroupName(row.source_file, "en") };
const dataFile = path.join(site, "data-content.js");
fs.writeFileSync(dataFile, `window.VIC3_DATA_CHUNK = ${JSON.stringify(value)};\n`, "utf8");

const dataIndexFile = path.join(site, "data-index.js");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(dataIndexFile, "utf8"), sandbox, { filename: dataIndexFile });
const dataIndex = sandbox.window.VIC3_DATA_INDEX;
dataIndex.meta.dataset_name = "Victorian Century";
dataIndex.meta.content_dataset = index.dataset;
dataIndex.chunks.content = {
  files: ["data-content.js"],
  keys: Object.keys(value),
  counts: {
    journalEntries: value.journalEntries.length,
    journalEntryGroups: value.journalEntryGroups.length,
    contentEvents: value.contentEvents.length,
    decisions: value.decisions.length,
    countriesWithContent: Object.keys(value.contentByCountry).length,
  },
};
dataIndex.locales = dataIndex.locales || { supported: ["zh-Hans", "en"], chunks: {} };
dataIndex.locales.content = { source: "data-content.js", sha256: sha256(fs.readFileSync(dataFile)) };
writeTextAtomically(dataIndexFile, `window.VIC3_DATA_INDEX = ${JSON.stringify(dataIndex)};\n`);
const searchCounts = updateContentSearchIndex({ site, content: value });
console.log(JSON.stringify({ victorian_century_content_site_data: "ok", dataFile: path.relative(root, dataFile), counts: dataIndex.chunks.content.counts, search_counts: searchCounts }, null, 2));

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}
function sha256(content) { return crypto.createHash("sha256").update(content).digest("hex"); }
function writeTextAtomically(file, content) { const temporary = `${file}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temporary, content, "utf8"); try { fs.renameSync(temporary, file); } catch { fs.copyFileSync(temporary, file); fs.rmSync(temporary, { force: true }); } }
