# Vicdata 数据分块加载 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将单个约 50 MiB 的 `data.js` 拆为轻量索引和按资料板块加载的数据块，同时保持现有路由、搜索和详情页的数据结构。

**Architecture:** `scripts/build_wiki.mjs` 写出 `data-index.js`，其中包含元数据、各板块数量和数据块清单；每个数据块以 `window.VIC3_DATA_CHUNK` 暴露其原有字段。`site/app.js` 按当前路由及用户打开全局搜索时加载所需块，并将字段合并回运行时 `data`，随后重建依赖这些字段的索引和筛选项。国家数据与其附属成立、释放、动态名称和地图颜色规则同属国家块，避免初始请求 41.7 MiB 的国家记录。

**Tech Stack:** 原生浏览器 JavaScript、Node.js、现有静态检查脚本。

---

### Task 1: 数据构建与发布清单

**Files:**
- Modify: `scripts/build_wiki.mjs`
- Create: `scripts/check_data_chunking.mjs`
- Modify: `scripts/check_publish_bundle.mjs`

- [ ] **Step 1: 写出失败的构建产物检查**

```js
assert(fs.existsSync(path.join(versionDir, "data-index.js")), "missing data index");
assert(fs.existsSync(path.join(versionDir, "data-countries.js")), "missing country data chunk");
assert(index.chunks.country.keys.includes("countries"), "country chunk must expose countries");
```

- [ ] **Step 2: 执行检查并确认失败**

Run: `node scripts/check_data_chunking.mjs`

Expected: FAIL because the current output only has `data.js`.

- [ ] **Step 3: 输出索引和六类数据块**

```js
const chunks = {
  country: ["countries", "dynamicCountryNameVariants", "dynamicCountryMapColorRules", "formables", "releasables"],
  culture: ["cultures", "cultureTraits", "cultureTraitGroups"],
  region: ["stateRegions", "strategicRegions", "geographicRegions"],
  company: ["companies", "companyCharterTypes"],
  ideology: ["interestGroups", "interestGroupTraits", "ideologies"],
  law: ["laws", "lawGroups"],
};
```

- [ ] **Step 4: 重新生成 `site/versions/1.13.9` 并确认检查通过**

Run: `node scripts/build_wiki.mjs --out site/versions/1.13.9 && node scripts/check_data_chunking.mjs`

Expected: PASS with index and six chunks.

### Task 2: 按路由加载数据块

**Files:**
- Modify: `site/versions.js`
- Modify: `site/app.js`
- Modify: `scripts/check_data_chunking.mjs`

- [ ] **Step 1: 写出失败的加载契约**

```js
assert(/ensureDataChunksForRoute/.test(appSource), "app must select chunks from the current route");
assert(/data-index\.js/.test(versionSource), "version entry must point to the data index");
assert(/openGlobalSearch[\s\S]*ensureDataChunks/.test(appSource), "global search must load every searchable chunk");
```

- [ ] **Step 2: 执行检查并确认失败**

Run: `node scripts/check_data_chunking.mjs`

Expected: FAIL because the current application loads a complete dataset before initialization.

- [ ] **Step 3: 以索引初始化，并在路由变化前合并所需块**

```js
async function ensureDataChunks(keys) {
  const pending = keys.filter((key) => !loadedDataChunks.has(key));
  await Promise.all(pending.map(loadDataChunk));
  rebuildDatasetIndexes();
}
```

- [ ] **Step 4: 运行加载契约检查**

Run: `node scripts/check_data_chunking.mjs`

Expected: PASS and the home route requires no country chunk.

### Task 3: 现有检查与浏览器回归

**Files:**
- Modify: `scripts/check_publish_bundle.mjs`
- Modify: `WORKLOG.md`

- [ ] **Step 1: 更新发布检查以读取索引和所有块**

```js
for (const chunk of Object.values(index.chunks)) {
  addRequired(chunk.file);
  Object.assign(data, readChunk(path.join(versionDir, chunk.file)));
}
```

- [ ] **Step 2: 执行静态检查**

Run: `node --check site/app.js && node scripts/check_data_chunking.mjs && node scripts/check_publish_bundle.mjs && node scripts/check_region_map_interaction.mjs && node scripts/check_global_search.mjs && node scripts/check_law_board.mjs && git diff --check`

Expected: 全部通过。

- [ ] **Step 3: 在浏览器确认实际请求与路由**

确认首页只取得数据索引；进入 `#/country` 后才取得 `data-countries.js`；进入 `#/region` 后取得 `data-regions.js`；全局搜索完成后可检索国家、文化、公司和意识形态。

- [ ] **Step 4: 追加工作记录**

记录数据块清单、首页避免的国家数据请求、验证网址和检查命令。
