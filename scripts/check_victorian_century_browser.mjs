import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:8877/index.html";
const requestedRoutes = process.argv.slice(3).filter((argument) => argument !== "--fixtures" && argument !== "--fixtures-only");
const routes = requestedRoutes.length ? requestedRoutes : ["building", "goods"];
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9231;
const expectedCounts = { building: 101, goods: 53 };
const cardSelectors = { building: "[data-building-key]", goods: "[data-good-key]" };

for (const route of routes) assert(Object.hasOwn(expectedCounts, route), `Unsupported Victorian Century economy route: ${route}`);

const chrome = spawn(chromePath, [
  `--remote-debugging-port=${debugPort}`,
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "about:blank",
], { stdio: "ignore", windowsHide: true });

try {
  const page = await openPage({ width: 1440, height: 1000 });
  for (const route of routes) await checkEconomyWall(page, route);
  await checkEnglishConstruction(page);
  await checkEnglishBanana(page);
  await checkAutomobiles(page, "zh-Hans");
  await checkAutomobiles(page, "en");
  await checkAdjustedPrestigeGood(page);
  await page.close();
  console.log(JSON.stringify({
    victorian_century_browser: "ok",
    routes,
    locales: ["zh-Hans", "en"],
    verified: ["economy-walls", "change-filters", "construction-method", "banana-method", "benz-prestige-good"],
  }, null, 2));
} finally {
  chrome.kill();
}

async function checkEconomyWall(page, route) {
  const selector = cardSelectors[route];
  await page.goto(localizedRoute("zh-Hans", route));
  await page.waitFor(({ route: expectedRoute, selector: expectedSelector, expectedCount }) => document.body.dataset.view === expectedRoute && document.querySelectorAll(expectedSelector).length === expectedCount, `${route} wall`, { route, selector, expectedCount: expectedCounts[route] });
  const wall = await page.evaluate(({ selector: expectedSelector }) => ({
    cards: document.querySelectorAll(expectedSelector).length,
    map: getComputedStyle(document.querySelector("#mapPanel")).display,
    filters: getComputedStyle(document.querySelector(".filters")).display,
    added: document.querySelector("[data-economy-vc-change='added']")?.getAttribute("aria-pressed") || "",
    adjusted: document.querySelector("[data-economy-vc-change='adjusted']")?.getAttribute("aria-pressed") || "",
  }), { selector });
  assert.equal(wall.cards, expectedCounts[route], `${route} wall must expose every database entry`);
  assert.equal(wall.map, "none", `${route} wall must hide the map`);
  assert.equal(wall.filters, "none", `${route} wall must hide the sidebar filters`);
  assert.equal(wall.added, "false", `${route} added filter must start inactive`);
  assert.equal(wall.adjusted, "false", `${route} adjusted filter must start inactive`);

  await page.click("[data-economy-vc-change='added']");
  await page.waitFor((expectedSelector) => document.querySelector("[data-economy-vc-change='added']")?.getAttribute("aria-pressed") === "true" && document.querySelectorAll(expectedSelector).length === 0, `${route} added filter`, selector);
  await page.click("[data-economy-vc-change='added']");
  await page.waitFor(({ selector: expectedSelector, expectedCount }) => document.querySelector("[data-economy-vc-change='added']")?.getAttribute("aria-pressed") === "false" && document.querySelectorAll(expectedSelector).length === expectedCount, `${route} cleared added filter`, { selector, expectedCount: expectedCounts[route] });
  await page.click("[data-economy-vc-change='adjusted']");
  await page.waitFor((expectedSelector) => {
    const cards = [...document.querySelectorAll(expectedSelector)];
    return document.querySelector("[data-economy-vc-change='adjusted']")?.getAttribute("aria-pressed") === "true"
      && cards.length > 0
      && cards.every((card) => card.querySelector(".economy-card-change .tag-vc-adjusted"));
  }, `${route} adjusted filter`, selector);
  await page.click("[data-economy-vc-change='adjusted']");
  await page.waitFor(({ selector: expectedSelector, expectedCount }) => document.querySelector("[data-economy-vc-change='adjusted']")?.getAttribute("aria-pressed") === "false" && document.querySelectorAll(expectedSelector).length === expectedCount, `${route} cleared adjusted filter`, { selector, expectedCount: expectedCounts[route] });
}

