import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const args = parseArgs(process.argv.slice(2));
const database = path.resolve(args.database);
const site = path.resolve(args.site);
const technologyFile = path.join(site, "data-technologies.js");
const parties = readJson(path.join(database, "parties.json"));
const zh = readJson(path.join(database, "locales", "zh-Hans.json"));
const en = readJson(path.join(database, "locales", "en.json"));
const technologiesChunk = readGlobal(technologyFile, "VIC3_DATA_CHUNK");
const partiesByTechnology = new Map();
for (const party of parties) {
  const nameMessage = party.loc?.name || "";
  const nameZh = zh[nameMessage] || party.name_zh || party.key;
  const nameEn = en[nameMessage] || party.name_en || party.key;
  for (const technology of party.unlocking_technologies || []) {
    const list = partiesByTechnology.get(technology.key) || [];
    list.push({
      key: party.key,
      loc: { name: `technology:${technology.key}:0:${party.key}.name` },
      icon_path: party.icon?.site_path || "",
      nameZh,
      nameEn,
    });
    partiesByTechnology.set(technology.key, list);
  }
}
const technologies = (technologiesChunk.technologies || []).map((technology) => {
  const references = { ...(technology.references || {}) };
  const partiesForTechnology = partiesByTechnology.get(technology.key) || [];
  if (partiesForTechnology.length) references.parties = partiesForTechnology.map(({ nameZh, nameEn, ...party }) => party);
  else delete references.parties;
  return { ...technology, references };
});
writeTextAtomically(technologyFile, `window.VIC3_DATA_CHUNK = ${JSON.stringify({ ...technologiesChunk, technologies })};\n`);
for (const locale of ["zh-Hans", "en"]) {
  const file = path.join(site, `locale-technologies.${locale}.js`);
  const chunks = readGlobal(file, "VIC3_LOCALE_CHUNKS");
  const id = Object.keys(chunks).find((key) => chunks[key]?.locale === locale);
  if (!id) throw new Error(`Missing technology locale chunk: ${file}`);
  const messages = { ...(chunks[id].messages || {}) };
  for (const [technologyKey, rows] of partiesByTechnology) {
    for (const row of rows) messages[row.loc.name] = locale === "zh-Hans" ? row.nameZh : row.nameEn;
  }
  const source = `window.VIC3_LOCALE_CHUNKS = window.VIC3_LOCALE_CHUNKS || {};\nwindow.VIC3_LOCALE_CHUNKS[${JSON.stringify(id)}] = ${JSON.stringify({ locale, messages })};\n`;
  writeTextAtomically(file, source);
}
console.log(JSON.stringify({ technology_party_references: "ok", parties: parties.length, linkedTechnologies: partiesByTechnology.size, site }, null, 2));

function parseArgs(values) {
  const parsed = { database: "", site: "" };
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] === "--database" || values[i] === "--site") parsed[values[i].slice(2)] = values[++i] || "";
    else throw new Error(`Unknown argument: ${values[i]}`);
  }
  if (!parsed.database || !parsed.site) throw new Error("Usage: node scripts/build_technology_party_references.mjs --database <dir> --site <dir>");
  return parsed;
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")); }
function readGlobal(file, globalName) { const sandbox = { window: {} }; vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file }); return sandbox.window[globalName]; }
function writeTextAtomically(file, content) { const temp = `${file}.${process.pid}.${Date.now()}.tmp`; fs.writeFileSync(temp, content, "utf8"); try { fs.renameSync(temp, file); } catch { fs.copyFileSync(temp, file); fs.rmSync(temp, { force: true }); } }
