# Vicdata Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first redesign slice for Vicdata: two-level navigation, homepage, global search dialog, placeholder entity badges, the redesigned country filter column, and country detail routing.

**Architecture:** Keep the existing vanilla JavaScript single-page app and static data files. Add contract checks first, then update the HTML shell, app state/routing/rendering, and CSS while preserving the current version loader, map runtime, dataset shape, and existing board renderers. The first implementation keeps non-country boards functional but focuses the new detail route and filter ordering on the country board.

**Tech Stack:** Vanilla JavaScript, static HTML/CSS, Node.js check scripts, existing local static server.

---

### Task 1: Redesign Contract Checks

**Files:**
- Modify: `scripts/check_ui_ideology_contracts.mjs`
- Test: `scripts/check_ui_ideology_contracts.mjs`

- [ ] **Step 1: Add failing contract checks**

Add a new `checkRedesignContracts()` call after `checkDarkThemeContracts();` and before `checkIdeologyContracts();`.

Add this function near the other check functions:

```js
function checkRedesignContracts() {
  assert(/class="[^"]*\bapp-rail\b/.test(indexSource), "left board rail is missing");
  for (const view of ["home", "country", "region", "culture", "company", "ideology"]) {
    assert(new RegExp(`data-nav-view="${view}"`).test(indexSource), `board rail entry for ${view} is missing`);
  }
  assert(/id="settingsNavButton"/.test(indexSource), "settings rail entry is missing");
  assert(/id="globalSearchButton"/.test(indexSource), "global search icon button is missing");
  assert(/id="globalSearchDialog"/.test(indexSource), "global search dialog is missing");
  assert(/id="globalSearchDialogInput"/.test(indexSource), "global search dialog input is missing");
  assert(/id="globalSearchLegacyToggle"/.test(indexSource), "global search legacy-version toggle is missing");
  assert(!/id="globalSearchInput"/.test(indexSource), "inline topbar global search input should be removed");
  assert(/value="home"/.test(indexSource), "view select should include home");
  assert(/function\s+renderHomeBoard\s*\(/.test(appSource), "home board renderer is missing");
  assert(/function\s+openGlobalSearchDialog\s*\(/.test(appSource), "global search dialog opener is missing");
  assert(/function\s+closeGlobalSearchDialog\s*\(/.test(appSource), "global search dialog closer is missing");
  assert(/function\s+renderEntityBadge\s*\(/.test(appSource), "entity badge renderer is missing");
  assert(/function\s+renderCountryDetailPage\s*\(/.test(appSource), "country detail page renderer is missing");
  assert(/countryTypeFilters/.test(indexSource), "merged country type filter container is missing");
  assert(!/whiteDecentralizedToggle/.test(indexSource), "white decentralized toggle should move out of the country filter column");
  assert(/body\[data-theme="dark"\]\s*{[\s\S]*--bg:\s*#[0-9a-fA-F]{6}/.test(styleSource), "dark theme background token is missing");
  assert(/\.global-search-dialog/.test(styleSource), "global search dialog styles are missing");
  assert(/\.entity-badge/.test(styleSource), "entity badge styles are missing");
}
```

- [ ] **Step 2: Run the contract check and verify RED**

Run:

```powershell
node scripts\check_ui_ideology_contracts.mjs
```

Expected: exit code `1`, with failures about missing rail, dialog, home renderer, entity badge renderer, country detail page renderer, and merged country type filter.

- [ ] **Step 3: Commit the failing check**

Run:

```powershell
git add -- scripts\check_ui_ideology_contracts.mjs
git commit -m "Add Vicdata redesign contracts"
```

### Task 2: HTML Shell For Rail, Home, Search Dialog, And Country Filters

**Files:**
- Modify: `site/index.html`
- Test: `scripts/check_ui_ideology_contracts.mjs`

- [ ] **Step 1: Update the topbar controls**

Replace the topbar search label with an icon button:

```html
<button id="globalSearchButton" class="topbar-icon-button" type="button" aria-label="全站搜索" title="全站搜索">⌕</button>
```

Add a `home` option to `#viewSelect` before `country`:

```html
<option value="home">首页</option>
```

- [ ] **Step 2: Add the board rail**

Inside `<main class="layout">`, before `#mapPanel`, add:

