import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const PROJECT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULTS = {
  baseVersion: "1.13.8",
  targetVersion: "1.13.9",
  baseDir: path.join(PROJECT_DIR, "database", "vic3_1.13.8"),
  targetDir: path.join(PROJECT_DIR, "database", "vic3_1.13.9"),
};

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const baseVersion = String(args["base-version"] || DEFAULTS.baseVersion);
const targetVersion = String(args["target-version"] || DEFAULTS.targetVersion);
const config = {
  baseVersion,
  targetVersion,
  baseDir: path.resolve(String(args["base-dir"] || path.join(PROJECT_DIR, "database", `vic3_${baseVersion}`))),
  targetDir: path.resolve(String(args["target-dir"] || path.join(PROJECT_DIR, "database", `vic3_${targetVersion}`))),
  baseSiteData: args["base-site-data"] ? path.resolve(String(args["base-site-data"])) : "",
  targetSiteData: args["target-site-data"] ? path.resolve(String(args["target-site-data"])) : "",
  outFile: path.resolve(String(args.out || defaultOutFile(baseVersion, targetVersion))),
};

const boardSpecs = [
  {
    key: "country",
    label: "国家",
    file: "countries.json",
    siteKey: "countries",
    idKey: "tag",
    route: "country",
  },
  {
    key: "culture",
    label: "文化",
    file: "cultures.json",
    siteKey: "cultures",
    idKey: "key",
    route: "culture",
  },
  {
    key: "stateRegion",
    label: "州地区",
    boardGroup: "地区",
    file: "state_regions.json",
    siteKey: "stateRegions",
    idKey: "key",
    route: "state-region",
  },
  {
    key: "strategicRegion",
    label: "战略区域",
    boardGroup: "地区",
    file: "strategic_regions.json",
    siteKey: "strategicRegions",
    idKey: "key",
    route: "strategic-region",
  },
  {
    key: "company",
    label: "公司",
    file: "companies.json",
    siteKey: "companies",
    idKey: "key",
    route: "company",
  },
  {
    key: "ideology",
    label: "意识形态",
    file: "ideologies.json",
    siteKey: "ideologies",
    idKey: "key",
    route: "ideology",
  },
];

const ignoredKeys = new Set([
  "id",
  "order",
  "source",
  "source_file",
  "unlock_journal_entries",
  "unlock_sources",
  "unlock_technologies",
]);

