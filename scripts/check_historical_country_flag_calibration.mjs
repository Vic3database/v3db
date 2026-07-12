import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";

const root = process.cwd();
const generatedJsonFile = path.join(root, "output_next", "flags", "generated", "ANK.json");
const generatedPngFile = path.join(root, "output_next", "flags", "generated", "png", "ANK", "ANK.png");
const siteFlagsFile = path.join(root, "site", "assets", "flags", "country-flags.js");
const sitePngFile = path.join(root, "site", "assets", "flags", "ANK", "ANK.png");
const wikiPngFile = path.join(root, "output_next", "flags", "wiki", "Ankole_wiki_330.png");

const generated = readJson(generatedJsonFile);
assert.equal(generated.tag, "ANK");
assert.equal(generated.source, "generated:historical-country-coa");
assert.equal(generated.calibration?.status, "wiki-matched");
assert.equal(generated.calibration?.referenceUrl, "https://vic3.paradoxwikis.com/Eastern_Bantu_kingdoms#Ankole");
assert.equal(generated.calibration?.referenceImage, "output_next/flags/wiki/Ankole_wiki_330.png");
assert.equal(generated.calibration?.classification, "historical-country-fixed-generated-flag");
assert.equal(generated.variants?.[0]?.historicalGenerated, true);
assert.equal(generated.variants?.[0]?.templateGenerated, false);

assert.ok(fs.existsSync(wikiPngFile), "wiki calibration PNG should exist");
assert.ok(fs.existsSync(generatedPngFile), "generated ANK PNG should exist");
assert.ok(fs.existsSync(sitePngFile), "site ANK PNG should exist");

const wiki = readPng(wikiPngFile);
const generatedPng = readPng(generatedPngFile);
const sitePng = readPng(sitePngFile);
assert.equal(wiki.width, 330);
assert.equal(wiki.height, 220);
assert.equal(generatedPng.width, 330);
assert.equal(generatedPng.height, 220);
assert.equal(sitePng.width, 330);
assert.equal(sitePng.height, 220);
assert.ok(buffersEqual(wiki.pixels, generatedPng.pixels), "generated ANK PNG should match the wiki calibration image");
assert.ok(buffersEqual(wiki.pixels, sitePng.pixels), "site ANK PNG should match the wiki calibration image");

const topColors = dominantColors(sitePng, 3).map((item) => item.hex);
assert.deepEqual(topColors, ["#085936", "#D5A624", "#0F0F0F"]);

const siteFlags = readScriptGlobal(siteFlagsFile, "VIC3_COUNTRY_FLAGS");
const ank = siteFlags.ANK;
assert.equal(ank?.source, "generated:historical-country-coa");
assert.equal(ank?.variants?.length, 1);
assert.equal(ank?.variants?.[0]?.image, "assets/flags/ANK/ANK.png");
assert.equal(ank?.variants?.[0]?.fallback, false);
assert.equal(ank?.variants?.[0]?.historicalGenerated, true);
assert.equal(ank?.variants?.[0]?.templateGenerated, false);
assert.equal(ank?.variants?.[0]?.calibrationStatus, "wiki-matched");
assert.equal(ank?.variants?.[0]?.referenceUrl, "https://vic3.paradoxwikis.com/Eastern_Bantu_kingdoms#Ankole");

console.log(JSON.stringify({
  historical_country_flag_calibration: "ok",
  tag: generated.tag,
  source: generated.source,
  dimensions: `${sitePng.width}x${sitePng.height}`,
  topColors,
  png: path.relative(root, sitePngFile).replaceAll("\\", "/"),
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
  assert.equal(bitDepth, 8, "PNG checker only supports 8-bit images");
  const bytesPerPixel = colorType === 6 ? 4 : 1;
  const rowSize = 1 + width * bytesPerPixel;
  const unfiltered = unfilterPngRows(zlib.inflateSync(Buffer.concat(chunks)), width, height, bytesPerPixel, rowSize);
  const pixels = colorType === 3 ? expandPalette(unfiltered, palette) : unfiltered;
  return {
    width,
    height,
    pixels,
  };
}

function expandPalette(indexes, palette) {
  assert.ok(palette, "indexed PNG should include a PLTE chunk");
  const pixels = Buffer.alloc(indexes.length * 4);
  for (let index = 0; index < indexes.length; index += 1) {
    const paletteIndex = indexes[index] * 3;
    const offset = index * 4;
    pixels[offset] = palette[paletteIndex];
    pixels[offset + 1] = palette[paletteIndex + 1];
    pixels[offset + 2] = palette[paletteIndex + 2];
    pixels[offset + 3] = 255;
  }
  return pixels;
}

function unfilterPngRows(raw, width, height, bytesPerPixel, rowSize) {
  const stride = width * bytesPerPixel;
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

function dominantColors(png, count) {
  const colors = new Map();
  for (let offset = 0; offset < png.pixels.length; offset += 4) {
    const alpha = png.pixels[offset + 3];
    const key = [
      png.pixels[offset],
      png.pixels[offset + 1],
      png.pixels[offset + 2],
      alpha,
    ].join(",");
    colors.set(key, (colors.get(key) || 0) + 1);
  }
  return [...colors.entries()]
    .map(([key, value]) => {
      const [red, green, blue, alpha] = key.split(",").map(Number);
      return {
        count: value,
        hex: `#${hex(red)}${hex(green)}${hex(blue)}`,
        alpha,
      };
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, count);
}

function hex(value) {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

function buffersEqual(left, right) {
  return left.length === right.length && left.equals(right);
}
