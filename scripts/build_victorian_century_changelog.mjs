import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const oldDatabase = path.resolve(args["old-database"] || path.join(root, "backups", "victorian-century-before-rebuild-20260928-213250", "database", "victorian_century"));
const newDatabase = path.resolve(args["new-database"] || path.join(root, "database", "victorian_century"));
const manifest = String(args.manifest || "441298602252521480");
const outFile = path.resolve(args.out || path.join(root, "site", "vc", "changelogs", `${manifest}.js`));
const localeZh = readRows(path.join(newDatabase, "locales", "zh-Hans.json"));
const localeEn = readRows(path.join(newDatabase, "locales", "en.json"));
const traitInterestGroups = new Map();
for (const country of readRows(path.join(newDatabase, "countries.json"))) {
  for (const group of country.interest_groups || []) {
    for (const trait of [...(group.active_traits || []), ...(group.base_traits || [])]) {
      if (trait.key && !traitInterestGroups.has(trait.key)) traitInterestGroups.set(trait.key, { key: group.key, texture: group.texture || "" });
    }
  }
}

const specs = [
  ["country", "国家", "countries.json", "tag", "country"],
  ["company", "公司", "companies.json", "key", "company"],
  ["interestGroupTrait", "利益集团特质", "interest_group_traits.json", "key", "interest-group"],
  ["ideology", "意识形态", "ideologies.json", "key", "ideology"],
  ["law", "法律", "laws.json", "key", "law"],
  ["journal", "日志", "journal_entries.json", "id", "journal"],
  ["event", "事件", "events.json", "id", "event"],
  ["decision", "决议", "decisions.json", "id", "decision"],
];
const ignored = new Set([
  "source", "source_file", "source_files", "source_paths", "source_line", "generated_at",
  "vc_change_kind", "vc_change_fields", "country_scope_evidence", "content_class", "sources",
  "overridden_vanilla", "is_test", "is_debug", "loc", "value_raw",
]);
const groups = new Map();
const subjectGroups = new Map();
const summary = {};

for (const [board, label, file, idField, route] of specs) {
  const oldRows = readRows(path.join(oldDatabase, file));
  const newRows = readRows(path.join(newDatabase, file));
  const oldMap = new Map(oldRows.map((row) => [String(row[idField]), row]));
  const newMap = new Map(newRows.map((row) => [String(row[idField]), row]));
  const ids = [...new Set([...oldMap.keys(), ...newMap.keys()])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  summary[board] = { label, old: oldRows.length, new: newRows.length, added: 0, removed: 0, adjusted: 0, groups: 0, members: 0 };
  for (const id of ids) {
    const oldRow = oldMap.get(id);
    const newRow = newMap.get(id);
    const status = oldRow && newRow ? "adjusted" : oldRow ? "removed" : "added";
    const diffs = status === "adjusted" ? leafDiff(oldRow, newRow) : [{ path: "<record>", oldValue: oldRow, newValue: newRow }];
    if (status === "adjusted" && diffs.length === 0) continue;
    if (status === "added") summary[board].added += 1;
    if (status === "removed") summary[board].removed += 1;
    if (status === "adjusted") summary[board].adjusted += 1;
    for (const diff of diffs) addGroup({ board, label, route, id, idField, status, oldRow, newRow, diff });
  }
}

const data = {
  schemaVersion: 1,
  oldManifest: String(args["old-manifest"] || "6136745052571973354"),
  newManifest: manifest,
  generatedAt: new Date().toISOString(),
  summary,
  boards: specs.map(([key, label]) => ({ key, label })),
  changes: [...subjectGroups.values(), ...groups.values()].map((group) => ({
    ...group,
    members: [...group.members.values()].sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true })),
    details: group.details || [],
  })).sort((a, b) => a.board.localeCompare(b.board) || (a.field || "").localeCompare(b.field || "") || (a.oldText || "").localeCompare(b.oldText || "") || (a.newText || "").localeCompare(b.newText || "")),
};
for (const group of data.changes) group.memberCount = group.members.length;
for (const item of Object.values(summary)) item.groups = data.changes.filter((group) => group.label === item.label).length;
writeData(outFile, data);
const standaloneOut = path.join(root, "Victorian Century Database", "changelogs", `${manifest}.js`);
if (path.resolve(standaloneOut) !== path.resolve(outFile)) writeData(standaloneOut, data);
console.log(JSON.stringify({ outFile, standaloneOut, groups: data.changes.length, summary }, null, 2));

