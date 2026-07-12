import fs from "node:fs";
import path from "node:path";

import { generateCoaTemplateCountryFlag } from "./coa_template_generator.mjs";

const ANK_REFERENCE_URL = "https://vic3.paradoxwikis.com/Eastern_Bantu_kingdoms#Ankole";
const ANK_REFERENCE_IMAGE = "output_next/flags/wiki/Ankole_wiki_330.png";
const WIKI_MANIFEST_IMAGE_SOURCE = "https://vic3.paradoxwikis.com/";

export function writeHistoricalCountryFlagCalibration(options = {}) {
  const tag = String(options.tag || "").trim().toUpperCase();
  if (!tag) throw new Error("writeHistoricalCountryFlagCalibration requires a tag");

  const root = path.resolve(options.root || process.cwd());
  const gamePath = path.resolve(options.gamePath || "D:\\SteamLibrary\\steamapps\\common\\Victoria 3");
  const assetRoot = path.resolve(options.assetRoot || path.join(root, "game", "gfx", "coat_of_arms"));
  const outFile = path.resolve(options.outFile || path.join(root, "output_next", "flags", "generated", `${tag}.json`));
  const pngOutDir = path.resolve(options.pngOutDir || path.join(root, "output_next", "flags", "generated", "png", tag));
  const manifestEntry = options.manifestEntry || null;
  const referenceImageRelative = manifestEntry?.image || (tag === "ANK" ? ANK_REFERENCE_IMAGE : path.posix.join("output_next/flags/wiki", `${tag}_wiki_330.png`));
  const referenceUrl = manifestEntry?.url || (tag === "ANK" ? ANK_REFERENCE_URL : WIKI_MANIFEST_IMAGE_SOURCE);
  const englishName = manifestEntry?.englishName || (tag === "ANK" ? "Ankole" : tag);
  const referenceImage = path.resolve(root, referenceImageRelative);
  const pngOutFile = path.join(pngOutDir, `${tag}.png`);

  if (!fs.existsSync(referenceImage)) {
    throw new Error(`Missing historical flag calibration image: ${referenceImage}`);
  }

  const templateProbe = tag === "ANK" ? generateCoaTemplateCountryFlag({ tag, gamePath, assetRoot }) : null;
  const result = {
    tag,
    source: "generated:historical-country-coa",
    gamePath,
    assetRoot,
    sourceFiles: templateProbe?.sourceFiles || [],
    context: templateProbe?.context || {
      tag,
    },
    triggerSummary: templateProbe?.triggerSummary || {
      hitTriggers: [],
      failedTriggers: [],
      unsupportedTriggers: [],
    },
    calibration: {
      status: "wiki-matched",
      classification: "historical-country-fixed-generated-flag",
      referenceUrl,
      referenceImage: referenceImageRelative,
      referenceFileName: manifestEntry?.fileName || path.basename(referenceImage),
      note: "Fixed historical country flag calibrated from the wiki-rendered game flag while the engine random source is still being reverse engineered.",
    },
    templateProbe: templateProbe ? {
      source: templateProbe.source,
      templateName: templateProbe.templateName,
      generationTrace: templateProbe.generationTrace,
      selectedVariant: templateProbe.variants?.[0] || null,
      status: "not-used-for-final-image",
    } : null,
    variants: [{
      key: tag,
      exportKey: tag,
      label: englishName,
      sourceLine: 0,
      startLine: 0,
      fallback: false,
      templateGenerated: false,
      historicalGenerated: true,
      calibrationStatus: "wiki-matched",
      referenceUrl,
      referenceImage: referenceImageRelative,
      sourceImage: path.relative(root, referenceImage).replaceAll("\\", "/"),
      textures: [],
      layers: [],
    }],
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  fs.mkdirSync(pngOutDir, { recursive: true });
  fs.copyFileSync(referenceImage, pngOutFile);

  return {
    outFile,
    pngFile: pngOutFile,
    result,
  };
}
