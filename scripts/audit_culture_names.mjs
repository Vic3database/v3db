import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_GAME_PATH = "D:\\SteamLibrary\\steamapps\\common\\Victoria 3";
const DEFAULT_OUT_DIR = "output/culture-names";
const NAME_POOL_KEYS = [
  "male_common_first_names",
  "female_common_first_names",
  "male_noble_first_names",
  "female_noble_first_names",
  "male_regal_first_names",
  "female_regal_first_names",
  "common_last_names",
  "noble_last_names",
  "regal_last_names",
];
const POOL_LABELS_ZH = {
  male_common_first_names: "普通男性名",
  female_common_first_names: "普通女性名",
  male_noble_first_names: "贵族男性名",
  female_noble_first_names: "贵族女性名",
  male_regal_first_names: "君主男性名",
  female_regal_first_names: "君主女性名",
  common_last_names: "普通姓氏",
  noble_last_names: "贵族姓氏",
  regal_last_names: "君主姓氏",
};

const args = parseArgs(process.argv.slice(2));
const gamePath = path.resolve(args["game-path"] || DEFAULT_GAME_PATH);
const gameDir = path.join(gamePath, "game");
const outDir = path.resolve(args.out || DEFAULT_OUT_DIR);
const cultureFile = path.join(gameDir, "common", "cultures", "00_cultures.txt");
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

assertDirectory(gameDir, "游戏目录");
assertFile(cultureFile, "文化定义文件");
const localizationZh = loadLocalization(path.join(gameDir, "localization", "simp_chinese"));
const localizationEn = loadLocalization(path.join(gameDir, "localization", "english"));
const historicalCharacters = loadHistoricalCharacters(gameDir, localizationZh, localizationEn, args["historical-report"]);
const cultures = collectCultures(cultureFile, gameDir, localizationZh, localizationEn, historicalCharacters);
const report = buildReport(gamePath, cultureFile, cultures, historicalCharacters);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "culture-names.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(outDir, "culture-names.md"), buildMarkdown(report), "utf8");
console.log(JSON.stringify(report.stats));
console.log(`已写入：${outDir}`);

function buildReport(sourceGamePath, sourceFile, cultures, historicalCharacters) {
  let totalEntries = 0;
  let duplicateNameEntries = 0;
  let invalidNamePoolEntries = 0;
  let emptyNamePools = 0;
  let localizationMissingZh = 0;
  let localizationMissingEn = 0;
  for (const culture of cultures) {
    for (const pool of Object.values(culture.name_pools)) {
      totalEntries += pool.count;
      duplicateNameEntries += pool.duplicate_count;
      invalidNamePoolEntries += pool.invalid_count;
      emptyNamePools += pool.count === 0 ? 1 : 0;
      localizationMissingZh += pool.entries.filter((entry) => !entry.name_zh_found).length;
      localizationMissingEn += pool.entries.filter((entry) => !entry.name_en_found).length;
    }
  }
  const historicalCharacterCultureKeys = new Set(historicalCharacters.map((character) => normalizeCultureKey(character.culture_key)).filter(Boolean));
  return {
    schema_version: 1,
    source_game_path: sourceGamePath,
    source_game_branch: readText(path.join(sourceGamePath, "caligula_branch.txt")).trim(),
    generated_at: new Date().toISOString(),
    scope: "common/cultures/00_cultures.txt name pools, with historical character references by culture",
    source_files: [path.relative(path.join(sourceGamePath, "game"), sourceFile).replaceAll("\\", "/")],
    stats: {
      cultures: cultures.length,
      name_pool_entries: totalEntries,
      empty_name_pools: emptyNamePools,
      duplicate_name_entries: duplicateNameEntries,
      invalid_name_pool_entries: invalidNamePoolEntries,
      localization_missing_zh: localizationMissingZh,
      localization_missing_en: localizationMissingEn,
      historical_character_templates: historicalCharacters.length,
      historical_characters_with_culture: historicalCharacters.filter((character) => Boolean(character.culture_key)).length,
      historical_characters_with_specific_culture: historicalCharacters.filter((character) => normalizeCultureKey(character.culture_key)).length,
      historical_characters_without_culture: historicalCharacters.filter((character) => !character.culture_key).length,
      historical_culture_keys_without_definition: [...historicalCharacterCultureKeys].filter((key) => !cultures.some((culture) => culture.key === key)).length,
      historical_culture_keys_with_primary_culture: historicalCharacters.filter((character) => character.culture_key === "primary_culture").length,
    },
    name_pool_fields: NAME_POOL_KEYS.map((key) => ({ key, name_zh: POOL_LABELS_ZH[key] })),
    cultures,
  };
}

