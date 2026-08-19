import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createCompanySolverModel, solveCompanyCombinations, summarizeCompanyUsage } from "../site/app/company-solver-core.mjs";

const companies = [
  {
    key: "company_alpha",
    name: "Alpha",
    building_types: [{ key: "building_a" }],
    extension_building_types: [{ key: "building_b" }, { key: "building_c" }],
  },
  {
    key: "company_beta",
    name: "Beta",
    building_types: [{ key: "building_b" }],
    extension_building_types: [],
  },
  {
    key: "company_gamma",
    name: "Gamma",
    building_types: [{ key: "building_c" }],
    extension_building_types: [],
  },
  {
    key: "company_delta",
    name: "Delta",
    building_types: [{ key: "building_a" }, { key: "building_b" }],
    extension_building_types: [],
  },
  {
    key: "company_extra",
    name: "Extra",
    building_types: [{ key: "building_a" }, { key: "building_x" }],
    extension_building_types: [{ key: "building_b" }],
  },
];

const model = createCompanySolverModel(companies, ["building_a", "building_b"]);
const oneTarget = solveCompanyCombinations(model, { maxResults: 100 });

assert.equal(oneTarget.total, 5, "a+b has three one-company and two two-company minimal states");
assert.deepEqual(oneTarget.solutions.map((solution) => solution.companyKeys), [
  ["company_extra"],
  ["company_alpha"],
  ["company_delta"],
  ["company_beta", "company_extra"],
  ["company_alpha", "company_beta"],
], "one-company solutions are sorted by extra coverage then stable names");
assert.equal(oneTarget.solutions[0].selectedExtensions[0].key, "building_b");
assert.deepEqual(oneTarget.solutions[0].extraCoverageKeys, ["building_x"]);
assert.equal(Object.hasOwn(oneTarget.solutions[0], "companies"), false, "result rows must not duplicate complete company records");
assert.equal(Object.hasOwn(oneTarget.solutions[0], "companyStates"), false, "result rows keep only compact extension choices");
assert.equal(new Set(oneTarget.solutions.map((solution) => solution.companyKeys.join("|"))).size, oneTarget.total, "each company combination appears once");

assert.deepEqual(summarizeCompanyUsage([
  { companyKeys: ["company_a", "company_b"], companyNames: ["A", "B"] },
  { companyKeys: ["company_a", "company_c"], companyNames: ["A", "C"] },
  { companyKeys: ["company_b", "company_c"], companyNames: ["B", "C"] },
  { companyKeys: ["company_a", "company_b"], companyNames: ["A", "B"] },
]), [
  { companyKey: "company_a", count: 3 },
  { companyKey: "company_b", count: 3 },
  { companyKey: "company_c", count: 2 },
], "company usage counts each company once per solution and sorts by usage count");

const oneCompanyOnly = solveCompanyCombinations(model, { companyCount: 1, maxResults: 100 });
assert.ok(oneCompanyOnly.total > 0, "companyCount 1 keeps one-company solutions");
assert.ok(oneCompanyOnly.solutions.every((solution) => solution.companyKeys.length === 1), "companyCount 1 excludes larger combinations");
const twoCompanyOnly = solveCompanyCombinations(createCompanySolverModel([companies[1], companies[2]], ["building_b", "building_c"]), { companyCount: 2, maxResults: 100 });
assert.equal(twoCompanyOnly.total, 1);
assert.deepEqual(twoCompanyOnly.solutions[0].companyKeys, ["company_beta", "company_gamma"]);

const choiceOnly = solveCompanyCombinations(createCompanySolverModel([
  { key: "company_choice_only", name: "Choice only", building_types: [], extension_building_types: [{ key: "building_b" }, { key: "building_c" }] },
], ["building_b", "building_c"]), { maxResults: 100 });
assert.equal(choiceOnly.total, 0, "one company cannot select two options from one choice group");

const duplicateChoiceStates = solveCompanyCombinations(createCompanySolverModel([
  {
    key: "company_choice_provider",
    name: "Choice provider",
    building_types: [{ key: "building_a" }],
    extension_building_types: [{ key: "building_b" }, { key: "building_c" }],
  },
  {
    key: "company_fixed_provider",
    name: "Fixed provider",
    building_types: [{ key: "building_b" }, { key: "building_c" }],
    extension_building_types: [],
  },
], ["building_a", "building_b", "building_c"]), { maxResults: 100 });
assert.equal(duplicateChoiceStates.total, 1, "one company combination is emitted once even when several valid extension choices cover the same targets");
assert.deepEqual(duplicateChoiceStates.solutions[0].companyKeys, ["company_choice_provider", "company_fixed_provider"]);

