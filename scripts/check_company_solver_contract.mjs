import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const runtime = read("site/app/runtime.js");
const index = read("site/index.html");
const sources = read("scripts/site_frontend_sources.mjs");
const solver = read("site/app/company-solver.js");
const styles = read("site/styles/records.css");
const styleEntry = read("site/styles.css");
const zhUi = read("site/locales/ui.zh-Hans.js");
const enUi = read("site/locales/ui.en.js");

const requiredGroups = [
  ["resources", ["building_coal_mine", "building_iron_mine", "building_lead_mine", "building_sulfur_mine", "building_gold_mine", "building_fishing_wharf", "building_whaling_station", "building_logging_camp", "building_rubber_plantation", "building_oil_rig"]],
  ["agriculture", ["building_wheat_farm", "building_rye_farm", "building_rice_farm", "building_maize_farm", "building_millet_farm", "building_livestock_ranch", "building_vineyard", "building_coffee_plantation", "building_tea_plantation", "building_tobacco_plantation", "building_opium_plantation", "building_banana_plantation", "building_sugar_plantation", "building_silk_plantation", "building_cotton_plantation", "building_dye_plantation"]],
  ["light_industry", ["building_glassworks", "building_textile_mill", "building_tooling_workshop", "building_furniture_manufactory", "building_food_industry", "building_shipyard", "building_paper_mill"]],
  ["heavy_military", ["building_electrics_industry", "building_motor_industry", "building_chemical_plant", "building_synthetics_plant", "building_steel_mill", "building_automotive_industry", "building_explosives_factory", "building_munition_plant", "building_artillery_foundry", "building_arms_industry"]],
  ["infrastructure", ["building_power_plant", "building_port", "building_trade_center", "building_railway", "building_art_academy"]],
];

assert.match(runtime, /const\s+companySolverBuildingGroups\s*=/);
const solverDirectory = runtime.match(/const\s+companySolverBuildingGroups\s*=([\s\S]*?)const\s+companySolverBuildingByKey/)[1];
for (const [group, keys] of requiredGroups) {
  assert.match(solverDirectory, new RegExp(`key:\\s*["']${group}["']`));
  assert.match(solverDirectory, new RegExp(`labelKey:\\s*["']board\\.company\\.solverGroup`));
  for (const key of keys) assert.match(solverDirectory, new RegExp(`["']${key}["']`));
}
assert.doesNotMatch(solverDirectory, /["']building_gold_field["']/g);
assert.doesNotMatch(index, /companySolverTopbarButton/);
assert.match(index, /id=["']companySolverEntry["']/);
assert.match(index, /id=["']companySolverDetailPane["']/);
assert.match(index, /app\/company-solver\.js\?v=20260819-company-prestige-search1/);
assert.match(index, /app\/company-solver-core-fallback\.js\?v=20260819-company-prestige-search1/);
assert.match(index, /app\/company-solver-async-fallback\.js\?v=20260819-company-prestige-search1/);
assert.match(index, /styles\.css\?v=20260819-company-usage-collapse1/);
assert.match(sources, /app\/company-solver\.js/);
assert.equal(fs.existsSync(path.join(root, "site/app/company-solver-core.mjs")), true);
assert.equal(fs.existsSync(path.join(root, "site/app/company-solver-worker.js")), true);
assert.equal(fs.existsSync(path.join(root, "site/app/company-solver-core-fallback.js")), true);
assert.equal(fs.existsSync(path.join(root, "site/app/company-solver-async-fallback.js")), true);
assert.match(solver, /new Worker\(["']app\/company-solver-worker\.js/);
assert.match(solver, /company-solver-worker\.js\?v=20260819-company-prestige-search1/);
assert.match(solver, /type:\s*["']module["']/);
assert.match(solver, /catch \(error\)/);
assert.match(solver, /COMPANY_SOLVER_CORE/);
assert.match(solver, /runCompanySolverFallback/);
assert.match(solver, /solveCompanyCombinationsAsync/);
assert.match(solver, /companies\.length > 0 && \(Boolean\(standaloneSiteConfig\) \|\| loadedDataVersion === "1\.13\.10"\)/, "solver must support base 1.13.10 and standalone VC data");
assert.match(solver, /worker\.terminate\(\);[\s\S]*runCompanySolverFallback/);
assert.match(read("site/app/ui.js"), /typeof companySolverAvailable === ["']function["']/);
for (const marker of ["data-company-solver-building", "data-company-solver-run", "data-company-solver-page", "data-company-solver-open"]) {
  assert.match(solver, new RegExp(marker));
}
assert.match(solver, /company-solver-usage-item/);
assert.match(solver, /companyUsage/);
assert.match(runtime, /usageOpen:\s*false/);
assert.match(solver, /<details class="company-solver-usage"/);
assert.match(solver, /data-company-solver-usage/);
assert.match(solver, /usageDetails\.addEventListener\("toggle"/);
assert.match(solver, /state\.companySolver\.usageOpen\s*=\s*usageDetails\.open/);
assert.match(solver, /data-company-solver-exclude-construction/);
assert.match(solver, /data-company-solver-prestige/);
assert.match(solver, /data-company-solver-prestige-filter/);
assert.doesNotMatch(solver, /data-company-solver-prestige-building/);
assert.doesNotMatch(solver, /solverPrestigeBuildingKeys/);
assert.match(solver, /data-company-solver-prestige-category/);
assert.match(solver, /prestigeFilterOpen/);
assert.match(solver, /requiredPrestigeGroups/);
assert.match(solver, /COMPANY_SOLVER_PAGE_SIZE\s*=\s*20/);
assert.match(solver, /href="#\/company\//);
assert.match(solver, /href="#\/building\//);
assert.match(solver, /href="#\/goods\//);
assert.match(styles, /\.company-solver-building-grid/);
assert.match(styles, /\.company-solver-card/);
assert.match(styles, /\.company-solver-prestige-item\s*\{[^}]*color:\s*var\(--ink\)/);
assert.match(styles, /max-width:\s*700px/);
assert.match(styles, /company-solver-building-grid[^}]*grid-template-columns/);
assert.match(solver, /companySolverBuildingGroups\.map/);
assert.match(solver, /data-company-solver-company-count/);
assert.match(solver, /data-company-solver-unrestricted-only/);
assert.match(solver, /COMPANY_SOLVER_MAX_COMPANIES\s*=\s*7/);
assert.match(solver, /company-solver-layout/);
assert.match(read("site/styles/shell.css"), /companySolverDetailPane/);
assert.match(styleEntry, /styles\/shell\.css\?v=20260818-vc-company-tools1/);
assert.match(styleEntry, /styles\/records\.css\?v=20260819-company-usage-collapse1/);
assert.match(styles, /\.company-solver-usage summary/);
assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*1\.5fr\)\s+minmax\(0,\s*1fr\)/);
assert.match(styles, /\.company-solver-building\s*\{[^}]*border:\s*0/);
for (const key of ["resources", "agriculture", "lightIndustry", "heavyMilitary", "infrastructure"]) {
  assert.match(zhUi, new RegExp(`board\\.company\\.solverGroup\\.${key}`));
  assert.match(enUi, new RegExp(`board\\.company\\.solverGroup\\.${key}`));
}
assert.match(zhUi, /board\.company\.solverUnrestrictedOnly/);
assert.match(enUi, /board\.company\.solverUnrestrictedOnly/);
console.log("company solver contract checks passed");
