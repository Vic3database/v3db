import fs from "node:fs";

const source = fs.readFileSync("site/app.js", "utf8").replace(/^\uFEFF/, "");
const start = source.indexOf("function renderCountryList");
const end = source.indexOf("\nfunction ", start + 1);
const renderCountryList = source.slice(start, end < 0 ? source.length : end);

if (!renderCountryList) {
  console.error("renderCountryList is missing");
  process.exit(1);
}

if (/filtered\.slice\(0,\s*\d+\)/.test(renderCountryList)) {
  console.error("country list must not truncate the default filtered country set");
  process.exit(1);
}

if (!/els\.countryList\.innerHTML\s*=\s*filtered\.map\(/.test(renderCountryList)) {
  console.error("country list should render every filtered country");
  process.exit(1);
}

console.log(JSON.stringify({ country_list_default_coverage: "ok" }, null, 2));
