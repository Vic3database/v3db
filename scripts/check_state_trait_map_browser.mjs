import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const previewRoot = process.argv[2] ? path.resolve(process.argv[2]) : "";
const server = previewRoot ? await startPreviewServer(previewRoot) : null;
const baseUrl = server ? server.url : (process.argv[3] || "http://127.0.0.1:8877");
const chromePath = process.env.VC_CHROME_PATH || "";
const browser = await chromium.launch({
  headless: true,
  ...(chromePath ? { executablePath: chromePath } : {}),
});
const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });

try {
  const main = await context.newPage();
  const mainErrors = [];
  main.on("console", (message) => {
    if (message.type() === "error") mainErrors.push(message.text());
  });
  main.on("pageerror", (error) => mainErrors.push(error.message));
  const initial = await openTraitView(main, `${baseUrl}/main/index.html`);
  assert.deepEqual(initial.selectedFilters, ["all"], "all should be the only selected state-trait filter");
  assert.equal(initial.mode, "traitIcons", "state-trait filters should select trait icon mode");
  assert.equal(initial.featureCount, 781, "main map must retain every state region feature");
  assert.equal(initial.iconImageCount, 23, "main map must preload every used trait icon image");
  const expectedAllCount = await main.evaluate(() => window.eval("landStateRegions").filter((region) => (region.traits || []).length > 0).length);
  assert.equal(initial.listCount, expectedAllCount, "all should list every trait-bearing land region");
  assert.equal(initial.visibleStateCount, initial.listCount, "all should gray every region without traits or excluded by other filters");
  const mainLayout = await traitIconLayout(main);
  assert.equal(mainLayout.iconCount, mainLayout.traitCount, "overlapping category membership must not duplicate icons");
  assert.equal(new Set(mainLayout.screenY).size, 1, "every trait icon in a region must stay on one row");
  assert(mainLayout.screenWidths.every((width) => Math.abs(width - 32) < 0.01), "map trait icons must render at 32 screen pixels");
  assert(mainLayout.screenGaps.every((gap) => Math.abs(gap - 32) < 0.01), "map trait icons must use one 32 pixel horizontal sequence");

  await main.locator("[data-state-trait-filter='waterways']").click();
  await main.locator("[data-state-trait-filter='resources']").click();
  const unionState = await main.evaluate(() => ({
    selected: [...window.eval("state.stateTraitFilters")].sort(),
    listed: document.querySelectorAll("#countryList [data-state-region]").length,
    expected: window.eval("landStateRegions").filter(window.eval("matchesStateTraitFilters")).length,
  }));
  assert.deepEqual(unionState.selected, ["resources", "waterways"], "specific filters should replace all and combine by OR");
  assert.equal(unionState.listed, unionState.expected, "list results should use the same trait predicate");
  const mixedAlphas = await traitIconAlphas(main, "mixed");
  assert(mixedAlphas.includes(1), "matching icons should remain fully opaque");
  assert(mixedAlphas.includes(0.18), "nonmatching icons in a matching region should use 0.18 opacity");
  const mutedAlphas = await traitIconAlphas(main, "muted");
  assert(mutedAlphas.length > 0 && mutedAlphas.every((alpha) => alpha === 0.36), "filtered-out regions should retain the existing muted icon opacity");
  const mixedTarget = await mixedTraitTarget(main);
  assert(mixedTarget && mixedTarget.traitCount > mixedTarget.matchingTraitCount, "main fixture should contain matching and nonmatching traits");
  await main.locator("#mapCanvas").dispatchEvent("pointermove", mixedTarget.pointer);
  await main.waitForFunction(() => document.querySelector("#mapTooltip")?.hidden === false, { timeout: 10000 });
  assert.equal(await main.locator("#mapTooltip .map-tooltip-trait-icon").count(), mixedTarget.traitCount, "tooltip should retain the complete trait set");
  await main.locator("[data-state-trait-filter='all']").click();

  const target = await multiTraitTarget(main);
  assert(target, "main map needs an on-canvas region with multiple traits");
  await main.locator("#mapCanvas").dispatchEvent("pointermove", target.pointer);
  await main.waitForFunction(() => document.querySelector("#mapTooltip")?.hidden === false, { timeout: 10000 });
  const tooltip = await main.locator("#mapTooltip");
  assert.equal(await tooltip.locator(".map-tooltip-trait-icon").count(), target.traitCount, "tooltip must list every trait icon in the selected region");
  const tooltipIconBox = await tooltip.locator(".map-tooltip-trait-icon").first().boundingBox();
  assert.deepEqual({ width: tooltipIconBox?.width, height: tooltipIconBox?.height }, { width: 30, height: 30 }, "tooltip trait icons must render at 30 pixels");
  const tooltipText = await tooltip.innerText();
  assert.match(tooltipText, new RegExp(escapeRegExp(target.label)), "tooltip must show a trait name");
  assert.match(tooltipText, new RegExp(escapeRegExp(target.effect)), "tooltip must show a trait effect");

  await main.locator("[data-state-trait-filter='all']").click();
  await main.waitForFunction(() => window.eval("state.mapMode") !== "traitIcons", { timeout: 10000 });
  await main.locator("#mapCanvas").dispatchEvent("pointermove", target.pointer);
  await main.waitForFunction(() => document.querySelector("#mapTooltip")?.hidden === false, { timeout: 10000 });
  assert.equal(await main.locator("#mapTooltip .map-tooltip-trait").count(), target.traitCount, "ordinary region tooltip must list every trait");
  assert.match(await main.locator("#mapTooltip").innerText(), new RegExp(escapeRegExp(target.effect)), "ordinary region tooltip must retain complete trait effects");
  await main.locator("[data-state-trait-filter='all']").click();
  await main.waitForFunction(() => window.eval("state.mapMode") === "traitIcons", { timeout: 10000 });

  await main.locator("#mapCanvas").dispatchEvent("pointerdown", target.pointer);
  await main.locator("#mapCanvas").dispatchEvent("pointerup", target.pointer);
  await main.waitForFunction((stateKey) => window.eval("state.selectedStateRegion") === stateKey, target.stateKey, { timeout: 10000 });
  assert.equal(await main.evaluate(() => location.hash), "#/region", "trait-map click must keep the region route");

  const routeProbe = await main.evaluate(({ clientX, clientY }) => window.eval("stateRegionFromPointerEvent")({ clientX, clientY })?.key || "", target.pointer);
  assert.equal(routeProbe, target.stateKey, "trait-map detail coordinate must resolve to the sampled region");
  await main.evaluate(({ clientX, clientY }) => {
    const stateRegion = window.eval("stateRegionFromPointerEvent")({ clientX, clientY });
    if (stateRegion) window.eval("openStateRegionDetail")(stateRegion.key);
  }, target.pointer);
  await main.waitForFunction(() => location.hash.startsWith("#/state-region/"), { timeout: 10000 });
  assert.equal(await main.evaluate(() => location.hash), `#/state-region/${encodeURIComponent(target.stateKey)}`, "trait-map double click must open the state region detail");

  await main.evaluate(() => {
    const changeBoard = window.eval("changeBoard");
    const render = window.eval("render");
    const state = window.eval("state");
    changeBoard("region", "stateRegion");
    state.regionMapView = "default";
    state.stateTraitFilters.clear();
    state.stateTraitFilters.add("all");
    state.selectedStateRegion = "";
    state.resourceFilters.clear();
    render();
  });
  await main.waitForFunction(() => window.eval("state.mapMode") === "traitIcons", { timeout: 10000 });
  await main.locator("[data-resource-filter='building_wheat_farm']").click();
  const filtered = await main.evaluate(() => ({
    mode: window.eval("state.mapMode"),
    visible: window.eval("mapRuntime.visibleStateKeys.size"),
    total: window.eval("mapRuntime.featureByStateKey.size"),
  }));
  assert.equal(filtered.mode, "traitIcons", "resource filters must retain trait icon mode");
  assert(filtered.visible > 0 && filtered.visible < filtered.total, "resource filter must gray out part of the trait map");
  assert.deepEqual(mainErrors, [], `main page errors: ${mainErrors.join(" | ")}`);

  const interaction = await context.newPage();
  await interaction.goto(`${baseUrl}/main/index.html#/region`, { waitUntil: "networkidle", timeout: 45000 });
  const interactionTraitSection = interaction.locator(".filter-section:has(#stateTraitFilters)");
  await interactionTraitSection.locator("summary").click();
  await interaction.locator("[data-state-trait-filter='all']").click();
  assert.deepEqual(await selectedTraitFilters(interaction), ["all"], "all should select only itself");
  await interaction.locator("[data-state-trait-filter='waterways']").click();
  assert.deepEqual(await selectedTraitFilters(interaction), ["waterways"], "a specific category should replace all");
  await interaction.locator("[data-state-trait-filter='all']").click();
  assert.deepEqual(await selectedTraitFilters(interaction), ["all"], "all should replace specific categories");
  assert.equal(await interaction.evaluate(() => window.eval("state.mapMode")), "traitIcons", "all should retain trait icon mode");

  await interaction.locator("[data-state-trait-filter='waterways']").click();
  await interaction.locator("[data-state-trait-filter='waterways']").click();
  const cleared = await interaction.evaluate(() => ({
    selected: [...window.eval("state.stateTraitFilters")],
    mode: window.eval("state.mapMode"),
  }));
  assert.deepEqual(cleared.selected, [], "clearing the last trait filter should empty the selection");
  assert.equal(cleared.mode, "strategicRegion", "clearing the last trait filter should restore the normal region map");

  await interaction.locator("[data-state-trait-filter='mapi']").click();
  await interaction.locator("#terrainMapViewButton").click();
  assert.deepEqual(await selectedTraitFilters(interaction), [], "terrain view should clear trait filters");
  assert.equal(await interaction.evaluate(() => window.eval("state.mapMode")), "terrain", "terrain control should select terrain mode");
  await interaction.locator("[data-state-trait-filter='mapi']").click();
  assert.equal(await interaction.locator("#terrainMapViewButton").getAttribute("aria-pressed"), "false", "trait filters should leave terrain mode");
  assert.equal(await interaction.evaluate(() => window.eval("state.mapMode")), "traitIcons", "MAPI should select trait icon mode");
  await interaction.locator("[data-nav-view='country']").click();
  assert.deepEqual(await selectedTraitFilters(interaction), ["mapi"], "leaving the region board should preserve trait filters");
  await interaction.locator("[data-nav-view='region']").click();
  assert.deepEqual(await selectedTraitFilters(interaction), ["mapi"], "returning to the region board should preserve trait filters");
  assert.equal(await interaction.evaluate(() => window.eval("state.mapMode")), "traitIcons", "returning to the region board should restore trait icon mode");
  await interaction.locator("#resetButton").click();
  assert.deepEqual(await selectedTraitFilters(interaction), [], "global reset should clear trait filters");
  assert.equal(await interaction.evaluate(() => window.eval("state.mapMode")), "strategicRegion", "global reset should restore the normal region map");
  await interaction.close();

  const victorianCentury = await context.newPage();
  const vcErrors = [];
  victorianCentury.on("response", (response) => {
    if (response.status() >= 400) vcErrors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  victorianCentury.on("pageerror", (error) => vcErrors.push(error.message));
  const vcInitial = await openTraitView(victorianCentury, `${baseUrl}/vc/index.html`);
  assert.equal(vcInitial.mode, "traitIcons", "Victorian Century must select trait icon mode");
  assert.equal(vcInitial.featureCount, 781, "Victorian Century map must retain every state region feature");
  assert.equal(vcInitial.iconImageCount, 23, "Victorian Century must preload every used trait icon image");
  const vcTarget = await multiTraitTarget(victorianCentury);
  const vcTargetDiagnostics = vcTarget ? null : await traitTargetDiagnostics(victorianCentury);
  assert(vcTarget, `Victorian Century map needs an on-canvas region with multiple traits: ${JSON.stringify(vcTargetDiagnostics)}`);
  await victorianCentury.locator("#mapCanvas").dispatchEvent("pointermove", vcTarget.pointer);
  await victorianCentury.waitForFunction(() => document.querySelector("#mapTooltip")?.hidden === false, { timeout: 10000 });
  assert.equal(await victorianCentury.locator("#mapTooltip .map-tooltip-trait-icon").count(), vcTarget.traitCount, "Victorian Century tooltip must list every trait icon");
  const vcTooltipText = await victorianCentury.locator("#mapTooltip").innerText();
  assert.match(vcTooltipText, new RegExp(escapeRegExp(vcTarget.label)), "Victorian Century tooltip must localize a trait name");
  assert.match(vcTooltipText, new RegExp(escapeRegExp(vcTarget.effect)), "Victorian Century tooltip must localize a trait effect");
  await victorianCentury.locator("[data-state-trait-filter='mapi']").click();
  assert.deepEqual(await selectedTraitFilters(victorianCentury), ["mapi"], "Victorian Century MAPI should replace all");
  await victorianCentury.locator("[data-state-trait-filter='land']").click();
  await victorianCentury.locator("[data-state-trait-filter='mapi']").click();
  await victorianCentury.locator("[data-state-trait-filter='resources']").click();
  assert.deepEqual(await selectedTraitFilters(victorianCentury), ["land", "resources"], "Victorian Century categories should combine by OR");
  assert.equal(await victorianCentury.evaluate(() => window.eval("mapRuntime.featureByStateKey.size")), 781, "Victorian Century filtering should retain all map features");
  assert.equal(await victorianCentury.evaluate(() => window.eval("mapRuntime.stateTraitIconImages.size")), 23, "Victorian Century filtering should retain preloaded icons");
  const vcMixedTarget = await mixedTraitTarget(victorianCentury);
  assert(vcMixedTarget, "Victorian Century should expose an on-canvas mixed trait region");
  await victorianCentury.locator("#mapCanvas").dispatchEvent("pointermove", vcMixedTarget.pointer);
  await victorianCentury.waitForFunction(() => document.querySelector("#mapTooltip")?.hidden === false, { timeout: 10000 });
  const vcTooltipIconBox = await victorianCentury.locator("#mapTooltip .map-tooltip-trait-icon").first().boundingBox();
  assert.deepEqual({ width: vcTooltipIconBox?.width, height: vcTooltipIconBox?.height }, { width: 30, height: 30 }, "Victorian Century tooltip icons must render at 30 pixels");
  assert.deepEqual(vcErrors, [], `Victorian Century page errors: ${vcErrors.join(" | ")}`);

  const vcOrdinary = await context.newPage();
  await vcOrdinary.goto(`${baseUrl}/vc/index.html#/region`, { waitUntil: "networkidle", timeout: 45000 });
  await vcOrdinary.waitForFunction(() => window.eval("mapRuntime.ready") && window.eval("mapRuntime.stateTraitLocaleMessages.size") > 0, { timeout: 30000 });
  const vcOrdinaryTarget = await onCanvasMultiTraitTarget(vcOrdinary);
  assert(vcOrdinaryTarget, "Victorian Century ordinary region map needs an on-canvas multi-trait region");
  await vcOrdinary.locator("#mapCanvas").dispatchEvent("pointermove", vcOrdinaryTarget.pointer);
  await vcOrdinary.waitForFunction(() => document.querySelector("#mapTooltip")?.hidden === false, { timeout: 10000 });
  assert.equal(await vcOrdinary.locator("#mapTooltip .map-tooltip-trait").count(), vcOrdinaryTarget.traitCount, "Victorian Century ordinary region tooltip must list every trait");
  const vcOrdinaryText = await vcOrdinary.locator("#mapTooltip").innerText();
  assert.match(vcOrdinaryText, new RegExp(escapeRegExp(vcOrdinaryTarget.label)), "Victorian Century ordinary region tooltip must localize trait names before filtering");
  assert.match(vcOrdinaryText, new RegExp(escapeRegExp(vcOrdinaryTarget.effect)), "Victorian Century ordinary region tooltip must localize complete effects before filtering");
  await vcOrdinary.close();

  const combined = await context.newPage();
  await combined.goto(`${baseUrl}/main/index.html#/region`, { waitUntil: "networkidle", timeout: 45000 });
  const combinedTraitSection = combined.locator(".filter-section:has(#stateTraitFilters)");
  if ((await combinedTraitSection.getAttribute("open")) === null) await combinedTraitSection.locator("summary").click();
  await combined.locator("[data-state-trait-filter='all']").click();
  await combined.locator("[data-resource-filter='building_wheat_farm']").click();
  const combinedState = await combined.evaluate(() => ({
    mode: window.eval("state.mapMode"),
    listed: document.querySelectorAll("#countryList [data-state-region]").length,
    expected: window.eval("landStateRegions").filter(window.eval("matchesStateRegionFilters")).length,
    visible: window.eval("mapRuntime.visibleStateKeys.size"),
  }));
  assert.equal(combinedState.mode, "traitIcons", "resource filters should retain trait icon mode");
  assert.equal(combinedState.listed, combinedState.expected, "resource and trait filters should intersect in the list");
  assert(combinedState.visible > 0 && combinedState.visible < 781, "resource and trait filters should gray part of the map");
  await combined.locator("#searchInput").fill("__no_state_trait_result__");
  await combined.waitForFunction(() => document.querySelectorAll("#countryList [data-state-region]").length === 0);
  assert.match(await combined.locator("#countryList").innerText(), /没有匹配结果/, "empty trait results should retain the empty-state message");
  assert.equal(await combined.evaluate(() => window.eval("mapRuntime.visibleStateKeys.size")), 0, "empty results should mute every region");
  await combined.close();

  const narrow = await context.newPage();
  await narrow.setViewportSize({ width: 390, height: 844 });
  await openTraitView(narrow, `${baseUrl}/main/index.html`);
  const narrowMetrics = await narrow.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    mode: window.eval("state.mapMode"),
    selected: [...window.eval("state.stateTraitFilters")],
  }));
  assert.equal(narrowMetrics.scrollWidth, narrowMetrics.viewportWidth, "narrow trait map must not overflow horizontally");
  assert.equal(narrowMetrics.mode, "traitIcons", "narrow trait map must retain trait icon mode");
  assert.deepEqual(narrowMetrics.selected, ["all"], "narrow trait map must retain the all filter");
  const narrowLayout = await traitIconLayout(narrow);
  assert(narrowLayout.screenWidths.every((width) => Math.abs(width - 32) < 0.01), "narrow map trait icons must render at 32 screen pixels");
  await narrow.close();

  console.log(JSON.stringify({ state_trait_map_browser: "ok", initial, mainLayout, unionState, mixedTarget, target, filtered, cleared, vcInitial, vcTarget, vcMixedTarget, combinedState, narrow: narrowMetrics, baseUrl }, null, 2));
} finally {
  await context.close();
  await browser.close();
  await server?.close();
}

