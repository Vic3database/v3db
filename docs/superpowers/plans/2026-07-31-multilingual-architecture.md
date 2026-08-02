# Vicdata 可扩展多语言实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立结构数据与语言包分离的多语言系统，首批完整支持简体中文和英语，并让国家、文化、地区、公司、意识形态、法律、科技、成就八个板块及公共界面统一使用可扩展的本地化接口。

**Architecture:** 抽取器以相同游戏结构分别生成 `zh-Hans` 与 `en` 的本地化投影，再通过稳定的对象编号和字段名拆出数据库语言包；网页构建器只发布结构分块、按“语言与板块”组织的语言分块，以及同时包含中英文名称和内部键的搜索索引。前端新增独立的本地化运行时，统一处理语言选择、词典加载、字段解析、模板、排序、回退和切换事务；现有板块按组迁移，全部完成后删除固定中文字段与兼容层。

**Tech Stack:** Node.js、原生 JavaScript 全局脚本、HTML、CSS、Victoria 3 YAML 本地化文件、Node.js `assert`、Playwright、SHA-256 内容校验。

---

## 文件结构

新增 `scripts/lib/localization-schema.mjs`，负责稳定本地化编号、结构与译文拆分、文本模板引用、语言包引用收集及 SHA-256；新增 `scripts/locales/extractor.zh-Hans.mjs` 与 `scripts/locales/extractor.en.mjs`，维护游戏文件之外的抽取期枚举和模板。`scripts/extract_vic3_countries.mjs` 生成数据库结构文件、`locales/zh-Hans.json`、`locales/en.json` 与含缺失统计的索引；`scripts/build_wiki.mjs` 将数据库结构转换为网页结构分块，并生成 `locale-<语言>-<板块>.js`、`search-index.js` 和语言清单。

新增 `site/locales/manifest.js`、`site/locales/ui.zh-Hans.js` 与 `site/locales/ui.en.js`，保存站点界面词典；新增 `site/app/i18n.js`，负责网址和本地记录的语言选择、语言包事务、字段与模板求值、排序区域和回退。`site/app/runtime.js` 只保存当前语言状态和已加载语言分块，`site/app/data.js` 负责按板块请求结构与语言文件，其他现有前端文件继续承担各自的板块呈现职责。Victorian Century 生成站复制同一套前端和界面词典，加载自己的结构及语言分块。

新增的检查文件为 `scripts/check_localization_schema.mjs`、`scripts/check_multilingual_database.mjs`、`scripts/check_multilingual_bundles.mjs`、`scripts/check_multilingual_runtime.mjs`、`scripts/check_multilingual_ui_contracts.mjs`、`scripts/check_multilingual_board_contracts.mjs`、`scripts/check_multilingual_legacy_fields.mjs` 与 `scripts/check_multilingual_browser.mjs`。原有 `check_data_chunking.mjs`、`check_publish_bundle.mjs`、`check_global_search.mjs`、`check_victorian_century_standalone_site.mjs` 和有关板块的合同检查同步适配新结构。

## 实施任务

**任务一：建立结构与语言包拆分协议**

**涉及文件：** 创建 `scripts/lib/localization-schema.mjs`、`scripts/check_localization_schema.mjs`。

- [ ] **步骤一：先写失败的协议检查。** 在 `scripts/check_localization_schema.mjs` 中构造含普通字段、嵌套引用、固定语言字段和模板的样本，并明确最终结构及两个语言包：

  ```js
  import assert from "node:assert/strict";
  import { splitLocalizedTrees, collectLocalizationRefs, textTemplate } from "./lib/localization-schema.mjs";

  const zh = [{ id: "country:PRU", tag: "PRU", name_zh: "普鲁士", capital: { id: "state_region:STATE_BRANDENBURG", key: "STATE_BRANDENBURG", name_zh: "勃兰登堡" } }];
  const en = [{ id: "country:PRU", tag: "PRU", name_zh: "Prussia", capital: { id: "state_region:STATE_BRANDENBURG", key: "STATE_BRANDENBURG", name_zh: "Brandenburg" } }];
  const result = splitLocalizedTrees({ "zh-Hans": zh, en });
  assert.deepEqual(result.structure, [{
    id: "country:PRU",
    tag: "PRU",
    loc: { name: "country:PRU.name" },
    capital: {
      id: "state_region:STATE_BRANDENBURG",
      key: "STATE_BRANDENBURG",
      loc: { name: "state_region:STATE_BRANDENBURG.name" },
    },
  }]);
  assert.equal(result.catalogs.en["country:PRU.name"], "Prussia");
  assert.equal(result.catalogs["zh-Hans"]["state_region:STATE_BRANDENBURG.name"], "勃兰登堡");
  assert.deepEqual(textTemplate("template.modifierSummary", { name: { message: "modifier:authority.name" }, value: "+10%" }), {
    template: "template.modifierSummary",
    args: { name: { message: "modifier:authority.name" }, value: "+10%" },
  });
  assert.deepEqual([...collectLocalizationRefs(result.structure)].sort(), ["country:PRU.name", "state_region:STATE_BRANDENBURG.name"]);
  console.log("localization_schema: ok");
  ```

- [ ] **步骤二：运行检查并确认缺少模块。** 执行 `node scripts/check_localization_schema.mjs`。预期退出码非零，错误包含 `ERR_MODULE_NOT_FOUND`。

- [ ] **步骤三：实现稳定编号和拆分函数。** `scripts/lib/localization-schema.mjs` 导出下列接口。数组元素优先使用 `id`，其次使用 `key` 或 `tag`；没有稳定字段的元素使用父路径与索引。`name.zh`、`name_zh`、`name_en`、`desc_zh`、`description_zh`、`type_zh`、`group_name_zh`、`source_name_zh`、`label_zh`、`summary_zh`、`value_zh`、`adjective_zh` 等已审计字段统一转换为中性字段名，并写入对象的 `loc` 映射：

  ```js
  import crypto from "node:crypto";

  export const SUPPORTED_LOCALES = Object.freeze(["zh-Hans", "en"]);

  export function textTemplate(template, args = {}) {
    return { template, args };
  }

  export function localizationObjectId(value, parentId, index) {
    if (value?.id) return String(value.id);
    if (value?.key) return `${parentId || "item"}:${value.key}`;
    if (value?.tag) return `${parentId || "country"}:${value.tag}`;
    return `${parentId || "item"}:${index}`;
  }

  export function sha256Text(value) {
    return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
  }

  export function localizationId(objectId, field) {
    return `${objectId}.${field}`;
  }
  ```

  `splitLocalizedTrees()` 必须先验证各语言投影去除本地化字段后的结构一致，再返回 `{ structure, catalogs, missing }`；出现结构差异时抛出包含 JSON 路径与语言的错误。含稳定 `id`、`key` 或 `tag` 的数组按稳定编号对齐，并以简体中文投影的结构顺序输出，不能因两种语言的名称排序不同而误报结构差异；语义上无序的字符串数组在抽取阶段按内部键排序，没有稳定编号且顺序具有含义的数组要求两种投影完全一致。空字符串记入语言缺失统计，不能悄悄写成另一语言。

- [ ] **步骤四：运行协议检查。** 执行 `node scripts/check_localization_schema.mjs`。预期输出 `localization_schema: ok`。

- [ ] **步骤五：提交协议与检查。** 执行：

  ```powershell
  git add scripts/lib/localization-schema.mjs scripts/check_localization_schema.mjs
  git commit -m "test: define multilingual data schema"
  ```

**任务二：让抽取器生成双语数据库与结构化模板**

**涉及文件：** 创建 `scripts/locales/extractor.zh-Hans.mjs`、`scripts/locales/extractor.en.mjs`、`scripts/check_multilingual_database.mjs`；修改 `scripts/extract_vic3_countries.mjs`、`scripts/check_localization_gaps.mjs`、`scripts/fix_localization_gaps.mjs`、`scripts/check_localized_terminology.mjs`。

