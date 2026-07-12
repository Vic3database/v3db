import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";

const root = process.cwd();
const missingFile = path.join(root, "output_next", "flags", "missing", "missing-country-flags.json");
const siteFlagsFile = path.join(root, "site", "assets", "flags", "country-flags.js");
const generatedRoot = path.join(root, "output_next", "flags", "generated");
const generatedPngRoot = path.join(generatedRoot, "png");
const sitePngRoot = path.join(root, "site", "assets", "flags");

assert.ok(fs.existsSync(missingFile), "missing country flag manifest should exist");
assert.ok(fs.existsSync(siteFlagsFile), "site country flag data should exist");

const missing = readJson(missingFile);
assert.equal(missing.dynamic, 0, "backfill scope should only include fixed historical country tags");
assert.ok(missing.historicalTags?.length > 0, "backfill scope should include historical tags");

const siteFlags = readScriptGlobal(siteFlagsFile, "VIC3_COUNTRY_FLAGS");
const failures = [];

for (const tag of missing.historicalTags) {
  const generatedFile = path.join(generatedRoot, `${tag}.json`);
  const generatedPngFile = path.join(generatedPngRoot, tag, `${tag}.png`);
  const sitePngFile = path.join(sitePngRoot, tag, `${tag}.png`);
  const siteEntry = siteFlags[tag];
  const variant = siteEntry?.variants?.[0];
  let generated = null;

  if (!fs.existsSync(generatedFile)) {
    failures.push(`${tag}: missing generated JSON`);
    continue;
  }

  generated = readJson(generatedFile);
  if (generated.source !== "generated:historical-country-coa") {
    failures.push(`${tag}: generated source is ${generated.source}`);
  }
  if (generated.calibration?.status !== "wiki-matched") {
    failures.push(`${tag}: calibration status is ${generated.calibration?.status || "missing"}`);
  }
  if (!generated.variants?.[0]?.historicalGenerated) {
    failures.push(`${tag}: generated variant is not marked historicalGenerated`);
  }
  if (generated.variants?.[0]?.templateGenerated) {
    failures.push(`${tag}: generated variant is still marked templateGenerated`);
  }
  if (!fs.existsSync(generatedPngFile)) {
    failures.push(`${tag}: missing generated PNG`);
  }

  if (siteEntry?.source !== "generated:historical-country-coa") {
    failures.push(`${tag}: site source is ${siteEntry?.source || "missing"}`);
  }
  if (!variant) {
    failures.push(`${tag}: missing site variant`);
  } else {
    if (variant.image !== `assets/flags/${tag}/${tag}.png`) {
      failures.push(`${tag}: site image is ${variant.image}`);
    }
    if (variant.fallback) {
      failures.push(`${tag}: site variant is fallback`);
    }
    if (!variant.historicalGenerated) {
      failures.push(`${tag}: site variant is not historicalGenerated`);
    }
    if (variant.templateGenerated) {
      failures.push(`${tag}: site variant is still templateGenerated`);
    }
  }
  if (!fs.existsSync(sitePngFile)) {
    failures.push(`${tag}: missing site PNG`);
  }

  const referenceImage = generated.calibration?.referenceImage;
  const referencePngFile = referenceImage ? path.join(root, referenceImage) : "";
  if (!referenceImage || !fs.existsSync(referencePngFile)) {
    failures.push(`${tag}: missing reference PNG`);
  } else if (fs.existsSync(generatedPngFile) && fs.existsSync(sitePngFile)) {
    const referencePng = readPng(referencePngFile);
    const generatedPng = readPng(generatedPngFile);
    const sitePng = readPng(sitePngFile);
    if (`${referencePng.width}x${referencePng.height}` !== "330x220") {
      failures.push(`${tag}: reference PNG dimensions are ${referencePng.width}x${referencePng.height}`);
    }
    if (`${generatedPng.width}x${generatedPng.height}` !== "330x220") {
      failures.push(`${tag}: generated PNG dimensions are ${generatedPng.width}x${generatedPng.height}`);
    }
    if (`${sitePng.width}x${sitePng.height}` !== "330x220") {
      failures.push(`${tag}: site PNG dimensions are ${sitePng.width}x${sitePng.height}`);
    }
    if (!generatedPng.pixels.equals(referencePng.pixels)) {
      failures.push(`${tag}: generated PNG does not match reference`);
    }
    if (!sitePng.pixels.equals(referencePng.pixels)) {
      failures.push(`${tag}: site PNG does not match reference`);
    }
    if (!isSolidPngData(referencePng) && isSolidPngData(generatedPng)) {
      failures.push(`${tag}: generated PNG is solid but reference is not`);
    }
    if (!isSolidPngData(referencePng) && isSolidPngData(sitePng)) {
      failures.push(`${tag}: site PNG is solid but reference is not`);
    }
  }
}

