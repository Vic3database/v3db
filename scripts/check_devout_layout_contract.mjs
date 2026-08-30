import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const vanillaCss = fs.readFileSync(path.join(root, "site/styles/home.css"), "utf8");
const vcFiles = [
  path.join(root, "site/vc/styles/home.css"),
  path.join(root, "Victorian Century Database/styles/home.css"),
];
const stylesheetEntrypoints = [
  path.join(root, "site/vc/styles.css"),
  path.join(root, "Victorian Century Database/styles.css"),
];
const vcHtmlEntrypoints = [
  path.join(root, "site/vc/index.html"),
  path.join(root, "Victorian Century Database/index.html"),
];
const expectedStylesheetVersion = "20260830-devout-layout1";
const vcBuildScript = fs.readFileSync(path.join(root, "scripts/build_victorian_century_site.mjs"), "utf8");
const requiredSelectors = [
  ".interest-group-devout-navigation-panel",
  ".interest-group-devout-religion-legend",
  ".interest-group-devout-religion-parent-title",
  ".interest-group-devout-religion-group-title",
  ".interest-group-devout-religion-row",
  ".interest-group-devout-religion-name",
  ".interest-group-devout-religion-flavors",
  ".interest-group-devout-religion-icon",
];

for (const selector of requiredSelectors) {
  assert.ok(vanillaCss.includes(selector), `vanilla home stylesheet must define ${selector}`);
}

for (const file of vcFiles) {
  const css = fs.readFileSync(file, "utf8");
  for (const selector of requiredSelectors) {
    assert.ok(css.includes(selector), `${path.relative(root, file)} must define ${selector} for the vanilla Devout layout`);
  }
}

for (const file of stylesheetEntrypoints) {
  const css = fs.readFileSync(file, "utf8");
  assert.ok(css.includes(`styles/home.css?v=${expectedStylesheetVersion}`), `${path.relative(root, file)} must load the current Devout layout stylesheet`);
}

for (const file of vcHtmlEntrypoints) {
  const html = fs.readFileSync(file, "utf8");
  assert.ok(html.includes(`styles.css?v=${expectedStylesheetVersion}`), `${path.relative(root, file)} must load the current Devout layout stylesheet bundle`);
}

assert.ok(vcBuildScript.includes(expectedStylesheetVersion), "the Victorian Century build must preserve the Devout layout stylesheet version");

console.log(JSON.stringify({
  devout_layout_contract: "ok",
  files: vcFiles.map((file) => path.relative(root, file)),
  stylesheetEntrypoints: stylesheetEntrypoints.map((file) => path.relative(root, file)),
  htmlEntrypoints: vcHtmlEntrypoints.map((file) => path.relative(root, file)),
  stylesheetVersion: expectedStylesheetVersion,
  selectors: requiredSelectors.length,
}, null, 2));