- [ ] **步骤一：先写数据库失败检查。** `scripts/check_multilingual_database.mjs` 接受 `--database`，读取 `index.json`、`locales/zh-Hans.json`、`locales/en.json`，递归拒绝结构文件中的 `name_zh`、`name_en`、`desc_zh`、`description_zh`、`summary_zh`、`type_zh` 等固定语言字段。用以下样本确认八个板块都有两种名称：

  ```js
  const samples = [
    ["countries", "country:PRU", "Prussia"],
    ["cultures", "culture:north_german", "North German"],
    ["state_regions", "state_region:STATE_BRANDENBURG", "Brandenburg"],
    ["companies", "company:company_a_markwald_and_company", "A. Markwald & Company, Ltd."],
    ["ideologies", "ideology:ideology_laissez_faire", "Laissez-Faire"],
    ["laws", "law:law_professional_army", "Professional Army"],
    ["technologies", "technology:academia", "Academia"],
    ["achievements", "achievement:victorian_century", "Victorian Century"],
  ];
  for (const [collection, id, expectedEnglish] of samples) {
    const row = database[collection].find((item) => item.id === id);
    assert(row?.loc?.name, `${id} lacks a name localization reference`);
    assert.equal(en[row.loc.name], expectedEnglish);
    assert(zh[row.loc.name] && zh[row.loc.name] !== row.loc.name, `${id} lacks simplified Chinese`);
  }
  ```

  同一检查断言 `index.locales.supported` 为 `['zh-Hans', 'en']`，每种语言包含文件路径、SHA-256 和分板块缺失数。

- [ ] **步骤二：运行检查并确认当前数据库失败。** 执行 `node scripts/check_multilingual_database.mjs --database database/vic3_1.13.9`。预期报告缺少 `index.locales` 和 `locales/en.json`。

- [ ] **步骤三：建立抽取期站内词典。** 两个 `extractor.*.mjs` 文件导出同一组键。至少包含国家位阶、国家类型、文化特质类型、科技类别、地理区域组、修正类别、条件连接词和抽取器自行生成的说明。模板使用命名参数，例如：

  ```js
  export default Object.freeze({
    "enum.tier.principality": "Principality",
    "enum.countryType.recognized": "Recognized Power",
    "enum.cultureTrait.heritage": "Heritage",
    "enum.technology.production": "Production",
    "template.modifierSummary": "{name} {value}",
    "template.condition.country": "Country: {values}",
    "template.condition.technology": "Technology: {values}",
    "template.condition.journal": "Journal Entry: {values}",
    "template.condition.join": "{values}",
    "template.condition.other": "Other conditions",
    "template.condition.default": "Default",
    "template.condition.script": "Script condition",
  });
  ```

  简体中文文件使用相同键以及“公国”“受认可”“传承”“生产”“国家：{values}”“科技：{values}”“日志条目：{values}”“其他情况”“默认”“脚本条件”等现有术语。

- [ ] **步骤四：将单语言主流程提取为可复用函数。** 在 `scripts/extract_vic3_countries.mjs` 中把当前 `main()` 内从加载结构到组装数据库对象的逻辑移入 `extractDataset({ localeId, loc, ui })`。入口按原版在前、模组在后的现有 `contentPath()` 规则为两种语言建立本地化表：

  ```js
  const localeDefinitions = [
    { id: "zh-Hans", directory: "simp_chinese", ui: extractorZhHans },
    { id: "en", directory: "english", ui: extractorEnglish },
  ];
  const projections = Object.fromEntries(localeDefinitions.map((locale) => [
    locale.id,
    extractDataset({
      localeId: locale.id,
      loc: loadLocalization(contentPath("localization", locale.directory)),
      ui: locale.ui,
    }),
  ]));
  const split = splitLocalizedTrees(projections);
  writeDatabase(databaseDir, split.structure, split.catalogs, split.missing);
  ```

  原有结构解析允许每种语言各执行一次，以降低首次改造复杂度。两次投影去除本地化字段后必须完全相同；结构不同立即终止生成。

- [ ] **步骤五：把组合文字改成模板与参数。** `modifierRef()` 保留数值和本地化名称引用，将 `summary_zh` 改为 `summary_text`：

  ```js
  return {
    key,
    loc: { name: localizationId(`modifier:${key}`, "name") },
    value: numericValue,
    value_raw: rawValue,
    value_display: formatModifierValue(key, numericValue, rawValue),
    summary_text: textTemplate("template.modifierSummary", {
      name: { message: localizationId(`modifier:${key}`, "name") },
      value: formatModifierValue(key, numericValue, rawValue),
    }),
    category: modifierCategory(key),
  };
  ```

  条件摘要返回由 `template.condition.*` 和实体本地化引用组成的 `summary_text`，同时保留 `condition_raw`。`tierZh`、`countryTypeZh`、`technologyCategoryZh`、`geographicRegionGroupLabels`、`specialCountryMechanics`、`knownFlavorDefinitionHints`、修正类别和“基础默认/风味规则”等硬编码文字全部改为站内词典键或模板参数。

- [ ] **步骤六：写出数据库结构和语言索引。** `writeDatabase()` 将原有集合文件写成 `split.structure` 对应结构，同时写入两个语言 JSON。索引格式固定为：

  ```js
  locales: {
    default: "en",
    supported: ["zh-Hans", "en"],
    files: {
      "zh-Hans": { file: "locales/zh-Hans.json", sha256: zhHash, missing: zhMissing },
      en: { file: "locales/en.json", sha256: enHash, missing: enMissing },
    },
  }
  ```

  兼容 CSV 和说明文件可以从简体中文投影生成，但 JSON 结构不得再包含固定语言字段。

- [ ] **步骤七：改造本地化维护脚本。** `check_localization_gaps.mjs` 改为读取索引中的两个语言文件，分别报告 `zh-Hans`、`en` 和两者同时缺失的消息编号；`check_localized_terminology.mjs` 通过结构记录的 `loc` 引用读取简体中文词典。`fix_localization_gaps.mjs` 只允许修复指定语言包中的消息，不能再向结构对象写入 `name_zh`；命令必须显式传入 `--locale zh-Hans` 或 `--locale en`，并在写入后更新索引内的 SHA-256 和缺失数。

- [ ] **步骤八：重建临时数据库并执行检查。** 使用新的临时目录，避免在检查完成前覆盖现有本地数据库：

  ```powershell
  $multiDb = Join-Path $env:TEMP 'vicdata-multilingual-db'
  $multiOut = Join-Path $env:TEMP 'vicdata-multilingual-output'
  node scripts/extract_vic3_countries.mjs --game-path "D:\SteamLibrary\steamapps\common\Victoria 3" --version 1.13.9 --out $multiOut --database $multiDb
  node scripts/check_multilingual_database.mjs --database $multiDb
  ```

  预期输出 `multilingual_database: ok`、`locales: ["zh-Hans","en"]` 和八个样本。随后以相同命令把正式目标改为 `output/vic3_1.13.9` 与 `database/vic3_1.13.9`。

- [ ] **步骤九：运行本地化维护检查。** 执行：

  ```powershell
  node scripts/check_localization_gaps.mjs --databases database/vic3_1.13.9
  node scripts/check_localized_terminology.mjs
  node scripts/fix_localization_gaps.mjs --help
  ```

  第一项必须输出分语言缺失统计，第二项按现有术语合同通过，第三项说明中必须列出必填的 `--locale`，且不执行任何写入。

- [ ] **步骤十：提交抽取器与检查。** 数据库和输出目录受 `.gitignore` 管理，不纳入提交：

  ```powershell
  git add scripts/extract_vic3_countries.mjs scripts/lib/localization-schema.mjs scripts/locales scripts/check_multilingual_database.mjs scripts/check_localization_gaps.mjs scripts/fix_localization_gaps.mjs scripts/check_localized_terminology.mjs
  git commit -m "feat: extract structured bilingual localization"
  ```

**任务三：生成网页结构分块、语言分块和双语搜索索引**

**涉及文件：** 创建 `scripts/check_multilingual_bundles.mjs`；修改 `scripts/build_wiki.mjs`、`scripts/site_data_reader.mjs`；在临时目录生成 `data-*.js`、`locale-*.js`、`search-index.js`，本任务不替换仍由旧前端使用的正式网页数据。

- [ ] **步骤一：先写失败的网页语言包检查。** 检查 `data-index.js` 中存在 `locales`，结构分块不含固定语言字段，语言分块把内容写入按分块编号索引的 `window.VIC3_LOCALE_CHUNKS`，搜索索引定义 `window.VIC3_SEARCH_INDEX`。对八个板块断言简体中文和英语文件存在、SHA-256 匹配、引用键完整：

  ```js
  for (const locale of ["zh-Hans", "en"]) {
    for (const board of ["country", "culture", "region", "company", "ideology", "law", "technology", "achievement"]) {
      const entry = index.locales.chunks[locale][board];
      assert(entry?.files?.length, `missing ${locale}/${board} locale files`);
      for (const file of entry.files) assertFileHash(versionDir, file.path, file.sha256);
    }
  }
  assert.deepEqual(
    search.entries.find((entry) => entry.kind === "country" && entry.key === "PRU"),
    { kind: "country", id: "country:PRU", key: "PRU", names: { "zh-Hans": "普鲁士", en: "Prussia" } },
  );
  ```

