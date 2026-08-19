const OPERATORS = new Set(["=", "?=", "!=", ">", "<", ">=", "<="]);
const NEGATED_KEYS = new Set(["not", "nor"]);
const EVENT_CALL_KEYS = new Set(["trigger_event", "events", "random_events"]);
const JOURNAL_CALL_KEYS = new Set(["add_journal_entry", "activate_journal_entry", "create_journal_entry"]);
const CURRENT_SCOPE_KEYS = new Set(["root", "this"]);
const MAX_LIMITED_COUNTRIES = 8;
const GROUP_COVERAGE_THRESHOLD = 0.8;

export function extractDirectCountryEvidence(row, contentType) {
  const evidence = [];
  for (const [sourceField, raw] of directEvidenceFields(row, contentType)) {
    walkAssignments(parseClausewitz(raw), { negated: false }, (assignment, context) => {
      if (context.negated || typeof assignment.value !== "string" || assignment.op !== "?=") return;
      const leftCountry = countryFromScopeToken(assignment.key);
      const rightCountry = countryFromScopeToken(assignment.value);
      const leftCurrent = isCurrentScopeToken(assignment.key);
      const rightCurrent = isCurrentScopeToken(assignment.value);
      const country = leftCountry && rightCurrent ? leftCountry : rightCountry && leftCurrent ? rightCountry : "";
      if (!country) return;
      evidence.push({
        country,
        kind: "direct",
        source_field: sourceField,
        expression: `${assignment.key} ${assignment.op} ${assignment.value}`,
      });
    });
  }
  return uniqueBy(evidence, (item) => item.country);
}

export function extractScopedContentRelations(row, contentType) {
  const relations = [];
  walkRelationAssignments(parseClausewitz(row?.raw || relationFallbackRaw(row, contentType)), { kind: "current", country: "" }, (assignment, scope) => {
    const key = String(assignment.key || "").toLowerCase();
    if (EVENT_CALL_KEYS.has(key)) {
      for (const targetId of eventTargets(assignment.value)) {
        relations.push(makeRelation(row, contentType, "event", targetId, scope));
      }
    }
    if (JOURNAL_CALL_KEYS.has(key)) {
      for (const targetId of journalTargets(assignment.value)) {
        relations.push(makeRelation(row, contentType, "journal", targetId, scope));
      }
    }
  });
  return uniqueBy(relations, (item) => [item.source_node_id, item.target_kind, item.target_id, item.scope_kind, item.country].join("|"));
}

export function classifyContentCountryScopes({
  journals = [],
  events = [],
  decisions = [],
  overrides = [],
  stableEventGroups = {},
} = {}) {
  const records = normalizeContentRecords({ journals, events, decisions });
  const byId = new Map(records.map((record) => [record.node_id, record]));
  const relations = records.flatMap((record) => extractScopedContentRelations(record.row, record.content_type));
  const exclusions = new Set();

  for (const record of records) {
    for (const evidence of extractDirectCountryEvidence(record.row, record.content_type)) {
      addEvidence(record, {
        ...evidence,
        origin_node_id: record.node_id,
        source_node_id: record.node_id,
      });
    }
  }

  const groupAudit = applyGroupEvidence(records, stableEventGroups);
  const appliedOverrides = [];
  for (const override of overrides || []) {
    const contentType = normalizeContentType(override.content_type);
    const nodeId = `${contentType}:${override.content_id}`;
    const country = String(override.country || "").toUpperCase();
    const record = byId.get(nodeId);
    if (!record || !country) continue;
    appliedOverrides.push({ ...override, content_type: contentType, country });
    if (override.action === "exclude") {
      exclusions.add(`${nodeId}|${country}`);
      record.country_scope_evidence = record.country_scope_evidence.filter((item) => item.country !== country);
      continue;
    }
    if (override.action === "add") {
      addEvidence(record, {
        country,
        kind: "override",
        reason: override.reason || "",
        source_file: override.source_file || "",
        source_line: Number(override.source_line || 0),
        origin_node_id: nodeId,
        source_node_id: nodeId,
      });
    }
  }

  const invalidTargets = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const relation of relations) {
      const source = byId.get(relation.source_node_id);
      const targetNodeId = `${relation.target_kind}:${relation.target_id}`;
      const target = byId.get(targetNodeId);
      if (!target) {
        invalidTargets.push(relation);
        continue;
      }
      if (relation.scope_kind === "unknown") continue;
      const inherited = relation.scope_kind === "country"
        ? [{ country: relation.country, origin_node_id: relation.source_node_id }]
        : (source?.country_scope_evidence || []).map((item) => ({ country: item.country, origin_node_id: item.origin_node_id || source.node_id }));
      for (const item of inherited) {
        if (!item.country || exclusions.has(`${targetNodeId}|${item.country}`)) continue;
        changed = addEvidence(target, {
          country: item.country,
          kind: "inherited",
          source_node_id: relation.source_node_id,
          origin_node_id: item.origin_node_id,
          relation_kind: relation.target_kind,
          scope_kind: relation.scope_kind,
        }) || changed;
      }
    }
  }

  for (const record of records) {
    record.country_scope_evidence.sort(compareEvidence);
    record.country_scope = [...new Set(record.country_scope_evidence.map((item) => item.country))].sort();
    record.content_kind = record.country_scope.length ? "flavor" : "generic";
  }

  return {
    records,
    by_id: byId,
    relations,
    audit: {
      group_stats: groupAudit.stats,
      group_conflicts: groupAudit.conflicts,
      invalid_targets: uniqueBy(invalidTargets, (item) => [item.source_node_id, item.target_kind, item.target_id].join("|")),
      overrides: appliedOverrides,
    },
  };
}