const fieldLabels = new Map([
  ["name", "名称"],
  ["name_zh", "中文名"],
  ["desc_zh", "描述"],
  ["status", "状态"],
  ["special_mechanic", "特殊机制"],
  ["classification", "分类"],
  ["color", "颜色"],
  ["unit_colors", "单位颜色"],
  ["primary_cultures", "主流文化"],
  ["primary_culture_traits", "主流文化特质"],
  ["primary_culture_trait_groups", "主流文化特质组"],
  ["primary_culture_homeland_state_regions", "主流文化本土州地区"],
  ["primary_culture_homeland_strategic_regions", "主流文化本土战略区域"],
  ["formation_state_regions", "成国州地区"],
  ["formation_strategic_regions", "成国战略区域"],
  ["location_state_regions", "位置州地区"],
  ["location_strategic_regions", "位置战略区域"],
  ["religion", "宗教"],
  ["capital", "首府"],
  ["starting_states", "开局州"],
  ["formation", "成国规则"],
  ["release", "可释放规则"],
  ["interest_groups", "利益集团"],
  ["can_form_by_primary_culture", "可由主流文化成立"],
  ["dynamic_country_name_variant_ids", "动态国名"],
  ["dynamic_map_color_rule_ids", "动态地图色"],
  ["heritage", "传承"],
  ["language", "语言"],
  ["traditions", "传统"],
  ["traits", "特质"],
  ["trait_groups", "特质组"],
  ["obsessions", "痴迷"],
  ["taboos", "禁忌"],
  ["related_countries", "相关国家"],
  ["homeland_state_regions", "本土州地区"],
  ["homeland_strategic_regions", "本土战略区域"],
  ["same_heritage_cultures", "同传承文化"],
  ["same_language_cultures", "同语言文化"],
  ["same_trait_group_cultures", "同特质组文化"],
  ["numeric_id", "数字编号"],
  ["subsistence_building", "自给建筑"],
  ["graphical_culture", "图形文化"],
  ["province_colors", "省份颜色"],
  ["impassable_province_colors", "不可通行省份颜色"],
  ["prime_land_province_colors", "良田省份颜色"],
  ["arable_land", "可耕地"],
  ["arable_resources", "农业资源"],
  ["capped_resources", "资源上限"],
  ["discoverable_resources", "可发现资源"],
  ["strategic_regions", "战略区域"],
  ["starting_owners", "开局拥有者"],
  ["starting_province_owners", "开局分省拥有者"],
  ["dynamic_name_variants", "动态地名"],
  ["states", "州地区"],
  ["map_color", "地图颜色"],
  ["capital_province", "首府省份"],
  ["icon", "图标"],
  ["background", "背景"],
  ["category", "类别"],
  ["category_zh", "类别"],
  ["flavored_company", "风味公司"],
  ["company_kind", "公司类型"],
  ["company_kind_zh", "公司类型"],
  ["is_easter_egg_company", "彩蛋公司"],
  ["uses_dynamic_naming", "动态命名"],
  ["dynamic_company_type_names", "动态公司名"],
  ["preferred_headquarters", "首选总部"],
  ["building_types", "建筑"],
  ["extension_building_types", "特许扩展建筑"],
  ["possible_prestige_goods", "可能的威望商品"],
  ["prosperity_modifiers", "繁荣修正"],
  ["prosperity_modifier_summary_zh", "繁荣修正摘要"],
  ["required_technologies", "所需科技"],
  ["ai_will_do_technologies", "AI 倾向科技"],
  ["referenced_state_regions", "引用州地区"],
  ["referenced_strategic_regions", "引用战略区域"],
  ["referenced_geographic_regions", "引用地理区域"],
  ["referenced_cultures", "引用文化"],
  ["referenced_countries", "引用国家"],
  ["referenced_buildings", "引用建筑"],
  ["potential_raw", "潜在条件代码"],
  ["attainable_raw", "可取得条件代码"],
  ["possible_raw", "可用条件代码"],
  ["prestige_goods_trigger_raw", "威望商品触发代码"],
  ["ai_will_do_raw", "AI 意愿代码"],
  ["ai_construction_targets_raw", "AI 建设目标代码"],
  ["ai_weight_raw", "AI 权重代码"],
  ["law_stances", "法律立场"],
  ["active_traits", "启用特质"],
  ["base_traits", "基础特质"],
  ["active_ideologies", "启用意识形态"],
  ["base_ideologies", "基础意识形态"],
  ["added_ideologies", "新增意识形态"],
  ["removed_ideologies", "移除意识形态"],
  ["applied_rules", "套用规则"],
  ["condition_raw", "条件代码"],
  ["trigger_raw", "触发代码"],
  ["modifier_summary_zh", "修正摘要"],
  ["modifiers", "修正"],
  ["value", "数值"],
  ["value_raw", "原始数值"],
  ["value_zh", "显示数值"],
  ["summary_zh", "摘要"],
  ["key", "键"],
  ["tag", "Tag"],
  ["amount", "数量"],
]);

const rawFieldNames = new Set([
  "potential_raw",
  "attainable_raw",
  "possible_raw",
  "prestige_goods_trigger_raw",
  "ai_will_do_raw",
  "ai_construction_targets_raw",
  "ai_weight_raw",
  "condition_raw",
  "trigger_raw",
]);

const data = {
  baseVersion: config.baseVersion,
  targetVersion: config.targetVersion,
  generatedAt: new Date().toISOString(),
  boards: boardSpecs.map(({ key, label, boardGroup }) => ({ key, label, boardGroup: boardGroup || label })),
  changes: [],
};

for (const spec of boardSpecs) {
  const baseRows = readRows(config.baseDir, config.baseSiteData, spec);
  const targetRows = readRows(config.targetDir, config.targetSiteData, spec);
  const baseMap = mapBy(baseRows, spec.idKey);
  const targetMap = mapBy(targetRows, spec.idKey);
  const ids = [...new Set([...baseMap.keys(), ...targetMap.keys()])].sort(localeSort);

  for (const id of ids) {
    const baseItem = baseMap.get(id);
    const targetItem = targetMap.get(id);
    const status = baseItem && targetItem ? "changed" : baseItem ? "removed" : "added";
    const diffs = diffValues(normalizeValue(baseItem), normalizeValue(targetItem));
    if (status === "changed" && diffs.length === 0) continue;
    const title = displayTitle(targetItem || baseItem, spec.idKey);
    data.changes.push({
      id: `${spec.key}:${id}`,
      board: spec.key,
      boardLabel: spec.label,
      boardGroup: spec.boardGroup || spec.label,
      status,
      key: id,
      title,
      baseUrl: contentUrl(spec.route, id, config.baseVersion),
      targetUrl: contentUrl(spec.route, id, config.targetVersion),
      sourceFile: sourceFile(targetItem || baseItem),
      diffs: diffs.map((diff) => buildDiffEntry(diff, baseItem, targetItem)),
    });
  }
}

