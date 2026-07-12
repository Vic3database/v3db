import path from "node:path";
import { fileURLToPath } from "node:url";

import { writeGeneratedCoaTemplateFlag } from "./lib/coa_template_generator.mjs";
import { writeHistoricalCountryFlagCalibration } from "./lib/historical_country_flag_calibration.mjs";
import { writeCountryFlagVariantPngs } from "./lib/country_flag_variants.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const args = parseArgs(process.argv.slice(2));
const tag = String(args.tag || "ANK").toUpperCase();
const outFile = path.resolve(args.out || path.join(root, "output_next", "flags", "generated", `${tag}.json`));
const pngOutDir = path.resolve(args.pngOutDir || path.join(root, "output_next", "flags", "generated", "png", tag));
const gamePath = args.gamePath || "D:\\SteamLibrary\\steamapps\\common\\Victoria 3";
const assetRoot = path.resolve(args.assetRoot || path.join(root, "game", "gfx", "coat_of_arms"));

let result;
let pngs;
if (args.mode === "template") {
  ({ result } = writeGeneratedCoaTemplateFlag({
    tag,
    gamePath,
    assetRoot,
    outFile,
  }));
  const rendered = writeCountryFlagVariantPngs({
    inputJson: outFile,
    gamePath,
    outDir: pngOutDir,
    flagWidth: Number(args.flagWidth || 240),
    flagHeight: Number(args.flagHeight || 144),
  });
  pngs = rendered.files;
} else {
  const written = writeHistoricalCountryFlagCalibration({
    root,
    tag,
    gamePath,
    assetRoot,
    outFile,
    pngOutDir,
  });
  result = written.result;
  pngs = [written.pngFile];
}

console.log(JSON.stringify({
  tag: result.tag,
  source: result.source,
  templateName: result.templateName || result.templateProbe?.templateName || "",
  calibrationStatus: result.calibration?.status || "",
  hitTriggers: result.triggerSummary.hitTriggers,
  json: path.relative(root, outFile).replaceAll("\\", "/"),
  pngs: pngs.map((file) => path.relative(root, file).replaceAll("\\", "/")),
}, null, 2));

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : "true";
    result[key] = value;
  }
  return result;
}