- [ ] **步骤二：运行检查并确认当前构建失败。** 执行 `node scripts/check_multilingual_bundles.mjs --site-version site/versions/1.13.9`。预期报告 `data-index.js` 缺少 `locales`。

- [ ] **步骤三：让网页构建器读取数据库语言文件。** `loadSiteData()` 同时读取 `sourceData.locales.files`，构造 `databaseMessagesByLocale`。原有 `flattenDatabaseCountry()`、`deriveCultureRecords()` 和其他派生函数通过 `message(entity, field, locale)` 获取需要参与排序或歧义处理的文字，但输出只保留 `loc` 引用和中性结构。`BIC`、`DEI` 的站点歧义名称注册为 `country:BIC.displayName` 与 `country:DEI.displayName`，分别在两种语言中生成“东印度（英属）/East India (British)”和“东印度（荷属）/East India (Dutch)”。

  ```js
  function message(entity, field, locale) {
    const key = entity?.loc?.[field] || "";
    return databaseMessagesByLocale[locale]?.[key] || key;
  }

  function setDerivedMessage(messagesByLocale, id, values) {
    for (const locale of ["zh-Hans", "en"]) messagesByLocale[locale][id] = values[locale];
    return id;
  }
  ```

- [ ] **步骤四：按结构分块收集语言引用。** 每个结构块写出后使用 `collectLocalizationRefs(chunk)` 收集所需消息。语言文件按现有板块命名；国家的四个结构分片各有对应语言分片，国家元数据单独一份。示例：

  ```js
  function writeLocaleChunk(file, chunkId, locale, messages, refs) {
    const chunk = Object.fromEntries([...refs].sort().map((key) => [key, messages[key] || ""]));
    const source = `window.VIC3_LOCALE_CHUNKS = window.VIC3_LOCALE_CHUNKS || {};\nwindow.VIC3_LOCALE_CHUNKS[${JSON.stringify(chunkId)}] = ${JSON.stringify({ locale, messages: chunk })};\n`;
    fs.writeFileSync(file, source, "utf8");
    return { id: chunkId, path: path.basename(file), sha256: sha256Text(source), missing: Object.values(chunk).filter((value) => !value).length };
  }
  ```

  `chunkId` 固定为 `<语言>:<板块>:<文件基名>`。同一个消息可以出现在多个按需语言分块中，前端合并时采用同值覆盖；构建检查发现同键异值时失败。按编号保存结果可以承受快速切换时的并发脚本返回，不能使用会被另一请求覆盖的单一 `window.VIC3_LOCALE_CHUNK`。

- [ ] **步骤五：生成精简双语搜索索引。** `search-index.js` 只包含实体类型、内部键、稳定编号及两个名称：

  ```js
  window.VIC3_SEARCH_INDEX = {
    locales: ["zh-Hans", "en"],
    entries: [
      { kind: "country", id: "country:PRU", key: "PRU", names: { "zh-Hans": "普鲁士", en: "Prussia" } },
    ],
  };
  ```

  八个主要板块全部纳入；文化特质、利益集团、利益集团特质、战略区域和地理区域继续作为全局搜索的辅助类型。说明、条件和长文本不写入该文件。

- [ ] **步骤六：更新通用数据读取器。** `scripts/site_data_reader.mjs` 读取结构分块时不合并语言文件，并新增按需读取语言清单与搜索索引的导出函数。正式站点的 `check_data_chunking.mjs` 与 `check_publish_bundle.mjs` 留到任务五替换正式数据后更新，避免本任务提交后旧前端与新结构数据不兼容。

  ```js
  export function readSiteLocaleChunk(file, chunkId) {
    const value = readGlobal(file, "VIC3_LOCALE_CHUNKS") || {};
    return value[chunkId] || null;
  }

  export function readSiteSearchIndex(file) {
    return readGlobal(file, "VIC3_SEARCH_INDEX") || { locales: [], entries: [] };
  }
  ```

- [ ] **步骤七：在临时目录构建 1.13.9 网页数据并检查。** 执行：

  ```powershell
  $multiSite = Join-Path $env:TEMP 'vicdata-multilingual-site'
  node scripts/build_wiki.mjs --database database/vic3_1.13.9 --out $multiSite
  node scripts/check_multilingual_bundles.mjs --site-version $multiSite
  ```

  预期检查退出码为零；语言包缺失数按语言和板块输出，英语回退所需名称不得缺失。检查完成后删除 `$multiSite`，`site/versions/1.13.9` 保持原状。

- [ ] **步骤八：提交构建器和检查。** 执行 `git add scripts/build_wiki.mjs scripts/site_data_reader.mjs scripts/check_multilingual_bundles.mjs`，检查暂存区不含临时生成物和正式网页数据，然后提交 `git commit -m "feat: build versioned locale bundles"`。

**任务四：建立前端本地化运行时和 Languages 菜单**

**涉及文件：** 创建 `site/locales/manifest.js`、`site/locales/ui.zh-Hans.js`、`site/locales/ui.en.js`、`site/app/i18n.js`、`scripts/check_multilingual_runtime.mjs`、`scripts/check_multilingual_ui_contracts.mjs`；修改 `site/index.html`、`site/app/runtime.js`、`site/app/bootstrap.js`、`site/styles/shell.css`、`scripts/site_frontend_sources.mjs`、`scripts/check_frontend_file_split.mjs`、`scripts/check_publish_bundle.mjs`。

- [ ] **步骤一：先写语言选择与运行时失败检查。** `check_multilingual_runtime.mjs` 在 `vm` 沙箱中分别提供网址参数、本地记录和 `navigator.languages`，断言优先级为网址、上次选择、浏览器语言。至少覆盖 `?lang=en`、`?lang=zh-Hans`、未知参数、本地 `en`、浏览器 `zh-CN` 与浏览器 `fr-FR`。同时测试 `translateMessage()` 的“当前语言、英语、内部键”回退和模板命名参数。

- [ ] **步骤二：先写 HTML 与样式失败检查。** `check_multilingual_ui_contracts.mjs` 断言顶部存在 `#languageMenuButton`、图标路径 `assets/lucide/icons/languages.svg`、菜单选项“简体中文”和“English”，`app/i18n.js` 位于 `runtime.js` 之后、`data.js` 之前；窄屏媒体规则不得隐藏按钮。

- [ ] **步骤三：运行两项检查并确认失败。** 执行 `node scripts/check_multilingual_runtime.mjs` 和 `node scripts/check_multilingual_ui_contracts.mjs`。预期分别报告缺少 `app/i18n.js` 与 `#languageMenuButton`。

- [ ] **步骤四：建立界面语言清单和基础词典。** `site/locales/manifest.js` 定义：

  ```js
  window.VICDATA_LOCALE_CONFIG = Object.freeze({
    storageKey: "vicdata-language",
    supported: [
      { id: "zh-Hans", label: "简体中文", ui: "locales/ui.zh-Hans.js", collator: "zh-Hans-CN" },
      { id: "en", label: "English", ui: "locales/ui.en.js", collator: "en" },
    ],
    fallback: "en",
  });
  ```

  两个界面文件写入按语言编号索引的 `window.VICDATA_UI_LOCALES`，例如 `window.VICDATA_UI_LOCALES.en = { locale: "en", messages: { ... } }`。本任务先加入语言菜单、全局控制、加载状态和错误提示键：`ui.language`、`ui.globalControls`、`ui.search`、`ui.settings`、`ui.about`、`ui.loadingDataset`、`ui.loadingLocale`、`ui.localeLoadFailed`、`ui.close`；后续任务增加各板块键。禁止使用快速切换时会互相覆盖的单一全局值。

