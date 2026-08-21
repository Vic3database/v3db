# 史实角色关系与君主家族实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为现有史实角色建立可复核的君主家族、王朝和继承关系数据，并在角色详情中按已确认的 Wikipedia 式层级显示。

**Architecture:** 角色审计负责提取游戏中的统治者、继承人和开局国家，独立关系模块负责候选状态、人物对应、关系规范化和资料依据校验，构建脚本只把“已确认”关系写入按需加载的数据块。前端在角色详情路由加载关系数据，使用概览、折叠局部家族图和按头衔排列的继承框呈现；未收录人物只贡献缺失人数，不进入公开角色节点。

**Tech Stack:** Node.js、原生 JavaScript、CSS、Wikidata JSON、Wikipedia 页面资料、自定义契约测试、Chrome DevTools Protocol 浏览器测试。

---

## 文件结构

- `scripts/audit_historical_characters.mjs`：补齐统治者、继承人、开局国家及游戏文件依据。
- `scripts/lib/historical_character_relations.mjs`：定义复核文档读取、人物对应、关系规范化、公开数据生成和统计接口。
- `scripts/collect_historical_character_relation_candidates.mjs`：读取角色与现有 Wikidata 编号，串行取得君主家族候选并生成批次报告。
- `scripts/build_historical_character_relation_review_batch.mjs`：从待复核候选中按君主和继承人优先级生成小批次。
- `scripts/data/historical-character-relation-reviews.json`：保存人工确认、冲突和排除决定。
- `scripts/build_historical_character_relations.mjs`：校验复核资料，生成正式关系报告与站点数据块。
- `scripts/check_historical_character_roles.mjs`、`scripts/check_historical_character_relations.mjs`、`scripts/check_historical_character_relation_review_batch.mjs`：数据与复核契约。
- `site/app/character-relations.js`：纯渲染与关系索引辅助函数，避免继续扩大 `characters.js`。
- `site/app/characters.js`：在现有详情模板接入关系区和人物导航。
- `site/app/runtime.js`、`site/app/data.js`：保存关系数据、处理详情路由按需加载和加载错误。
- `site/styles/characters.css`：概览表、家族图、继承框和窄屏分组样式。
- `site/locales/ui.zh-Hans.js`、`site/locales/ui.en.js`：关系界面词条。
- `site/index.html`、`site/styles.css`：登记新脚本并更新角色资源缓存键。
- `site/versions/1.13.11/data-character-relations.js`、`site/versions/1.13.11/data-index.js`：当前版本正式数据及索引登记。
- `scripts/check_character_board_contract.mjs`、`scripts/check_character_board_browser.mjs`：前端契约和实际布局验收。
- `docs/worklog/2026-08-21-historical-character-relations.md`：批次统计、资料范围和验证结果。

### Task 1: 创建独立工作树并固定角色身份契约

**Files:**
- Create: `scripts/check_historical_character_roles.mjs`
- Modify: `scripts/audit_historical_characters.mjs`

- [ ] **Step 1: 创建隔离工作树**

在主工作区执行 `superpowers:using-git-worktrees`，使用分支 `codex/historical-character-relations` 和目录 `.worktrees/historical-character-relations`。创建后执行：

```powershell
git status --short --branch
node scripts/check_character_board_contract.mjs
```

Expected: 工作树状态干净；现有角色契约输出 `character board contract check passed`。若基线失败，记录失败内容并停止实现，不能在新功能中掩盖基线问题。

主工作区的 `site/versions/1.13.11/data-characters.js` 和 `data-character-images.js` 属于被忽略产物，创建工作树后不会自动出现。开始测试前，从主工作区复制这两个输入到工作树的相同相对路径；不得复制主工作区其余未提交文件。确认复制目标均位于 `.worktrees/historical-character-relations` 后再执行复制。`output/` 报告由新工作树中的审计命令重新生成。

- [ ] **Step 2: 写角色身份失败测试**

