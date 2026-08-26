import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const vanillaUrl = process.argv[2] || "http://127.0.0.1:8878/index.html";
const vcUrl = process.argv[3] || "http://127.0.0.1:8881/index.html";
const siteVcUrl = process.argv[4] || "http://127.0.0.1:8882/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9275;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });

try {
  await verifySite("vanilla", vanillaUrl, true);
  await verifySite("victorian-century", vcUrl, false);
  await verifySite("site-vc", siteVcUrl, false);
  console.log(JSON.stringify({ culture_incorporation_calculator_browser: "ok", vanilla: vanillaUrl, victorian_century: vcUrl, site_vc: siteVcUrl }, null, 2));
} finally {
  chrome.kill();
}

async function verifySite(name, baseUrl, fullCoverage) {
  const page = await openPage({ width: 1440, height: 1000 });
  try {
    await page.goto(`${baseUrl}?lang=zh-Hans#/culture/incorporation`);
    await page.waitFor(() => Boolean(document.querySelector("[data-culture-incorporation-calculator]")), `${name} calculator`);
    assert.equal(await page.evaluate(() => document.querySelector("#cultureIncorporationPanel")?.hidden), false);
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.querySelector("#mapPanel")).display), "none", `${name} map should remain visible`);
    const mapDiagnostic = await page.evaluate(() => { const panel = document.querySelector("#mapPanel").getBoundingClientRect(); const viewport = document.querySelector("#mapViewport").getBoundingClientRect(); const canvas = document.querySelector("#mapCanvas"); const ctx = canvas?.getContext("2d"); const sample = ctx?.getImageData(0, 0, 1, 1).data; return { panel: [panel.width, panel.height], viewport: [viewport.width, viewport.height], canvas: [canvas?.width, canvas?.height], ready: mapRuntime.ready, loading: mapRuntime.loading, error: mapRuntime.error, mapData: Boolean(mapData), runs: mapData?.runs?.length || 0, states: stateRegions.length, mode: state.mapMode, sample: sample ? [...sample] : [] }; });
    assert.ok(mapDiagnostic.viewport[0] > 0 && mapDiagnostic.viewport[1] > 0, `${name} map viewport should have size`);
    await page.waitFor(() => Boolean(mapRuntime.ready), `${name} map ready`);
    await page.waitFor(() => { try { ensureMapLayer(); return Boolean(mapRuntime.layerCanvas); } catch (error) { window.__mapLayerError = String(error?.stack || error); return false; } }, `${name} map layer`);
    const readyMap = await page.evaluate(() => { const canvas = document.querySelector("#mapCanvas"); const pixels = canvas?.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data || []; let nonTransparent = 0; for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) nonTransparent += 1; return { ready: mapRuntime.ready, layer: Boolean(mapRuntime.layerCanvas), nonTransparent }; });
    assert.ok(readyMap.layer && readyMap.nonTransparent > 0, `${name} map should paint pixels`);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".results")).display), "none");
    assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-incorporation-search]"))), false);
    assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-incorporation-filter-heritage-group]"))), true);
    assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-incorporation-homeland-effect='event:manifest_destiny.1']"))), true);
    assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-incorporation-dynamic-effect]"))), true);
    const initial = await page.evaluate(() => ({ selected: [...document.querySelectorAll("[data-incorporation-selected-culture]")].map((node) => node.dataset.incorporationSelectedCulture), candidates: [...document.querySelectorAll("[data-incorporation-candidate]")].map((node) => node.dataset.incorporationCandidate) }));
    assert.deepEqual(initial.selected, []);
    assert.deepEqual(initial.candidates, []);
    assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-incorporation-results]"))), false);
    await page.goto(`${baseUrl}?lang=zh-Hans#/country/AUS`);
    await page.waitFor(() => Boolean(document.querySelector("[data-incorporation-country='AUS']")), `${name} country calculator link`);
    await page.click("[data-incorporation-country='AUS']");
    await page.waitFor(() => Boolean(document.querySelector("[data-incorporation-selected-culture='south_german']")), `${name} AUS preload`);
    const aus = await page.evaluate(() => ({ applied: [...state.incorporationCalculatorAppliedCultures], route: location.hash }));
    assert.deepEqual(aus.applied, []);
    assert.equal(aus.route, "#/culture/incorporation");
    const candidateKeys = await page.evaluate(() => [...document.querySelectorAll("[data-incorporation-candidate]")].map((node) => node.dataset.incorporationCandidate));
    for (const key of ["hungarian", "czech", "slovak"]) assert.ok(candidateKeys.includes(key), `${name} AUS candidates must include ${key}`);
    await page.click("[data-incorporation-filter-heritage-group='heritage_group_european']");
    await page.waitFor(() => document.querySelectorAll("[data-incorporation-filter-culture]").length > 0, `${name} filtered culture results`);
    const filteredKey = await page.evaluate(() => document.querySelector("[data-incorporation-filter-culture]")?.dataset.incorporationFilterCulture);
    await page.click("[data-incorporation-filter-culture]");
    assert.equal(await page.evaluate((key) => state.incorporationCalculatorCultures.has(key), filteredKey), true);
    const beforeStart = await page.evaluate(() => ({ applied: [...(state.incorporationCalculatorAppliedCultures || [])], mode: state.mapMode, layerSignature: mapRuntime.layerSignature }));
    await page.click("[data-incorporation-candidate='hungarian']");
    assert.deepEqual(await page.evaluate(() => [...(state.incorporationCalculatorAppliedCultures || [])]), beforeStart.applied);
    assert.equal(await page.evaluate(() => state.mapMode), beforeStart.mode);
    await page.click("[data-incorporation-candidate='czech']");
    await page.click("[data-incorporation-candidate='slovak']");
    await page.waitFor(() => document.querySelectorAll("[data-incorporation-selected-culture]").length >= 4, `${name} selected culture count`);
    await page.click("[data-incorporation-start]");
    assert.equal(await page.evaluate(() => state.mapMode), "cultureIncorporation");
    assert.ok(await page.evaluate(() => ["south_german", "hungarian", "czech", "slovak"].every((key) => state.incorporationCalculatorAppliedCultures.has(key))));
    assert.notEqual(await page.evaluate(() => mapRuntime.layerSignature), beforeStart.layerSignature, `${name} map layer must refresh after calculation`);
    await page.click("[data-incorporation-selected-culture='czech']");
    assert.equal(await page.evaluate(() => state.incorporationCalculatorCultures.has("czech")), false);
    await page.click("[data-incorporation-clear]");
    await page.waitFor(() => document.querySelectorAll("[data-incorporation-selected-culture]").length === 0, `${name} empty calculator`);
    await page.click("[data-incorporation-start]");
    assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-incorporation-results]"))), false);

    await page.goto(`${baseUrl}?lang=zh-Hans#/culture/incorporation`);
    await page.click("[data-incorporation-filter-heritage-group='heritage_group_european']");
    await page.waitFor(() => document.querySelectorAll("[data-incorporation-filter-culture]").length > 0, `${name} Yankee filter result`);
    const yankeeSelector = await page.evaluate(() => [...document.querySelectorAll("[data-incorporation-filter-culture]")].find((node) => node.dataset.incorporationFilterCulture === "yankee")?.dataset.incorporationFilterCulture || document.querySelector("[data-incorporation-filter-culture]")?.dataset.incorporationFilterCulture);
    await page.click(`[data-incorporation-filter-culture='${yankeeSelector}']`);
    const beforeEffect = await page.evaluate(() => ({ applied: [...state.incorporationCalculatorAppliedHomelandEffects], relation: mapRuntime.featureByStateKey?.get("STATE_CALIFORNIA")?.incorporation?.culture?.key || "" }));
    await page.click("[data-incorporation-homeland-effect='event:manifest_destiny.1']");
    assert.deepEqual(await page.evaluate(() => [...state.incorporationCalculatorAppliedHomelandEffects]), beforeEffect.applied);
    await page.click("[data-incorporation-start]");
    assert.ok(await page.evaluate(() => state.incorporationCalculatorAppliedHomelandEffects.has("event:manifest_destiny.1")));
    assert.deepEqual(await page.evaluate(() => { const relation = mapRuntime.featureByStateKey.get("STATE_CALIFORNIA").incorporation; return { culture: relation.culture?.key, years: relation.years }; }), { culture: "yankee", years: 2 });

    if (fullCoverage) {
      await page.goto(`${baseUrl}?lang=zh-Hans#/culture/incorporation`);
      await page.goto(`${baseUrl}?lang=zh-Hans#/country/FRA`);
      await page.waitFor(() => Boolean(document.querySelector("[data-incorporation-country='FRA']")), `${name} France link`);
      await page.click("[data-incorporation-country='FRA']");
      await page.waitFor(() => Boolean(document.querySelector("[data-incorporation-selected-culture='french']")), `${name} France preload`);
      await page.goto(`${baseUrl}?lang=zh-Hans#/culture/incorporation`);
      await page.goto(`${baseUrl}?lang=zh-Hans#/country/AFG`);
      await page.waitFor(() => Boolean(document.querySelector("[data-incorporation-country='AFG']")), `${name} Afghanistan link`);
      await page.click("[data-incorporation-country='AFG']");
      await page.waitFor(() => Boolean(document.querySelector("[data-incorporation-candidate='turkmen']")), `${name} Afghanistan candidates`);
      await page.goto(`${baseUrl}?lang=zh-Hans#/country/AUS`);
      await page.waitFor(() => Boolean(document.querySelector("#countryIncorporationMapButton")), `${name} base country map`);
      assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-primary-culture-scenario-route]"))), false);
    }
    if (name === "victorian-century") {
      await page.goto(`${baseUrl}?lang=zh-Hans#/culture/incorporation`);
      await page.waitFor(() => Boolean(document.querySelector("[data-incorporation-homeland-effect='event:joi_flavor_aus.10']")), `${name} Austrian homeland effect`);
    }
  } finally {
    await page.close();
  }

  const mobile = await openPage({ width: 442, height: 844 });
  try {
    await mobile.goto(`${baseUrl}?lang=en#/culture/incorporation`);
    await mobile.waitFor(() => Boolean(document.querySelector("[data-culture-incorporation-calculator]")), `${name} English mobile calculator`);
    const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${name} calculator must not overflow horizontally: ${overflow}`);
  } finally {
    await mobile.close();
  }
}

async function openPage(viewport) {
  await waitForDebugger();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable"); await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 600 });
  return {
    async goto(url) { const loaded = session.next("Page.loadEventFired"); const hash = session.next("Page.navigatedWithinDocument"); await session.send("Page.navigate", { url }); await Promise.race([loaded, hash]); await new Promise((resolve) => setTimeout(resolve, 500)); },
    async evaluate(callback, ...args) { const expression = `(${callback})(${args.map((value) => JSON.stringify(value)).join(",")})`; const result = await session.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(`${result.exceptionDetails.exception?.description || result.exceptionDetails.text || "browser evaluation failed"}\n${expression}`); return result.result.value; },
    async click(selector) { await this.evaluate((targetSelector) => document.querySelector(targetSelector)?.click(), selector); },
    async text(selector) { return this.evaluate((targetSelector) => document.querySelector(targetSelector)?.innerText?.replace(/\s+/g, " ").trim() || "", selector); },
    async waitFor(predicate, description, ...args) { const deadline = Date.now() + 20000; while (Date.now() < deadline) { if (await this.evaluate(predicate, ...args)) return; await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error(`${description} timed out: ${await this.evaluate(() => window.__mapLayerError || "no diagnostic")}`); },
    close() { session.close(); },
  };
}

async function waitForDebugger() { const deadline = Date.now() + 10000; while (Date.now() < deadline) { try { if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error("Chrome debug endpoint timed out"); }
async function connect(url) { const socket = new WebSocket(url); const pending = new Map(); const events = new Map(); let id = 0; await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); }); socket.addEventListener("message", ({ data }) => { const message = JSON.parse(data); if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); } else { (events.get(message.method) || []).forEach((resolve) => resolve(message)); events.delete(message.method); } }); return { send(method, params = {}) { const requestId = ++id; return new Promise((resolve) => { pending.set(requestId, resolve); socket.send(JSON.stringify({ id: requestId, method, params })); }).then((message) => { if (message.error) throw new Error(`${method}: ${message.error.message}\n${JSON.stringify(params)}`); return message.result || {}; }); }, next(method) { return new Promise((resolve) => events.set(method, [...(events.get(method) || []), resolve])); }, close() { socket.close(); } }; }
