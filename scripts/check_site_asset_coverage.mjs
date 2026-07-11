import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const siteRoot = path.join(root, "site");
const gameRoot = path.join(root, "game");
const appSource = fs.readFileSync(path.join(siteRoot, "app.js"), "utf8");
const dataSource = fs.readFileSync(path.join(siteRoot, "data.js"), "utf8");

const sandbox = { window: {} };
vm.runInNewContext(dataSource, sandbox);
const siteData = sandbox.window.VIC3_DATA || {};

const buildingIconFileByKey = readAppObject("buildingIconFileByKey");
const companyDlcOptions = readAppArray("companyDlcOptions");

const sourceRoots = {
  companies: [
    "game/gfx/interface/icons/company_icons",
    "game/gfx/interface/icons/company_icons/historical_company_icons",
    "game/dlc/dlc008_rp1/gfx/interface/icons/company_icons",
    "game/dlc/dlc008_rp1/gfx/interface/icons/company_icons/historical_company_icons",
    "game/dlc/dlc013_mp1/gfx/interface/icons/company_icons",
    "game/dlc/dlc013_mp1/gfx/interface/icons/company_icons/historical_company_icons",
    "game/dlc/dlc014_ip3/gfx/interface/icons/company_icons",
    "game/dlc/dlc014_ip3/gfx/interface/icons/company_icons/historical_company_icons",
    "game/dlc/dlc016_ip4/gfx/interface/icons/company_icons",
    "game/dlc/dlc016_ip4/gfx/interface/icons/company_icons/historical_company_icons",
    "game/dlc/dlc018_ep2/gfx/interface/icons/company_icons",
    "game/dlc/dlc018_ep2/gfx/interface/icons/company_icons/historical_company_icons",
  ],
  "prestige-goods": [
    "game/gfx/interface/icons/goods_icons/prestige_goods",
  ],
  buildings: [
    "game/gfx/interface/icons/building_icons",
  ],
  ideologies: [
    "game/gfx/interface/icons/ideology_icons",
    "game/gfx/interface/icons/ideology_icons/ideology_leader",
    "game/gfx/interface/icons/ideology_icons/unused",
  ],
  "interest-groups": [
    "game/gfx/interface/icons/ig_icons",
  ],
  dlc: [
    "game/gfx/interface/icons/dlc_icons",
  ],
};

const prestigeGoodIconOverrides = new Map([
  ["prestige_good_brunn_type_engines", "brunn_type_engine_prestige.png"],
  ["prestige_good_havana_sugar", "generic_sugar_prestige.png"],
  ["prestige_good_kikkoman_soy_sauce", "kikkoman_soy_sauce.png"],
]);

const references = [
  ...companyIconReferences(),
  ...prestigeGoodReferences(),
  ...buildingReferences(),
  ...ideologyReferences(),
  ...interestGroupReferences(),
  ...dlcReferences(),
];

const failures = [];
const checked = [];
for (const reference of references) {
  const sitePath = path.join(siteRoot, reference.siteRelative);
  const sourcePath = findSource(reference.category, reference.fileName);
  if (!fs.existsSync(sitePath)) {
    failures.push(`${reference.label}: missing site asset ${toDisplay(sitePath)}`);
    continue;
  }
  if (!sourcePath) {
    failures.push(`${reference.label}: missing game source for ${reference.fileName}`);
    continue;
  }
  if (sha256(sitePath) !== sha256(sourcePath)) {
    failures.push(`${reference.label}: site asset differs from ${toDisplay(sourcePath)}`);
    continue;
  }
  checked.push({
    category: reference.category,
    fileName: reference.fileName,
  });
}

if (failures.length) {
  for (const failure of failures.slice(0, 80)) console.error(`- ${failure}`);
  if (failures.length > 80) console.error(`- ... ${failures.length - 80} more asset mismatches`);
  process.exit(1);
}

const counts = checked.reduce((memo, item) => {
  memo[item.category] = (memo[item.category] || 0) + 1;
  return memo;
}, {});

console.log(JSON.stringify({
  checked: checked.length,
  categories: counts,
  site_asset_coverage: "ok",
}, null, 2));

function companyIconReferences() {
  return uniqueReferences((siteData.companies || []).map((company) => {
    const fileName = iconFileName(company.icon);
    if (!fileName) return null;
    return ref("companies", `companies/${fileName}`, fileName, company.key);
  }));
}

function prestigeGoodReferences() {
  const keys = new Set();
  for (const company of siteData.companies || []) {
    for (const goods of company.possible_prestige_goods || []) {
      if (goods?.key) keys.add(goods.key);
    }
  }
  return [...keys].sort().map((key) => {
    const base = String(key).replace(/^prestige_good_/, "");
    const fileName = prestigeGoodIconOverrides.get(key) || `${base}_prestige.png`;
    return ref("prestige-goods", `prestige-goods/${fileName}`, fileName, key);
  });
}

function buildingReferences() {
  return Object.entries(buildingIconFileByKey).map(([key, fileName]) => (
    ref("buildings", `buildings/${fileName}`, fileName, key)
  ));
}

function ideologyReferences() {
  const ideologies = new Map();
  collectByIcon({ ideologies: siteData.ideologies, countries: siteData.countries, interestGroups: siteData.interestGroups }, ideologies, "icon", (value) => (
    value?.key && String(value.key).startsWith("ideology_")
  ));
  return uniqueReferences([...ideologies.values()].map((ideology) => {
    const fileName = iconFileName(ideology.icon);
    if (!fileName) return null;
    return ref("ideologies", `ideologies/${fileName}`, fileName, ideology.key);
  }));
}

function interestGroupReferences() {
  const groups = new Map();
  collectByIcon({ interestGroups: siteData.interestGroups, countries: siteData.countries }, groups, "texture", (value) => (
    value?.key && String(value.key).startsWith("ig_")
  ));
  return uniqueReferences([...groups.values()].map((group) => {
    const fileName = iconFileName(group.texture);
    if (!fileName) return null;
    return ref("interest-groups", `interest-groups/${fileName}`, fileName, group.key);
  }));
}

function dlcReferences() {
  return companyDlcOptions
    .filter((option) => option?.icon && option.key !== "base")
    .map((option) => ref("dlc", `dlc/${option.icon}`, option.icon, option.key));
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

function ref(category, siteRelative, fileName, label) {
  return { category, siteRelative: path.join("assets", siteRelative), fileName, label };
}

function uniqueReferences(items) {
  const out = new Map();
  for (const item of items.filter(Boolean)) out.set(`${item.category}:${item.fileName}`, item);
  return [...out.values()].sort((a, b) => `${a.category}:${a.fileName}`.localeCompare(`${b.category}:${b.fileName}`));
}

function iconFileName(icon) {
  const baseName = path.basename(String(icon || "")).replace(/\.dds$/i, ".png");
  if (!baseName || baseName === path.basename(String(icon || ""))) return "";
  return baseName;
}

function findSource(category, fileName) {
  for (const sourceRoot of sourceRoots[category] || []) {
    const candidate = path.join(root, sourceRoot, fileName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return "";
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
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

function toDisplay(file) {
  return path.relative(root, file);
}