创建 `scripts/check_historical_character_roles.mjs`，用临时游戏目录运行审计脚本。夹具包含旧式与新式语法，以及开局国家块：

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "vicdata-character-roles-"));
const gamePath = path.join(fixture, "Victoria 3");
const gameDir = path.join(gamePath, "game");
const output = path.join(fixture, "output");
for (const directory of [
  "common/character_templates",
  "common/dna_data",
  "common/history/characters",
  "localization/simp_chinese",
  "localization/english",
]) fs.mkdirSync(path.join(gameDir, directory), { recursive: true });
fs.writeFileSync(path.join(gamePath, "caligula_branch.txt"), "test\n", "utf8");
fs.writeFileSync(path.join(gameDir, "common/character_templates/country_test.txt"), `
OLD_ruler = {
  historical = yes
  first_name = Old
  ruler = yes
}
OLD_heir = {
  historical = yes
  first_name = Heir
  heir = yes
}
NEW_ruler = {
  historical = yes
  first_name = New
  role = character_role_ruler
}
NEW_heir = {
  historical = yes
  first_name = NewHeir
  role = heir
}
`, "utf8");
fs.writeFileSync(path.join(gameDir, "common/history/characters/tst - test.txt"), `
CHARACTERS = {
  c:TST ?= {
    create_character = { template = OLD_ruler }
    create_character = { template = OLD_heir }
  }
}
`, "utf8");
const run = spawnSync(process.execPath, [
  "scripts/audit_historical_characters.mjs",
  "--game-path", gamePath,
  "--out", output,
], { cwd: root, encoding: "utf8" });
assert.equal(run.status, 0, run.stderr || run.stdout);
const report = JSON.parse(fs.readFileSync(path.join(output, "historical-characters.json"), "utf8"));
const byKey = new Map(report.characters.map((item) => [item.key, item]));
assert.deepEqual(byKey.get("OLD_ruler").role_archetypes, ["ruler"]);
assert.deepEqual(byKey.get("OLD_heir").role_archetypes, ["heir"]);
assert.deepEqual(byKey.get("NEW_ruler").role_archetypes, ["ruler"]);
assert.deepEqual(byKey.get("NEW_heir").role_archetypes, ["heir"]);
assert.deepEqual(byKey.get("OLD_ruler").starting_country_keys, ["TST"]);
assert.equal(report.schema_version, 2);
fs.rmSync(fixture, { recursive: true, force: true });
console.log("historical character role check passed");
```

- [ ] **Step 3: 运行测试并确认失败**

Run: `node scripts/check_historical_character_roles.mjs`

Expected: FAIL，提示 `role_archetypes`、`starting_country_keys` 或 `schema_version` 缺失。

- [ ] **Step 4: 实现角色身份提取**

在 `collectHistoricalTemplates` 中规范化角色身份：

```js
function roleArchetypes(body) {
  const explicit = scalarValue(body, "role").replace(/^character_role_/, "");
  return [...new Set([
    explicit,
    hasYesValue(body, "ruler") ? "ruler" : "",
    hasYesValue(body, "heir") ? "heir" : "",
  ].filter(Boolean))].sort();
}
```

把 `collectHistoryUsage` 的值改为 `{ files, country_keys }`，从历史文件的 `c:TAG` 外层范围关联其中的 `create_character.template`。角色行增加：

```js
role_archetypes: roleArchetypes(block.body),
starting_country_keys: [...usage.country_keys].sort(),
```

报告改为 `schema_version: 2`，统计增加 `rulers`、`heirs` 和 `starting_characters_with_country`。

- [ ] **Step 5: 运行身份测试和现有审计**

Run: `node scripts/check_historical_character_roles.mjs`

Expected: `historical character role check passed`。

Run:

```powershell
node scripts/audit_historical_characters.mjs --out output/historical-characters
node scripts/audit_culture_names.mjs --historical-report output/historical-characters/historical-characters.json --out output/culture-names
node scripts/build_character_board_data.mjs --version-dir site/versions/1.13.11
node scripts/check_character_board_contract.mjs
```

Expected: 审计仍生成 1,983 个角色；输出包含非零 `rulers`、`heirs` 和开局国家统计；现有角色契约通过。

- [ ] **Step 6: 提交角色身份基础**

```powershell
git add scripts/audit_historical_characters.mjs scripts/check_historical_character_roles.mjs site/versions/1.13.11/data-index.js
git add -f site/versions/1.13.11/data-characters.js
git commit -m "feat: extract historical character roles"
```

`output/` 是被忽略的审计产物，不加入提交；1.13.11 版本数据目录大部分被忽略，生成角色块必须使用 `git add -f`。

### Task 2: 建立关系复核模型与严格校验

**Files:**
- Create: `scripts/lib/historical_character_relations.mjs`
- Create: `scripts/check_historical_character_relations.mjs`
- Create: `scripts/data/historical-character-relation-reviews.json`

- [ ] **Step 1: 写复核文档失败测试**

创建 `scripts/check_historical_character_relations.mjs`，先以最小角色集合测试四种状态和六种记录类型。测试文件顶部定义固定资料依据与确认记录助手：

```js
import assert from "node:assert/strict";
import {
  publicRelationsFromReviews,
  validateRelationReviewDocument,
} from "./lib/historical_character_relations.mjs";

const characters = [
  { key: "RUS_nicholas_i" },
  { key: "RUS_alexander_ii" },
  { key: "RUS_alexander_iii" },
  { key: "RUS_nicholas_ii" },
];
const propertyByType = { parent: "P22", spouse: "P26", sibling: "P3373", dynasty: "P53" };
function evidenceFor(type) {
  if (type === "opening_succession") return [{
    kind: "game",
    title: "Fixture opening history",
    file: "common/history/characters/rus - russia.txt",
    locator: "c:RUS create_character blocks",
    accessed_at: "2026-08-21",
  }];
  if (type === "historical_succession") return [{
    kind: "wikipedia",
    title: "Fixture succession box",
    url: "https://en.wikipedia.org/wiki/Nicholas_I_of_Russia",
    locator: "Emperor of Russia succession box",
    accessed_at: "2026-08-21",
  }];
  return [{
    kind: "wikidata",
    title: "Fixture evidence",
    url: "https://www.wikidata.org/wiki/Q1",
    entity_id: "Q1",
    property_id: propertyByType[type],
    locator: `${propertyByType[type]} fixture statement`,
    accessed_at: "2026-08-21",
  }];
}
function confirmed(type, left, right, extra = {}) {
  const pair = type === "dynasty"
    ? { character_key: left, dynasty_key: right, dynasty_name_zh: "罗曼诺夫王朝", dynasty_name_en: "House of Romanov", time_range: "1825-1855" }
    : { character_keys: [left, right] };
  return {
    candidate_id: `${type}:${left}:${right}`,
    status: "confirmed",
    type,
    ...pair,
    ...extra,
    evidence: evidenceFor(type),
    reviewed_at: "2026-08-21",
    review_note: "Fixture confirmation with direct evidence.",
  };
}
const review = {
  schema_version: 1,
  records: [
    confirmed("parent", "RUS_nicholas_i", "RUS_alexander_ii"),
    confirmed("spouse", "RUS_alexander_ii", "RUS_nicholas_i"),
    confirmed("sibling", "RUS_alexander_iii", "RUS_alexander_ii"),
    confirmed("dynasty", "RUS_nicholas_i", "romanov"),
    confirmed("opening_succession", "RUS_nicholas_i", "RUS_alexander_ii", { polity_key: "RUS", opening_date: "1836.1.1" }),
    confirmed("historical_succession", "RUS_nicholas_i", "RUS_alexander_ii", {
      polity_key: "RUS",
      title_key: "emperor_of_russia",
      title_name_zh: "俄罗斯皇帝",
      title_name_en: "Emperor of Russia",
      time_range: "1825-1855",
    }),
  ],
};
const result = validateRelationReviewDocument(review, characters);
assert.equal(result.confirmed.length, 6);
assert.deepEqual(result.confirmed.find((item) => item.type === "spouse").character_keys, ["RUS_alexander_ii", "RUS_nicholas_i"]);
assert.equal(publicRelationsFromReviews(result).opening_successions.length, 1);
```

再加入拒绝断言：本人关系、不存在的角色键、无向关系倒序重复、同向父母重复、父母直接环、缺少国家或头衔的历史继位、缺少国家或开局日期的开局继承、资料依据未直接支持关系、未排序的 Wikidata 属性编号均应抛错。

- [ ] **Step 2: 运行测试并确认失败**

Run: `node scripts/check_historical_character_relations.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `historical_character_relations.mjs`。