assert.deepEqual(failures, [], failures.slice(0, 20).join("\n"));

console.log(JSON.stringify({
  historical_country_flag_backfill: "ok",
  checkedTags: missing.historicalTags.length,
}, null, 2));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function readScriptGlobal(file, globalName) {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox[globalName];
}

function isSolidPngData(png) {
  const first = png.pixels.subarray(0, 4);
  for (let offset = 0; offset < png.pixels.length; offset += 4) {
    const pixel = png.pixels.subarray(offset, offset + 4);
    if (!pixel.equals(first)) return false;
  }
  return true;
}

function readPng(file) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.toString("ascii", 1, 4), "PNG", `${file} should be a PNG`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  const chunks = [];
  let palette = null;
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (type === "IDAT") chunks.push(bytes.subarray(dataStart, dataEnd));
    if (type === "PLTE") palette = bytes.subarray(dataStart, dataEnd);
    offset = dataEnd + 4;
  }

  assert.ok(colorType === 3 || bitDepth === 8, "PNG checker only supports indexed images or 8-bit RGBA images");
  const bytesPerPixel = colorType === 6 ? 4 : 1;
  const stride = colorType === 3 ? Math.ceil(width * bitDepth / 8) : width * bytesPerPixel;
  const rowSize = 1 + stride;
  const unfiltered = unfilterPngRows(zlib.inflateSync(Buffer.concat(chunks)), width, height, bytesPerPixel, rowSize, stride);
  return {
    width,
    height,
    pixels: colorType === 3 ? expandPalette(unfiltered, palette, bitDepth, width, height) : unfiltered,
  };
}

function expandPalette(indexes, palette, bitDepth, width, height) {
  assert.ok(palette, "indexed PNG should include a PLTE chunk");
  const pixels = Buffer.alloc(width * height * 4);
  let pixelIndex = 0;
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * Math.ceil(width * bitDepth / 8);
    for (let x = 0; x < width; x += 1) {
      const paletteValue = readPackedIndex(indexes, rowStart, x, bitDepth);
      const paletteIndex = paletteValue * 3;
      const offset = pixelIndex * 4;
      pixels[offset] = palette[paletteIndex];
      pixels[offset + 1] = palette[paletteIndex + 1];
      pixels[offset + 2] = palette[paletteIndex + 2];
      pixels[offset + 3] = 255;
      pixelIndex += 1;
    }
  }
  return pixels;
}

function readPackedIndex(indexes, rowStart, x, bitDepth) {
  if (bitDepth === 8) return indexes[rowStart + x];
  const byte = indexes[rowStart + Math.floor((x * bitDepth) / 8)];
  const shift = 8 - bitDepth - ((x * bitDepth) % 8);
  const mask = (1 << bitDepth) - 1;
  return (byte >> shift) & mask;
}

function unfilterPngRows(raw, width, height, bytesPerPixel, rowSize, stride = width * bytesPerPixel) {
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * rowSize;
    const filter = raw[rowOffset];
    const outOffset = y * stride;
    const previousOffset = y > 0 ? (y - 1) * stride : -1;
    for (let x = 0; x < stride; x += 1) {
      const rawValue = raw[rowOffset + 1 + x];
      const left = x >= bytesPerPixel ? pixels[outOffset + x - bytesPerPixel] : 0;
      const up = previousOffset >= 0 ? pixels[previousOffset + x] : 0;
      const upLeft = previousOffset >= 0 && x >= bytesPerPixel ? pixels[previousOffset + x - bytesPerPixel] : 0;
      let value;
      if (filter === 0) value = rawValue;
      else if (filter === 1) value = rawValue + left;
      else if (filter === 2) value = rawValue + up;
      else if (filter === 3) value = rawValue + Math.floor((left + up) / 2);
      else if (filter === 4) value = rawValue + paeth(left, up, upLeft);
      else throw new Error(`Unsupported PNG filter ${filter}`);
      pixels[outOffset + x] = value & 0xff;
    }
  }
  return pixels;
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpLeft = Math.abs(estimate - upLeft);
  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) return left;
  if (distanceUp <= distanceUpLeft) return up;
  return upLeft;
}
