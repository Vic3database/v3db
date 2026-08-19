import assert from "node:assert/strict";
import {
  classifyContentCountryScopes,
  extractDirectCountryEvidence,
  extractScopedContentRelations,
} from "./content_country_scope.mjs";

const decision = {
  id: "decision_austria",
  source_file: "common/decisions/austria.txt",
  content_class: "game",
  is_shown_raw: `is_shown = {
    c:AUS ?= ROOT
    NOT = { c:HUN ?= ROOT }
  }`,
  possible_raw: `possible = { ROOT ?= c:AUS }`,
  when_taken_raw: `when_taken = {
    trigger_event = { id = austria_events.1 }
    c:HUN = { trigger_event = { id = hungary_events.1 } }
    random_country = { trigger_event = { id = unknown_events.1 } }
    add_journal_entry = { type = je_austria }
  }`,
  raw: `decision_austria = {
    when_taken = {
      trigger_event = { id = austria_events.1 }
      c:HUN = { trigger_event = { id = hungary_events.1 } }
      random_country = { trigger_event = { id = unknown_events.1 } }
      add_journal_entry = { type = je_austria }
    }
  }`,
};

assert.deepEqual(
  extractDirectCountryEvidence(decision, "decision").map((item) => item.country),
  ["AUS"],
  "否定条件中的匈牙利不能成为主体国家",
);
assert.deepEqual(
  extractScopedContentRelations(decision, "decision").map(({ target_kind, target_id, scope_kind, country }) => ({ target_kind, target_id, scope_kind, country })),
  [
    { target_kind: "event", target_id: "austria_events.1", scope_kind: "current", country: "" },
    { target_kind: "event", target_id: "hungary_events.1", scope_kind: "country", country: "HUN" },
    { target_kind: "event", target_id: "unknown_events.1", scope_kind: "unknown", country: "" },
    { target_kind: "journal", target_id: "je_austria", scope_kind: "current", country: "" },
  ],
  "带作用域的内容调用解析错误",
);

const groupEvents = Array.from({ length: 9 }, (_, index) => ({
  id: `britain_events.${index + 1}`,
  namespace: "britain_events",
  content_class: "game",
  trigger_raw: index < 8 ? "trigger = { c:GBR ?= ROOT }" : "trigger = { always = yes }",
  raw: index === 0
    ? "britain_events.1 = { trigger_event = { id = britain_events.2 } }"
    : `britain_events.${index + 1} = {}`,
}));

const graph = classifyContentCountryScopes({
  journals: [{ id: "je_austria", group: "je_group_austria", content_class: "game", raw: "je_austria = {}" }],
  events: [
    ...groupEvents,
    { id: "austria_events.1", namespace: "austria_events", content_class: "game", raw: "austria_events.1 = { add_journal_entry = { type = je_austria } }", trigger_raw: "" },
    { id: "hungary_events.1", namespace: "hungary_events", content_class: "game", raw: "hungary_events.1 = {}", trigger_raw: "" },
    { id: "unknown_events.1", namespace: "unknown_events", content_class: "game", raw: "unknown_events.1 = {}", trigger_raw: "" },
  ],
  decisions: [decision],
  overrides: [],
});

assert.deepEqual(graph.by_id.get("event:britain_events.9").country_scope, ["GBR"]);
assert.equal(graph.by_id.get("event:britain_events.9").country_scope_evidence[0].kind, "group");
assert.deepEqual(graph.by_id.get("event:austria_events.1").country_scope, ["AUS"]);
assert.deepEqual(graph.by_id.get("journal:je_austria").country_scope, ["AUS"]);
assert.deepEqual(graph.by_id.get("event:hungary_events.1").country_scope, ["HUN"]);
assert.deepEqual(graph.by_id.get("event:unknown_events.1").country_scope, []);
assert.equal(graph.by_id.get("journal:je_austria").content_kind, "flavor");

const overridden = classifyContentCountryScopes({
  journals: [],
  events: [{ id: "override_events.1", namespace: "override_events", content_class: "game", raw: "override_events.1 = {}", trigger_raw: "trigger = { c:FRA ?= ROOT }" }],
  decisions: [],
  overrides: [
    { action: "add", content_type: "event", content_id: "override_events.1", country: "BEL", reason: "测试人工增加", source_file: "events/override_events.txt", source_line: 1 },
    { action: "exclude", content_type: "event", content_id: "override_events.1", country: "FRA", reason: "测试人工排除", source_file: "events/override_events.txt", source_line: 2 },
  ],
});
assert.deepEqual(overridden.by_id.get("event:override_events.1").country_scope, ["BEL"]);
assert.equal(overridden.by_id.get("event:override_events.1").country_scope_evidence[0].kind, "override");

console.log(JSON.stringify({ content_country_scope_unit: "ok" }, null, 2));
