import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const gameRoot = process.env.VIC3_GAME_ROOT || "D:/SteamLibrary/steamapps/common/Victoria 3/game";
const outputRoot = path.join(repoRoot, "database", "vic3_1.13.9");
const sourceRoot = path.join(gameRoot);

function readText(file) {
  return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
}

function listTxt(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listTxt(target));
    else if (entry.isFile() && entry.name.endsWith(".txt")) files.push(target);
  }
  return files.sort();
}

function listLocalizationFiles(dir, localeFolder) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listLocalizationFiles(target, localeFolder));
    else if (entry.isFile() && entry.name.endsWith(`_l_${localeFolder}.yml`)) files.push(target);
  }
  return files.sort();
}

function parseTopLevelDefinitions(text, kind, relativeFile) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  let depth = 0;
  let comment = false;
  let current = null;
  let namespace = "";

  const finish = (endLine) => {
    if (!current) return;
    const raw = lines.slice(current.line - 1, endLine).join("\n").trimEnd();
    const normalizedFile = relativeFile.replaceAll("\\", "/");
    const isTest = /(^|\/)99_test|(^|\/)test[^/]*\.txt$/i.test(normalizedFile);
    const isDebug = /(^|\/)debug[^/]*\.txt$/i.test(normalizedFile);
    rows.push({
      id: current.id,
      script_key: current.scriptKey,
      namespace: current.namespace || undefined,
      source_file: normalizedFile,
      source_line: current.line,
      raw,
      content_class: isTest ? "test" : isDebug ? "debug" : "game",
      is_test: isTest,
      is_debug: isDebug,
    });
    current = null;
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const withoutComment = line.replace(/#.*$/, "");
    if (kind === "events" && depth === 0) {
      const namespaceMatch = withoutComment.match(/^\s*namespace\s*=\s*([A-Za-z0-9_.-]+)/);
      if (namespaceMatch) namespace = namespaceMatch[1];
    }
    if (depth === 0 && !current) {
      const match = withoutComment.match(/^\s*([A-Za-z0-9_.-]+)\s*=\s*\{/);
      if (match) {
        const eventId = kind === "events" && namespace && !match[1].includes(".")
          ? `${namespace}.${match[1]}`
          : match[1];
        current = { id: eventId, scriptKey: match[1], line: lineIndex + 1, namespace };
      }
    }
    const code = withoutComment.replace(/"(?:\\.|[^"\\])*"/g, "");
    const opens = (code.match(/{/g) || []).length;
    const closes = (code.match(/}/g) || []).length;
    depth += opens - closes;
    if (current && depth === 0) finish(lineIndex + 1);
  }
  return rows;
}

function parseLocalization(file) {
  const result = new Map();
  if (!fs.existsSync(file)) return result;
  for (const line of readText(file).split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_.-]+):(?:\d+\s+)?(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      try { value = JSON.parse(value); } catch { value = value.slice(1, -1); }
    }
    result.set(match[1], value);
  }
  return result;
}

function localeFiles(kind) {
  if (localeFiles.cache) return localeFiles.cache;
  const folders = { en: "english", zhHans: "simp_chinese" };
  const maps = {};
  for (const [locale, folder] of Object.entries(folders)) {
    const directory = path.join(sourceRoot, "localization", folder);
    const files = listLocalizationFiles(directory, folder);
    const map = new Map();
    for (const file of files) for (const [key, value] of parseLocalization(file)) map.set(key, value);
    maps[locale] = map;
  }
  localeFiles.cache = maps;
  return maps;
}

function parseScript(text, file = "<memory>") {
  const tokens = tokenize(text);
  let index = 0;
  function parseSequence(stopAtBrace) {
    const node = { assignments: [], items: [] };
    while (index < tokens.length) {
      const token = tokens[index];
      if (token === "}") {
        if (stopAtBrace) { index += 1; return node; }
        throw new Error(`unexpected closing brace: ${file}`);
      }
      const next = tokens[index + 1];
      if (isOperator(next)) {
        index += 2;
        node.assignments.push({ key: token, op: next, value: tokens[index] === "}" ? "" : parseValue() });
      } else node.items.push(parseValue());
    }
    if (stopAtBrace) throw new Error(`missing closing brace: ${file}`);
    return node;
  }
  function parseValue() {
    const token = tokens[index];
    if (token === undefined) throw new Error(`missing value: ${file}`);
    if (token === "{") { index += 1; return parseSequence(true); }
    if (tokens[index + 1] === "{") { index += 1; return { fn: token, args: parseValue() }; }
    index += 1;
    return token;
  }
  return parseSequence(false);
}