- [ ] **步骤五：实现无数据依赖的本地化核心。** `site/app/i18n.js` 提供以下稳定接口：

  ```js
  function selectInitialLocale({ search = location.search, stored = localStorage.getItem(localeConfig.storageKey), languages = navigator.languages }) {
    const requested = new URLSearchParams(search).get("lang");
    if (supportedLocaleIds.has(requested)) return requested;
    if (supportedLocaleIds.has(stored)) return stored;
    return (languages || []).some((value) => /^zh(?:-|$)/i.test(value)) ? "zh-Hans" : "en";
  }

  function entityText(entity, field = "name", fallbackKey = entity?.key || entity?.tag || "") {
    return translateMessage(entity?.loc?.[field], fallbackKey);
  }

  function localizedCompare(left, right) {
    return localeRuntime.collator.compare(String(left || ""), String(right || ""));
  }
  ```

  同一文件还定义并提供 `loadScript(src)`、`mergeLocaleMessages(target,messages,locale)`、`searchNames(id)`、`matchesLocalizedQuery(entity,query)`、`stableEntityKey(entity)`、`closeLanguageMenu()`、`localeLabel(locale)` 与 `warnMissingOnce(key)`；后续任务不得各自重写这些辅助函数。`initializeLocale()`、`activateInitialLocaleAfterDataIndex()`、`t(key,args)`、`tc(key,count,args)`、`translateMessage(messageId,fallbackKey)`、`renderTextSpec(spec)`、`localizedNumber(value)`、`loadUiLocale(locale)`、`setDocumentLocale(locale)` 和 `updateLocaleUrl(locale)` 也由本文件统一提供。`initializeLocale()` 先记录 `selectInitialLocale()` 得到的首选语言，并以简体中文兼容界面启动；`loadInitialDataset()` 取得数据索引后调用 `activateInitialLocaleAfterDataIndex()`，有双语清单时加载小型英语界面词典作为回退并启用首选语言，没有清单时保持简体中文并禁用英语菜单项。模板仅替换命名参数，传入 `{ message }` 和嵌套模板时递归求值，文本统一经过现有 HTML 转义函数后再插入模板。`tc()` 使用 `Intl.PluralRules` 选择 `<key>.one` 或 `<key>.other`，`localizedNumber()` 使用当前语言的 `Intl.NumberFormat`。

- [ ] **步骤六：加入 Languages 菜单及脚本入口。** 在顶栏资料库选择与全局搜索之间加入按钮和菜单：

  ```html
  <div class="language-menu">
    <button id="languageMenuButton" class="topbar-icon-button" type="button" aria-haspopup="menu" aria-expanded="false">
      <img class="lucide-icon" src="assets/lucide/icons/languages.svg" alt="" aria-hidden="true">
    </button>
    <div id="languageMenu" class="language-menu-popover" role="menu" hidden>
      <button type="button" role="menuitemradio" data-locale="zh-Hans">简体中文</button>
      <button type="button" role="menuitemradio" data-locale="en">English</button>
    </div>
  </div>
  ```

  `site/index.html` 在 `app/runtime.js` 前加载 `locales/manifest.js`，在 `runtime.js` 后、`data.js` 前加载 `app/i18n.js`；界面词典由 `loadUiLocale()` 按需加载。`runtime.js` 增加对应元素引用以及 `localeRuntime`，包括 `requested`、`current`、`messages`、`englishMessages`、`dataMessages`、`loadedChunks`、`requestId`、`collator`、`numberFormat` 和 `pluralRules`。`bootstrap.js` 在加载数据前执行 `await initializeLocale()`。`shell.css` 将菜单定位在按钮下方，窄屏仍位于顶栏全局控制区。

- [ ] **步骤七：更新前端文件清单并运行检查。** 在 `site_frontend_sources.mjs` 与 `check_frontend_file_split.mjs` 中把 `app/i18n.js` 放在 `runtime.js` 和 `data.js` 之间。执行四项检查：

  ```powershell
  node scripts/check_multilingual_runtime.mjs
  node scripts/check_multilingual_ui_contracts.mjs
  node scripts/check_frontend_file_split.mjs
  node --check site/app/i18n.js
  ```

  预期分别输出 `multilingual_runtime: ok`、`multilingual_ui_contracts: ok`、`frontend_file_split: ok`，语法检查退出码为零。

- [ ] **步骤八：更新发布清单并提交运行时与菜单。** `check_publish_bundle.mjs` 将 `site/locales`、`app/i18n.js` 和 `languages.svg` 加入必需文件；数据语言分块仍留待任务五按 `data-index.js` 动态加入。执行 `node scripts/check_publish_bundle.mjs`，再暂存本任务文件并提交 `git commit -m "feat: add locale runtime and language menu"`。

**任务五：按路由加载语言分块并实现原子切换**

**涉及文件：** 修改 `site/app/i18n.js`、`site/app/data.js`、`site/app/ui.js`、`site/app/runtime.js`、`scripts/check_multilingual_runtime.mjs`、`scripts/check_data_chunking.mjs`、`scripts/check_publish_bundle.mjs`；生成 `site/versions/1.13.9/data-*.js`、`locale-*.js` 和 `search-index.js`。

- [ ] **步骤一：扩展失败检查。** 为 `check_multilingual_runtime.mjs` 增加三个异步场景：切换到英语时结构分块与英语分块全部完成后才提交；第二次快速切回中文时忽略较早英语请求；任一语言文件失败时保留旧语言、旧消息和当前状态。`check_data_chunking.mjs` 断言结构分块继续顺序加载；语言分块必须通过唯一编号从 `window.VIC3_LOCALE_CHUNKS` 读取，使不同语言请求可以并发返回而不串包。

- [ ] **步骤二：运行检查并确认失败。** 执行 `node scripts/check_multilingual_runtime.mjs`。预期报告缺少 `ensureLocaleChunks()` 或切换事务。

- [ ] **步骤三：实现数据语言路径与按需加载。** `data.js` 增加：

  ```js
  function localeChunkPath(file) {
    if (!standaloneSiteConfig) return `versions/${loadedDataVersion}/${file}`;
    const dataRoot = String(standaloneSiteConfig.dataRoot || ".").replace(/\\/g, "/").replace(/\/+$/, "");
    return !dataRoot || dataRoot === "." ? file : `${dataRoot}/${file}`;
  }

  async function ensureLocaleChunks(chunkKeys, locale = localeRuntime.current, targetMessages = localeRuntime.dataMessages[locale]) {
    const entries = chunkKeys.flatMap((key) => dataIndex?.locales?.chunks?.[locale]?.[key]?.files || []);
    const loaded = [];
    for (const entry of entries) {
      const cacheKey = `${locale}:${entry.path}`;
      if (localeRuntime.loadedChunks.has(cacheKey) && localeRuntime.dataMessages[locale]) {
        Object.assign(targetMessages, localeRuntime.dataMessages[locale]);
        continue;
      }
      await loadScript(localeChunkPath(entry.path));
      const value = window.VIC3_LOCALE_CHUNKS?.[entry.id];
      if (!value || value.locale !== locale) throw new Error(`Invalid locale chunk ${entry.id}`);
      mergeLocaleMessages(targetMessages, value?.messages || {}, locale);
      loaded.push(cacheKey);
    }
    return loaded;
  }
  ```

  `mergeLocaleMessages(target,messages,locale)` 验证同一语言的同键同值后写入调用方提供的对象；同键异值立即抛错。普通路由加载成功后把返回的缓存键写入 `localeRuntime.loadedChunks`；语言切换事务只在提交阶段写缓存与正式消息对象。`loadVersion()` 和 `loadStandaloneDataset()` 在应用数据前加载搜索索引，并在 `ensureDataChunksForRoute()` 后加载同板块当前语言分块。当前语言分块的清单 `missing` 大于零时，再加载对应英语分块作为缺失回退；没有缺失时不下载另一语言的长说明。全局搜索只使用已含两种名称的精简索引，不加载两种语言的长说明。

- [ ] **步骤四：增加迁移期内存适配层并替换正式数据。** `hydrateLegacyLocalizedFields(value)` 只修改浏览器内存对象，根据 `loc` 引用写入旧呈现代码暂时需要的字段。映射表固定为：`name → name/name_zh`、`description → desc_zh/description_zh`、`tier → tierZh/tier_zh`、`countryType → countryTypeZh/country_type_zh`、`category → category_zh`、`type → type_zh`、`groupName → group_name_zh`、`sourceName → source_name_zh`、`label → label_zh`、`summary → summary_zh`、`valueDisplay → value_zh`、`adjective → adjective_zh`、`dlcName → dlc_name_zh`。英语搜索名从 `VIC3_SEARCH_INDEX` 读取并只用于查询。该适配函数放在 `app/i18n.js` 的明确 `MULTILINGUAL_MIGRATION_COMPATIBILITY` 区段，任务十二删除。随后执行：

  ```powershell
  node scripts/build_wiki.mjs --database database/vic3_1.13.9 --out site/versions/1.13.9
  node scripts/check_multilingual_bundles.mjs --site-version site/versions/1.13.9
  ```

  `applyLoadedDataset()` 在建立索引前调用适配层，使尚未迁移的板块仍可显示当前语言。

