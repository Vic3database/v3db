import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { writeCountryFlagBatch } from "./lib/country_flag_variants.mjs";
import { writeCountryFlagPreviewContactSheet } from "./lib/country_flag_variants.mjs";
import { writeCountryFlagVariantPngs } from "./lib/country_flag_variants.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "vic3-flag-batch-full-"));

try {
  const { manifest } = writeCountryFlagBatch({
    gamePath: "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
    assetRoot: path.join(root, "game", "gfx", "coat_of_arms"),
    outDir,
  });

  assert.equal(manifest.totalTags, 503);
  assert.equal(manifest.totalVariants, 1407);
  assert.equal(manifest.missingAssetReferences, 0);

  const missingTags = manifest.tags
    .filter((entry) => entry.missingAssetReferences > 0)
    .map((entry) => entry.tag);
  assert.deepEqual(missingTags, []);

  const sample = JSON.parse(fs.readFileSync(path.join(outDir, "IBE.json"), "utf8"));
  sample.tag = "UNICODE";
  sample.variants = sample.variants.slice(0, 2).map((variant, index) => ({
    ...variant,
    key: index === 0 ? "IBE 伊比利亚" : "IBE 共和国",
  }));
  const unicodeJson = path.join(outDir, "unicode-preview.json");
  const unicodePng = path.join(outDir, "unicode-preview.png");
  fs.writeFileSync(unicodeJson, `${JSON.stringify(sample, null, 2)}\n`, "utf8");
  const preview = writeCountryFlagPreviewContactSheet({
    inputJson: unicodeJson,
    gamePath: "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
    outFile: unicodePng,
    columns: 1,
    flagWidth: 120,
    flagHeight: 72,
  });
  assert.ok(preview.height > 250, `expected unicode preview to contain two rows, got ${preview.height}px`);

  const patternSample = JSON.parse(fs.readFileSync(path.join(outDir, "BEL.json"), "utf8"));
  patternSample.tag = "PATTERN";
  patternSample.variants = [
    JSON.parse(fs.readFileSync(path.join(outDir, "BEL.json"), "utf8")).variants[0],
    JSON.parse(fs.readFileSync(path.join(outDir, "BAV.json"), "utf8")).variants[0],
    JSON.parse(fs.readFileSync(path.join(outDir, "ARN.json"), "utf8")).variants[0],
  ];
  const patternJson = path.join(outDir, "pattern-preview.json");
  const patternPng = path.join(outDir, "pattern-preview.png");
  fs.writeFileSync(patternJson, `${JSON.stringify(patternSample, null, 2)}\n`, "utf8");
  writeCountryFlagPreviewContactSheet({
    inputJson: patternJson,
    gamePath: "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
    outFile: patternPng,
    columns: 3,
    flagWidth: 120,
    flagHeight: 72,
  });
  assertPixelNear(patternPng, 30, 40, [13, 13, 13], "Belgium left stripe");
  assertPixelNear(patternPng, 90, 40, [217, 169, 37], "Belgium middle stripe");
  assertPixelNear(patternPng, 130, 40, [140, 9, 7], "Belgium right stripe");

  const reportedTagsOut = path.join(outDir, "reported");
  const reported = writeCountryFlagBatch({
    tags: ["GRN", "HAM", "GBR", "BRI", "ROM", "PAR", "SCO"],
    gamePath: "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
    assetRoot: path.join(root, "game", "gfx", "coat_of_arms"),
    outDir: reportedTagsOut,
  });
  const reportedCounts = new Map(reported.manifest.tags.map((entry) => [entry.tag, entry.variants]));
  assert.equal(reportedCounts.get("ROM"), 2, "Romania should only export flag-definition variants");
  assert.equal(reportedCounts.get("PAR"), 5, "Parma should exclude subject-only helper flags");

  const reportedPngDir = path.join(outDir, "reported-png");
  for (const tag of ["GRN", "HAM", "GBR", "BRI", "ROM", "PAR", "SCO"]) {
    writeCountryFlagVariantPngs({
      inputJson: path.join(reportedTagsOut, `${tag}.json`),
      gamePath: "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
      outDir: path.join(reportedPngDir, tag),
      flagWidth: 120,
      flagHeight: 72,
    });
  }
  assertPixelNear(path.join(reportedPngDir, "GRN", "GRN.png"), 20, 18, [230, 230, 230], "Greenland top white");
  assertPixelNear(path.join(reportedPngDir, "GRN", "GRN.png"), 20, 54, [140, 9, 7], "Greenland bottom red");
  assertPixelNear(path.join(reportedPngDir, "GRN", "GRN.png"), 46, 25, [140, 9, 7], "Greenland red upper circle");
  assertPixelNear(path.join(reportedPngDir, "GRN", "GRN.png"), 46, 47, [230, 230, 230], "Greenland white lower circle");
  assertPixelNear(path.join(reportedPngDir, "BRI", "BRI.png"), 12, 1, [13, 13, 13], "Brittany ermine spot");
  assertPixelNear(path.join(reportedPngDir, "GBR", "GBR.png"), 30, 5, [15, 25, 76], "Great Britain blue field");
  assertPixelNear(path.join(reportedPngDir, "GBR", "GBR.png"), 60, 36, [140, 9, 7], "Great Britain red cross center");
  assertPixelNear(path.join(reportedPngDir, "SCO", "SCO.png"), 30, 5, [15, 25, 76], "Scotland blue field");
  assertPixelNear(path.join(reportedPngDir, "SCO", "SCO.png"), 60, 36, [230, 230, 230], "Scotland white saltire center");
  assertPixelNotNear(path.join(reportedPngDir, "PAR", "PAR_absolute_monarchy.png"), 60, 38, [230, 230, 230], "Parma monarchy should include central arms");

  console.log(
    `country flag batch check passed: ${manifest.totalTags} tags, ${manifest.totalVariants} variants, ${manifest.missingAssetReferences} missing asset refs`,
  );
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}

function assertPixelNear(file, x, y, expected, label) {
  const actual = readPixel(file, x, y);
  for (let index = 0; index < 3; index += 1) {
    assert.ok(Math.abs(actual[index] - expected[index]) <= 3, `${label}: expected ${expected.join(",")}, got ${actual.join(",")}`);
  }
}

function assertPixelNotNear(file, x, y, unexpected, label) {
  const actual = readPixel(file, x, y);
  const close = actual.every((value, index) => Math.abs(value - unexpected[index]) <= 8);
  assert.ok(!close, `${label}: did not expect ${unexpected.join(",")}, got ${actual.join(",")}`);
}

function readPixel(file, x, y) {
  const script = `
Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::new("${file.replaceAll("\\", "\\\\")}")
try {
  $p = $bmp.GetPixel(${x}, ${y})
  Write-Output "$($p.R),$($p.G),$($p.B)"
} finally {
  $bmp.Dispose()
}
`;
  return execPowerShell(script).trim().split(",").map(Number);
}

function execPowerShell(script) {
  return execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], { encoding: "utf8" });
}
