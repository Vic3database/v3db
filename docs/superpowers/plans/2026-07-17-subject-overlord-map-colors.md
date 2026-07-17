# 附属国宗主国颜色实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 抽取开局附属关系，并让国家地图默认以宗主国颜色显示低级附属国，同时让左侧搜索和全局搜索恢复目标国家的自身颜色。

**Architecture:** 抽取脚本从开局附属关系文件生成直接宗主国和附属类型；数据库与站点国家块保留字段。前端以设置、搜索命中集合和全局搜索恢复 Tag 驱动统一颜色函数，并把相关状态加入地图缓存签名。

**Tech Stack:** Node.js、Paradox 脚本解析器、原生 JavaScript、Canvas 2D。

---

### Task 1: 增加关系抽取检查

**Files:**

- Create: `D:\Bot\Vic3\Victoria3_DB\scripts\check_starting_subject_relationships.mjs`
- Test: `D:\Bot\Vic3\Victoria3_DB\scripts\check_starting_subject_relationships.mjs`

- [ ] **Step 1: 建立数据库检查。**

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const countries = JSON.parse(fs.readFileSync(path.join(root, "database", "vic3_1.13.9", "countries.json"), "utf8"));
const byTag = new Map(countries.map((country) => [country.tag, country]));

for (const [tag, overlord, type] of [["BIC", "GBR", "chartered_company"], ["TIB", "CHI", "vassal"], ["TRI", "TUR", "puppet"], ["HUN", "AUS", "crown_land"]]) {
  const country = byTag.get(tag);
  assert.equal(country?.starting_subject?.overlord_tag, overlord, `${tag} should retain its direct starting overlord`);
  assert.equal(country?.starting_subject?.type, type, `${tag} should retain its starting subject type`);
  assert.equal(country?.starting_subject?.uses_overlord_color, true, `${tag} should use its overlord color`);
}
for (const [tag, type] of [["ABU", "protectorate"], ["KOR", "tributary"]]) {
  const country = byTag.get(tag);
  assert.equal(country?.starting_subject?.type, type, `${tag} should retain its excluded subject type`);
  assert.equal(country?.starting_subject?.uses_overlord_color, false, `${tag} should retain its own color`);
}
```

- [ ] **Step 2: 运行 `node scripts/check_starting_subject_relationships.mjs`。**

预期：退出码为 `1`，因为数据库尚无 `starting_subject`。

### Task 2: 抽取开局附属关系

**Files:**

- Modify: `D:\Bot\Vic3\Victoria3_DB\scripts\extract_vic3_countries.mjs:170-240,972-1030,2081-2150,3344-3520`
- Test: `D:\Bot\Vic3\Victoria3_DB\scripts\check_starting_subject_relationships.mjs`

- [ ] **Step 1: 在 `main` 中读取关系文件。**

在 `startingOwners` 后加入：

```js
const startingSubjectsByTag = loadStartingSubjectRelationships(
  contentPath("common", "history", "diplomacy", "00_subject_relationships.txt"),
);
```

将 `startingSubjectsByTag` 传入 `buildCountryRow`。

- [ ] **Step 2: 新增解析函数。**

在 `loadHistoryReligionOverrides` 后加入：

```js
function loadStartingSubjectRelationships(files) {
  const usesOverlordColor = new Set(["puppet", "vassal", "crown_land", "chartered_company", "colony", "dominion", "personal_union"]);
  const subjects = new Map();
  for (const file of Array.isArray(files) ? files : [files]) {
    if (!file || !fs.existsSync(file)) continue;
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const overlordTag = stripPrefix(scriptEntryKey(assignment.key)).toUpperCase();
      if (!/^[A-Z0-9]{3}$/.test(overlordTag)) continue;
      const overlordNode = asNode(assignment.value);
      if (!overlordNode) continue;
      for (const pactAssignment of overlordNode.assignments.filter((item) => item.key === "create_diplomatic_pact")) {
        const pact = asNode(pactAssignment.value);
        const subjectTag = stripPrefix(firstValue(pact, "country")).toUpperCase();
        const type = stripPrefix(firstValue(pact, "type"));
        if (!/^[A-Z0-9]{3}$/.test(subjectTag) || !type) continue;
        subjects.set(subjectTag, { overlord_tag: overlordTag, type, uses_overlord_color: usesOverlordColor.has(type) });
      }
    }
  }
  return subjects;
}
```

- [ ] **Step 3: 将关系写进原始行和数据库对象。**

在 `buildCountryRow` 返回对象加入：

```js
starting_overlord_tag: startingSubjectsByTag.get(tag)?.overlord_tag || "",
starting_subject_type: startingSubjectsByTag.get(tag)?.type || "",
starting_subject_uses_overlord_color: startingSubjectsByTag.get(tag)?.uses_overlord_color ? "是" : "否",
```

在数据库国家对象的 `starting_states` 后加入：

```js
starting_subject: {
  overlord_tag: row.starting_overlord_tag,
  overlord_name_zh: row.starting_overlord_tag ? locName(loc, row.starting_overlord_tag) : "",
  type: row.starting_subject_type,
  uses_overlord_color: row.starting_subject_uses_overlord_color === "是",
},
```

将三个原始字段加入国家 CSV 表头。

- [ ] **Step 4: 重建并检查数据。**

```powershell
node scripts/extract_vic3_countries.mjs --game-path "D:\SteamLibrary\steamapps\common\Victoria 3" --version 1.13.9 --out output_next --database database\vic3_1.13.9
node scripts/check_starting_subject_relationships.mjs
```

预期：两条命令退出码均为 `0`。

### Task 3: 传递关系字段到国家数据块

**Files:**

- Modify: `D:\Bot\Vic3\Victoria3_DB\scripts\build_wiki.mjs:289-330,360-400`
- Modify: `D:\Bot\Vic3\Victoria3_DB\scripts\check_data_chunking.mjs`
- Test: `D:\Bot\Vic3\Victoria3_DB\scripts\check_data_chunking.mjs`

- [ ] **Step 1: 在 `flattenDatabaseCountry` 的 `startingStates` 后添加字段。**

```js
startingOverlordTag: country.starting_subject?.overlord_tag || "",
startingOverlordName: country.starting_subject?.overlord_name_zh || "",
startingSubjectType: country.starting_subject?.type || "",
startingSubjectUsesOverlordColor: Boolean(country.starting_subject?.uses_overlord_color),
```

- [ ] **Step 2: 在旧扁平数据兼容路径的 `startingStates` 后添加字段。**

```js
startingOverlordTag: country.starting_overlord_tag || "",
startingOverlordName: country.starting_overlord_tag || "",
startingSubjectType: country.starting_subject_type || "",
startingSubjectUsesOverlordColor: country.starting_subject_uses_overlord_color === "是",
```

- [ ] **Step 3: 在数据分块检查中验证字段。**

```js
assert.equal(Boolean(siteData.countries.find((country) => country.tag === "BIC")?.startingOverlordTag), true, "country chunk should include the starting overlord tag");
assert.equal(siteData.countries.find((country) => country.tag === "KOR")?.startingSubjectUsesOverlordColor, false, "country chunk should preserve excluded subject types");
```

- [ ] **Step 4: 重建并运行分块检查。**

```powershell
node scripts/build_wiki.mjs --database database\vic3_1.13.9 --out site
node scripts/check_data_chunking.mjs
```

预期：两条命令退出码均为 `0`。

### Task 4: 设置与地图着色

**Files:**

- Modify: `D:\Bot\Vic3\Victoria3_DB\site\app.js:120-146,2049-2065,2347-2370,4109-4120,4498-4510,4760-4770`
- Modify: `D:\Bot\Vic3\Victoria3_DB\scripts\check_country_map_selection.mjs`
- Test: `D:\Bot\Vic3\Victoria3_DB\scripts\check_country_map_selection.mjs`

- [ ] **Step 1: 在状态中加入默认设置和全局搜索恢复 Tag。**

```js
subjectOverlordColors: true,
globalSearchColorRestoreTag: "",
```

- [ ] **Step 2: 在设置弹窗中加入复选框。**

```html
<label class="settings-toggle">
  <input id="subjectOverlordColorsSetting" type="checkbox"${state.subjectOverlordColors ? " checked" : ""}>
  <span>低级附属国显示为宗主国的颜色</span>