- [ ] **步骤五：实现原子切换。** `switchLocale(locale)` 先递增 `requestId`，建立临时界面消息、临时数据消息和临时缓存键，在其中加载当前路由所需语言包；完成后再次核对请求编号。提交阶段才更新 `localeRuntime.current`、消息、正式缓存、`Intl.Collator`、`Intl.NumberFormat`、`Intl.PluralRules`、`<html lang>`、网址参数和本地记录，重新执行内存适配，再调用 `syncStaticUiText()`、`renderFilterOptions()` 与 `render()`。失败时恢复菜单选中状态，并以旧语言显示 `ui.localeLoadFailed`。

- [ ] **步骤六：绑定菜单和网址状态。** `ui.js` 监听按钮、菜单选项、`Escape` 和外部点击；更新网址时保留已有 `version` 参数和哈希。切换过程中不得调用 `resetDatasetState()`、`resetBoardView()` 或清除任何筛选集合。资料库跳转应把当前 `lang` 参数带到目标地址。

  ```js
  els.languageMenu?.addEventListener("click", (event) => {
    const option = event.target.closest("[data-locale]");
    if (option) void switchLocale(option.dataset.locale);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLanguageMenu();
  });
  ```

- [ ] **步骤七：更新正式数据检查并运行。** `check_data_chunking.mjs` 增加语言清单、唯一分块编号、并发安全注册表和搜索索引断言；`check_publish_bundle.mjs` 从 `data-index.js` 动态加入全部语言文件与搜索索引。执行 `node scripts/check_multilingual_runtime.mjs`、`node scripts/check_data_chunking.mjs`、`node scripts/check_publish_bundle.mjs`、`node --check site/app/data.js` 和 `node --check site/app/ui.js`。预期全部退出码为零。

- [ ] **步骤八：提交加载、切换逻辑和正式数据。** 暂存本任务涉及文件及 `site/versions/1.13.9` 生成物，确认没有数据库或临时目录，提交 `git commit -m "feat: load locale chunks transactionally"`。

**任务六：迁移国家与文化板块**

**涉及文件：** 创建 `scripts/check_multilingual_board_contracts.mjs`；修改 `site/app/boards.js`、`site/app/components.js`、`site/app/presentation.js`、`site/app/filters.js`、`site/app/map.js`、`site/app/ui.js`、`site/locales/ui.zh-Hans.js`、`site/locales/ui.en.js`、相关国家与文化检查脚本。

- [ ] **步骤一：先为两个板块写失败合同。** `check_multilingual_board_contracts.mjs` 从命名函数中提取源码，断言国家和文化的列表、详情、筛选、移动端工具栏、地图标签和提示框使用 `entityText()`、`t()` 或 `renderTextSpec()`，且这些函数中没有 `name_zh`、`tierZh`、`countryTypeZh`、`type_zh` 和固定的中文排序区域。检查还要确认两种界面词典都含 `board.country.*` 与 `board.culture.*` 的相同键集。

- [ ] **步骤二：运行合同并确认失败。** 执行 `node scripts/check_multilingual_board_contracts.mjs --boards country,culture`。预期列出 `renderCountryList`、`renderCountryDetail`、`renderCultureList`、`renderCultureDetail` 和筛选函数中的旧字段。

- [ ] **步骤三：迁移国家列表、筛选与排序。** 在 `presentation.js` 的 `renderCountryList()`、`filters.js` 的国家筛选和 `data.js` 的国家选项中，以 `entityText(country)` 替换 `country.name`，以 `entityText(country.capital)`、`entityText(cultureRef)`、``t(`enum.tier.${country.tier}`)`` 与 ``t(`enum.countryType.${country.countryType}`)`` 读取相关名称。卡片标题使用：

  ```js
  const displayName = entityText(country, "displayName", country.tag);
  const searchable = searchNames(country.id).join(" ").toLocaleLowerCase();
  const sortName = entityText(country, "displayName", country.tag);
  ```

  可见名称排序使用 `localizedCompare(sortNameA, sortNameB)`，位阶和国家类型继续优先使用现有顺序表。界面词典补入“开局存在”“可释放”“次要统一”“重大统一”“双传承”“内战国家”等筛选键。

- [ ] **步骤四：迁移国家详情、地图与利益集团风味。** `renderCountryDetail()`、`renderCountryDetailPage()`、`dynamicNameList()`、国家地图提示和利益集团风味卡统一从实体 `loc` 或 `summary_text` 取值。首都、宗教、主流文化、动态国名、成立范围和附属国宗主使用 `entityText()`；利益集团规则与修正使用 `renderTextSpec()`。词典补入“首都”“主流文化”“开局世界局势”“成立条件”“可释放范围”和利益集团风味字段。字段输出统一采用：

  ```js
  field(t("board.country.capital"), conceptPill({ kind: "stateRegion", key: country.capital.key, label: entityText(country.capital) }));
  field(t("board.country.primaryCultures"), (country.primaryCultures || []).map((item) => conceptPill({ kind: "culture", key: item.key, label: entityText(item) })).join(""));
  const ruleSummary = renderTextSpec(rule.summary_text);
  ```

- [ ] **步骤五：迁移文化列表、筛选和移动端控件。** 文化、宗教、传承、传承组、语言、语言组、传统和战略区域的筛选标签全部使用 `entityText()`；列表排序使用当前语言。移动端第一行仍保持“类型、位阶、战略区域、传承、语言、传统”的既有层级，英语显示为“Type, Rank, Strategic Region, Heritage, Language, Tradition”，选项继续位于第二行并自然换行：

  ```js
  const categories = ["type", "rank", "strategicRegion", "heritage", "language", "tradition"];
  const label = (category) => t(`board.culture.mobile.${category}`);
  const options = traits.toSorted((left, right) => localizedCompare(entityText(left), entityText(right)));
  ```

- [ ] **步骤六：迁移文化详情、关系与提示框。** `renderCultureDetail()`、文化关系列表、文化地图标签和文化提示框中的痴迷、禁忌、相关国家、本土地区与同组关系使用本地化引用；关系标题使用 `board.culture.relation.*`。提示框只显示当前语言名称、内部键和类型：

  ```js
  field(t(`board.culture.relation.${relationKind}`), related.map((item) => conceptPill({ kind: "culture", key: item.key, label: entityText(item) })).join(""));
  conceptTooltipHeader({ dataset: { conceptName: entityText(culture), conceptKey: culture.key, conceptType: t("entity.culture") } });
  ```

- [ ] **步骤七：保持双语搜索与内部键显示。** 国家和文化卡片只显示当前语言名称与内部键。板块内搜索函数同时查询 `searchNames(entity.id)` 返回的简体中文、英语和内部键；详情和提示框不并列第二语言：

  ```js
  function matchesLocalizedQuery(entity, query) {
    const needle = String(query || "").trim().toLocaleLowerCase();
    return !needle || [...searchNames(entity.id), entity.key, entity.tag].filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase().includes(needle));
  }
  ```

- [ ] **步骤八：运行合同和既有回归检查。** 执行：

  ```powershell
  node scripts/check_multilingual_board_contracts.mjs --boards country,culture
  node scripts/check_country_list_default_coverage.mjs
  node scripts/check_country_map_selection.mjs
  node scripts/check_country_mobile_narrow_screen_contract.mjs
  node scripts/check_culture_tooltip_relations.mjs
  node scripts/check_culture_mobile_narrow_screen_contract.mjs
  ```

  预期全部退出码为零，既有筛选层级和点击行为保持不变。

- [ ] **步骤九：提交国家与文化迁移。** 只暂存本任务文件，提交 `git commit -m "feat: localize country and culture boards"`。

**任务七：迁移地区与公司板块**

**涉及文件：** 修改 `site/app/boards.js`、`site/app/components.js`、`site/app/presentation.js`、`site/app/filters.js`、`site/app/map.js`、`site/app/company-location-rules.js`、两种界面词典及相关检查脚本。

- [ ] **步骤一：扩展失败合同。** 对地区与公司相关呈现函数拒绝 `name_zh`、`category_zh`、`company_kind_zh`、`prestige_goods_kind_zh`、`dlc_name_zh`、`display_name_zh`、`geographic_region_group_zh`、`modifier_summary_zh` 和固定中文排序。运行 `node scripts/check_multilingual_board_contracts.mjs --boards region,company`，预期失败并列出实际函数。

- [ ] **步骤二：迁移地区列表与筛选。** `renderRegionList()`、地区筛选和资源筛选用 `entityText()` 读取州地区、战略区域、地理区域、资源与地区特质名称。地理区域组改为 `enum.geographicRegionGroup.<key>`，列表和筛选名称用 `localizedCompare()` 排序：

  ```js
  optionToken("strategic-region", region.key, entityText(region), state.strategicRegions.has(region.key));
  const groupLabel = t(`enum.geographicRegionGroup.${region.geographic_region_group}`);
  regions.sort((left, right) => localizedCompare(entityText(left), entityText(right)));
  ```

