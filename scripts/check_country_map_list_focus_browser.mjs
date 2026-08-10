import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const standalone = process.argv.includes("--standalone");
const entryPath = process.argv.includes("--vc") ? "vc/index.html" : "index.html";
const server = await startPreviewServer(path.join(process.cwd(), standalone ? "Victorian Century Database" : "site"));
const chromePath = process.env.VC_CHROME_PATH || "";
const browser = await chromium.launch({
  headless: true,
  ...(chromePath ? { executablePath: chromePath } : {}),
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

try {
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });

  await page.goto(`${server.url}/${entryPath}#/country`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForFunction(() => window.eval("mapRuntime.ready") && document.querySelectorAll("#countryList [data-country]").length > 50, { timeout: 30000 });
  await page.evaluate(() => document.querySelector(".results")?.scrollTo({ top: 0, behavior: "instant" }));

  const target = await findOffscreenCountryOnCanvas(page);
  assert(target, "country map needs an on-canvas country whose list card starts outside the visible list area");
  const transformBeforeSelection = await page.evaluate(() => ({ ...window.eval("mapRuntime.transform") }));
  await page.locator("#mapCanvas").dispatchEvent("pointerdown", target.pointer);
  await page.locator("#mapCanvas").dispatchEvent("pointerup", target.pointer);
  await page.waitForFunction((tag) => window.eval("state.selectedTag") === tag, target.countryTag, { timeout: 10000 });
  await page.waitForTimeout(800);

  const listFocus = await page.evaluate((countryTag) => {
    const list = document.querySelector("#countryList");
    const results = list?.closest(".results");
    const row = [...(list?.querySelectorAll("[data-country]") || [])]
      .find((item) => item.dataset.country === countryTag);
    const rowRect = row?.getBoundingClientRect();
    const resultsRect = results?.getBoundingClientRect();
    return {
      selectedTag: window.eval("state.selectedTag"),
      scrollTop: results?.scrollTop || 0,
      rowExists: Boolean(row),
      rowTop: rowRect?.top || null,
      rowBottom: rowRect?.bottom || null,
      resultsTop: resultsRect?.top || null,
      resultsBottom: resultsRect?.bottom || null,
    };
  }, target.countryTag);
  assert(
    listFocus.rowExists
      && listFocus.scrollTop > 0
      && listFocus.rowTop >= listFocus.resultsTop
      && listFocus.rowBottom <= listFocus.resultsBottom,
    `map click must scroll an offscreen country card into the list viewport: ${JSON.stringify({ before: target, after: listFocus })}`,
  );
  assert.deepEqual(await page.evaluate(() => ({ ...window.eval("mapRuntime.transform") })), transformBeforeSelection, "list focus must preserve the current map transform");
  assert.equal(await page.evaluate(() => location.hash), "#/country", "single map click must keep the country board route");
  assert.deepEqual(errors, [], `page errors: ${errors.join(" | ")}`);
  console.log(JSON.stringify({ country_map_list_focus_browser: "ok", target, listFocus, standalone, entryPath, baseUrl: server.url }, null, 2));
} finally {
  await context.close();
  await browser.close();
  await server.close();
}

async function findOffscreenCountryOnCanvas(page) {
  return page.evaluate(() => {
    const runtime = window.eval("mapRuntime");
    const countryOwnerTagFromPointerEvent = window.eval("countryOwnerTagFromPointerEvent");
    const byTag = window.eval("byTag");
    const rect = document.querySelector("#mapCanvas").getBoundingClientRect();
    const resultsRect = document.querySelector(".results").getBoundingClientRect();
    for (const [, center] of runtime.stateCenters) {
      const clientX = rect.left + center.x * runtime.transform.scale + runtime.transform.x;
      const clientY = rect.top + center.y * runtime.transform.scale + runtime.transform.y;
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) continue;
      const countryTag = countryOwnerTagFromPointerEvent({ clientX, clientY });
      const row = document.querySelector(`#countryList [data-country="${CSS.escape(countryTag)}"]`);
      const rowRect = row?.getBoundingClientRect();
      if (!byTag.has(countryTag) || !rowRect || (rowRect.top >= resultsRect.top && rowRect.bottom <= resultsRect.bottom)) continue;
      return {
        countryTag,
        rowTop: rowRect.top,
        rowBottom: rowRect.bottom,
        pointer: { clientX, clientY, pointerId: 1, pointerType: "mouse" },
      };
    }
    return null;
  });
}

function startPreviewServer(root) {
  const mime = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
  };
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
    const requested = path.resolve(root, pathname.slice(1));
    if (requested !== root && !requested.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    const target = fs.statSync(requested, { throwIfNoEntry: false })?.isDirectory()
      ? path.join(requested, "index.html")
      : requested;
    fs.readFile(target, (error, body) => {
      if (error) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": mime[path.extname(target).toLowerCase()] || "application/octet-stream" });
      response.end(body);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}
