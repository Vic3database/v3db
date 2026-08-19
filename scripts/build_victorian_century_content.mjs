import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { applyContentLocalizationOverrides } from "./content_localization_overrides.mjs";
import { classifyContentCountryScopes } from "./content_country_scope.mjs";
import { CONTENT_COUNTRY_SCOPE_OVERRIDES, STABLE_EVENT_GROUP_COUNTRIES } from "./content_country_scope_overrides.mjs";

const root = process.cwd();
const vanillaSource = process.env.VIC3_GAME_ROOT || "D:/SteamLibrary/steamapps/common/Victoria 3/game";
const vcSource = process.env.VICTORIAN_CENTURY_MOD_ROOT || "D:/SteamLibrary/steamapps/workshop/content/529340/3219394272";
const outputRoot = path.join(root, "database", "victorian_century");
const builder = path.join(root, "scripts", "build_content_data.mjs");
const version = process.env.VICTORIA3_VERSION || "1.13.11";
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vicdata-content-"));

try {
  const vanilla = buildSource("vanilla", vanillaSource);
  const vc = buildSource("vc", vcSource);
  backfillMissingLocales(vc, vanilla);
  const kinds = ["journal_entries", "journal_entry_groups", "events", "decisions"];
  const merged = Object.fromEntries(kinds.map((kind) => [kind, mergeRows(vanilla[kind], vc[kind])]));
  applyContentLocalizationOverrides({ events: merged.events, journalEntries: merged.journal_entries, journalEntryGroups: merged.journal_entry_groups, decisions: merged.decisions });
  const classification = classifyContentCountryScopes({
    journals: merged.journal_entries,
    events: merged.events,
    decisions: merged.decisions,
    overrides: CONTENT_COUNTRY_SCOPE_OVERRIDES,
    stableEventGroups: STABLE_EVENT_GROUP_COUNTRIES,
  });
  for (const record of classification.records) {
    record.row.country_scope = record.country_scope;
    record.row.country_scope_evidence = record.country_scope_evidence;
    record.row.content_kind = record.content_kind;
    if (record.content_type === "event") record.row.event_kind = record.content_kind;
  }
  const counts = Object.fromEntries(kinds.map((kind) => [kind, merged[kind].length]));
  counts.journal_entries_game = countGame(merged.journal_entries);
  counts.events_game = countGame(merged.events);
  counts.decisions_game = countGame(merged.decisions);
  counts.journal_entry_groups_game = countGame(merged.journal_entry_groups);
  counts.event_options = merged.events.reduce((total, event) => total + (event.options?.length || 0), 0);

  fs.mkdirSync(outputRoot, { recursive: true });
  for (const kind of kinds) fs.writeFileSync(path.join(outputRoot, `${kind}.json`), `${JSON.stringify(merged[kind], null, 2)}\n`, "utf8");
  const associationAudit = buildCountryAssociationAudit(classification, merged);
  fs.writeFileSync(path.join(outputRoot, "content-country-association-audit.json"), `${JSON.stringify(associationAudit, null, 2)}\n`, "utf8");
  const sourceManifest = {
    vanilla: vanilla.sourceManifest,
    vc: vc.sourceManifest,
  };
  fs.writeFileSync(path.join(outputRoot, "content-sources.json"), `${JSON.stringify(sourceManifest, null, 2)}\n`, "utf8");
  const index = {
    schema_version: 1,
    dataset: "Victorian Century merged content",
    version,
    generated_at: new Date().toISOString(),
    game_path: vanillaSource.replaceAll("\\", "/"),
    mod_path: vcSource.replaceAll("\\", "/"),
    files: {
      journal_entries: "journal_entries.json",
      journal_entry_groups: "journal_entry_groups.json",
      events: "events.json",
      decisions: "decisions.json",
      source_manifest: "content-sources.json",
      country_association_audit: "content-country-association-audit.json",
    },
    counts,
    sources: {
      vanilla: { root: vanillaSource.replaceAll("\\", "/"), counts: summarize(vanilla) },
      vc: { root: vcSource.replaceAll("\\", "/"), counts: summarize(vc) },
    },
    merge: {
      key: "id",
      precedence: ["vc", "vanilla"],
      overridden: Object.fromEntries(kinds.map((kind) => [kind, merged[kind].filter((row) => row.sources.length > 1).length])),
      vc_only: Object.fromEntries(kinds.map((kind) => [kind, merged[kind].filter((row) => row.sources.length === 1 && row.sources[0] === "vc").length])),
    },
    classification: "Merged definitions retain the VC definition on duplicate IDs, expose source provenance, and classify content countries from direct actor conditions, stable groups, scoped relations, and reviewed overrides.",
    source_manifest: "content-sources.json",
  };
  fs.writeFileSync(path.join(outputRoot, "content-index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ victorian_century_content_build: "ok", counts, merge: index.merge }, null, 2));
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

function buildSource(sourceName, sourceRoot) {
  if (!fs.existsSync(sourceRoot)) throw new Error(`Missing ${sourceName} content root: ${sourceRoot}`);
  const output = path.join(temporaryRoot, sourceName);
  const result = spawnSync(process.execPath, [builder], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CONTENT_SOURCE_ROOT: sourceRoot, CONTENT_OUTPUT_ROOT: output, CONTENT_DATASET: `${sourceName} content`, CONTENT_VERSION: version, CONTENT_INFER_REFERENCED_JOURNAL_GROUPS: "1", ...(sourceName === "vc" ? { CONTENT_FALLBACK_LOCALIZATION_ROOTS: vanillaSource } : {}) },
  });
  if (result.status !== 0) throw new Error(`${sourceName} content build failed:\n${result.stdout}\n${result.stderr}`.trim());
  return {
    ...Object.fromEntries(["journal_entries", "journal_entry_groups", "events", "decisions"].map((kind) => [kind, JSON.parse(fs.readFileSync(path.join(output, `${kind}.json`), "utf8"))])),
    sourceManifest: JSON.parse(fs.readFileSync(path.join(output, "content-sources.json"), "utf8")),
  };
}

function backfillMissingLocales(target, fallback) {
  for (const kind of ["journal_entries", "journal_entry_groups", "events", "decisions"]) {
    const fallbackById = new Map(fallback[kind].map((row) => [row.id, row]));
    for (const row of target[kind]) {
      const fallbackRow = fallbackById.get(row.id);
      if (!fallbackRow) continue;
      for (const locale of ["en", "zhHans"]) row.locales[locale] = mergeMissingLocale(row.locales?.[locale], fallbackRow.locales?.[locale]);
    }
  }
}

function mergeMissingLocale(preferred = {}, fallback = {}) {
  const result = { ...fallback, ...preferred };
  for (const field of ["title", "desc", "flavor", "name", "reason", "tooltip"]) {
    if (!preferred?.[field] && fallback?.[field]) result[field] = fallback[field];
  }
  result.options = { ...(fallback?.options || {}), ...(preferred?.options || {}) };
  for (const [key, value] of Object.entries(fallback?.options || {})) if (!preferred?.options?.[key] && value) result.options[key] = value;
  if (!Object.keys(result.options).length) delete result.options;
  return result;
}

function mergeRows(vanillaRows, vcRows) {
  const byId = new Map(vanillaRows.map((row) => [row.id, { ...row, sources: ["vanilla"], source_files: [{ source: "vanilla", file: row.source_file, line: row.source_line || 0 }] }]));
  for (const row of vcRows) {
    const existing = byId.get(row.id);
    if (!existing) {
      byId.set(row.id, { ...row, sources: ["vc"], vc_change_kind: "added", source_files: [{ source: "vc", file: row.source_file, line: row.source_line || 0 }] });
      continue;
    }
    const changed = JSON.stringify({ raw: existing.raw || "", locales: existing.locales || {} }) !== JSON.stringify({ raw: row.raw || "", locales: row.locales || {} });
    byId.set(row.id, {
      ...row,
      sources: ["vanilla", "vc"],
      ...(changed ? { vc_change_kind: "adjusted" } : {}),
      source_files: [
        ...(existing.source_files || []),
        { source: "vc", file: row.source_file, line: row.source_line || 0 },
      ],
      overridden_vanilla: true,
    });
  }
  return [...byId.values()].sort((left, right) => String(left.id).localeCompare(String(right.id), undefined, { numeric: true }));
}

function countGame(rows) { return rows.filter((row) => row.content_class === "game").length; }
function summarize(data) {
  return Object.fromEntries(["journal_entries", "journal_entry_groups", "events", "decisions"].map((kind) => [kind, data[kind].length]));
}

function buildCountryAssociationAudit(classification, merged) {
  const countryFile = path.join(outputRoot, "countries.json");
  const countries = fs.existsSync(countryFile) ? readJson(countryFile) : [];
  const validTags = new Set(countries.map((country) => country.tag || country.id).filter(Boolean));
  const unresolvedCountryTags = [...new Set(classification.records.flatMap((record) => record.country_scope).filter((tag) => !validTags.has(tag)))].sort();
  const evidence = { direct: 0, group: 0, inherited: 0, override: 0 };
  for (const item of classification.records.flatMap((record) => record.country_scope_evidence)) evidence[item.kind] = (evidence[item.kind] || 0) + 1;
  const relationScopes = { current: 0, country: 0, unknown: 0 };
  for (const relation of classification.relations) relationScopes[relation.scope_kind] = (relationScopes[relation.scope_kind] || 0) + 1;
  const collections = {
    journal: merged.journal_entries,
    event: merged.events,
    decision: merged.decisions,
  };
  const content = Object.fromEntries(Object.entries(collections).map(([kind, rows]) => [kind, {
    total: rows.length,
    game: rows.filter((row) => row.content_class === "game").length,
    flavor: rows.filter((row) => row.content_kind === "flavor").length,
    generic: rows.filter((row) => row.content_kind === "generic").length,
  }]));
  const baseline = loadVanillaEventBaseline();
  const mergedById = new Map(merged.events.map((event) => [event.id, event]));
  const reclassifiedScopes = baseline.events.flatMap((event) => {
    const mergedEvent = mergedById.get(event.key || event.id?.replace(/^event:/, ""));
    if (!mergedEvent) return [];
    const previous = [...new Set(event.country_scope || [])].sort();
    const current = [...new Set(mergedEvent.country_scope || [])].sort();
    return JSON.stringify(previous) === JSON.stringify(current) ? [] : [{ id: mergedEvent.id, previous, current }];
  });
  return {
    schema_version: 1,
    dataset: "Victorian Century merged content",
    version,
    generated_at: new Date().toISOString(),
    rules: {
      direct_fields: {
        journal: ["is_shown_when_inactive_raw", "possible_raw"],
        event: ["trigger_raw"],
        decision: ["is_shown_raw", "possible_raw"],
      },
      group_coverage_threshold: 0.8,
      maximum_group_countries: 8,
      propagation_scopes: ["current", "country"],
      excluded_propagation_scope: "unknown",
    },
    content,
    evidence,
    countries_with_content: new Set(classification.records.flatMap((record) => record.country_scope).filter((tag) => validTags.has(tag))).size,
    unresolved_country_tags: unresolvedCountryTags,
    groups: {
      total: classification.audit.group_stats.length,
      accepted: classification.audit.group_stats.filter((group) => group.accepted).length,
      conflicts: classification.audit.group_conflicts,
      stats: classification.audit.group_stats,
    },
    relations: { total: classification.relations.length, by_scope: relationScopes },
    invalid_targets: classification.audit.invalid_targets,
    overrides: classification.audit.overrides,
    [`vanilla_${version.replaceAll(".", "_")}_event_baseline`]: {
      total: baseline.events.length,
      flavor: baseline.events.filter((event) => event.event_kind === "flavor").length,
      generic: baseline.events.filter((event) => event.event_kind === "generic").length,
      reclassified_scopes: reclassifiedScopes,
    },
  };
}

function loadVanillaEventBaseline() {
  const file = path.join(root, "site", "versions", version, "data-events.js");
  if (!fs.existsSync(file)) return { events: [] };
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox.window.VIC3_DATA_CHUNK || { events: [] };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}
