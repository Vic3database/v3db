import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  discoverCountryFlagTags,
  loadCoaNamedColors,
  parseCountryFlagVariants,
  writeCountryFlagBatch,
  writeCountryFlagVariantPngs,
} from "./lib/country_flag_variants.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const result = parseCountryFlagVariants({
  tag: "IBE",
  gamePath: "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
  assetRoot: path.join(root, "game", "gfx", "coat_of_arms"),
});

assert.equal(result.tag, "IBE");
assert.ok(result.sourceFiles.some((file) => file.endsWith("02_countries.txt")), "IBE should come from 02_countries.txt");

const variantKeys = result.variants.map((variant) => variant.key);
for (const key of [
  "IBE",
  "IBE_monarchy",
  "IBE_monarchy_bourbon",
  "IBE_monarchy_absolutist",
  "IBE_republic_1",
  "IBE_republic_2",
  "IBE_republic_3",
  "IBE_communist",
  "IBE_corporate_state",
  "IBE_anarchist",
  "IBE_theocracy",
]) {
  assert.ok(variantKeys.includes(key), `expected ${key} in IBE variants`);
}

assert.ok(result.variants.length >= 20, `expected at least 20 IBE variants, got ${result.variants.length}`);

const byKey = new Map(result.variants.map((variant) => [variant.key, variant]));
assert.equal(byKey.get("IBE")?.pattern, "pattern_solid.tga");
assert.equal(byKey.get("IBE_republic_2")?.colors.color1, "red");

const namedColors = loadCoaNamedColors("D:\\SteamLibrary\\steamapps\\common\\Victoria 3");
for (const [name, hex] of [
  ["black", "#0d0d0d"],
  ["white", "#e6e6e6"],
  ["blue", "#0f194d"],
  ["green", "#095936"],
  ["red", "#8c0907"],
  ["yellow", "#d9a925"],
  ["purple", "#630b58"],
]) {
  assert.equal(namedColors.get(name)?.hex, hex, `expected ${name} to resolve to ${hex}`);
}
assert.equal(namedColors.get("pink")?.raw, "187 83 146");
assert.ok(
  namedColors.get("pink")?.warnings.includes("hsv360 component outside expected range"),
  "expected pink to be marked as a suspicious hsv360 color",
);

const allTextures = new Set(result.variants.flatMap((variant) => variant.textures.map((texture) => texture.name)));
for (const texture of [
  "te_coa_iberia.dds",
  "te_coa_iberia_republic.dds",
  "te_crown.dds",
  "ce_hammer_sickle_spain_wreath_star.dds",
  "ce_collar_golden_fleece.dds",
]) {
  assert.ok(allTextures.has(texture), `expected texture ${texture}`);
}

const allAssetRelatives = new Set(
  result.variants.flatMap((variant) => variant.textures.map((texture) => texture.asset?.relativePath).filter(Boolean)),
);
for (const asset of [
  "textured_emblems/te_coa_iberia.png",
  "textured_emblems/te_coa_iberia_republic.png",
  "textured_emblems/te_crown.png",
  "colored_emblems/ce_hammer_sickle_spain_wreath_star.png",
  "colored_emblems/ce_collar_golden_fleece.png",
]) {
  assert.ok(allAssetRelatives.has(asset), `expected PNG asset ${asset}`);
}

assert.ok(
  result.specialTextIcons.some((asset) => asset.relativePath === "special_coa_texticons/ibe_republic_1.png"),
  "expected special text icon for IBE republic 1",
);

const tags = discoverCountryFlagTags({
  gamePath: "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
});
for (const tag of ["IBE", "NEW", "SPA"]) {
  assert.ok(tags.includes(tag), `expected discovered flag tag ${tag}`);
}
assert.ok(!tags.includes("IBE_republic_1"), "variant keys should not be returned as country tags");

const batchOutDir = fs.mkdtempSync(path.join(os.tmpdir(), "vic3-flag-batch-"));
try {
  const batch = writeCountryFlagBatch({
    tags: ["IBE", "NEW"],
    gamePath: "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
    assetRoot: path.join(root, "game", "gfx", "coat_of_arms"),
    outDir: batchOutDir,
  });
  assert.equal(batch.manifest.totalTags, 2);
  assert.ok(fs.existsSync(path.join(batchOutDir, "IBE.json")), "expected IBE batch JSON");
  assert.ok(fs.existsSync(path.join(batchOutDir, "NEW.json")), "expected NEW batch JSON");
  assert.ok(fs.existsSync(path.join(batchOutDir, "manifest.json")), "expected batch manifest");
  assert.ok(batch.manifest.tags.find((entry) => entry.tag === "IBE")?.variants >= 20, "expected IBE batch variants");
  assert.ok(batch.manifest.tags.find((entry) => entry.tag === "NEW")?.variants >= 3, "expected NEW batch variants");

  const reservedBatch = writeCountryFlagBatch({
    tags: ["CON"],
    gamePath: "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
    assetRoot: path.join(root, "game", "gfx", "coat_of_arms"),
    outDir: batchOutDir,
  });
  const conEntry = reservedBatch.manifest.tags.find((entry) => entry.tag === "CON");
  assert.equal(conEntry?.file, "_CON.json", "Windows reserved country tags should use safe JSON file names");
  assert.ok(fs.existsSync(path.join(batchOutDir, "_CON.json")), "expected CON JSON to use a safe file name");

  const conRendered = writeCountryFlagVariantPngs({
    inputJson: path.join(batchOutDir, "_CON.json"),
    gamePath: "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
    outDir: path.join(batchOutDir, "png", "_CON"),
    flagWidth: 120,
    flagHeight: 72,
  });
  assert.ok(
    conRendered.files.some((file) => file.endsWith("_CON.png")),
    "expected CON variant PNG to use a safe file name",
  );
} finally {
  fs.rmSync(batchOutDir, { recursive: true, force: true });
}

