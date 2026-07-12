import path from "node:path";
import { fileURLToPath } from "node:url";

import { writeCountryFlagSample } from "./lib/country_flag_variants.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const args = parseArgs(process.argv.slice(2));
const tag = String(args.tag || "IBE").toUpperCase();
const outFile = path.resolve(args.out || path.join(root, "output_next", "flags", `${tag}.json`));

const { result } = writeCountryFlagSample({
  tag,
  gamePath: args.gamePath || "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
  assetRoot: path.resolve(args.assetRoot || path.join(root, "game", "gfx", "coat_of_arms")),
  outFile,
});

const foundAssets = new Set(
  result.variants.flatMap((variant) => variant.textures)
    .filter((texture) => texture.asset?.status === "found")
    .map((texture) => texture.asset.relativePath),
);

console.log(`wrote ${path.relative(root, outFile)}: ${result.tag}, ${result.variants.length} variants, ${foundAssets.size} PNG assets`);

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