- [ ] **Step 3: 实现复核模型**

模块导出以下接口：

```js
export const REVIEW_STATUSES = new Set(["pending", "confirmed", "conflict", "excluded"]);
export const RELATION_TYPES = new Set(["parent", "spouse", "sibling", "dynasty", "opening_succession", "historical_succession"]);
export function validateRelationReviewDocument(document, characters) {
  if (document.schema_version !== 1 || !Array.isArray(document.records)) throw new Error("Invalid relation review document");
  return validateAndNormalizeRecords(document.records, new Set(characters.map((item) => item.key)));
}
export function publicRelationsFromReviews(validated) {
  const confirmed = validated.confirmed;
  return {
    relationships: confirmed.filter((item) => ["parent", "spouse", "sibling"].includes(item.type)),
    dynasty_memberships: confirmed.filter((item) => item.type === "dynasty"),
    opening_successions: confirmed.filter((item) => item.type === "opening_succession"),
    historical_successions: confirmed.filter((item) => item.type === "historical_succession"),
    missing_relative_counts: aggregateMissingRelativeCounts(confirmed),
    stats: relationStats(validated),
  };
}
export function relationRecordKey(record) {
  if (["spouse", "sibling"].includes(record.type)) return `${record.type}:${[...record.character_keys].sort().join(":")}`;
  return directedRelationRecordKey(record);
}
```

同一文件内实现并导出测试需要的 `validateAndNormalizeRecords`、`aggregateMissingRelativeCounts`、`relationStats` 和 `directedRelationRecordKey`；各函数只承担名称所示职责，不在校验函数中读写文件或请求网络。

`evidence` 中每项强制包含 `kind`、`title`、`locator`、`accessed_at`；网络资料还需 `url`，游戏资料还需 `file`。Wikidata 依据需包含 `entity_id` 与 `property_id`。确认记录还需 `reviewed_at` 和非空 `review_note`。`publicRelationsFromReviews` 输出 `relationships`、`dynasty_memberships`、`opening_successions`、`historical_successions`、`missing_relative_counts` 和 `stats`。

- [ ] **Step 4: 创建空复核文档**

```json
{
  "schema_version": 1,
  "generated_from": "Wikidata, Wikipedia, biographical sources, and Victoria 3 game files",
  "records": []
}
```

- [ ] **Step 5: 运行模型测试**

Run: `node scripts/check_historical_character_relations.mjs`

Expected: `historical character relation model check passed`，并报告六种示例记录均通过、所有非法样例均被拒绝。

- [ ] **Step 6: 提交复核模型**

```powershell
git add scripts/lib/historical_character_relations.mjs scripts/check_historical_character_relations.mjs scripts/data/historical-character-relation-reviews.json
git commit -m "feat: define historical character relation reviews"
```

### Task 3: 生成君主家族候选与复核批次

**Files:**
- Create: `scripts/collect_historical_character_relation_candidates.mjs`
- Create: `scripts/build_historical_character_relation_review_batch.mjs`
- Create: `scripts/check_historical_character_relation_review_batch.mjs`
- Modify: `scripts/lib/historical_character_relations.mjs`

- [ ] **Step 1: 写候选与批次失败测试**

使用本地夹具代替网络请求，固定 Wikidata 属性映射：

```js
import assert from "node:assert/strict";
import { relationCandidatesFromEntities } from "./lib/historical_character_relations.mjs";

const properties = {
  P22: "father",
  P25: "mother",
  P26: "spouse",
  P40: "child",
  P3373: "sibling",
  P53: "dynasty",
  P39: "position_held",
};
const characters = [
  { key: "RUS_nicholas_i", role_archetypes: ["ruler"], starting_country_keys: ["RUS"] },
  { key: "RUS_alexander_ii", role_archetypes: ["heir"], starting_country_keys: ["RUS"] },
];
const fixtureEntities = new Map([
  ["Q130734", { id: "Q130734", claims: { P40: [{ target_id: "Q83171", rank: "normal" }] } }],
  ["Q83171", { id: "Q83171", claims: { P22: [{ target_id: "Q130734", rank: "normal" }] } }],
]);
const candidates = relationCandidatesFromEntities({
  characters,
  qidByCharacterKey: new Map([
    ["RUS_nicholas_i", "Q130734"],
    ["RUS_alexander_ii", "Q83171"],
  ]),
  entities: fixtureEntities,
});
assert.ok(candidates.some((item) => item.type === "parent"));
assert.ok(candidates.every((item) => item.status === "pending"));
assert.ok(candidates.every((item) => item.character_keys?.every((key) => characters.some((character) => character.key === key))));
assert.deepEqual(properties, {
  P22: "father", P25: "mother", P26: "spouse", P40: "child", P3373: "sibling", P53: "dynasty", P39: "position_held",
});
```

