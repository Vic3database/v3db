import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "docs", "vic3-资讯链接.md");
const outputPath = path.join(root, "site", "news-data.js");
const source = fs.readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, "");

const definitions = [
  { heading: "开发日志", category: "diary", label: "开发日志" },
  { heading: "更新日志", category: "patch", label: "版本更新" },
  { heading: "官方视频", category: "other", label: "官方视频" },
];

const items = definitions.flatMap((definition) => parseSection(source, definition));
assert(items.some((item) => item.id === "diary-1"), "developer diary #1 is missing");
assert(items.some((item) => item.id === "diary-184"), "developer diary #184 is missing");
assert(items.some((item) => item.id === "patch-1.13.9"), "patch 1.13.9 is missing");
assert(items.some((item) => item.id === "other-76"), "official video #76 is missing");

items.sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id));
fs.writeFileSync(outputPath, `window.VIC3_NEWS_DATA = ${JSON.stringify(items, null, 2)};\n`, "utf8");

function parseSection(markdown, { heading, category, label }) {
  const start = markdown.indexOf(`## ${heading}`);
  assert(start >= 0, `missing ${heading} section`);
  const next = markdown.indexOf("\n## ", start + 1);
  const rows = markdown.slice(start, next < 0 ? undefined : next).split(/\r?\n/);
  return rows.flatMap((line) => {
    const match = line.match(/^\|\s*(?:(\d+)\s*\|\s*)?\[(.+)]\((https:\/\/[^)]+)\)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|/);
    if (!match) return [];
    const [, ordinal, title, url, date] = match;
    const videoDiary = category === "other" && title.match(/^Dev Diary #(\d+)\s*-\s*(.+)$/i);
    const identifier = category === "patch" ? title : ordinal;
    assert(identifier, `${heading} row has no identifier: ${title}`);
    return [{
      id: `${category}-${identifier}`,
      category: videoDiary ? "diary" : category,
      label: videoDiary ? "开发日志" : label,
      title: category === "diary"
        ? `#${ordinal} ${title}`
        : videoDiary ? `#${videoDiary[1]} ${videoDiary[2]}` : title,
      date,
      url,
    }];
  });
}
