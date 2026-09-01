import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { buildEventKindContext, classifyEventEvidence } from "./event_kind.mjs";
import { extractModifierNames, parseGameLocalization, parseModifierDefinitions, resolveGameLocalizationText } from "./event_effects.mjs";
import { eventGroupNames } from "./event_group_names.mjs";
import { classifyEventTags } from "./event_tags.mjs";

const root = process.cwd();
const args = parseArgs(process.argv.slice(2));
const version = args.version || "1.13.9";
const databasePath = path.resolve(args.database || path.join(root, "database", `vic3_${version}`));
const versionPath = path.resolve(args.site || path.join(root, "site", "versions", version));
const sourceFile = path.join(databasePath, "events.json");
const journalSourceFile = path.join(databasePath, "journal_entries.json");
const databaseIndexFile = path.join(databasePath, "index.json");
const databaseIndex = JSON.parse(fs.readFileSync(databaseIndexFile, "utf8").replace(/^\uFEFF/, ""));
const gameDataPath = databaseIndex.source_paths?.game_data || "";
const modifierDefinitions = loadModifierDefinitions(gameDataPath);
const modifierLabels = loadModifierLabels(gameDataPath);
const officialModifierKeys = new Set(modifierLabels["zh-Hans"].keys());
if (!fs.existsSync(sourceFile)) throw new Error(`找不到事件审计数据：${sourceFile}`);

const sourceEvents = JSON.parse(fs.readFileSync(sourceFile, "utf8"))
  .filter((event) => event.content_class === "game");
const sourceJournals = JSON.parse(fs.readFileSync(journalSourceFile, "utf8"))
  .filter((journal) => journal.content_class === "game");
const eventKindContext = buildEventKindContext(sourceEvents, sourceJournals);
const events = sourceEvents
  .map((event) => toEvent(event, eventKindContext))
  .sort((left, right) => left.key.localeCompare(right.key, undefined, { numeric: true }));
const expectedEvents = version === "1.13.9" ? 2236 : null;
if (expectedEvents !== null && events.length !== expectedEvents) throw new Error(`${version} 游戏事件数量应为 ${expectedEvents}，实际为 ${events.length}`);
if (!events.some((event) => event.key === "1848.1")) throw new Error("缺少 1848.1");

const eventGroups = [...new Set(events.map((event) => event.namespace || String(event.key || "").split(".")[0]).filter(Boolean))]
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
for (const namespace of eventGroups) {
  if (!eventGroupNames[namespace]) throw new Error(`Missing event group name: ${namespace}`);
}

const localeFiles = {
  "zh-Hans": path.join(versionPath, "locale-events.zh-Hans.js"),
  en: path.join(versionPath, "locale-events.en.js"),
};
const dataFile = path.join(versionPath, "data-events.js");
writeDataChunk(dataFile, { events, eventGroups });
for (const locale of Object.keys(localeFiles)) writeLocaleChunk(localeFiles[locale], locale, buildLocaleMessages(events, locale));
updateDataIndex({ dataFile, localeFiles });

console.log(JSON.stringify({ version, source: path.relative(root, sourceFile), events: events.length, options: events.reduce((total, event) => total + event.options.length, 0), official_modifier_terms: officialModifierKeys.size }, null, 2));

function toEvent(source, eventKindContext) {
  const options = (source.options || []).map((option) => {
    const script = option.raw || "";
    const modifiers = extractModifierNames(script).map((name) => ({
      name,
      effects: (modifierDefinitions.get(name) || []).map((effect) => ({
        ...effect,
        ...(officialModifierKeys.has(effect.key) ? { loc: `modifier:${effect.key}.name` } : {}),
      })),
    }));
    return { name_key: option.name_key || "", default_option: Boolean(option.default_option), script, modifiers };
  });
  const kindEvidence = source.content_kind && Array.isArray(source.country_scope)
    ? { kind: source.content_kind, countries: source.country_scope }
    : classifyEventEvidence(source, eventKindContext);
  return {
    id: `event:${source.id}`,
    key: source.id,
    script_key: source.script_key || source.id,
    namespace: source.namespace || "",
    event_type: source.event_type || "",
    placement: source.placement || "",
    title_key: source.title_key || "",
    desc_key: source.desc_key || "",
    flavor_key: source.flavor_key || "",
    event_kind: kindEvidence.kind,
    country_scope: kindEvidence.countries,
    tags: classifyEventTags(source),
    icon: source.icon || "",
    duration: source.duration || "",
    hidden: Boolean(source.hidden),
    orphan: Boolean(source.orphan),
    event_image: source.event_image || { video: "", texture: "" },
    source_file: source.source_file || "",
    source_line: source.source_line || 0,
    script: { trigger: source.trigger_raw || "", immediate: source.immediate_raw || "" },
    options,
    triggered_event_ids: source.triggered_event_ids || [],
    loc: { title: `event:${source.id}.title`, desc: `event:${source.id}.desc`, flavor: `event:${source.id}.flavor`, options: Object.fromEntries(options.map((option, index) => [option.name_key || `option_${index + 1}`, `event:${source.id}.option.${index + 1}`])) },
    locales: source.locales || {},
  };
}

