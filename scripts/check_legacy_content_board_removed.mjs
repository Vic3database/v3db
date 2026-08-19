import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("site/index.html", "utf8");
const ui = fs.readFileSync("site/app/ui.js", "utf8");
const runtime = fs.readFileSync("site/app/runtime.js", "utf8");
const boards = fs.readFileSync("site/app/boards.js", "utf8");
const styles = fs.readFileSync("site/styles/events.css", "utf8");
const zhHans = fs.readFileSync("site/locales/ui.zh-Hans.js", "utf8");
const english = fs.readFileSync("site/locales/ui.en.js", "utf8");

assert.doesNotMatch(html, /data-nav-view="content"/, "legacy content navigation entry must be removed");
assert.doesNotMatch(html, /option value="content"/, "legacy content board selector option must be removed");
assert.doesNotMatch(html, /id="contentFilters"/, "legacy content filters must be removed");
assert.doesNotMatch(html, /app\/content\.js/, "legacy content renderer must not be loaded");
assert.equal(fs.existsSync("site/app/content.js"), false, "legacy content renderer file must be removed");
assert.doesNotMatch(runtime, /contentFilters|contentKindFilters|contentSourceFilters|contentSearchInput|contentResetButton|contentGroupNav/, "legacy content elements must be removed from runtime bindings");
assert.doesNotMatch(boards, /view:\s*"content"/, "legacy content home entry must be removed");
assert.doesNotMatch(styles, /data-view="content"|#contentFilters/, "legacy content layout rules must be removed");
assert.doesNotMatch(zhHans, /"nav\.content"|"board\.content\.filterTitle"|"board\.content\.kind\./, "unused Chinese legacy content messages must be removed");
assert.doesNotMatch(english, /"nav\.content"|"board\.content\.filterTitle"|"board\.content\.kind\./, "unused English legacy content messages must be removed");
assert.match(ui, /parts\[0\]\s*===\s*"content"[\s\S]*replaceHash\(`\/\$\{kind\}/, "legacy content links must still redirect to an independent board");

console.log(JSON.stringify({ legacy_content_board_removed: "ok", redirects: ["journal", "event", "decision"] }, null, 2));