批次排序断言要求开局统治者、开局继承人、其近亲、其余王朝成员依次出现；`--limit 25` 必须严格输出 25 人以内。

- [ ] **Step 2: 运行测试并确认失败**

Run: `node scripts/check_historical_character_relation_review_batch.mjs`

Expected: FAIL，提示候选生成或批次构建函数缺失。

- [ ] **Step 3: 实现身份编号合并**

候选脚本读取角色审计和 `site/versions/1.13.11/data-character-images.js`。图片输入是 `window.VIC3_DATA_CHUNK` 数据块，脚本也接受先前生成的 JSON 图片报告。先建立已有编号：

```js
const qidByCharacterKey = new Map(
  imageRecords.flatMap((person) => person.character_keys.map((key) => [key, person.wikidata_id])),
);
```

没有编号的统治者和继承人使用英文名、出生年份、国家和头衔查询 Wikidata。只有唯一候选满足姓名或别名一致，并由出生年份、国家、头衔或已确认亲属至少一项辅助确认时，才建立人物对应；其余条目进入 `identity_review`，不能生成正式关系。

- [ ] **Step 4: 实现串行 Wikidata 采集**

请求只读取 `P22`、`P25`、`P26`、`P40`、`P3373`、`P53`、`P39`。每次请求之间至少等待六秒，遇到 `429` 时读取 `Retry-After`，最多重试五次；任一请求最终失败时保存已完成的检查点并退出非零。候选输出包含：

```js
{
  schema_version: 1,
  generated_at: new Date().toISOString(),
  source_character_report: "output/historical-characters/historical-characters.json",
  people: people.sort(comparePeople),
  candidates: candidates.sort(compareCandidates),
  identity_review: identityReview.sort(comparePeople),
  missing_endpoints: missingEndpoints.sort(compareCandidates),
  stats: { rulers, heirs, qid_matches, pending_relations, identity_review, missing_endpoints },
}
```

历史继位只从可明确对应某项 `P39` 任职的资料生成候选。Wikidata 没有直接表达该头衔前任或继任时，记录进入人工资料检索队列，不能根据出生顺序推断。

游戏开局继承从同一开局国家中已实例化的 `ruler` 与 `heir` 配对。只有该国家恰有一名统治者和一名继承人时才自动生成候选；出现多名统治者、多名继承人或角色同时带有两种身份时，写入 `opening_succession_review`，不能自行选择一对。

- [ ] **Step 5: 实现优先批次**

`build_historical_character_relation_review_batch.mjs` 接收 `--input`、`--reviews`、`--out` 和 `--limit`，排除复核文档中已有终态的候选，再按开局统治者、开局继承人、双方近亲和同王朝成员排序。批次保留人物对应证据、关系依据、缺失端点和建议的 Wikipedia 查询链接。

- [ ] **Step 6: 运行夹具测试与首轮网络采集**

Run: `node scripts/check_historical_character_relation_review_batch.mjs`

Expected: `historical character relation review batch check passed`。

Run:

```powershell
node scripts/collect_historical_character_relation_candidates.mjs --characters output/historical-characters/historical-characters.json --images site/versions/1.13.11/data-character-images.js --out output/historical-character-relations/candidates.json --checkpoint output/historical-character-relations/checkpoint.json
node scripts/build_historical_character_relation_review_batch.mjs --input output/historical-character-relations/candidates.json --reviews scripts/data/historical-character-relation-reviews.json --out output/historical-character-relations/review-batch-001.json --limit 25
```

Expected: 首轮候选和最多 25 人的复核批次生成成功；统计中的 `rulers`、`heirs`、`qid_matches` 均大于零；没有候选因同姓单独确认。

- [ ] **Step 7: 提交采集工具**

```powershell
git add scripts/collect_historical_character_relation_candidates.mjs scripts/build_historical_character_relation_review_batch.mjs scripts/check_historical_character_relation_review_batch.mjs scripts/lib/historical_character_relations.mjs
git commit -m "feat: collect royal relation candidates"
```

生成的检查点和批次文件保留为工作产物，不加入提交。

### Task 4: 串行复核全部君主家族范围

**Files:**
- Modify: `scripts/data/historical-character-relation-reviews.json`
- Create: `docs/worklog/2026-08-21-historical-character-relations.md`

- [ ] **Step 1: 串行核对人物身份与关系**

逐项处理 `review-batch-001.json`。优先读取 Wikidata 陈述，再检查对应 Wikipedia 人物页的信息框、正文和继承框；存在歧义时使用人物传记或王室谱系资料。每项决定写成以下格式：

```json
{
  "candidate_id": "parent:RUS_nicholas_i:RUS_alexander_ii",
  "status": "confirmed",
  "type": "parent",
  "character_keys": ["RUS_nicholas_i", "RUS_alexander_ii"],
  "person_matches": [
    { "character_key": "RUS_nicholas_i", "wikidata_id": "Q130734", "basis": ["name", "birth_year", "title"] },
    { "character_key": "RUS_alexander_ii", "wikidata_id": "Q83171", "basis": ["name", "birth_year", "country"] }
  ],
  "evidence": [
    {
      "kind": "wikidata",
      "title": "Nicholas I of Russia",
      "url": "https://www.wikidata.org/wiki/Q130734",
      "entity_id": "Q130734",
      "property_id": "P40",
      "locator": "child statement Q83171",
      "accessed_at": "2026-08-21"
    }
  ],
  "reviewed_at": "2026-08-21",
  "review_note": "人物身份和父子关系均有直接陈述支持。"
}
```

