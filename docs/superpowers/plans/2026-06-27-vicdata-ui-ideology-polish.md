# Vicdata UI Ideology Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve default panel density, company filters, transient overlays, dark theme contrast, and ideology source/unlock labels in the Vicdata site.

**Architecture:** Keep the change inside the current single-page frontend and existing extraction/build scripts. Add one static contract test for the new UI/data expectations, then update `site/app.js`, `site/styles.css`, and `scripts/extract_vic3_countries.mjs` only where needed.

**Tech Stack:** Vanilla JavaScript, CSS, Node.js build scripts, generated Vic3 JSON/site data.

---

### Task 1: Contract Test

**Files:**
- Create: `scripts/check_ui_ideology_contracts.mjs`

- [ ] Add a Node.js script that reads `site/app.js`, `site/styles.css`, and selected generated data files.
- [ ] Make it fail when agriculture filters are split, route changes do not call overlay cleanup, default filter sections are open, dark theme lacks stronger panel/list tokens, ideology replacement labels are missing, or ideology unlock tags are absent for known examples.
- [ ] Run `node scripts/check_ui_ideology_contracts.mjs` and confirm it fails before implementation.

### Task 2: UI Density and Overlay Cleanup

**Files:**
- Modify: `site/index.html`
- Modify: `site/app.js`
- Modify: `site/styles.css`

- [ ] Default filter sections to collapsed and auto-open sections that already have active choices.
- [ ] Default dense detail cards, including country right-column interest groups, to collapsed where the page has enough summary text.
- [ ] Move company strategic region and geographic region filters after company-specific filters.
- [ ] Merge all agriculture building filters into one agriculture group for company/resource filtering.
- [ ] Add one `hideTransientOverlays()` helper and call it on view changes, version changes, hash changes, and renders that replace the current page.
- [ ] Improve dark theme panel, list row, chip, tooltip, and badge contrast without changing the light theme layout.

### Task 3: Ideology Source, Replacement, and Unlock Labels

**Files:**
- Modify: `scripts/extract_vic3_countries.mjs`
- Modify: `site/app.js`
- Modify: generated `database/**`, `site/versions/**/data.js`, `site/data.js`, and related wiki data through existing build commands.

- [ ] Preserve applied interest-group rule source details in generated records where the frontend can use them.
- [ ] Render flavor ideology source labels from rule source and condition summary.
- [ ] Render long flavor ideology country/interest-group usage lists in full on the ideology page.
- [ ] Render removed/replaced ideology text as “使用某意识形态替换” and “替换某默认意识形态”.
- [ ] Derive unlock tags from technology and journal-entry conditions for examples including communist, anarchist, vanguardist, corporatist, fascist, technocratic, and modern patriarchal ideologies.
- [ ] Disambiguate duplicate East India labels as British and Dutch when country tags or source keys identify the side.

### Task 4: Verification

**Files:**
- Test: `scripts/check_ui_ideology_contracts.mjs`
- Test: `scripts/check_localization_gaps.mjs`

- [ ] Run `node --check site/app.js`.
- [ ] Run `node --check scripts/extract_vic3_countries.mjs`.
- [ ] Run `node scripts/check_ui_ideology_contracts.mjs`.
- [ ] Run the localization gap check against rebuilt database directories.
- [ ] Start or reuse the local site server and inspect the country, company, and ideology pages in light and dark theme.
