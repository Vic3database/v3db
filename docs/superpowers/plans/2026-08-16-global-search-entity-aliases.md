# Global Search Entity Aliases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make global search index and display official country, state-region and company name variants, while accepting building compatibility IDs as hidden search aliases.

**Architecture:** Preserve structured aliases during extraction, convert them into a shared `aliases`/`internalAliases` search contract at build time, and keep matching and display selection in the existing global-search frontend. Content search continues to append journals, events and decisions without rewriting entity entries. Rebuild the current vanilla 1.13.10 output and both Victorian Century outputs from their own databases.

**Tech Stack:** Node.js ES modules, Victoria 3 script extraction, generated JSON and JavaScript data chunks, browser checks through Chrome DevTools Protocol, PowerShell command orchestration.

---

## File map

- `scripts/extract_vic3_countries.mjs`: preserve `common/buildings/*` compatibility aliases in each building record.
- `scripts/search_aliases.mjs`: create localized official aliases and hidden internal aliases from one structured entity.
- `scripts/build_wiki.mjs`: call the alias helper while constructing `VIC3_SEARCH_INDEX`.
- `scripts/content_search_index.mjs`: retain existing entity alias fields while replacing content entries.
- `site/app/boards.js`: match and rank names, official aliases and internal aliases; pass the matched official name to presentation.
- `site/app/presentation.js`: display the matched official alias and retain the base name as secondary context.
- `scripts/check_search_alias_unit.mjs`: exercise alias-field construction without generated databases.
- `scripts/check_global_search_aliases.mjs`: validate generated vanilla and VC index contracts.
- `scripts/check_economy_database.mjs`, `scripts/check_global_search.mjs`, `scripts/check_global_content_search.mjs`, `scripts/check_global_content_search_browser.mjs`: extend existing regression coverage.
- `site/index.html`: cache-bust the two changed frontend modules.
- `docs/worklog/2026-08-16-global-search-entity-aliases.md`: record generated counts, commands and local release state.

### Task 1: Preserve building compatibility aliases

**Files:**
- Modify: `scripts/check_economy_database.mjs`
- Modify: `scripts/extract_vic3_countries.mjs:2269-2328`
- Generate locally: `database/vic3_1.13.10/buildings.json`
- Generate locally: `database/victorian_century/buildings.json`

- [ ] **Step 1: Add a failing database assertion**

After `buildingByKey` is created in `scripts/check_economy_database.mjs`, add:

```js
assert.deepEqual(
  required(buildingByKey, "building_barrack", "barracks").aliases,
  ["building_barracks"],
  "building compatibility aliases must be preserved from the game definition",
);
assert.equal(
  buildings.reduce((count, building) => count + (building.aliases || []).length, 0),
  19,
  "the 1.13.10 base database must preserve all nineteen building compatibility aliases",
);
```

- [ ] **Step 2: Run the test and confirm the expected failure**

Run:

```powershell
node scripts/check_economy_database.mjs vic3_1.13.10
```

Expected: FAIL because `building_barrack.aliases` is absent.

- [ ] **Step 3: Extract the aliases with the building definition**

In the object pushed by `loadBuildings()`, directly after `key`, add:

```js
aliases: nodeItems(asNode(firstValue(node, "aliases")) || { items: [] })
  .map(scriptEntryKey)
  .filter(Boolean),
```

This uses the parsed `aliases = { ... }` assignment and does not inspect localization keys.

- [ ] **Step 4: Rebuild the two current databases**

Run:

```powershell
node scripts/extract_vic3_countries.mjs --game-path 'D:\SteamLibrary\steamapps\common\Victoria 3' --dataset-name 'Victoria 3' --version 1.13.10 --out output/vic3_1.13.10 --database database/vic3_1.13.10
node scripts/extract_vic3_countries.mjs --game-path 'D:\SteamLibrary\steamapps\common\Victoria 3' --mod-path 'D:\SteamLibrary\steamapps\workshop\content\529340\3219394272' --dataset-name 'Victorian Century' --version 1.13.10 --out output_victorian_century --database database/victorian_century
```

Expected: both commands report successful database generation; the vanilla database contains 19 building aliases. VC may contain additional aliases introduced by the mod.

- [ ] **Step 5: Verify extraction and syntax**

Run:

```powershell
node --check scripts/extract_vic3_countries.mjs
node scripts/check_economy_database.mjs vic3_1.13.10
```

Expected: both exit with code 0; the economy checker reports `economy_database: ok`.

