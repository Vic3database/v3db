import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";

const root = process.cwd();
const batchRoot = path.join(root, "output_next", "flags", "countries");
const sourceManifestFile = path.join(batchRoot, "manifest.json");
const sourcePngRoot = path.join(root, "output_next", "flags", "png");
const generatedFlagRoot = path.join(root, "output_next", "flags", "generated");
const generatedFlagPngRoot = path.join(generatedFlagRoot, "png");
const siteDataFile = path.join(root, "site", "data.js");
const outRoot = path.join(root, "site", "assets", "flags");
const outFile = path.join(outRoot, "country-flags.js");

const manifest = readJson(sourceManifestFile);
const siteCountries = readSiteCountries(siteDataFile);
const payload = {};
const skipped = [];
let crcTable = null;
let copiedPngs = 0;
let copiedGeneratedPngs = 0;
let generatedFallbackPngs = 0;
let generatedFlagTags = 0;
let totalVariants = 0;

fs.mkdirSync(outRoot, { recursive: true });
for (const entry of fs.readdirSync(outRoot, { withFileTypes: true })) {
  const fullPath = path.join(outRoot, entry.name);
  if (entry.isDirectory()) fs.rmSync(fullPath, { recursive: true, force: true });
}

for (const entry of manifest.tags || []) {
  const fileStem = path.basename(entry.file, ".json");
  const flagJson = readJson(path.join(batchRoot, entry.file));
  const sourcePngDir = path.join(sourcePngRoot, fileStem);
  const sitePngDirName = safeFileStem(entry.tag);
  const outPngDir = path.join(outRoot, sitePngDirName);
  const variants = buildSiteVariants(flagJson, sitePngDirName);
  const missingPngs = variants
    .map((variant) => variant.fileName)
    .filter((fileName) => !fs.existsSync(path.join(sourcePngDir, fileName)));

  if (missingPngs.length) {
    skipped.push({ tag: entry.tag, reason: "missing_png", missingPngs });
    continue;
  }

  fs.mkdirSync(outPngDir, { recursive: true });
  for (const variant of variants) {
    fs.copyFileSync(path.join(sourcePngDir, variant.fileName), path.join(outPngDir, variant.fileName));
    copiedPngs += 1;
  }

  payload[entry.tag] = {
    tag: entry.tag,
    name: siteCountries.get(entry.tag)?.name || siteCountries.get(entry.tag)?.name_zh || entry.tag,
    source: sourceLabel(flagJson),
    assetDir: `assets/flags/${sitePngDirName}`,
    variants: variants.map(({ fileName, ...variant }) => variant),
  };
  totalVariants += variants.length;
}

for (const generatedFile of listGeneratedFlagFiles(generatedFlagRoot)) {
  const flagJson = readJson(generatedFile);
  const tag = flagJson.tag;
  if (!tag || payload[tag]) continue;
  const sitePngDirName = safeFileStem(tag);
  const sourcePngDir = path.join(generatedFlagPngRoot, safeFileStem(tag));
  const outPngDir = path.join(outRoot, sitePngDirName);
  const variants = buildGeneratedFlagVariants(flagJson, sitePngDirName);
  const missingPngs = variants
    .map((variant) => variant.fileName)
    .filter((fileName) => !fs.existsSync(path.join(sourcePngDir, fileName)));

  if (missingPngs.length) {
    skipped.push({ tag, reason: "missing_template_png", missingPngs });
    continue;
  }

  fs.mkdirSync(outPngDir, { recursive: true });
  for (const variant of variants) {
    fs.copyFileSync(path.join(sourcePngDir, variant.fileName), path.join(outPngDir, variant.fileName));
    copiedGeneratedPngs += 1;
  }

  payload[tag] = {
    tag,
    name: siteCountries.get(tag)?.name || siteCountries.get(tag)?.name_zh || tag,
    source: flagJson.source || "generated:coa-template",
    assetDir: `assets/flags/${sitePngDirName}`,
    variants: variants.map(({ fileName, ...variant }) => variant),
  };
  generatedFlagTags += 1;
  totalVariants += variants.length;
}

