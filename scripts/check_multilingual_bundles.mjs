import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const args = parseArgs(process.argv.slice(2));
const versionDir = path.resolve(args["site-version"] || "site/versions/1.13.9");
const index = readGlobal(path.join(versionDir, "data-index.js"), "VIC3_DATA_INDEX");
assert(index.locales, "data-index.js lacks locales");
assert.deepEqual(Array.from(index.locales.supported || []), ["zh-Hans", "en"]);

for (const locale of index.locales.supported) {
  for (const board of ["country", "culture", "region", "company", "ideology", "law", "technology", "achievement", "building", "goods"]) {
    const entry = index.locales.chunks?.[locale]?.[board];
    assert(entry?.files?.length, `missing ${locale}/${board} locale files`);
    for (const file of entry.files) {
      const filePath = path.join(versionDir, file.path);
      assert(fs.existsSync(filePath), `missing ${file.path}`);
      assert.equal(hash(fs.readFileSync(filePath, "utf8")), file.sha256, `${file.path} hash differs`);
      const chunk = readGlobal(filePath, "VIC3_LOCALE_CHUNKS")?.[file.id];
      assert.equal(chunk?.locale, locale, `${file.id} does not register its locale`);
    }
  }
}

const search = readGlobal(path.join(versionDir, "search-index.js"), "VIC3_SEARCH_INDEX");
assert.deepEqual(JSON.parse(JSON.stringify(search.entries.find((entry) => entry.kind === "country" && entry.key === "PRU"))), {
  kind: "country",
  id: "country:PRU",
  key: "PRU",
  names: { "zh-Hans": "普鲁士", en: "Prussia" },
});
console.log(JSON.stringify({ multilingual_bundles: "ok", locales: index.locales.supported }, null, 2));

function readGlobal(file, name) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  return context.window[name];
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value).replace(/\r\n/g, "\n"), "utf8").digest("hex");
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith("--")) continue;
    result[argv[index].slice(2)] = argv[index + 1];
    index += 1;
  }
  return result;
}
