import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const args = parseArgs(process.argv.slice(2));
const databaseDir = path.resolve(args.database || path.join(root, "database", "vic3_1.13.9"));
const assetRoot = path.resolve(args.assetRoot || path.join(root, "site", "assets", "achievements"));
const python = args.python || process.env.PYTHON || "python";

const index = readJson(path.join(databaseDir, "index.json"));
const achievements = readJson(path.join(databaseDir, index.files?.achievements || ""));
const gameData = path.resolve(index.source_paths?.game_data || "");
assertDirectory(gameData, "Victoria 3 game data");
assertAchievements(achievements, gameData);
fs.mkdirSync(assetRoot, { recursive: true });

const manifestFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "vic3-achievement-assets-")), "manifest.json");
try {
  const entries = achievements.map((achievement) => ({
    key: achievement.key,
    source: path.join(gameData, ...achievement.icon.achieved.split("/")),
    destination: path.join(assetRoot, `${achievement.key}.webp`),
  }));
  fs.writeFileSync(manifestFile, JSON.stringify(entries), "utf8");
  convertIcons(manifestFile, python);
  assertOutputs(entries);
  const bytes = entries.reduce((total, entry) => total + fs.statSync(entry.destination).size, 0);
  console.log(JSON.stringify({
    achievement_assets: "ok",
    achievements: entries.length,
    asset_root: projectPath(assetRoot),
    bytes,
  }, null, 2));
} finally {
  fs.rmSync(path.dirname(manifestFile), { recursive: true, force: true });
}

function parseArgs(values) {
  const parsed = { database: "", assetRoot: "", python: "" };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--database" || value === "--asset-root" || value === "--python") {
      const key = value.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      parsed[key] = values[index + 1] || "";
      if (!parsed[key]) throw new Error(`Missing value for ${value}`);
      index += 1;
    } else if (value === "--help" || value === "-h") {
      console.log("Usage: node scripts/build_achievement_assets.mjs [--database <dir>] [--asset-root <dir>] [--python <command>]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return parsed;
}

function assertAchievements(achievements, gameData) {
  if (!Array.isArray(achievements) || achievements.length !== 141) {
    throw new Error(`Expected 141 achievements, got ${Array.isArray(achievements) ? achievements.length : "invalid data"}`);
  }
  const keys = new Set();
  for (const achievement of achievements) {
    const key = achievement?.key || "";
    const icon = achievement?.icon?.achieved || "";
    if (!/^[a-z0-9_]+$/i.test(key) || keys.has(key)) throw new Error(`Invalid or duplicate achievement key: ${key}`);
    if (icon !== `gfx/interface/icons/achievements/${key}.jpg`) throw new Error(`Unexpected achievement icon path for ${key}: ${icon}`);
    if (!fs.statSync(path.join(gameData, ...icon.split("/")), { throwIfNoEntry: false })?.isFile()) {
      throw new Error(`Missing achievement source icon: ${icon}`);
    }
    keys.add(key);
  }
}

function convertIcons(manifestFile, python) {
  const script = [
    "import json, sys",
    "from pathlib import Path",
    "from PIL import Image",
    "entries = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))",
    "for entry in entries:",
    "    source = Path(entry['source'])",
    "    destination = Path(entry['destination'])",
    "    destination.parent.mkdir(parents=True, exist_ok=True)",
    "    with Image.open(source) as image:",
    "        image.convert('RGB').save(destination, 'WEBP', quality=88, method=6)",
  ].join("\n");
  const result = spawnSync(python, ["-c", script, manifestFile], { encoding: "utf8", shell: false });
  if (result.error || result.status !== 0) {
    throw new Error(`Unable to convert achievement icons using ${python}: ${result.error?.message || result.stderr || result.stdout}`.trim());
  }
}

function assertOutputs(entries) {
  const expected = new Set(entries.map((entry) => path.basename(entry.destination)));
  const actual = new Set(fs.readdirSync(assetRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".webp"))
    .map((entry) => entry.name));
  if (actual.size !== expected.size || [...expected].some((file) => !actual.has(file))) {
    throw new Error("Achievement WebP output does not match the database record set");
  }
}

function assertDirectory(candidate, label) {
  if (!fs.statSync(candidate, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`Missing ${label}: ${candidate}`);
}

function readJson(file) {
  if (!file) throw new Error("Missing achievement database file path");
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function projectPath(file) {
  return path.relative(root, file).split(path.sep).join("/");
}
