import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const siteRoot = path.join(root, "site");
const versionsFile = path.join(siteRoot, "versions.js");
const indexFile = path.join(siteRoot, "index.html");
const appFile = path.join(siteRoot, "app.js");
const manifestFile = path.join(siteRoot, "site.webmanifest");

const versionsSource = fs.readFileSync(versionsFile, "utf8");
const appSource = fs.readFileSync(appFile, "utf8");
const sandbox = { window: {} };
vm.runInNewContext(versionsSource, sandbox, { filename: versionsFile });
const config = sandbox.window.VIC3_VERSION_CONFIG;

const failures = [];
const requiredFiles = new Set([
  "index.html",
  "styles.css",
  "app.js",
  "versions.js",
  "site.webmanifest",
]);

if (!config) {
  failures.push("site/versions.js does not define window.VIC3_VERSION_CONFIG");
} else {
  if (config.default_version !== "1.13.9") {
    failures.push(`default_version should be 1.13.9, got ${config.default_version || ""}`);
  }

  const versions = config.versions || [];
  if (versions.length !== 1 || versions[0]?.version !== "1.13.9") {
    failures.push(`versions should contain only 1.13.9, got ${versions.map((item) => item.version).join(", ")}`);
  }

  for (const entry of versions) {
    addRequired(entry.data_index);
    addRequired(entry.map_data);
  }

  if ((config.changelogs || []).length) {
    failures.push("changelogs should be empty for the single-version public bundle");
  }
}

const data = readChunkedData(path.join(siteRoot, "versions", "1.13.9"));
const buildingIconFileByKey = readAppObject("buildingIconFileByKey");
const companyDlcOptions = readAppArray("companyDlcOptions");
const prestigeGoodIconOverrides = readAppMap("prestigeGoodIconOverrides");

for (const relative of [
  ...assetReferencesFromHtml(fs.readFileSync(indexFile, "utf8")),
  ...assetReferencesFromManifest(JSON.parse(fs.readFileSync(manifestFile, "utf8"))),
  ...staticAssetReferencesFromJs(appSource),
  ...dataAssetReferences(data, {
    buildingIconFileByKey,
    companyDlcOptions,
    prestigeGoodIconOverrides,
  }),
]) {
  addRequired(relative);
  addRequired(webpSibling(relative));
}

for (const relative of [...requiredFiles].sort()) {
  const file = path.join(siteRoot, relative);
  if (!isInside(siteRoot, file)) {
    failures.push(`invalid site path outside site/: ${relative}`);
  } else if (!fs.existsSync(file)) {
    failures.push(`missing published file: site/${relative}`);
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  publish_bundle: "ok",
  files_checked: requiredFiles.size,
  versions: (config?.versions || []).map((entry) => entry.version),
}, null, 2));

function readChunkedData(versionDir) {
  const indexFile = path.join(versionDir, "data-index.js");
  if (!fs.existsSync(indexFile)) return {};
  const dataSandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(indexFile, "utf8"), dataSandbox, { filename: indexFile });
  const index = dataSandbox.window.VIC3_DATA_INDEX || {};
  const data = { meta: index.meta || {} };
  for (const chunk of Object.values(index.chunks || {})) {
    for (const file of chunk.files || []) {
      addRequired(`versions/1.13.9/${file}`);
      const chunkFile = path.join(versionDir, file);
      const chunkSandbox = { window: {} };
      vm.runInNewContext(fs.readFileSync(chunkFile, "utf8"), chunkSandbox, { filename: chunkFile });
      const value = chunkSandbox.window.VIC3_DATA_CHUNK || {};
      for (const [field, rows] of Object.entries(value)) {
        data[field] = field === "countries" ? [...(data[field] || []), ...(rows || [])] : rows;
      }
    }
  }
  return data;
}