- [ ] **Step 6: Commit only extractor source and its check**

```powershell
git add -- scripts/extract_vic3_countries.mjs scripts/check_economy_database.mjs
git commit --only -m "feat: preserve building search aliases" -- scripts/extract_vic3_countries.mjs scripts/check_economy_database.mjs
```

### Task 2: Generate the unified alias fields

**Files:**
- Create: `scripts/search_aliases.mjs`
- Create: `scripts/check_search_alias_unit.mjs`
- Create: `scripts/check_global_search_aliases.mjs`
- Modify: `scripts/build_wiki.mjs:1-3,628-704`
- Verify: `scripts/content_search_index.mjs:8-18`

- [ ] **Step 1: Write the focused failing unit check**

Create `scripts/check_search_alias_unit.mjs`:

```js
import assert from "node:assert/strict";
import { searchAliasFields } from "./search_aliases.mjs";

const messagesByLocale = {
  "zh-Hans": {
    qing: "大清",
    china: "中国",
    germanAlsace: "埃尔萨斯‑洛林根",
    alsace: "阿尔萨斯‑洛林",
    consortium: "财团",
    company: "公司",
  },
  en: {
    qing: "Dai Ching",
    china: "China",
    germanAlsace: "Elsaß-Lothringen",
    alsace: "Alsace-Lorraine",
    consortium: "Consortium",
    company: "Company",
  },
};

assert.deepEqual(searchAliasFields("country", {
  dynamicNameVariants: [{ loc: { name: "qing" } }, { loc: { name: "china" } }],
}, messagesByLocale, { "zh-Hans": "中国", en: "China" }), {
  aliases: { "zh-Hans": ["大清"], en: ["Dai Ching"] },
});

assert.deepEqual(searchAliasFields("region", {
  dynamic_name_variants: [{ loc: { name: "germanAlsace" } }],
}, messagesByLocale, { "zh-Hans": "阿尔萨斯‑洛林", en: "Alsace-Lorraine" }), {
  aliases: { "zh-Hans": ["埃尔萨斯‑洛林根"], en: ["Elsaß-Lothringen"] },
});

assert.deepEqual(searchAliasFields("company", {
  dynamic_company_type_names: [
    { loc: { name: "company" } },
    { loc: { name: "consortium" } },
    { loc: { name: "consortium" } },
  ],
}, messagesByLocale, { "zh-Hans": "优质谷物公司", en: "Quality Grains Inc." }), {
  aliases: { "zh-Hans": ["公司", "财团"], en: ["Company", "Consortium"] },
});

assert.deepEqual(searchAliasFields("building", {
  aliases: ["building_barracks", "building_barracks", ""],
}, messagesByLocale, { "zh-Hans": "兵营", en: "Barracks" }), {
  internalAliases: ["building_barracks"],
});

assert.deepEqual(searchAliasFields("culture", {}, messagesByLocale, {
  "zh-Hans": "汉文化",
  en: "Han",
}), {});

console.log(JSON.stringify({ search_alias_unit: "ok" }));
```

- [ ] **Step 2: Run the unit check and confirm the module is missing**

Run:

```powershell
node scripts/check_search_alias_unit.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/search_aliases.mjs`.

- [ ] **Step 3: Implement the pure alias-field helper**

Create `scripts/search_aliases.mjs`:

```js
const officialAliasRefs = {
  country: (item) => item.dynamicNameVariants || [],
  region: (item) => item.dynamic_name_variants || [],
  company: (item) => item.dynamic_company_type_names || [],
};

export function searchAliasFields(kind, item, messagesByLocale, baseNames) {
  const fields = {};
  const refs = officialAliasRefs[kind]?.(item) || [];
  const aliases = Object.fromEntries(Object.keys(messagesByLocale || {}).map((locale) => [
    locale,
    unique(refs
      .map((ref) => messagesByLocale?.[locale]?.[ref?.loc?.name] || "")
      .filter((value) => value && value !== baseNames?.[locale])),
  ]).filter(([, values]) => values.length));
  if (Object.keys(aliases).length) fields.aliases = aliases;

  const internalAliases = kind === "building"
    ? unique((item.aliases || []).map((value) => String(value || "").trim()).filter(Boolean))
    : [];
  if (internalAliases.length) fields.internalAliases = internalAliases;
  return fields;
}

function unique(values) {
  return [...new Set(values)];
}
```

- [ ] **Step 4: Verify the pure helper**

Run:

