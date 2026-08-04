import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const args = parseArgs(process.argv.slice(2));
const sourceSite = path.resolve(args.source || path.join(root, "site"));
const targetSite = path.resolve(args.target || path.join(root, "Victorian Century Database"));
const publishTarget = args.publishTarget ? path.resolve(args.publishTarget) : "";

assertDirectory(sourceSite, "main site directory");
assertDirectory(targetSite, "Victorian Century standalone directory");
assertFile(path.join(targetSite, "data-index.js"), "VC data index");
assertFile(path.join(targetSite, "map-data.js"), "VC map index");
assertFile(path.join(targetSite, "assets", "map", "provinces.png"), "VC province map");

const copied = [];
copyDirectory(path.join(sourceSite, "app"), path.join(targetSite, "app"), copied);
copyDirectory(path.join(sourceSite, "styles"), path.join(targetSite, "styles"), copied);
copyDirectory(path.join(sourceSite, "locales"), path.join(targetSite, "locales"), copied);
copyFile(path.join(sourceSite, "styles.css"), path.join(targetSite, "styles.css"), copied);
copyAssets(path.join(sourceSite, "assets"), path.join(targetSite, "assets"), copied);
runEconomyAssetBuild(args.python, args.vcDatabase);
if (!args.skipVcAssets) runVcAssetSync(args.python, args.vcDatabase);
writeStandaloneFiles(copied);
publishStandaloneSite(copied);

console.log(JSON.stringify({
  victorian_century_site_build: "ok",
  copied_files: copied.length,
  source: toProjectPath(sourceSite),
  target: toProjectPath(targetSite),
  publish_target: publishTarget ? toProjectPath(publishTarget) : "",
  vc_asset_sync: args.skipVcAssets ? "skipped" : "ok",
  economy_asset_build: "ok",
}, null, 2));

function parseArgs(values) {
  const parsed = { python: "", skipVcAssets: false, source: "", target: "", publishTarget: "", vcDatabase: "" };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--python") {
      parsed.python = values[index + 1] || "";
      index += 1;
    } else if (value === "--skip-vc-assets") {
      parsed.skipVcAssets = true;
    } else if (value === "--source" || value === "--target" || value === "--publish-target" || value === "--vc-database") {
      const key = value === "--publish-target" ? "publishTarget" : value === "--vc-database" ? "vcDatabase" : value.slice(2);
      parsed[key] = values[index + 1] || "";
      if (!parsed[key]) throw new Error(`Missing value for ${value}`);
      index += 1;
    } else if (value === "--help" || value === "-h") {
      console.log("Usage: node scripts/build_victorian_century_site.mjs [--source <dir>] [--target <dir>] [--publish-target <dir>] [--vc-database <dir>] [--python <path>] [--skip-vc-assets]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return parsed;
}

function copyAssets(source, target, copied) {
  copyDirectory(source, target, copied, (relative) => relative === path.join("map", "provinces.png"));
}

function copyDirectory(source, target, copied, shouldSkip = () => false, relative = "") {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const entryRelative = relative ? path.join(relative, entry.name) : entry.name;
    if (shouldSkip(entryRelative)) continue;
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath, copied, shouldSkip, entryRelative);
    } else if (entry.isFile()) {
      copyFile(sourcePath, targetPath, copied);
    }
  }
}

function copyFile(source, target, copied) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  copied.push(toProjectPath(target));
}

function writeStandaloneFiles(copied) {
  const sourceHtml = fs.readFileSync(path.join(sourceSite, "index.html"), "utf8");
  const standaloneHtml = buildStandaloneHtml(sourceHtml);
  writeText(path.join(targetSite, "index.html"), standaloneHtml, copied);
  writeText(path.join(targetSite, "victorian-century-config.js"), standaloneConfigSource(), copied);

  const sourceManifest = JSON.parse(fs.readFileSync(path.join(sourceSite, "site.webmanifest"), "utf8"));
  sourceManifest.name = "Victorian Century Database";
  sourceManifest.short_name = "Victorian Century";
  writeText(path.join(targetSite, "site.webmanifest"), `${JSON.stringify(sourceManifest, null, 2)}\n`, copied);
}

