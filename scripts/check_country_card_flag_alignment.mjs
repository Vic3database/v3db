import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const stylesFile = path.join(root, "site", "styles.css");
const styles = fs.readFileSync(stylesFile, "utf8");

assert.match(
  styles,
  /\.country-row\s*{[^}]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) 28px/s,
  "country rows should use compact flag, text, and detail-button columns",
);
assert.match(
  styles,
  /\.country-row\s*>\s*\.country-heading,[^}]*\.country-row\s*>\s*\.country-meta,[^}]*\.country-row\s*>\s*\.country-tags\s*{[^}]*grid-column:\s*2\s*\/\s*4/s,
  "country heading and metadata should span the text and detail-button columns",
);
assert.match(
  styles,
  /\.country-row\s*>\s*\.entity-badge\s*{[^}]*grid-row:\s*1;[^}]*align-self:\s*center/s,
  "country flag badge should be vertically centered with the title row",
);
assert.match(
  styles,
  /\.results\s+\.country-row\s*>\s*\.entity-badge\s*{[^}]*grid-row:\s*1;[^}]*align-self:\s*center/s,
  "country result cards should center the flag against the title row",
);
assert.match(
  styles,
  /\.results\s+\.country-heading\s*{[^}]*grid-template-columns:\s*minmax\(64px,\s*auto\) minmax\(0,\s*1fr\) 28px/s,
  "country result-card headings should reserve a right-side detail-button column",
);

console.log(JSON.stringify({
  country_card_flag_alignment: "ok",
  file: path.relative(root, stylesFile).replaceAll("\\", "/"),
}, null, 2));
