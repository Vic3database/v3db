import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = parseArgs(process.argv.slice(2));
const bundleManifestFile = path.resolve(args.bundleManifest || args.bundle || "");
const candidatesFile = path.resolve(args.candidates || path.join(root, "output_next", "flags", "wiki", "missing-country-flag-candidates.json"));
const outDir = path.resolve(args.outDir || path.join(root, "output_next", "flags", "wiki"));
const outManifestFile = path.join(outDir, "wiki-country-flag-manifest.json");
const missingFile = path.resolve(args.missing || path.join(root, "output_next", "flags", "missing", "missing-country-flags.json"));

if (!bundleManifestFile) throw new Error("import_wiki_country_flag_bundle requires --bundle-manifest");
if (!fs.existsSync(bundleManifestFile)) throw new Error(`Missing bundle manifest: ${bundleManifestFile}`);

const bundle = readJson(bundleManifestFile);
const candidates = readJson(candidatesFile);
const candidateByUrl = new Map();
for (const entry of candidates.entries || []) {
  for (const candidate of entry.candidates || []) {
    candidateByUrl.set(normalizeUrl(candidate.url), {
      tag: entry.tag,
      englishName: entry.englishName,
      fileName: candidate.fileName,
      url: candidate.url,
    });
  }
}

const selected = new Map();
const ignored = [];
for (const asset of bundle.assets || []) {
  const match = candidateByUrl.get(normalizeUrl(asset.url));
  if (!match) {
    ignored.push(asset.url);
    continue;
  }
  if (selected.has(match.tag)) continue;
  if (asset.contentType && !String(asset.contentType).toLowerCase().includes("image/png")) {
    ignored.push(asset.url);
    continue;
  }
  selected.set(match.tag, { ...match, bundlePath: asset.path, contentType: asset.contentType || "" });
}

const previousByTag = new Map();
if (fs.existsSync(outManifestFile)) {
  for (const entry of readJson(outManifestFile).entries || []) {
    if (entry.tag) previousByTag.set(entry.tag, entry);
  }
}

const scopeTags = fs.existsSync(missingFile) ? (readJson(missingFile).historicalTags || []) : (candidates.entries || []).map((entry) => entry.tag);
const candidateByTag = new Map((candidates.entries || []).map((entry) => [entry.tag, entry]));
const entries = [];
for (const tag of scopeTags) {
  const entry = candidateByTag.get(tag) || previousByTag.get(tag) || { tag, englishName: tag, candidates: [] };
  const hit = selected.get(tag);
  if (!hit) {
    const previous = previousByTag.get(tag);
    const existingImage = path.join(outDir, `${tag}_wiki_330.png`);
    if (previous?.status === "wiki-matched" || fs.existsSync(existingImage)) {
      entries.push({
        tag,
        englishName: previous?.englishName || entry.englishName || tag,
        status: "wiki-matched",
        fileName: previous?.fileName || "",
        url: previous?.url || "",
        contentType: previous?.contentType || "image/png",
        image: path.relative(root, existingImage).replaceAll("\\", "/"),
      });
    } else {
      entries.push({
        tag,
        englishName: entry.englishName || tag,
        status: "missing",
        candidates: entry.candidates || [],
      });
    }
    continue;
  }

  const outFile = path.join(outDir, `${tag}_wiki_330.png`);
  fs.copyFileSync(hit.bundlePath, outFile);
  entries.push({
    tag,
    englishName: entry.englishName || hit.englishName || tag,
    status: "wiki-matched",
    fileName: hit.fileName,
    url: hit.url,
    contentType: hit.contentType,
    image: path.relative(root, outFile).replaceAll("\\", "/"),
  });
}

fs.writeFileSync(outManifestFile, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: "vic3.paradoxwikis.com thumb.php",
  bundleManifest: path.relative(root, bundleManifestFile).replaceAll("\\", "/"),
  matched: entries.filter((entry) => entry.status === "wiki-matched").length,
  missing: entries.filter((entry) => entry.status === "missing").length,
  entries,
  ignoredAssetUrls: ignored,
}, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  manifest: path.relative(root, outManifestFile).replaceAll("\\", "/"),
  matched: entries.filter((entry) => entry.status === "wiki-matched").length,
  missing: entries.filter((entry) => entry.status === "missing").length,
  ignored: ignored.length,
}, null, 2));

function normalizeUrl(value) {
  const url = new URL(value);
  return `${url.origin}${url.pathname}?${[...url.searchParams.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${key}=${item}`)
    .join("&")}`;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : "true";
    result[key] = value;
  }
  return result;
}
