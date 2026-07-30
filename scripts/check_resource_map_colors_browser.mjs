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
  await page.waitForFunction(
    () => window.__resourceMapTextCalls.filter((text) => text === "小麦农场").length >= 2,
    { timeout: 20000 },
  );
  const wheatCalls = await page.evaluate(() => window.__resourceMapTextCalls.filter((text) => text === "小麦农场").length);
  await page.evaluate(() => { window.__resourceMapTextCalls = []; });
  await page.locator("[data-resource-filter='building_iron_mine']").click();
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.__resourceMapTextCalls.includes("铁矿")), false, "non-agricultural iron must not draw a text watermark");
  assert.ok(wheatCalls >= 2, "wheat must draw text watermarks in multiple strategic regions");
  assert.deepEqual(errors, [], `page errors: ${errors.join(" | ")}`);
  await page.close();
  console.log(JSON.stringify({ resource_map_colors_browser: "ok", wheat_calls: wheatCalls, baseUrl }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