async function openTraitView(page, url) {
  await page.goto(`${url}#/region`, { waitUntil: "networkidle", timeout: 45000 });
  const traitFilterSection = page.locator(".filter-section:has(#stateTraitFilters)");
  if ((await traitFilterSection.getAttribute("open")) === null) {
    await traitFilterSection.locator("summary").click();
  }
  await page.locator("[data-state-trait-filter='all']").click();
  await page.waitForFunction(() => window.eval("state.mapMode") === "traitIcons" && window.eval("mapRuntime.ready"), { timeout: 30000 });
  await page.waitForFunction(() => window.eval("mapRuntime.stateTraitIconImages.size") === 23, { timeout: 30000 });
  return page.evaluate(() => ({
    selectedFilters: [...window.eval("state.stateTraitFilters")],
    mode: window.eval("state.mapMode"),
    featureCount: window.eval("mapRuntime.featureByStateKey.size"),
    iconImageCount: window.eval("mapRuntime.stateTraitIconImages.size"),
    listCount: document.querySelectorAll("#countryList [data-state-region]").length,
    visibleStateCount: window.eval("mapRuntime.visibleStateKeys.size"),
  }));
}

async function multiTraitTarget(page) {
  await page.waitForFunction(() => {
    const runtime = window.eval("mapRuntime");
    const stateTraitEffectText = window.eval("stateTraitEffectText");
    return [...runtime.featureByStateKey.values()].some((feature) => (feature.traits || []).some((trait) => stateTraitEffectText(trait)));
  }, { timeout: 30000 });
  return page.evaluate(() => {
    const runtime = window.eval("mapRuntime");
    const stateRegionFromPointerEvent = window.eval("stateRegionFromPointerEvent");
    const stateTraitLocalizedText = window.eval("stateTraitLocalizedText");
    const stateTraitEffectText = window.eval("stateTraitEffectText");
    const rect = document.querySelector("#mapCanvas").getBoundingClientRect();
    const eligible = new Map([...runtime.featureByStateKey]
      .filter(([, feature]) => (feature.traits || []).length > 1 && feature.traits.some((trait) => stateTraitEffectText(trait))));
    for (let y = 0; y < runtime.height; y += 8) {
      const rowStart = y * runtime.width;
      for (let x = 0; x < runtime.width; x += 8) {
        const stateKey = runtime.stateKeysByIndex[runtime.pixelStateIndexes[rowStart + x] || 0];
        const feature = eligible.get(stateKey);
        if (!feature) continue;
        const clientX = rect.left + runtime.transform.x + (x + 0.5) * runtime.transform.scale;
        const clientY = rect.top + runtime.transform.y + (y + 0.5) * runtime.transform.scale;
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) continue;
        if (stateRegionFromPointerEvent({ clientX, clientY })?.key !== stateKey) continue;
        const trait = feature.traits.find((item) => stateTraitEffectText(item));
        return {
          stateKey,
          traitCount: feature.traits.length,
          label: stateTraitLocalizedText(trait, "name") || trait.key,
          effect: stateTraitEffectText(trait),
          pointer: { clientX, clientY, pointerId: 1, pointerType: "mouse" },
        };
      }
    }
    return null;
  });
}

