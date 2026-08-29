# Primary Culture Expansion Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a versioned, source-traceable data layer that records every verified route by which a country can gain a primary culture, and exposes its maximum possible primary-culture set to the generated country data.

**Architecture:** `scripts/primary_culture_expansions.mjs` reads the already extracted country, event, journal-entry, and decision files. It collects direct `add_primary_culture` effects, recognizes the Danubian federation integration effect, records reviewed indirect scopes, separates mutually exclusive replacement routes and conditional effects, and preserves multiple maximum sets when routes cannot coexist. It writes `primary_culture_expansions.json` and registers it in the database index. `scripts/build_wiki.mjs` attaches the maximum sets and trace rows to generated country records without rendering a new control.

**Tech Stack:** Node.js ES modules, existing Clausewitz extraction JSON, Node strict assertions.

---

### Task 1: Define and verify the extraction contract

**Files:**

- Create: `scripts/check_primary_culture_expansion_data.mjs`
- Create: `scripts/primary_culture_expansions.mjs`

- [x] **Step 1: Write the failing contract test**

Create a fixture database with three countries (`AUS`, `JAP`, `USA`), small event rows, and an index. The test must invoke the builder and assert that its output has schema version 1, records Japanese plus Ainu for `JAP`, Yankee/Dixie plus Afro-American for `USA`, and South German plus every tested Danubian federation culture for `AUS`. It must also assert that each addition keeps the content identifier, source file, source line, and effect kind.

- [x] **Step 2: Run the test and verify it fails because the builder is absent**

Run: `node scripts/check_primary_culture_expansion_data.mjs`

Expected: failure because `scripts/primary_culture_expansions.mjs` does not yet exist.

- [x] **Step 3: Implement the minimum standalone builder**

Implement `scripts/primary_culture_expansions.mjs` with this public command:

```text
node scripts/primary_culture_expansions.mjs --database <database directory>
```

The output shape must be:

```json
{
  "schema_version": 1,
  "methodology": "maximum_reachable_union",
  "countries": {
    "AUS": {
      "starting_primary_cultures": ["south_german"],
      "added_primary_cultures": ["czech"],
      "maximum_primary_cultures": ["czech", "south_german"],
      "paths": [{
        "culture": "czech",
        "content_type": "event",
        "content_id": "austria_federation.3",
        "effect_kind": "scripted_effect",
        "source_file": "events/balkans_events/austria_federalism.txt",
        "source_line": 783
      }]
    }
  }
}
```

The builder must collect `add_primary_culture = cu:<culture>`, collect `danubian_federation_integrate_culture = { CULTURE = cu:<culture> }`, preserve source fields from the extracted row, de-duplicate paths, and sort countries, cultures, and paths deterministically. It must only retain cultures defined in `cultures.json` and only retain target tags defined in `countries.json`. Effects without a verified country scope must remain in a separate `unresolved_effects` audit list, never silently attached to a country.

- [x] **Step 4: Add reviewed indirect-scope mappings**

Keep mappings in the builder as named, immutable records, each tied to an existing content identifier: `hokkaido_events.6 → JAP`, `acw_je_events.3` and `fsa_events.1 → USA/FSA`, and `austria_federation.3` through `austria_federation.12 → AUS`. These mappings cover content whose root scope is supplied by an on-action, a journal-entry chain, or the Danubian federation button flow rather than by a direct country condition in the content row.

- [x] **Step 5: Register the generated data file**

After writing `primary_culture_expansions.json`, update the database `index.json` so `files.primary_culture_expansions` names the file. Retain all existing index fields. The main site builder consumes this index; `content-index.json` remains limited to the content-board data.

- [x] **Step 6: Run the contract test and verify it passes**

Run: `node scripts/check_primary_culture_expansion_data.mjs`

Expected: `primary culture expansion data contract passed`.

### Task 2: Project maximum culture data into generated country records

**Files:**

- Modify: `scripts/build_wiki.mjs`
- Modify: `scripts/check_primary_culture_expansion_data.mjs`

- [x] **Step 1: Extend the failing test with generated country assertions**

Build a temporary site from the fixture database, load the generated country chunk, and assert these exact fields:

```js
assert.deepEqual(austria.maximumPrimaryCultures, ["czech", "south_german"]);
assert.equal(austria.hasPrimaryCultureExpansions, true);
assert.equal(austria.primaryCultureExpansionPaths[0].effect_kind, "scripted_effect");
```

- [x] **Step 2: Run the test and verify it fails because generated records omit the fields**

Run: `node scripts/check_primary_culture_expansion_data.mjs`

Expected: assertion failure for `maximumPrimaryCultures`.

- [x] **Step 3: Implement the data projection in `build_wiki.mjs`**

When `index.json` defines `files.primary_culture_expansions`, load it and associate entries by country tag before `flattenDatabaseCountry`. Add only these country fields:

```js
maximumPrimaryCultures: expansion.maximum_primary_cultures,
hasPrimaryCultureExpansions: expansion.added_primary_cultures.length > 0,
primaryCultureExpansionPaths: expansion.paths,
```

When the database file is absent, preserve backward compatibility by using the country’s ordinary `primaryCultures`, `false`, and an empty path list.

- [x] **Step 4: Run the contract test and verify it passes**

Run: `node scripts/check_primary_culture_expansion_data.mjs`

Expected: `primary culture expansion data contract passed`.

### Task 3: Generate and validate current original and Victorian Century data

**Files:**

- Generated: `database/vic3_1.13.11/primary_culture_expansions.json`
- Generated: `database/victorian_century/primary_culture_expansions.json`
- Generated: each database’s `index.json`

- [x] **Step 1: Generate original-game data**

Run:

```powershell
node scripts/primary_culture_expansions.mjs --database D:\Bot\Vic3\Victoria3_DB\database\vic3_1.13.11
```

Assert that `AUS`, `JAP`, and `USA` each have an entry, and that Austria’s additions include Czech, Slovak, Polish, Ukrainian, Hungarian, Szekely, Croat, Serb, Slovene, Romanian, and North Italian.

- [x] **Step 2: Generate Victorian Century data**

Run:

```powershell
node scripts/primary_culture_expansions.mjs --database D:\Bot\Vic3\Victoria3_DB\database\victorian_century
```

Assert that every listed culture exists in the Victorian Century culture data and every country tag exists in its country data.

- [x] **Step 3: Run static and data checks**

Run:

```powershell
node --check scripts/primary_culture_expansions.mjs
node --check scripts/build_wiki.mjs
node scripts/check_primary_culture_expansion_data.mjs
node scripts/check_country_incorporation_contract.mjs
```

Expected: all commands exit with code 0.

- [x] **Step 4: Commit the tracked implementation**

Run:

```powershell
git add -- docs/superpowers/plans/2026-08-22-primary-culture-expansion-data.md scripts/primary_culture_expansions.mjs scripts/check_primary_culture_expansion_data.mjs scripts/build_wiki.mjs
git commit -m "feat: add maximum primary culture data"
```
