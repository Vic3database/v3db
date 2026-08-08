# Two-level Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the direct board links in the Vicdata top bar with five localized, accessible category menus while retaining every current board route.

**Architecture:** The static shell defines five `details`-based category menus and keeps each child route on the existing `data-nav-view` contract. `site/app/ui.js` handles desktop hover/focus state, mobile native disclosure, menu closure after navigation, and active-category state. CSS in the source style sections provides the desktop popover and narrow-screen stacked disclosure layouts.

**Tech Stack:** Static HTML, vanilla JavaScript, modular CSS, Node.js assertion scripts.

---

### Task 1: Add the failing two-level navigation contract

**Files:**
- Create: `scripts/check_two_level_navigation.mjs`
- Modify: `scripts/check_ui_ideology_contracts.mjs:194-198`

- [x] **Step 1: Write the failing contract**

```js
for (const [group, views] of Object.entries({
  domestic: ["country", "law", "ideology"],
  society: ["culture"],
  economy: ["region", "company", "building", "goods"],
  technology: ["technology"],
  game: ["achievement"],
})) {
  assert.match(indexSource, new RegExp(`data-nav-group="${group}"`));
  for (const view of views) assert.match(indexSource, new RegExp(`data-nav-view="${view}"`));
}
assert.match(uiSource, /function\s+bindTopbarNavigationMenus\s*\(/);
assert.match(styleSource, /\.topbar-nav-popover\s*\{/);
```

- [x] **Step 2: Run the contract and confirm it fails because the menu structure is absent**

Run: `node scripts/check_two_level_navigation.mjs`

Expected: a failure naming the missing `data-nav-group` structure.

### Task 2: Implement the menu shell and behavior

**Files:**
- Modify: `site/index.html:17-28`
- Modify: `site/app/ui.js:1-24`
- Modify: `site/app/ui.js:1320-1337`
- Modify: `site/app/ui.js:1390-1396`
- Modify: `site/locales/ui.zh-Hans.js:22-32`
- Modify: `site/locales/ui.en.js:22-32`

- [x] **Step 1: Replace the direct top-bar buttons with the five approved category menus**

```html
<details class="topbar-nav-group" data-nav-group="domestic">
  <summary class="topbar-nav-summary"><span data-i18n="nav.domestic">内政</span></summary>
  <div class="topbar-nav-popover">
    <button class="topbar-nav-item" type="button" data-nav-view="country">…</button>
    <button class="topbar-nav-item" type="button" data-nav-view="law">…</button>
    <button class="topbar-nav-item" type="button" data-nav-view="ideology">…</button>
  </div>
</details>
```

Repeat the same shell for society, economy, technology, and game; do not emit diplomacy or military until they have child records. Add `nav.domestic`, `nav.society`, `nav.economy`, and `nav.gameContent` messages in both UI locale files.

- [x] **Step 2: Keep route behavior and synchronize active groups**

```js
function syncTopbarNavigationGroups() {
  document.querySelectorAll(".topbar-nav-group").forEach((group) => {
    const current = [...group.querySelectorAll("[data-nav-view]")]
      .some((button) => button.dataset.navView === state.view);
    group.classList.toggle("is-current", current);
  });
}
```

Call the helper from `render()`, close category menus after a child route is selected, and attach hover/focus listeners only when `matchMedia("(hover: hover) and (pointer: fine)")` matches. On narrow screens, retain native `details` click disclosure.

- [x] **Step 3: Run the navigation contract**

Run: `node scripts/check_two_level_navigation.mjs`

Expected: `{ "two_level_navigation": "ok" }`.

### Task 3: Add desktop and narrow-screen presentation

**Files:**
- Modify: `site/styles/foundation.css:89-166`
- Modify: `site/styles/shell.css:1-20`

- [x] **Step 1: Add desktop category and popover styling**

```css
.topbar-nav-group { position: relative; }
.topbar-nav-summary { display: flex; align-items: center; min-height: var(--control-height); }
.topbar-nav-popover { position: absolute; top: calc(100% + 7px); left: 0; z-index: 80; }
.topbar-nav-group.is-current > .topbar-nav-summary { border-color: rgba(200, 164, 91, 0.34); }
```

Use the established dark panel and gold selection tokens; child items remain full-width buttons.

- [x] **Step 2: Add narrow-screen click-disclosure layout**

```css
@media (max-width: 760px) {
  .topbar-nav { overflow: visible; flex-wrap: wrap; }
  .topbar-nav-group[open] { flex-basis: 100%; }
  .topbar-nav-popover { position: static; width: 100%; }
}
```

- [x] **Step 3: Run syntax and static checks**

Run: `node scripts/check_two_level_navigation.mjs; node scripts/check_ui_ideology_contracts.mjs; node --check site/app/ui.js; git diff --check`

Expected: all commands exit 0.

### Task 4: Verify rendered interactions and record the change

**Files:**
- Modify: `scripts/check_two_level_navigation.mjs`

- [x] **Step 1: Add browser-level checks for desktop hover, direct child routing, active parent state, and a 390px click disclosure**

```js
await page.locator('[data-nav-group="economy"]').hover();
await expect(page.locator('[data-nav-group="economy"]')).toHaveAttribute("open", "");
await page.locator('[data-nav-group="economy"] [data-nav-view="goods"]').click();
await expect(page).toHaveURL(/#\/goods$/);
```

- [x] **Step 2: Run the focused browser check and final static verification**

Run: `node scripts/check_two_level_navigation.mjs --browser; node scripts/check_two_level_navigation.mjs; node scripts/check_ui_ideology_contracts.mjs; node --check site/app/ui.js; git diff --check`

Expected: desktop and 390px cases pass, static assertions pass, and `git diff --check` produces no output.

- [x] **Step 3: Commit the focused navigation change**

```powershell
git add docs/superpowers/plans/2026-08-08-two-level-navigation.md scripts/check_two_level_navigation.mjs site/index.html site/app/ui.js site/locales/ui.zh-Hans.js site/locales/ui.en.js site/styles/foundation.css site/styles/shell.css
git commit -m "feat: group topbar navigation menus"
```