async function onCanvasMultiTraitTarget(page) {
  return page.evaluate(() => {
    const runtime = window.eval("mapRuntime");
    const stateRegionFromPointerEvent = window.eval("stateRegionFromPointerEvent");
    const stateTraitLocalizedText = window.eval("stateTraitLocalizedText");
    const stateTraitEffectText = window.eval("stateTraitEffectText");
    const landStateRegions = window.eval("landStateRegions");
    const rect = document.querySelector("#mapCanvas").getBoundingClientRect();
    const eligible = new Map(landStateRegions
      .filter((stateRegion) => (stateRegion.traits || []).length > 1)
      .map((stateRegion) => [stateRegion.key, stateRegion]));
    for (let y = 0; y < runtime.height; y += 8) {
      const rowStart = y * runtime.width;
      for (let x = 0; x < runtime.width; x += 8) {
        const stateKey = runtime.stateKeysByIndex[runtime.pixelStateIndexes[rowStart + x] || 0];
        const stateRegion = eligible.get(stateKey);
        if (!stateRegion) continue;
        const clientX = rect.left + runtime.transform.x + (x + 0.5) * runtime.transform.scale;
        const clientY = rect.top + runtime.transform.y + (y + 0.5) * runtime.transform.scale;
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) continue;
        if (stateRegionFromPointerEvent({ clientX, clientY })?.key !== stateKey) continue;
        const trait = stateRegion.traits.find((item) => stateTraitEffectText(item));
        if (!trait) continue;
        return {
          stateKey,
          traitCount: stateRegion.traits.length,
          label: stateTraitLocalizedText(trait, "name"),
          effect: stateTraitEffectText(trait),
          pointer: { clientX, clientY, pointerId: 1, pointerType: "mouse" },
        };
      }
    }
    return null;
  });
}