- [ ] **步骤三：迁移地区详情、特质和地图。** `renderStateRegionDetail()`、`renderStrategicRegionDetail()`、`renderGeographicRegionDetail()`、动态地区名、开局归属、文化本土、资源、农业建筑、可发现资源与地区特质通过 `entityText()` 获取名称；修正值与特质效果通过 `renderTextSpec()`。地图数字保持数值，地图提示和资源上下文栏使用当前语言：

  ```js
  const traitTitle = entityText(trait, "name", trait.key);
  const effects = (trait.modifiers || []).map((modifier) => renderTextSpec(modifier.summary_text));
  setOptionalText(els.mapResourceContext, t("map.resourceContext", { resource: entityText(resource), count: localizedNumber(total) }));
  ```

- [ ] **步骤四：迁移公司列表与筛选。** `renderCompanyList()` 和公司筛选通过 `entityText()` 读取公司、建筑、名贵商品、战略区域和资料片名称。公司分类使用 `enum.companyKind.*`，名贵商品分类使用 `enum.prestigeGoodsKind.*`，本体和资料片名称来自消息引用；现有列表优先布局和筛选顺序不变：

  ```js
  const companyName = entityText(company, "name", company.key);
  const kindLabel = t(`enum.companyKind.${company.company_kind}`);
  const dlcLabel = translateMessage(company.loc?.dlcName, company.dlc_key);
  ```

- [ ] **步骤五：迁移公司详情、条件与地图。** `renderCompanyDetail()`、公司地点模块和公司提示框中的说明、总部倾向、主营与扩展建筑、名贵商品、繁荣修正、前置科技和引用实体使用 `entityText()` 或 `renderTextSpec()`。详情地图及现有左键和右键行为不变：

  ```js
  const description = entityText(company, "description", company.key);
  const headquarters = (company.preferred_headquarters || []).map((region) => conceptPill({ kind: "stateRegion", key: region.key, label: entityText(region) }));
  const prosperity = (company.prosperity_modifiers || []).map((item) => renderTextSpec(item.summary_text));
  ```

- [ ] **步骤六：补齐界面词典。** 两种语言加入地区和公司标题、筛选、字段、空状态、地图模式及提示文本。英语至少包含“State Region”“Strategic Region”“Geographic Region”“Resource Potential”“Discoverable Resources”“Arable Land”“State Traits”“Company Type”“Headquarters Preference”“Primary Buildings”“Expansion Buildings”“Prosperity Effect”“Required Technologies”。

- [ ] **步骤七：运行合同和既有回归检查。** 执行：

  ```powershell
  node scripts/check_multilingual_board_contracts.mjs --boards region,company
  node scripts/check_region_map_interaction.mjs
  node scripts/check_company_detail_location_map.mjs
  node scripts/check_company_technology_requirements.mjs
  node scripts/check_discoverable_resource_totals.mjs
  node scripts/check_resource_map_colors.mjs
  ```

  预期全部退出码为零。

- [ ] **步骤八：提交地区与公司迁移。** 只暂存本任务文件，提交 `git commit -m "feat: localize region and company boards"`。

**任务八：迁移意识形态与法律板块**

**涉及文件：** 修改 `site/app/boards.js`、`site/app/components.js`、`site/app/presentation.js`、`site/app/filters.js`、`site/app/tag-tooltip-definitions.js`、两种界面词典及相关检查脚本。

- [ ] **步骤一：扩展失败合同。** 对意识形态、利益集团、利益集团特质、法律和法律组呈现函数拒绝 `name_zh`、`desc_zh`、`law_group_name_zh`、`law_name_zh`、`condition_summary_zh`、`flavor_definition_note_zh`、`source_name_zh` 与 `modifier_summary_zh`。执行 `node scripts/check_multilingual_board_contracts.mjs --boards ideology,law`，预期失败。

- [ ] **步骤二：迁移意识形态列表、筛选和提示框。** `renderIdeologyList()`、意识形态筛选和独立提示框通过 `entityText()` 读取名称、说明、利益集团和出现方式。提示框布局保持不变；法律态度使用 `enum.lawStance.approve`、`oppose`、`neutral`，颜色语义不变：

  ```js
  const name = entityText(ideology, "name", ideology.key);
  const description = entityText(ideology, "description", ideology.key);
  const stanceLabel = t(`enum.lawStance.${stance.stance}`);
  ```

- [ ] **步骤三：迁移意识形态详情与风味内容。** `renderIdeologyDetail()`、角色要求、权重条件、风味新增、移除与替换、科技和日志来源统一使用消息引用和 `renderTextSpec()`；条件原文继续显示原始脚本：

  ```js
  const requirement = renderTextSpec(ideology.character_requirements?.country?.summary_text);
  const sourceName = entityText(source, "sourceName", source.source_key);
  const flavorNote = renderTextSpec(ideology.flavor_definition_note_text);
  ```

- [ ] **步骤四：迁移法律列表与筛选。** `renderLawList()`、法律组筛选和态度标签以 `entityText()` 与词典枚举显示；列表组顺序和同组固定排序继续沿用当前结构键：

  ```js
  const groupTitle = entityText(group, "name", group.key);
  const lawTitle = entityText(law, "name", law.key);
  const stanceText = t(`enum.lawStance.${stance}`);
  ```

- [ ] **步骤五：迁移法律详情、修正和条件。** 法律、法律组、机构、修正案、前置科技、可见条件、可颁布条件和效果逐行使用 `entityText()` 与 `renderTextSpec()`。条件原文继续显示原始脚本，摘要由模板生成：

  ```js
  const effectRows = (law.modifiers || []).map((modifier) => renderTextSpec(modifier.summary_text));
  const enactSummary = renderTextSpec(law.can_enact?.summary_text);
  const amendmentName = entityText(amendment, "name", amendment.key);
  ```

- [ ] **步骤六：补齐界面词典。** 两种语言加入“利益集团”“角色”“政治运动”“默认”“风味”“科技”“日志条目”“支持”“反对”“不在意”“法律组”“效果”“修正案”“前置科技”“解锁机构”“角色权重要求与权重修正”等键和对应英文。

- [ ] **步骤七：运行合同和既有回归检查。** 执行 `node scripts/check_multilingual_board_contracts.mjs --boards ideology,law`、`node scripts/check_ui_ideology_contracts.mjs`、`node scripts/check_law_board.mjs`、`node scripts/check_ideology_detail_layout.mjs`、`node scripts/check_tag_tooltip_contracts.mjs`。预期全部退出码为零。

- [ ] **步骤八：提交意识形态与法律迁移。** 只暂存本任务文件，提交 `git commit -m "feat: localize ideology and law boards"`。

**任务九：迁移科技与成就板块**

**涉及文件：** 修改 `site/app/boards.js`、`site/app/components.js`、`site/app/achievements.js`、两种界面词典及相关检查脚本。

- [ ] **步骤一：扩展失败合同。** 对科技树、科技详情、成就墙、成就详情和成就搜索拒绝 `name_zh`、`desc_zh`、`category_zh`、`era_label_zh`、`description_zh`、`group_name_zh`、`text_zh` 和 `name_en`。执行 `node scripts/check_multilingual_board_contracts.mjs --boards technology,achievement`，预期失败。

- [ ] **步骤二：迁移科技树、筛选和搜索。** `renderTechnologyBoard()` 的节点、类别栏、搜索输入和计数使用 `entityText()` 与界面词典。结构布局仍按生产、军事、社会类别和时代内部键计算，节点位置不因翻译变化改变；搜索查询 `searchNames(technology.id)` 以匹配双语名称与键：

  ```js
  const nodeTitle = entityText(technology, "name", technology.key);
  const categoryLabel = t(`enum.technology.${technology.category}`);
  const matches = matchesLocalizedQuery(technology, state.technologySearch);
  ```

- [ ] **步骤三：迁移科技详情。** `renderTechnologyDetail()` 中的名称、说明、时代、类别、修正、解锁内容及对公司或法律的引用全部通过语言包读取；修正列表使用 `renderTextSpec()`：

  ```js
  const title = entityText(technology, "name", technology.key);
  const description = entityText(technology, "description", technology.key);
  const modifierRows = (technology.modifiers || []).map((modifier) => renderTextSpec(modifier.summary_text));
  ```

