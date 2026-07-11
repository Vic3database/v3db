import fs from "node:fs";
import path from "node:path";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function companyByKey(databaseDir, key) {
  const file = path.join(databaseDir, "companies.json");
  const companies = readJson(file);
  const company = companies.find((item) => item.key === key);
  if (!company) {
    throw new Error(`Missing company ${key} in ${file}`);
  }
  return company;
}

function techKeys(company) {
  return new Set((company.required_technologies || []).map((item) => item.key));
}

function assertHasTech(databaseDir, companyKey, techKey) {
  const company = companyByKey(databaseDir, companyKey);
  const keys = techKeys(company);
  if (!keys.has(techKey)) {
    throw new Error(`${databaseDir} ${companyKey} should include required technology ${techKey}`);
  }
}

function assertLacksTech(databaseDir, companyKey, techKey) {
  const company = companyByKey(databaseDir, companyKey);
  const keys = techKeys(company);
  if (keys.has(techKey)) {
    throw new Error(`${databaseDir} ${companyKey} should not include AI-only technology ${techKey}`);
  }
}

assertLacksTech("database/vic3_1.13.9", "company_jiangnan_weaving_bureaus", "chemical_bleaching");
assertLacksTech("database/vic3_1.13.9", "company_cgv", "central_planning");
assertHasTech("database/vic3_1.13.9", "company_cgv", "joint_stock_companies");
assertLacksTech("database/victorian_century", "company_jiangnan_weaving_bureaus", "chemical_bleaching");
assertHasTech("database/victorian_century", "company_cgv", "central_planning");

console.log("Company technology requirement checks passed.");
