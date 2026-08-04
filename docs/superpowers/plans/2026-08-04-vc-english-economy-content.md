# VC 与英文建筑商品内容补全实施计划

> **执行要求：** 实施时必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，并逐项更新复选框状态。

**目标：** 补全主站英文建筑商品内容，并让 Victorian Century 独立站按模组补丁语义生成中英文建筑、生产方式、商品和名贵商品内容。

**架构：** 新增一个只负责 Clausewitz 定义补丁合并的模块，现有抽取器继续负责文件解析、经济关系计算和多语言投影。原版与 VC 使用同一数据库结构和前端；VC 构建以原版 1.13.9 为基线增加变化标记，并从原版与模组来源重新生成经济素材。

**技术：** Node.js、浏览器原生 JavaScript、Python Pillow、PowerShell、Playwright/Chrome DevTools Protocol、Victoria 3 Clausewitz 文本。

---

## 文件边界

| 文件 | 职责 |
| --- | --- |
| `scripts/lib/clausewitz-definition-patches.mjs` | 解析补丁前缀，合并 Clausewitz 节点，记录来源。 |
| `scripts/check_clausewitz_definition_patches.mjs` | 用小型节点样本固定替换、创建、注入、负数修正和列表追加语义。 |
| `scripts/extract_vic3_countries.mjs` | 调用补丁模块，生成合并后的经济对象、关系和双语投影。 |
| `scripts/locales/victorian-century-aliases.mjs` | 保存已核对的 VC 中英文本地化键别名。 |
| `scripts/check_victorian_century_economy_database.mjs` | 检查 VC 经济数量、修正值、引用、唯一键和本地化名称。 |
| `scripts/check_economy_localization.mjs` | 只扫描建筑与商品板块实际引用的语言包消息。 |
| `scripts/build_wiki.mjs` | 为六类经济集合计算 `vc_change_kind`。 |
| `site/app/economy.js` | 渲染 VC 标记、经济板块变化筛选及双语内容。 |
| `site/styles/economy.css` | 布置卡片、详情和经济板块变化筛选。 |
| `scripts/build_economy_assets.mjs` | 按数据库声明从模组或原版读取图片并输出键名 WebP。 |
| `scripts/check_economy_assets.mjs` | 校验指定数据库与站点的经济图片覆盖。 |
| `scripts/build_victorian_century_site.mjs` | 同步主站外壳并为 VC 站重建经济素材。 |
| `scripts/check_victorian_century_standalone_site.mjs` | 校验十个数据块、两种语言和独立站素材。 |
| `scripts/check_victorian_century_browser.mjs` | 校验 VC 十个板块、变化筛选及中英文建筑商品详情。 |

## 实施步骤

**任务 1：建立 Clausewitz 定义补丁合并模块**

**涉及文件：**
- Create: `scripts/lib/clausewitz-definition-patches.mjs`
- Create: `scripts/check_clausewitz_definition_patches.mjs`

- [ ] **Step 1: 写入补丁语义失败检查**

创建 `scripts/check_clausewitz_definition_patches.mjs`，使用下列完整样本固定合并接口和关键数值：

```js
import assert from "node:assert/strict";
import {
  applyDefinitionAssignment,
  parseDefinitionDirective,
} from "./lib/clausewitz-definition-patches.mjs";

const node = (assignments = [], items = []) => ({ assignments, items });
const assignment = (key, value) => ({ key, op: "=", value });
const scalar = (key, value) => assignment(key, String(value));
const definitions = new Map();

applyDefinitionAssignment(definitions, assignment("pm_wooden_buildings", node([
  scalar("texture", "wooden.dds"),
  assignment("building_modifiers", node([
    assignment("workforce_scaled", node([scalar("goods_input_fabric_add", 25), scalar("goods_input_wood_add", 75)])),
    assignment("level_scaled", node([scalar("building_employment_laborers_add", 800)])),
  ])),
  assignment("state_modifiers", node([
    assignment("workforce_scaled", node([scalar("state_construction_mult", 0.002)])),
  ])),
])), "base/13_construction.txt");
applyDefinitionAssignment(definitions, assignment("INJECT:pm_wooden_buildings", node([
  assignment("building_modifiers", node([
    assignment("workforce_scaled", node([scalar("goods_input_fabric_add", 5), scalar("goods_input_wood_add", 15)])),
  ])),
  assignment("state_modifiers", node([
    assignment("workforce_scaled", node([scalar("state_construction_mult", -0.001)])),
  ])),
])), "mod/joi_methods.txt", { modStage: true });

applyDefinitionAssignment(definitions, assignment("pmg_banana_exploitation", node([
  assignment("production_methods", node([], ["default_labour", "slave_exploitation_banana", "worker_exploitation_banana"])),
])), "base/04_plantations.txt");
applyDefinitionAssignment(definitions, assignment("INJECT:pmg_banana_exploitation", node([
  assignment("production_methods", node([], ["united_fruit_banana"])),
])), "mod/joi_plantations.txt", { modStage: true });
applyDefinitionAssignment(definitions, assignment("TRY_INJECT:missing_building", node([scalar("enabled", "yes")])), "mod/missing.txt", { modStage: true });

const wooden = definitions.get("pm_wooden_buildings");
const read = (root, ...keys) => keys.reduce((value, key) => value.assignments.find((item) => item.key === key).value, root);
assert.deepEqual(parseDefinitionDirective("TRY_INJECT:building_rye_farm"), { directive: "TRY_INJECT", key: "building_rye_farm" });
assert.equal(read(wooden.node, "building_modifiers", "workforce_scaled", "goods_input_fabric_add"), "30");
assert.equal(read(wooden.node, "building_modifiers", "workforce_scaled", "goods_input_wood_add"), "90");
assert.equal(read(wooden.node, "state_modifiers", "workforce_scaled", "state_construction_mult"), "0.001");
assert.equal(read(wooden.node, "building_modifiers", "level_scaled", "building_employment_laborers_add"), "800");
assert.deepEqual(read(definitions.get("pmg_banana_exploitation").node, "production_methods").items, ["default_labour", "slave_exploitation_banana", "worker_exploitation_banana", "united_fruit_banana"]);
assert.deepEqual(wooden.source_files, ["base/13_construction.txt", "mod/joi_methods.txt"]);
assert.deepEqual(wooden.patch_directives, ["INJECT"]);
assert.equal(definitions.has("missing_building"), false);

assert.throws(() => applyDefinitionAssignment(definitions, assignment("INJECT:absent", node()), "mod/error.txt", { modStage: true }), /INJECT.*absent.*mod\/error\.txt/);
assert.throws(() => applyDefinitionAssignment(definitions, assignment("CREATE:pm_wooden_buildings", node()), "mod/error.txt", { modStage: true }), /CREATE.*pm_wooden_buildings/);

console.log(JSON.stringify({ clausewitz_definition_patches: "ok", definitions: definitions.size }, null, 2));
```