function addGroup({ board, label, route, id, idField, status, oldRow, newRow, diff }) {
  const modifierKey = board === "company" ? diff.path.match(/^prosperity_modifiers\[([^\]]+)\]\.value$/)?.[1] || "" : "";
  const interestGroupMatch = board === "country" ? diff.path.match(/^interest_groups\[([^\]]+)\]\.active_traits\[([^\]]+)\]\.modifiers\[([^\]]+)\]\.value$/) : null;
  const field = modifierKey ? `prosperity_modifiers[${modifierKey}]` : interestGroupMatch ? `interest_groups[${interestGroupMatch[1]}].active_traits[${interestGroupMatch[2]}].modifiers[${interestGroupMatch[3]}]` : diff.path;
  const valueKey = modifierKey || interestGroupMatch?.[3] || "";
  const oldText = formatValue(diff.oldValue, valueKey);
  const newText = formatValue(diff.newValue, valueKey);
  const fieldLabel = modifierKey ? modifierLabel(newRow || oldRow, modifierKey, "zh") : interestGroupMatch ? interestGroupLabel(newRow || oldRow, interestGroupMatch, "zh") : field;
  const fieldLabelEn = modifierKey ? modifierLabel(newRow || oldRow, modifierKey, "en") : interestGroupMatch ? interestGroupLabel(newRow || oldRow, interestGroupMatch, "en") : field;
  const headerIcon = board === "country" && interestGroupMatch
    ? countryInterestGroupIcon(newRow || oldRow, interestGroupMatch)
    : board === "interestGroupTrait"
      ? memberIcon(newRow || oldRow, board, id)
      : board === "event" || board === "journal"
        ? memberIcon(newRow || oldRow, board, id)
        : null;
  const subjectKey = String((newRow || oldRow)?.[idField] || id);
  if (board === "company" || board === "interestGroupTrait") {
    const subjectIdentity = JSON.stringify([board, subjectKey, status]);
    let subject = subjectGroups.get(subjectIdentity);
    if (!subject) {
      subject = {
        id: `vc-${hash(subjectIdentity)}`,
        board, label, status, field: "subject",
        fieldLabel: displayTitle(newRow || oldRow, idField, "zh"),
        fieldLabelEn: displayTitle(newRow || oldRow, idField, "en"),
        headerIcon,
        members: new Map(), details: [],
      };
      subjectGroups.set(subjectIdentity, subject);
    }
    const detailKey = JSON.stringify([field, oldText, newText]);
    if (!subject.details.some((detail) => JSON.stringify([detail.field, detail.oldText, detail.newText]) === detailKey)) subject.details.push({ field, fieldLabel, fieldLabelEn, oldText, newText, oldValue: diff.oldValue, newValue: diff.newValue });
    if (!subject.members.has(subjectKey)) subject.members.set(subjectKey, { key: subjectKey, title: displayTitle(newRow || oldRow, idField, "zh"), titleEn: displayTitle(newRow || oldRow, idField, "en"), icon: memberIcon(newRow || oldRow, board, subjectKey), oldUrl: oldRow ? routeUrl(route, subjectKey) : "", newUrl: newRow ? routeUrl(route, subjectKey) : "" });
    if (subject.members.size === 1) summary[board].members += 1;
    return;
  }
  const identity = JSON.stringify([board, field, status, oldText, newText]);
  let group = groups.get(identity);
  if (!group) {
    group = {
      id: `vc-${hash(identity)}`,
      board,
      label,
      status,
      field,
      fieldLabel,
      fieldLabelEn,
      headerIcon,
      oldText,
      newText,
      oldValue: diff.oldValue,
      newValue: diff.newValue,
      members: new Map(),
    };
    groups.set(identity, group);
  }
  const key = String((newRow || oldRow)?.[idField] || id);
  if (!group.members.has(key)) group.members.set(key, {
    key,
    title: displayTitle(newRow || oldRow, idField, "zh"),
    titleEn: displayTitle(newRow || oldRow, idField, "en"),
    icon: memberIcon(newRow || oldRow, board, key),
    oldValue: diff.oldValue,
    newValue: diff.newValue,
    oldUrl: oldRow ? routeUrl(route, key) : "",
    newUrl: newRow ? routeUrl(route, key) : "",
  });
  const stat = summary[board];
  stat.members += 1;
}

function memberIcon(row, board, key) {
  if (board === "country") return { kind: "country", key };
  if (board === "company" && row?.icon) return { kind: "company", icon: row.icon };
  if (board === "interestGroupTrait" && row?.icon) return { kind: "trait", icon: row.icon, interestGroup: traitInterestGroups.get(key) || null };
  if (board === "ideology" && row?.icon) return { kind: "ideology", icon: row.icon };
  if (board === "law" && row?.icon) return { kind: "law", icon: row.icon };
  if (board === "journal" && row?.icon) return { kind: "event", icon: row.icon };
  if (board === "event" && row?.icon) return { kind: "event", icon: row.icon };
  return null;
}

function countryInterestGroupIcon(row, match) {
  const group = (row?.interest_groups || []).find((item) => item.key === match[1]);
  const trait = [...(group?.active_traits || []), ...(group?.base_traits || [])].find((item) => item.key === match[2]);
  return { kind: "trait", icon: trait?.icon || "", interestGroup: group ? { key: group.key, texture: group.texture || "" } : null };
}

