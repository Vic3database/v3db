import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  writeCountryFlagBatch,
  writeCountryFlagVariantPngs,
} from "./lib/country_flag_variants.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const args = parseArgs(process.argv.slice(2));
const outDir = path.resolve(args.outDir || path.join(root, "output_next", "flags", "countries"));

const { manifest, manifestFile } = writeCountryFlagBatch({
  tags: args.tags,
  gamePath: args.gamePath || "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
  assetRoot: path.resolve(args.assetRoot || path.join(root, "game", "gfx", "coat_of_arms")),
  outDir,
});

if (args.pngDir || args.writePngs !== "false") {
  const pngDir = path.resolve(args.pngDir || path.join(path.dirname(outDir), "png"));
  for (const entry of manifest.tags) {
    const dirName = path.basename(entry.file, ".json");
    writeCountryFlagVariantPngs({
      inputJson: path.join(outDir, entry.file),
      gamePath: args.gamePath || "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
      outDir: path.join(pngDir, dirName),
      flagWidth: Number(args.flagWidth || 240),
      flagHeight: Number(args.flagHeight || 144),
    });
  }
}

console.log(
  `wrote ${path.relative(root, manifestFile)}: ${manifest.totalTags} tags, ${manifest.totalVariants} variants, ${manifest.missingAssetReferences} missing asset refs`,
);

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