实际复核时以实时条目为准；示例编号只能作为格式示意，写入前必须再次打开条目确认。

- [ ] **Step 2: 记录冲突、排除与缺失端点**

身份或关系冲突使用 `status: "conflict"` 并保留互相冲突的资料；错误对应使用 `status: "excluded"` 和 `excluded_reason`。只有一端进入角色库的确认关系增加 `missing_endpoint`，公开数据只提取关系类别与人数，不能带出未收录人物姓名。

- [ ] **Step 3: 运行复核文档校验**

Run: `node scripts/check_historical_character_relations.mjs --reviews scripts/data/historical-character-relation-reviews.json --characters output/historical-characters/historical-characters.json`

Expected: 退出码为 0；至少有父母、王朝和继位三类已确认记录；`pending`、`conflict`、`excluded` 与缺失端点统计同复核文档一致。

- [ ] **Step 4: 生成下一批并检查去重**

Run:

```powershell
node scripts/build_historical_character_relation_review_batch.mjs --input output/historical-character-relations/candidates.json --reviews scripts/data/historical-character-relation-reviews.json --out output/historical-character-relations/review-batch-002.json --limit 25
```

Expected: 第二批不包含第一批已有终态的 `candidate_id`。

- [ ] **Step 5: 串行完成君主范围的其余批次**

每次只打开一个最多 25 人的批次，完成复核、运行校验、提交复核文档，再生成下一批。批次中每位统治者或继承人都要检查人物身份、父母、配偶、子女、兄弟姐妹、王朝、开局继承和各项君主头衔的历史继位；资料没有明确陈述时记录为 `conflict` 或 `excluded`，不能留作无说明的空项。循环终止条件由批次构建器报告：

```js
assert.equal(batch.stats.unreviewed_royal_people, 0);
assert.equal(batch.stats.unreviewed_priority_candidates, 0);
assert.equal(batch.people.length, 0);
```

`unreviewed_royal_people` 指所有已从游戏识别的统治者和继承人中，尚未获得 `confirmed`、`conflict` 或 `excluded` 人物身份终态者；`unreviewed_priority_candidates` 指这些人物范围内尚未获得终态的亲属、王朝、开局继承和历史继位候选。仍缺少现有角色端点的关系可以作为 `missing_endpoint` 终态保留。

- [ ] **Step 6: 写复核工作记录并提交**

工作记录写明采集日期、游戏分支、已完成批次数、已确认各类关系数量、冲突数、排除数、缺失端点数，并注明君主范围的未复核人物与优先候选均为零、第一阶段只连接现有角色。

```powershell
git add scripts/data/historical-character-relation-reviews.json docs/worklog/2026-08-21-historical-character-relations.md
git commit -m "data: review royal character relations"
```

### Task 5: 构建公开关系数据块

**Files:**
- Create: `scripts/build_historical_character_relations.mjs`
- Modify: `scripts/check_historical_character_relations.mjs`
- Modify: `scripts/build_character_board_data.mjs`
- Create: `site/versions/1.13.11/data-character-relations.js`
- Modify: `site/versions/1.13.11/data-index.js`

- [ ] **Step 1: 写构建失败测试**

在关系测试中用含四种状态的夹具执行构建器，并断言公开块：

```js
assert.deepEqual(Object.keys(chunk).sort(), [
  "historicalCharacterDynastyMemberships",
  "historicalCharacterMissingRelativeCounts",
  "historicalCharacterOpeningSuccessions",
  "historicalCharacterRelationStats",
  "historicalCharacterRelationships",
  "historicalCharacterSuccessions",
]);
assert.equal(JSON.stringify(chunk).includes('"status":"pending"'), false);
assert.equal(JSON.stringify(chunk).includes("Unstored Person Name"), false);
assert.ok(index.chunks["character-relations"].files.includes("data-character-relations.js"));
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node scripts/check_historical_character_relations.mjs`

Expected: FAIL，提示构建脚本或 `character-relations` 数据块缺失。

- [ ] **Step 3: 实现正式构建器**

构建器读取角色报告和复核文档，调用 `validateRelationReviewDocument` 与 `publicRelationsFromReviews`，写出报告和站点块：

```js
writeChunk(outputChunk, {
  historicalCharacterRelationships: result.relationships,
  historicalCharacterDynastyMemberships: result.dynasty_memberships,
  historicalCharacterOpeningSuccessions: result.opening_successions,
  historicalCharacterSuccessions: result.historical_successions,
  historicalCharacterMissingRelativeCounts: result.missing_relative_counts,
  historicalCharacterRelationStats: result.stats,
});
```

默认报告路径为 `output/historical-character-relations/historical-character-relations.json`，默认站点路径为 `site/versions/1.13.11/data-character-relations.js`。

- [ ] **Step 4: 登记独立数据块**

`build_character_board_data.mjs` 在角色块之外写入：

```js
index.chunks["character-relations"] = {
  files: ["data-character-relations.js"],
  keys: [
    "historicalCharacterRelationships",
    "historicalCharacterDynastyMemberships",
    "historicalCharacterOpeningSuccessions",
    "historicalCharacterSuccessions",
    "historicalCharacterMissingRelativeCounts",
    "historicalCharacterRelationStats",
  ],
  counts: result.stats,
};
```

