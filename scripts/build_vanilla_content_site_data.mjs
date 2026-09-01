import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { buildContentByCountry } from "./content_country_scope.mjs";
import { updateContentSearchIndex } from "./content_search_index.mjs";
import { decisionGroupName } from "./decision_group_names.mjs";
import { eventGroupNames } from "./event_group_names.mjs";

const root = process.cwd();
const args = parseArgs(process.argv.slice(2));
const version = args.version || process.env.VICTORIA3_VERSION || "1.13.11";
const database = path.resolve(args.database || path.join(root, "database", `vic3_${version}`));
const site = path.resolve(args.site || path.join(root, "site", "versions", version));

runBuilder("build_vanilla_content_country_data.mjs", ["--version", version, "--database", database]);
runBuilder("build_event_site_data.mjs", ["--version", version, "--database", database, "--site", site]);

const rows = (name) => JSON.parse(fs.readFileSync(path.join(database, `${name}.json`), "utf8").replace(/^\uFEFF/, ""));
const gameRows = (name) => rows(name).filter((row) => row.content_class === "game").map(withVanillaSource);
const value = {
  journalEntries: gameRows("journal_entries"),
  journalEntryGroups: gameRows("journal_entry_groups"),
  contentEvents: gameRows("events"),
  decisions: gameRows("decisions"),
};
for (const row of value.contentEvents) row.group_locales = eventGroupNames[row.namespace] || { zhHans: row.namespace || "", en: row.namespace || "" };
for (const row of value.decisions) row.group_locales = { zhHans: decisionGroupName(row.source_file, "zh-Hans"), en: decisionGroupName(row.source_file, "en") };

const countries = rows("countries");
const validCountryTags = countries.map((country) => country.tag || country.id).filter(Boolean);
value.contentByCountry = buildContentByCountry({
  journals: value.journalEntries,
  events: value.contentEvents,
  decisions: value.decisions,
}, validCountryTags);

fs.mkdirSync(site, { recursive: true });
const dataFile = path.join(site, "data-content.js");
fs.writeFileSync(dataFile, `window.VIC3_DATA_CHUNK = ${JSON.stringify(value)};\n`, "utf8");

const databaseIndex = JSON.parse(fs.readFileSync(path.join(database, "content-index.json"), "utf8").replace(/^\uFEFF/, ""));
const dataIndexFile = path.join(site, "data-index.js");
const dataIndex = readGlobal(dataIndexFile, "VIC3_DATA_INDEX");
dataIndex.meta.content_dataset = databaseIndex.dataset;
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

console.log(JSON.stringify({
  vanilla_content_site_data: "ok",
  version,
  data_file: path.relative(root, dataFile),
  counts: dataIndex.chunks.content.counts,
  search_counts: searchCounts,
}, null, 2));

function withVanillaSource(row) {
  return {
    ...row,
    sources: ["vanilla"],
    source_files: [{ source: "vanilla", file: row.source_file || "", line: Number(row.source_line || 0) }],
  };
}

function runBuilder(name, builderArgs) {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", name), ...builderArgs], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${name} failed:\n${result.stdout}\n${result.stderr}`.trim());
}

function readGlobal(file, name) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox.window[name];
}

function sha256(content) { return crypto.createHash("sha256").update(content).digest("hex"); }
function writeTextAtomically(file, content) { const temporary = `${file}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temporary, content, "utf8"); try { fs.renameSync(temporary, file); } catch { fs.copyFileSync(temporary, file); fs.rmSync(temporary, { force: true }); } }

function parseArgs(values) {
  const parsed = { version: "", database: "", site: "" };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (["--version", "--database", "--site"].includes(value)) {
      const key = value.slice(2);
      parsed[key] = values[index + 1] || "";
      if (!parsed[key]) throw new Error(`Missing value for ${value}`);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return parsed;
}
