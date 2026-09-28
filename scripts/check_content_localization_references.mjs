import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const databaseDir = path.resolve(process.argv[2] || "database/vic3_1.13.11");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const contentFiles = ["journal_entries.json", "events.json", "decisions.json"];
const tokenPattern = /\$([A-Za-z0-9_.:-]+)\$/g;
const rows = contentFiles.flatMap((file) => readJson(path.join(databaseDir, file)));
const findings = [];

for (const row of rows) {
  for (const [locale, localized] of Object.entries(row.locales || {})) {
    for (const [field, value] of Object.entries(localized)) {
      const values = field === "options" && value && typeof value === "object"
        ? Object.entries(value).map(([key, text]) => [`options.${key}`, text])
        : [[field, value]];
      for (const [displayField, text] of values) {
        if (typeof text !== "string") continue;
        for (const match of text.matchAll(tokenPattern)) findings.push({ id: row.id, locale, field: displayField, token: match[0] });
      }
    }
  }
}

const knownReferences = findings.filter((item) => ["$je_elevate_buddhism$", "$je_elevate_buddhism_reason$", "$je_end_edo_system_button_name$"].includes(item.token));
assert.deepEqual(knownReferences, [], `known localization references remain: ${JSON.stringify(knownReferences)}`);
console.log(JSON.stringify({ content_localization_references: "ok", database: databaseDir, checked: rows.length }, null, 2));
