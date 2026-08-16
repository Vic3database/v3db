const COUNTRY_TAG_RE = /\bc:([A-Za-z0-9_]+)\b/g;
const JOURNAL_ID_RE = /\bje_[A-Za-z0-9_]+\b/g;
const MAX_LIMITED_COUNTRIES = 8;
const GROUP_COVERAGE_THRESHOLD = 0.8;

// These namespaces are named for a country-specific historical chain even when
// the country scope is carried by an on-action or a journal entry rather than
// written as c:TAG in each event.
const COUNTRY_SPECIFIC_NAMESPACES = new Set([
  "acw_events",
  "acw_je_events",
  "algeria_events",
  "federation_of_india",
  "fsa_events",
]);
const COUNTRY_SPECIFIC_NAMESPACE_TAGS = {
  acw_events: ["CSA", "FSA", "USA"],
  acw_je_events: ["CSA", "FSA", "USA"],
  algeria_events: ["ALD", "FRA"],
  federation_of_india: ["BHT", "BIC"],
  fsa_events: ["FSA", "USA"],
};

export function extractCountryTags(text) {
  const result = new Set();
  for (const match of String(text || "").matchAll(COUNTRY_TAG_RE)) result.add(match[1].toUpperCase());
  return [...result].sort();
}

export function extractJournalIds(text) {
  return [...new Set([...String(text || "").matchAll(JOURNAL_ID_RE)].map((match) => match[0]))];
}

export function buildEventKindContext(events, journals = []) {
  const groupStats = new Map();
  for (const event of events) {
    const namespace = event.namespace || String(event.id || "").split(".")[0];
    const tags = extractCountryTags(eventEvidenceText(event));
    const stat = groupStats.get(namespace) || { count: 0, tagged: 0, tags: new Set() };
    stat.count += 1;
    if (tags.length) stat.tagged += 1;
    tags.forEach((tag) => stat.tags.add(tag));
    groupStats.set(namespace, stat);
  }

  const journalById = new Map(journals.filter((journal) => journal.content_class === "game").map((journal) => [journal.id, journal]));
  const journalCountryTags = new Map();
  const eventJournalIds = new Map();
  for (const journal of journalById.values()) {
    const tags = extractCountryTags(journal.raw);
    if (isCountrySpecificJournal(journal, tags)) journalCountryTags.set(journal.id, tags);
    for (const eventId of journal.triggered_event_ids || []) addMapSet(eventJournalIds, eventId, journal.id);
  }
  for (const event of events) {
    for (const journalId of extractJournalIds(eventEvidenceText(event))) addMapSet(eventJournalIds, event.id, journalId);
  }

  return { groupStats, journalById, journalCountryTags, eventJournalIds };
}

export function classifyEventEvidence(event, context = {}) {
  const directCountries = extractCountryTags(eventEvidenceText(event));
  const namespace = event.namespace || String(event.id || "").split(".")[0];
  const groupStat = context.groupStats?.get(namespace);
  const groupCountries = [...new Set([
    ...(groupStat ? [...groupStat.tags] : []),
    ...(COUNTRY_SPECIFIC_NAMESPACE_TAGS[namespace] || []),
  ])].sort();
  const groupLimited = COUNTRY_SPECIFIC_NAMESPACES.has(namespace) || isLimitedGroup(groupStat);
  const journalIds = new Set(context.eventJournalIds?.get(event.id) || []);
  for (const journalId of extractJournalIds(eventEvidenceText(event))) journalIds.add(journalId);
  const journalCountries = new Set();
  let journalLimited = false;
  for (const journalId of journalIds) {
    const tags = context.journalCountryTags?.get(journalId);
    if (tags) {
      journalLimited = true;
      tags.forEach((tag) => journalCountries.add(tag));
    }
  }
  const countries = [...new Set([...directCountries, ...groupCountries.filter(() => groupLimited), ...journalCountries])].sort();
  return {
    kind: directCountries.length || groupLimited || journalLimited ? "flavor" : "generic",
    countries,
    evidence: {
      event: directCountries,
      group: groupLimited ? groupCountries : [],
      journals: [...journalCountries].sort(),
    },
  };
}

export function classifyEventKind(event, context = {}) {
  return classifyEventEvidence(event, context).kind;
}

function eventEvidenceText(event) {
  return [event.trigger_raw, event.immediate_raw, ...(event.options || []).map((option) => option.raw), event.raw].filter(Boolean).join("\n");
}

function isLimitedGroup(stat) {
  if (!stat || !stat.tags.size || stat.tags.size > MAX_LIMITED_COUNTRIES) return false;
  return stat.tagged / stat.count >= GROUP_COVERAGE_THRESHOLD;
}

function isCountrySpecificJournal(journal, tags) {
  return tags.length > 0 && tags.length <= MAX_LIMITED_COUNTRIES;
}

function addMapSet(map, key, value) {
  const values = map.get(key) || new Set();
  values.add(value);
  map.set(key, values);
}
