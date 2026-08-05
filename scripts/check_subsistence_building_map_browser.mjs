import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const server = await startPreviewServer(path.join(process.cwd(), "site"));
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
  await page.goto(`${server.url}/index.html#/region`, { waitUntil: "networkidle", timeout: 45000 });
  await page.locator("[data-resource-filter='subsistence_buildings']").click();
  await page.waitForFunction(() => window.eval("state.mapMode") === "subsistenceBuildings", { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector("#subsistenceBuildingMapLegend")?.hidden === false, { timeout: 10000 });

  const overview = await page.evaluate(() => {
    const expectedColors = {
      building_subsistence_farm: "#c8893f",
      building_subsistence_rice_farm: "#4c9f70",
      building_subsistence_pasture: "#8b6f47",
      building_subsistence_orchard: "#b5688b",
      building_subsistence_fishing_village: "#4b87b6",
    };
    const runtime = window.eval("mapRuntime");
    const landStateRegions = window.eval("landStateRegions");
    const features = [...runtime.featureByStateKey.values()];
    const colorsByBuilding = Object.fromEntries(Object.keys(expectedColors).map((buildingKey) => [
      buildingKey,
      [...runtime.featureByStateKey.values()].find((feature) => feature.subsistenceBuildingKey === buildingKey)?.color || "",
    ]));
    const incorrectLabels = landStateRegions.filter((stateRegion) => {
      const feature = runtime.featureByStateKey.get(stateRegion.key);
      return String(feature?.label || "") !== String(stateRegion.arable_land);
    }).map((stateRegion) => stateRegion.key);
    return {
      pressed: document.querySelector("[data-resource-filter='subsistence_buildings']")?.getAttribute("aria-pressed"),
      mapMode: window.eval("state.mapMode"),
      legendCount: document.querySelectorAll(".subsistence-building-map-legend-item").length,
      colorsByBuilding,
      expectedColors,
      featureCount: features.length,
      landCount: landStateRegions.length,
      stateRegionCount: window.eval("stateRegions").length,
      incorrectLabels,
      listCount: document.querySelectorAll("#countryList [data-state-region]").length,
      expectedListCount: landStateRegions.filter(window.eval("matchesStateRegionFilters")).length,
      seaLabels: [...runtime.featureByStateKey].filter(([key, feature]) => window.eval("isSeaStateRegion")(window.eval("byStateRegion").get(key)) && feature.label).map(([key]) => key),
    };
  });
  assert.equal(overview.pressed, "true", "combined subsistence entry must become pressed");
  assert.equal(overview.mapMode, "subsistenceBuildings", "combined entry must select the dedicated map mode");
  assert.equal(overview.legendCount, 5, "legend must contain all five subsistence building categories");
  assert.deepEqual(overview.colorsByBuilding, overview.expectedColors, "every building category must use its fixed agreed color");
  assert.equal(overview.featureCount, overview.stateRegionCount, "map must retain every state-region feature");
  assert.deepEqual(overview.incorrectLabels, [], "every land region must label its arable-land limit, including zero");
  assert.equal(overview.listCount, overview.expectedListCount, "map-only entry must not shrink the region list");
  assert.deepEqual(overview.seaLabels, [], "sea regions must not display arable-land labels");

  const interactionTarget = await findOnCanvasState(page, "building_subsistence_rice_farm");
  assert(interactionTarget, "map needs an on-canvas subsistence rice-farm region for map interactions");
  const beforeZoom = await page.evaluate(() => ({ ...window.eval("mapRuntime.transform") }));
  await page.locator("#mapCanvas").dispatchEvent("wheel", {
    clientX: interactionTarget.pointer.clientX,
    clientY: interactionTarget.pointer.clientY,
    deltaY: -100,
  });
  await page.waitForFunction((scale) => window.eval("mapRuntime.transform.scale") > scale, beforeZoom.scale, { timeout: 10000 });
  const beforePan = await page.evaluate(() => ({ ...window.eval("mapRuntime.transform") }));
  const panEnd = {
    ...interactionTarget.pointer,
    clientX: interactionTarget.pointer.clientX + 18,
    clientY: interactionTarget.pointer.clientY + 16,
  };
  await page.locator("#mapCanvas").dispatchEvent("pointerdown", interactionTarget.pointer);
  await page.locator("#mapCanvas").dispatchEvent("pointermove", panEnd);
  await page.locator("#mapCanvas").dispatchEvent("pointerup", panEnd);
  await page.waitForFunction((y) => window.eval("mapRuntime.transform.y") !== y, beforePan.y, { timeout: 10000 });

  const target = await findOnCanvasState(page, "building_subsistence_rice_farm");
  assert(target, "map needs an on-canvas subsistence rice-farm region");
  await page.locator("#mapCanvas").dispatchEvent("pointermove", target.pointer);
  await page.waitForFunction(() => document.querySelector("#mapTooltip")?.hidden === false, { timeout: 10000 });
  const tooltipText = await page.locator("#mapTooltip").innerText();
  assert.match(tooltipText, /自给水稻农场/, "tooltip must localize the subsistence building name");
  assert.match(tooltipText, new RegExp(`耕地\\s*${target.arableLand}`), "tooltip must show the state-region arable-land limit");

  await page.locator("#mapCanvas").dispatchEvent("pointerdown", target.pointer);
  await page.locator("#mapCanvas").dispatchEvent("pointerup", target.pointer);
  await page.waitForFunction((key) => window.eval("state.selectedStateRegion") === key, target.stateKey, { timeout: 10000 });
  assert.equal(await page.evaluate(() => location.hash), "#/region", "single click must preserve the region route");
  await page.locator("#mapCanvas").dispatchEvent("dblclick", target.pointer);
  await page.waitForFunction(() => location.hash.startsWith("#/state-region/"), { timeout: 10000 });
  assert.equal(await page.evaluate(() => location.hash), `#/state-region/${encodeURIComponent(target.stateKey)}`, "double click must open the sampled state-region detail");
  assert.deepEqual(errors, [], `page errors: ${errors.join(" | ")}`);
  await page.close();

  const compact = await context.newPage();
  await compact.setViewportSize({ width: 390, height: 844 });
  await compact.goto(`${server.url}/index.html#/region`, { waitUntil: "networkidle", timeout: 45000 });
  await compact.locator("[data-resource-filter='subsistence_buildings']").click();
  await compact.waitForFunction(() => document.querySelector("#subsistenceBuildingMapLegend")?.hidden === false, { timeout: 10000 });
  const compactLayout = await compact.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    legendWidth: document.querySelector("#subsistenceBuildingMapLegend")?.getBoundingClientRect().width || 0,
    panelWidth: document.querySelector("#mapPanel")?.getBoundingClientRect().width || 0,
  }));
  assert.equal(compactLayout.scrollWidth, compactLayout.viewportWidth, "narrow-screen legend must not create horizontal overflow");
  assert(compactLayout.legendWidth <= compactLayout.panelWidth, "narrow-screen legend must remain inside the map panel");
  await compact.locator("[data-resource-filter='subsistence_buildings']").click();
  await compact.waitForFunction(() => window.eval("state.mapMode") !== "subsistenceBuildings" && document.querySelector("#subsistenceBuildingMapLegend")?.hidden === true, { timeout: 10000 });
  assert.equal(await compact.locator("[data-resource-filter='subsistence_buildings']").getAttribute("aria-pressed"), "false", "second click must clear the combined map entry");
  await compact.close();

  console.log(JSON.stringify({ subsistence_building_map_browser: "ok", target, overview, compactLayout, baseUrl: server.url }, null, 2));
} finally {
  await context.close();
  await browser.close();
  await server.close();
}

async function findOnCanvasState(page, buildingKey) {
  return page.evaluate((targetBuildingKey) => {
    const runtime = window.eval("mapRuntime");
    const stateRegionFromPointerEvent = window.eval("stateRegionFromPointerEvent");
    const rect = document.querySelector("#mapCanvas").getBoundingClientRect();
    for (let clientY = rect.top + 8; clientY < rect.bottom - 8; clientY += 4) {
      for (let clientX = rect.left + 8; clientX < rect.right - 8; clientX += 4) {
        const stateRegion = stateRegionFromPointerEvent({ clientX, clientY });
        if (!stateRegion || stateRegion.subsistence_building !== targetBuildingKey) continue;
        const feature = runtime.featureByStateKey.get(stateRegion.key);
        if (!feature?.label) continue;
        return {
          stateKey: stateRegion.key,
          arableLand: String(stateRegion.arable_land),
          pointer: { clientX, clientY, pointerId: 1, pointerType: "mouse" },
        };
      }
    }
    return null;
  }, buildingKey);
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
