import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { collectLocalizationRefs } from "./lib/localization-schema.mjs";

const args = parseArgs(process.argv.slice(2));
const database = path.resolve(args.database || "database/vic3_1.13.9");
const read = (file) => JSON.parse(
  fs.readFileSync(path.join(database, file), "utf8").replace(/^\uFEFF/, ""),
);
const index = read("index.json");
const chunks = {
  building: [
    "buildings",
    "building_groups",
    "production_method_groups",
    "production_methods",
  ],
  goods: ["goods", "prestige_goods"],
};
const summary = {};

for (const [chunk, keys] of Object.entries(chunks)) {
  const refs = new Set();
  for (const key of keys) collectLocalizationRefs(read(index.files[key]), refs);
  summary[chunk] = { references: refs.size };
  for (const locale of ["zh-Hans", "en"]) {
    const catalog = read(index.locales.files[locale].file);
    for (const id of refs) {
      const value = catalog[id] || "";
      if (!id.endsWith(".description") && !id.endsWith(".nameFallback")) {
        assert(value, `${locale} missing ${chunk} message: ${id}`);
      }
      assert.doesNotMatch(
        value,
        /\$[^$]+\$|@[A-Za-z0-9_]+!|#(?:[A-Za-z0-9_]+)?\s|\[Nbsp\]|\[(?:Concept|concept_)/,
        `${locale} unresolved ${id}: ${value}`,
      );
      if (locale === "en") {
        assert.doesNotMatch(
          value,
          /[\u3400-\u9fff]/,
          `English message contains Chinese: ${id}: ${value}`,
        );
      }
    }
  }
}

console.log(JSON.stringify({
  economy_localization: "ok",
  database,
  chunks: summary,
}, null, 2));

function parseArgs(values) {
  const parsed = { database: "" };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--database") {
      parsed.database = values[index + 1] || "";
      if (!parsed.database) throw new Error("Missing value for --database");
      index += 1;
    } else if (value === "--help" || value === "-h") {
      console.log("Usage: node scripts/check_economy_localization.mjs [--database <dir>]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return parsed;
}