```html
<nav class="app-rail" aria-label="资料板块">
  <div class="app-rail-main">
    <button class="rail-item" type="button" data-nav-view="home" aria-label="首页" title="首页"><span class="rail-icon">⌂</span><span class="rail-label">首页</span></button>
    <button class="rail-item" type="button" data-nav-view="country" aria-label="国家" title="国家"><span class="rail-icon">⚑</span><span class="rail-label">国家</span></button>
    <button class="rail-item" type="button" data-nav-view="region" aria-label="地区" title="地区"><span class="rail-icon">◌</span><span class="rail-label">地区</span></button>
    <button class="rail-item" type="button" data-nav-view="culture" aria-label="文化" title="文化"><span class="rail-icon">◇</span><span class="rail-label">文化</span></button>
    <button class="rail-item" type="button" data-nav-view="company" aria-label="公司" title="公司"><span class="rail-icon">▣</span><span class="rail-label">公司</span></button>
    <button class="rail-item" type="button" data-nav-view="ideology" aria-label="意识形态" title="意识形态"><span class="rail-icon">✦</span><span class="rail-label">意识形态</span></button>
  </div>
  <button id="settingsNavButton" class="rail-item rail-settings" type="button" aria-label="设置" title="设置"><span class="rail-icon">⚙</span><span class="rail-label">设置</span></button>
</nav>
```

- [ ] **Step 3: Add the global search dialog**

After `<div id="conceptTooltip" class="concept-tooltip" hidden></div>`, add:

```html
<div id="globalSearchDialog" class="global-search-backdrop" hidden>
  <section class="global-search-dialog" role="dialog" aria-modal="true" aria-labelledby="globalSearchDialogTitle">
    <div class="global-search-dialog-head">
      <h2 id="globalSearchDialogTitle">全站搜索</h2>
      <button id="globalSearchCloseButton" class="dialog-close-button" type="button" aria-label="关闭全站搜索">×</button>
    </div>
    <label class="global-search-field">
      <span>搜索全部资料</span>
      <input id="globalSearchDialogInput" type="search" autocomplete="off" placeholder="国家、地区、文化、公司、意识形态">
    </label>
    <label class="global-search-legacy-toggle">
      <input id="globalSearchLegacyToggle" type="checkbox">
      <span>包含旧版本</span>
    </label>
    <div id="globalSearchDialogResults" class="global-search-dialog-results" role="listbox" aria-label="全站搜索结果"></div>
  </section>
</div>
```

- [ ] **Step 4: Merge country status and type filter containers**

Replace the existing country-only status and type filter blocks with:

```html
<details class="filter-section country-only country-primary-filter" open>
  <summary>类型</summary>
  <div class="filter-subgroup">
    <div class="filter-subtitle">政治类型</div>
    <div id="countryTypeFilters" class="option-list"></div>
  </div>
  <div class="filter-subgroup">
    <div class="filter-subtitle">资料标签</div>
    <div class="option-list">
      <button class="filter-token" type="button" data-filter-token data-filter="existsAtStart" aria-pressed="false">开局存在</button>
      <button class="filter-token" type="button" data-filter-token data-filter="isReleasable" aria-pressed="false">可释放</button>
      <button class="filter-token" type="button" data-filter-token data-filter="isMinorFormable" aria-pressed="false">次要统一</button>
      <button class="filter-token" type="button" data-filter-token data-filter="isMajorFormable" aria-pressed="false">重大统一</button>
      <button class="filter-token" type="button" data-filter-token data-filter="isDualHeritage" aria-pressed="false">双传承</button>
      <button class="filter-token" type="button" data-filter-token data-filter="isSpecial" aria-pressed="false">彩蛋</button>
      <button class="filter-token" type="button" data-filter-token data-filter="isCivilWar" aria-pressed="false">内战国家</button>
    </div>
  </div>
</details>
```

Remove the country-only map display section containing `whiteDecentralizedToggle` and `filteredCountryMapToggle`.

- [ ] **Step 5: Bump cache parameters**

Update the stylesheet query to:

```html
<link rel="stylesheet" href="styles.css?v=20260708-redesign1">
```

Update the app script query to:

```html
<script src="app.js?v=20260708-redesign1"></script>
```

- [ ] **Step 6: Run the contract check and verify partial progress**

Run:

```powershell
node scripts\check_ui_ideology_contracts.mjs
```

Expected: still fails, but no longer reports missing rail entries, global search dialog markup, `countryTypeFilters`, or inline `globalSearchInput`.

- [ ] **Step 7: Commit the HTML shell**

Run:

```powershell
git add -- site\index.html
git commit -m "Add Vicdata redesign shell"
```