function tokenize(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (ch === "#") { while (i < text.length && text[i] !== "\n") i += 1; continue; }
    if (ch === '"') {
      let value = ""; i += 1;
      while (i < text.length) {
        if (text[i] === "\\" && i + 1 < text.length) { value += text[i + 1]; i += 2; continue; }
        if (text[i] === '"') { i += 1; break; }
        value += text[i]; i += 1;
      }
      tokens.push(value); continue;
    }
    if (ch === "{" || ch === "}") { tokens.push(ch); i += 1; continue; }
    const two = text.slice(i, i + 2);
    if (["?=", ">=", "<=", "!=", "=="].includes(two)) { tokens.push(two); i += 2; continue; }
    if (["=", ">", "<"].includes(ch)) { tokens.push(ch); i += 1; continue; }
    let value = "";
    while (i < text.length) {
      const current = text[i];
      if (/\s/.test(current) || ["#", "{", "}", "=", ">", "<"].includes(current) || (current === "?" && text[i + 1] === "=")) break;
      value += current; i += 1;
    }
    if (value) tokens.push(value);
  }
  return tokens;
}

function isOperator(token) {
  return ["=", "?=", ">=", "<=", ">", "<", "!=", "=="].includes(token);
}

function firstAssignment(node, key) {
  return node?.assignments?.find((assignment) => assignment.key === key);
}

function scalar(node, key) {
  const value = firstAssignment(node, key)?.value;
  return typeof value === "string" ? value : "";
}

function nestedScalar(node, blockKey, valueKey) {
  const block = firstAssignment(node, blockKey)?.value;
  return block?.assignments ? scalar(block, valueKey) : "";
}