- [ ] **Step 2: 运行检查并确认模块尚不存在**

运行：`node scripts/check_clausewitz_definition_patches.mjs`

预期：检查失败，错误为 `scripts/lib/clausewitz-definition-patches.mjs` 的 `ERR_MODULE_NOT_FOUND`。

- [ ] **Step 3: 实现最小补丁模块**

创建 `scripts/lib/clausewitz-definition-patches.mjs`，公开下列接口。修正作用域的数值使用加法，其他标量覆盖，列表去重追加，`if`、`else_if` 和 `else` 分支按出现顺序追加：

```js
const DIRECTIVES = new Set(["INJECT", "TRY_INJECT", "REPLACE", "REPLACE_OR_CREATE", "CREATE"]);
const MODIFIER_ROOTS = new Set(["building_modifiers", "state_modifiers", "country_modifiers"]);
const REPEATED_BRANCHES = new Set(["if", "else_if", "else"]);

export function parseDefinitionDirective(rawKey) {
  const match = String(rawKey || "").match(/^([A-Z_]+):(.*)$/);
  if (!match || !DIRECTIVES.has(match[1])) return { directive: "DEFINE", key: String(rawKey || "") };
  return { directive: match[1], key: match[2] };
}

export function applyDefinitionAssignment(definitions, assignment, sourceFile, options = {}) {
  const { directive, key } = parseDefinitionDirective(assignment.key);
  const existing = definitions.get(key);
  const modStage = Boolean(options.modStage);
  if (directive === "TRY_INJECT" && !existing) return;
  if (directive === "INJECT" && !existing) throw new Error(`INJECT target ${key} is missing in ${sourceFile}`);
  if (directive === "REPLACE" && !existing) throw new Error(`REPLACE target ${key} is missing in ${sourceFile}`);
  if (directive === "CREATE" && existing) throw new Error(`CREATE target ${key} already exists in ${sourceFile}`);
  if (directive === "INJECT" || directive === "TRY_INJECT") {
    existing.node = mergeClausewitzNodes(existing.node, assignment.value);
    existing.source_file = sourceFile;
    existing.source_files = unique([...existing.source_files, sourceFile]);
    if (modStage) existing.patch_directives = unique([...existing.patch_directives, directive]);
    return;
  }
  const sourceFiles = existing ? unique([...existing.source_files, sourceFile]) : [sourceFile];
  const patchDirectives = modStage
    ? unique([...(existing?.patch_directives || []), directive])
    : [];
  definitions.set(key, { key, node: cloneValue(assignment.value), source_file: sourceFile, source_files: sourceFiles, patch_directives: patchDirectives });
}

export function mergeClausewitzNodes(base, patch, path = []) {
  const result = cloneValue(base);
  result.items = unique([...(result.items || []), ...((patch && patch.items) || []).map(cloneValue)]);
  for (const next of (patch && patch.assignments) || []) {
    if (REPEATED_BRANCHES.has(next.key)) {
      result.assignments.push(cloneValue(next));
      continue;
    }
    const current = [...result.assignments].reverse().find((item) => item.key === next.key);
    if (!current) {
      result.assignments.push(cloneValue(next));
      continue;
    }
    const nextPath = [...path, next.key];
    if (isNode(current.value) && isNode(next.value)) current.value = mergeClausewitzNodes(current.value, next.value, nextPath);
    else if (isAdditiveModifier(nextPath, current.value, next.value)) current.value = String(Number(current.value) + Number(next.value));
    else current.value = cloneValue(next.value);
  }
  return result;
}

function isAdditiveModifier(path, left, right) {
  return path.some((key) => MODIFIER_ROOTS.has(key)) && Number.isFinite(Number(left)) && Number.isFinite(Number(right));
}

function isNode(value) {
  return Boolean(value && typeof value === "object" && Array.isArray(value.assignments) && Array.isArray(value.items));
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
}

function unique(values) {
  return [...new Set(values)];
}
```

- [ ] **Step 4: 运行补丁单元检查**

运行：`node scripts/check_clausewitz_definition_patches.mjs`

预期：检查通过，并输出 `"clausewitz_definition_patches": "ok"`。

- [ ] **Step 5: 提交补丁模块**

```powershell
git add -- scripts/lib/clausewitz-definition-patches.mjs scripts/check_clausewitz_definition_patches.mjs
git commit -m "feat: merge Clausewitz definition patches"
```