annotateDuplicateDiffs(data.changes);

fs.mkdirSync(path.dirname(config.outFile), { recursive: true });
fs.writeFileSync(
  config.outFile,
  `window.VIC3_CHANGELOG_DATA=${JSON.stringify(data)};\n`,
  "utf8",
);

console.log(JSON.stringify({
  outFile: config.outFile,
  baseVersion: config.baseVersion,
  targetVersion: config.targetVersion,
  changes: data.changes.length,
  diffs: data.changes.reduce((sum, change) => sum + change.diffs.length, 0),
}, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function defaultOutFile(baseVersion, targetVersion) {
  return path.join(PROJECT_DIR, "site", "changelogs", `${baseVersion}_to_${targetVersion}.js`);
}

function printHelp() {
  console.log(`Usage: node scripts/build_changelog_data.mjs [options]

Options:
  --base-version <version>    Base version, default 1.13.8
  --target-version <version>  Target version, default 1.13.9
  --base-dir <path>          Base database dir, default database/vic3_<base-version>
  --target-dir <path>        Target database dir, default database/vic3_<target-version>
  --base-site-data <path>    Read base rows from a built site data.js
  --target-site-data <path>  Read target rows from a built site data.js
  --out <path>               Output JS file, default site/changelogs/<base>_to_<target>.js
  --help                     Show this help
`);
}

function readJson(file) {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(text);
}

function readRows(databaseDir, siteDataFile, spec) {
  if (siteDataFile) return readSiteDataRows(siteDataFile, spec.siteKey);
  return readJson(path.join(databaseDir, spec.file));
}

function readSiteDataRows(file, siteKey) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), context);
  return context.window.VIC3_DATA?.[siteKey] || [];
}

function mapBy(rows, key) {
  const map = new Map();
  for (const row of rows) map.set(String(row[key]), row);
  return map;
}

function normalizeValue(value) {
  if (Array.isArray(value)) {
    if (value.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
      const identityKey = arrayIdentityKey(value);
      if (identityKey) {
        const out = {};
        for (const item of value) {
          const identity = identityValue(item, identityKey);
          out[identity] = normalizeValue(item);
        }
        return sortObject(out);
      }
    }
    if (value.every((item) => item === null || typeof item !== "object")) {
      return [...value].sort(localeSort);
    }
    return value.map(normalizeValue);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort(localeSort)) {
      if (ignoredKeys.has(key)) continue;
      out[key] = normalizeValue(value[key]);
    }
    return out;
  }
  return value;
}

function arrayIdentityKey(value) {
  const candidates = ["key", "tag", "name_key", "state_key", "id"];
  for (const candidate of candidates) {
    if (value.every((item) => item[candidate] !== undefined && item[candidate] !== "")) return candidate;
  }
  return "";
}

function identityValue(item, identityKey) {
  if (identityKey === "id" && item.key) return String(item.key);
  return String(item[identityKey]);
}

function sortObject(value) {
  const out = {};
  for (const key of Object.keys(value).sort(localeSort)) out[key] = value[key];
  return out;
}

