# 成就国家关联 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从原版 1.13.9 成就脚本提取直接国家标签，在成就详情页显示可点击的关联国家，并支持以国家中文名或标签搜索成就。

**Architecture:** 提取器在国家行已生成后，扫描每项成就的 `possible` 和 `happened` 序列化脚本中的 `c:TAG`，生成按标签排序且去重的 `related_countries`。站点构建器原样发布该字段；成就模块负责搜索和详情区块，点击国家按钮通过既有国家路由异步加载国家数据并渲染国家详情。

**Tech Stack:** Node.js ES modules、Victoria 3 原版 1.13.9 本地脚本、原生浏览器 JavaScript、CSS、既有原生 Chrome CDP 浏览器检查。

---

## 文件职责

| 文件 | 职责 |
| --- | --- |
| `scripts/extract_vic3_countries.mjs` | 从 `c:TAG` 脚本引用构建每项成就的 `related_countries`，并验证标签能对应国家资料。 |
| `scripts/check_achievement_database.mjs` | 校验关联数据结构、66 项关联成就、48 个独立标签、国家中文名和脚本文本的对应关系。 |
| `site/app/achievements.js` | 将关联国家加入搜索字段，渲染详情区块，并处理国家详情跳转。 |
| `site/styles/achievements.css` | 定义关联国家按钮的换行、对比与悬停样式。 |
| `scripts/check_achievement_board_contract.mjs` | 校验发布的成就数据和前端模块包含国家关联契约。 |
| `scripts/check_achievement_board_browser.mjs` | 验证关联国家显示、国家详情跳转、无关联成就的隐藏行为和两种国家搜索方式。 |
| `site/versions/1.13.9/data-achievements.js` | 由构建器重新生成，发布 `related_countries` 字段。 |

### Task 1: 提取并发布可复查的关联国家数据

**Files:**

- Modify: `scripts/extract_vic3_countries.mjs:179-184,287-336,1590-1656`
- Modify: `scripts/check_achievement_database.mjs:14-78`
- Modify: `site/versions/1.13.9/data-achievements.js`（生成文件）
- Test: `scripts/check_achievement_database.mjs`

- [ ] **Step 1: 先写会失败的关联数据校验**

在 `scripts/check_achievement_database.mjs` 中，读取 `countries.json` 并在成就循环后加入下列校验。现有资料没有 `related_countries` 时，第一条断言必须失败。

```js
const countries = readJson(path.join(databaseDir, index.files.countries));
const countryNameByTag = new Map(countries.map((country) => [country.tag, country.name?.zh]));

const relatedAchievements = achievements.filter((achievement) => achievement.related_countries.length);
assert.equal(relatedAchievements.length, 66, "66 achievements must have direct country references");
assert.equal(new Set(relatedAchievements.flatMap((achievement) => achievement.related_countries.map((country) => country.tag))).size, 48, "direct country references must cover 48 country tags");

for (const achievement of achievements) {
  assert(Array.isArray(achievement.related_countries), `${achievement.key} related_countries must be an array`);
  const directTags = [...new Set(`${achievement.script.possible || ""}\n${achievement.script.happened}`.match(/\bc:([A-Z]{3})\b/g) || [])]
    .map((value) => value.slice(2))
    .sort();
  assert.deepEqual(achievement.related_countries.map((country) => country.tag), directTags, `${achievement.key} must retain only direct c:TAG references`);
  for (const country of achievement.related_countries) {
    assert.equal(country.name_zh, countryNameByTag.get(country.tag), `${achievement.key} ${country.tag} must use the database country name`);
  }
}
```

运行：

```powershell
node scripts/check_achievement_database.mjs
```

预期：失败，提示成就记录缺少 `related_countries`。

- [ ] **Step 2: 在国家行生成后附加国家引用**

在 `scripts/extract_vic3_countries.mjs` 中，紧跟 `countryRows` 创建之后、传入 `writeDatabase(...)` 之前调用：

```js
attachAchievementCountryReferences(achievements, countryRows);
```

在 `loadAchievements(...)` 后新增下列函数。它只扫描 `possible` 和 `happened` 字段中完整的 `c:TAG` 记号，按标签排序去重；任一标签未出现在已生成国家行中时立即报错。