function collectCultures(file, gameDir, localizationZh, localizationEn, historicalCharacters) {
  const source = readText(file);
  const relativeFile = path.relative(gameDir, file).replaceAll("\\", "/");
  const charactersByCulture = new Map();
  for (const character of historicalCharacters) {
    const cultureKey = normalizeCultureKey(character.culture_key);
    if (!cultureKey) continue;
    const rows = charactersByCulture.get(cultureKey) || [];
    rows.push({
      key: character.key,
      name_zh: character.name_zh,
      name_en: character.name_en,
      culture_key_source: character.culture_key || "",
      culture_key: cultureKey,
      female: Boolean(character.female),
      character_role: character.character_role || "",
      character_role_name_zh: character.character_role_name_zh || "",
      in_starting_history: Boolean(character.in_starting_history),
      source_file: character.source_file || "",
    });
    charactersByCulture.set(cultureKey, rows);
  }
  return extractTopLevelBlocks(source).map((block) => {
    const namePools = Object.fromEntries(NAME_POOL_KEYS.map((key) => [
      key,
      buildNamePool(directItems(block.body, key), localizationZh, localizationEn),
    ]));
    const historical = (charactersByCulture.get(block.key) || []).sort((left, right) => left.key.localeCompare(right.key));
    return {
      id: `culture:${block.key}`,
      key: block.key,
      name_zh: localizeName(block.key, localizationZh),
      name_en: localizeName(block.key, localizationEn),
      religion_key: scalarValue(block.body, "religion"),
      heritage_key: scalarValue(block.body, "heritage"),
      language_key: scalarValue(block.body, "language"),
      name_pools: namePools,
      name_entry_count: Object.values(namePools).reduce((sum, pool) => sum + pool.count, 0),
      historical_characters: historical,
      source_file: relativeFile,
    };
  }).sort((left, right) => left.key.localeCompare(right.key));
}

