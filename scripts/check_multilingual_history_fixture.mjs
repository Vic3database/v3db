import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const repositoryRoot = process.cwd();
const sourceSite = path.join(repositoryRoot, "site");
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vicdata-history-fixture-"));
const fixtureSite = path.join(fixtureRoot, "site");
const chromePath = process.env.VC_CHROME_PATH || "";
const runtimeErrors = [];
const failedScriptUrls = [];
let server;
let browser;

try {
  createFixtureSite();
  server = await serveFixture(fixtureSite);
  browser = await chromium.launch({ headless: true, ...(chromePath ? { executablePath: chromePath } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() < 400) return;
    const pathname = new URL(response.url()).pathname;
    if (pathname.endsWith(".js")) failedScriptUrls.push(pathname);
  });

  const initialUrl = `${server.url}index.html?version=history-fixture&lang=en#/country/PRU`;
  await page.goto(initialUrl, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForFunction(() => (
    document.documentElement.lang === "en"
      && document.body.dataset.view === "country"
      && document.querySelector(".detail-title h2")?.textContent?.trim() === "Prussia"
  ), { timeout: 20000 });
  assert.match(page.url(), /version=history-fixture/, "direct link must retain the fixture version");
  assert.match(page.url(), /lang=en/, "direct link must retain English");
  assertEnglishHasNoHanText(await page.locator("body").innerText(), "country");

  await page.reload({ waitUntil: "networkidle", timeout: 45000 });
  await page.waitForFunction(() => (
    document.documentElement.lang === "en"
      && document.querySelector(".detail-title h2")?.textContent?.trim() === "Prussia"
  ), { timeout: 20000 });
  assertEnglishHasNoHanText(await page.locator("body").innerText(), "culture");

  await page.goto(`${server.url}index.html?version=history-fixture&lang=en#/culture`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForFunction(() => (
    document.documentElement.lang === "en"
      && document.body.dataset.view === "culture"
      && Boolean(document.querySelector("[data-culture]"))
  ), { timeout: 20000 });
  await page.goto(`${server.url}index.html?version=history-fixture&lang=en#/region`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForFunction(() => (
    document.documentElement.lang === "en"
      && document.body.dataset.view === "region"
      && Boolean(document.querySelector('[data-resource-filter="building_coal_mine"]'))
  ), { timeout: 20000 });
  await page.locator('[data-resource-filter="building_coal_mine"]').click();
  await page.waitForFunction(() => document.querySelector("#mapResourceContext")?.textContent?.trim(), { timeout: 10000 });
  assertEnglishHasNoHanText(await page.locator("body").innerText(), "region selected resource");

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${server.url}index.html?version=history-fixture&lang=en#/state-region/STATE_BRANDENBURG`, { waitUntil: "networkidle", timeout: 45000 });
    await waitForEnglishDetail(page, "region");
    const mapiSummaryLabels = (await page.locator('[data-concept-key="mapi-summary"]').allInnerTexts()).map((item) => item.trim());
    assert.ok(mapiSummaryLabels.length > 0, `history region list must expose MAPI summary tags at ${viewport.width}px`);
    assert.deepEqual([...new Set(mapiSummaryLabels)], ["MAPI"], `history MAPI summary tags must stay generic at ${viewport.width}px`);
    const stateTrait = page.locator('.detail [data-concept-kind="stateTrait"][data-concept-key="state_trait_oder_river"]').first();
    assert.equal(
      await stateTrait.getAttribute("data-concept-description"),
      "Infrastructure +15",
      `history English state-trait tooltip must expose structural modifier values at ${viewport.width}px`,
    );
    await stateTrait.hover();
    await page.locator("#conceptTooltip:not([hidden])").waitFor({ timeout: 5000 });
    assert.match(
      await page.locator("#conceptTooltip").innerText(),
      /Infrastructure \+15/,
      `history English state-trait tooltip must render modifier values at ${viewport.width}px`,
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(`${server.url}index.html?version=history-fixture&lang=en#/law/law_monarchy`, { waitUntil: "networkidle", timeout: 45000 });
  await waitForEnglishDetail(page, "law");
  const lawValues = await page.locator(".detail > .law-effect-list > li:not(.law-effect-section-label) strong").allInnerTexts();
  assert.deepEqual(lawValues.map((value) => value.trim()), ["+20", "+10%", "+25%", "+200"], "history law effects must expose structural values");
  assertEnglishHasNoGameMarkup(await page.locator(".detail > .law-effect-list").innerText(), "law effects");

  await page.goto(`${server.url}index.html?version=history-fixture&lang=en#/ideology/ideology_ibadi_imamate`, { waitUntil: "networkidle", timeout: 45000 });
  await waitForEnglishDetail(page, "ideology");
  assertEnglishHasNoGameMarkup(await page.locator(".vic3-ideology-desc").innerText(), "ideology description");

  await page.goto(`${server.url}index.html?version=history-fixture&lang=en#/company/company_aker_mek`, { waitUntil: "networkidle", timeout: 45000 });
  await waitForEnglishDetail(page, "company");
  const ownershipCategory = await page.evaluate(() => {
    const term = [...document.querySelectorAll(".detail dt")].find((node) => node.textContent?.trim() === "Ownership category");
    return term?.nextElementSibling?.textContent?.trim() || "";
  });
  assert.equal(ownershipCategory, "None", "history company without an ownership category must not repeat its name");
  const prosperityText = await page.locator(".tag-effect").allInnerTexts();
  assert.deepEqual(prosperityText.map((value) => value.match(/[+-][\d.,]+%?$/)?.[0] || ""), ["+15%", "+5%"], "history company prosperity effects must expose structural values");
  assertEnglishHasNoGameMarkup(prosperityText.join("\n"), "company prosperity effects");
  assert.deepEqual(failedScriptUrls, [], `fixture failed to load scripts: ${failedScriptUrls.join(", ")}`);
  assert.deepEqual(runtimeErrors, [], runtimeErrors.join("\n"));
  await page.close();
  console.log(JSON.stringify({ multilingual_history_fixture: "ok", version: "history-fixture", locale: "en", routes: ["country", "culture", "region selected resource", "state trait", "law", "ideology", "company"] }));
} finally {
  await browser?.close();
  await new Promise((resolve) => server?.httpServer.close(resolve) || resolve());
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

async function waitForEnglishDetail(page, view) {
  await page.waitForFunction((expectedView) => (
    document.documentElement.lang === "en"
      && document.body.dataset.view === expectedView
      && Boolean(document.querySelector(".detail h2"))
  ), view, { timeout: 20000 });
}

function assertEnglishHasNoHanText(text, board) {
  const lines = [...new Set(String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /[\u3400-\u9fff\uf900-\ufaff]/.test(line)))];
  assert.ok(lines.length === 0, `${board} English history page contains Chinese text: ${lines.slice(0, 8).join(" | ")}`);
}

function assertEnglishHasNoGameMarkup(text, board) {
  assert.doesNotMatch(
    String(text || ""),
    /#!|#(?:lore|italic)\b|\[(?:concept_[A-Za-z0-9_]+|Nbsp)\]|\$[A-Za-z0-9_:.]+\$|@[A-Za-z0-9_]+!/,
    `${board} English history page contains raw game localization markup`,
  );
}

function createFixtureSite() {
  fs.mkdirSync(fixtureSite, { recursive: true });
  for (const relative of [
    "index.html",
    "styles.css",
    "announcement-data.js",
    "news-data.js",
    "app",
    "locales",
    "assets/flags/country-flags.js",
    "assets/victorian-century-flags.js",
  ]) copyRequired(relative);
  fs.mkdirSync(path.join(fixtureSite, "versions"), { recursive: true });
  fs.cpSync(path.join(sourceSite, "versions", "1.13.9"), path.join(fixtureSite, "versions", "history-fixture"), { recursive: true });
  const htmlFile = path.join(fixtureSite, "index.html");
  const html = fs.readFileSync(htmlFile, "utf8").replace('src="versions.js?v=20260729-vc-library-navigation1"', 'src="history-versions.js"');
  assert.notEqual(html, fs.readFileSync(htmlFile, "utf8"), "fixture must replace the public version configuration");
  fs.writeFileSync(htmlFile, html);
  fs.writeFileSync(path.join(fixtureSite, "history-versions.js"), `window.VIC3_VERSION_CONFIG = Object.freeze({
  site_title: "Vicdata history fixture",
  default_version: "history-fixture",
  libraries: [],
  version_groups: [],
  versions: [{
    version: "history-fixture",
    label: "History Fixture",
    data_index: "versions/history-fixture/data-index.js",
    map_data: "versions/history-fixture/map-data.js",
  }],
  changelogs: [],
});\n`);
}

function copyRequired(relative) {
  const source = path.join(sourceSite, relative);
  const target = path.join(fixtureSite, relative);
  assert(fs.existsSync(source), `missing source fixture file: ${relative}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

async function serveFixture(root) {
  const httpServer = http.createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const requested = path.resolve(root, decodeURIComponent(url.pathname).replace(/^\//, "") || "index.html");
    if (requested !== root && !requested.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    fs.readFile(requested, (error, body) => {
      if (error) {
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(200, { "Content-Type": contentType(requested), "Cache-Control": "no-store" }).end(body);
    });
  });
  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  return { httpServer, url: `http://127.0.0.1:${address.port}/` };
}

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  return "application/octet-stream";
}