```powershell
node scripts/check_search_alias_unit.mjs
```

Expected: `{"search_alias_unit":"ok"}`.

- [ ] **Step 5: Connect the helper to every base search entry**

At the top of `scripts/build_wiki.mjs`, add:

```js
import { searchAliasFields } from "./search_aliases.mjs";
```

In `createSearchEntries()`, replace the inline returned object for `indexedCollections` with:

```js
const names = {
  "zh-Hans": messagesByLocale["zh-Hans"]?.[message] || key,
  en: messagesByLocale.en?.[message] || key,
};
return {
  kind,
  id,
  key,
  names,
  ...searchAliasFields(kind, item, messagesByLocale, names),
};
```

Keep the existing interest-group flavor aggregation unchanged.

- [ ] **Step 6: Add a generated-index contract check**

Create `scripts/check_global_search_aliases.mjs`. It must read `VIC3_SEARCH_INDEX` from `site/versions/1.13.10`, `site/vc` and `Victorian Century Database`, then assert for every output:

```js
assert.ok(entry("country", "CHI").aliases?.["zh-Hans"]?.includes("大清"));
assert.ok(entry("country", "CHI").aliases?.en?.includes("Dai Ching"));
assert.ok(entry("region", "STATE_ALSACE_LORRAINE").aliases?.["zh-Hans"]?.includes("埃尔萨斯‑洛林根"));
assert.ok(entry("company", "company_basic_agriculture_1").aliases?.["zh-Hans"]?.includes("财团"));
assert.deepEqual(entry("building", "building_barrack").internalAliases, ["building_barracks"]);
assert.equal(new Set(search.entries.map((item) => item.id)).size, search.entries.length);
```

The helper inside the check must throw `missing <kind>:<key> in <output>` when a sample is absent. It must also count entries with `aliases` and `internalAliases` by kind and include those counts in its JSON report.

- [ ] **Step 7: Run the generated-index check and confirm it still fails**

Run:

```powershell
node scripts/check_global_search_aliases.mjs
```

Expected: FAIL because the current generated indices do not have `aliases` or `internalAliases`.

- [ ] **Step 8: Commit the helper, builder wiring and checks**

```powershell
git add -- scripts/search_aliases.mjs scripts/check_search_alias_unit.mjs scripts/check_global_search_aliases.mjs scripts/build_wiki.mjs
git commit --only -m "feat: build unified search aliases" -- scripts/search_aliases.mjs scripts/check_search_alias_unit.mjs scripts/check_global_search_aliases.mjs scripts/build_wiki.mjs
```

### Task 3: Match, rank and display aliases in the browser

**Files:**
- Modify: `site/app/boards.js:2202-2258`
- Modify: `site/app/presentation.js:722-730`
- Modify: `site/index.html:407-413`
- Modify: `scripts/check_global_search.mjs`
- Modify: `scripts/check_global_content_search.mjs`
- Modify: `scripts/check_global_content_search_browser.mjs`

- [ ] **Step 1: Finish the failing static regression cases**

Keep the existing `CHI` and `CMI` assertions in `scripts/check_global_search.mjs`, with `indexMatches()` including:

```js
[entry.key, ...Object.values(entry.names || {}), ...Object.values(entry.aliases || {}).flat(), ...(entry.internalAliases || [])]
```

Add static source assertions that `globalSearchResults()` reads `entry.aliases` and `entry.internalAliases`, and that `globalSearchDisplayTitle()` returns `result.matchedAlias` before its language-specific fallback.

- [ ] **Step 2: Extend the browser test before changing production code**

In `scripts/check_global_content_search_browser.mjs`, retain the approved “清” case and add these cases for both `original` and `vc`:

```js
await fillSearch(page, "埃尔萨斯‑洛林根");
assert.equal(await resultExists(page, "stateRegion", "STATE_ALSACE_LORRAINE"), true, `${label} must find the state by its dynamic name`);

await fillSearch(page, "财团");
assert.equal(await resultExists(page, "company", "company_basic_agriculture_1"), true, `${label} must find a company by its official dynamic type name`);

await fillSearch(page, "building_barracks");
assert.equal(await resultExists(page, "building", "building_barrack"), true, `${label} must find the current building through its compatibility ID`);
const barracksLabel = await page.evaluate(() => document.querySelector('[data-result-kind="building"][data-result-key="building_barrack"] .name')?.textContent || "");
assert.doesNotMatch(barracksLabel, /building_barracks/, `${label} must not display a compatibility ID as the title`);
```