function publishStandaloneSite(copied) {
  if (!publishTarget) return;
  const relative = path.relative(root, publishTarget);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Publish target must stay inside the project: ${publishTarget}`);
  }
  if (publishTarget === targetSite) {
    throw new Error("Publish target must differ from the Victorian Century standalone directory.");
  }
  fs.rmSync(publishTarget, { recursive: true, force: true });
  copyDirectory(targetSite, publishTarget, copied);
}

function buildStandaloneHtml(sourceHtml) {
  let html = sourceHtml
    .replace("<title>Vicdata</title>", "<title>Victorian Century Database</title>")
    .replaceAll("Vicdata", "Victorian Century")
    .replace(/\s*<label class="version-menu topbar-icon-select">[\s\S]*?<\/label>/, `
        <label class="version-menu topbar-icon-select">
          <img class="lucide-icon" src="assets/lucide/icons/milestone.svg" alt="" aria-hidden="true">
          <select id="standaloneLibrarySelect" aria-label="资料库切换" data-i18n-aria-label="ui.librarySwitch">
            <option value="victorian-century" data-i18n="library.victorianCentury" selected>Victorian Century</option>
            <option value="vic3" data-i18n="library.vic3">Victoria 3 原版 1.13.9</option>
          </select>
        </label>`)
    .replace(/\s*<label class="global-search-legacy-toggle">[\s\S]*?<\/label>/, "")
    .replace(/\s*<script src="announcement-data\.js[^\"]*"><\/script>/, "")
    .replace(/\s*<script src="versions\.js[^\"]*"><\/script>/, "")
    .replace(/\s*<script src="news-data\.js[^\"]*"><\/script>/, "")
    .replace(/\s*<!-- MAIN_SITE_VC_ENTRY_START -->[\s\S]*?<!-- MAIN_SITE_VC_ENTRY_END -->/, "");

  html = html.replace(
    /\s*<script src="assets\/flags\/country-flags\.js[^\"]*"><\/script>/,
    "\n    <script src=\"victorian-century-config.js?v=20260728-vc-standalone\"></script>\n    <script src=\"assets/flags/country-flags.js?v=20260712-all-flags2\"></script>",
  );
  return html;
}

function standaloneConfigSource() {
  const manifestFile = path.join(targetSite, "assets", "victorian-century-assets.json");
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const webpAssetPaths = (manifest.assets || [])
    .filter((asset) => asset.webp)
    .map((asset) => `assets/${asset.path}`)
    .sort();
  return `window.VICTORIAN_CENTURY_SITE_CONFIG = Object.freeze({\n  siteTitle: "Victorian Century Database",\n  dataIndex: "data-index.js",\n  mapData: "map-data.js?v=20260803-multilingual-map1",\n  dataRoot: ".",\n  localeRoot: "locales",\n  webpAssetPaths: ${JSON.stringify(webpAssetPaths)},\n});\n`;
}

function runVcAssetSync(explicitPython, explicitDatabase) {
  const python = explicitPython || process.env.VICTORIAN_CENTURY_PYTHON || process.env.PYTHON || "python";
  const syncArgs = [path.join(root, "scripts", "sync_victorian_century_assets.py"), "--json", "--target-assets", path.join(targetSite, "assets")];
  if (explicitDatabase) syncArgs.push("--database", path.resolve(explicitDatabase));
  const result = spawnSync(python, syncArgs, {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
  if (result.error) {
    throw new Error(`Unable to start Python asset sync using ${python}: ${result.error.message}. Set VICTORIAN_CENTURY_PYTHON or pass --python.`);
  }
  if (result.status !== 0) {
    throw new Error(`VC asset sync failed using ${python}:\n${result.stdout}\n${result.stderr}`.trim());
  }
}

function runEconomyAssetBuild(explicitPython, explicitDatabase) {
  const database = path.resolve(explicitDatabase || path.join(root, "database", "victorian_century"));
  const buildArgs = [path.join(root, "scripts", "build_economy_assets.mjs"), "--database", database, "--site", targetSite];
  if (explicitPython) buildArgs.push("--python", explicitPython);
  const result = spawnSync(process.execPath, buildArgs, { cwd: root, encoding: "utf8", shell: false });
  if (result.error || result.status !== 0) {
    throw new Error(`VC economy asset build failed:\n${result.error?.message || ""}\n${result.stdout}\n${result.stderr}`.trim());
  }
}

function assertDirectory(candidate, label) {
  if (!fs.statSync(candidate, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Missing ${label}: ${candidate}`);
  }
}

function assertFile(candidate, label) {
  if (!fs.statSync(candidate, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Missing ${label}: ${candidate}`);
  }
}

function writeText(file, content, copied) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
  copied.push(toProjectPath(file));
}

function toProjectPath(file) {
  return path.relative(root, file).split(path.sep).join("/");
}
