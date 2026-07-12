# Country Flag Variant Parser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse Victoria 3 country coat-of-arms definitions into structured flag variants, starting with IBE.

**Architecture:** Add a small parser module for Clausewitz-style coat-of-arms files, a check script that locks the IBE sample behavior, and a sample generator that writes one JSON output. The parser reports variants, layers, line numbers, and local PNG asset matches without changing the site UI.

**Tech Stack:** Node.js ES modules, existing repository scripts, local Victoria 3 install files, converted PNG assets under `game/gfx/coat_of_arms`.

---

### Task 1: Red Check

**Files:**
- Create: `scripts/check_country_flag_variants.mjs`

- [ ] Add a check that imports `scripts/lib/country_flag_variants.mjs`, parses IBE from the original game path, and asserts the expected variant and asset names.
- [ ] Run `node scripts/check_country_flag_variants.mjs` and verify it fails because the parser module is missing.

### Task 2: Parser Module

**Files:**
- Create: `scripts/lib/country_flag_variants.mjs`

- [ ] Implement tokenization for identifiers, strings, braces, equals signs, and comments.
- [ ] Parse assignments into a lightweight tree preserving start lines.
- [ ] Extract root coat-of-arms definitions whose key is the tag or starts with `TAG_`.
- [ ] Collect pattern, colors, colored emblem layers, textured emblem layers, instance scale and position, referenced textures, and matched PNG paths.
- [ ] Export `parseCountryFlagVariants(options)` and `writeCountryFlagSample(options)`.

### Task 3: Sample Output

**Files:**
- Create: `scripts/build_country_flag_sample.mjs`

- [ ] Add a CLI wrapper for one tag, defaulting to `IBE`.
- [ ] Write JSON to `output_next/flags/IBE.json` by default.
- [ ] Ensure the output records source file, source lines, variant keys, layer texture names, and asset status.

### Task 4: Verification

- [ ] Run `node scripts/check_country_flag_variants.mjs`.
- [ ] Run `node scripts/build_country_flag_sample.mjs --tag IBE --game-path "D:\SteamLibrary\steamapps\common\Victoria 3" --asset-root game\gfx\coat_of_arms --out output_next\flags\IBE.json`.
- [ ] Run `node --check scripts/lib/country_flag_variants.mjs`, `node --check scripts/check_country_flag_variants.mjs`, and `node --check scripts/build_country_flag_sample.mjs`.
- [ ] Inspect the generated `output_next/flags/IBE.json` for IBE variant count and PNG asset paths.

### Task 5: Flag Definition and Sub-Block Repair

**Files:**
- Modify: `scripts/lib/country_flag_variants.mjs`
- Modify: `scripts/check_country_flag_variants.mjs`

- [ ] Add failing checks for the reported tags: `GRN`, `HAM`, `GBR`, `BRI`, `ROM`, `PAR`, and `SCO`.
- [ ] Parse `common/flag_definitions/00_flag_definitions.txt` and expose the `coa` keys used by each country.
- [ ] Keep only real flag-definition COA keys when a country has a flag-definition entry.
- [ ] Preserve countries without a flag-definition entry, such as `GRN`, by falling back to same-prefix COA definitions.
- [ ] Parse top-level and local `@variables`, including simple `@[...]` arithmetic expressions.
- [ ] Expand `sub = { parent = "sub_*" ... }` blocks from `01_subs.txt`, applying their instance scale and offset to child layers.
- [ ] Keep the existing IBE checks passing.

### Task 6: One PNG per Flag Variant

**Files:**
- Modify: `scripts/lib/country_flag_variants.mjs`
- Modify: `scripts/build_country_flag_preview.ps1`
- Modify: `scripts/build_country_flag_batch.mjs`
- Modify: `scripts/build_europe_country_flag_previews.mjs`
- Modify: `scripts/check_country_flag_batch.mjs`

- [ ] Add a renderer mode that writes one PNG per variant instead of a contact sheet.
- [ ] Export files as `<TAG>/<variant-key>.png` for batch output.
- [ ] Keep the existing contact sheet renderer for overview previews.
- [ ] Add pixel checks for `GRN`, `BRI`, `GBR`, `SCO`, and `PAR` so the old blank or flat-color failures are caught.
- [ ] Regenerate the European flag outputs and keep a contact-sheet overview for browsing.