export function buildContentByCountry({ journals = [], events = [], decisions = [] } = {}, validCountryTags = []) {
  const valid = new Set([...validCountryTags].map((tag) => String(tag).toUpperCase()));
  const result = {};
  const addRows = (rows, bucketName) => {
    for (const row of rows) {
      const id = String(row?.id || row?.key || row?.script_key || "");
      if (!id) continue;
      for (const rawTag of row?.country_scope || []) {
        const tag = String(rawTag).toUpperCase();
        if (valid.size && !valid.has(tag)) continue;
        const bucket = result[tag] || { journals: [], events: [], decisions: [] };
        if (!bucket[bucketName].includes(id)) bucket[bucketName].push(id);
        result[tag] = bucket;
      }
    }
  };
  addRows(journals, "journals");
  addRows(events, "events");
  addRows(decisions, "decisions");
  for (const bucket of Object.values(result)) {
    bucket.journals.sort(naturalCompare);
    bucket.events.sort(naturalCompare);
    bucket.decisions.sort(naturalCompare);
  }
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right)));
}

function directEvidenceFields(row, contentType) {
  if (contentType === "journal") return [
    ["is_shown_when_inactive_raw", row?.is_shown_when_inactive_raw],
    ["possible_raw", row?.possible_raw],
  ].filter(([, raw]) => raw);
  if (contentType === "event") return [["trigger_raw", row?.trigger_raw]].filter(([, raw]) => raw);
  if (contentType === "decision") return [
    ["is_shown_raw", row?.is_shown_raw],
    ["possible_raw", row?.possible_raw],
  ].filter(([, raw]) => raw);
  return [];
}

function normalizeContentRecords({ journals, events, decisions }) {
  return [
    ...journals.map((row) => normalizeRecord(row, "journal")),
    ...events.map((row) => normalizeRecord(row, "event")),
    ...decisions.map((row) => normalizeRecord(row, "decision")),
  ];
}

function normalizeRecord(row, contentType) {
  const id = String(row?.id || row?.key || row?.script_key || "");
  return {
    node_id: `${contentType}:${id}`,
    id,
    content_type: contentType,
    group: contentGroup(row, contentType),
    row,
    country_scope: [],
    country_scope_evidence: [],
    content_kind: "generic",
  };
}

function contentGroup(row, contentType) {
  if (contentType === "event") return row?.namespace || String(row?.id || "").split(".")[0];
  if (contentType === "journal") return row?.group || row?.group_id || "";
  return row?.source_file || row?.group || "";
}

