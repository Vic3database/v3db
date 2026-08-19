import fs from "node:fs";
import path from "node:path";
import { classifyContentCountryScopes } from "./content_country_scope.mjs";
import { CONTENT_COUNTRY_SCOPE_OVERRIDES, STABLE_EVENT_GROUP_COUNTRIES } from "./content_country_scope_overrides.mjs";

const root = process.cwd();
const args = parseArgs(process.argv.slice(2));
const version = args.version || process.env.VICTORIA3_VERSION || "1.13.11";
const database = path.resolve(args.database || path.join(root, "database", `vic3_${version}`));
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(database, name), "utf8").replace(/^\uFEFF/, ""));

const journalEntries = readJson("journal_entries.json");
const events = readJson("events.json");
const decisions = readJson("decisions.json");
const gameRows = (rows) => rows.filter((row) => row.content_class === "game");
const classification = classifyContentCountryScopes({
  journals: gameRows(journalEntries),
  events: gameRows(events),
  decisions: gameRows(decisions),
  overrides: CONTENT_COUNTRY_SCOPE_OVERRIDES,
  stableEventGroups: STABLE_EVENT_GROUP_COUNTRIES,
});

for (const rows of [journalEntries, events, decisions]) {
  for (const row of rows) {
    row.country_scope = [];
    row.country_scope_evidence = [];
    row.content_kind = "generic";
    if (rows === events) row.event_kind = "generic";
  }
}
for (const record of classification.records) {
  record.row.country_scope = record.country_scope;
  record.row.country_scope_evidence = record.country_scope_evidence;
  record.row.content_kind = record.content_kind;
  if (record.content_type === "event") record.row.event_kind = record.content_kind;
}

const countries = readJson("countries.json");
const validCountryTags = new Set(countries.map((country) => country.tag || country.id).filter(Boolean));
const audit = buildAudit({ version, journalEntries, events, decisions, classification, validCountryTags });
for (const [name, rows] of [["journal_entries", journalEntries], ["events", events], ["decisions", decisions]]) {
  fs.writeFileSync(path.join(database, `${name}.json`), `${JSON.stringify(rows, null, 2)}\n`, "utf8");
}
fs.writeFileSync(path.join(database, "content-country-association-audit.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8");

const indexFile = path.join(database, "content-index.json");
const index = JSON.parse(fs.readFileSync(indexFile, "utf8").replace(/^\uFEFF/, ""));
index.files.country_association_audit = "content-country-association-audit.json";
index.classification = "Definitions retain content_class and use direct actor conditions, stable groups, scoped content relations, and reviewed overrides to classify country scope.";
fs.writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  vanilla_content_country_data: "ok",
  version,
  content: audit.content,
  evidence: audit.evidence,
  countries_with_content: audit.countries_with_content,
}, null, 2));

function buildAudit({ version, journalEntries, events, decisions, classification, validCountryTags }) {
  const collections = { journal: journalEntries, event: events, decision: decisions };
  const content = Object.fromEntries(Object.entries(collections).map(([kind, rows]) => [kind, {
    total: rows.length,
    game: rows.filter((row) => row.content_class === "game").length,
    flavor: rows.filter((row) => row.content_class === "game" && row.content_kind === "flavor").length,
    generic: rows.filter((row) => row.content_class === "game" && row.content_kind === "generic").length,
  }]));
  const evidence = { direct: 0, group: 0, inherited: 0, override: 0 };
  for (const item of classification.records.flatMap((record) => record.country_scope_evidence)) evidence[item.kind] = (evidence[item.kind] || 0) + 1;
  const relationScopes = { current: 0, country: 0, unknown: 0 };
  for (const relation of classification.relations) relationScopes[relation.scope_kind] = (relationScopes[relation.scope_kind] || 0) + 1;
  const unresolved = [...new Set(classification.records.flatMap((record) => record.country_scope).filter((tag) => !validCountryTags.has(tag)))].sort();
  return {
    schema_version: 1,
    dataset: "Victoria 3 original content country associations",
    version,
    rules: {
      group_coverage_threshold: 0.8,
      maximum_group_countries: 8,
      excluded_propagation_scope: "unknown",
      database_scope: "game definitions are classified; test and debug definitions retain empty scopes",
    },
    content,
    evidence,
    countries_with_content: new Set(classification.records.flatMap((record) => record.country_scope).filter((tag) => validCountryTags.has(tag))).size,
    unresolved_country_tags: unresolved,
    groups: {
      total: classification.audit.group_stats.length,
      accepted: classification.audit.group_stats.filter((group) => group.accepted).length,
      conflicts: classification.audit.group_conflicts,
      stats: classification.audit.group_stats,
    },
    relations: {
      total: classification.relations.length,
      scopes: relationScopes,
      invalid_targets: classification.audit.invalid_targets,
    },
    overrides: classification.audit.overrides,
  };
}

function parseArgs(values) {
  const parsed = { version: "", database: "" };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--version" || value === "--database") {
      const key = value.slice(2);
      parsed[key] = values[index + 1] || "";
      if (!parsed[key]) throw new Error(`Missing value for ${value}`);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return parsed;
}