for (const [tag, country] of [...siteCountries.entries()].sort(([left], [right]) => left.localeCompare(right))) {
  if (payload[tag]) continue;
  const sitePngDirName = safeFileStem(tag);
  const outPngDir = path.join(outRoot, sitePngDirName);
  const fileName = `${safeFileStem(tag)}.png`;
  fs.mkdirSync(outPngDir, { recursive: true });
  writeSolidPng(path.join(outPngDir, fileName), rgbFromCountryColor(country));
  payload[tag] = {
    tag,
    name: country.name || country.name_zh || tag,
    source: "generated:fallback-country-color",
    assetDir: `assets/flags/${sitePngDirName}`,
    variants: [{
      key: tag,
      exportKey: tag,
      image: `assets/flags/${sitePngDirName}/${fileName}`,
      priority: 0,
      subjectCanton: "",
      allowOverlordCanton: "",
      triggerSummary: "国家颜色回退",
      triggerRaw: "",
      sourceLine: 0,
      fallback: true,
    }],
  };
  generatedFallbackPngs += 1;
  totalVariants += 1;
}

fs.writeFileSync(outFile, `var VIC3_COUNTRY_FLAGS = ${JSON.stringify(payload, null, 2)};\nwindow.VIC3_COUNTRY_FLAGS = VIC3_COUNTRY_FLAGS;\nif (typeof globalThis !== "undefined") globalThis.VIC3_COUNTRY_FLAGS = VIC3_COUNTRY_FLAGS;\n`, "utf8");

console.log(JSON.stringify({
  outFile: path.relative(root, outFile).replaceAll("\\", "/"),
  tags: Object.keys(payload).length,
  variants: totalVariants,
  parsedTags: (manifest.tags || []).length,
  siteCountryTags: siteCountries.size,
  generatedFlagTags,
  generatedFallbackTags: generatedFallbackPngs,
  copiedPngs,
  copiedGeneratedPngs,
  generatedFallbackPngs,
  totalPngs: copiedPngs + copiedGeneratedPngs + generatedFallbackPngs,
  skipped,
}, null, 2));

function buildSiteVariants(flagJson, sitePngDirName) {
  const flagDefinitions = readFlagDefinitions(flagJson);
  const definitionsByKey = new Map(flagDefinitions.map((definition) => [definition.key, definition]));
  return (flagJson.variants || []).map((variant) => {
    const definition = definitionsByKey.get(variant.key) || {};
    const exportKey = variant.exportKey || variant.key;
    const fileName = `${safeFileStem(exportKey)}.png`;
    return {
      key: variant.key,
      exportKey,
      image: `assets/flags/${sitePngDirName}/${fileName}`,
      fileName,
      priority: definition.priority ?? 0,
      subjectCanton: definition.subjectCanton || "",
      allowOverlordCanton: definition.allowOverlordCanton || "",
      triggerSummary: summarizeTrigger(definition.triggerRaw),
      triggerRaw: definition.triggerRaw || "",
      sourceLine: definition.line || 0,
    };
  });
}

function buildGeneratedFlagVariants(flagJson, sitePngDirName) {
  return (flagJson.variants || []).map((variant) => {
    const exportKey = variant.exportKey || variant.key || flagJson.tag;
    const fileName = `${safeFileStem(exportKey)}.png`;
    const hitTriggers = flagJson.triggerSummary?.hitTriggers || variant.triggerSummary?.hitTriggers || [];
    const historicalGenerated = Boolean(variant.historicalGenerated);
    const templateGenerated = historicalGenerated ? false : Boolean(variant.templateGenerated ?? true);
    return {
      key: variant.key || flagJson.tag,
      exportKey,
      image: `assets/flags/${sitePngDirName}/${fileName}`,
      fileName,
      priority: 0,
      subjectCanton: "",
      allowOverlordCanton: "",
      triggerSummary: hitTriggers.join(", "),
      triggerRaw: "",
      sourceLine: variant.startLine || 0,
      fallback: false,
      templateGenerated,
      historicalGenerated,
      templateName: variant.templateName || flagJson.templateName || "",
      calibrationStatus: variant.calibrationStatus || flagJson.calibration?.status || "",
      referenceUrl: variant.referenceUrl || flagJson.calibration?.referenceUrl || "",
      referenceImage: variant.referenceImage || flagJson.calibration?.referenceImage || "",
      generationTrace: variant.generationTrace || flagJson.generationTrace || null,
    };
  });
}

function listGeneratedFlagFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  return fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => path.join(rootDir, entry.name))
    .sort();
}