async function traitIconLayout(page) {
  return page.evaluate(() => {
    const runtime = window.eval("mapRuntime");
    const drawStateTraitMapIcons = window.eval("drawStateTraitMapIcons");
    const entry = [...runtime.featureByStateKey].find(([, feature]) => (feature.traits || []).length >= 3);
    if (!entry) throw new Error("No region with at least three traits");
    const originalFeatures = runtime.featureByStateKey;
    const calls = [];
    let alpha = 1;
    runtime.featureByStateKey = new Map([entry]);
    try {
      drawStateTraitMapIcons({
        save() {},
        restore() {},
        drawImage(image, x, y, width, height) { calls.push({ x, y, width, height, alpha }); },
        set globalAlpha(value) { alpha = value; },
        get globalAlpha() { return alpha; },
      }, { start: 0, end: 0 }, runtime.transform);
    } finally {
      runtime.featureByStateKey = originalFeatures;
    }
    const scale = runtime.transform.scale;
    const ordered = calls.sort((a, b) => a.x - b.x);
    return {
      stateKey: entry[0],
      iconCount: ordered.length,
      traitCount: entry[1].traits.length,
      screenY: ordered.map((call) => call.y * scale),
      screenWidths: ordered.map((call) => call.width * scale),
      screenGaps: ordered.slice(1).map((call, index) => (call.x - ordered[index].x) * scale),
    };
  });
}