**任务 2：让经济抽取使用合并后的定义**

**涉及文件：**
- Modify: `scripts/extract_vic3_countries.mjs`
- Create: `scripts/check_victorian_century_economy_database.mjs`
- Test: `scripts/check_economy_database.mjs`

- [ ] **Step 1: 写入 VC 经济数据库失败检查**

创建 `scripts/check_victorian_century_economy_database.mjs`。脚本从 `VICTORIAN_CENTURY_DATABASE` 读取数据库，并固定以下断言：

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const database = path.resolve(process.env.VICTORIAN_CENTURY_DATABASE || "database/victorian_century");
const read = (file) => JSON.parse(fs.readFileSync(path.join(database, file), "utf8").replace(/^\uFEFF/, ""));
const index = read("index.json");
const rows = (key) => read(index.files[key]);
const buildings = rows("buildings");
const groups = rows("production_method_groups");
const methods = rows("production_methods");
const goods = rows("goods");
const prestigeGoods = rows("prestige_goods");
const byKey = (items) => new Map(items.map((item) => [item.key, item]));
const methodByKey = byKey(methods);
const groupByKey = byKey(groups);
const effect = (method, key) => methodByKey.get(method).effects.find((item) => item.key === key)?.value;

assert.equal(buildings.length, 101);
assert.equal(new Set(buildings.map((item) => item.key)).size, buildings.length);
assert.equal(goods.length, 53);
assert.equal(prestigeGoods.length, 98);
assert.equal(methods.length, 437);
assert.equal(effect("pm_wooden_buildings", "goods_input_fabric_add"), 30);
assert.equal(effect("pm_wooden_buildings", "goods_input_wood_add"), 90);
assert.equal(effect("pm_wooden_buildings", "state_construction_mult"), 0.001);
assert.equal(effect("pm_dye_production", "goods_input_fertilizer_add"), 25);
assert.equal(effect("pm_telephones", "goods_input_rubber_add"), 10);
assert.deepEqual(groupByKey.get("pmg_banana_exploitation").production_method_keys, ["default_labour", "slave_exploitation_banana", "worker_exploitation_banana", "united_fruit_banana"]);
assert.equal(buildings.filter((item) => item.key === "building_opium_plantation").length, 1);
assert(buildings.filter((item) => item.patch_directives.length > 0).length >= 43);
assert.deepEqual(byKey(buildings).get("building_opium_plantation").patch_directives, ["REPLACE"]);
assert(prestigeGoods.some((item) => item.key === "prestige_good_benz_car" && item.base_good_key === "automobiles"));

for (const group of groups) for (const key of group.production_method_keys) assert(methodByKey.has(key), `${group.key} -> ${key}`);
for (const item of prestigeGoods) assert(goods.some((good) => good.key === item.base_good_key), `${item.key} -> ${item.base_good_key}`);

console.log(JSON.stringify({ vc_economy_database: "ok", buildings: buildings.length, goods: goods.length, prestige_goods: prestigeGoods.length, production_methods: methods.length }, null, 2));
```

- [ ] **Step 2: 运行检查并确认旧 VC 数据库缺少经济文件**

运行：`node scripts/check_victorian_century_economy_database.mjs`

预期：检查因缺少 `index.files.buildings` 而失败。

- [ ] **Step 3: 在抽取器中增加统一定义读取函数**

在 `scripts/extract_vic3_countries.mjs` 顶部导入 `applyDefinitionAssignment`，并增加下列辅助函数。六个经济加载器都从返回记录读取 `record.key`、`record.node`、`record.source_file`、`record.source_files` 和 `record.patch_directives`：

```js
import { applyDefinitionAssignment, parseDefinitionDirective } from "./lib/clausewitz-definition-patches.mjs";