</label>
```

- [ ] **Step 3: 在 `bindSettingsControls` 中保存并重绘。**

```js
const subjectOverlordColors = container?.querySelector("#subjectOverlordColorsSetting");
subjectOverlordColors?.addEventListener("change", () => {
  state.subjectOverlordColors = subjectOverlordColors.checked;
  persistDisplaySetting("vicdata-subject-overlord-colors", state.subjectOverlordColors);
  render();
  renderInfoDialog();
});
```

- [ ] **Step 4: 载入显示设置时使用默认值 `true`。**

```js
state.subjectOverlordColors = readDisplaySetting("vicdata-subject-overlord-colors", true);
```

- [ ] **Step 5: 维护左侧搜索命中集合。**

在 `mapRuntime` 初始对象和重置函数中分别添加 `countrySearchMatchedTags: new Set()`。在 `renderCountryBoard` 的 `filtered` 创建后加入：

```js
mapRuntime.countrySearchMatchedTags = state.search
  ? new Set(filtered.map((country) => country.tag))
  : new Set();
```

- [ ] **Step 6: 维护全局搜索恢复 Tag。**

全局搜索的国家结果点击处理器在路由跳转前加入：

```js
state.globalSearchColorRestoreTag = result.raw.tag;
```

左侧搜索输入、普通国家列表点击、顶栏板块切换和 `applyHash` 的非全局搜索路径均加入：

```js
state.globalSearchColorRestoreTag = "";
```

普通列表点击不写入恢复 Tag。

- [ ] **Step 7: 将颜色状态加入国家地图缓存签名。**

```js
parts.push(`subject-overlord:${state.subjectOverlordColors ? 1 : 0}`);
parts.push(`search-match:${setSignature(mapRuntime.countrySearchMatchedTags)}`);
parts.push(`global-search:${state.globalSearchColorRestoreTag}`);
```

- [ ] **Step 8: 统一地图颜色规则。**

新增：

```js
function countryUsesOwnMapColor(owner, ownerTag) {
  return mapRuntime.countrySearchMatchedTags.has(ownerTag)
    || state.globalSearchColorRestoreTag === ownerTag
    || !state.subjectOverlordColors
    || !owner?.startingSubjectUsesOverlordColor;
}
```

在 `countryOwnerMapColor` 中的松散政权处理后、自身颜色回退前加入：

```js
if (!countryUsesOwnMapColor(owner, ownerTag)) {
  const overlord = byTag.get(owner.startingOverlordTag);
  if (overlord?.colorHex) return overlord.colorHex;
}
```

`mapPixelColor` 改为调用 `countryOwnerMapColor(owner, ownerTag)`，删除重复的筛选与松散政权颜色判断。

- [ ] **Step 9: 扩展国家地图契约检查。**

断言 `subjectOverlordColors: true`、`subjectOverlordColorsSetting`、`vicdata-subject-overlord-colors`、`countrySearchMatchedTags`、`globalSearchColorRestoreTag`、`startingSubjectUsesOverlordColor`、`startingOverlordTag`、`countryUsesOwnMapColor` 和三项缓存签名存在。断言 `countryOwnerMapColor` 先处理筛选变灰，再按宗主国 Tag 查询颜色。

- [ ] **Step 10: 执行回归检查。**

```powershell
node scripts/check_starting_subject_relationships.mjs
node scripts/check_data_chunking.mjs
node scripts/check_country_map_selection.mjs
node scripts/check_about_page.mjs
node --check site/app.js
git diff --check
```

预期：全部命令退出码为 `0`。

### Task 5: 浏览器核验与提交

**Files:**

- Modify: 无
- Test: `D:\Bot\Vic3\Victoria3_DB\site\index.html`

- [ ] **Step 1: 打开 `http://127.0.0.1:8876/index.html#/country` 并核对默认颜色。**