为 `zh-Hans` 和 `en` 登记空的 `character-relations` 本地化分块；界面词条由共享本地化文件提供。

- [ ] **Step 5: 运行构建与校验**

Run:

```powershell
node scripts/build_historical_character_relations.mjs
node scripts/check_historical_character_relations.mjs
node scripts/check_multilingual_bundles.mjs --site-version site/versions/1.13.11
```

Expected: 公开数据只包含已确认记录；所有角色键存在；无向关系没有重复；索引计数与数组长度一致；多语言数据索引检查通过。

- [ ] **Step 6: 提交公开数据基础**

```powershell
git add scripts/build_historical_character_relations.mjs scripts/build_character_board_data.mjs scripts/check_historical_character_relations.mjs site/versions/1.13.11/data-index.js
git add -f site/versions/1.13.11/data-character-relations.js
git commit -m "feat: build historical character relations"
```

### Task 6: 接入详情路由按需加载

**Files:**
- Modify: `site/app/runtime.js`
- Modify: `site/app/data.js`
- Modify: `scripts/check_character_board_contract.mjs`

- [ ] **Step 1: 写按需加载失败契约**

加入静态断言：

```js
assert.match(runtime, /let historicalCharacterRelationships = \[\];/);
assert.match(runtime, /characterRelationLoadError:\s*""/);
assert.match(data, /parts\[0\] === "character" && parts\[1][\s\S]*chunkKeys\.push\("character-relations"\)/);
assert.match(data, /historicalCharacterRelationshipByCharacter = new Map\(/);
assert.match(data, /state\.characterRelationLoadError/);
```

- [ ] **Step 2: 运行契约并确认失败**

Run: `node scripts/check_character_board_contract.mjs`

Expected: FAIL，提示关系运行时状态和详情路由分块缺失。

- [ ] **Step 3: 增加运行时数据与索引**

`runtime.js` 增加六个公开数组或对象，在 `state` 中增加 `characterRelationLoadError: ""`，并建立以下索引：

```js
let historicalCharacterRelationshipByCharacter = new Map();
let historicalCharacterDynastyByCharacter = new Map();
let historicalCharacterDynastyMembersByKey = new Map();
let historicalCharacterOpeningSuccessionByCharacter = new Map();
let historicalCharacterSuccessionByCharacter = new Map();
let historicalCharacterMissingRelativeCountByCharacter = new Map();
```

`applyLoadedDataset` 读取关系字段，并同时为关系两端建立索引。无关系数据时所有集合为空，不能影响角色列表。

- [ ] **Step 4: 让详情路由单独加载关系块**

在 `dataChunksForCurrentRoute` 中增加：

```js
if (parts[0] === "character" && parts[1]) chunkKeys.push("character-relations");
```

沿用需求表的可恢复错误模式：关系块失败时写入 `state.characterRelationLoadError`，不抛出到整个页面；重新成功加载后清空错误。`#/character` 列表路由不能加载关系块。

- [ ] **Step 5: 运行契约**

Run: `node scripts/check_character_board_contract.mjs`

Expected: `character board contract check passed`。

- [ ] **Step 6: 提交按需加载**

```powershell
git add site/app/runtime.js site/app/data.js scripts/check_character_board_contract.mjs
git commit -m "feat: load character relations on details"
```

### Task 7: 渲染关系概览与王朝成员

**Files:**
- Create: `site/app/character-relations.js`
- Modify: `site/app/characters.js`
- Modify: `site/index.html`
- Modify: `site/locales/ui.zh-Hans.js`
- Modify: `site/locales/ui.en.js`
- Modify: `scripts/check_character_board_contract.mjs`

- [ ] **Step 1: 写概览失败契约**

加入以下断言：

```js
assert.match(characterRelations, /function renderHistoricalCharacterRelationOverview\(/);
assert.match(characterRelations, /character-relation-overview/);
assert.match(characterRelations, /data-related-character-key=/);
assert.match(characterRelations, /data-character-dynasty=/);
assert.match(characters, /renderHistoricalCharacterRelations\(character\)/);
assert.match(html, /app\/character-relations\.js/);
```

- [ ] **Step 2: 运行契约并确认失败**

Run: `node scripts/check_character_board_contract.mjs`

Expected: FAIL，提示关系渲染器和脚本登记缺失。

- [ ] **Step 3: 实现关系视图模型**

`character-relations.js` 导出全局函数使用的辅助逻辑：

```js
function historicalCharacterRelationsFor(characterKey) {
  return {
    parents: [],
    spouses: [],
    siblings: [],
    children: [],
    dynasties: historicalCharacterDynastyByCharacter.get(characterKey) || [],
    missing: historicalCharacterMissingRelativeCountByCharacter.get(characterKey) || {},
  };
}
```

父母关系根据当前角色在 `parent_key` 或 `child_key` 的位置派生父母和子女；性别只用于显示“父亲/母亲”，不能用于改变关系事实。所有人物链接使用 `data-related-character-key`，王朝按钮使用 `data-character-dynasty`。

- [ ] **Step 4: 实现 Wikipedia 式概览**

渲染顺序固定为王朝、父亲、母亲、父母中性项、配偶、子女、兄弟姐妹。没有该类关系时省略该行；缺失端点在对应行末显示 `另有 {count} 人未收录`。王朝按钮展开当前王朝已确认成员，成员按出生日期再按名称排序，点击后进入相应详情。

主入口：

