import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const baseUrl = new URL(process.argv[2] || "http://127.0.0.1:4173/");
const homeUrl = new URL("#/home", baseUrl).href;
const vcUrl = new URL("vc/index.html", baseUrl).href;
const mainIndexUrl = new URL("index.html", baseUrl).href;
const chromePath = process.env.VC_CHROME_PATH || "";
const browser = await chromium.launch({
  headless: true,
  ...(chromePath ? { executablePath: chromePath } : {}),
});

const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

  await page.goto(homeUrl, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector("#vcHomeEntry", { timeout: 20000 });
  assert.equal(await page.locator("#vcHomeEntry").getAttribute("href"), "vc/index.html");
  assert.deepEqual(await page.locator("#librarySelect option").evaluateAll((options) => (
    options.map((option) => ({ value: option.value, text: option.textContent.trim() }))
  )), [
    { value: "vic3", text: "Victoria 3 原版 1.13.9" },
    { value: "victorian-century", text: "Victorian Century" },
  ]);

  await Promise.all([
    page.waitForURL(vcUrl, { timeout: 20000 }),
    page.locator("#vcHomeEntry").click(),
  ]);
  await page.waitForSelector("#countryList .home-category-card", { timeout: 20000 });
  assert.equal(await page.title(), "首页 - Victorian Century Database");

  await Promise.all([
    page.waitForURL(mainIndexUrl, { timeout: 20000 }),
    page.selectOption("#standaloneLibrarySelect", "vic3"),
  ]);
  await page.waitForSelector("#librarySelect", { timeout: 20000 });

  await page.goto(homeUrl, { waitUntil: "networkidle", timeout: 45000 });
  await Promise.all([
    page.waitForURL(vcUrl, { timeout: 20000 }),
    page.selectOption("#librarySelect", "victorian-century"),
  ]);
  await page.waitForSelector("#countryList .home-category-card", { timeout: 20000 });
  assert.equal(await page.title(), "首页 - Victorian Century Database");

  if (errors.length) throw new Error(errors.join("\n"));
  console.log(JSON.stringify({ victorian_century_main_entry_browser: "ok", base_url: baseUrl.href }, null, 2));
} finally {
  await browser.close();
}
