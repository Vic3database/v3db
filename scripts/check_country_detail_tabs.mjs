import assert from "node:assert/strict";
import fs from "node:fs";

const runtime = fs.readFileSync("site/app/runtime.js", "utf8");
const ui = fs.readFileSync("site/app/ui.js", "utf8");
const presentation = fs.readFileSync("site/app/presentation.js", "utf8");
const styles = fs.existsSync("site/styles/country-detail.css") ? fs.readFileSync("site/styles/country-detail.css", "utf8") : "";
const stylesheet = fs.readFileSync("site/styles.css", "utf8");

assert.match(runtime, /countryDetailTab\s*:/, "runtime must store the selected country detail tab");
assert.match(runtime, /countryDetailSubtab\s*:/, "runtime must store the selected country detail subtab");
assert.match(runtime, /countryDetailFlavorTab\s*:/, "runtime must store the selected country flavor tab");
assert.match(ui, /function countryDetailRoute\s*\(/, "country detail route helper is missing");
assert.match(ui, /tab.*variants|variants.*tab/, "country detail route parsing must support the variants tab");
const tabs = functionSource(presentation, "countryDetailTabs");
const overview = functionSource(presentation, "countryDetailOverview");
assert.match(tabs, /变体[\s\S]*社会[\s\S]*地区[\s\S]*科技[\s\S]*法律[\s\S]*外交[\s\S]*利益集团[\s\S]*风味/, "country detail tabs must keep the approved order");
assert.match(overview, /国家类型[\s\S]*国家位阶[\s\S]*首都[\s\S]*主流文化[\s\S]*宗教[\s\S]*标准色/, "country overview must contain only the approved fixed fields");
assert.doesNotMatch(overview, /部队颜色/, "country overview must not contain troop colors");
assert.doesNotMatch(overview, /开局州数/, "country overview must not contain starting state count");
assert.match(presentation, /data-country-detail-tab/, "country detail tabs must expose an interaction target");
assert.match(styles, /\.country-detail-tabs\s*\{/, "country detail tab styles are missing");
assert.match(styles, /overflow-x:\s*auto/, "country detail tabs must scroll horizontally when needed");
assert.match(stylesheet, /styles\/country-detail\.css/, "country detail styles must be loaded by the shared stylesheet");

console.log("country_detail_tabs: ok");

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `missing ${name}`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated ${name}`);
}
