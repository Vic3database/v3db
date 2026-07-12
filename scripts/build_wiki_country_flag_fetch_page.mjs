import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const args = parseArgs(process.argv.slice(2));
const gamePath = path.resolve(args.gamePath || "D:\\SteamLibrary\\steamapps\\common\\Victoria 3");
const missingFile = path.resolve(args.missing || path.join(root, "output_next", "flags", "missing", "missing-country-flags.json"));
const localizationFile = path.resolve(args.localization || path.join(gamePath, "game", "localization", "english", "countries_l_english.yml"));
const siteDataFile = path.resolve(args.siteData || path.join(root, "site", "data.js"));
const outDir = path.resolve(args.outDir || path.join(root, "output_next", "flags", "wiki"));
const candidatesFile = path.join(outDir, "missing-country-flag-candidates.json");
const htmlFile = path.join(outDir, "missing-country-flag-fetch.html");
const onlyMissingLocal = Boolean(args.onlyMissingLocal && args.onlyMissingLocal !== "false");
const limit = Number(args.limit || 0);
const extraFileNamesByTag = {
  GNI: ["Flag GNI.png", "Flag_GNI.png", "Guarani (GNI).png", "Guarani_(GNI).png"],
};

const missing = readJson(missingFile);
const englishNames = readEnglishCountryNames(localizationFile);
const siteCountries = readSiteCountries(siteDataFile);
let tags = (missing.historicalTags || []).filter(Boolean);
if (onlyMissingLocal) {
  tags = tags.filter((tag) => !fs.existsSync(path.join(outDir, `${tag}_wiki_330.png`)));
}
if (limit > 0) tags = tags.slice(0, limit);
const entries = [];

for (const tag of tags) {
  const englishName = englishNames.get(tag) || tag;
  const siteCountry = siteCountries.get(tag) || {};
  const fileNames = unique([
    `${englishName}.png`,
    `${englishName.replace(/\s+/g, "_")}.png`,
    ...(extraFileNamesByTag[tag] || []),
    `${tag}.png`,
  ]);
  const candidates = fileNames.map((fileName) => ({
    fileName,
    url: `https://vic3.paradoxwikis.com/thumb.php?f=${encodeURIComponent(fileName)}&width=330`,
  }));
  entries.push({
    tag,
    englishName,
    colorHex: siteCountry.colorHex || "",
    tier: siteCountry.tier || "",
    capital: siteCountry.capital || "",
    candidates,
  });
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(candidatesFile, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: "vic3.paradoxwikis.com thumb.php",
  width: 330,
  tags: entries.length,
  entries,
}, null, 2)}\n`, "utf8");
fs.writeFileSync(htmlFile, buildHtml(entries), "utf8");

console.log(JSON.stringify({
  candidates: path.relative(root, candidatesFile).replaceAll("\\", "/"),
  html: path.relative(root, htmlFile).replaceAll("\\", "/"),
  tags: entries.length,
  candidateImages: entries.reduce((sum, entry) => sum + entry.candidates.length, 0),
}, null, 2));

function buildHtml(entries) {
  const imageBlocks = entries.flatMap((entry) => entry.candidates.map((candidate, index) => {
    const id = `${entry.tag}-${index}`;
    return `<figure class="flag-candidate" data-tag="${escapeHtml(entry.tag)}" data-name="${escapeHtml(entry.englishName)}" data-file="${escapeHtml(candidate.fileName)}" data-url="${escapeHtml(candidate.url)}">
      <img id="${escapeHtml(id)}" src="${escapeHtml(candidate.url)}" alt="${escapeHtml(entry.tag)} ${escapeHtml(candidate.fileName)}" loading="eager" decoding="async">
      <figcaption>${escapeHtml(entry.tag)} · ${escapeHtml(candidate.fileName)}</figcaption>
    </figure>`;
  })).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Vic3 Missing Country Flag Candidates</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #f5f5f2; color: #1f2421; }
    header { position: sticky; top: 0; z-index: 1; padding: 12px 16px; background: #ffffff; border-bottom: 1px solid #d8d8d2; }
    main { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; padding: 16px; }
    figure { margin: 0; padding: 8px; background: #ffffff; border: 1px solid #d8d8d2; border-radius: 4px; min-height: 154px; }
    img { display: block; width: 100%; aspect-ratio: 3 / 2; object-fit: contain; background: #e9e9e4; }
    figcaption { margin-top: 6px; font-size: 12px; line-height: 1.35; overflow-wrap: anywhere; }
    .loaded { border-color: #2f7d4d; }
    .failed { opacity: .45; }
  </style>
</head>
<body>
  <header>
    <strong>Vic3 missing country flag candidates</strong>
    <span id="status">Loading...</span>
  </header>
  <main>
${imageBlocks}
  </main>
  <script>
    const figures = [...document.querySelectorAll('.flag-candidate')];
    function update() {
      let loaded = 0;
      let failed = 0;
      for (const figure of figures) {
        const image = figure.querySelector('img');
        if (image.complete && image.naturalWidth > 0) {
          figure.classList.add('loaded');
          figure.dataset.width = String(image.naturalWidth);
          figure.dataset.height = String(image.naturalHeight);
          loaded += 1;
        } else if (image.complete) {
          figure.classList.add('failed');
          failed += 1;
        }
      }
      document.getElementById('status').textContent = loaded + ' loaded, ' + failed + ' failed, ' + figures.length + ' total';
    }
    for (const image of document.images) {
      image.addEventListener('load', update);
      image.addEventListener('error', update);
    }
    window.vic3FlagCandidateStatus = () => figures.map((figure) => {
      const image = figure.querySelector('img');
      return {
        tag: figure.dataset.tag,
        englishName: figure.dataset.name,
        fileName: figure.dataset.file,
        url: figure.dataset.url,
        loaded: image.complete && image.naturalWidth > 0,
        width: image.naturalWidth,
        height: image.naturalHeight,
      };
    });
    setInterval(update, 1000);
    update();
  </script>
</body>
</html>
`;
}

function readEnglishCountryNames(file) {
  const names = new Map();
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9]{3})\s*:\d*\s+"([^"]+)"/.exec(line);
    if (!match || match[1].endsWith("_ADJ")) continue;
    names.set(match[1], match[2]);
  }
  return names;
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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[char]));
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