function buildNamePool(keys, localizationZh, localizationEn) {
  const entries = keys.map((key) => ({
    key,
    name_zh: localizeName(key, localizationZh),
    name_en: localizeName(key, localizationEn),
    name_zh_found: localizationZh.has(key),
    name_en_found: localizationEn.has(key),
  }));
  const uniqueKeys = new Set(keys);
  return {
    count: entries.length,
    duplicate_count: entries.length - uniqueKeys.size,
    invalid_count: keys.filter((key) => !key || /[\s#{}]/.test(key)).length,
    entries,
  };
}

function loadHistoricalCharacters(gameDir, localizationZh, localizationEn, reportArg) {
  const reportPath = path.resolve(reportArg || path.join(workspaceRoot, "output", "historical-characters", "historical-characters.json"));
  if (fs.existsSync(reportPath)) {
    const report = JSON.parse(readText(reportPath));
    if (Array.isArray(report.characters)) return report.characters;
  }
  const templateDir = path.join(gameDir, "common", "character_templates");
  if (!fs.statSync(templateDir, { throwIfNoEntry: false })?.isDirectory()) return [];
  const rows = [];
  for (const file of listFiles(templateDir, ".txt")) {
    for (const block of extractTopLevelBlocks(readText(file))) {
      if (!hasYesValue(block.body, "historical")) continue;
      const firstNameKey = scalarValue(block.body, "first_name");
      const lastNameKey = scalarValue(block.body, "last_name");
      const roleKey = scalarValue(block.body, "role");
      rows.push({
        key: block.key,
        name_zh: displayName(firstNameKey, lastNameKey, localizationZh),
        name_en: displayName(firstNameKey, lastNameKey, localizationEn),
        female: hasYesValue(block.body, "female"),
        character_role: roleKey,
        character_role_name_zh: localizeName(roleKey, localizationZh),
        culture_key: scalarValue(block.body, "culture"),
        in_starting_history: false,
        source_file: path.relative(gameDir, file).replaceAll("\\", "/"),
      });
    }
  }
  return rows.sort((left, right) => left.key.localeCompare(right.key));
}

function buildMarkdown(report) {
  const { stats } = report;
  const lines = [
    "# Victoria 3 文化姓名池",
    "",
    `- 游戏分支：\`${report.source_game_branch}\``,
    `- 生成时间：${report.generated_at}`,
    `- 文化数量：${stats.cultures}`,
    `- 姓名池条目：${stats.name_pool_entries}`,
    `- 重复姓名条目：${stats.duplicate_name_entries}`,
    `- 无效姓名条目：${stats.invalid_name_pool_entries}`,
    `- 中文本地化缺失：${stats.localization_missing_zh}`,
    `- 英文本地化缺失：${stats.localization_missing_en}`,
    `- 史实角色模板：${stats.historical_character_templates}`,
    "",
    "## 文化索引",
    "",
    "| 文化 | 文化键 | 传承 | 语言 | 姓名条目 | 史实角色 |",
    "| --- | --- | --- | --- | ---: | ---: |",
  ];
  for (const culture of report.cultures) {
    lines.push(`| ${escapeCell(displayPair(culture.name_zh, culture.name_en))} | \`${culture.key}\` | \`${escapeCell(culture.heritage_key)}\` | \`${escapeCell(culture.language_key)}\` | ${culture.name_entry_count} | ${culture.historical_characters.length} |`);
  }
  lines.push("", "## 文化姓名详情", "");
  for (const culture of report.cultures) {
    lines.push(`### ${escapeHeading(displayPair(culture.name_zh, culture.name_en))}（\`${culture.key}\`）`, "");
    lines.push(`宗教：\`${culture.religion_key || ""}\`；传承：\`${culture.heritage_key || ""}\`；语言：\`${culture.language_key || ""}\`。`, "");
    for (const poolKey of NAME_POOL_KEYS) {
      const pool = culture.name_pools[poolKey];
      const names = pool.entries.map((entry) => displayPair(entry.name_zh, entry.name_en)).join("、");
      lines.push(`- ${POOL_LABELS_ZH[poolKey]}（${pool.count}）：${escapeCell(names || "（空）")}`);
    }
    lines.push("", "史实角色：");
    if (!culture.historical_characters.length) lines.push("- 无");
    else for (const character of culture.historical_characters) {
      const role = character.character_role_name_zh || character.character_role || "未指定角色";
      lines.push(`- ${escapeCell(displayPair(character.name_zh, character.name_en))}（\`${character.key}\`，${escapeCell(role)}）`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function displayPair(zh, en) {
  if (!en || zh === en) return zh || en || "未本地化";
  return `${zh} / ${en}`;
}

function normalizeCultureKey(value) {
  if (!value || value === "primary_culture") return "";
  return value.startsWith("cu:") ? value.slice(3) : value;
}

function displayName(firstNameKey, lastNameKey, localization) {
  return [firstNameKey, lastNameKey].map((key) => localizeName(key, localization)).filter(Boolean).join(" ");
}

function localizeName(key, localization) {
  return key ? (localization.get(key) || key.replaceAll("_", " ")) : "";
}

function loadLocalization(directory) {
  const localization = new Map();
  for (const file of listFiles(directory, ".yml")) {
    for (const line of readText(file).split(/\r?\n/)) {
      const match = line.match(/^\s*([^#\s:]+):(?:\d+)?\s*"((?:\\.|[^"\\])*)"/);
      if (match) localization.set(match[1], match[2].replace(/\\"/g, '"'));
    }
  }
  return localization;
}

function extractTopLevelBlocks(source) {
  const blocks = [];
  let index = 0;
  let depth = 0;
  while (index < source.length) {
    if (source[index] === "#") { index = skipComment(source, index); continue; }
    if (source[index] === '"') { index = skipQuote(source, index); continue; }
    if (source[index] === "{") { depth += 1; index += 1; continue; }
    if (source[index] === "}") { depth = Math.max(0, depth - 1); index += 1; continue; }
    if (depth !== 0 || !isKeyStart(source[index])) { index += 1; continue; }
    const start = index;
    while (index < source.length && isKeyCharacter(source[index])) index += 1;
    const key = source.slice(start, index);
    const afterKey = skipWhitespaceAndComments(source, index);
    if (source[afterKey] !== "=") continue;
    const opening = skipWhitespaceAndComments(source, afterKey + 1);
    if (source[opening] !== "{") continue;
    const close = findMatchingBrace(source, opening);
    if (close < 0) throw new Error(`未闭合定义：${key}`);
    blocks.push({ key, body: source.slice(opening + 1, close) });
    index = close + 1;
  }
  return blocks;
}

function directItems(body, key) {
  const block = directBlock(body, key);
  if (!block) return [];
  const items = [];
  let index = 0;
  while (index < block.length) {
    index = skipWhitespaceAndComments(block, index);
    if (index >= block.length) break;
    if (block[index] === '"') {
      const end = skipQuote(block, index);
      items.push(block.slice(index + 1, end - 1));
      index = end;
      continue;
    }
    const start = index;
    while (index < block.length && !/\s/.test(block[index]) && !["#", "{", "}"].includes(block[index])) index += 1;
    if (index > start) items.push(block.slice(start, index));
    else index += 1;
  }
  return items;
}

function directBlock(body, key) {
  const match = new RegExp(`(?:^|\\n)\\s*${escapeRegExp(key)}\\s*=\\s*\\{`, "m").exec(body);
  if (!match) return "";
  const opening = match.index + match[0].lastIndexOf("{");
  const close = findMatchingBrace(body, opening);
  return close < 0 ? "" : body.slice(opening + 1, close);
}

function scalarValue(body, key) {
  const match = new RegExp(`(?:^|\\n)\\s*${escapeRegExp(key)}\\s*=\\s*("[^"]+"|[^\\s#{}]+)`, "m").exec(body);
  return match ? match[1].replaceAll('"', "") : "";
}

function hasYesValue(body, key) {
  return new RegExp(`(?:^|\\n)\\s*${escapeRegExp(key)}\\s*=\\s*yes(?:\\s|#|$)`, "m").test(body);
}

function findMatchingBrace(source, start) {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "#") { index = skipComment(source, index) - 1; continue; }
    if (source[index] === '"') { index = skipQuote(source, index) - 1; continue; }
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return index;
  }
  return -1;
}

function skipWhitespaceAndComments(source, start) {
  let index = start;
  while (index < source.length) {
    if (/\s/.test(source[index])) { index += 1; continue; }
    if (source[index] === "#") { index = skipComment(source, index); continue; }
    break;
  }
  return index;
}

function skipComment(source, start) {
  const end = source.indexOf("\n", start);
  return end < 0 ? source.length : end + 1;
}

function skipQuote(source, start) {
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === "\\") { index += 1; continue; }
    if (source[index] === '"') return index + 1;
  }
  return source.length;
}

function listFiles(directory, suffix) {
  const files = [];
  if (!fs.statSync(directory, { throwIfNoEntry: false })?.isDirectory()) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(target, suffix));
    else if (entry.isFile() && entry.name.endsWith(suffix)) files.push(target);
  }
  return files.sort();
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    result[key] = next && !next.startsWith("--") ? (index += 1, next) : true;
  }
  return result;
}

function assertDirectory(directory, label) {
  if (!fs.statSync(directory, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`找不到${label}：${directory}`);
}

function assertFile(file, label) {
  if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) throw new Error(`找不到${label}：${file}`);
}

function isKeyStart(character) { return /[A-Za-z0-9_]/.test(character); }
function isKeyCharacter(character) { return /[A-Za-z0-9_.:-]/.test(character); }
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function escapeCell(value) { return String(value || "未指定").replaceAll("|", "\\|").replaceAll("\n", " "); }
function escapeHeading(value) { return String(value || "未命名").replaceAll("#", "＃"); }
function readText(file) { return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""); }
