import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseAnnouncements, serializeAnnouncements } from "./lib/announcements.mjs";

const validSource = `# 站内公告

## 2026-07-20｜较早公告

第一段正文。

第二段正文。

## 2026-07-26｜较新公告

最新正文。`;

assert.deepEqual(parseAnnouncements(validSource), [
  { date: "2026-07-26", title: "较新公告", body: "最新正文。" },
  { date: "2026-07-20", title: "较早公告", body: "第一段正文。\n\n第二段正文。" },
]);
assert.throws(() => parseAnnouncements("# 站内公告\n\n## 标题\n\n正文"), /日期和标题/);
assert.throws(() => parseAnnouncements("# 站内公告\n\n## 2026-07-26｜标题"), /正文/);
assert.equal(
  serializeAnnouncements([{ date: "2026-07-26", title: "标题", body: "正文" }]),
  'window.VICDATA_ANNOUNCEMENTS = [\n  {\n    "date": "2026-07-26",\n    "title": "标题",\n    "body": "正文"\n  }\n];\n',
);

const checkDir = path.dirname(fileURLToPath(import.meta.url));
const builderFile = path.join(checkDir, "build_announcements_data.mjs");
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vicdata-announcements-"));
try {
  fs.mkdirSync(path.join(fixtureRoot, "site"));
  fs.writeFileSync(path.join(fixtureRoot, "announcements.md"), validSource, "utf8");
  execFileSync(process.execPath, [builderFile, fixtureRoot], { stdio: "pipe" });
  assert.equal(
    fs.readFileSync(path.join(fixtureRoot, "site", "announcement-data.js"), "utf8"),
    serializeAnnouncements(parseAnnouncements(validSource)),
  );
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log("announcement parser checks passed");
