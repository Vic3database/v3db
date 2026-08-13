import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = parseArgs(process.argv.slice(2));
const input = path.resolve(root, args.input || "output/historical-character-images/historical-character-images.json");
const output = path.resolve(root, args.output || "site/versions/1.13.9/data-character-images.js");
const report = JSON.parse(fs.readFileSync(input, "utf8").replace(/^\uFEFF/, ""));
if (!Array.isArray(report.people) || !report.stats) throw new Error(`${input} 不是有效的史实角色图片报告`);

const data = {
  historicalCharacterImages: report.people,
  historicalCharacterImageStats: {
    ...report.stats,
    source: report.source,
    generated_at: report.generated_at,
    accepted_types: report.rules?.accepted_types || [],
  },
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `window.VIC3_DATA_CHUNK = ${JSON.stringify(data)};\n`, "utf8");
const indexPath = path.join(path.dirname(output), "data-index.js");
if (fs.existsSync(indexPath)) {
  const index = readWindowValue(indexPath, "VIC3_DATA_INDEX");
  const characterChunk = index.chunks?.character || { files: [], keys: [], counts: {} };
  characterChunk.files = [...new Set([...(characterChunk.files || []), path.basename(output)])];
  characterChunk.keys = [...new Set([...(characterChunk.keys || []), "historicalCharacterImages", "historicalCharacterImageStats"])];
  characterChunk.counts = {
    ...(characterChunk.counts || {}),
    historicalCharacterImages: data.historicalCharacterImages.length,
  };
  index.chunks.character = characterChunk;
  fs.writeFileSync(indexPath, `window.VIC3_DATA_INDEX = ${JSON.stringify(index)};\n`, "utf8");
}
console.log(JSON.stringify({ output: path.relative(root, output), people: report.people.length }));

function readWindowValue(file, globalName) {
  const source = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(source.replace(new RegExp(`^window\\.${globalName}\\s*=\\s*`), "").replace(/;\s*$/, ""));
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
