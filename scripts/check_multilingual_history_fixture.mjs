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
  assert.deepEqual(failedScriptUrls, [], `fixture failed to load scripts: ${failedScriptUrls.join(", ")}`);
  assert.deepEqual(runtimeErrors, [], runtimeErrors.join("\n"));
  await page.close();
  console.log(JSON.stringify({ multilingual_history_fixture: "ok", version: "history-fixture", locale: "en", routes: ["country", "culture", "region selected resource"] }));
} finally {
  await browser?.close();
  await new Promise((resolve) => server?.httpServer.close(resolve) || resolve());
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

function assertEnglishHasNoHanText(text, board) {
  const lines = [...new Set(String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /[\u3400-\u9fff\uf900-\ufaff]/.test(line)))];
  assert.ok(lines.length === 0, `${board} English history page contains Chinese text: ${lines.slice(0, 8).join(" | ")}`);
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