### Task 3: App State, Navigation, Home Board, And Dialog Search

**Files:**
- Modify: `site/app.js`
- Test: `scripts/check_ui_ideology_contracts.mjs`

- [ ] **Step 1: Update element bindings and state**

Replace the `els.globalSearchInput` binding with bindings for:

```js
globalSearchButton: document.querySelector("#globalSearchButton"),
globalSearchDialog: document.querySelector("#globalSearchDialog"),
globalSearchDialogInput: document.querySelector("#globalSearchDialogInput"),
globalSearchDialogResults: document.querySelector("#globalSearchDialogResults"),
globalSearchLegacyToggle: document.querySelector("#globalSearchLegacyToggle"),
globalSearchCloseButton: document.querySelector("#globalSearchCloseButton"),
settingsNavButton: document.querySelector("#settingsNavButton"),
countryTypeFilters: document.querySelector("#countryTypeFilters"),
```

Add to `state`:

```js
globalSearchDialogOpen: false,
globalSearchIncludeLegacy: false,
globalSearchActiveIndex: 0,
```

Set the initial view to `"home"`.

- [ ] **Step 2: Add rail and search dialog event bindings**

In `bindEvents()`, add:

```js
document.querySelectorAll("[data-nav-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.navView));
});
els.settingsNavButton?.addEventListener("click", () => replaceHash("/settings"));
els.globalSearchButton?.addEventListener("click", openGlobalSearchDialog);
els.globalSearchCloseButton?.addEventListener("click", closeGlobalSearchDialog);
els.globalSearchDialog?.addEventListener("click", (event) => {
  if (event.target === els.globalSearchDialog) closeGlobalSearchDialog();
});
els.globalSearchDialogInput?.addEventListener("input", () => {
  state.globalSearch = els.globalSearchDialogInput.value.trim().toLowerCase();
  state.globalSearchActiveIndex = 0;
  renderGlobalSearchDialogResults();
});
els.globalSearchLegacyToggle?.addEventListener("change", () => {
  state.globalSearchIncludeLegacy = els.globalSearchLegacyToggle.checked;
  renderGlobalSearchDialogResults();
});
document.addEventListener("keydown", handleGlobalSearchDialogKeydown);
```

Remove event handling that reads from `els.globalSearchInput`.

- [ ] **Step 3: Add dialog helper functions**

Add:

```js
function openGlobalSearchDialog() {
  state.globalSearchDialogOpen = true;
  state.globalSearchActiveIndex = 0;
  els.globalSearchDialog.hidden = false;
  document.body.classList.add("global-search-dialog-open");
  els.globalSearchDialogInput.value = state.globalSearch || "";
  els.globalSearchLegacyToggle.checked = state.globalSearchIncludeLegacy;
  renderGlobalSearchDialogResults();
  requestAnimationFrame(() => els.globalSearchDialogInput?.focus());
}

function closeGlobalSearchDialog() {
  state.globalSearchDialogOpen = false;
  els.globalSearchDialog.hidden = true;
  document.body.classList.remove("global-search-dialog-open");
  els.globalSearchButton?.focus();
}

function handleGlobalSearchDialogKeydown(event) {
  if (!state.globalSearchDialogOpen) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeGlobalSearchDialog();
    return;
  }
  const items = [...els.globalSearchDialogResults.querySelectorAll("[data-global-dialog-result]")];
  if (!items.length) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.globalSearchActiveIndex = Math.min(items.length - 1, state.globalSearchActiveIndex + 1);
    updateGlobalSearchActiveDescendant();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    state.globalSearchActiveIndex = Math.max(0, state.globalSearchActiveIndex - 1);
    updateGlobalSearchActiveDescendant();
  } else if (event.key === "Enter") {
    event.preventDefault();
    items[state.globalSearchActiveIndex]?.click();
  }
}
```

- [ ] **Step 4: Render home board**

Add `renderHomeBoard()` and call it from `render()` when `state.view === "home"`. It should set result count to site overview text, render homepage cards in `els.countryList`, clear detail content, and avoid rendering the map.

Required homepage entries:

```js
[
  { label: "最近版本", text: data.victoria3_version || currentVersionLabel(), view: "country" },
  { label: "国家", text: `${countries.length} 个国家`, view: "country" },
  { label: "地区", text: `${landStateRegions.length} 个州地区`, view: "region" },
  { label: "文化", text: `${cultures.length} 个文化`, view: "culture" },
  { label: "公司", text: `${companies.length} 个公司`, view: "company" },
  { label: "意识形态", text: `${ideologies.length} 个意识形态`, view: "ideology" },
]
```