function loadPatchedDefinitions(dirs, accept) {
  const definitions = new Map();
  for (const file of listFiles(dirs)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const { key } = parseDefinitionDirective(assignment.key);
      if (!accept(key, asNode(assignment.value))) continue;
      const modStage = Boolean(modContentRoot) && normalizePath(file).startsWith(`${normalizePath(modContentRoot)}/`);
      applyDefinitionAssignment(definitions, assignment, normalizePath(file), { modStage });
    }
  }
  return definitions;
}
```

把 `loadBuildingGroups`、`loadProductionMethodGroups`、`loadProductionMethods`、`loadGoods`、`loadPrestigeGoods` 和 `loadBuildings` 的外层文件循环替换为 `loadPatchedDefinitions`。`loadBuildings` 使用最终记录生成数组，避免完整替换产生重复建筑。每个公开对象增加 `source_files: record.source_files` 和 `patch_directives: record.patch_directives`。

- [ ] **Step 4: 允许 PNG 经济图标并统一输出键名路径**

把 `economyIcon` 改为接受 `.dds` 与 `.png`，保留原始来源路径，并让站点路径与前端现有键名规则一致：

```js
function economyIcon(source, category, key, label) {
  if (!source || !/\.(?:dds|png)$/i.test(source)) throw new Error(`${label} icon is missing: ${key}`);
  return { source, site_path: `assets/${category}/${key}.webp` };
}
```

- [ ] **Step 5: 生成临时 VC 数据库并运行数据检查**

```powershell
$vcTempDb = Join-Path $env:TEMP 'vicdata-vc-economy-db'
$vcTempOut = Join-Path $env:TEMP 'vicdata-vc-economy-out'
node scripts/extract_vic3_countries.mjs --game-path 'D:\SteamLibrary\steamapps\common\Victoria 3' --mod-path 'D:\SteamLibrary\steamapps\workshop\content\529340\3219394272' --dataset-name 'Victorian Century' --version 1.13.9 --database $vcTempDb --out $vcTempOut
$env:VICTORIAN_CENTURY_DATABASE = $vcTempDb
node scripts/check_victorian_century_economy_database.mjs
Remove-Item Env:VICTORIAN_CENTURY_DATABASE
```

预期：抽取器运行成功；检查报告 101 个建筑、53 种普通商品、98 种名贵商品和 437 种生产方式。

- [ ] **Step 6: 回归原版经济数据库**

运行：`node scripts/check_economy_database.mjs`

预期：检查通过，现有数量保持为 101 个建筑、53 种普通商品和 72 种名贵商品。

- [ ] **Step 7: 提交经济抽取改动**

```powershell
git add -- scripts/extract_vic3_countries.mjs scripts/check_victorian_century_economy_database.mjs
git commit -m "feat: extract Victorian Century economy data"
```

**任务 3：补全英文引用解析与 VC 本地化别名**

**涉及文件：**
- Create: `scripts/locales/victorian-century-aliases.mjs`
- Create: `scripts/check_economy_localization.mjs`
- Modify: `scripts/extract_vic3_countries.mjs`
- Modify: `scripts/locales/extractor.zh-Hans.mjs`
- Modify: `scripts/locales/extractor.en.mjs`

- [ ] **Step 1: 写入建筑商品语言包失败检查**

创建 `scripts/check_economy_localization.mjs`，接受 `--database`，收集建筑与商品结构的本地化引用。`.description` 允许为空，其余引用必须有值；英文值不得含中文、`$key$`、`@icon!`、颜色标记、`[Nbsp]` 或概念表达式：

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { collectLocalizationRefs } from "./lib/localization-schema.mjs";

const args = Object.fromEntries(process.argv.slice(2).reduce((rows, value, index, all) => value.startsWith("--") ? [...rows, [value.slice(2), all[index + 1]]] : rows, []));
const database = path.resolve(args.database || "database/vic3_1.13.9");
const read = (file) => JSON.parse(fs.readFileSync(path.join(database, file), "utf8").replace(/^\uFEFF/, ""));
const index = read("index.json");
const chunks = { building: ["buildings", "building_groups", "production_method_groups", "production_methods"], goods: ["goods", "prestige_goods"] };

for (const [chunk, keys] of Object.entries(chunks)) {
  const refs = new Set();
  for (const key of keys) collectLocalizationRefs(read(index.files[key]), refs);
  for (const locale of ["zh-Hans", "en"]) {
    const catalog = read(index.locales.files[locale].file);
    for (const id of refs) {
      const value = catalog[id] || "";
      if (!id.endsWith(".description")) assert(value, `${locale} missing ${chunk} message: ${id}`);
      assert.doesNotMatch(value, /\$[^$]+\$|@[A-Za-z0-9_]+!|#(?:[A-Za-z0-9_]+)?\s|\[Nbsp\]|\[(?:Concept|concept_)/, `${locale} unresolved ${id}: ${value}`);
      if (locale === "en") assert.doesNotMatch(value, /[\u3400-\u9fff]/, `English message contains Chinese: ${id}: ${value}`);
    }
  }
}

console.log(JSON.stringify({ economy_localization: "ok", database }, null, 2));
```

- [ ] **Step 2: 运行原版检查并确认未解析英文引用**

运行：`node scripts/check_economy_localization.mjs --database database/vic3_1.13.9`

预期：检查在 `pmg_base_building_oil_rig.name = $pm_base$` 等条目处失败。

- [ ] **Step 3: 增加已核对的 VC 键别名**

创建 `scripts/locales/victorian-century-aliases.mjs`：

```js
export default Object.freeze({
  common: Object.freeze({
    en: Object.freeze({ building_machu_picchu: "pm_default_building_machu_picchu" }),
    "zh-Hans": Object.freeze({ building_machu_picchu: "pm_default_building_machu_picchu" }),
  }),
  victorianCentury: Object.freeze({
    en: Object.freeze({
      prestige_good_basmati_rise: "prestige_good_basmati_rice",
      prestige_good_irontill_series: "prestige_good_iron_till_series",
    }),
    "zh-Hans": Object.freeze({}),
  }),
});
```

读取简体中文和英文词典后，先应用 `common`；仅当 `modContentRoot` 存在时再应用 `victorianCentury`。把别名目标值复制到对象实际键，随后再构建经济对象和语言投影；启用范围内的目标键不存在时，抛出含语言、对象键和目标键的错误。原版抽取不得要求 VC 专用目标键存在。

- [ ] **Step 4: 在投影前解析目标语言文本**

扩展 `cleanLocalizationText`，处理 `[Nbsp]` 和不带 `Concept(...)` 的概念标记；为每个目标词典建立 `Map`，在 `localizeProjection.translate` 返回直接键或来源键之前调用清理函数：

```js
const targetLoc = new Map(Object.entries(targetCatalog));

function resolvedLocalizationText(catalog, loc, key) {
  if (!key || catalog[key] === undefined) return "";
  return cleanLocalizationText(catalog[key], loc);
}

// inside translate
for (const directKey of directKeys) {
  const translated = resolvedLocalizationText(targetCatalog, targetLoc, directKey);
  if (translated) return translated;
}
const sourceKey = keysBySourceText.get(text);
return sourceKey ? resolvedLocalizationText(targetCatalog, targetLoc, sourceKey) : "";
```

`cleanLocalizationText` 在返回前增加：

```js
result = result.replace(/\[Nbsp\]/g, " ");
```

在 `localizeProjection` 的 `zh-Hans` 分支也通过 `cleanLocalizationText` 处理当前值，避免简体中文语言包继续保留 `$building_dummy$` 等引用。英文解析不到可选说明时保持空值；解析不到必填名称时，后续本地化检查给出具体消息编号。

