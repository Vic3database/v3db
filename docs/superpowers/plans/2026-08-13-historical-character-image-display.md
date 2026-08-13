# Historical Character Image Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在角色列表标出已有史实图片的角色，并在角色详情显示图片及来源信息。

**Architecture:** 复用 `data.js` 已建立的 `byHistoricalCharacterImage` 索引，由 `characters.js` 完成条件渲染。界面词条进入现有双语界面本地化文件，`characters.css` 只增加角色图片卡片和标签所需样式。

**Tech Stack:** 原生 JavaScript、CSS、自定义 Node.js 契约校验、Chrome DevTools Protocol 浏览器校验。

---

### Task 1: 固化界面契约

**Files:**
- Modify: `scripts/check_character_board_contract.mjs`
- Modify: `scripts/check_character_board_browser.mjs`

- [ ] **Step 1: Write the failing contract assertions**

在静态契约中加入以下断言：

```js
assert.match(characters, /byHistoricalCharacterImage\.get\(character\.key\)/, "character UI must read the historical image index");
assert.match(characters, /board\.character\.hasHistoricalImage/, "character rows must label confirmed historical images");
assert.match(characters, /character-historical-image/, "character details must render confirmed historical images");
assert.match(characters, /image\.thumbnail_url/, "character details must use the collected thumbnail");
assert.match(characters, /image\.file_page/, "character details must link to the Commons file page");
```

- [ ] **Step 2: Run the contract check to verify it fails**

Run: `node scripts/check_character_board_contract.mjs`

Expected: FAIL，提示缺少“有史实图片”标签或详情图片渲染。

- [ ] **Step 3: Add browser expectations**

浏览器校验使用数据中的首个已确认模板，并加入以下页面结果与断言：

```js
const imageDetail = await desktop.evaluate(() => {
  const figure = document.querySelector(".character-historical-image");
  const image = figure?.querySelector("img");
  const source = figure?.querySelector('a[href*="commons.wikimedia.org"]');
  return { complete: image?.complete, naturalWidth: image?.naturalWidth || 0, source: source?.href || "" };
});
assert.equal(imageDetail.complete, true);
assert.ok(imageDetail.naturalWidth > 0);
assert.match(imageDetail.source, /^https:\/\/commons\.wikimedia\.org\//);
```

### Task 2: 实现图片与标签

**Files:**
- Modify: `site/app/characters.js`
- Modify: `site/locales/ui.zh-Hans.js`
- Modify: `site/locales/ui.en.js`
- Modify: `site/styles/characters.css`

- [ ] **Step 1: Implement localized image metadata helpers**

增加图片类型标签和可选元数据行渲染：

```js
function historicalCharacterImageTypeLabel(type) {
  return t(`board.character.imageType.${String(type || "")}`, String(type || ""));
}
```

- [ ] **Step 2: Add the list tag**

`characterListRow` 通过索引决定是否追加标签：

```js
const historicalImage = byHistoricalCharacterImage.get(character.key);
const badges = [
  historicalImage ? tagPill(t("board.character.hasHistoricalImage"), "tag-historical-image") : "",
];
```

- [ ] **Step 3: Add the detail figure**

`renderHistoricalCharacterDetail` 从索引读取图片记录，并通过以下接口生成内容：

```js
function renderHistoricalCharacterImage(record, character) {
  const image = record?.image;
  if (!image?.thumbnail_url || !image?.file_page) return "";
  return `<figure class="character-historical-image">...</figure>`;
}
```

详情模板在标题与字段表格之间调用：

```js
${renderHistoricalCharacterImage(byHistoricalCharacterImage.get(character.key), character)}
```

- [ ] **Step 4: Add responsive styles and translations**

图片样式包含以下约束：

```css
.character-historical-image img {
  display: block;
  width: 100%;
  max-height: 460px;
  object-fit: contain;
}
```

双语界面文件加入 `board.character.hasHistoricalImage`、`board.character.imageType.*`、`board.character.image.*` 词条。

- [ ] **Step 5: Run the contract check to verify it passes**

Run: `node scripts/check_character_board_contract.mjs`

Expected: `character board contract check passed`

### Task 3: 验证实际页面并记录结果

**Files:**
- Modify: `docs/worklog/2026-08-13-historical-character-images.md`

- [ ] **Step 1: Run syntax, data, and browser checks**

Run: `node --check site/app/characters.js`

Run: `node scripts/check_historical_character_image_data.mjs`

Run: `node scripts/check_character_board_browser.mjs`

Expected: 所有命令退出码为 0，图片数据仍为 390 人、393 个模板，浏览器校验报告成功。

- [ ] **Step 2: Inspect desktop and mobile screenshots**

保存浏览器截图后检查 `.character-historical-image` 的图片完整显示、说明文字可读、列表与详情互不重叠，并通过以下断言检查移动端宽度：

```js
assert.ok(figure.right <= detail.right && figure.left >= detail.left, "mobile historical image must stay inside detail panel");
```

- [ ] **Step 3: Update the worklog and commit selected files**

记录显示规则与验证结果，只暂存本功能涉及的文件，提交信息使用 `feat: show historical character images`。
