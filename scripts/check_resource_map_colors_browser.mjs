import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const baseUrl = process.argv[2] || "http://127.0.0.1:8876/index.html";
const chromePath = process.env.VC_CHROME_PATH || "";
const browser = await chromium.launch({
  headless: true,
  ...(chromePath ? { executablePath: chromePath } : {}),
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });

try {
  await context.addInitScript(() => {
    window.__resourceMapTextCalls = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function patchedFillText(text, ...args) {
      if (text === "小麦农场" || text === "铁矿") window.__resourceMapTextCalls.push(String(text));
      return original.call(this, text, ...args);
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

  await page.goto(`${baseUrl}#/region`, { waitUntil: "networkidle", timeout: 45000 });
  await page.locator("[data-resource-filter='building_wheat_farm']").click();
  const wheat = await waitForResourceContext(page);
  assert.match(wheat.text, /小麦农场/, "wheat context must show the selected resource name");
  assert.match(wheat.text, /\d+\.\d+/, "wheat context must show the data version");
  assert.match(wheat.icon, /assets\/buildings\/wheat_farm\.png$/, "wheat context must show the wheat farm icon");
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__resourceMapTextCalls.includes("小麦农场")), false, "wheat must not draw a canvas watermark");

  await page.evaluate(() => { window.__resourceMapTextCalls = []; });
  await page.locator("[data-resource-filter='building_iron_mine']").click();
  const iron = await waitForResourceContext(page);
  assert.match(iron.text, /铁矿/, "iron context must replace the selected resource name");
  assert.match(iron.icon, /assets\/buildings\/iron_mine\.png$/, "iron context must show the iron mine icon");
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__resourceMapTextCalls.includes("铁矿")), false, "iron must not draw a canvas watermark");

  await page.locator("[data-resource-filter='building_iron_mine']").click();
  await page.waitForFunction(() => document.querySelector("#mapResourceContext")?.hidden === true, { timeout: 10000 });
  assert.deepEqual(errors, [], `page errors: ${errors.join(" | ")}`);
  await page.close();
  console.log(JSON.stringify({ resource_map_colors_browser: "ok", wheat, iron, baseUrl }, null, 2));
} finally {
  await context.close();
  await browser.close();
}

async function waitForResourceContext(page) {
  await page.waitForFunction(() => document.querySelector("#mapResourceContext")?.hidden === false, { timeout: 20000 });
  return page.locator("#mapResourceContext").evaluate((element) => ({
    text: element.textContent?.replace(/\s+/g, " ").trim() || "",
    icon: element.querySelector("img")?.getAttribute("src") || "",
  }));
}