- [ ] **Step 5: 补入站内经济分组双语名称**

给 `economyBoardGroup` 生成的对象写入 `name_en`，七组依次为 `Agriculture`、`Resources`、`Industrial`、`Military`、`Infrastructure`、`Ownership Buildings`、`Monuments`。给 `economyGroupCategoryName` 增加英文值，输出 `category_name_en`。这些词同时放入 `extractor.zh-Hans.mjs` 与 `extractor.en.mjs` 的 `enum.economyBoardGroup.*`、`enum.economyBuildingCategory.*` 键，避免以后增加语言时继续写条件分支。

- [ ] **Step 6: 重建临时原版与 VC 数据并验证语言包**

```powershell
$baseDb = Join-Path $env:TEMP 'vicdata-base-locale-db'
$baseOut = Join-Path $env:TEMP 'vicdata-base-locale-out'
$vcDb = Join-Path $env:TEMP 'vicdata-vc-locale-db'
$vcOut = Join-Path $env:TEMP 'vicdata-vc-locale-out'
node scripts/extract_vic3_countries.mjs --game-path 'D:\SteamLibrary\steamapps\common\Victoria 3' --version 1.13.9 --database $baseDb --out $baseOut
node scripts/check_economy_localization.mjs --database $baseDb
node scripts/extract_vic3_countries.mjs --game-path 'D:\SteamLibrary\steamapps\common\Victoria 3' --mod-path 'D:\SteamLibrary\steamapps\workshop\content\529340\3219394272' --dataset-name 'Victorian Century' --version 1.13.9 --database $vcDb --out $vcOut
node scripts/check_economy_localization.mjs --database $vcDb
```

预期：两项检查通过；VC 英文在实际定义键下包含 `Basmati Rice` 和 `Ironclad Tools`，两种语言均显示 Machu Picchu，不显示 `$building_dummy$`。

- [ ] **Step 7: 提交本地化改动**

```powershell
git add -- scripts/extract_vic3_countries.mjs scripts/locales/victorian-century-aliases.mjs scripts/locales/extractor.zh-Hans.mjs scripts/locales/extractor.en.mjs scripts/check_economy_localization.mjs
git commit -m "fix: resolve English economy localization"
```

**任务 4：给 VC 经济对象增加变化标记和筛选**

**涉及文件：**
- Modify: `scripts/build_wiki.mjs`
- Modify: `scripts/check_victorian_century_change_tags.mjs`
- Modify: `site/app/economy.js`
- Modify: `site/styles/economy.css`
- Modify: `scripts/check_economy_board_contract.mjs`
- Modify: `site/index.html`
- Modify: `site/styles.css`

- [ ] **Step 1: 扩展变化标记失败检查**

在 `scripts/check_victorian_century_change_tags.mjs` 的 `changeFields` 加入：

```js
buildings: "key",
buildingGroups: "key",
productionMethodGroups: "key",
productionMethods: "key",
goods: "key",
prestigeGoods: "key",
```

读取 `site/app/economy.js`，断言包含 `matchesVictorianCenturyChange`、`victorianCenturyBadge` 和 `data-economy-vc-change`。比较时忽略 `source_files`，保留 `patch_directives`；增加断言，确认至少 43 个建筑标为调整，以覆盖 42 个 `TRY_INJECT` 和鸦片种植园替换。

- [ ] **Step 2: 用临时 VC 数据运行检查并确认经济集合未标记**

运行：`$env:VICTORIAN_CENTURY_DATABASE = (Join-Path $env:TEMP 'vicdata-vc-locale-db'); node scripts/check_victorian_century_change_tags.mjs; Remove-Item Env:VICTORIAN_CENTURY_DATABASE`

预期：检查因 `buildings`、`productionMethods`、`goods` 或 `prestigeGoods` 的标签数与基线比较不符而失败。

- [ ] **Step 3: 扩展站点构建器的经济变化集合**

在 `victorianCenturyChangeCollections` 增加六个经济集合，并把 `source_files` 加入 `victorianCenturyChangeIgnoredFields`。`patch_directives` 不加入忽略集合，使只修改未投影脚本条件的对象也能判定为调整。保持现有逐键比较函数，不引入经济专用比较分支。

- [ ] **Step 4: 在经济图片墙和详情显示标记**

在 `site/app/economy.js` 中作以下改动：

```js
function economyVisible(item, query) {
  return matchesVictorianCenturyChange(item) && economyMatches(item, query);
}

function economyChangeFiltersHtml(items) {
  if (!(items || []).some(hasVictorianCenturyChange)) return "";
  return `<div class="economy-change-filters" aria-label="${escapeHtml(t("filter.dataTags"))}">
    <button type="button" data-economy-vc-change="added" aria-pressed="${state.victorianCenturyChangeKinds.has("added")}">${escapeHtml(t("filter.vcAdded"))}</button>
    <button type="button" data-economy-vc-change="adjusted" aria-pressed="${state.victorianCenturyChangeKinds.has("adjusted")}">${escapeHtml(t("filter.vcAdjusted"))}</button>
  </div>`;
}
```

建筑和商品分组前先用 `economyVisible` 过滤。工具栏渲染当前板块的变化按钮，点击后调用 `toggleVictorianCenturyChangeKind` 并重新渲染。卡片名称、详情标题、生产方式组标题、生产方式详情标题和名贵商品变体标题旁调用 `victorianCenturyBadge`。筛选后的分组计数和总数直接由过滤后数组计算。

- [ ] **Step 5: 增加经济标记样式并更新缓存版本**