```js
function renderHistoricalCharacterRelations(character) {
  if (state.characterRelationLoadError) return renderHistoricalCharacterRelationError();
  const model = historicalCharacterRelationsFor(character.key);
  if (!historicalCharacterRelationModelHasContent(model)) return "";
  return `<section class="character-relations">
    ${renderHistoricalCharacterRelationOverview(character, model)}
    ${renderHistoricalCharacterFamilyTree(character, model)}
    ${renderHistoricalCharacterSuccessions(character)}
  </section>`;
}
```

- [ ] **Step 5: 接入详情与事件**

在 `renderHistoricalCharacterDetail` 的现有字段和特质之后调用 `${renderHistoricalCharacterRelations(character)}`。详情写入后绑定一次事件委托：人物按钮调用 `replaceHash('/character/' + encodeURIComponent(key))` 后执行 `applyHash().then(render)`；王朝按钮只切换当前详情内的成员区和 `aria-expanded`。

- [ ] **Step 6: 加入双语词条和脚本顺序**

中文至少包含“人物关系概览、王朝、父亲、母亲、父母、配偶、子女、兄弟姐妹、另有 {count} 人未收录、王朝成员、关系资料加载失败”。英文提供对应文本。`site/index.html` 在 `characters.js` 之前加载 `app/character-relations.js`，并更新两个角色脚本的缓存键。

- [ ] **Step 7: 运行契约并提交**

Run:

```powershell
node --check site/app/character-relations.js
node --check site/app/characters.js
node scripts/check_character_board_contract.mjs
```

Expected: 所有命令退出码为 0。

```powershell
git add site/app/character-relations.js site/app/characters.js site/index.html site/locales/ui.zh-Hans.js site/locales/ui.en.js scripts/check_character_board_contract.mjs
git commit -m "feat: show character relation overview"
```

### Task 8: 渲染局部家族图与继承框

**Files:**
- Modify: `site/app/character-relations.js`
- Modify: `site/styles/characters.css`
- Modify: `site/styles.css`
- Modify: `site/locales/ui.zh-Hans.js`
- Modify: `site/locales/ui.en.js`
- Modify: `scripts/check_character_board_contract.mjs`

- [ ] **Step 1: 写家族图与继承框失败契约**

```js
assert.match(characterRelations, /character-family-tree/);
assert.match(characterRelations, /<details[^>]+character-family-tree-section/);
assert.match(characterRelations, /character-succession-box/);
assert.match(characterRelations, /character-opening-succession/);
assert.match(characterRelations, /character-relation-evidence/);
assert.match(styles, /overflow-x:\s*auto/);
assert.match(styles, /@media \(max-width: 760px\)[\s\S]*character-family-tree/);
```

- [ ] **Step 2: 运行契约并确认失败**

Run: `node scripts/check_character_board_contract.mjs`

Expected: FAIL，提示局部家族图、继承框或响应式样式缺失。

- [ ] **Step 3: 实现默认折叠的局部家族图**

家族图只使用概览视图模型，绘制父母、兄弟姐妹、当前人物、配偶和子女，不再查询下一代。结构使用语义化 `details`：

```html
<details class="character-family-tree-section">
  <summary>局部家族图</summary>
  <div class="character-family-tree-scroll">
    <div class="character-family-tree">
      <div class="character-family-group character-family-parents"></div>
      <div class="character-family-group character-family-current"></div>
      <div class="character-family-group character-family-children"></div>
    </div>
  </div>
</details>
```

当前角色节点使用 `aria-current="true"`。关系过多时组件内部滚动，组件不得设置大于详情宽度的固定宽度。

- [ ] **Step 4: 实现按头衔分开的历史继承框**

每条 `historical_succession` 独立渲染：

```html
<div class="character-succession-box">
  ${renderSuccessionPerson(t("board.character.relations.predecessor"), predecessor)}
  <div class="character-succession-office"><span>${escapeHtml(title)}</span><strong>${escapeHtml(historicalCharacterName(character))}</strong><small>${escapeHtml(dateRange)}</small></div>
  ${renderSuccessionPerson(t("board.character.relations.successor"), successor)}
</div>
```

`renderSuccessionPerson` 内部调用 `renderRelatedCharacterButton` 生成真实角色键和本地化姓名；人物缺失时返回本地化的“未收录”文本。

当前角色可能是前任或继任，视图模型应把链条定位到当前角色并显示相邻人物。缺少一端时使用缺失说明。游戏开局继承使用独立 `.character-opening-succession`，显示国家、开局统治者、指定继承人和 1836.1.1。

- [ ] **Step 5: 实现资料依据折叠区**

每个关系区域使用 `<details class="character-relation-evidence">`，按来源列出标题、定位字段、适用国家或头衔、时间范围和“已确认”。网络资料用带 `target="_blank" rel="noopener noreferrer"` 的链接；游戏文件用可换行的 `code`，不把本机绝对路径写入网页。

- [ ] **Step 6: 实现桌面与窄屏样式**

桌面端概览使用 `120px minmax(0, 1fr)` 两列，家族图滚动容器使用 `max-width: 100%; overflow-x: auto;`，继承框使用三列。`max-width: 760px` 时概览标签列缩至 92px，家族图改为单列分组，继承框改为一列并去掉左右边线。更新 `site/styles.css` 的角色样式缓存键。

- [ ] **Step 7: 运行契约并提交**

Run:

```powershell
node --check site/app/character-relations.js
node scripts/check_character_board_contract.mjs
```

Expected: 所有命令退出码为 0。

```powershell
git add site/app/character-relations.js site/styles/characters.css site/styles.css site/locales/ui.zh-Hans.js site/locales/ui.en.js scripts/check_character_board_contract.mjs
git commit -m "feat: render royal family and succession"
```

