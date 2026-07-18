import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readSiteAppSource, readSiteStyleSource } from "./site_frontend_sources.mjs";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "site", "news-data.js"), "utf8");
const index = fs.readFileSync(path.join(root, "site", "index.html"), "utf8");
const match = source.match(/window\.VIC3_NEWS_DATA\s*=\s*(\[[\s\S]*\]);\s*$/);
assert(match, "news-data.js must define VIC3_NEWS_DATA");
const items = JSON.parse(match[1]);
assert(items.some((item) => item.category === "diary"), "news data must contain developer diaries");
assert(items.some((item) => item.category === "patch"), "news data must contain version updates");
assert(items.some((item) => item.category === "other"), "news data must contain official videos");
assert(items.every((item) => /^https:\/\//.test(item.url)), "news URLs must use HTTPS");
assert(items.every((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date)), "news items must have ISO dates");
const diaryItems = items.filter((item) => item.category === "diary");
assert(diaryItems.every((item) => /^#\d+\s/.test(item.title)), "developer diary titles must begin with their number");
assert(diaryItems.some((item) => item.title.startsWith("#1 ")), "developer diary #1 title must be labeled");
assert(diaryItems.some((item) => item.title.startsWith("#184 ")), "developer diary #184 title must be labeled");
const diaryVideo = items.find((item) => item.id === "other-76");
assert.equal(diaryVideo?.category, "diary", "official videos titled Dev Diary must appear under developer diaries");
assert.equal(diaryVideo?.label, "开发日志", "developer diary videos must use the developer diary label");
assert.match(diaryVideo?.title || "", /^#174 The Great Wave & Volume 3$/, "developer diary videos must display their diary number");
assert.match(index, /src="news-data\.js\?v=/, "index must load the news data before the app scripts");

const app = readSiteAppSource(root);
assert.match(app, /news: "游戏资讯"/, "news view label must exist");
assert.match(app, /parts\[0\]\s*===\s*"news"/, "hash routing must handle the news board");
assert.match(app, /function renderNewsBoard\(/, "news board renderer must exist");
assert.match(app, /const HOME_NEWS_PAGE_SIZE = 10/, "home news page size must be ten");
assert.match(app, /const NEWS_PAGE_SIZE = 25/, "news board page size must be twenty-five");
assert.match(app, /all: "全部"/, "home news must include the all category");
assert.match(app, /diary: "开发日志"/, "home news must include the diary category");
assert.match(app, /patch: "版本更新"/, "home news must include the patch category");
assert.match(app, /other: "其他"/, "home news must include the other category");
assert.match(app, /data-news-category="\$\{key\}"/, "home news category buttons must expose category values");
assert.match(app, /查看更多\s*→/, "home news must expose the more link");

const styles = readSiteStyleSource(root);
assert.match(styles, /\.home-news-tabs\s*,\s*\.news-board-tabs\s*\{/, "home news tabs must have styles");
assert.match(styles, /\.home-news-more\s*\{/, "home more link must have styles");
assert.match(styles, /\.news-board\s*\{/, "news board must have styles");
assert.match(styles, /\.news-pagination\s*\{/, "news board pagination must have styles");
assert.match(styles, /body\[data-view="news"\]\s+\.map-panel/, "news view must hide the map");
const mobileStyles = styles.match(/@media \(max-width: 820px\) \{([\s\S]*?)\n}\n\n@media \(max-width: 520px\)/)?.[1] || "";
assert.match(mobileStyles, /\.news-board/, "news board must adapt to narrow screens");
assert.match(mobileStyles, /\.home-links\s*\{[\s\S]*position:\s*static/, "home links must leave absolute positioning on narrow screens");

console.log(JSON.stringify({
  newsBoard: "ok",
  total: items.length,
  categories: {
    diary: items.filter((item) => item.category === "diary").length,
    patch: items.filter((item) => item.category === "patch").length,
    other: items.filter((item) => item.category === "other").length,
  },
}, null, 2));