async function checkEnglishConstruction(page) {
  await page.goto(localizedRoute("en", "building/building_construction_sector"));
  await page.waitFor(() => document.documentElement.lang === "en" && document.querySelector("[data-production-method-picker='pmg_base_building_construction_sector']"), "English construction detail");
  await page.click("[data-production-method-picker='pmg_base_building_construction_sector']");
  await page.waitFor(() => document.querySelector(".production-method-group-panel:not([hidden]) [data-production-method-key='pm_wooden_buildings']"), "English construction methods");
  const construction = await page.evaluate(() => ({
    title: document.querySelector(".economy-detail h2")?.childNodes[0]?.textContent?.trim() || "",
    method: document.querySelector(".production-method-row.is-selected strong")?.textContent?.trim() || "",
    adjusted: Boolean(document.querySelector(".production-method-row.is-selected .tag-vc-adjusted")),
    changedFields: document.querySelector(".production-method-row.is-selected .economy-vc-change")?.textContent?.trim() || "",
    body: document.querySelector(".economy-detail")?.innerText || "",
  }));
  assert.equal(construction.title, "Construction Sector", "VC English construction title is incorrect");
  assert.equal(construction.method, "Wooden Buildings", "VC English construction method is incorrect");
  assert.equal(construction.adjusted, true, "VC adjusted construction production method lacks its badge");
  assert.match(construction.changedFields, /^VC changed fields:/, "VC adjusted construction method must identify its changed fields");
  assert.doesNotMatch(construction.changedFields, /patch_directives/, "VC changed fields must not expose patch metadata");
  assert.doesNotMatch(construction.body, /\$[^$]+\$|@[A-Za-z0-9_]+!|[\u3400-\u9fff]/, "VC English construction detail contains unresolved localization");
}

async function checkEnglishBanana(page) {
  await page.goto(localizedRoute("en", "building/building_banana_plantation"));
  await page.waitFor(() => document.querySelector("[data-production-method-picker='pmg_banana_exploitation']"), "English banana detail");
  await page.click("[data-production-method-picker='pmg_banana_exploitation']");
  await page.waitFor(() => document.querySelector("[data-production-method-group='pmg_banana_exploitation'][data-production-method-key='united_fruit_banana']"), "United Fruit option");
  await page.click("[data-production-method-group='pmg_banana_exploitation'][data-production-method-key='united_fruit_banana']");
  await page.waitFor(() => document.querySelector("[data-production-method-picker='pmg_banana_exploitation']")?.dataset.productionMethodKey === "united_fruit_banana", "selected United Fruit option");
  const banana = await page.evaluate(() => ({
    method: document.querySelector(".production-method-group-panel:not([hidden]) .production-method-row.is-selected strong")?.textContent?.trim() || "",
    added: Boolean(document.querySelector(".production-method-group-panel:not([hidden]) .production-method-row.is-selected .tag-vc-added")),
    body: document.querySelector(".economy-detail")?.innerText || "",
  }));
  assert.equal(banana.method, "Vertically Integrated Cultivation", "VC added banana production method is incorrect");
  assert.equal(banana.added, true, "VC added banana production method lacks its badge");
  assert.doesNotMatch(banana.body, /\$[^$]+\$|@[A-Za-z0-9_]+!|[\u3400-\u9fff]/, "VC English banana detail contains unresolved localization");
}