```js
function attachAchievementCountryReferences(achievements, countryRows) {
  const countryNameByTag = new Map(countryRows.map((country) => [country.tag, country.name_zh]));
  for (const achievement of achievements) {
    const tags = [...new Set(`${achievement.script.possible || ""}\n${achievement.script.happened}`.match(/\bc:([A-Z]{3})\b/g) || [])]
      .map((value) => value.slice(2))
      .sort();
    achievement.related_countries = tags.map((tag) => {
      const name_zh = countryNameByTag.get(tag);
      if (!name_zh) throw new Error(`achievement country reference has no country record: ${achievement.key} -> ${tag}`);
      return { tag, name_zh };
    });
  }
}
```

不要从 `name_zh`、`description_zh`、`details`、`source_file` 或脚本注释提取国家名称。`related_countries` 必须在所有 141 项成就中存在，未引用国家的记录使用空数组。

- [ ] **Step 3: 重新生成资料库和发布分块**

运行：

```powershell
node scripts/extract_vic3_countries.mjs --game-path "D:\SteamLibrary\steamapps\common\Victoria 3" --version 1.13.9 --out output\vic3_1.13.9 --database database\vic3_1.13.9
node scripts/build_wiki.mjs --database database\vic3_1.13.9 --out site\versions\1.13.9
node scripts/check_achievement_database.mjs
```

预期：数据库校验输出 `{"achievement_database":"ok","achievements":141}`；`site/versions/1.13.9/data-achievements.js` 的每项记录均有 `related_countries`，其中 66 项非空、48 个标签均存在于 `countries.json`。

- [ ] **Step 4: 提交数据层**

运行：

```powershell
git add scripts/extract_vic3_countries.mjs scripts/check_achievement_database.mjs site/versions/1.13.9/data-achievements.js
git commit -m "feat: add achievement country references"
```

预期：提交只包含提取器、数据库校验和重新生成的成就分块；`database/` 与 `output/` 保持忽略，不进入提交。

### Task 2: 在成就详情与搜索中使用国家关联

**Files:**

- Modify: `site/app/achievements.js:10-18,85-109`
- Modify: `site/styles/achievements.css:194-201`
- Modify: `scripts/check_achievement_board_contract.mjs:16-46`
- Modify: `scripts/check_achievement_board_browser.mjs:44-71`
- Test: `scripts/check_achievement_board_contract.mjs`
- Test: `scripts/check_achievement_board_browser.mjs`

- [ ] **Step 1: 先增加会失败的前端契约与浏览器验收**

在 `scripts/check_achievement_board_contract.mjs` 的成就记录循环中加入：

```js
assert(Array.isArray(achievement.related_countries), `${achievement.key} must publish related countries`);
```

并新增：

```js
assert.match(app, /achievement\.related_countries/, "achievement search and detail must consume related countries");
assert.match(app, /data-achievement-country/, "achievement detail must render country route controls");
assert.match(app, /replaceHash\(`\/country\/\$\{encodeURIComponent\(tag\)\}`\)/, "achievement country controls must route to country details");
```

在 `scripts/check_achievement_board_browser.mjs` 中，选中 `achievement_it_never_ends` 后断言出现内容为“法兰西”的 `[data-achievement-country="FRA"]`，点击后等待 `location.hash === "#/country/FRA"`。另以 `#/achievement/victorian_century` 打开没有 `c:TAG` 的成就并断言不存在 `.achievement-related-countries`。回到 `#/achievement` 后，分别输入“法兰西”和“FRA”、按普通回车，断言两次结果都含有 `achievement_it_never_ends`。

运行：

```powershell
node scripts/check_achievement_board_contract.mjs
```

预期：失败，提示前端尚未消费 `related_countries` 或尚未渲染国家路由控件。

- [ ] **Step 2: 将国家中文名和标签加入搜索文本**

在 `site/app/achievements.js` 的 `achievementMatches(...)` 数组末尾加入：

```js
...(achievement.related_countries || []).flatMap((country) => [country.name_zh, country.tag]),
```

保持既有输入后回车提交、输入法组词保护和插入点恢复逻辑不变。字段为空数组时搜索逻辑必须与当前成就一致。

- [ ] **Step 3: 渲染合并的关联国家区块并接入既有国家路由**

在 `renderAchievementDetail(...)` 中、原始脚本 `details` 之前创建：

```js
const relatedCountries = achievement.related_countries || [];
const relatedCountriesHtml = relatedCountries.length
  ? `<section class="achievement-related-countries"><h3>关联国家</h3><div>${relatedCountries.map(({ tag, name_zh }) => `<button type="button" data-achievement-country="${escapeHtml(tag)}">${escapeHtml(name_zh)}</button>`).join("")}</div></section>`
  : "";
```

