import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const index = read("site/index.html");
const shell = read("site/styles/shell.css");
assert.match(index, /id="languageMenuButton"/);
assert.match(index, /assets\/lucide\/icons\/languages\.svg/);
assert.match(index, /data-locale="zh-Hans"[^>]*>简体中文/);
assert.match(index, /data-locale="en"[^>]*>English/);
assert(index.indexOf('src="app/runtime.js') < index.indexOf('src="app/i18n.js'), "i18n must load after runtime");
assert(index.indexOf('src="app/i18n.js') < index.indexOf('src="app/data.js'), "i18n must load before data");
assert.doesNotMatch(shell, /\.language-menu\s*\{[^}]*display:\s*none/i);
console.log("multilingual_ui_contracts: ok");

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}
