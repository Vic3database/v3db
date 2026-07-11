import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const files = args.file
  ? [path.resolve(args.file)]
  : [path.resolve("site/index.html"), path.resolve("Victorian Century Database/index.html")];
const failures = [];

for (const file of files) {
  const html = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const asideMatch = html.match(/<aside\b[^>]*class="filters"[\s\S]*?<\/aside>/);
  if (!asideMatch) {
    failures.push(`${file} missing filters aside`);
    continue;
  }
  const sections = [...asideMatch[0].matchAll(/<details\b[^>]*class="([^"]*\bfilter-section\b[^"]*)"[\s\S]*?<\/details>/g)]
    .map((match) => ({
      className: match[1],
      html: match[0],
    }));
  const visibleSections = sections.filter((section) => !section.className.includes("country-only"));
  const resourceIndex = visibleSections.findIndex((section) => section.html.includes('id="resourceFilters"'));
  if (resourceIndex !== 0) {
    failures.push(`${file} should place resourceFilters first among non-country filter sections, got index ${resourceIndex}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({ checked: files }, null, 2));

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
    } else {
      result[key] = next;
      i += 1;
    }
  }
  return result;
}

function printHelp() {
  console.log(`Usage: node scripts/check_filter_order.mjs [options]

Options:
  --file <path>  Check one HTML file instead of both site entrypoints
  --help         Show this help
`);
}