确认 `BIC` 使用英国颜色、`TIB` 使用清朝颜色、`TRI` 使用奥斯曼颜色、`HUN` 使用奥地利颜色；`ABU` 等受保护国和 `KOR` 等朝贡国保持自身颜色。

- [ ] **Step 2: 打开设置，关闭新开关后确认低级附属国恢复自身颜色，再重新开启。**

确认设置弹窗保持当前哈希路由；刷新页面后设置值保留。

- [ ] **Step 3: 在左侧国家搜索框依次输入 `西藏` 和 `BIC`。**

确认对应地图区域恢复自身颜色；清空搜索后恢复宗主国颜色。

- [ ] **Step 4: 通过全局搜索打开 `西藏` 与 `东印度（英属）`。**

确认打开后的目标国家使用自身颜色。随后从普通国家列表点击同一国家，确认点击不会使附属国恢复自身颜色。

- [ ] **Step 5: 检查控制台无错误并提交。**

```powershell
git add scripts/extract_vic3_countries.mjs scripts/build_wiki.mjs scripts/check_starting_subject_relationships.mjs scripts/check_data_chunking.mjs scripts/check_country_map_selection.mjs site/app.js database/vic3_1.13.9 site/versions/1.13.9 docs/superpowers/plans/2026-07-17-subject-overlord-map-colors.md
git commit -m "feat: color subjects by overlord"
```
