import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_GAME_PATH = "D:\\SteamLibrary\\steamapps\\common\\Victoria 3";
const DEFAULT_OUT_DIR = "output/historical-characters";
const args = parseArgs(process.argv.slice(2));
const gamePath = path.resolve(args["game-path"] || DEFAULT_GAME_PATH);
const gameDir = path.join(gamePath, "game");
const outDir = path.resolve(args.out || DEFAULT_OUT_DIR);

for (const [directory, label] of [
  [gameDir, "游戏目录"],
  [path.join(gameDir, "common", "character_templates"), "角色模板目录"],
  [path.join(gameDir, "common", "dna_data"), "DNA 目录"],
  [path.join(gameDir, "common", "history", "characters"), "角色历史目录"],
]) assertDirectory(directory, label);

const localizationZh = loadLocalization(path.join(gameDir, "localization", "simp_chinese"));
const localizationEn = loadLocalization(path.join(gameDir, "localization", "english"));
const dnaDefinitions = collectDnaDefinitions(path.join(gameDir, "common", "dna_data"));
const historyUsage = collectHistoryUsage(path.join(gameDir, "common", "history", "characters"), gameDir);
const characters = collectHistoricalTemplates(path.join(gameDir, "common", "character_templates"), gameDir, {
  localizationZh,
  localizationEn,
  dnaDefinitions,
  historyUsage,
});
const report = buildReport(gamePath, characters);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "historical-characters.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
fs.writeFileSync(path.join(outDir, "historical-characters.md"), buildMarkdown(report), "utf8");
console.log(JSON.stringify(report.stats));
console.log(`已写入：${outDir}`);

function buildReport(sourceGamePath, rows) {
  const withDna = rows.filter((row) => row.has_dna);
  const withoutDna = rows.filter((row) => !row.dna_key);
  const historyRows = rows.filter((row) => row.in_starting_history);
  const historyWithoutDna = historyRows.filter((row) => !row.dna_key);
  const invalidDnaReferences = rows.filter((row) => row.dna_key && !row.dna_defined);
  return {
    schema_version: 1,
    source_game_path: sourceGamePath,
    source_game_branch: readText(path.join(sourceGamePath, "caligula_branch.txt")).trim(),
    generated_at: new Date().toISOString(),
    scope: "common/character_templates blocks with historical = yes",
    stats: {
      historical_character_templates: rows.length,
      with_dna: withDna.length,
      without_dna: withoutDna.length,
      in_starting_history: historyRows.length,
      starting_history_with_dna: historyRows.filter((row) => row.has_dna).length,
      starting_history_without_dna: historyWithoutDna.length,
      invalid_dna_references: invalidDnaReferences.length,
    },
    without_dna: withoutDna,
    starting_history_without_dna: historyWithoutDna,
    invalid_dna_references: invalidDnaReferences,
    characters: rows,
  };
}

function collectHistoricalTemplates(templateDir, gameDir, context) {
  const rows = [];
  for (const file of listFiles(templateDir, ".txt")) {
    const source = readText(file);
    for (const block of extractTopLevelBlocks(source)) {
      if (!hasYesValue(block.body, "historical")) continue;
      const firstNameKey = scalarValue(block.body, "first_name");
      const lastNameKey = scalarValue(block.body, "last_name");
      const dnaKey = scalarValue(block.body, "dna");
      const usageFiles = context.historyUsage.get(block.key) || [];
      const roleFlags = [
        ["is_general", "将领"],
        ["is_admiral", "海军将领"],
        ["ig_leader", "利益集团领袖"],
        ["is_agitator", "煽动者"],
      ].filter(([key]) => hasYesValue(block.body, key)).map(([, label]) => label);
      const roleKey = scalarValue(block.body, "role");
      rows.push({
        key: block.key,
        historical: true,
        name_zh: displayName(firstNameKey, lastNameKey, context.localizationZh),
        name_en: displayName(firstNameKey, lastNameKey, context.localizationEn),
        first_name_key: firstNameKey,
        last_name_key: lastNameKey,
        female: hasYesValue(block.body, "female"),
        character_role: roleKey,
        character_role_name_zh: localizeName(roleKey, context.localizationZh),
        character_role_name_en: localizeName(roleKey, context.localizationEn),
        role_flags: roleFlags,
        birth_date: scalarValue(block.body, "birth_date"),
        age: scalarValue(block.body, "age"),
        culture_key: scalarValue(block.body, "culture"),
        religion_key: scalarValue(block.body, "religion"),
        interest_group_key: scalarValue(block.body, "interest_group"),
        ideology_key: scalarValue(block.body, "ideology"),
        home_region_key: scalarValue(block.body, "home_region"),
        traits: directItems(block.body, "traits"),
        dna_key: dnaKey,
        dna_defined: dnaKey ? context.dnaDefinitions.has(dnaKey) : false,
        has_dna: dnaKey ? context.dnaDefinitions.has(dnaKey) : false,
        dna_source_file: dnaKey ? context.dnaDefinitions.get(dnaKey) || "" : "",
        in_starting_history: usageFiles.length > 0,
        starting_history_files: usageFiles,
        source_file: path.relative(gameDir, file).replaceAll("\\", "/"),
      });
    }
  }
  return rows.sort((left, right) => left.key.localeCompare(right.key));
}

