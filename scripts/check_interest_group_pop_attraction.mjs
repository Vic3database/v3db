import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const gamePath = "D:\\SteamLibrary\\steamapps\\common\\Victoria 3";
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vicdata-interest-group-pop-attraction-"));
const databasePath = path.join(temporaryRoot, "database");
const outputPath = path.join(temporaryRoot, "output");

try {
  const result = spawnSync(process.execPath, [
    "scripts/extract_vic3_countries.mjs",
    "--game-path", gamePath,
    "--version", "1.13.9",
    "--out", outputPath,
    "--database", databasePath,
  ], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout || "interest-group extraction failed");

  const groups = JSON.parse(fs.readFileSync(path.join(databasePath, "interest_groups.json"), "utf8").replace(/^\uFEFF/, ""));
  assert.equal(groups.length, 8, "interest-group extraction must preserve eight base groups");
  for (const group of groups) {
    assert.ok(Array.isArray(group.pop_attraction), `${group.key} needs population-attraction entries`);
    assert.ok(Array.isArray(group.potential_flavors), `${group.key} needs every conditionally available flavor`);
    assert.ok(Array.isArray(group.condition_variants), `${group.key} needs descriptive condition variants`);
    assert.equal(
      group.potential_flavors.some((flavor) => flavor.key === group.key),
      false,
      `${group.key} must not list its base name as a potential flavor`,
    );
  }

const devout = groups.find((group) => group.key === "ig_devout");
assert.deepEqual(
  (devout?.condition_variants || []).map((variant) => variant.key),
  ["jewish", "animist"],
  "devout must expose its unnamed Jewish and Animist variants by religion",
);
  assert.ok(
    devout?.potential_flavors.some((flavor) => flavor.key === "ig_shinto_monks"),
    "devout must retain the later-available Shinto priesthood flavor",
  );
  const armedForces = groups.find((group) => group.key === "ig_armed_forces");
  assert.ok(
    armedForces?.potential_flavors.some((flavor) => flavor.key === "ig_red_army"),
    "armed forces must retain the later-available Red Army flavor",
  );
  assert.deepEqual(
    (armedForces?.condition_variants || []).map((variant) => variant.key),
    ["latin_spanish", "caudillo_cultures"],
    "armed forces must retain both descriptive Latin American condition variants",
  );
  const landowners = groups.find((group) => group.key === "ig_landowners");
  assert.deepEqual(
    (landowners?.condition_variants || []).map((variant) => variant.key),
    ["latin_spanish", "boer", "polish"],
    "landowners must retain all three descriptive condition variants",
  );
  assert.deepEqual(
    (groups.find((group) => group.key === "ig_intelligentsia")?.condition_variants || []).map((variant) => variant.key),
    ["constitutionalists"],
    "intelligentsia must retain the constitutionalist condition variant",
  );
  assert.deepEqual(
    (groups.find((group) => group.key === "ig_industrialists")?.condition_variants || []).map((variant) => variant.key),
    ["colonial"],
    "industrialists must retain the colonial condition variant",
  );
  assert.deepEqual(
    (groups.find((group) => group.key === "ig_petty_bourgeoisie")?.condition_variants || []).map((variant) => variant.key),
    ["mercantile"],
    "petty bourgeoisie must retain the mercantile condition variant",
  );

  const tradeUnions = groups.find((group) => group.key === "ig_trade_unions");
  const laborerEntries = (tradeUnions?.pop_attraction || []).filter((entry) => entry.label_key === "POP_LABORERS");
  assert.equal(laborerEntries.length, 2, "trade unions must retain both laborer-attraction branches");
  assert.deepEqual(
    laborerEntries.map((entry) => entry.value_raw).sort(),
    ["100", "50"],
    "laborer branches must retain their fixed attraction values",
  );
  assert.ok(
    laborerEntries.some((entry) => entry.pop_types?.some((item) => item.key === "laborers")),
    "laborer attraction must keep its population type",
  );
  assert.ok(
    laborerEntries.some((entry) => entry.employment_building_groups?.some((item) => item.key === "bg_agriculture")),
    "laborer attraction must keep its agricultural-employment condition",
  );
  assert.equal(
    laborerEntries.find((entry) => entry.value_raw === "50")?.is_otherwise,
    true,
    "trade-union laborers outside the agricultural branch must be marked as the alternate branch",
  );

  const intelligentsia = groups.find((group) => group.key === "ig_intelligentsia");
  assert.ok(
    (intelligentsia?.pop_attraction || []).some((entry) => entry.label_key === "POP_LITERACY" && entry.value_raw === "literacy_rate" && entry.multiplier_raw === "20"),
    "intelligentsia must retain literacy-based attraction",
  );

  console.log("interest_group_pop_attraction: ok");
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