在 `site/styles/economy.css` 增加 `.economy-change-filters`、`.economy-card-name`、`.economy-card-change` 和详情标题标记样式，避免现有 `.economy-card span` 规则作用于标记。把 `site/index.html`、`site/styles.css` 和 `scripts/check_economy_board_contract.mjs` 中经济脚本及样式版本统一改为 `20260804-vc-english-economy1`。

- [ ] **Step 6: 运行变化标记与前端契约检查**

```powershell
$env:VICTORIAN_CENTURY_DATABASE = Join-Path $env:TEMP 'vicdata-vc-locale-db'
node scripts/check_victorian_century_change_tags.mjs
Remove-Item Env:VICTORIAN_CENTURY_DATABASE
node scripts/check_economy_board_contract.mjs
```

预期：两项检查通过；26 种新增名贵商品标为 `added`，有改动的生产方式及受影响商品标为 `adjusted`。

- [ ] **Step 7: 提交变化标记界面**

```powershell
git add -- scripts/build_wiki.mjs scripts/check_victorian_century_change_tags.mjs scripts/check_economy_board_contract.mjs site/app/economy.js site/styles/economy.css site/index.html site/styles.css
git commit -m "feat: show Victorian Century economy changes"
```

**任务 5：从原版和模组生成 VC 经济素材**

**涉及文件：**
- Modify: `scripts/build_economy_assets.mjs`
- Modify: `scripts/check_economy_assets.mjs`
- Modify: `scripts/build_victorian_century_site.mjs`
- Test: `scripts/check_victorian_century_standalone_site.mjs`

- [ ] **Step 1: 写入参数化素材失败检查**

修改 `scripts/check_economy_assets.mjs`，解析 `--database` 和 `--site`，并用数据库 `source_paths.mod_data`、`source_paths.game_data` 核对每个 `icon.source` 至少在一个来源存在。站点目标仍为 `assets/<类别>/<对象键>.webp`。在 `check_victorian_century_standalone_site.mjs` 增加以下断言：

```js
assert(fs.existsSync(path.join(siteRoot, "assets", "production-methods", "united_fruit_banana.webp")), "missing VC production-method asset");
assert(fs.existsSync(path.join(siteRoot, "assets", "prestige-goods", "prestige_good_benz_car.webp")), "missing VC prestige-good asset");
```

- [ ] **Step 2: 对临时 VC 数据运行素材检查并确认失败**

运行：`node scripts/check_economy_assets.mjs --database "$env:TEMP\vicdata-vc-locale-db" --site "Victorian Century Database"`

预期：检查因尚未生成 VC 经济 WebP 文件而失败。

- [ ] **Step 3: 让素材构建器按模组优先解析来源**

在 `scripts/build_economy_assets.mjs` 中使用下列来源选择函数。数据库声明模组路径时优先取模组文件，找不到时读取原版：

```js
const sourceRoots = [
  { kind: "mod", root: index.source_paths?.mod_data },
  { kind: "game", root: index.source_paths?.game_data },
].filter((item) => item.root).map((item) => ({ ...item, root: path.resolve(item.root) }));

function resolveIconSource(relative) {
  const parts = String(relative || "").split("/");
  for (const item of sourceRoots) {
    const source = path.join(item.root, ...parts);
    if (fs.statSync(source, { throwIfNoEntry: false })?.isFile()) return { source, source_kind: item.kind };
  }
  throw new Error(`Missing economy icon source: ${relative}`);
}
```

构建清单使用 `resolveIconSource(row.icon.source)` 选择实际输入，目标继续为对象键 WebP。Pillow 同时读取 DDS 和 PNG。构建完成后写入 `assets/economy-assets.json`，逐项记录 `category`、`key`、`source_kind`、数据库中的相对 `source` 和站点相对 `target`。`check_economy_assets.mjs` 重新计算预期记录并与清单逐项比较，避免绝对路径进入发布文件。

- [ ] **Step 4: 把经济素材构建接入 VC 独立站构建器**

在 `scripts/build_victorian_century_site.mjs` 复制主站素材之后、运行 VC 专用素材同步之前调用：

```js
function runEconomyAssetBuild(explicitPython, explicitDatabase) {
  const database = path.resolve(explicitDatabase || path.join(root, "database", "victorian_century"));
  const buildArgs = [path.join(root, "scripts", "build_economy_assets.mjs"), "--database", database, "--site", targetSite];
  if (explicitPython) buildArgs.push("--python", explicitPython);
  const result = spawnSync(process.execPath, buildArgs, { cwd: root, encoding: "utf8", shell: false });
  if (result.status !== 0) throw new Error(`VC economy asset build failed:\n${result.stdout}\n${result.stderr}`.trim());
}
```

经济素材构建不受 `--skip-vc-assets` 控制；该参数维持现有含义，只跳过公司、法律和意识形态专用同步。复制主站素材后必须重新生成 VC 经济素材，避免保留同键原版图标。

- [ ] **Step 5: 构建临时 VC 站素材并验证**

```powershell
node scripts/build_wiki.mjs --database "$env:TEMP\vicdata-vc-locale-db" --baseline-database database/vic3_1.13.9 --out 'Victorian Century Database'
node scripts/build_victorian_century_site.mjs --target 'Victorian Century Database' --publish-target site/vc --vc-database "$env:TEMP\vicdata-vc-locale-db"
node scripts/check_economy_assets.mjs --database "$env:TEMP\vicdata-vc-locale-db" --site 'Victorian Century Database'
```

预期：检查通过；`united_fruit_banana.webp` 和 `prestige_good_benz_car.webp` 均存在。

- [ ] **Step 6: 提交素材构建改动**