function leafDiff(oldValue, newValue, pathName = "", result = []) {
  if (stable(oldValue) === stable(newValue) || ignored.has(pathName) || ignored.has(pathName.split(".").at(-1))) return result;
  if (Array.isArray(oldValue) || Array.isArray(newValue)) {
    const oldArray = Array.isArray(oldValue) ? oldValue : [];
    const newArray = Array.isArray(newValue) ? newValue : [];
    if (oldArray.every(isKeyedObject) && newArray.every(isKeyedObject)) {
      const oldMap = new Map(oldArray.map((item) => [identity(item), item]));
      const newMap = new Map(newArray.map((item) => [identity(item), item]));
      for (const key of new Set([...oldMap.keys(), ...newMap.keys()])) leafDiff(oldMap.get(key), newMap.get(key), `${pathName}[${key}]`, result);
      return result;
    }
    result.push({ path: pathName || "<record>", oldValue, newValue });
    return result;
  }
  if (oldValue && newValue && typeof oldValue === "object" && typeof newValue === "object") {
    for (const key of new Set([...Object.keys(oldValue), ...Object.keys(newValue)])) {
      if (ignored.has(key)) continue;
      leafDiff(oldValue[key], newValue[key], pathName ? `${pathName}.${key}` : key, result);
    }
    return result;
  }
  result.push({ path: pathName || "<record>", oldValue, newValue });
  return result;
}

function isKeyedObject(value) { return Boolean(value && typeof value === "object" && !Array.isArray(value) && identity(value)); }
function identity(value) { return String(value.key ?? value.tag ?? value.id ?? value.name_key ?? ""); }
function stable(value) { return JSON.stringify(value); }
function formatValue(value, modifierKey = "") {
  if (value === undefined) return "（无）";
  if (value === null) return "null";
  if (modifierKey && typeof value === "number" && (modifierKey.endsWith("_mult") || modifierKey.endsWith("_add"))) return `${value >= 0 ? "+" : ""}${Math.round(value * 100)}%`;
  if (typeof value === "string") return value || "（空）";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(compact(value));
}
function modifierLabel(row, modifierKey, locale) {
  const modifier = (row?.prosperity_modifiers || []).find((item) => item.key === modifierKey);
  const messageKey = modifier?.loc?.name || "";
  const message = (locale === "en" ? localeEn : localeZh)[messageKey] || modifierKey;
  return locale === "en" ? `Prosperity: ${message} bonus` : `繁荣时${message}加成`;
}
function interestGroupLabel(row, match, locale) {
  const [, interestGroupKey, traitKey, modifierKey] = match;
  const interestGroup = (row?.interest_groups || []).find((item) => item.key === interestGroupKey);
  const trait = (interestGroup?.active_traits || []).find((item) => item.key === traitKey)
    || (interestGroup?.base_traits || []).find((item) => item.key === traitKey);
  const modifier = (trait?.modifiers || []).find((item) => item.key === modifierKey);
  const messages = locale === "en" ? localeEn : localeZh;
  const traitName = messages[trait?.loc?.name] || traitKey;
  const modifierName = messages[modifier?.loc?.name] || modifierKey;
  const groupName = messages[interestGroup?.loc?.name] || interestGroupKey;
  return locale === "en" ? `${groupName} · ${traitName} · ${modifierName} bonus` : `${groupName} · ${traitName} · ${modifierName}加成`;
}
function compact(value) {
  if (Array.isArray(value)) return value.map(compact);
  if (value && typeof value === "object") {
    if (value.key || value.tag || value.id) return value.key || value.tag || value.id;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !["loc", "source", "source_file", "source_files"].includes(key)).map(([key, item]) => [key, compact(item)]));
  }
  return value;
}
function displayTitle(row, idField, locale) {
  const fallback = String(row?.[idField] || "");
  const messageKey = row?.loc?.name || row?.loc?.displayName || "";
  const messages = locale === "en" ? localeEn : localeZh;
  return messages[messageKey] || row?.locales?.[locale === "en" ? "en" : "zhHans"]?.name || row?.locales?.[locale === "en" ? "en" : "zhHans"]?.title || row?.name_zh || row?.display_name?.key || fallback;
}
function routeUrl(route, key) { return `#/` + route + `/` + encodeURIComponent(key); }
function hash(value) { let hashValue = 2166136261; for (const char of value) { hashValue ^= char.charCodeAt(0); hashValue = Math.imul(hashValue, 16777619); } return (hashValue >>> 0).toString(16); }
function readRows(file) { return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")); }
function writeData(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `window.VIC3_VC_CHANGELOG_DATA=${JSON.stringify(value)};\n`, "utf8"); }
function parseArgs(argv) { const result = {}; for (let i = 0; i < argv.length; i += 1) { const arg = argv[i]; if (!arg.startsWith("--")) continue; const key = arg.slice(2); const next = argv[i + 1]; if (!next || next.startsWith("--")) result[key] = true; else { result[key] = next; i += 1; } } return result; }