- [ ] **步骤四：迁移成就墙、筛选和搜索。** `renderAchievementBoard()`、`achievementCardHtml()` 和成就搜索通过本地化引用与 `searchNames()` 获取名称和分组；卡片显示当前语言名称和成就键，不再读取 `name_en`。图标和分组顺序保持原有规则：

  ```js
  const achievementName = entityText(achievement, "name", achievement.key);
  const groupName = entityText(achievement, "groupName", achievement.group_key);
  const matches = matchesLocalizedQuery(achievement, state.achievementSearch);
  ```

- [ ] **步骤五：迁移成就详情。** `renderAchievementDetail()` 中的名称、说明、条件明细、分组和相关国家使用 `entityText()` 或 `renderTextSpec()`，条件值中的数字用 `localizedNumber()`：

  ```js
  const description = entityText(achievement, "description", achievement.key);
  const details = (achievement.details || []).map((detail) => renderTextSpec(detail.text));
  const countries = (achievement.related_countries || []).map((country) => conceptPill({ kind: "country", key: country.tag, label: entityText(country) }));
  ```

- [ ] **步骤六：补齐界面词典。** 两种语言加入科技类别、时代、前置科技、解锁内容、成就统计、分组、相关国家、条件、无结果和返回按钮等界面键。

- [ ] **步骤七：运行合同和既有回归检查。** 执行 `node scripts/check_multilingual_board_contracts.mjs --boards technology,achievement`、`node scripts/check_technology_board_contract.mjs`、`node scripts/check_technology_database.mjs`、`node scripts/check_achievement_board_contract.mjs`、`node scripts/check_achievement_database.mjs`。预期全部退出码为零。

- [ ] **步骤八：提交科技与成就迁移。** 只暂存本任务文件，提交 `git commit -m "feat: localize technology and achievement boards"`。

**任务十：迁移公共界面、搜索、提示框和辅助功能文本**

**涉及文件：** 修改 `site/index.html`、全部 `site/app/*.js` 中的公共文案、两种界面词典、`scripts/check_global_search.mjs`、`scripts/check_about_page.mjs`、`scripts/check_multilingual_ui_contracts.mjs`。

- [ ] **步骤一：增加固定文案覆盖检查。** `check_multilingual_ui_contracts.mjs` 收集 `data-i18n`、`data-i18n-title`、`data-i18n-aria-label` 与所有 `t("...")` 的键，断言两种界面词典键集相同且均有非空值。检查主要呈现函数中的中文字符串；允许新闻、公告和版本更新记录的原文，也允许品牌名、游戏名和测试样本。

- [ ] **步骤二：运行检查并确认公共文案仍未迁移。** 执行 `node scripts/check_multilingual_ui_contracts.mjs --strict`。预期报告首页、导航、设置、关于、全局搜索、筛选区、通用提示框和错误信息中的固定中文。

- [ ] **步骤三：迁移静态 HTML、导航和页面标题。** 静态节点使用 `data-i18n`，属性使用 `data-i18n-title` 与 `data-i18n-aria-label`。`syncStaticUiText()` 在初始化和切换后更新文本。`document.title` 使用 `template.documentTitle`，例如中文“国家 - Vicdata”、英文“Countries - Vicdata”。`<html lang>` 分别写 `zh-Hans` 与 `en`：

  ```html
  <button data-nav-view="country"><img ...><span data-i18n="nav.country">国家</span></button>
  <button id="globalSearchButton" data-i18n-title="ui.search" data-i18n-aria-label="ui.search">...</button>
  ```

  ```js
  document.querySelectorAll("[data-i18n]").forEach((node) => setOptionalText(node, t(node.dataset.i18n)));
  document.title = t("template.documentTitle", { board: t(`nav.${state.view}`), site: siteTitle });
  ```

- [ ] **步骤四：迁移首页。** `renderHomeBoard()` 和首页引导、资料类别卡使用界面词典；新闻、公告和版本更新记录的标题与正文保持原文。板块外围的“游戏资讯”“公告”“更新日志”等栏目名称可以翻译，内容本身不处理：

  ```js
  homeCategoryCard({ view: "country", title: t("nav.country"), description: t("home.countryDescription") });
  sectionTitle(t("home.news"), renderNewsItems(newsItems)); // newsItems 内容保持原文
  ```

- [ ] **步骤五：迁移设置与关于。** `renderSettingsDialogContent()`、`renderAboutDialogContent()`、对话框标题、关闭按钮和辅助功能属性使用词典；已有设置键和值保持不变，语言入口不在设置面板重复出现：

  ```js
  dialogHeading(t("settings.title"));
  settingCheckbox("whiteDecentralized", t("settings.whiteDecentralized"), state.whiteDecentralized);
  aboutParagraph(t("about.disclaimer"));
  ```

- [ ] **步骤六：迁移全局搜索。** `globalSearchResults()` 使用生成的 `VIC3_SEARCH_INDEX` 进行第一阶段匹配，名称比较包含当前语言、另一语言和内部键；进入结果详情后再加载对应结构及当前语言长文本。分组标题、类型标签、别名提示、输入提示和无结果状态使用界面词典。更新 `check_global_search.mjs`，样本同时断言“普鲁士”“Prussia”“PRU”均命中同一国家：

  ```js
  const haystack = [entry.key, ...Object.values(entry.names || {})].join(" ").toLocaleLowerCase();
  const title = entry.names?.[localeRuntime.current] || entry.names?.en || entry.key;
  const typeLabel = t(`entity.${entry.kind}`);
  ```

- [ ] **步骤七：迁移通用标签和提示框。** `tag-tooltip-definitions.js` 中的类型和操作提示改为消息键；除意识形态外仍显示“当前语言名称＋内部键＋类型”。“左键进入详情页”“右键进行筛选”、空列表和结果数量使用模板；数量通过 `tc()` 处理英语单复数：

  ```js
  const tooltipDefinition = { typeKey: "entity.culture", leftActionKey: "tooltip.openDetail", rightActionKey: "tooltip.filter" };
  const resultLabel = tc("results.count", count, { count: localizedNumber(count) });
  ```

- [ ] **步骤八：迁移地图、加载状态和错误信息。** 地图工具栏、地图提示、数据和语言包加载状态、失败消息使用词典。数字通过 `localizedNumber()` 显示，不改变原始数值。`translateMessage()` 对缺失消息按“当前语言、英语、内部键”回退，并按“语言＋消息键”去重写入 `console.warn`：

  ```js
  setOptionalText(els.metaLine, t("ui.loadingDataset", { dataset: siteTitle }));
  const message = t("ui.localeLoadFailed", { locale: localeLabel(locale) });
  warnMissingOnce(`${localeRuntime.current}:${messageId}`);
  ```

- [ ] **步骤九：统一排序。** 所有曾使用 `localeCompare(..., "zh-Hans-CN")` 的可见名称排序改为 `localizedCompare()`；结构顺序、位阶顺序、法律组顺序、科技坐标和显式规则顺序继续按键与现有顺序表处理。检查英文采用 `en`，中文采用 `zh-Hans-CN`：

  ```js
  rows.sort((left, right) => localizedCompare(entityText(left), entityText(right)) || stableEntityKey(left).localeCompare(stableEntityKey(right)));
  ```

- [ ] **步骤十：运行公共合同和既有检查。** 执行：

  ```powershell
  node scripts/check_multilingual_ui_contracts.mjs --strict
  node scripts/check_global_search.mjs
  node scripts/check_about_page.mjs
  node scripts/check_homepage_layout.mjs
  node scripts/check_tag_tooltip_contracts.mjs
  node scripts/check_publish_bundle.mjs
  ```

  预期全部退出码为零，内容原文豁免只限新闻、公告与版本更新记录。

- [ ] **步骤十一：提交公共界面迁移。** 只暂存本任务文件，提交 `git commit -m "feat: localize shared site interface"`。

**任务十一：接入 Victorian Century 并验证版本目录加载方式**

**涉及文件：** 修改 `scripts/check_victorian_century_update.mjs`、`scripts/build_victorian_century_site.mjs`、`scripts/check_victorian_century_standalone_site.mjs`、`scripts/check_victorian_century_browser.mjs`、`site/vc/*` 生成物；创建历史版本临时夹具检查逻辑。`Victorian Century Database/` 是受 `.gitignore` 管理的本地中间站，只用于生成和检查，不纳入提交。

- [ ] **步骤一：先扩展失败检查。** `check_victorian_century_standalone_site.mjs` 要求八个结构分块、两种语言的八组语言分块、双语搜索索引、界面词典和 `app/i18n.js`；确认 `VICTORIAN_CENTURY_SITE_CONFIG` 提供 `localeRoot`。浏览器检查的路由数组加入 `achievement`，并在英语模式下抽样一个模组新增或调整条目。