async function traitIconAlphas(page, featureKind) {
  return page.evaluate((kind) => {
    const runtime = window.eval("mapRuntime");
    const drawStateTraitMapIcons = window.eval("drawStateTraitMapIcons");
    const entry = [...runtime.featureByStateKey].find(([stateKey, feature]) => {
      if (!(feature.traits || []).length) return false;
      if (kind === "mixed") return runtime.visibleStateKeys.has(stateKey)
        && feature.matchingTraits.length > 0
        && feature.matchingTraits.length < feature.traits.length;
      return !runtime.visibleStateKeys.has(stateKey);
    });
    if (!entry) return [];
    const originalFeatures = runtime.featureByStateKey;
    const calls = [];
    let alpha = 1;
    runtime.featureByStateKey = new Map([entry]);
    try {
      drawStateTraitMapIcons({
        save() {},
        restore() {},
        drawImage(image, x, y, width, height) { calls.push({ alpha, width, height }); },
        set globalAlpha(value) { alpha = value; },
        get globalAlpha() { return alpha; },
      }, { start: 0, end: 0 }, runtime.transform);
    } finally {
      runtime.featureByStateKey = originalFeatures;
    }
    return calls.map((call) => call.alpha);
  }, featureKind);
}

async function mixedTraitTarget(page) {
  return page.evaluate(() => {
    const runtime = window.eval("mapRuntime");
    const stateRegionFromPointerEvent = window.eval("stateRegionFromPointerEvent");
    const rect = document.querySelector("#mapCanvas").getBoundingClientRect();
    const eligible = new Map([...runtime.featureByStateKey].filter(([, feature]) => (
      feature.matchingTraits.length > 0 && feature.matchingTraits.length < feature.traits.length
    )));
    for (let y = 0; y < runtime.height; y += 8) {
      for (let x = 0; x < runtime.width; x += 8) {
        const stateKey = runtime.stateKeysByIndex[runtime.pixelStateIndexes[y * runtime.width + x] || 0];
        const feature = eligible.get(stateKey);
        if (!feature) continue;
        const clientX = rect.left + runtime.transform.x + (x + 0.5) * runtime.transform.scale;
        const clientY = rect.top + runtime.transform.y + (y + 0.5) * runtime.transform.scale;
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) continue;
        if (stateRegionFromPointerEvent({ clientX, clientY })?.key !== stateKey) continue;
        return {
          stateKey,
          traitCount: feature.traits.length,
          matchingTraitCount: feature.matchingTraits.length,
          pointer: { clientX, clientY, pointerId: 1, pointerType: "mouse" },
        };
      }
    }
    return null;
  });
}