function buildMarkdown(report) {
  const { stats } = report;
  const lines = [
    "# Victoria 3 史实角色资料",
    "",
    `- 游戏分支：\`${report.source_game_branch}\``,
    `- 生成时间：${report.generated_at}`,
    `- 史实角色模板：${stats.historical_character_templates}`,
    `- 有有效 DNA：${stats.with_dna}`,
    `- 没有 DNA：${stats.without_dna}`,
    `- 1836 开局历史引用：${stats.in_starting_history}`,
    `- 开局历史中有 DNA：${stats.starting_history_with_dna}`,
    `- 开局历史中没有 DNA：${stats.starting_history_without_dna}`,
    `- 无效 DNA 引用：${stats.invalid_dna_references}`,
    "",
    "## 没有 DNA 的史实角色",
    "",
  ];
  appendTable(lines, report.without_dna);
  lines.push("", "## 开局历史中没有 DNA 的史实角色", "");
  appendTable(lines, report.starting_history_without_dna);
  lines.push("", "## 全部史实角色", "");
  appendTable(lines, report.characters);
  return `${lines.join("\n")}\n`;
}

function appendTable(lines, rows) {
  lines.push(
    "| 人物 | 模板键 | DNA | 性别 | 出生日期 | 身份 | 文化 | 宗教 | 利益集团 | 意识形态 | 所属地区 | 特质 | 开局创建 | 来源文件 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const row of rows) {
    const person = row.name_zh === row.name_en || !row.name_en ? row.name_zh : `${row.name_zh}<br>${row.name_en}`;
    const role = [row.character_role_name_zh || row.character_role, ...row.role_flags].filter(Boolean).join("、") || "未指定";
    const birth = row.birth_date || (row.age ? `年龄 ${row.age}` : "未指定");
    const dna = row.dna_key ? `\`${row.dna_key}\`${row.dna_defined ? "" : "（未定义）"}` : "无";
    lines.push(`| ${escapeCell(person)} | \`${row.key}\` | ${escapeCell(dna)} | ${row.female ? "女性" : "男性"} | ${escapeCell(birth)} | ${escapeCell(role)} | ${escapeCell(row.culture_key)} | ${escapeCell(row.religion_key)} | ${escapeCell(row.interest_group_key)} | ${escapeCell(row.ideology_key)} | ${escapeCell(row.home_region_key)} | ${escapeCell(row.traits.join("、"))} | ${row.in_starting_history ? "是" : "否"} | \`${row.source_file}\` |`);
  }
}

function collectDnaDefinitions(dnaDir) {
  const definitions = new Map();
  for (const file of listFiles(dnaDir, ".txt")) {
    for (const match of readText(file).matchAll(/^\s*(dna_[A-Za-z0-9_]+)\s*=\s*\{/gm)) {
      definitions.set(match[1], path.relative(dnaDir, file).replaceAll("\\", "/"));
    }
  }
  return definitions;
}

function collectHistoryUsage(historyDir, gameDir) {
  const usage = new Map();
  for (const file of listFiles(historyDir, ".txt")) {
    for (const match of readText(file).matchAll(/^\s*template\s*=\s*("[^"]+"|[^\s#{}]+)/gm)) {
      const template = match[1].replaceAll('"', "");
      const files = usage.get(template) || [];
      const relative = path.relative(gameDir, file).replaceAll("\\", "/");
      if (!files.includes(relative)) files.push(relative);
      usage.set(template, files);
    }
  }
  return usage;
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
    if (close < 0) throw new Error(`未闭合角色模板：${key}`);
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
    while (index < block.length && !/\s/.test(block[index]) && !["#", "{" , "}"].includes(block[index])) index += 1;
    if (index > start) items.push(block.slice(start, index));
    else index += 1;
  }
  return items;
}

function directBlock(body, key) {
  const escaped = escapeRegExp(key);
  const match = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*=\\s*\\{`, "m").exec(body);
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

function isKeyStart(character) { return /[A-Za-z0-9_]/.test(character); }
function isKeyCharacter(character) { return /[A-Za-z0-9_.:-]/.test(character); }
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function escapeCell(value) { return String(value || "未指定").replaceAll("|", "\\|").replaceAll("\n", " "); }
function readText(file) { return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""); }