- [ ] **Step 5: Convert global search rendering into dialog results**

Keep `globalSearchResults(query)`, but change rendering so dialog results go into `els.globalSearchDialogResults`. The old `renderGlobalSearchBoard()` path should no longer replace the main list. Each result button uses `data-global-dialog-result`, calls the same navigation behavior as current global search, then closes the dialog.

- [ ] **Step 6: Update hash routing for home, settings, and country detail**

`applyHash()` should route empty hash and `#/home` to `state.view = "home"`. It should route `#/country/TAG` to `state.view = "country"`, `state.detailKind = "country"`, and selected tag. It should route `#/settings` to a settings page placeholder in the main content.

List row clicks in `renderCountryList()` should call `replaceHash(`/country/${country.tag}`)` instead of only changing selected state.

- [ ] **Step 7: Run syntax and contract checks**

Run:

```powershell
node --check site\app.js
node scripts\check_ui_ideology_contracts.mjs
```

Expected: syntax check passes. Contract check may still fail for CSS classes until Task 5.

- [ ] **Step 8: Commit app navigation and dialog behavior**

Run:

```powershell
git add -- site\app.js
git commit -m "Add Vicdata home and search dialog behavior"
```

### Task 4: Country Filter Reordering And Placeholder Entity Badges

**Files:**
- Modify: `site/app.js`
- Test: `scripts/check_ui_ideology_contracts.mjs`

- [ ] **Step 1: Render merged country type filters**

Update `renderFilterOptions()` so country type tokens render into `els.countryTypeFilters`, not `els.typeFilters`. Keep `state.types` and `matchesCountryFilters()` unchanged.

- [ ] **Step 2: Add civil-war filter support without breaking old data**

Add a country flag matcher for `isCivilWar`. It should return true when any of these fields are truthy if present: `country.isCivilWar`, `country.is_civil_war`, `country.civil_war`, or the country tag/name/search text contains `civil_war`.

- [ ] **Step 3: Add entity badge renderer**

Add:

```js
function renderEntityBadge(kind, entity, label = "") {
  const text = label || entity?.name_zh || entity?.name || entity?.tag || entity?.key || "?";
  const initial = text.trim().slice(0, 1).toUpperCase() || "?";
  if (kind === "country") {
    return `<span class="entity-badge entity-badge-square entity-badge-country">${escapeHtml(initial)}</span>`;
  }
  if (kind === "region") {
    const color = entity?.map_color?.hex || entity?.colorHex || "#9b7a5f";
    return `<span class="entity-badge entity-badge-round entity-badge-region" style="--entity-color:${escapeHtml(color)}"></span>`;
  }
  if (kind === "culture" || kind === "religion") {
    const color = entity?.color?.hex || entity?.colorHex || "#b28a67";
    return `<span class="entity-badge entity-badge-swatch" style="--entity-color:${escapeHtml(color)}">${escapeHtml(initial)}</span>`;
  }
  return `<span class="entity-badge entity-badge-square">${escapeHtml(initial)}</span>`;
}
```

Use this renderer in `renderGlobalSearchDialogResults()` and at least the country list rows. Existing real icon helpers may stay for company and ideology lists.

- [ ] **Step 4: Keep filter sections open as required**

Ensure country type, tier, and strategic region sections are open by default on first country render. Heritage, language, and tradition remain collapsed unless active or manually opened.

- [ ] **Step 5: Run syntax and contract checks**

Run:

```powershell
node --check site\app.js
node scripts\check_ui_ideology_contracts.mjs
```

Expected: syntax check passes. Contract check may still fail for CSS classes until Task 5.

- [ ] **Step 6: Commit filters and entity badges**

Run:

```powershell
git add -- site\app.js
git commit -m "Rework country filters and entity badges"
```

### Task 5: Redesign CSS And Warm Theme Tokens

**Files:**
- Modify: `site/styles.css`
- Test: `scripts/check_ui_ideology_contracts.mjs`

- [ ] **Step 1: Update warm theme tokens**

Change root tokens to a warm light theme with米白主体 and dark theme with深棕主体. Use restrained values:

