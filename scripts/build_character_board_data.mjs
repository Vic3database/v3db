import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const args = parseArgs(process.argv.slice(2));
const versionDir = path.resolve(root, args["version-dir"] || "site/versions/1.13.9");
const characterReportPath = path.resolve(root, args.characters || "output/historical-characters/historical-characters.json");
const namePoolReportPath = path.resolve(root, args["name-pools"] || "output/culture-names/culture-names.json");

const characterReport = readJson(characterReportPath);
const namePoolReport = readJson(namePoolReportPath);
if (!Array.isArray(characterReport.characters) || !Array.isArray(namePoolReport.cultures)) {
  throw new Error("角色或姓名池审计报告缺少可用数据数组");
}
fs.mkdirSync(versionDir, { recursive: true });

const characterData = {
  historicalCharacters: characterReport.characters,
  historicalCharacterStats: {
    ...characterReport.stats,
    source_game_branch: characterReport.source_game_branch || "",
    generated_at: characterReport.generated_at || "",
  },
};
const namePoolData = {
  namePools: namePoolReport.cultures,
  namePoolStats: {
    ...namePoolReport.stats,
    source_game_branch: namePoolReport.source_game_branch || "",
    generated_at: namePoolReport.generated_at || "",
  },
};
writeChunk(path.join(versionDir, "data-characters.js"), characterData);
writeChunk(path.join(versionDir, "data-name-pools.js"), namePoolData);

const indexPath = path.join(versionDir, "data-index.js");
const index = readWindowValue(indexPath, "VIC3_DATA_INDEX");
index.chunks = index.chunks || {};
index.chunks.character = {
  files: ["data-characters.js"],
  keys: ["historicalCharacters", "historicalCharacterStats"],
  counts: { historicalCharacters: characterData.historicalCharacters.length },
};
index.chunks["name-pool"] = {
  files: ["data-name-pools.js"],
  keys: ["namePools", "namePoolStats"],
  counts: { namePools: namePoolData.namePools.length },
};
for (const locale of index.locales?.supported || ["zh-Hans", "en"]) {
  index.locales.chunks = index.locales.chunks || {};
  index.locales.chunks[locale] = index.locales.chunks[locale] || {};
  index.locales.chunks[locale].character = { files: [], missing: 0 };
  index.locales.chunks[locale]["name-pool"] = { files: [], missing: 0 };
}
writeWindowValue(indexPath, "VIC3_DATA_INDEX", index);

const searchPath = path.join(versionDir, "search-index.js");
if (fs.existsSync(searchPath)) {
  const searchIndex = readWindowValue(searchPath, "VIC3_SEARCH_INDEX");
  const existingIds = new Set((searchIndex.entries || []).map((entry) => entry.id));
  const characterEntries = characterData.historicalCharacters.map((item) => ({
    kind: "character",
    id: `character:${item.key}`,
    key: item.key,
    names: { "zh-Hans": item.name_zh || item.name_en || item.key, en: item.name_en || item.name_zh || item.key },
  }));
  const namePoolEntries = namePoolData.namePools.map((item) => ({
    kind: "namePool",
    id: `namePool:${item.key}`,
    key: item.key,
    names: { "zh-Hans": item.name_zh || item.name_en || item.key, en: item.name_en || item.name_zh || item.key },
  }));
  searchIndex.entries = [
    ...(searchIndex.entries || []),
    ...[...characterEntries, ...namePoolEntries].filter((entry) => !existingIds.has(entry.id)),
  ];
  const searchSource = `window.VIC3_SEARCH_INDEX = ${JSON.stringify(searchIndex)};\n`;
  fs.writeFileSync(searchPath, searchSource, "utf8");
  index.locales.search_index = { ...(index.locales.search_index || {}), sha256: sha256Text(searchSource) };
  writeWindowValue(indexPath, "VIC3_DATA_INDEX", index);
}

console.log(JSON.stringify({
  version_dir: path.relative(root, versionDir),
  source_game_branch: characterReport.source_game_branch || namePoolReport.source_game_branch || "",
  historical_characters: characterData.historicalCharacters.length,
  name_pools: namePoolData.namePools.length,
}, null, 2));

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    result[arg.slice(2)] = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : true;
  }
  return result;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeChunk(file, value) {
  fs.writeFileSync(file, `window.VIC3_DATA_CHUNK = ${JSON.stringify(value)};\n`, "utf8");
}

function readWindowValue(file, name) {
  const source = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const prefix = `window.${name} = `;
  if (!source.startsWith(prefix)) throw new Error(`无法读取 ${file} 中的 ${name}`);
  return JSON.parse(source.slice(prefix.length).replace(/;\s*$/, ""));
}

function writeWindowValue(file, name, value) {
  fs.writeFileSync(file, `window.${name} = ${JSON.stringify(value)};\n`, "utf8");
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}