function selectedTraitFilters(page) {
  return page.evaluate(() => [...window.eval("state.stateTraitFilters")].sort());
}

async function traitTargetDiagnostics(page) {
  return page.evaluate(() => {
    const runtime = window.eval("mapRuntime");
    const stateTraitEffectText = window.eval("stateTraitEffectText");
    const rect = document.querySelector("#mapCanvas").getBoundingClientRect();
    const eligible = new Set([...runtime.featureByStateKey]
      .filter(([, feature]) => (feature.traits || []).length > 1 && feature.traits.some((trait) => stateTraitEffectText(trait)))
      .map(([stateKey]) => stateKey));
    const onCanvas = new Set();
    for (let y = 0; y < runtime.height; y += 8) {
      for (let x = 0; x < runtime.width; x += 8) {
        const clientX = rect.left + runtime.transform.x + (x + 0.5) * runtime.transform.scale;
        const clientY = rect.top + runtime.transform.y + (y + 0.5) * runtime.transform.scale;
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) continue;
        const stateKey = runtime.stateKeysByIndex[runtime.pixelStateIndexes[y * runtime.width + x] || 0];
        if (eligible.has(stateKey)) onCanvas.add(stateKey);
      }
    }
    return { eligible: eligible.size, onCanvas: [...onCanvas], rect: { width: rect.width, height: rect.height }, transform: runtime.transform, dimensions: { width: runtime.width, height: runtime.height } };
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