function applyGroupEvidence(records, stableEventGroups) {
  const groups = new Map();
  for (const record of records) {
    if (record.row?.content_class && record.row.content_class !== "game") continue;
    const key = `${record.content_type}:${record.group}`;
    const members = groups.get(key) || [];
    members.push(record);
    groups.set(key, members);
  }

  const stats = [];
  const conflicts = [];
  for (const [key, members] of groups) {
    const [contentType, ...groupParts] = key.split(":");
    const group = groupParts.join(":");
    const directMembers = members.filter((record) => record.country_scope_evidence.some((item) => item.kind === "direct"));
    const directCountries = [...new Set(directMembers.flatMap((record) => record.country_scope_evidence.filter((item) => item.kind === "direct").map((item) => item.country)))].sort();
    const stable = contentType === "event" ? stableEventGroups?.[group] : null;
    const countries = stable?.countries?.map((tag) => String(tag).toUpperCase()) || directCountries;
    const coverage = members.length ? directMembers.length / members.length : 0;
    const accepted = Boolean(stable) || (countries.length > 0 && countries.length <= MAX_LIMITED_COUNTRIES && coverage >= GROUP_COVERAGE_THRESHOLD);
    stats.push({ content_type: contentType, group, members: members.length, direct_members: directMembers.length, coverage, countries, accepted, source: stable ? "stable" : "statistical" });
    if (!accepted) continue;
    for (const record of members) {
      const direct = record.country_scope_evidence.filter((item) => item.kind === "direct").map((item) => item.country);
      if (direct.length) {
        const outside = direct.filter((country) => !countries.includes(country));
        if (outside.length) conflicts.push({ node_id: record.node_id, group, direct_countries: direct, group_countries: countries, outside });
        continue;
      }
      for (const country of countries) {
        addEvidence(record, {
          country,
          kind: "group",
          group,
          group_source: stable ? "stable" : "statistical",
          source_file: stable?.source_file || "",
          source_line: Number(stable?.source_line || 0),
          coverage,
          origin_node_id: record.node_id,
          source_node_id: record.node_id,
        });
      }
    }
  }
  return { stats, conflicts };
}

function addEvidence(record, evidence) {
  if (!record || !evidence?.country) return false;
  const normalized = { ...evidence, country: String(evidence.country).toUpperCase() };
  const signature = evidenceSignature(normalized);
  if (record.country_scope_evidence.some((item) => evidenceSignature(item) === signature)) return false;
  record.country_scope_evidence.push(normalized);
  return true;
}

function evidenceSignature(item) {
  return [item.country, item.kind, item.source_field || "", item.expression || "", item.group || "", item.source_node_id || "", item.origin_node_id || "", item.scope_kind || ""].join("|");
}

function compareEvidence(left, right) {
  const order = { direct: 0, override: 1, group: 2, inherited: 3 };
  return (order[left.kind] ?? 9) - (order[right.kind] ?? 9)
    || left.country.localeCompare(right.country)
    || evidenceSignature(left).localeCompare(evidenceSignature(right));
}

function relationFallbackRaw(row, contentType) {
  if (contentType === "journal") return [row?.on_activate_raw, row?.on_complete_raw, row?.on_fail_raw].filter(Boolean).join("\n");
  if (contentType === "event") return [row?.immediate_raw, ...(row?.options || []).map((option) => option.raw)].filter(Boolean).join("\n");
  if (contentType === "decision") return row?.when_taken_raw || "";
  return "";
}

function makeRelation(row, contentType, targetKind, targetId, scope) {
  const id = String(row?.id || row?.key || row?.script_key || "");
  return {
    source_node_id: `${normalizeContentType(contentType)}:${id}`,
    source_kind: normalizeContentType(contentType),
    source_id: id,
    target_kind: targetKind,
    target_id: targetId,
    scope_kind: scope.kind,
    country: scope.country || "",
  };
}

function normalizeContentType(value) {
  const type = String(value || "").toLowerCase();
  if (type === "journal_entry" || type === "journals") return "journal";
  if (type === "events") return "event";
  if (type === "decisions") return "decision";
  return type;
}

function eventTargets(value) {
  if (typeof value === "string") return isEventId(value) ? [value] : [];
  const result = [];
  for (const item of value || []) {
    if (item.type === "value" && isEventId(item.value)) result.push(item.value);
    if (item.type !== "assignment") continue;
    const key = String(item.key || "").toLowerCase();
    if ((key === "id" || /^\d+$/.test(key)) && typeof item.value === "string" && isEventId(item.value)) result.push(item.value);
    if (Array.isArray(item.value)) result.push(...eventTargets(item.value));
  }
  return uniqueBy(result, (item) => item);
}

function journalTargets(value) {
  if (typeof value === "string") return isJournalId(value) ? [value] : [];
  const result = [];
  for (const item of value || []) {
    if (item.type !== "assignment") continue;
    const key = String(item.key || "").toLowerCase();
    if ((key === "type" || key === "id" || key === "journal_entry") && typeof item.value === "string" && isJournalId(item.value)) result.push(item.value);
  }
  return uniqueBy(result, (item) => item);
}