async function checkAutomobiles(page, locale) {
  await page.goto(localizedRoute(locale, "goods/automobiles"));
  await page.waitFor(() => document.querySelector("[data-prestige-good='prestige_good_benz_car']"), `${locale} automobiles detail`);
  const automobiles = await page.evaluate(() => ({
    name: document.querySelector("[data-prestige-good='prestige_good_benz_car'] h4")?.childNodes[0]?.textContent?.trim() || "",
    key: document.querySelector("[data-prestige-good='prestige_good_benz_car'] p")?.textContent?.trim() || "",
    body: document.querySelector(".economy-detail")?.innerText || "",
  }));
  assert.equal(automobiles.key, "prestige_good_benz_car", `${locale} automobiles detail lacks the Benz prestige-good key`);
  if (locale === "en") {
    assert.equal(automobiles.name, "Benz Automobiles", "VC English Benz prestige-good name is incorrect");
    assert.doesNotMatch(automobiles.body, /\$[^$]+\$|@[A-Za-z0-9_]+!|[\u3400-\u9fff]/, "VC English automobiles detail contains unresolved localization");
  }
}

async function checkAdjustedPrestigeGood(page) {
  await page.goto(localizedRoute("en", "goods/artillery"));
  await page.waitFor(() => document.querySelector("[data-prestige-good='prestige_good_generic_artillery']"), "English artillery detail");
  const changedFields = await page.evaluate(() => document.querySelector("[data-prestige-good='prestige_good_generic_artillery'] .economy-vc-change")?.textContent?.trim() || "");
  assert.match(changedFields, /^VC changed fields: associated companies$/, "adjusted prestige goods must identify their changed companies");
}

function localizedRoute(locale, route) {
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}lang=${encodeURIComponent(locale)}#/${route}`;
}

async function openPage(viewport) {
  await waitForTargets();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
  return {
    goto: async (url) => {
      const loaded = session.next("Page.loadEventFired");
      const hashNavigated = session.next("Page.navigatedWithinDocument");
      await session.send("Page.navigate", { url });
      await Promise.race([loaded, hashNavigated]);
      await new Promise((resolve) => setTimeout(resolve, 150));
    },
    evaluate: async (expression, ...args) => {
      const serializedArgs = args.map((value) => JSON.stringify(value)).join(",");
      const value = await session.send("Runtime.evaluate", { expression: `(${expression})(${serializedArgs})`, returnByValue: true, awaitPromise: true });
      if (value.exceptionDetails) throw new Error(value.exceptionDetails.text || "browser evaluation failed");
      return value.result.value;
    },
    click: async (selector) => {
      const clicked = await session.send("Runtime.evaluate", { expression: `(() => { const node = document.querySelector(${JSON.stringify(selector)}); if (!node) return false; node.click(); return true; })()`, returnByValue: true, awaitPromise: true });
      if (!clicked.result.value) throw new Error(`Missing clickable selector: ${selector}`);
      await new Promise((resolve) => setTimeout(resolve, 50));
    },
    waitFor: async (predicate, description = "browser condition", ...args) => {
      const end = Date.now() + 25000;
      while (Date.now() < end) {
        if (await session.evaluateWithArgs(predicate, args)) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(`${description} timed out`);
    },
    close: async () => session.close(),
  };
}

async function waitForTargets() {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    try { await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json(); return; } catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
  }
  throw new Error("Chrome debugging endpoint did not start");
}

async function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const events = new Map();
  let sequence = 0;
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) { const deferred = pending.get(message.id); pending.delete(message.id); deferred?.resolve(message); return; }
    const waiters = events.get(message.method) || [];
    events.delete(message.method);
    waiters.forEach((deferred) => deferred.resolve(message));
  });
  return {
    send(method, params = {}) {
      const id = ++sequence;
      const response = new Promise((resolve) => pending.set(id, { resolve }));
      socket.send(JSON.stringify({ id, method, params }));
      return response.then((message) => { if (message.error) throw new Error(message.error.message); return message.result || {}; });
    },
    next(method) { return new Promise((resolve) => events.set(method, [...(events.get(method) || []), { resolve }])); },
    async evaluateWithArgs(predicate, args) {
      const serializedArgs = args.map((value) => JSON.stringify(value)).join(",");
      const result = await this.send("Runtime.evaluate", { expression: `Boolean((${predicate})(${serializedArgs}))`, returnByValue: true, awaitPromise: true });
      return Boolean(result.result.value);
    },
    close() { socket.close(); },
  };
}
