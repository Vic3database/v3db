import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseCountryFlagVariants,
  writeCountryFlagVariantPngs,
} from "./lib/country_flag_variants.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const args = parseArgs(process.argv.slice(2));
const gamePath = path.resolve(args.gamePath || "D:\\SteamLibrary\\steamapps\\common\\Victoria 3");
const modPath = path.resolve(args.modPath || "D:\\SteamLibrary\\steamapps\\workshop\\content\\529340\\3219394272");
const assetRoot = path.resolve(args.assetRoot || path.join(root, "site", "assets", "victorian-century-flags"));
const dataFile = path.resolve(args.dataFile || path.join(root, "site", "assets", "victorian-century-flags.js"));
const python = args.python || process.env.PYTHON || "python";

assertDirectory(gamePath, "Victoria 3 installation");
assertDirectory(modPath, "Victorian Century workshop directory");
assertDirectory(path.join(root, "game", "gfx", "coat_of_arms"), "converted coat-of-arms assets");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vic3-vc-country-flags-"));
try {
  const sourceGamePath = buildMergedFlagSource(tempRoot);
  const sourceAssetRoot = buildMergedAssetSource(tempRoot);
  const entries = {};

  for (const tag of ["IMP", "RME"]) {
    const parsed = parseCountryFlagVariants({
      tag,
      gamePath: sourceGamePath,
      assetRoot: sourceAssetRoot,
    });
    const variants = orderVariants(tag, parsed.variants);
    assertExpectedVariants(tag, variants);
    const outDir = path.join(assetRoot, tag);
    const inputFile = path.join(tempRoot, `${tag}.json`);
    fs.writeFileSync(inputFile, `${JSON.stringify({ variants }, null, 2)}\n`, "utf8");
    const rendered = writeCountryFlagVariantPngs({
      inputJson: inputFile,
      gamePath: sourceGamePath,
      outDir,
      flagWidth: 240,
      flagHeight: 144,
    });
    assertRenderedFiles(tag, rendered.files, variants);
    entries[tag] = buildFlagEntry(tag, parsed, variants);
  }

  writeSupplement(dataFile, entries);
  console.log(JSON.stringify({
    victorian_century_country_flags: "ok",
    data_file: projectPath(dataFile),
    asset_root: projectPath(assetRoot),
    tags: Object.keys(entries),
    variants: Object.fromEntries(Object.entries(entries).map(([tag, entry]) => [tag, entry.variants.length])),
  }, null, 2));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

function parseArgs(values) {
  const parsed = { gamePath: "", modPath: "", assetRoot: "", dataFile: "", python: "" };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--game-path" || value === "--mod-path" || value === "--asset-root" || value === "--data-file" || value === "--python") {
      const key = value.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      parsed[key] = values[index + 1] || "";
      if (!parsed[key]) throw new Error(`Missing value for ${value}`);
      index += 1;
    } else if (value === "--help" || value === "-h") {
      console.log("Usage: node scripts/build_victorian_century_country_flags.mjs [--game-path <dir>] [--mod-path <dir>] [--asset-root <dir>] [--data-file <file>] [--python <command>]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return parsed;
}

function buildMergedFlagSource(tempRoot) {
  const mergedGamePath = path.join(tempRoot, "game-source");
  const baseCommon = path.join(gamePath, "game", "common");
  const targetCommon = path.join(mergedGamePath, "game", "common");
  for (const relative of ["coat_of_arms", "flag_definitions", "named_colors"]) {
    fs.cpSync(path.join(baseCommon, relative), path.join(targetCommon, relative), { recursive: true });
  }

  const modCoa = path.join(modPath, "common", "coat_of_arms", "coat_of_arms", "imperial_federation.txt");
  const modFlags = path.join(modPath, "common", "flag_definitions", "joi_flag_definitions.txt");
  assertFile(modCoa, "Victorian Century IMP and RME coat-of-arms definitions");
  assertFile(modFlags, "Victorian Century IMP and RME flag definitions");
  fs.copyFileSync(modCoa, path.join(targetCommon, "coat_of_arms", "coat_of_arms", "zz_victorian_century_imperial_federation.txt"));
  const normalizedFlags = fs.readFileSync(modFlags, "utf8").replaceAll("REPLACE_OR_CREATE:", "").replaceAll("TRY_INJECT:", "");
  fs.writeFileSync(path.join(targetCommon, "flag_definitions", "zz_victorian_century_flag_definitions.txt"), normalizedFlags, "utf8");
  return mergedGamePath;
}

function buildMergedAssetSource(tempRoot) {
  const mergedAssetRoot = path.join(tempRoot, "coat_of_arms");
  fs.cpSync(path.join(root, "game", "gfx", "coat_of_arms"), mergedAssetRoot, { recursive: true });
  for (const texture of ["ce_saltire_if.dds", "ce_saltire_fimbriated_if.dds"]) {
    const source = path.join(modPath, "gfx", "coat_of_arms", "colored_emblems", texture);
    const destination = path.join(mergedAssetRoot, "colored_emblems", texture.replace(/\.dds$/i, ".png"));
    convertDdsToPng(source, destination);
  }
  return mergedAssetRoot;
}

function convertDdsToPng(source, destination) {
  assertFile(source, `Victorian Century coat-of-arms texture ${path.basename(source)}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const script = [
    "from pathlib import Path",
    "from PIL import Image",
    `source = Path(${JSON.stringify(source)})`,
    `destination = Path(${JSON.stringify(destination)})`,
    "with Image.open(source) as image:",
    "    image.convert('RGBA').save(destination, 'PNG')",
  ].join("\n");
  const result = spawnSync(python, ["-c", script], { encoding: "utf8", shell: false });
  if (result.error || result.status !== 0) {
    throw new Error(`Unable to convert ${path.basename(source)} to PNG using ${python}: ${result.error?.message || result.stderr || result.stdout}`.trim());
  }
}

function orderVariants(tag, variants) {
  const expectedOrder = tag === "IMP"
    ? ["IMP", "GBR_uk", "IMP_india"]
    : ["RME_Flag_Monarchy", "RME_Flag_Republic", "RME_Flag_Council", "RME_Flag_Theocracy"];
  const byKey = new Map(variants.map((variant) => [variant.key, variant]));
  return expectedOrder.map((key) => byKey.get(key)).filter(Boolean);
}

function assertExpectedVariants(tag, variants) {
  const expected = tag === "IMP"
    ? ["IMP", "GBR_uk", "IMP_india"]
    : ["RME_Flag_Monarchy", "RME_Flag_Republic", "RME_Flag_Council", "RME_Flag_Theocracy"];
  const actual = variants.map((variant) => variant.key);
  if (actual.join("|") !== expected.join("|")) {
    throw new Error(`${tag} flag variants changed: expected ${expected.join(", ")}, got ${actual.join(", ")}`);
  }
  for (const variant of variants) {
    const missing = variant.textures
      .filter((texture) => !texture.name.startsWith("pattern_") && texture.asset?.status !== "found")
      .map((texture) => texture.name);
    if (missing.length) throw new Error(`${tag} ${variant.key} references missing textures: ${missing.join(", ")}`);
  }
}

function assertRenderedFiles(tag, files, variants) {
  const expected = variants.map((variant) => `${variant.exportKey}.png`).sort();
  const actual = files.map((file) => path.basename(file)).sort();
  if (actual.join("|") !== expected.join("|")) {
    throw new Error(`${tag} rendered PNGs changed: expected ${expected.join(", ")}, got ${actual.join(", ")}`);
  }
}

function buildFlagEntry(tag, parsed, variants) {
  const definitionByKey = new Map(parsed.flagDefinitions.map((definition) => [definition.key, definition]));
  return {
    tag,
    name: tag === "IMP" ? "帝国联邦" : "罗马帝国",
    source: "Victorian Century 模组纹章定义",
    assetDir: `assets/victorian-century-flags/${tag}`,
    variants: variants.map((variant) => {
      const definition = definitionByKey.get(variant.key);
      return {
        key: variant.key,
        exportKey: variant.exportKey,
        image: `assets/victorian-century-flags/${tag}/${variant.exportKey}.png`,
        priority: definition?.priority ?? 0,
        subjectCanton: variant.key,
        allowOverlordCanton: "yes",
        triggerSummary: triggerSummary(variant.key),
        triggerRaw: triggerRaw(variant.key),
        sourceLine: definition?.line ?? variant.startLine,
        fallback: false,
      };
    }),
  };
}

function triggerSummary(key) {
  return {
    GBR_uk: "使用英国旗帜",
    IMP: "控制印度的一部分地区",
    IMP_india: "控制印度的一部分地区",
    RME_Flag_Monarchy: "君主制",
    RME_Flag_Republic: "共和制",
    RME_Flag_Council: "委员会共和制",
    RME_Flag_Theocracy: "神权制",
  }[key] || "";
}

function triggerRaw(key) {
  return {
    GBR_uk: "coa_def_uk_flag = yes",
    IMP: "coa_def_controls_part_of_india = yes",
    IMP_india: "coa_def_controls_part_of_india = yes",
    RME_Flag_Monarchy: "coa_def_monarchy_flag_trigger = yes",
    RME_Flag_Republic: "coa_def_republic_flag_trigger = yes",
    RME_Flag_Council: "coa_def_communist_flag_trigger = yes",
    RME_Flag_Theocracy: "coa_def_theocracy_flag_trigger = yes",
  }[key] || "";
}

function writeSupplement(file, entries) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload = JSON.stringify(entries, null, 2);
  fs.writeFileSync(file, `/* Generated by scripts/build_victorian_century_country_flags.mjs. */\n(() => {\n  const flags = window.VIC3_COUNTRY_FLAGS || {};\n  Object.assign(flags, ${payload});\n  window.VIC3_COUNTRY_FLAGS = flags;\n  if (typeof globalThis !== "undefined") globalThis.VIC3_COUNTRY_FLAGS = flags;\n})();\n`, "utf8");
}

function assertDirectory(candidate, label) {
  if (!fs.statSync(candidate, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Missing ${label}: ${candidate}`);
  }
}

function assertFile(candidate, label) {
  if (!fs.statSync(candidate, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Missing ${label}: ${candidate}`);
  }
}

function projectPath(file) {
  const relative = path.relative(root, file);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative)
    ? relative.replaceAll("\\", "/")
    : file;
}