function loadModifierDefinitions(gameDataPath) {
  if (!gameDataPath || !fs.existsSync(gameDataPath)) return new Map();
  const folder = path.join(gameDataPath, "common", "static_modifiers");
  if (!fs.existsSync(folder)) return new Map();
  const files = walkFiles(folder).filter((file) => file.endsWith(".txt"));
  return parseModifierDefinitions(files.map((file) => fs.readFileSync(file, "utf8")).join("\n"));
}

function loadModifierLabels(gameDataPath) {
  const folders = { "zh-Hans": "simp_chinese", en: "english" };
  return Object.fromEntries(Object.entries(folders).map(([locale, folder]) => [locale, loadModifierLabelsForLocale(gameDataPath, folder)]));
}

function loadModifierLabelsForLocale(gameDataPath, folder) {
  const localizationFolder = path.join(gameDataPath, "localization", folder);
  const modifierFile = path.join(localizationFolder, `modifiers_l_${folder}.yml`);
  if (!fs.existsSync(modifierFile)) throw new Error(`Missing official modifier localization: ${modifierFile}`);
  const messages = new Map();
  for (const file of walkFiles(localizationFolder).filter((item) => item.endsWith(".yml"))) {
    for (const [key, value] of parseGameLocalization(fs.readFileSync(file, "utf8"))) messages.set(key, value);
  }
  const modifierMessages = parseGameLocalization(fs.readFileSync(modifierFile, "utf8"));
  return new Map([...modifierMessages].map(([key, value]) => [key, resolveGameLocalizationText(value, messages)]));
}

function walkFiles(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(folder, entry.name);
    return entry.isDirectory() ? walkFiles(file) : [file];
  });
}

function buildLocaleMessages(rows, locale) {
  const sourceLocale = locale === "zh-Hans" ? "zhHans" : locale;
  const messages = {};
  for (const event of rows) {
    const values = event.locales?.[sourceLocale] || {};
    messages[event.loc.title] = values.title || event.title_key || event.key;
    messages[event.loc.desc] = values.desc || event.desc_key || "";
    messages[event.loc.flavor] = values.flavor || event.flavor_key || "";
    event.options.forEach((option, index) => { messages[event.loc.options[option.name_key || `option_${index + 1}`]] = values.options?.[option.name_key] || option.name_key || ""; });
    event.options.flatMap((option) => option.modifiers || []).flatMap((modifier) => modifier.effects || []).forEach((effect) => {
      if (effect.loc) messages[effect.loc] = modifierLabels[locale].get(effect.key) || modifierLabels["zh-Hans"].get(effect.key);
    });
  }
  for (const group of eventGroups) messages[`event-group:${group}`] = eventGroupNames[group][locale === "zh-Hans" ? "zhHans" : "en"];
  return messages;
}

function writeDataChunk(file, value) { fs.writeFileSync(file, `window.VIC3_DATA_CHUNK = ${JSON.stringify(value)};\n`, "utf8"); }
function writeLocaleChunk(file, locale, messages) { const id = `${locale}:event:locale-events`; fs.writeFileSync(file, `window.VIC3_LOCALE_CHUNKS = window.VIC3_LOCALE_CHUNKS || {};\nwindow.VIC3_LOCALE_CHUNKS[${JSON.stringify(id)}] = ${JSON.stringify({ locale, messages })};\n`, "utf8"); }
function updateDataIndex({ dataFile, localeFiles }) { const indexFile = path.join(versionPath, "data-index.js"); const sandbox = { window: {} }; vm.runInNewContext(fs.readFileSync(indexFile, "utf8"), sandbox, { filename: indexFile }); const index = sandbox.window.VIC3_DATA_INDEX; index.chunks.event = { files: [path.basename(dataFile)], keys: ["events", "eventGroups"], counts: { events: events.length, groups: eventGroups.length } }; for (const [locale, file] of Object.entries(localeFiles)) { const bucket = index.locales.chunks[locale] || (index.locales.chunks[locale] = {}); bucket.event = { files: [{ id: `${locale}:event:locale-events`, path: path.basename(file), sha256: sha256(fs.readFileSync(file)), missing: 0 }], missing: 0 }; } writeTextAtomically(indexFile, `window.VIC3_DATA_INDEX = ${JSON.stringify(index)};\n`); }
function sha256(content) { return crypto.createHash("sha256").update(content).digest("hex"); }
function writeTextAtomically(file, content) { const temporary = `${file}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temporary, content, "utf8"); try { fs.renameSync(temporary, file); } catch { fs.copyFileSync(temporary, file); fs.rmSync(temporary, { force: true }); } }

function parseArgs(values) {
  const parsed = { version: "", database: "", site: "" };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--version" || value === "--database" || value === "--site") {
      const key = value.slice(2);
      parsed[key] = values[index + 1] || "";
      if (!parsed[key]) throw new Error(`Missing value for ${value}`);
      index += 1;
    } else if (value === "--help" || value === "-h") {
      console.log("Usage: node scripts/build_event_site_data.mjs [--version <version>] [--database <dir>] [--site <dir>]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return parsed;
}
