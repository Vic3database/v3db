import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const styles = fs.readFileSync(path.join(root, "site", "styles.css"), "utf8");

function styleBlock(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`${escaped}\\s*{([^}]*)}`, "s"));
  assert.ok(match, `${selector} style block is missing`);
  return match[1] || "";
}

const ideologyDetailResults = styleBlock('body.detail-page[data-view="ideology"] .results');
assert.match(
  ideologyDetailResults,
  /left:\s*calc\(12px \+ var\(--ideology-left-width\) \+ var\(--panel-gap\)\)/,
  "ideology detail routes should keep the list beside the ideology filters",
);
assert.match(
  ideologyDetailResults,
  /width:\s*var\(--ideology-results-width\)/,
  "ideology detail routes should keep the ideology list width",
);

const ideologyDetailPanel = styleBlock('body.detail-page[data-view="ideology"] .detail');
assert.match(
  ideologyDetailPanel,
  /left:\s*calc\(12px \+ var\(--ideology-left-width\) \+ var\(--panel-gap\) \+ var\(--ideology-results-width\) \+ var\(--panel-gap\)\)/,
  "ideology detail routes should open details to the right of the ideology list",
);
assert.match(
  ideologyDetailPanel,
  /right:\s*12px/,
  "ideology detail routes should keep the detail panel inside the viewport",
);

const detailPageResultsIndex = styles.indexOf("body.detail-page .results");
const ideologyDetailResultsIndex = styles.indexOf('body.detail-page[data-view="ideology"] .results');
assert.ok(
  ideologyDetailResultsIndex > detailPageResultsIndex,
  "ideology detail overrides should come after the generic detail-page layout",
);

console.log(JSON.stringify({
  ideology_detail_layout: "ok",
}, null, 2));