function readFlagDefinitions(flagData) {
  const file = (flagData.flagDefinitionFiles || []).find((item) => item.endsWith("00_flag_definitions.txt"));
  const definitions = flagData.flagDefinitions || [];
  if (!file || !definitions.length) return definitions;

  const lines = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
  return definitions.map((definition, index) => {
    const startLine = Math.max(1, definition.line);
    const endLine = index + 1 < definitions.length
      ? Math.max(startLine, definitions[index + 1].line - 1)
      : findDefinitionEndLine(lines, startLine);
    const block = lines.slice(startLine - 1, endLine).join("\n");
    return {
      ...definition,
      subjectCanton: firstAssignmentValue(block, "subject_canton"),
      allowOverlordCanton: firstAssignmentValue(block, "allow_overlord_canton"),
      triggerRaw: extractObjectBlock(block, "trigger"),
    };
  });
}

function readSiteCountries(file) {
  const countries = new Map();
  if (!fs.existsSync(file)) return countries;
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  for (const country of sandbox.window.VIC3_DATA?.countries || []) {
    if (country.tag) countries.set(country.tag, country);
  }
  return countries;
}

function sourceLabel(flagJson) {
  const first = (flagJson.flagDefinitionFiles || [])[0] || (flagJson.sourceFiles || [])[0] || "";
  return first.replaceAll("\\", "/").split("/game/").pop() || first;
}

function findDefinitionEndLine(lines, startLine) {
  let depth = 0;
  let opened = false;
  for (let lineIndex = startLine - 1; lineIndex < lines.length; lineIndex += 1) {
    const line = stripComment(lines[lineIndex]);
    for (const char of line) {
      if (char === "{") {
        depth += 1;
        opened = true;
      } else if (char === "}") {
        depth -= 1;
        if (opened && depth <= 0) return lineIndex + 1;
      }
    }
  }
  return startLine;
}

function firstAssignmentValue(block, key) {
  const match = block.match(new RegExp(`(^|\\n)\\s*${escapeRegExp(key)}\\s*=\\s*([^\\n#]+)`));
  return match ? match[2].trim() : "";
}

function extractObjectBlock(block, key) {
  const match = new RegExp(`(^|\\n)(\\s*)${escapeRegExp(key)}\\s*=\\s*\\{`).exec(block);
  if (!match) return "";
  const openIndex = match.index + match[0].lastIndexOf("{");
  let depth = 0;
  for (let index = openIndex; index < block.length; index += 1) {
    const char = block[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return block.slice(match.index + match[1].length, index + 1).trim();
      }
    }
  }
  return "";
}

function summarizeTrigger(triggerRaw) {
  if (!triggerRaw) return "默认候选";
  const keys = [];
  for (const match of triggerRaw.matchAll(/([A-Za-z0-9_:?]+)\s*=/g)) {
    const key = match[1];
    if (key === "trigger" || key === "NOT" || key === "OR" || key === "AND") continue;
    keys.push(key);
  }
  return [...new Set(keys)].slice(0, 5).join("，") || "条件候选";
}

function safeFileStem(value) {
  const stem = String(value || "")
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/[\s.]+$/g, "")
    || "_";
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem) ? `_${stem}` : stem;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeSolidPng(file, color, width = 240, height = 144) {
  const bytesPerPixel = 4;
  const rowSize = 1 + width * bytesPerPixel;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * rowSize;
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = rowOffset + 1 + x * bytesPerPixel;
      raw[offset] = color.red;
      raw[offset + 1] = color.green;
      raw[offset + 2] = color.blue;
      raw[offset + 3] = 255;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]));
}

function rgbFromCountryColor(country) {
  const hex = String(country?.colorHex || "").trim();
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (match) {
    return {
      red: parseInt(match[1].slice(0, 2), 16),
      green: parseInt(match[1].slice(2, 4), 16),
      blue: parseInt(match[1].slice(4, 6), 16),
    };
  }

  const values = String(country?.color || country?.rgb || "").match(/\d+/g)?.slice(0, 3).map(Number) || [];
  if (values.length === 3) {
    return {
      red: clampColor(values[0]),
      green: clampColor(values[1]),
      blue: clampColor(values[2]),
    };
  }

  return { red: 128, green: 128, blue: 128 };
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, checksum]);
}

function crc32(buffer) {
  if (!crcTable) crcTable = buildCrcTable();
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildCrcTable() {
  return Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    return value >>> 0;
  });
}

function clampColor(value) {
  return Math.max(0, Math.min(255, Number.isFinite(value) ? value : 0));
}

function stripComment(line) {
  return line.replace(/#.*/, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