function addRequired(relative) {
  if (!relative || typeof relative !== "string") return;
  const clean = relative.split(/[?#]/, 1)[0].replaceAll("\\", "/");
  if (!clean || /^[a-z]+:/i.test(clean) || clean.startsWith("/")) return;
  requiredFiles.add(clean);
}

function webpSibling(relative) {
  const clean = String(relative || "").replaceAll("\\", "/");
  if (clean === "assets/map/flatmap_votp.png") return clean.replace(/\.png$/i, ".webp");
  if (/^assets\/(?:buildings|companies|laws|ideologies)\/.*\.png$/i.test(clean)) {
    return clean.replace(/\.png$/i, ".webp");
  }
  return "";
}

function assetReferencesFromHtml(source) {
  const out = [];
  const attrPattern = /\b(?:src|href)="([^"]+)"/g;
  for (const match of source.matchAll(attrPattern)) {
    const value = match[1];
    if (value.startsWith("assets/")) out.push(value);
  }
  return out;
}

function assetReferencesFromManifest(manifest) {
  return (manifest.icons || []).map((icon) => icon.src).filter(Boolean);
}

function staticAssetReferencesFromJs(source) {
  return [
    ...literalMatches(source, /"((?:assets|versions)\/[^"$`]+)"/g),
    ...literalMatches(source, /'((?:assets|versions)\/[^'$`]+)'/g),
  ].filter((value) => !value.includes("${") && !value.endsWith("/"));
}

function dataAssetReferences(data, helpers) {
  const out = [
    "assets/map/provinces.png",
    "assets/map/flatmap_votp.png",
    ...Object.values(helpers.buildingIconFileByKey).map((fileName) => `assets/buildings/${fileName}`),
    ...helpers.companyDlcOptions.filter((option) => option?.icon && option.key !== "base").map((option) => `assets/dlc/${option.icon}`),
  ];

  for (const company of data.companies || []) {
    const companyIcon = iconFileName(company.icon);
    if (companyIcon) out.push(`assets/companies/${companyIcon}`);
    for (const goods of company.possible_prestige_goods || []) {
      const key = goods?.key || "";
      if (!key) continue;
      const base = key.replace(/^prestige_good_/, "");
      out.push(`assets/prestige-goods/${helpers.prestigeGoodIconOverrides.get(key) || `${base}_prestige.png`}`);
    }
  }

  const ideologies = new Map();
  collectByIcon({ ideologies: data.ideologies, countries: data.countries, interestGroups: data.interestGroups }, ideologies, "icon", (value) => (
    value?.key && String(value.key).startsWith("ideology_")
  ));
  for (const ideology of ideologies.values()) {
    const fileName = iconFileName(ideology.icon);
    if (fileName) out.push(`assets/ideologies/${fileName}`);
  }
  out.push("assets/ideologies/no_ideology.png");

  const groups = new Map();
  collectByIcon({ interestGroups: data.interestGroups, countries: data.countries }, groups, "texture", (value) => (
    value?.key && String(value.key).startsWith("ig_")
  ));
  for (const group of groups.values()) {
    const fileName = iconFileName(group.texture);
    if (fileName) out.push(`assets/interest-groups/${fileName}`);
  }

  return [...new Set(out)];
}

function collectByIcon(value, out, iconField, predicate) {
  if (!value || typeof value !== "object") return;
  if (predicate(value) && value[iconField]) out.set(`${value.key}:${value[iconField]}`, value);
  if (Array.isArray(value)) {
    for (const item of value) collectByIcon(item, out, iconField, predicate);
  } else {
    for (const item of Object.values(value)) collectByIcon(item, out, iconField, predicate);
  }
}

function iconFileName(icon) {
  const baseName = path.basename(String(icon || "")).replace(/\.dds$/i, ".png");
  if (!baseName || baseName === path.basename(String(icon || ""))) return "";
  return baseName;
}

function readAppObject(name) {
  const match = appSource.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\{[\\s\\S]*?\\n\\});`));
  if (!match) throw new Error(`Cannot find ${name} object in site/app.js`);
  return vm.runInNewContext(`(${match[1]})`, {});
}

function readAppArray(name) {
  const match = appSource.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\[[\\s\\S]*?\\n\\]);`));
  if (!match) throw new Error(`Cannot find ${name} array in site/app.js`);
  return vm.runInNewContext(`(${match[1]})`, {});
}

function readAppMap(name) {
  const match = appSource.match(new RegExp(`const\\s+${name}\\s*=\\s*new\\s+Map\\((\\[[\\s\\S]*?\\])\\);`));
  if (!match) throw new Error(`Cannot find ${name} map in site/app.js`);
  return new Map(vm.runInNewContext(`(${match[1]})`, {}));
}

function literalMatches(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