```css
:root {
  --bg: #f2eadf;
  --surface: #fff8ed;
  --surface-raised: #fffaf2;
  --panel: #ead8c5;
  --line: #d3bda7;
  --ink: #2b211a;
  --muted: #756353;
  --accent: #8f3f32;
  --accent-2: #6f4a2f;
  --good: #47735a;
  --warn: #8a5e22;
  --chip-bg: rgba(143, 63, 50, 0.1);
  --shadow: 0 1px 2px rgba(61, 40, 25, 0.12);
}

body[data-theme="dark"] {
  --bg: #24160f;
  --surface: #302016;
  --surface-raised: #3a271b;
  --panel: #2a1b13;
  --line: #5a4030;
  --ink: #f3e8d8;
  --muted: #d1bba5;
  --accent: #d98a72;
  --accent-2: #cda15f;
  --good: #94c7a1;
  --warn: #e0bd75;
  --chip-bg: rgba(217, 138, 114, 0.14);
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.38);
  --panel-glass: rgba(42, 27, 19, 0.94);
  --panel-glass-strong: rgba(48, 32, 22, 0.98);
}
```

- [ ] **Step 2: Add rail and layout styles**

Add `.app-rail`, `.rail-item`, `.rail-icon`, `.rail-label`, and active state styles. Update `.layout` grid columns to include the rail before filters. The rail should collapse to icon width normally and expand label width on hover/focus-within.

- [ ] **Step 3: Add global search dialog styles**

Add `.global-search-backdrop`, `.global-search-dialog`, `.global-search-dialog-head`, `.global-search-field`, `.global-search-legacy-toggle`, `.global-search-dialog-results`, and active result styles. The backdrop should cover the viewport, dim the page, and keep the dialog within mobile viewport width.

- [ ] **Step 4: Add entity badge and home styles**

Add `.entity-badge`, `.entity-badge-round`, `.entity-badge-square`, `.entity-badge-swatch`, `.home-board`, `.home-card`, `.settings-placeholder`, `.filter-subgroup`, and `.filter-subtitle` styles.

- [ ] **Step 5: Update responsive styles**

At narrow widths, make the rail usable without hover by showing labels or moving it above the filter column. Ensure the search dialog and list rows have no horizontal overflow at `390px`.

- [ ] **Step 6: Run the full contract check**

Run:

```powershell
node scripts\check_ui_ideology_contracts.mjs
```

Expected: passes and prints JSON with `ui_ideology_contracts: "ok"`.

- [ ] **Step 7: Commit CSS**

Run:

```powershell
git add -- site\styles.css
git commit -m "Style Vicdata redesign shell"
```

### Task 6: Browser Verification And Final Fixes

**Files:**
- Modify only if verification exposes a concrete issue: `site/index.html`, `site/app.js`, `site/styles.css`, `scripts/check_ui_ideology_contracts.mjs`
- Test: local browser on port `8876`

- [ ] **Step 1: Run static checks**

Run:

```powershell
node --check site\app.js
node --check site\versions.js
node scripts\check_ui_ideology_contracts.mjs
node scripts\check_filter_order.mjs --file site\index.html
```

Expected: all commands exit `0`.

- [ ] **Step 2: Start or reuse local server**

Run:

```powershell
node scripts\serve_site.mjs site 8876
```

If port `8876` is already in use by this site, reuse it. If it is unavailable for another reason, use the next open port and record the URL in the final response.

- [ ] **Step 3: Verify desktop browser state**

Open:

```text
http://127.0.0.1:8876/index.html#/home
```

Verify:
- title and meta line render.
- left rail shows 首页、国家、地区、文化、公司、意识形态 and settings entry.
- homepage cards link to boards.
- right-top search button opens a dimmed dialog.
- typing `普鲁士` or `PRU` shows country results with placeholder badge.
- pressing `Escape` closes the search dialog.
- `#/country/PRU` opens the country board with a country detail page.
- country filter order is search, 类型, 位阶, 战略区域, 传承, 语言, 传统.
- browser console has no site script errors.

- [ ] **Step 4: Verify mobile width**

At `390px` wide, verify:
- rail remains usable.
- filter column can be read without horizontal overflow.
- global search dialog fits the viewport.
- country detail page text does not overlap.

- [ ] **Step 5: Apply focused fixes if needed**

If any verification item fails, fix only the file and behavior tied to that item. Re-run Step 1 and the relevant browser check.

- [ ] **Step 6: Commit final verification fixes**

If Step 5 changed files, run:

```powershell
git add -- site\index.html site\app.js site\styles.css scripts\check_ui_ideology_contracts.mjs
git commit -m "Verify Vicdata redesign slice"
```

If Step 5 made no changes, do not create an empty commit.
