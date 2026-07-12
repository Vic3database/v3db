import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const stylesFile = path.join(root, "site", "styles.css");
const styles = fs.readFileSync(stylesFile, "utf8");

function assertStyle(pattern, message) {
  assert.ok(pattern.test(styles), message);
}

assertStyle(
  /\.results\s+\.country-row\s*{[^}]*grid-template-columns:\s*64px minmax\(0,\s*1fr\) 28px/s,
  "country result cards should reserve a desktop flag column",
);
assertStyle(
  /\.country-row\s*>\s*\.country-heading,[^}]*\.country-row\s*>\s*\.country-meta,[^}]*\.country-row\s*>\s*\.country-tags\s*{[^}]*grid-column:\s*2\s*\/\s*4/s,
  "country heading and metadata should span the text and detail-button columns",
);
assertStyle(
  /\.country-row\s*>\s*\.entity-badge\s*{[^}]*grid-row:\s*1;[^}]*align-self:\s*center/s,
  "base country flag badges should stay centered with single-row cards",
);
assertStyle(
  /\.results\s+\.country-row\s*>\s*\.entity-badge\s*{[^}]*grid-row:\s*1\s*\/\s*span\s*4;[^}]*align-self:\s*center/s,
  "country result-card flags should span the card content and stay vertically centered",
);
assertStyle(
  /\.results\s+\.country-row\s*>\s*\.entity-badge\.entity-badge-flag\s*{[^}]*width:\s*64px;[^}]*height:\s*42px/s,
  "country result-card flags should use the enlarged desktop size",
);
assertStyle(
  /\.results\s+\.country-heading\s*{[^}]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) 28px/s,
  "country result-card headings should keep the tag column compact",
);

console.log(JSON.stringify({
  country_card_flag_alignment: "ok",
  file: path.relative(root, stylesFile).replaceAll("\\", "/"),
}, null, 2));