for (const tag of ["GRN", "HAM", "GBR", "BRI", "ROM", "PAR", "SCO"]) {
  const parsed = parseCountryFlagVariants({
    tag,
    gamePath: "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
    assetRoot: path.join(root, "game", "gfx", "coat_of_arms"),
  });
  assert.ok(parsed.variants.length > 0, `expected ${tag} to have flag variants`);
}

const grn = parseCountryFlagVariants({
  tag: "GRN",
  gamePath: "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
  assetRoot: path.join(root, "game", "gfx", "coat_of_arms"),
});
const grnCircle = grn.variants[0]?.layers.find((layer) => layer.texture === "ce_circle.dds");
assert.equal(grnCircle?.instances[0]?.position[0], 7 / 18, "expected GRN local expression variable to resolve");
assert.deepEqual(grn.variants[0]?.layers[1]?.mask, [2], "expected GRN lower circle mask to be parsed");

const ham = parseCountryFlagVariants({
  tag: "HAM",
  gamePath: "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
  assetRoot: path.join(root, "game", "gfx", "coat_of_arms"),
});
assert.ok(
  ham.variants.find((variant) => variant.key === "HAM")?.layers.some((layer) => layer.kind === "sub" && layer.parent === "sub_HAM"),
  "expected HAM default flag to include sub_HAM",
);

const gbr = parseCountryFlagVariants({
  tag: "GBR",
  gamePath: "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
  assetRoot: path.join(root, "game", "gfx", "coat_of_arms"),
});
const gbrKeys = gbr.variants.map((variant) => variant.key);
assert.ok(gbrKeys.includes("GBR"), "expected GBR to include the default flag");
assert.ok(gbrKeys.includes("MAC"), "expected GBR flag definitions to include the Manchester variant");
assert.ok(!gbrKeys.includes("GBR_communist_canton"), "subject canton helpers should not be exported as primary GBR flags");
assert.ok(
  gbr.variants.find((variant) => variant.key === "GBR")?.layers.some((layer) => layer.kind === "sub" && layer.parent === "sub_GBR"),
  "expected GBR default flag to include sub_GBR",
);

const bri = parseCountryFlagVariants({
  tag: "BRI",
  gamePath: "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
  assetRoot: path.join(root, "game", "gfx", "coat_of_arms"),
});
const briDefault = bri.variants.find((variant) => variant.key === "BRI");
assert.equal(briDefault?.layers[0]?.instances[0]?.scale[0], 0.25, "expected BRI @semy scale to resolve");
assert.ok(
  bri.variants.find((variant) => variant.key === "BRI_republic")?.layers.some((layer) => layer.kind === "sub" && layer.parent === "sub_BRI_canton"),
  "expected BRI republic flag to include its canton sub-block",
);

const rom = parseCountryFlagVariants({
  tag: "ROM",
  gamePath: "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
  assetRoot: path.join(root, "game", "gfx", "coat_of_arms"),
});
assert.deepEqual(
  rom.variants.map((variant) => variant.key),
  ["ROM", "ROM_fascist"],
  "expected ROM to follow flag_definitions instead of same-prefix helpers",
);

const par = parseCountryFlagVariants({
  tag: "PAR",
  gamePath: "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
  assetRoot: path.join(root, "game", "gfx", "coat_of_arms"),
});
assert.ok(par.variants.some((variant) => variant.key === "PAR_absolute_monarchy"), "expected Parma to use PAR tag");
assert.ok(
  par.variants.find((variant) => variant.key === "PAR_absolute_monarchy")?.layers.some((layer) => layer.kind === "sub" && layer.parent === "sub_PAR_coa"),
  "expected Parma monarchy flag to include sub_PAR_coa",
);
assert.ok(!par.variants.some((variant) => variant.key === "PAR_absolute_monarchy_subject"), "subject-only Parma helper should not be a primary flag");

const sco = parseCountryFlagVariants({
  tag: "SCO",
  gamePath: "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
  assetRoot: path.join(root, "game", "gfx", "coat_of_arms"),
});
assert.ok(
  sco.variants.find((variant) => variant.key === "SCO")?.layers.some((layer) => layer.kind === "sub" && layer.parent === "sub_SCO"),
  "expected SCO default flag to include sub_SCO",
);

const singleOutDir = fs.mkdtempSync(path.join(os.tmpdir(), "vic3-flag-single-"));
try {
  const sourceJson = path.join(singleOutDir, "PAR.json");
  fs.writeFileSync(sourceJson, `${JSON.stringify(par, null, 2)}\n`, "utf8");
  const rendered = writeCountryFlagVariantPngs({
    inputJson: sourceJson,
    gamePath: "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
    outDir: path.join(singleOutDir, "png"),
    flagWidth: 120,
    flagHeight: 72,
  });
  assert.ok(
    rendered.files.some((file) => file.endsWith("PAR_absolute_monarchy.png")),
    "expected one PNG per Parma flag variant",
  );
} finally {
  fs.rmSync(singleOutDir, { recursive: true, force: true });
}

console.log(`country flag variant check passed: ${result.tag}, ${result.variants.length} variants`);