const multiGroup = solveCompanyCombinations(createCompanySolverModel([
  {
    key: "company_multi_group",
    name: "Multi group",
    building_types: [],
    choice_groups: [
      { min: 0, max: 1, options: [{ key: "building_d" }, { key: "building_e" }] },
      { min: 0, max: 1, options: [{ key: "building_f" }, { key: "building_g" }] },
    ],
  },
], ["building_d", "building_f"]), { maxResults: 100 });
assert.equal(multiGroup.total, 1, "independent choice groups can each contribute one required building");
assert.deepEqual(multiGroup.solutions[0].selectedExtensionKeys, [["building_d", "building_f"]]);

const twoTargets = solveCompanyCombinations(createCompanySolverModel([companies[1], companies[2]], ["building_b", "building_c"]), { maxResults: 100 });
assert.equal(twoTargets.total, 1, "two fixed providers cover two targets");
assert.deepEqual(twoTargets.solutions[0].companyKeys, ["company_beta", "company_gamma"]);

const noSolution = solveCompanyCombinations(createCompanySolverModel(companies, ["building_missing"]), { maxResults: 100 });
assert.equal(noSolution.total, 0);
assert.deepEqual(noSolution.solutions, []);

const prestigeFiltered = solveCompanyCombinations(createCompanySolverModel([
  { key: "company_car", name: "Car", building_types: [{ key: "building_a" }], possible_prestige_goods: [{ key: "prestige_car_a" }] },
  { key: "company_tool", name: "Tool", building_types: [{ key: "building_a" }], possible_prestige_goods: [{ key: "prestige_tool" }] },
], ["building_a"]), { requiredPrestigeGroups: [["prestige_car_a", "prestige_car_b"]], maxResults: 100 });
assert.equal(prestigeFiltered.total, 1, "a prestige-good group accepts any selected prestige good in the same group");
assert.deepEqual(prestigeFiltered.solutions[0].companyKeys, ["company_car"]);

const prestigeNecessaryCompanies = [
  { key: "company_crystal", name: "Crystal", building_types: [{ key: "building_a" }], possible_prestige_goods: [{ key: "prestige_crystal" }] },
  { key: "company_complete", name: "Complete", building_types: [{ key: "building_a" }, { key: "building_b" }], possible_prestige_goods: [] },
  { key: "company_irrelevant_crystal", name: "Irrelevant crystal", building_types: [{ key: "building_x" }], possible_prestige_goods: [{ key: "prestige_crystal" }] },
];
const prestigeNecessaryModel = createCompanySolverModel(prestigeNecessaryCompanies, ["building_a", "building_b"]);
assert.deepEqual(prestigeNecessaryModel.companies.map((company) => company.key), ["company_crystal", "company_complete"], "companies without any target-building coverage are removed from the solver model");
const prestigeNecessary = solveCompanyCombinations(prestigeNecessaryModel, {
  companyCount: 2,
  requiredPrestigeGroups: [["prestige_crystal"]],
  maxResults: 100,
});
assert.equal(prestigeNecessary.total, 1, "a company required only by the prestige condition remains in the solution");
assert.deepEqual(prestigeNecessary.solutions[0].companyKeys, ["company_complete", "company_crystal"]);

const fallbackContext = { window: {}, setTimeout };
vm.runInNewContext(fs.readFileSync(new URL("../site/app/company-solver-core-fallback.js", import.meta.url), "utf8"), fallbackContext);
vm.runInNewContext(fs.readFileSync(new URL("../site/app/company-solver-async-fallback.js", import.meta.url), "utf8"), fallbackContext);
const fallbackModel = fallbackContext.window.COMPANY_SOLVER_CORE.createCompanySolverModel([
  { key: "company_crystal", name: "Crystal", building_types: [{ key: "building_glassworks" }], possible_prestige_goods: [{ key: "prestige_crystal" }] },
], ["building_glassworks"]);
const fallbackPrestige = fallbackContext.window.COMPANY_SOLVER_CORE.solveCompanyCombinations(fallbackModel, {
  companyCount: 1,
  requiredPrestigeGroups: [["prestige_crystal"]],
  maxResults: 100,
});
assert.equal(fallbackPrestige.total, 1, "the local-file fallback preserves company prestige goods");
assert.deepEqual([...fallbackPrestige.solutions[0].companyKeys], ["company_crystal"]);

const fallbackPrestigeNecessaryModel = fallbackContext.window.COMPANY_SOLVER_CORE.createCompanySolverModel(prestigeNecessaryCompanies, ["building_a", "building_b"]);
const fallbackPrestigeNecessary = await fallbackContext.window.COMPANY_SOLVER_CORE.solveCompanyCombinationsAsync(fallbackPrestigeNecessaryModel, {
  companyCount: 2,
  requiredPrestigeGroups: [["prestige_crystal"]],
  maxResults: 100,
});
assert.equal(fallbackPrestigeNecessary.total, 1, "the local-file asynchronous search prioritizes a required prestige provider before complete building coverage");
assert.deepEqual([...fallbackPrestigeNecessary.solutions[0].companyKeys], ["company_complete", "company_crystal"]);

console.log("company solver core checks passed");
