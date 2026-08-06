import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const themeFile = path.join(root, "site", "victorian-century-theme.css");
const builderFile = path.join(root, "scripts", "build_victorian_century_site.mjs");
const standaloneCheckerFile = path.join(root, "scripts", "check_victorian_century_standalone_site.mjs");
const browserCheckerFile = path.join(root, "scripts", "check_victorian_century_browser.mjs");

const theme = fs.readFileSync(themeFile, "utf8");
const builder = fs.readFileSync(builderFile, "utf8");
const standaloneChecker = fs.readFileSync(standaloneCheckerFile, "utf8");
const browserChecker = fs.readFileSync(browserCheckerFile, "utf8");
const bodyRule = theme.match(/body\s*\{([\s\S]*?)\n\}/)?.[1] || "";
const goodsResultsRule = theme.match(/body\[data-view="goods"\]\s+\.results\s*\{([\s\S]*?)\n\}/)?.[1] || "";

assert.match(theme, /--vc-bg:\s*#181216/, "VC theme must define the wine-plum base background");
assert.match(theme, /--vc-wine:\s*#542734/, "VC theme must define the wine header color");
assert.match(theme, /--vc-plum:\s*#713748/, "VC theme must define the plum selection color");
assert.match(theme, /--vc-evergreen:\s*#1e4b42/, "VC theme must define evergreen as its auxiliary color");
assert.match(theme, /--vc-gold:\s*#b89963/, "VC theme must define muted gold");
assert.match(theme, /--gold:\s*var\(--vc-gold\)/, "VC theme must define the technology graph gold alias");
assert.match(theme, /--bg:\s*var\(--vc-bg\)/, "VC base background must use the dedicated theme token");
assert.match(theme, /--accent-blue:\s*var\(--vc-evergreen\)/, "VC controls must use evergreen rather than blue");
assert.doesNotMatch(bodyRule, /radial-gradient\([^;]*--vc-evergreen/, "VC page background must not diffuse evergreen behind content");
assert.doesNotMatch(goodsResultsRule, /--vc-evergreen/, "VC goods content background must not use evergreen");
assert.doesNotMatch(theme, /linear-gradient\([^;]*(?:--vc-evergreen[^;]*--vc-(?:wine|plum)|--vc-(?:wine|plum)[^;]*--vc-evergreen)/, "VC theme must keep evergreen controls separate from wine and plum surfaces");
assert.doesNotMatch(theme, /#1d3040|#243e4e|#c8a45b|#a77022/, "VC theme must not reintroduce the previous navy or orange palette");
assert.doesNotMatch(theme, /(?:\.map-|#map)/, "VC theme must not override map data colors");
assert.match(builder, /victorian-century-theme\.css/, "VC builder must copy the dedicated theme");
assert.match(builder, /<link rel="stylesheet" href="vc-theme\.css/, "VC builder must load the dedicated theme after the base stylesheet");
assert.match(standaloneChecker, /VICTORIAN_CENTURY_SITE_ROOT/, "VC standalone checker must accept a generated-site root override");
assert.match(standaloneChecker, /VICTORIAN_CENTURY_PUBLISHED_ROOT/, "VC standalone checker must accept a published-site root override");
assert.match(browserChecker, /theme\.bg, "#181216"/, "VC browser checker must verify the wine-plum background");
assert.match(browserChecker, /theme\.accent, "#b89963"/, "VC browser checker must verify muted gold");
assert.match(browserChecker, /theme\.evergreen, "#1e4b42"/, "VC browser checker must verify evergreen controls");
assert.match(browserChecker, /theme\.gold, "#b89963"/, "VC browser checker must verify the technology graph gold alias");

console.log(JSON.stringify({
  victorian_century_palette: "ok",
  tokens: ["wine", "plum", "evergreen", "muted-gold"],
}, null, 2));
