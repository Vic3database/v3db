import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const worker = fs.readFileSync(path.join(root, "site/app/company-solver-worker.js"), "utf8");
assert.match(worker, /import\s*\{\s*createCompanySolverModel\s*,\s*solveCompanyCombinations\s*\}\s*from\s*["']\.\/company-solver-core\.mjs\?v=20260819-company-prestige-search1["']/);
for (const type of ["run", "page", "cancel", "progress", "complete"]) assert.match(worker, new RegExp(`["']${type}["']`));
assert.match(worker, /PAGE_SIZE\s*=\s*20/);
assert.match(worker, /companyCount/);
assert.match(worker, /companyCount: message\.companyCount/);
assert.match(worker, /requiredPrestigeGroups:\s*message\.requiredPrestigeGroups\s*\|\|\s*\[\]/);
console.log("company solver worker checks passed");
