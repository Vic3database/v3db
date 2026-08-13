import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { nameVariants, queryBatchWithSplit } from "./lib/historical_character_images.mjs";

const root = process.cwd();
const args = parseArgs(process.argv.slice(2));
const input = path.resolve(root, args.input || "output/historical-character-images/historical-character-images.json");
const outDir = path.resolve(root, args.out || "output/historical-character-images");
const cacheDir = path.join(outDir, "cache", "name-candidates");
const output = path.join(outDir, "historical-character-image-name-candidates.json");
const batchSize = positiveInteger(args["batch-size"], 20);
const requestDelayMs = nonNegativeInteger(args["request-delay-ms"], 6000);
const report = readJson(input);
const people = (report.unmatched || []).map((person) => ({
  name_en: person.name_en,
  name_zh: person.name_zh || "",
  birth_year: person.birth_year,
  character_keys: person.character_keys || [],
  variants: nameVariants(person),
}));
const matches = [];
fs.mkdirSync(cacheDir, { recursive: true });

for (let index = 0; index < people.length; index += batchSize) {
  const batch = people.slice(index, index + batchSize).map((person, queryIndex) => ({ ...person, query_index: queryIndex }));
  const cacheFile = path.join(cacheDir, `${cacheKey(batch.map((person) => [person.variants, person.birth_year]))}.json`);
  let rows;
  if (fs.existsSync(cacheFile)) {
    rows = readJson(cacheFile);
  } else {
    rows = await queryBatchWithSplit(batch, async (part) => queryBatch(part), { delayMs: requestDelayMs });
    writeJson(cacheFile, rows);
    await delay(requestDelayMs);
  }
  matches.push(...associateRows(batch, rows));
  console.log(`姓名变体候选：${Math.min(index + batch.length, people.length)}/${people.length}`);
}

const candidates = matches.filter((person) => person.wikidata_candidates.length > 0);
const unmatched = matches.filter((person) => person.wikidata_candidates.length === 0);
const outputReport = {
  schema_version: 1,
  source: "Wikidata exact labels and aliases for derived game-name variants",
  generated_at: new Date().toISOString(),
  review_only: true,
  stats: {
    source_people: people.length,
    candidate_people: candidates.length,
    unique_candidate_people: candidates.filter((person) => person.wikidata_candidates.length === 1).length,
    ambiguous_candidate_people: candidates.filter((person) => person.wikidata_candidates.length > 1).length,
    unmatched_people: unmatched.length,
  },
  candidates,
  unmatched,
};
writeJson(output, outputReport);
console.log(JSON.stringify(outputReport.stats));
console.log(`已写入：${output}`);

function queryBatch(batch) {
  const values = batch.flatMap((person) => person.variants.map((variant) =>
    `(${person.query_index} \"${escapeSparql(variant)}\"@en ${person.birth_year})`)).join("\n    ");
  if (!values) return [];
  const query = `SELECT ?inputIndex ?name ?year ?item ?itemLabel ?birth WHERE {
  VALUES (?inputIndex ?name ?year) {
    ${values}
  }
  VALUES ?namePredicate { rdfs:label skos:altLabel }
  ?item wdt:P31 wd:Q5;
        ?namePredicate ?name;
        wdt:P569 ?birth.
  FILTER(YEAR(?birth) = ?year)
  SERVICE wikibase:label { bd:serviceParam wikibase:language \"en\". }
}`;
  const url = new URL("https://query.wikidata.org/sparql");
  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");
  const data = requestJsonWithPowerShell(url);
  return (data.results?.bindings || []).map((row) => ({
    input_index: Number(row.inputIndex.value),
    matched_name: row.name.value,
    qid: row.item.value.replace(/^.*\//, ""),
    label: row.itemLabel?.value || row.name.value,
    birth: row.birth.value,
  }));
}

function associateRows(batch, rows) {
  return batch.map((person, inputIndex) => {
    const candidates = new Map();
    for (const row of rows.filter((item) => item.input_index === inputIndex)) {
      const candidate = candidates.get(row.qid) || {
        wikidata_id: row.qid,
        wikidata_url: `https://www.wikidata.org/wiki/${row.qid}`,
        wikidata_label: row.label,
        birth: row.birth,
        matched_variants: [],
      };
      if (!candidate.matched_variants.includes(row.matched_name)) candidate.matched_variants.push(row.matched_name);
      candidates.set(row.qid, candidate);
    }
    return { ...person, wikidata_candidates: [...candidates.values()] };
  });
}

function requestJsonWithPowerShell(url) {
  const script = [
    "$ProgressPreference = 'SilentlyContinue'",
    "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)",
    "$OutputEncoding = [Console]::OutputEncoding",
    `$uri = ${powershellLiteral(url.toString())}`,
    "$headers = @{ 'User-Agent' = 'VicdataPortraitResearch/0.1 (historical character image audit)' }",
    "$result = Invoke-RestMethod -Uri $uri -Headers $headers -TimeoutSec 120",
    "$json = $result | ConvertTo-Json -Depth 100 -Compress",
    "$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)",
    "[Convert]::ToBase64String($bytes)",
  ].join("\n");
  const output = execFileSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  const json = Buffer.from(output.trim(), "base64").toString("utf8");
  return JSON.parse(json.replace(/^\uFEFF/, ""));
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    result[arg.slice(2)] = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : true;
  }
  return result;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function nonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function escapeSparql(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n");
}

function powershellLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function cacheKey(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex").slice(0, 16);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function delay(milliseconds) {
  return milliseconds > 0 ? new Promise((resolve) => setTimeout(resolve, milliseconds)) : Promise.resolve();
}
