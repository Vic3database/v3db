# 首页入口、建筑差异标注与公告 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 更新首页游戏内容入口图标与顺序，标注 VC 建筑数值调整，并更新精简站内公告。

**Architecture:** 复用现有首页入口数组、VC 经济差异字段和公告生成管线。建筑差异在 `scripts/build_wiki.mjs` 的版本对比阶段生成，前端沿用已有变更徽标；共用前端通过 VC 独立站构建脚本同步到 `Victorian Century Database/` 与 `site/vc/`。

**Tech Stack:** Node.js ESM 构建脚本、静态 JavaScript/JSON、PowerShell、ImageMagick 或 Python Pillow、现有 Node 检查脚本。

---

### Task 1: Prepare and verify the VC homepage asset

**Files:**
- Create: `site/assets/home/victorian-century.webp`
- Source: `D:/SteamLibrary/steamapps/workshop/content/529340/3219394272/thumbnail.png`

- [x] **Step 1: Inspect source asset dimensions and available conversion tools**

Run PowerShell to inspect the PNG and check `magick`, Python/Pillow, and Node image tooling. Expected: source exists and one conversion path is available.

- [x] **Step 2: Convert the PNG to WebP without changing its visual content**

Write the output only to `site/assets/home/victorian-century.webp`; preserve the source aspect ratio and alpha channel.

- [x] **Step 3: Verify the generated WebP**

Read its dimensions and MIME/extension, then run `git diff --check -- site/assets/home/victorian-century.webp`.

### Task 2: Update homepage content entries

**Files:**
- Modify: `site/app/boards.js`
- Modify: `site/styles.css` or the existing homepage asset cache token only if the project requires cache invalidation
- Test: `scripts/check_homepage_layout.mjs`

- [x] **Step 1: Add an explicit Victorian Century entry using the new WebP**

Use the existing home entry mechanism and preserve its current route behavior. Do not add a new layout or panel.

- [x] **Step 2: Set content icons and ordering**

Use `assets/event-icons/event_icons/event_default.webp` for journals, `event_default_option.webp` for decisions, and `event_protest.webp` for events. In the game-content category order the entries as journal, event, decision, achievement.

- [x] **Step 3: Run static homepage checks**

Run `node scripts/check_homepage_layout.mjs` and assert the required icon paths and order in its output or a focused source check.

### Task 3: Generate and verify VC building adjustment tags

**Files:**
- Modify: `scripts/build_wiki.mjs` only if the existing comparable-field logic does not correctly tag building differences
- Create or modify: `scripts/check_victorian_century_building_change_tags.mjs`
- Regenerate: `site/versions/1.13.9/data-buildings.js` and related generated files only through the existing build command

- [x] **Step 1: Add a failing data contract for building differences**

Compare the current 1.13.10 baseline and VC building records by `key`, ignoring source paths, patch directives, and other provenance fields already excluded by `victorianCenturyChangeIgnoredFields`. Require `building_chemical_plant` to be adjusted when its substantive fields differ, require `building_electronics_industry` to be checked by its actual key if present, and require at least one adjusted building with non-empty `vc_change_fields`.

- [x] **Step 2: Run the contract before implementation**

Run `node scripts/check_victorian_century_building_change_tags.mjs`; it should fail if generated records do not contain the required tags.

- [x] **Step 3: Rebuild the versioned data using the 1.13.10 baseline**

Run the existing `scripts/build_wiki.mjs` command with `database/vic3_1.13.10` as the current database, `database/vic3_1.13.9` as the baseline where the output contract requires it, and the existing versioned output path. Do not change the default database path globally unless the current project contract requires that separately.

- [x] **Step 4: Verify card and detail badge paths**

Use source checks to confirm building cards call `economyChangeBadgeHtml` and the detail header calls `victorianCenturyBadge`; use the generated data contract to confirm `vc_change_kind: "adjusted"` and `vc_change_fields` are present for the changed records.

### Task 4: Update and regenerate announcements

**Files:**
- Modify: `announcements.md`
- Regenerate: `site/announcement-data.js`
- Test: `scripts/check_announcements.mjs`

- [x] **Step 1: Replace the announcement source contents**

Keep 2026-08-10 and later entries. Remove 2026-08-06, 2026-08-01, 2026-07-30, and 2026-07-28. Add the exact 2026-08-17 text supplied by the user.

- [x] **Step 2: Regenerate the derived announcement data**

Run `node scripts/build_announcements_data.mjs` from the repository root.

- [x] **Step 3: Run announcement checks**

Run `node scripts/check_announcements.mjs` and verify the count and exact 2026-08-17 body.

### Task 5: Synchronize VC copies and run regression checks

**Files:**
- Generated/synchronized: `Victorian Century Database/`, `site/vc/`
- Test: existing homepage, economy, standalone VC, publish-bundle, and diff checks

- [x] **Step 1: Rebuild the standalone VC site and publish copy**

Run `node scripts/build_victorian_century_site.mjs --source site --target "Victorian Century Database" --publish-target site/vc --vc-database database/victorian_century --skip-vc-assets`.

- [x] **Step 2: Run focused checks**

Run the homepage, economy board, announcement, VC standalone, building change, and `git diff --check` checks. Expected: all pass.

- [x] **Step 3: Inspect the final diff and status**

Use `git diff --stat`, `git diff --check`, and `git status --short` to confirm only the requested source and generated outputs changed beyond the pre-existing worktree state. Do not stage or remove unrelated files.