function diffValues(baseValue, targetValue, pathParts = []) {
  if (stableString(baseValue) === stableString(targetValue)) return [];
  if (isPlainObject(baseValue) && isPlainObject(targetValue)) {
    const out = [];
    const keys = [...new Set([...Object.keys(baseValue), ...Object.keys(targetValue)])].sort(localeSort);
    for (const key of keys) {
      out.push(...diffValues(baseValue[key], targetValue[key], [...pathParts, key]));
    }
    return out;
  }
  return [{ pathParts, oldValue: baseValue, newValue: targetValue }];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableString(value) {
  return JSON.stringify(value);
}

function displayTitle(item, idKey) {
  if (!item) return "";
  const name = item.name?.zh || item.name_zh || item.display_name?.name_zh || "";
  return name ? `${name} ${item[idKey]}` : String(item[idKey]);
}

function sourceFile(item) {
  if (!item) return "";
  if (item.source_file) return item.source_file;
  if (item.source?.file) return item.source.file;
  if (item.source?.definition_file) return item.source.definition_file;
  return "";
}

function contentUrl(route, id, version) {
  return `index.html?version=${encodeURIComponent(version)}#/${route}/${encodeURIComponent(id)}`;
}

function buildDiffEntry(diff, baseItem, targetItem) {
  const pathLabel = pathToLabel(diff.pathParts);
  const kind = diff.pathParts.some((part) => rawFieldNames.has(part)) ? "raw" : "field";
  const oldText = formatSourceText(diff.oldValue, diff.pathParts, baseItem);
  const newText = formatSourceText(diff.newValue, diff.pathParts, targetItem);
  return {
    path: diff.pathParts.join("."),
    label: pathLabel,
    kind,
    duplicateKey: duplicateKey(diff.pathParts, oldText, newText),
    oldText,
    newText,
  };
}

function pathToLabel(pathParts) {
  if (!pathParts.length) return "整条记录";
  return pathParts.map((part, index) => {
    if (index === 0 && fieldLabels.has(part)) return fieldLabels.get(part);
    if (fieldLabels.has(part)) return fieldLabels.get(part);
    return part;
  }).join(" / ");
}

function formatSourceText(value, pathParts, item) {
  if (value === undefined) return "（无）";
  if (value === null) return "null";
  const last = pathParts[pathParts.length - 1] || "";
  if (rawFieldNames.has(last) && typeof value === "string") {
    return value.trim() || "（空）";
  }
  const prefix = pathParts.length ? `${pathParts.join(".")} = ` : "";
  if (typeof value === "string") return `${prefix}${quoteString(value)}`;
  if (typeof value === "number" || typeof value === "boolean") return `${prefix}${String(value)}`;
  if (isSimpleRef(value)) return `${prefix}${formatRef(value)}`;
  const compact = compactRefs(value);
  const rendered = JSON.stringify(compact, null, 2);
  if (!pathParts.length && item) return rendered;
  return `${prefix}${rendered}`;
}

function annotateDuplicateDiffs(changes) {
  const counts = new Map();
  for (const change of changes) {
    for (const diff of change.diffs) {
      counts.set(diff.duplicateKey, (counts.get(diff.duplicateKey) || 0) + 1);
    }
  }
  for (const change of changes) {
    for (const diff of change.diffs) {
      diff.duplicateCount = counts.get(diff.duplicateKey) || 1;
    }
  }
}

function duplicateKey(pathParts, oldText, newText) {
  return [
    duplicatePathKey(pathParts),
    canonicalDiffText(oldText),
    canonicalDiffText(newText),
  ].join("\n");
}

function duplicatePathKey(pathParts) {
  const tail = pathParts[pathParts.length - 1] || "";
  const rawPart = pathParts.find((part) => rawFieldNames.has(part));
  if (rawPart) return rawPart;
  if (tail === "name_zh" || tail === "desc_zh" || tail === "summary_zh" || tail === "modifier_summary_zh") return tail;
  if (tail === "amount" || tail === "value" || tail === "value_raw" || tail === "value_zh") return pathParts.slice(-2).join(".");
  return pathParts.slice(-3).join(".");
}

function canonicalDiffText(value) {
  return String(value || "")
    .replace(/^[A-Za-z0-9_.$[\]-]+ = /, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactRefs(value) {
  if (Array.isArray(value)) return value.map(compactRefs);
  if (value && typeof value === "object") {
    if (isSimpleRef(value)) return formatRef(value);
    const out = {};
    for (const key of Object.keys(value).sort(localeSort)) out[key] = compactRefs(value[key]);
    return out;
  }
  return value;
}

function isSimpleRef(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.some((key) => ["key", "tag", "id", "name_zh"].includes(key)) && keys.length <= 6;
}

function formatRef(value) {
  const key = value.key || value.tag || value.id || "";
  const name = value.name_zh || value.name?.zh || "";
  if (key && name) return `${key} ${name}`;
  return key || name || JSON.stringify(value);
}

function quoteString(value) {
  return JSON.stringify(value);
}

function localeSort(a, b) {
  return String(a).localeCompare(String(b), "en");
}