```powershell
git add -- scripts/build_economy_assets.mjs scripts/check_economy_assets.mjs scripts/build_victorian_century_site.mjs scripts/check_victorian_century_standalone_site.mjs
git commit -m "feat: build Victorian Century economy assets"
```

**任务 6：扩展 VC 独立站静态契约**

**涉及文件：**
- Modify: `scripts/check_victorian_century_standalone_site.mjs`
- Modify: `scripts/check_victorian_century_update.mjs`

- [ ] **Step 1: 把 VC 预期数据块扩展为十项**

将 `expectedChunks` 改为：

```js
const expectedChunks = ["country", "culture", "region", "company", "ideology", "law", "technology", "achievement", "building", "goods"];
```

将 `app/achievements.js` 和 `app/economy.js` 加入 `expectedModules`。为 `building`、`goods` 的中英文语言文件、数据文件和搜索索引条目增加现有通用循环检查。

- [ ] **Step 2: 固定 VC 更新流程的无地图重建行为**

在 `scripts/check_victorian_century_update.mjs` 的 `runUpdate` 中保留 `--skip-map` 分支：跳过地图生成，但仍执行抽取、`build_wiki`、经济素材和独立站发布。更新状态的 `map_rebuilt` 必须写为 `false`，已有 `map-data.js` 与省份图文件不得改变。

- [ ] **Step 3: 运行独立站静态检查**

运行：`node scripts/check_victorian_century_standalone_site.mjs`

预期：检查通过，包含十个数据块、两种语言和十四个前端模块。

- [ ] **Step 4: 提交独立站契约**

```powershell
git add -- scripts/check_victorian_century_standalone_site.mjs scripts/check_victorian_century_update.mjs
git commit -m "test: cover Victorian Century economy site"
```

**任务 7：重建原版与 VC 数据和站点输出**

**涉及文件：**
- Modify generated: `database/vic3_1.13.9/`
- Modify generated: `site/versions/1.13.9/data-buildings.js`
- Modify generated: `site/versions/1.13.9/data-goods.js`
- Modify generated: `site/versions/1.13.9/locale-buildings.en.js`
- Modify generated: `site/versions/1.13.9/locale-buildings.zh-Hans.js`
- Modify generated: `site/versions/1.13.9/locale-goods.en.js`
- Modify generated: `site/versions/1.13.9/locale-goods.zh-Hans.js`
- Modify generated: `site/versions/1.13.9/data-index.js`
- Modify generated: `site/versions/1.13.9/search-index.js`
- Modify generated: `site/assets/buildings/*.webp`
- Modify generated: `site/assets/goods/*.webp`
- Modify generated: `site/assets/production-methods/*.webp`
- Modify generated: `site/assets/prestige-goods/*.webp`
- Create generated: `site/assets/economy-assets.json`
- Modify ignored output: `database/victorian_century/`
- Modify ignored output: `Victorian Century Database/`
- Modify ignored output: `site/vc/`

- [ ] **Step 1: 重建原版 1.13.9 数据库**

运行：`node scripts/extract_vic3_countries.mjs --game-path 'D:\SteamLibrary\steamapps\common\Victoria 3' --version 1.13.9 --database database/vic3_1.13.9 --out output/vic3_1.13.9`

预期：抽取完成，数量为 101 个建筑、53 种普通商品和 72 种名贵商品。

- [ ] **Step 2: 重建原版分块和经济素材**

```powershell
node scripts/build_wiki.mjs --database database/vic3_1.13.9 --out site/versions/1.13.9
node scripts/build_economy_assets.mjs --database database/vic3_1.13.9 --site site
```

预期：`locale-buildings.en.js` 不再包含 `$pm_base$` 或 `@rubber!`。

- [ ] **Step 3: 以已安装创意工坊副本强制重建 VC，不重建地图**

运行：`node scripts/check_victorian_century_update.mjs --force --skip-map --skip-network --json`

预期：状态为 `updated`；数据库包含 101 个建筑、53 种普通商品、98 种名贵商品和 437 种生产方式；`map_rebuilt` 为 `false`。

- [ ] **Step 4: 检查创意工坊状态与生成结果**

运行：`node scripts/check_victorian_century_update.mjs --check-only --skip-network --json`

预期：状态为 `up_to_date`，已安装清单与 `database/victorian_century/update-state.json` 一致。

- [ ] **Step 5: 运行数据、语言、分块和素材检查**

```powershell
node scripts/check_economy_database.mjs
node scripts/check_economy_localization.mjs --database database/vic3_1.13.9
node scripts/check_economy_assets.mjs --database database/vic3_1.13.9 --site site
node scripts/check_victorian_century_economy_database.mjs
node scripts/check_economy_localization.mjs --database database/victorian_century
node scripts/check_economy_assets.mjs --database database/victorian_century --site 'Victorian Century Database'
node scripts/check_victorian_century_change_tags.mjs
node scripts/check_victorian_century_standalone_site.mjs
node scripts/check_data_chunking.mjs
node scripts/check_publish_bundle.mjs
```

预期：每条命令的退出码均为 0。

- [ ] **Step 6: 审查并提交跟踪的生成文件**

先运行 `git status --short` 和 `git diff --stat`，确认未纳入用户原有未跟踪文件。随后提交源码对应的主站分块与经济 WebP：

```powershell
git add -- site/versions/1.13.9/data-buildings.js site/versions/1.13.9/data-goods.js site/versions/1.13.9/locale-buildings.en.js site/versions/1.13.9/locale-buildings.zh-Hans.js site/versions/1.13.9/locale-goods.en.js site/versions/1.13.9/locale-goods.zh-Hans.js site/versions/1.13.9/data-index.js site/versions/1.13.9/search-index.js site/assets/buildings site/assets/goods site/assets/production-methods site/assets/prestige-goods site/assets/economy-assets.json
git commit -m "build: refresh bilingual economy data"
```