Also assert that a query for `中国` displays `中国`, and that every queried entity key occurs exactly once in the result DOM.

- [ ] **Step 3: Run both checks and confirm alias failures**

Run:

```powershell
node scripts/check_global_search.mjs
node scripts/check_global_content_search_browser.mjs
```

Expected: FAIL because generated entries and frontend matching do not yet consume the new fields.

- [ ] **Step 4: Add one match description per index entry**

In `globalSearchResults()`, derive these normalized collections before creating `haystack`:

```js
const localizedAliases = entry.aliases?.[localeRuntime.current] || [];
const otherAliases = Object.entries(entry.aliases || {})
  .filter(([locale]) => locale !== localeRuntime.current)
  .flatMap(([, values]) => values || []);
const internalAliases = entry.internalAliases || [];
const matchedAlias = localizedAliases.find((alias) => normalizeSearchText(alias).includes(needle)) || "";
```

Include `localizedAliases`, `otherAliases` and `internalAliases` in the default haystack. Keep one `result` object per index entry; do not expand aliases into separate rows.

- [ ] **Step 5: Implement the approved ranking order**

Replace the current score expression with explicit normalized values:

```js
const normalizedCurrentAliases = localizedAliases.map(normalizeSearchText);
const normalizedOtherAliases = otherAliases.map(normalizeSearchText);
const normalizedInternalAliases = internalAliases.map(normalizeSearchText);
const score = !defaultMatch
  ? 1000 + detail.text.indexOf(needle)
  : normalizedTitle === needle
    ? 0
    : normalizedCurrentAliases.includes(needle)
      ? 1
      : normalizedKey === needle
        ? 2
        : normalizedTitle.startsWith(needle)
          ? 3
          : normalizedCurrentAliases.some((value) => value.startsWith(needle))
            ? 4
            : [...normalizedOtherAliases, ...Object.values(entry.names || {}).map((value) => normalizeSearchText(value))]
                .some((value) => value === needle || value.startsWith(needle))
              ? 5
              : normalizedInternalAliases.some((value) => value === needle || value.startsWith(needle))
                ? 6
                : haystack.indexOf(needle) + 20;
```

Set `matchedAlias` on the result. Keep the existing kind order and 120-result limit.

- [ ] **Step 6: Display an official alias with its base-name context**

At the start of `globalSearchDisplayTitle()` in `site/app/presentation.js`, use:

```js
const title = result.title || result.key || "";
if (result.matchedAlias) return result.matchedAlias;
if (localeRuntime.current === "zh-Hans") return title;
```

When constructing `result` in `globalSearchResults()`, set the subtitle to the base name for an official alias match; otherwise keep the existing subtitle helper:

```js
subtitle: matchedAlias ? title : globalSearchResultSubtitle(kind, entry),
```

This makes “大清” display “中国” as secondary context without changing the interest-group and content subtitle branches. Do not expose `internalAliases` in the title or subtitle.

- [ ] **Step 7: Update cache versions and their contract**

In `site/index.html`, change only `app/boards.js` and `app/presentation.js` to `v=20260816-global-search-aliases1`. Update `scripts/check_global_content_search.mjs` so it expects this version for those two files while retaining the existing versions for unrelated scripts.

- [ ] **Step 8: Run syntax checks**

```powershell
node --check site/app/boards.js
node --check site/app/presentation.js
node --check scripts/check_global_search.mjs
node --check scripts/check_global_content_search_browser.mjs
```

Expected: all commands exit with code 0.

- [ ] **Step 9: Commit frontend source and regression checks**

```powershell
git add -- site/app/boards.js site/app/presentation.js site/index.html scripts/check_global_search.mjs scripts/check_global_content_search.mjs scripts/check_global_content_search_browser.mjs
git commit --only -m "feat: search official entity aliases" -- site/app/boards.js site/app/presentation.js site/index.html scripts/check_global_search.mjs scripts/check_global_content_search.mjs scripts/check_global_content_search_browser.mjs
```

### Task 4: Rebuild current vanilla and Victorian Century outputs

**Files:**
- Generate locally: `site/versions/1.13.10/search-index.js`
- Generate locally: `site/versions/1.13.10/data-index.js`
- Generate locally: `Victorian Century Database/search-index.js`
- Generate locally: `Victorian Century Database/data-index.js`
- Generate locally: `site/vc/search-index.js`
- Generate locally: `site/vc/data-index.js`

