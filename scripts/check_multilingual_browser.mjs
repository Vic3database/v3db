import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const baseUrl = process.argv[2] || "http://127.0.0.1:8876/index.html";
const screenshotRoot = path.resolve(process.argv[3] || "screenshots/multilingual");
const chromePath = process.env.VC_CHROME_PATH || "";
const siteName = process.env.VICDATA_SITE_NAME || (new URL(baseUrl).pathname.includes("/vc/") ? "vc" : "main");
const routes = [
  { board: "country", route: "country/PRU", list: "[data-country]" },
  { board: "culture", route: "culture/north_german", list: "[data-culture]" },
  { board: "region", route: "state-region/STATE_BRANDENBURG", list: "[data-state-region]" },
  { board: "company", route: "company/company_a_markwald_and_company", list: "[data-company]" },
  { board: "ideology", route: "ideology/ideology_abolitionist", list: "[data-ideology]" },
  { board: "law", route: "law/law_monarchy", list: "[data-law]" },
  { board: "technology", route: "technology/academia", list: "[data-technology-key]" },
  { board: "achievement", route: "achievement/achievement_viva_la_confederacion", list: "[data-achievement-key]" },
];
const viewports = [
  { name: "1440x1000", width: 1440, height: 1000 },
  { name: "390x844", width: 390, height: 844 },
];

fs.mkdirSync(screenshotRoot, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(chromePath ? { executablePath: chromePath } : {}) });

try {
  await verifyLocaleBoundaries();
  const screenshots = await captureBoardScreenshots();
  console.log(JSON.stringify({
    multilingual_browser: "ok",
    base_url: baseUrl,
    site: siteName,
    routes: routes.map(({ board }) => board),
    viewports: viewports.map(({ name }) => name),
    screenshots,
  }));
} finally {
  await browser.close();
}

