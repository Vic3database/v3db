import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const database = path.resolve("database/victorian_century");
const rows = (name) => JSON.parse(fs.readFileSync(path.join(database, `${name}.json`), "utf8").replace(/^\uFEFF/, ""));
const events = rows("events");
const journals = rows("journal_entries");
const groups = rows("journal_entry_groups");
const decisions = rows("decisions");

const acre = events.find((row) => row.id === "acre_dispute.1");
assert.equal(acre?.locales?.zhHans?.title, "阿克里纠纷", "official event localization must survive the VC merge");
assert.equal(acre?.locales?.zhHans?.options?.["acre_dispute.1.a"], "阿克里理应属于[ROOT.GetCountry.GetAdjective]。", "official event option localization must survive the VC merge");

const dynamicTitle = events.find((row) => row.id === "acw_events.9");
assert.equal(dynamicTitle?.locales?.zhHans?.title, "星杠旗（美利坚联盟国国旗）／给我的自由", "the official Stars and Bars title needs an explanatory display label");

const journalGroups = new Map(groups.map((row) => [row.id, row]));
for (const group of new Set(journals.map((row) => row.group).filter(Boolean))) {
  assert.ok(journalGroups.has(group), `missing journal group row: ${group}`);
  assert.ok(journalGroups.get(group)?.locales?.zhHans?.name, `missing journal group localization: ${group}`);
}
assert.equal(journalGroups.get("je_group_commercial_interests")?.locales?.zhHans?.name, "经济利益", "VC journal groups must use their shipped localization");

for (const id of ["canada_unite_can", "canada_unite_gbr", "australia_unite_aus", "australia_unite_gbr"]) {
  const row = decisions.find((item) => item.id === id);
  assert.ok(row?.locales?.zhHans?.name, `missing official decision name: ${id}`);
  assert.ok(row?.locales?.zhHans?.desc, `missing official decision description: ${id}`);
}
assert.equal(
  decisions.find((row) => row.id === "ai_unique_buff_modifier_get_again_decision")?.locales?.zhHans?.desc,
  "在玩家已批准人工智能强化但对应修正尚未应用时，重新为人工智能国家添加与其国家等级相符的强化修正。",
  "the shipped empty AI-only decision description needs a readable manual summary",
);

const visibleEvents = events.filter((row) => row.content_class === "game" && !row.hidden);
const unresolvedVisibleEvents = visibleEvents.filter((row) => !row.locales?.zhHans?.title && !/\btitle\s*=\s*\{/.test(row.raw || "") && !isEmptyVcPlaceholder(row));
assert.deepEqual(unresolvedVisibleEvents.map((row) => row.id), [], `visible events still need a readable Chinese title: ${unresolvedVisibleEvents.map((row) => row.id).join(", ")}`);

console.log(JSON.stringify({ victorian_century_content_localization: "ok", events: events.length, journal_groups: journalGroups.size, decisions: decisions.length }, null, 2));

function isEmptyVcPlaceholder(row) {
  return row.sources?.length === 1 && row.sources[0] === "vc"
    && /^joi_flavor_ger\.(?:2[5-9]|3\d|4[0-5])$/.test(row.id)
    && !String(row.trigger_raw || "").replace(/\btrigger\s*=|[{}\s]/g, "")
    && !String(row.immediate_raw || "").replace(/\bimmediate\s*=|[{}\s]/g, "")
    && (row.options || []).every((option) => !String(option.raw || "").replace(/\boption\s*=|\bname\s*=\s*[A-Za-z0-9_.-]+|\bdefault_option\s*=\s*yes|[{}\s]/g, ""));
}