- [ ] **Step 1: Rebuild the vanilla base site index**

```powershell
node scripts/build_wiki.mjs --database database/vic3_1.13.10 --out site/versions/1.13.10
node scripts/build_vanilla_content_site_data.mjs --version 1.13.10 --database database/vic3_1.13.10 --site site/versions/1.13.10
```

Expected: the first command writes base entries with alias fields; the second appends content entries while retaining those fields.

- [ ] **Step 2: Rebuild the VC base and content index**

```powershell
node scripts/build_wiki.mjs --database database/victorian_century --baseline-database database/vic3_1.13.10 --out 'Victorian Century Database'
node scripts/build_victorian_century_site.mjs --source site --target 'Victorian Century Database' --publish-target site/vc --vc-database database/victorian_century --skip-vc-assets
```

Expected: the standalone target receives the VC base search index, its content entries, current frontend files and assets; `site/vc` is copied from that complete target.

- [ ] **Step 3: Verify the generated alias contract**

```powershell
node scripts/check_global_search_aliases.mjs
```

Expected: JSON reports `global_search_aliases: ok` and nonzero official-alias counts for country, region and company plus nonzero building internal-alias counts in all three outputs.

- [ ] **Step 4: Confirm content appending preserved entity aliases**

Before running the check, extend `scripts/check_global_content_search.mjs` inside its existing loop over the three outputs:

```js
const qing = search.entries.find((entry) => entry.kind === "country" && entry.key === "CHI");
assert.ok(qing?.aliases?.["zh-Hans"]?.includes("大清"), `${relative} content update must preserve country aliases`);
const barracks = search.entries.find((entry) => entry.kind === "building" && entry.key === "building_barrack");
assert.deepEqual(barracks?.internalAliases, ["building_barracks"], `${relative} content update must preserve building compatibility aliases`);
```

```powershell
node scripts/check_global_content_search.mjs
```

Expected: content counts remain original 418/2239/60 and VC 857/2946/102; the generated alias checker still passes immediately afterward.

- [ ] **Step 5: Do not stage ignored generated sites automatically**

Run `git status --short` and inspect generated paths. Stage a generated file only if it was already tracked and its change belongs to this feature. Preserve unrelated staged and untracked files.

### Task 5: Browser verification and work record

**Files:**
- Create: `docs/worklog/2026-08-16-global-search-entity-aliases.md`
- Modify only if already required by the existing index: `WORKLOG.md`

- [ ] **Step 1: Run the focused browser regression**

```powershell
node scripts/check_global_content_search_browser.mjs
```

Expected: original and VC reports include `dynamic-country-name-alias`; “清” shows both `CHI` and `CMI`, with `CHI` titled “大清”; state, company and building alias cases pass.

- [ ] **Step 2: Run the wider relevant checks**

```powershell
node scripts/check_search_alias_unit.mjs
node scripts/check_global_search_aliases.mjs
node scripts/check_global_search.mjs
node scripts/check_global_content_search.mjs
node scripts/check_data_chunking.mjs
node scripts/check_victorian_century_standalone_site.mjs
```

Expected: every command exits with code 0. The global-search checks retain existing navigation, icon, content-field isolation and compact-row contracts.

- [ ] **Step 3: Verify the three current frontend copies**

```powershell
$files = @('site/app/boards.js', 'site/vc/app/boards.js', 'Victorian Century Database/app/boards.js')
Get-FileHash -Algorithm SHA256 -LiteralPath $files | Select-Object Path,Hash
$files = @('site/app/presentation.js', 'site/vc/app/presentation.js', 'Victorian Century Database/app/presentation.js')
Get-FileHash -Algorithm SHA256 -LiteralPath $files | Select-Object Path,Hash
```

Expected: each group contains one shared hash.

- [ ] **Step 4: Record evidence and release state**

Create `docs/worklog/2026-08-16-global-search-entity-aliases.md` with the four source categories, generated alias counts for original and VC, the exact verification commands and their exit results, plus this statement: the feature is local unless a later command explicitly pushes or deploys it.

- [ ] **Step 5: Run the final format and scope checks**

```powershell
git diff --check
git status --short
```

Expected: `git diff --check` exits 0. Review status without altering unrelated files.

- [ ] **Step 6: Commit the work record only**

```powershell
git add -- docs/worklog/2026-08-16-global-search-entity-aliases.md
git commit --only -m "docs: record global search aliases" -- docs/worklog/2026-08-16-global-search-entity-aliases.md
```
