import assert from "node:assert/strict";
import fs from "node:fs";

const presentation = fs.readFileSync("site/app/presentation.js", "utf8");
const boards = fs.readFileSync("site/app/boards.js", "utf8");
const events = fs.readFileSync("site/app/events.js", "utf8");
const journals = fs.readFileSync("site/app/journals.js", "utf8");
const decisions = fs.readFileSync("site/app/decisions.js", "utf8");
const eventStyles = fs.readFileSync("site/styles/events.css", "utf8");

for (const [name, source, key] of [
  ["ideology", presentation, "ideology"],
  ["law", presentation, "law"],
]) {
  assert.match(source, new RegExp(`data-${key}="\\$\\{escapeHtml\\(${key}\\.key\\)\\}`), `${name} cards must expose their record key`);
  assert.doesNotMatch(source, new RegExp(`rowDetailButton\\(\\"data-${key}-detail`), `${name} cards must not render a separate entry button`);
}
assert.match(boards, /data-technology-key/, "technology nodes must remain clickable");
assert.match(events, /replaceHash\(`\/event\/\$\{encodeURIComponent\(state\.selectedEvent\)\}`\)/, "event cards must open details directly");
assert.match(journals, /replaceHash\(`\/journal\/\$\{encodeURIComponent\(state\.selectedJournal\)\}`\)/, "journal cards must open details directly");
assert.match(decisions, /replaceHash\(`\/decision\/\$\{encodeURIComponent\(state\.selectedDecision\)\}`\)/, "decision cards must open details directly");
assert.match(eventStyles, /\.content-card\[aria-pressed="true"\]/, "content cards must expose a shared selected style");
console.log("content_board_interactions: ok");