async function verifyLocaleBoundaries() {
  const searchPage = await newPage({ width: 1440, height: 600 });
  await searchPage.addInitScript(() => localStorage.clear());
  await searchPage.goto(urlFor("country/PRU", "zh-Hans"), { waitUntil: "networkidle", timeout: 45000 });
  await waitForDetail(searchPage, "zh-Hans");
  await searchPage.locator("#globalSearchButton").click();
  for (const query of ["普鲁士", "Prussia", "PRU"]) {
    await searchPage.locator("#globalSearchDialogInput").fill(query);
    await searchPage.waitForFunction((expected) => (
      [...document.querySelectorAll("[data-result-key]")].some((node) => node.dataset.resultKey === expected)
    ), "PRU", { timeout: 10000 });
  }
  await searchPage.locator("#globalSearchCloseButton").click();
  await searchPage.close();

  const page = await newPage({ width: 1440, height: 600 });
  await page.addInitScript(() => localStorage.clear());
  await page.goto(urlFor("country/PRU", "zh-Hans"), { waitUntil: "networkidle", timeout: 45000 });
  await waitForDetail(page, "zh-Hans");
  const before = await page.evaluate(() => {
    const input = document.querySelector("#searchInput");
    input.value = "PRU";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return { hash: location.hash, query: input.value };
  });
  await page.waitForFunction(() => document.querySelector(".detail")?.scrollHeight > document.querySelector(".detail")?.clientHeight, { timeout: 10000 });
  const beforeSwitch = await page.evaluate(() => {
    const detail = document.querySelector(".detail");
    detail.scrollTop = Math.min(80, Math.max(0, detail.scrollHeight - detail.clientHeight));
    return { scrollTop: detail.scrollTop };
  });
  assert.ok(beforeSwitch.scrollTop > 0, "test setup must establish a detail scroll position");
  await page.locator("#languageMenuButton").click();
  await page.locator('#languageMenu [data-locale="en"]').click();
  await page.waitForFunction(() => document.documentElement.lang === "en", { timeout: 20000 });
  await page.waitForTimeout(50);
  const switched = await page.evaluate(() => ({
    hash: location.hash,
    query: document.querySelector("#searchInput")?.value || "",
    scrollTop: document.querySelector(".detail")?.scrollTop || 0,
    title: document.querySelector(".detail h2")?.textContent || "",
  }));
  assert.equal(switched.hash, before.hash, "language switch must retain the current detail");
  assert.equal(switched.query, before.query, "language switch must retain the active filter");
  assert.equal(switched.scrollTop, beforeSwitch.scrollTop, "language switch must retain detail scroll position");
  assert.match(switched.title, /Prussia/, "English country detail must render after switching");
  await page.reload({ waitUntil: "networkidle", timeout: 45000 });
  await waitForDetail(page, "en");
  assert.match(page.url(), /[?&]lang=en(?:&|#|$)/, "refresh must retain the selected locale");
  await page.close();

  const fallbackPage = await newPage({ width: 1440, height: 600 });
  await fallbackPage.addInitScript(() => localStorage.clear());
  await fallbackPage.goto(urlFor("country/PRU", "unsupported"), { waitUntil: "networkidle", timeout: 45000 });
  await waitForDetail(fallbackPage, "zh-Hans");
  assert.match(fallbackPage.url(), /[?&]lang=zh-Hans(?:&|#|$)/, "unsupported locale must use browser language fallback");
  await fallbackPage.close();

  const failurePage = await newPage({ width: 1440, height: 600 });
  await failurePage.addInitScript(() => localStorage.clear());
  await failurePage.goto(urlFor("country/PRU", "zh-Hans"), { waitUntil: "networkidle", timeout: 45000 });
  await waitForDetail(failurePage, "zh-Hans");
  const failureBefore = await failurePage.evaluate(() => ({
    hash: location.hash,
    title: document.querySelector(".detail h2")?.textContent || "",
  }));
  await failurePage.evaluate(() => {
    window.VIC3_DATA_INDEX.locales.chunks.en.country.files[0].path = "locale-missing.en.js";
    switchLocale("en");
  });
  await failurePage.waitForTimeout(500);
  const failureAfter = await failurePage.evaluate(() => ({
    locale: document.documentElement.lang,
    hash: location.hash,
    title: document.querySelector(".detail h2")?.textContent || "",
  }));
  assert.equal(failureAfter.locale, "zh-Hans", "failed locale load must keep the active locale");
  assert.equal(failureAfter.hash, failureBefore.hash, "failed locale load must keep the current detail");
  assert.equal(failureAfter.title, failureBefore.title, "failed locale load must keep rendered data");
  await failurePage.close();

  const rapidPage = await newPage({ width: 1440, height: 600 });
  await rapidPage.addInitScript(() => localStorage.clear());
  await rapidPage.goto(urlFor("country/PRU", "zh-Hans"), { waitUntil: "networkidle", timeout: 45000 });
  await waitForDetail(rapidPage, "zh-Hans");
  await rapidPage.evaluate(() => {
    switchLocale("en");
    queueMicrotask(() => switchLocale("zh-Hans"));
  });
  await rapidPage.waitForTimeout(500);
  assert.equal(await rapidPage.evaluate(() => document.documentElement.lang), "zh-Hans", "latest rapid locale choice must win");
  await rapidPage.close();
}

async function captureBoardScreenshots() {
  const screenshots = [];
  const page = await newPage(viewports[0]);
  await page.addInitScript(() => localStorage.clear());
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const item of routes) {
      await page.goto(urlFor(item.route, "en"), { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForSelector(item.list, { state: "attached", timeout: 20000 });
      await waitForDetail(page, "en");
      const layout = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        overlappingNavigationLabels: [...document.querySelectorAll(".topbar-nav-item span")].some((node, index, labels) => {
          const current = node.getBoundingClientRect();
          const next = labels[index + 1]?.getBoundingClientRect();
          return next && current.right > next.left + 1;
        }),
      }));
      assert.ok(layout.scrollWidth <= layout.viewportWidth + 1, `${item.board} English layout overflows at ${viewport.width}px`);
      assert.equal(layout.overlappingNavigationLabels, false, `${item.board} English navigation labels overlap at ${viewport.width}px`);
      const output = path.join(screenshotRoot, `${siteName}-${item.board}-en-${viewport.name}.png`);
      await page.screenshot({ path: output, fullPage: false });
      screenshots.push(path.relative(process.cwd(), output).replace(/\\/g, "/"));
    }
  }
  await page.close();
  return screenshots;
}

function urlFor(route, locale) {
  const url = new URL(baseUrl);
  url.searchParams.set("lang", locale);
  url.hash = `/${route}`;
  return url.href;
}

async function waitForDetail(page, locale) {
  await page.waitForFunction((expectedLocale) => (
    document.documentElement.lang === expectedLocale
      && Boolean(document.querySelector(".detail h2, .technology-detail h2, .achievement-detail h2"))
  ), locale, { timeout: 20000 });
}

async function newPage(viewport) {
  return browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
}
