import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const databaseDir = path.join(root, "database", "vic3_1.13.9");
const siteRoot = path.join(root, "site");
const index = readJson(path.join(databaseDir, "index.json"));
const gameData = index.source_paths?.game_data;
if (!gameData || !fs.statSync(gameData, { throwIfNoEntry: false })?.isDirectory()) throw new Error("Victoria 3 game data is unavailable");

const collections = [
  ["events", "events.json"],
  ["journals", "journal_entries.json"],
];
const entries = new Map();
for (const [kind, file] of collections) {
  for (const row of readJson(path.join(databaseDir, file)).filter((item) => item.content_class === "game")) {
    const source = normalize(row.icon);
    if (!source) continue;
    const sourceFile = path.join(gameData, ...source.split("/"));
    if (!fs.statSync(sourceFile, { throwIfNoEntry: false })?.isFile()) throw new Error(`Missing ${kind} icon: ${source}`);
    entries.set(source, { source: sourceFile, target: path.join(siteRoot, "assets", "event-icons", ...source.replace(/^gfx\/interface\/icons\//, "").replace(/\.dds$/i, ".webp").split("/")) });
  }
}

const rows = [...entries.values()].sort((left, right) => left.target.localeCompare(right.target));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "vic3-event-icons-"));
const manifest = path.join(temporaryDirectory, "manifest.json");
try {
  fs.writeFileSync(manifest, JSON.stringify(rows), "utf8");
  convert(manifest);
  for (const row of rows) if (!fs.statSync(row.target, { throwIfNoEntry: false })?.isFile()) throw new Error(`Missing converted icon: ${row.target}`);
  console.log(JSON.stringify({ event_icon_assets: "ok", icons: rows.length, bytes: rows.reduce((total, row) => total + fs.statSync(row.target).size, 0) }, null, 2));
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

function convert(manifestFile) {
  const program = [
    "import json, sys",
    "from pathlib import Path",
    "from PIL import Image",
    "for row in json.loads(Path(sys.argv[1]).read_text(encoding='utf-8')):",
    "    target = Path(row['target'])",
    "    target.parent.mkdir(parents=True, exist_ok=True)",
    "    with Image.open(row['source']) as image:",
    "        image.convert('RGBA').save(target, 'WEBP', quality=85, method=2)",
  ].join("\n");
  const result = spawnSync(process.env.PYTHON || "python", ["-c", program, manifestFile], { encoding: "utf8", shell: false });
  if (result.error || result.status !== 0) throw new Error(`WebP conversion failed: ${result.error?.message || result.stderr || result.stdout}`.trim());
}

function normalize(value) { return String(value || "").replaceAll("\\", "/").replace(/^\/+/, ""); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")); }