function isEventId(value) {
  return /^[A-Za-z0-9_:-]+\.[A-Za-z0-9_:-]+$/.test(String(value || ""));
}

function isJournalId(value) {
  return /^[A-Za-z0-9_:-]+$/.test(String(value || "")) && !["yes", "no"].includes(String(value).toLowerCase());
}

function walkAssignments(items, context, visit) {
  for (const item of items || []) {
    if (item.type !== "assignment") continue;
    visit(item, context);
    if (!Array.isArray(item.value)) continue;
    const key = String(item.key || "").toLowerCase();
    walkAssignments(item.value, { ...context, negated: context.negated || NEGATED_KEYS.has(key) }, visit);
  }
}

function walkRelationAssignments(items, scope, visit) {
  for (const item of items || []) {
    if (item.type !== "assignment") continue;
    visit(item, scope);
    if (!Array.isArray(item.value)) continue;
    const key = String(item.key || "");
    let nextScope = scope;
    const country = countryFromScopeToken(key);
    if (country) nextScope = { kind: "country", country };
    else if (isUnknownCountryScope(key)) nextScope = { kind: "unknown", country: "" };
    else if (CURRENT_SCOPE_KEYS.has(key.toLowerCase())) nextScope = { kind: "current", country: "" };
    walkRelationAssignments(item.value, nextScope, visit);
  }
}

function isUnknownCountryScope(key) {
  const normalized = String(key || "").toLowerCase();
  if (normalized.startsWith("scope:") || normalized.startsWith("var:")) return true;
  if (["owner", "controller", "country", "prev", "create_country"].includes(normalized)) return true;
  return /^(?:random_|any_|every_|ordered_).*(?:country|subject)/.test(normalized)
    || /(?:^|_)(?:country|subject)(?:_|$)/.test(normalized) && /^(?:random|any|every|ordered|target|scope|saved)/.test(normalized);
}

function countryFromScopeToken(value) {
  const match = String(value || "").match(/^c:([A-Za-z0-9_]+)$/i);
  return match ? match[1].toUpperCase() : "";
}

function isCurrentScopeToken(value) {
  return /^(?:ROOT|root|this)$/i.test(String(value || ""));
}

function parseClausewitz(raw) {
  const tokens = tokenizeClausewitz(raw);
  let index = 0;
  const parseItems = (stopAtBrace = false) => {
    const items = [];
    while (index < tokens.length) {
      if (tokens[index] === "}") {
        index += 1;
        if (stopAtBrace) break;
        continue;
      }
      if (tokens[index] === "{") {
        index += 1;
        items.push(...parseItems(true));
        continue;
      }
      const key = tokens[index++];
      const op = OPERATORS.has(tokens[index]) ? tokens[index++] : "";
      if (!op) {
        items.push({ type: "value", value: key });
        continue;
      }
      if (tokens[index] === "{") {
        index += 1;
        items.push({ type: "assignment", key, op, value: parseItems(true) });
      } else {
        items.push({ type: "assignment", key, op, value: tokens[index++] || "" });
      }
    }
    return items;
  };
  return parseItems(false);
}

function tokenizeClausewitz(raw) {
  const text = String(raw || "");
  const tokens = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) { index += 1; continue; }
    if (char === "#") {
      while (index < text.length && text[index] !== "\n") index += 1;
      continue;
    }
    if (char === '"') {
      index += 1;
      let value = "";
      while (index < text.length && text[index] !== '"') {
        if (text[index] === "\\" && index + 1 < text.length) value += text[index++];
        value += text[index++];
      }
      index += 1;
      tokens.push(value);
      continue;
    }
    const two = text.slice(index, index + 2);
    if (["?=", "!=", ">=", "<="].includes(two)) {
      tokens.push(two);
      index += 2;
      continue;
    }
    if (["{", "}", "=", ">", "<"].includes(char)) {
      tokens.push(char);
      index += 1;
      continue;
    }
    const start = index;
    while (index < text.length && !/[\s#{}=<>?\"]/.test(text[index])) index += 1;
    if (index > start) tokens.push(text.slice(start, index));
    else index += 1;
  }
  return tokens;
}

function uniqueBy(values, keyOf) {
  const seen = new Set();
  return values.filter((value) => {
    const key = keyOf(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function naturalCompare(left, right) {
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
}