function blockRaw(raw, key, occurrence = 0) {
  const lines = raw.split(/\r?\n/);
  let depth = 1;
  let found = -1;
  let start = -1;
  let targetDepth = -1;
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const code = lines[lineIndex].replace(/#.*$/, "").replace(/"(?:\\.|[^"\\])*"/g, "");
    if (depth === 1 && new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*=\\s*\\{`).test(code)) {
      found += 1;
      if (found === occurrence) { start = lineIndex; targetDepth = depth; }
    }
    depth += (code.match(/{/g) || []).length - (code.match(/}/g) || []).length;
    if (start >= 0 && depth === targetDepth) return lines.slice(start, lineIndex + 1).join("\n").trim();
  }
  return "";
}

function extractTriggeredEventIds(raw) {
  const values = [];
  for (const match of raw.matchAll(/\b(?:trigger_event|events|random_events)\s*=\s*\{([\s\S]*?)\n\s*\}/g)) {
    for (const id of match[1].matchAll(/(?:\bid\s*=\s*|^\s*\d+\s*=\s*)([A-Za-z0-9_.-]+)|^\s*([A-Za-z][A-Za-z0-9_.-]*\.\d+)\s*$/gm)) {
      const value = id[1] || id[2];
      if (value && !["yes", "no", "0"].includes(value)) values.push(value);
    }
  }
  return [...new Set(values)];
}

function enrichRow(row, kind) {
  let definition;
  try { definition = firstAssignment(parseScript(row.raw, row.source_file), row.script_key)?.value; }
  catch { definition = null; }
  if (!definition?.assignments) return row;
  if (kind === "journal_entries") return {
    ...row,
    group: scalar(definition, "group"),
    icon: scalar(definition, "icon"),
    timeout: scalar(definition, "timeout"),
    progressbar: scalar(definition, "progressbar") === "yes",
    is_shown_when_inactive_raw: blockRaw(row.raw, "is_shown_when_inactive"),
    possible_raw: blockRaw(row.raw, "possible"),
    complete_raw: blockRaw(row.raw, "complete"),
    fail_raw: blockRaw(row.raw, "fail"),
    invalid_raw: blockRaw(row.raw, "invalid"),
    on_complete_raw: blockRaw(row.raw, "on_complete"),
    on_fail_raw: blockRaw(row.raw, "on_fail"),
    on_timeout_raw: blockRaw(row.raw, "on_timeout"),
    triggered_event_ids: extractTriggeredEventIds(row.raw),
  };
  if (kind === "events") {
    const optionAssignments = definition.assignments.filter((assignment) => assignment.key === "option" && assignment.value?.assignments);
    return {
      ...row,
      event_type: scalar(definition, "type"),
      placement: scalar(definition, "placement"),
      title_key: scalar(definition, "title"),
      desc_key: scalar(definition, "desc"),
      flavor_key: scalar(definition, "flavor"),
      icon: scalar(definition, "icon"),
      duration: scalar(definition, "duration"),
      hidden: scalar(definition, "hidden") === "yes",
      orphan: scalar(definition, "orphan") === "yes",
      event_image: {
        video: nestedScalar(definition, "event_image", "video"),
        texture: nestedScalar(definition, "event_image", "texture"),
      },
      trigger_raw: blockRaw(row.raw, "trigger"),
      immediate_raw: blockRaw(row.raw, "immediate"),
      options: optionAssignments.map((assignment, index) => ({
        name_key: scalar(assignment.value, "name"),
        default_option: scalar(assignment.value, "default_option") === "yes",
        raw: blockRaw(row.raw, "option", index),
      })),
      triggered_event_ids: extractTriggeredEventIds(row.raw),
    };
  }
  return {
    ...row,
    is_shown_raw: blockRaw(row.raw, "is_shown"),
    possible_raw: blockRaw(row.raw, "possible"),
    when_taken_raw: blockRaw(row.raw, "when_taken"),
    ai_chance_raw: blockRaw(row.raw, "ai_chance"),
    triggered_event_ids: extractTriggeredEventIds(row.raw),
  };
}

function localize(row, maps, kind) {
  const id = row.id;
  const keys = kind === "events"
    ? {
      title: row.title_key || `${id}.t`,
      desc: row.desc_key || `${id}.d`,
      flavor: row.flavor_key || `${id}.f`,
    }
    : kind === "journal_entries"
      ? { name: id, reason: `${id}_reason`, desc: `${id}_desc` }
      : { name: id, desc: `${id}_desc`, tooltip: `${id}_tooltip` };
  const locales = {};
  for (const [locale, map] of Object.entries(maps)) {
    const values = {};
    for (const [field, key] of Object.entries(keys)) if (map.has(key)) values[field] = map.get(key);
    if (kind === "events") {
      const options = {};
      for (const option of row.options || []) {
        if (option.name_key && map.has(option.name_key)) options[option.name_key] = map.get(option.name_key);
      }
      if (Object.keys(options).length) values.options = options;
    }
    locales[locale] = values;
  }
  return locales;
}

function collect(kind, relativeDir, localizationKind) {
  const directory = path.join(sourceRoot, relativeDir);
  const maps = localeFiles(localizationKind);
  return listTxt(directory).flatMap((file) => {
    const relativeFile = path.relative(sourceRoot, file);
    return parseTopLevelDefinitions(readText(file), kind, relativeFile).map((row) => {
      const enriched = enrichRow(row, kind);
      return { ...enriched, locales: localize(enriched, maps, kind) };
    });
  });
}

function collectJournalEntryGroups() {
  const maps = localeFiles("journal_entry_groups");
  const directory = path.join(sourceRoot, "common/journal_entry_groups");
  return listTxt(directory).flatMap((file) => {
    const relativeFile = path.relative(sourceRoot, file);
    return parseTopLevelDefinitions(readText(file), "journal_entry_groups", relativeFile).map((row) => {
      let definition;
      try { definition = firstAssignment(parseScript(row.raw, row.source_file), row.script_key)?.value; }
      catch { definition = null; }
      const locales = {};
      for (const [locale, map] of Object.entries(maps)) locales[locale] = map.has(row.id) ? { name: map.get(row.id) } : {};
      return {
        ...row,
        context: scalar(definition, "context"),
        updates_strategic_region_stances: scalar(definition, "updates_strategic_region_stances") === "yes",
        locales,
      };
    });
  });
}

function localizationCoverage(rows, fields) {
  const coverage = {};
  for (const locale of ["en", "zhHans"]) {
    coverage[locale] = { any: rows.filter((row) => Object.keys(row.locales?.[locale] || {}).length).length };
    for (const field of fields) coverage[locale][field] = rows.filter((row) => row.locales?.[locale]?.[field]).length;
  }
  return coverage;
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) {
    const value = typeof key === "function" ? key(row) : row[key];
    counts[value || "(empty)"] = (counts[value || "(empty)"] || 0) + 1;
  }
  return counts;
}

const journalEntries = collect("journal_entries", "common/journal_entries", "journal_entries");
const events = collect("events", "events", "events");
const decisions = collect("decisions", "common/decisions", "decisions");
const journalEntryGroups = collectJournalEntryGroups();
const sourceManifest = {};
for (const [kind, relativeDir, rows] of [
  ["journal_entries", "common/journal_entries", journalEntries],
  ["events", "events", events],
  ["decisions", "common/decisions", decisions],
  ["journal_entry_groups", "common/journal_entry_groups", journalEntryGroups],
]) {
  sourceManifest[kind] = listTxt(path.join(sourceRoot, relativeDir)).map((file) => {
    const sourceFile = path.relative(sourceRoot, file).replaceAll("\\", "/");
    const fileRows = rows.filter((row) => row.source_file === sourceFile);
    return {
      source_file: sourceFile,
      definitions: fileRows.length,
      content_classes: countBy(fileRows, "content_class"),
    };
  });
}
const counts = {
  journal_entries: journalEntries.length,
  journal_entries_game: journalEntries.filter((row) => row.content_class === "game").length,
  journal_entries_test: journalEntries.filter((row) => row.content_class === "test").length,
  journal_entries_debug: journalEntries.filter((row) => row.content_class === "debug").length,
  events: events.length,
  events_game: events.filter((row) => row.content_class === "game").length,
  events_test: events.filter((row) => row.content_class === "test").length,
  events_debug: events.filter((row) => row.content_class === "debug").length,
  decisions: decisions.length,
  decisions_game: decisions.filter((row) => row.content_class === "game").length,
  decisions_test: decisions.filter((row) => row.content_class === "test").length,
  decisions_debug: decisions.filter((row) => row.content_class === "debug").length,
  journal_entry_groups: journalEntryGroups.length,
  event_options: events.reduce((total, row) => total + (row.options?.length || 0), 0),
  source_files: {
    scanned: {
      journal_entries: listTxt(path.join(sourceRoot, "common/journal_entries")).length,
      events: listTxt(path.join(sourceRoot, "events")).length,
      decisions: listTxt(path.join(sourceRoot, "common/decisions")).length,
    },
    with_definitions: {
      journal_entries: new Set(journalEntries.map((row) => row.source_file)).size,
      events: new Set(events.map((row) => row.source_file)).size,
      decisions: new Set(decisions.map((row) => row.source_file)).size,
    },
  },
};

fs.mkdirSync(outputRoot, { recursive: true });
for (const [name, rows] of Object.entries({ journal_entries: journalEntries, events, decisions, journal_entry_groups: journalEntryGroups })) {
  fs.writeFileSync(path.join(outputRoot, `${name}.json`), `${JSON.stringify(rows, null, 2)}\n`);
}
const index = {
  schema_version: 1,
  dataset: "Victoria 3 original content",
  version: "1.13.9",
  generated_at: new Date().toISOString(),
  game_path: gameRoot.replaceAll("\\", "/"),
  files: {
    journal_entries: "journal_entries.json",
    journal_entry_groups: "journal_entry_groups.json",
    events: "events.json",
    decisions: "decisions.json",
    source_manifest: "content-sources.json",
  },
  counts,
  coverage: {
    journal_entries: localizationCoverage(journalEntries, ["name", "reason", "desc"]),
    journal_entry_groups: localizationCoverage(journalEntryGroups, ["name"]),
    events: localizationCoverage(events, ["title", "desc", "flavor"]),
    decisions: localizationCoverage(decisions, ["name", "desc", "tooltip"]),
  },
  distributions: {
    journal_entry_groups: countBy(journalEntries, "group"),
    event_types: countBy(events, "event_type"),
    event_source_sections: countBy(events, (row) => {
      const parts = row.source_file.split("/");
      return parts.length > 2 ? parts[1] : "(top)";
    }),
  },
  source_manifest: "content-sources.json",
  classification: "All definitions are retained. content_class separates game, test, and debug scripts.",
};
fs.writeFileSync(path.join(outputRoot, "content-index.json"), `${JSON.stringify(index, null, 2)}\n`);
fs.writeFileSync(path.join(outputRoot, "content-sources.json"), `${JSON.stringify(sourceManifest, null, 2)}\n`);
console.log(JSON.stringify(index, null, 2));