**任务 8：完成主站和 VC 浏览器回归**

**涉及文件：**
- Modify: `scripts/check_economy_board_browser.mjs`
- Modify: `scripts/check_victorian_century_browser.mjs`

- [ ] **Step 1: 扩展主站英文可见文本检查**

在 `check_economy_board_browser.mjs` 的英文橡胶种植园详情中展开生产方式选择和详情框，读取 `.economy-detail.innerText`，增加：

```js
assert.doesNotMatch(englishBuilding.body, /\$[^$]+\$|@[A-Za-z0-9_]+!|[\u3400-\u9fff]/, "English building detail contains unresolved localization");
assert.deepEqual(englishBuilding.groupNames, ["Agriculture", "Resources", "Industrial", "Military", "Infrastructure", "Ownership Buildings", "Monuments"]);
assert.doesNotMatch(englishGood.body, /\$[^$]+\$|@[A-Za-z0-9_]+!|[\u3400-\u9fff]/, "English goods detail contains unresolved localization");
```

- [ ] **Step 2: 扩展 VC 浏览器路由和变化筛选**

把 `allRoutes` 增加 `building`、`goods`。建筑和商品路由断言地图隐藏；其他八个板块继续断言地图显示。经济路由使用 `[data-building-key]`、`[data-good-key]` 和 `[data-economy-vc-change]` 检查新增、调整筛选，不套用侧栏筛选选择器。

增加 VC 固定样本：英文 `#/building/building_construction_sector` 显示完整施工方式名称和组合效果；中文与英文 `#/goods/automobiles` 显示 `prestige_good_benz_car`，英文名称为 `Benz Automobiles`；`united_fruit_banana` 显示为新增，`pm_wooden_buildings` 显示为调整。扫描两个英文详情的可见文本，不允许脚本占位符和中文字符。

- [ ] **Step 3: 启动两个静态服务器并串行运行浏览器检查**

```powershell
$mainServer = Start-Process -FilePath node -ArgumentList @('scripts/serve_site.mjs','site','4173') -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$vcServer = Start-Process -FilePath node -ArgumentList @('scripts/serve_site.mjs','Victorian Century Database','8877') -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
try {
  node scripts/check_economy_board_browser.mjs 'http://127.0.0.1:4173/index.html?version=1.13.9'
  node scripts/check_victorian_century_browser.mjs 'http://127.0.0.1:8877/index.html' building goods --fixtures
  node scripts/check_multilingual_browser.mjs 'http://127.0.0.1:4173/index.html?version=1.13.9'
} finally {
  Stop-Process -Id $mainServer.Id,$vcServer.Id -ErrorAction SilentlyContinue
}
```

预期：三项浏览器检查的退出码均为 0；主站和 VC 英文页面没有未解析标记或中文文本；窄屏商品详情没有横向溢出。

- [ ] **Step 4: 提交浏览器回归**

```powershell
git add -- scripts/check_economy_board_browser.mjs scripts/check_victorian_century_browser.mjs
git commit -m "test: verify bilingual economy boards"
```

**任务 9：完整验证与工作记录**

**涉及文件：**
- Create: `docs/worklog/2026-08-04-vc-english-economy.md`
- Modify locally: `WORKLOG.md`

- [ ] **Step 1: 运行语法与静态检查**

```powershell
node --check scripts/lib/clausewitz-definition-patches.mjs
node --check scripts/extract_vic3_countries.mjs
node --check scripts/build_wiki.mjs
node --check scripts/build_economy_assets.mjs
node --check scripts/build_victorian_century_site.mjs
node --check site/app/economy.js
node scripts/check_clausewitz_definition_patches.mjs
node scripts/check_economy_board_contract.mjs
node scripts/check_economy_database.mjs
node scripts/check_economy_localization.mjs --database database/vic3_1.13.9
node scripts/check_victorian_century_economy_database.mjs
node scripts/check_economy_localization.mjs --database database/victorian_century
node scripts/check_victorian_century_change_tags.mjs
node scripts/check_victorian_century_standalone_site.mjs
```

预期：所有命令的退出码均为 0。

- [ ] **Step 2: 核对工作树范围**

运行：`git status --short`

预期：只显示本功能尚未提交的工作记录，以及任务开始前已有的 `Victorian`、`docs/superpowers/plans/2026-08-02-state-trait-map.md`、`screenshots/`、`scripts/__pycache__/`、`scripts/audit_historical_characters.mjs`、`tmp_character_audit.mjs`。不得暂存这些既有文件。

- [ ] **Step 3: 写入详细工作记录**

`docs/worklog/2026-08-04-vc-english-economy.md` 记录：设计与实施提交、原版与 VC 数据数量、三类已核对的本地化别名、补丁合并实例、VC 变化标记数量、素材数量、运行过的静态与浏览器命令、未重建地图的说明，以及仍未发布到远端的状态。根目录 `WORKLOG.md` 只增加一行索引和当前分支状态。

- [ ] **Step 4: 提交跟踪的工作记录**

```powershell
git add -- docs/worklog/2026-08-04-vc-english-economy.md
git commit -m "docs: record bilingual VC economy completion"
```

- [ ] **Step 5: 在交付前运行最终证据检查**

运行：`git log --oneline --decorate -10; git status --short; git diff main...HEAD --stat`

预期：功能提交完整，用户原有未跟踪文件仍未暂存，分支尚未推送。随后调用 `superpowers:verification-before-completion`，展示浏览器结果和数据数量，再进入分支收尾流程。
