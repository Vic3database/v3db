import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const flags = new Set(process.argv.slice(2));

if (!flags.size || flags.has("--data-only") || flags.has("--vc")) {
  checkNeedsData(path.join(root, "site", "versions", "1.13.9"), { mode: "vanilla", baseline: false });
  checkNeedsData(path.join(root, "Victorian Century Database"), { mode: "vc", baseline: true });
}
if (!flags.size || flags.has("--routing")) checkRouting();
if (!flags.size || flags.has("--ui")) checkUi();
if (!flags.size || flags.has("--locales")) checkLocales();

console.log(JSON.stringify({ goods_needs_contract: "ok", checks: [...flags].length ? [...flags] : ["all"] }, null, 2));

function checkNeedsData(siteRoot, { mode, baseline }) {
  const index = readGlobal(path.join(siteRoot, "data-index.js"), "VIC3_DATA_INDEX");
  const entry = index?.chunks?.needs;
  assert(entry, `${mode} data index must expose the needs chunk`);
  assert.deepEqual(Array.from(entry.keys || []), ["needsData"], `${mode} needs chunk must expose needsData only`);
  assert.equal(entry.files?.length, 1, `${mode} needs chunk must use one data file`);
  const chunk = readGlobal(path.join(siteRoot, entry.files[0]), "VIC3_DATA_CHUNK");
  const current = chunk.needsData?.current;
  assertNeedsDataset(current, mode, mode === "vc" ? 53 : 52);
  assert.equal(Boolean(chunk.needsData?.baseline), baseline, `${mode} baseline presence changed`);
  if (baseline) assertNeedsDataset(chunk.needsData.baseline, "baseline", 52);
  for (const locale of ["zh-Hans", "en"]) {
    const localeEntry = index?.locales?.chunks?.[locale]?.needs;
    assert(localeEntry?.files?.length, `${mode} ${locale} needs locale chunk is missing`);
    assert(fs.existsSync(path.join(siteRoot, localeEntry.files[0].path)), `${mode} ${locale} needs locale file is missing`);
  }
}

function assertNeedsDataset(dataset, label, relationCount) {
  assert.equal(dataset?.needs?.length, 15, `${label} needs count changed`);
  assert.equal(dataset.needs.reduce((sum, need) => sum + (need.entries || []).length, 0), relationCount, `${label} goods relation count changed`);
  assert.deepEqual(Array.from(dataset.packages || [], (row) => row.level), Array.from({ length: 99 }, (_, index) => index + 1), `${label} wealth levels changed`);
  assert(dataset.needs.every((need) => need.loc?.name), `${label} needs must retain localization references`);
}

function checkRouting() {
  const runtime = read("site/app/runtime.js");
  const dataLoader = read("site/app/data.js");
  const ui = read("site/app/ui.js");
  assert.match(runtime, /let needsData = null;/, "runtime must expose the loaded needs data");
  assert.match(runtime, /goodsPanel:\s*"list"/, "goods board must default to the list panel");
  assert.match(runtime, /needsTable:\s*"substitutes"/, "needs board must default to the substitutes table");
  assert.match(runtime, /needsCompareBaseline:\s*false/, "needs comparison must default to off");
  assert.match(dataLoader, /if \(view === "goods"\) return \["goods"\]/, "ordinary goods routes must retain the goods-only chunk list");
  assert.match(dataLoader, /parts\[0\] === "goods" && parts\[1\] === "needs"[\s\S]*chunkKeys\.push\("needs"\)/, "needs routes must append the needs chunk");
  const needsRoute = ui.indexOf('parts[0] === "goods" && parts[1] === "needs"');
  const goodsDetailRoute = ui.indexOf('parts[0] === "goods" && parts[1] && goodByKey.has');
  assert(needsRoute >= 0, "router must recognize goods needs routes");
  assert(goodsDetailRoute >= 0, "router must retain goods detail routes");
  assert(needsRoute < goodsDetailRoute, "goods needs routes must be parsed before goods details");
  assert.match(ui, /parts\[2\] === "wealth" \? "wealth" : "substitutes"/, "router must select the two needs tables");
}

function checkUi() {
  const index = read("site/index.html");
  const frontendSources = read("scripts/site_frontend_sources.mjs");
  const economy = read("site/app/economy.js");
  const needs = read("site/app/needs.js");
  const styles = read("site/styles/needs.css");
  assert.match(index, /app\/needs\.js\?v=/, "site must load the needs module");
  assert.match(frontendSources, /"app\/needs\.js"/, "combined app source must include the needs module");
  assert.match(frontendSources, /"styles\/needs\.css"/, "combined styles must include the needs stylesheet");
  assert.match(economy, /goodsPanelSwitchHtml\("list"\)/, "goods list must render its outer panel switch");
  assert.match(needs, /data-goods-panel/, "needs board must provide the outer panel switch controls");
  for (const marker of ["data-needs-table", "data-needs-compare", "needs-substitutes-axis", "needs-wealth-table", "needs-wealth-line-layer", "needs-wealth-project-cell"]) {
    assert(needs.includes(marker) || styles.includes(marker), `needs UI must contain ${marker}`);
  }
  assert.match(styles, /z-index:\s*6/, "ordinary wealth header lines must use layer 6");
  assert.match(styles, /z-index:\s*8/, "tier divider lines must use layer 8");
  assert.match(styles, /z-index:\s*10/, "sticky body cells must use layer 10");
  assert.match(styles, /z-index:\s*12/, "sticky header cells must use layer 12");
}

function checkLocales() {
  for (const locale of ["zh-Hans", "en"]) {
    const source = read(`site/locales/ui.${locale}.js`);
    for (const key of [
      "board.needs.goodsList",
      "board.needs.populationNeeds",
      "board.needs.substitutes",
      "board.needs.wealthTable",
      "board.needs.compareOriginal",
      "board.needs.projectWealth",
      "board.needs.solTier",
      "board.needs.politicalStrength",
      "board.needs.total",
      "board.needs.sol.opulent",
    ]) {
      assert(source.includes(`"${key}"`), `${locale} UI locale must define ${key}`);
    }
  }
}

function readGlobal(file, globalName) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox.window[globalName];
}

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8").replace(/^\uFEFF/, "");
}
