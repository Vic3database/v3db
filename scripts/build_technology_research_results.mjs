import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const args = parseArgs(process.argv.slice(2));
const database = path.resolve(args.database);
const site = path.resolve(args.site);

const technologiesFile = path.join(site, "data-technologies.js");
const dataIndexFile = path.join(site, "data-index.js");
const technologies = readGlobal(technologiesFile, "VIC3_DATA_CHUNK").technologies || [];
const ideologies = readJson(path.join(database, "ideologies.json"));
const contentIndex = readJson(path.join(database, "content-index.json"));
const journals = readJson(path.join(database, contentIndex.files.journal_entries));
const events = readJson(path.join(database, contentIndex.files.events));
const databaseMessages = Object.fromEntries(["zh-Hans", "en"].map((locale) => [
  locale,
  readJson(path.join(database, "locales", `${locale}.json`)),
]));
const localeFiles = Object.fromEntries(["zh-Hans", "en"].map((locale) => [
  locale,
  path.join(site, `locale-technologies.${locale}.js`),
]));
const localeChunks = Object.fromEntries(Object.entries(localeFiles).map(([locale, file]) => {
  const chunks = readGlobal(file, "VIC3_LOCALE_CHUNKS");
  const id = Object.keys(chunks).find((key) => chunks[key]?.locale === locale);
  if (!id) throw new Error(`Missing technology locale chunk for ${locale}`);
  return [locale, { id, messages: { ...(chunks[id].messages || {}) } }];
}));
const ideologyByKey = new Map(ideologies.map((item) => [item.key, item]));
const journalByKey = new Map(journals.flatMap((item) => [[item.id, item], [item.script_key, item]].filter(([key]) => key)));
const eventByKey = new Map(events.flatMap((item) => [[item.id, item], [item.script_key, item]].filter(([key]) => key)));

let resultCount = 0;
const nextTechnologies = technologies.map((technology) => {
  const raw = String(technology.on_researched || "");
  const results = collectIdeologyResults(raw);
  if (/\bcreate_political_movement\s*=/.test(raw)) results.push({ kind: "political-movement" });
  if (raw.includes("add_involved_country")) {
    for (const match of raw.matchAll(/\bje:([A-Za-z0-9_.-]+)/g)) {
      const row = journalByKey.get(match[1]);
      if (row) results.push(localizedContentResult(technology.key, "journal", match[1], row, results.length));
    }
  }
  for (const match of raw.matchAll(/\btrigger_event\s*=\s*\{[\s\S]*?\bid\s*=\s*([A-Za-z0-9_.-]+)/g)) {
    const row = eventByKey.get(match[1]);
    if (row) results.push(localizedContentResult(technology.key, "event", match[1], row, results.length));
  }
  const seen = new Set();
  const researchResults = results.filter((result) => {
    const id = [result.kind, result.key || "", result.from?.key || "", result.to?.key || ""].join(":");
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  resultCount += researchResults.length;
  const { research_results: _old, ...rest } = technology;
  return researchResults.length ? { ...rest, research_results: researchResults } : rest;
});

writeTextAtomically(technologiesFile, `window.VIC3_DATA_CHUNK = ${JSON.stringify({ technologies: nextTechnologies, technologyEras: readGlobal(technologiesFile, "VIC3_DATA_CHUNK").technologyEras || [] })};\n`);

const hashes = {};
for (const [locale, file] of Object.entries(localeFiles)) {
  const chunk = localeChunks[locale];
  for (const technology of nextTechnologies) {
    for (const result of technology.research_results || []) {
      for (const ref of [result, result.from, result.to].filter(Boolean)) {
        const message = ref.loc?.name;
        if (!message || Object.hasOwn(chunk.messages, message)) continue;
        chunk.messages[message] = databaseMessages[locale]?.[message] || "";
      }
    }
  }
  const source = `window.VIC3_LOCALE_CHUNKS = window.VIC3_LOCALE_CHUNKS || {};\nwindow.VIC3_LOCALE_CHUNKS[${JSON.stringify(chunk.id)}] = ${JSON.stringify({ locale, messages: chunk.messages })};\n`;
  writeTextAtomically(file, source);
  hashes[locale] = sha256(source);
}

const dataIndex = readGlobal(dataIndexFile, "VIC3_DATA_INDEX");
for (const locale of ["zh-Hans", "en"]) {
  const files = dataIndex.locales?.chunks?.[locale]?.technology?.files || [];
  const entry = files.find((item) => item.path === path.basename(localeFiles[locale]));
  if (entry) entry.sha256 = hashes[locale];
}
writeTextAtomically(dataIndexFile, `window.VIC3_DATA_INDEX = ${JSON.stringify(dataIndex)};\n`);

console.log(JSON.stringify({ technology_research_results: "ok", technologies: nextTechnologies.length, results: resultCount, site }, null, 2));

function collectIdeologyResults(raw) {
  const results = [];
  let pendingRemoval = null;
  for (const match of raw.matchAll(/\b(remove_ideology|add_ideology|set_ideology|set_core_ideology)\s*=\s*(?:ideology:)?([A-Za-z0-9_]+)/g)) {
    const action = match[1];
    const ideology = ideologyByKey.get(match[2]);
    if (!ideology) continue;
    if (action === "remove_ideology") {
      pendingRemoval = ideology;
    } else if (action === "add_ideology" && pendingRemoval) {
      results.push({ kind: "ideology", from: ideologyRef(pendingRemoval), to: ideologyRef(ideology) });
      pendingRemoval = null;
    } else {
      results.push({ kind: "ideology", to: ideologyRef(ideology) });
      pendingRemoval = null;
    }
  }
  return results;
}

function ideologyRef(ideology) {
  return { key: ideology.key, loc: { name: ideology.loc?.name || `ideology:${ideology.key}.name` } };
}

function localizedContentResult(technologyKey, kind, key, row, index) {
  const message = `technology:${technologyKey}:researchResult:${index}.name`;
  for (const locale of ["zh-Hans", "en"]) {
    const localeKey = locale === "zh-Hans" ? "zhHans" : locale;
    const field = kind === "journal" ? "name" : "title";
    const value = row.locales?.[localeKey]?.[field] || row.locales?.en?.[field] || "";
    localeChunks[locale].messages[message] = value;
  }
  return { kind, key, loc: { name: message } };
}

function parseArgs(values) {
  const parsed = { database: "", site: "" };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--database" || value === "--site") {
      parsed[value.slice(2)] = values[++index] || "";
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  if (!parsed.database || !parsed.site) throw new Error("Usage: node scripts/build_technology_research_results.mjs --database <dir> --site <dir>");
  return parsed;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function readGlobal(file, globalName) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox.window[globalName];
}

function writeTextAtomically(file, content) {
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, content, "utf8");
  try { fs.renameSync(temporary, file); } catch { fs.copyFileSync(temporary, file); fs.rmSync(temporary, { force: true }); }
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}