将 `${relatedCountriesHtml}` 放在“达成条件”区块之后、`<details open>` 之前。成就详情构建完成后绑定：

```js
els.detail.querySelectorAll("[data-achievement-country]").forEach((button) => {
  button.addEventListener("click", async () => {
    const tag = button.dataset.achievementCountry;
    replaceHash(`/country/${encodeURIComponent(tag)}`);
    await applyHash();
    render();
  });
});
```

这里不可调用 `openCountryDetail(tag)`，因为成就页初始只加载成就分块，`byTag` 尚未构建。`applyHash()` 会先按 `#/country/<TAG>` 加载国家分块，再由现有国家路由渲染详情。

- [ ] **Step 4: 添加成就模块专用的国家按钮样式**

在 `site/styles/achievements.css` 中加入：

```css
.achievement-related-countries { display: grid; gap: 6px; }
.achievement-related-countries > div { display: flex; flex-wrap: wrap; gap: 7px; }
.achievement-related-countries button { min-height: 30px; padding: 4px 9px; border: 1px solid rgba(200, 164, 91, .45); background: rgba(0, 0, 0, .18); color: var(--ink); cursor: pointer; }
.achievement-related-countries button:hover,
.achievement-related-countries button:focus-visible { border-color: var(--accent); background: rgba(200, 164, 91, .12); }
```

不增加国家旗帜、国家类别或脚本角色标签；没有关联国家时不创建区块，也不保留空白。

- [ ] **Step 5: 运行真实浏览器检查并提交前端**

运行：

```powershell
$server = Start-Process -FilePath python -ArgumentList '-m','http.server','4174','--directory','D:\Bot\Vic3\Victoria3_DB\.worktrees\codex\achievements-data' -WindowStyle Hidden -PassThru
node scripts/check_achievement_board_contract.mjs
node scripts/check_achievement_board_browser.mjs http://127.0.0.1:4174/site/index.html
Stop-Process -Id $server.Id -Force
node --check site/app/achievements.js
node --check scripts/check_achievement_board_browser.mjs
git diff --check
```

预期：契约检查与浏览器检查均输出 `ok`；浏览器检查确认“法兰西”按钮进入 `#/country/FRA`，无关联的“维多利亚世纪”不显示关联国家区块，国家中文名和标签均能筛选到法国关联成就。

- [ ] **Step 6: 提交前端与回归检查**

运行：

```powershell
git add site/app/achievements.js site/styles/achievements.css scripts/check_achievement_board_contract.mjs scripts/check_achievement_board_browser.mjs
git commit -m "feat: link achievements to related countries"
```

预期：提交只包含成就详情、样式和相应验收脚本。

### Task 3: 完整验证与交付检查

**Files:**

- Verify: `scripts/check_achievement_database.mjs`
- Verify: `scripts/check_data_chunking.mjs`
- Verify: `scripts/check_frontend_file_split.mjs`
- Verify: `scripts/check_achievement_board_contract.mjs`
- Verify: `scripts/check_achievement_board_browser.mjs`

- [ ] **Step 1: 运行完整的本任务回归集**

运行：

```powershell
node scripts/check_achievement_database.mjs
node scripts/check_data_chunking.mjs
node scripts/check_frontend_file_split.mjs
node scripts/check_achievement_board_contract.mjs
$server = Start-Process -FilePath python -ArgumentList '-m','http.server','4174','--directory','D:\Bot\Vic3\Victoria3_DB\.worktrees\codex\achievements-data' -WindowStyle Hidden -PassThru
node scripts/check_achievement_board_browser.mjs http://127.0.0.1:4174/site/index.html
Stop-Process -Id $server.Id -Force
git diff --check
git status --short
```

预期：所有四项静态检查和浏览器检查通过，`git diff --check` 无输出，工作树干净。`scripts/check_publish_bundle.mjs` 不作为本任务通过条件：该工作树缺少 Victorian Century 独立站文件，且公告数据已有陈旧问题；若运行，应单独报告这两项非本任务失败。

- [ ] **Step 2: 检查提交边界**

运行：

```powershell
git log --oneline main..HEAD
git diff --stat main...HEAD
```

预期：新增两次功能提交，分别覆盖关联数据与成就详情，不包含未授权的合并、推送或发布操作。
