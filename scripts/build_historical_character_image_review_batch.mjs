import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = parseArgs(process.argv.slice(2));
const input = path.resolve(root, args.input || "output/historical-character-images/historical-character-images.json");
const output = path.resolve(root, args.out || "output/historical-character-images/review-batch.json");
const limit = positiveInteger(args.limit, 25);
const report = JSON.parse(fs.readFileSync(input, "utf8").replace(/^\uFEFF/, ""));
if (!Array.isArray(report.review)) throw new Error(`${input} 缺少待复核人物数组`);

const selectionOrder = [
  "exact_name_and_birth_year with one image candidate",
  "exact_name_and_birth_year with multiple image candidates",
  "derived_name_variant",
  "exact_name_and_starting_age",
  "unique Wikidata person without an image candidate",
  "ambiguous Wikidata people",
];
const people = [...report.review].sort(comparePeople).slice(0, limit);
const batch = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  source_report: path.relative(root, input).replaceAll("\\", "/"),
  selection_order: selectionOrder,
  count: people.length,
  people,
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output: path.relative(root, output), people: people.length }));

function comparePeople(left, right) {
  return priority(left) - priority(right)
    || String(left.name_en || "").localeCompare(String(right.name_en || ""), "en")
    || personKey(left).localeCompare(personKey(right), "en");
}

function priority(person) {
  const imageCount = person.image_candidates?.length || 0;
  if (person.match_method === "exact_name_and_birth_year" && imageCount === 1) return 0;
  if (person.match_method === "exact_name_and_birth_year" && imageCount > 1) return 1;
  if (person.match_method === "derived_name_variant") return 2;
  if (person.match_method === "exact_name_and_starting_age") return 3;
  if (person.wikidata_candidates?.length === 1 && imageCount === 0) return 4;
  return 5;
}

function personKey(person) {
  return [...(person.character_keys || [])].sort().join("\u0001");
}

function positiveInteger(value, fallback) {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`Expected a positive integer, received ${value}`);
  return number;
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