### Task 9: 浏览器验收、错误路径与回归检查

**Files:**
- Modify: `scripts/check_character_board_browser.mjs`
- Modify: `docs/worklog/2026-08-21-historical-character-relations.md`

- [ ] **Step 1: 写桌面浏览器失败断言**

使用第一批数据中实际满足条件的角色键，不能硬编码未收录亲属。断言包括：

```js
const relationDetail = await desktop.evaluate(() => ({
  overview: Boolean(document.querySelector(".character-relation-overview")),
  treeOpen: document.querySelector(".character-family-tree-section")?.open,
  successionBoxes: document.querySelectorAll(".character-succession-box").length,
  documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
}));
assert.equal(relationDetail.overview, true);
assert.equal(relationDetail.treeOpen, false);
assert.ok(relationDetail.successionBoxes >= 1);
assert.equal(relationDetail.documentOverflow, false);
```

再点击一个 `data-related-character-key`，确认哈希与详情标题更新；点击王朝按钮，确认成员区展开；打开资料依据，确认外部链接和游戏文件定位可见。

- [ ] **Step 2: 写按需加载与失败恢复断言**

访问 `#/character` 时检查没有请求 `data-character-relations.js`；访问 `#/character/<key>` 后检查请求出现。测试服务器对关系数据块返回一次 404 时，详情仍显示姓名、肖像或基本字段，并出现 `.character-relation-load-error`；恢复文件后重新进入详情，错误提示消失。

- [ ] **Step 3: 写窄屏和长姓名断言**

在 390×844 打开包含关系的角色，展开家族图并断言：

```js
assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
assert.equal(await mobile.evaluate(() => getComputedStyle(document.querySelector(".character-family-tree")).gridTemplateColumns), "1fr");
assert.equal(await mobile.evaluate(() => getComputedStyle(document.querySelector(".character-succession-box")).gridTemplateColumns), "1fr");
```

在 2048×1024 检查详情宽度不低于现有 560px，列表与详情不重叠，家族图滚动限制在详情内部。切换英文后检查关系标题和继承标签变为英文。

- [ ] **Step 4: 运行浏览器测试并确认新断言先失败**

在加入实现前的提交上运行一次，或临时注释数据块登记进行失败验证：

Run: `node scripts/check_character_board_browser.mjs --screenshot-dir screenshots/historical-character-relations`

Expected: FAIL，明确指出缺少关系概览或关系数据请求。

- [ ] **Step 5: 运行完整验证**

Run:

```powershell
node --check site/app/runtime.js
node --check site/app/data.js
node --check site/app/character-relations.js
node --check site/app/characters.js
node scripts/check_historical_character_roles.mjs
node scripts/check_historical_character_relations.mjs
node scripts/check_historical_character_relation_review_batch.mjs
node scripts/check_character_board_contract.mjs
node scripts/check_economy_board_contract.mjs
node scripts/check_character_board_browser.mjs --screenshot-dir screenshots/historical-character-relations
```

Expected: 所有命令退出码为 0；角色浏览器报告仍为 1,983 个角色和 317 个姓名池，并新增已确认关系统计。

- [ ] **Step 6: 检查截图并更新工作记录**

查看宽屏和 390px 截图，确认关系概览可扫描、家族图默认折叠、展开后不撑宽页面、继承框按头衔分开、长姓名换行正常、资料依据可读。工作记录补充最终关系数、王朝成员数、开局继承数、历史继位数、缺失端点数和全部验证命令。

- [ ] **Step 7: 提交验收与记录**

```powershell
git add scripts/check_character_board_browser.mjs docs/worklog/2026-08-21-historical-character-relations.md
git commit -m "test: verify historical character relations"
```

截图属于验证产物，不加入提交。

### Task 10: 最终审查与集成准备

**Files:**
- Review only: all files changed by Tasks 1–9

- [ ] **Step 1: 检查提交范围和未跟踪文件**

Run:

```powershell
git status --short --branch
git log --oneline --decorate main..HEAD
git diff --stat main...HEAD
git diff --check main...HEAD
```

Expected: 工作树干净；提交只包含本计划列出的角色关系文件、生成数据和工作记录；不包含主工作区现有的经济、公司或军事改动。

- [ ] **Step 2: 复核数据边界**

Run:

```powershell
node scripts/check_historical_character_relations.mjs
rg -n '"status":"(pending|conflict|excluded)"|missing_endpoint.*name|[A-Z]:\\\\' site/versions/1.13.11/data-character-relations.js
```

Expected: 校验通过；`rg` 无输出，证明候选状态、未收录人物姓名和本机绝对路径没有进入公开数据。

- [ ] **Step 3: 请求代码审查**

调用 `superpowers:requesting-code-review`，重点检查人物对应证据、关系方向、无向去重、按需加载错误恢复、移动端页面溢出和未收录人物隐私边界。审查发现的问题按 `superpowers:receiving-code-review` 复核后修正，并重新运行受影响测试。

- [ ] **Step 4: 运行最终验证**

Run:

```powershell
node scripts/check_historical_character_roles.mjs
node scripts/check_historical_character_relations.mjs
node scripts/check_historical_character_relation_review_batch.mjs
node scripts/check_character_board_contract.mjs
node scripts/check_economy_board_contract.mjs
node scripts/check_character_board_browser.mjs
git diff --check main...HEAD
```

Expected: 全部退出码为 0。

- [ ] **Step 5: 准备集成选择**

调用 `superpowers:finishing-a-development-branch`，报告独立工作树分支、提交范围、已确认关系统计、仍待复核数量和验证结果。未经用户选择，不合并到主分支、不推送远端、不部署站点。
