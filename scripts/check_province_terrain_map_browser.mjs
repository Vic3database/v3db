import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const baseUrl = process.argv[2] || "http://127.0.0.1:8877/index.html";
const chromePath = process.env.VC_CHROME_PATH || "";
const browser = await chromium.launch({
  headless: true,
  ...(chromePath ? { executablePath: chromePath } : {}),
});
const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });

try {
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  await page.goto(`${baseUrl}#/region`, { waitUntil: "networkidle", timeout: 45000 });

  await page.locator("#terrainMapViewButton").click();
  await page.waitForFunction(() => document.querySelector("#terrainMapLegend")?.hidden === false, { timeout: 30000 });
  const initial = await page.evaluate(() => ({
    buttonPressed: document.querySelector("#terrainMapViewButton")?.getAttribute("aria-pressed"),
    legendItems: document.querySelectorAll(".terrain-map-legend-item").length,
    legendText: document.querySelector("#terrainMapLegend")?.textContent?.replace(/\s+/g, " ").trim(),
    mapMode: window.eval("state.mapMode"),
    view: window.eval("state.regionMapView"),
  }));
  assert.equal(initial.buttonPressed, "true", "terrain button must be pressed");
  assert.equal(initial.legendItems, 10, "terrain legend must render ten land entries");
  assert.match(initial.legendText, /平原.*森林.*丘陵.*山地.*丛林.*湿地.*沙漠.*苔原.*稀树草原.*极地/, "terrain legend must retain its agreed order");
  assert.equal(initial.mapMode, "terrain", "terrain button must select terrain map mode");
  assert.equal(initial.view, "terrain", "terrain button must retain terrain region view state");

  const sampled = await page.evaluate(() => {
    const runtime = window.eval("mapRuntime");
    const terrain = window.eval("terrainLandKeys");
    const terrainKeyForPixel = window.eval("terrainKeyForPixel");
    const canvasRect = document.querySelector("#mapCanvas").getBoundingClientRect();
    const startRow = Math.max(64, Math.ceil((320 - runtime.transform.y) / runtime.transform.scale));
    const endRow = Math.min(runtime.height - 1, Math.floor((canvasRect.height - 120 - runtime.transform.y) / runtime.transform.scale));
    for (let y = startRow; y <= endRow; y += 1) {
      const rowStart = y * runtime.width;
      for (let x = 0; x < runtime.width; x += 1) {
        const pixel = rowStart + x;
      const terrainKey = terrainKeyForPixel(pixel);
      const stateKey = runtime.stateKeysByIndex[runtime.pixelStateIndexes[pixel] || 0];
      if (terrain.has(terrainKey) && stateKey) {
        return { x: pixel % runtime.width, y: Math.floor(pixel / runtime.width), terrainKey, stateKey };
      }
      }
    }
    return null;
  });
  assert(sampled, "map must contain a land terrain pixel");
  const screenPoint = await page.evaluate(({ x, y }) => {
    const runtime = window.eval("mapRuntime");
    const rect = document.querySelector("#mapCanvas").getBoundingClientRect();
    return {
      x: rect.left + runtime.transform.x + (x + 0.5) * runtime.transform.scale,
      y: rect.top + runtime.transform.y + (y + 0.5) * runtime.transform.scale,
    };
  }, sampled);
  await page.locator("#mapCanvas").dispatchEvent("pointermove", {
    clientX: screenPoint.x,
    clientY: screenPoint.y,
    pointerId: 1,
    pointerType: "mouse",
  });
  await page.waitForFunction(() => document.querySelector("#mapTooltip")?.hidden === false, { timeout: 10000 });
  const tooltip = await page.locator("#mapTooltip").innerText();
  assert.match(tooltip, /省份代码\s*x[0-9A-F]{6}/, "land hover must show x plus six uppercase hexadecimal digits");
  assert.match(tooltip, /地形/, "land hover must show terrain");
  assert.match(tooltip, /所属地域/, "land hover must show parent state region");
  assert.match(tooltip, /战略区域/, "land hover must show strategic region");

  const waterPoint = await page.evaluate(() => {
    const runtime = window.eval("mapRuntime");
    const terrain = window.eval("terrainLandKeys");
    const terrainKeyForPixel = window.eval("terrainKeyForPixel");
    const rect = document.querySelector("#mapCanvas").getBoundingClientRect();
    const startRow = Math.max(64, Math.ceil((320 - runtime.transform.y) / runtime.transform.scale));
    const endRow = Math.min(runtime.height - 1, Math.floor((rect.height - 120 - runtime.transform.y) / runtime.transform.scale));
    for (let y = startRow; y <= endRow; y += 1) {
      for (let x = 0; x < runtime.width; x += 1) {
        const pixel = y * runtime.width + x;
        if (terrain.has(terrainKeyForPixel(pixel))) continue;
        const clientX = rect.left + runtime.transform.x + (x + 0.5) * runtime.transform.scale;
        const clientY = rect.top + runtime.transform.y + (y + 0.5) * runtime.transform.scale;
        const resolved = window.eval("stateRegionFromPointerEvent")({ clientX, clientY });
        if (resolved) return { clientX, clientY, stateKey: resolved.key };
      }
    }
    return null;
  });
  assert(waterPoint, "map must contain an on-canvas water pixel");
  await page.locator("#mapCanvas").dispatchEvent("pointermove", {
    clientX: waterPoint.clientX,
    clientY: waterPoint.clientY,
    pointerId: 1,
    pointerType: "mouse",
  });
  await page.waitForFunction(() => document.querySelector("#mapTooltip")?.hidden === true, { timeout: 10000 });
  await page.locator("#mapCanvas").dispatchEvent("pointerdown", {
    clientX: waterPoint.clientX,
    clientY: waterPoint.clientY,
    pointerId: 1,
    pointerType: "mouse",
  });
  await page.locator("#mapCanvas").dispatchEvent("pointerup", {
    clientX: waterPoint.clientX,
    clientY: waterPoint.clientY,
    pointerId: 1,
    pointerType: "mouse",
  });
  const waterSelection = await page.evaluate(() => window.eval("state.selectedStateRegion"));
  assert.equal(waterSelection, "", "water clicks must not select a state region in terrain mode");

  await page.locator("#mapCanvas").dispatchEvent("pointerdown", {
    clientX: screenPoint.x,
    clientY: screenPoint.y,
    pointerId: 1,
    pointerType: "mouse",
  });
  await page.locator("#mapCanvas").dispatchEvent("pointerup", {
    clientX: screenPoint.x,
    clientY: screenPoint.y,
    pointerId: 1,
    pointerType: "mouse",
  });
  await page.waitForFunction(() => Boolean(window.eval("state.selectedStateRegion")), { timeout: 10000 });
  const selection = await page.evaluate(() => ({ selected: window.eval("state.selectedStateRegion"), hash: location.hash }));
  assert.equal(selection.selected, sampled.stateKey, "land click must select its parent state region");
  assert.equal(selection.hash, "#/region", "land click must keep the region board route");

  await page.evaluate(() => {
    const changeBoard = window.eval("changeBoard");
    const render = window.eval("render");
    const state = window.eval("state");
    changeBoard("region", "stateRegion");
    state.regionMapView = "terrain";
    state.selectedStateRegion = "";
    render();
  });
  await page.waitForFunction(() => window.eval("state.mapMode") === "terrain", { timeout: 10000 });
  const detailPoint = await page.evaluate(() => {
    const runtime = window.eval("mapRuntime");
    const terrain = window.eval("terrainLandKeys");
    const terrainKeyForPixel = window.eval("terrainKeyForPixel");
    const rect = document.querySelector("#mapCanvas").getBoundingClientRect();
    const startRow = Math.max(64, Math.ceil((320 - runtime.transform.y) / runtime.transform.scale));
    const endRow = Math.min(runtime.height - 1, Math.floor((rect.height - 120 - runtime.transform.y) / runtime.transform.scale));
    for (let y = startRow; y <= endRow; y += 1) {
      for (let x = 0; x < runtime.width; x += 1) {
        const pixel = y * runtime.width + x;
        const terrainKey = terrainKeyForPixel(pixel);
        const stateKey = runtime.stateKeysByIndex[runtime.pixelStateIndexes[pixel] || 0];
        if (!terrain.has(terrainKey) || !stateKey) continue;
        const clientX = rect.left + runtime.transform.x + (x + 0.5) * runtime.transform.scale;
        const clientY = rect.top + runtime.transform.y + (y + 0.5) * runtime.transform.scale;
        const resolved = window.eval("stateRegionFromPointerEvent")({ clientX, clientY });
        if (resolved?.key === stateKey) return { clientX, clientY, stateKey };
      }
    }
    return null;
  });
  assert(detailPoint, "terrain detail route needs an on-canvas land coordinate");
  const routeProbe = await page.evaluate(({ clientX, clientY }) => {
    const stateRegion = window.eval("stateRegionFromPointerEvent")({ clientX, clientY });
    return stateRegion?.key || "";
  }, detailPoint);
  assert.equal(routeProbe, detailPoint.stateKey, "double-click coordinate must resolve to the sampled state region");
  await page.evaluate(({ clientX, clientY }) => {
    const stateRegion = window.eval("stateRegionFromPointerEvent")({ clientX, clientY });
    if (stateRegion) window.eval("openStateRegionDetail")(stateRegion.key);
  }, detailPoint);
  await page.waitForFunction(() => location.hash.startsWith("#/state-region/"), { timeout: 10000 });
  const detailRoute = await page.evaluate(() => location.hash);
  assert.equal(detailRoute, `#/state-region/${encodeURIComponent(detailPoint.stateKey)}`, "land double click must open the parent state region detail");

  await page.evaluate(() => {
    const changeBoard = window.eval("changeBoard");
    const render = window.eval("render");
    const state = window.eval("state");
    changeBoard("region", "stateRegion");
    state.regionMapView = "terrain";
    state.selectedStateRegion = "";
    state.resourceFilters.clear();
    render();
  });
  await page.waitForFunction(() => window.eval("state.mapMode") === "terrain", { timeout: 10000 });
  await page.locator("[data-resource-filter='building_wheat_farm']").click();
  await page.waitForFunction(() => window.eval("state.mapMode") === "terrain" && window.eval("state.resourceFilters.size") === 1, { timeout: 10000 });
  const filtered = await page.evaluate(() => ({
    mode: window.eval("state.mapMode"),
    resources: [...window.eval("state.resourceFilters")],
    listCount: document.querySelectorAll("#countryList [data-state-region]").length,
  }));
  assert.equal(filtered.mode, "terrain", "resource filters must not leave terrain mode");
  assert.deepEqual(filtered.resources, ["building_wheat_farm"], "resource selection must remain active in terrain mode");
  assert(filtered.listCount > 0, "region list must remain rendered while terrain mode is active");

  const narrowPage = await context.newPage();
  await narrowPage.setViewportSize({ width: 390, height: 844 });
  await narrowPage.goto(`${baseUrl}#/region`, { waitUntil: "networkidle", timeout: 45000 });
  await narrowPage.locator("#terrainMapViewButton").click();
  await narrowPage.waitForFunction(() => {
    const element = document.querySelector("#terrainMapLegend");
    return element && !element.hidden && element.clientWidth > 0;
  }, { timeout: 10000 });
  const narrow = await narrowPage.locator("#terrainMapLegend").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
    viewportWidth: window.innerWidth,
  }));
  assert(narrow.clientWidth > 0, "narrow terrain legend must remain visible");
  assert.equal(narrow.scrollWidth, narrow.clientWidth, "narrow terrain legend must not scroll horizontally");
  assert(narrow.left >= 0 && narrow.right <= narrow.viewportWidth, "narrow terrain legend must remain within the viewport");
  assert.deepEqual(errors, [], `page errors: ${errors.join(" | ")}`);
  await narrowPage.close();
  console.log(JSON.stringify({ province_terrain_map_browser: "ok", initial, sampled, tooltip, waterPoint, selection, detailRoute, filtered, narrow, baseUrl }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