- [ ] **步骤二：运行 VC 检查并确认失败。** 执行 `node scripts/check_victorian_century_standalone_site.mjs`。预期报告缺少 VC 语言清单或语言文件。

- [ ] **步骤三：让 VC 更新链生成双语语言包。** `check_victorian_century_update.mjs` 继续以原版路径在前、模组路径在后的顺序调用抽取器；两种语言都遵守同键后者覆盖。运行 `build_wiki.mjs` 时生成 VC 自有语言分块和搜索索引。数据库检查抽样确认模组新增实体存在英语译文；模组没有英语译文时记录缺失并回退内部键，不能使用中文填入英语包。

  ```js
  const localeOrder = [
    path.join(gameData, "localization", localeDirectory),
    path.join(modData, "localization", localeDirectory),
  ];
  const messages = localeOrder.reduce((result, directory) => mergeLocalization(result, loadLocalization(directory)), new Map());
  ```

- [ ] **步骤四：同步前端与界面词典。** `build_victorian_century_site.mjs` 除 `app`、`styles` 与 `assets` 外复制 `site/locales`，独立配置增加：

  ```js
  return `window.VICTORIAN_CENTURY_SITE_CONFIG = Object.freeze({
    siteTitle: "Victorian Century Database",
    dataIndex: "data-index.js",
    mapData: "map-data.js",
    dataRoot: ".",
    localeRoot: "locales",
    webpAssetPaths: ${JSON.stringify(webpAssetPaths)},
  });\n`;
  ```

  资料库下拉选项随当前语言显示；跳回主站时保留 `lang` 参数。

- [ ] **步骤五：生成并发布到仓库内的 VC 目录。** 执行：

  ```powershell
  node scripts/check_victorian_century_update.mjs --force --skip-network --skip-map
  node scripts/check_victorian_century_standalone_site.mjs
  ```

  第一条命令只更新本地数据库、独立站和 `site/vc`，不上传服务器；第二条预期输出 `victorian_century_standalone_site: ok`，并列出八个板块和两种语言。

- [ ] **步骤六：用临时版本目录验证历史版本加载接口。** 当前公开配置只含 `1.13.9`，归档的 `1.9.8` 缺少可核对的同期英语源文件，本任务不把它重新加入公开选择器。检查脚本在 `$env:TEMP` 创建 `versions/history-fixture/`，复制当前结构和语言清单并把版本标签改为 `history-fixture`，再用临时 `versions.js` 打开 `?version=history-fixture&lang=en#/country/PRU`。断言直接链接加载英语名称、刷新保持语言、切换板块仍从版本目录读取语言包。临时夹具在 `finally` 中删除。

- [ ] **步骤七：运行 VC 浏览器检查。** 启动本地服务后执行：

  ```powershell
  $env:NODE_PATH = 'C:\Users\SamuY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
  $env:VC_CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
  $vcServer = Start-Process -FilePath node -ArgumentList 'scripts/serve_site.mjs','site/vc','8877' -WorkingDirectory (Get-Location).Path -WindowStyle Hidden -PassThru
  try { node scripts/check_victorian_century_browser.mjs 'http://127.0.0.1:8877/index.html' } finally { Stop-Process -Id $vcServer.Id }
  ```

  预期八个板块在中英文下均有内容，控制台没有页面错误；新闻、公告和更新日志入口在 VC 独立站继续隐藏。

- [ ] **步骤八：提交 VC 集成。** 暂存更新链、构建脚本、检查脚本与 `site/vc` 中本任务生成的受跟踪文件；确认忽略的 `Victorian Century Database/`、根目录未跟踪的 `Victorian`、`screenshots/` 和 `scripts/__pycache__/` 均未纳入提交，随后提交 `git commit -m "feat: add Victorian Century locale bundles"`。

**任务十二：删除兼容层、完成全站浏览器验收并记录结果**

**涉及文件：** 创建 `scripts/check_multilingual_legacy_fields.mjs`、`scripts/check_multilingual_browser.mjs`；修改前端、构建检查、`README.md`、`WORKLOG.md`、`docs/worklog/2026-07-31.md` 及缓存参数。

- [ ] **步骤一：先写旧字段失败检查。** `check_multilingual_legacy_fields.mjs` 扫描 `site/app/*.js`、`site/versions/1.13.9/data-*.js`、`Victorian Century Database/data-*.js` 与 `site/vc/data-*.js`，拒绝固定语言字段和兼容读取函数。允许 `ui.zh-Hans.js`、语言分块、新闻、公告、更新记录和测试样本包含中文。初次执行预期能定位尚存的兼容路径。

- [ ] **步骤二：清除旧字段和兼容适配。** 删除 `name_zh || key`、`name_en`、`tierZh`、`countryTypeZh` 等回退，结构数据只能通过 `loc`、文本模板和内部键显示。删除兼容的旧 `data.js` 读取分支；VC 更新链不再要求 `--legacy-data`。重新生成主站和 VC 数据，确认结构语言字段扫描为零。

- [ ] **步骤三：编写完整浏览器检查。** `check_multilingual_browser.mjs` 在主站逐一打开八个板块，记录中文和英文的标题、首条实体名、筛选名、详情名、提示框和结果数。检查以下状态：

  ```js
  const routes = ["country", "culture", "region", "company", "ideology", "law", "technology", "achievement"];
  const searchCases = [
    { query: "普鲁士", expected: "PRU" },
    { query: "Prussia", expected: "PRU" },
    { query: "PRU", expected: "PRU" },
  ];
  ```

  浏览器还要验证 `?lang` 优先级、未知参数回退、刷新恢复、切换后网址与 `<html lang>`、当前详情与筛选保持、快速连续切换、模拟语言包 404 后保持旧语言，以及 390 像素宽度下 Languages 菜单、英文长标签和卡片无横向溢出。

- [ ] **步骤四：先运行浏览器检查并修复实际问题。** 启动 `site` 本地服务，执行 `node scripts/check_multilingual_browser.mjs 'http://127.0.0.1:8876/index.html'`。每次失败只修复报告的具体板块或状态，并重新运行该检查，直至输出 `multilingual_browser: ok`、`routes: 8`、`locales: 2`。

- [ ] **步骤五：运行完整静态与数据验证。** 执行：

  ```powershell
  node scripts/check_localization_schema.mjs
  node scripts/check_multilingual_database.mjs --database database/vic3_1.13.9
  node scripts/check_multilingual_bundles.mjs --site-version site/versions/1.13.9
  node scripts/check_multilingual_runtime.mjs
  node scripts/check_multilingual_ui_contracts.mjs --strict
  node scripts/check_multilingual_board_contracts.mjs --boards country,culture,region,company,ideology,law,technology,achievement
  node scripts/check_multilingual_legacy_fields.mjs
  node scripts/check_data_chunking.mjs
  node scripts/check_frontend_file_split.mjs
  node scripts/check_global_search.mjs
  node scripts/check_victorian_century_standalone_site.mjs
  node scripts/check_publish_bundle.mjs
  git diff --check
  ```

  所有命令应以零退出。缺失报告需要分别列出简体中文、英语和两者同时缺失；英语名称缺失不得被中文掩盖。

- [ ] **步骤六：复核主站与 VC 的真实页面。** 在 1440×1000 和 390×844 两种视口下保存国家、文化、地区、公司、意识形态、法律、科技和成就的英语截图样本；核对导航、筛选、卡片、详情、提示框和 Languages 菜单。截图只放入现有未跟踪 `screenshots/`，不纳入提交。

- [ ] **步骤七：更新项目说明与工作记录。** `README.md` 增加语言选择、网址参数、语言包生成命令与后续添加语言的步骤。`docs/worklog/2026-07-31.md` 记录两种语言、八个板块、数据包数量、缺失统计、浏览器视口和实际命令结果；`WORKLOG.md` 只增加一条简短状态和详细记录链接。

- [ ] **步骤八：更新入口缓存参数并做最终检查。** `site/index.html` 中 `manifest.js`、界面词典入口、`app/i18n.js`、受影响前端文件和样式使用同一个多语言版本标识；VC 由生成脚本继承。重新执行 `check_publish_bundle.mjs`、主站浏览器检查和 VC 浏览器检查。

- [ ] **步骤九：提交最终清理和记录。** 执行 `git status --short`，确认 `Victorian`、`screenshots/` 和 `scripts/__pycache__/` 仍未跟踪且未暂存；只暂存本任务的代码、生成物和文档。运行 `git diff --cached --check` 后提交：

  ```powershell
  git commit -m "feat: complete bilingual Vicdata interface"
  ```

  提交后再次执行 `git status --short --branch`，记录分支领先状态和仍未跟踪的三个既有目录。
