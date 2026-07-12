# GBR Country Flag Detail Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a country-detail flag variant module for Great Britain only.

**Architecture:** Keep flag data outside the main data bundle in `site/assets/flags/country-flags.js`. Generate the Great Britain PNG assets into `site/assets/flags/GBR`, then let `site/app.js` render the module only when the selected country has an entry in `window.VIC3_COUNTRY_FLAGS`.

**Tech Stack:** Static HTML, plain JavaScript, CSS, Node.js build and check scripts.

---

### Task 1: Add Site Flag Data Check

**Files:**
- Create: `scripts/check_country_flag_detail_module.mjs`

- [x] **Step 1: Write the failing test**

Check that `site/index.html` loads `assets/flags/country-flags.js`, `site/app.js` reads `window.VIC3_COUNTRY_FLAGS`, `site/styles.css` defines the flag grid, and `site/assets/flags/GBR` contains 20 PNG files.

- [x] **Step 2: Run test to verify it fails**

Run: `node scripts\check_country_flag_detail_module.mjs`

Expected: FAIL until the data file, assets, page wiring, and styles exist.

### Task 2: Generate Great Britain Site Flag Data

**Files:**
- Create: `scripts/build_site_country_flags.mjs`
- Create: `site/assets/flags/country-flags.js`
- Create: `site/assets/flags/GBR/*.png`

- [x] **Step 1: Implement the generator**

Read `output_next/flags/europe/json/GBR.json`, copy the 20 generated PNG files, and write a small `window.VIC3_COUNTRY_FLAGS` payload with variant key, export key, priority, image path, subject canton, trigger summary, and raw trigger.

- [x] **Step 2: Run the generator**

Run: `node scripts\build_site_country_flags.mjs`

Expected: writes `site/assets/flags/country-flags.js` and 20 PNG files under `site/assets/flags/GBR`.

### Task 3: Render The Country Detail Module

**Files:**
- Modify: `site/index.html`
- Modify: `site/app.js`
- Modify: `site/styles.css`

- [ ] **Step 1: Load the data file**

Add the `country-flags.js` script before `app.js`.

- [ ] **Step 2: Add the renderer**

Read `window.VIC3_COUNTRY_FLAGS`, add `countryFlagVariantSection(country)`, and render the section in `renderCountryDetail(country)` after the dynamic map color block.

- [ ] **Step 3: Add styles**

Define a compact responsive grid, fixed 5:3 image frame, and metadata layout for each flag entry.

### Task 4: Verify

**Files:**
- Test: `scripts/check_country_flag_detail_module.mjs`
- Test: existing syntax and browser checks

- [ ] **Step 1: Run site module check**

Run: `node scripts\check_country_flag_detail_module.mjs`

Expected: PASS with `gbr_variants: 20`.

- [ ] **Step 2: Run syntax checks**

Run: `node --check scripts\build_site_country_flags.mjs; node --check scripts\check_country_flag_detail_module.mjs`

Expected: no syntax errors.

- [ ] **Step 3: Preview the rendered page**

Open `#/country/GBR`, confirm the module appears with 20 flags and raw trigger details.
