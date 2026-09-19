import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:4173/";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = Number(process.env.DEBUG_PORT || 9275);
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });

try {
await waitForDebugger();
const page = await openPage({ width: 1440, height: 1000 });
try {
  await page.goto(`${baseUrl}?lang=zh-Hans#/country/GBR`);
  await page.waitFor(() => Boolean(document.querySelector("[data-country-detail-tab='regions']")), "country regions tab");
  await page.click("[data-country-detail-tab='regions']");
  await page.waitFor(() => Boolean(document.querySelector("[data-state-statistics-country='GBR']")), "country statistics entry");
  await page.click("[data-state-statistics-country='GBR']");
  await page.waitFor(() => location.hash.startsWith("#/region/statistics"), "country statistics route");
  await page.waitFor(() => state.stateStatisticsCalculatorSelected.size > 0, "country starting states preload");
  const countryPreload = await page.evaluate(() => ({
    selected: [...state.stateStatisticsCalculatorSelected],
    applied: [...state.stateStatisticsCalculatorApplied],
    dirty: state.stateStatisticsCalculatorDirty,
  }));
  assert.ok(countryPreload.selected.length > 0);
  assert.deepEqual(countryPreload.applied, []);
  assert.equal(countryPreload.dirty, true);
  await page.click("[data-state-statistics-start]");
  await page.waitFor(() => state.stateStatisticsCalculatorDirty === false, "country statistics submission");
  const countryResult = await page.evaluate(() => ({
    population: document.querySelector("[data-state-statistics-result]")?.textContent || "",
    note: document.querySelector(".state-statistics-split-note")?.textContent || "",
  }));
  assert.ok(countryResult.note, "country statistics should explain split-state resource exclusion");
  assert.match(countryResult.population, /分割地域/);

  await page.goto(`${baseUrl}?lang=zh-Hans#/region/statistics`);
  await page.waitFor(() => Boolean(document.querySelector("[data-state-statistics-calculator]")), "calculator page");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".filters .panel-head")).display), "none", "outer filter title should be hidden in calculator");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".state-statistics-calculator-title")).position), "static", "statistics title should scroll with content");
  assert.equal(await page.evaluate(() => document.body.dataset.stateStatistics), "true");
  assert.equal(await page.evaluate(() => document.querySelector("[data-state-statistics-selection-section]")?.open), true);
  assert.equal(await page.evaluate(() => document.querySelector("[data-state-statistics-search-section]")?.open), true);
  assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-state-statistics-selection-section] summary"))), true);
  assert.equal(await page.evaluate(() => document.querySelectorAll("[data-state-statistics-region]").length > 0), true);
  const searchBeforeEnter = await page.evaluate(() => {
    const input = document.querySelector("[data-state-statistics-search]");
    input.value = "STATE_HOME_COUNTIES";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    return { state: state.stateStatisticsCalculatorSearch, visible: document.querySelectorAll("[data-state-statistics-region]").length };
  });
  assert.equal(searchBeforeEnter.state, "");
  assert.ok(searchBeforeEnter.visible > 1);
  await page.evaluate(() => document.querySelector("[data-state-statistics-search]")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  await page.waitFor(() => state.stateStatisticsCalculatorSearch === "STATE_HOME_COUNTIES", "search submit by Enter");
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("[data-state-statistics-region]")].map((node) => node.dataset.stateStatisticsRegion)), ["STATE_HOME_COUNTIES"]);

  const initial = await page.evaluate(() => ({
    applied: [...state.stateStatisticsCalculatorApplied],
    selected: [...state.stateStatisticsCalculatorSelected],
    population: document.querySelector("[data-state-statistics-result]")?.textContent || "",
  }));
  assert.deepEqual(initial.applied, []);
  assert.deepEqual(initial.selected, []);

  await page.evaluate(() => {
    const input = document.querySelector("[data-state-statistics-search]");
    input.value = "STATE_HOME_COUNTIES";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
  });
  await page.waitFor(() => Boolean(document.querySelector("[data-state-statistics-region='STATE_HOME_COUNTIES']")), "population regression state");
  await page.click("[data-state-statistics-region='STATE_HOME_COUNTIES']");
  await page.click("[data-state-statistics-start]");
  await page.waitFor(() => document.querySelector("[data-state-statistics-result]")?.textContent.includes("2,805,996"), "non-zero population result");

  await page.goto(`${baseUrl}?lang=zh-Hans#/region/statistics`);
  await page.waitFor(() => Boolean(document.querySelector("[data-state-statistics-calculator]")), "calculator reset after population regression");
  await page.evaluate(() => { clearStateStatisticsCalculatorState(); renderStateStatisticsCalculator(); const input = document.querySelector("[data-state-statistics-search]"); input.value = ""; input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });

  const firstRegionKey = await page.evaluate(() => document.querySelector("[data-state-statistics-region]")?.dataset.stateStatisticsRegion || "");
  assert.ok(firstRegionKey, "calculator should render a selectable state");
  await page.click(`[data-state-statistics-region='${firstRegionKey}']`);
  await page.waitFor((key) => state.stateStatisticsCalculatorSelected.has(key), "list selection", firstRegionKey);
  const beforeStart = await page.evaluate(() => ({
    selected: [...state.stateStatisticsCalculatorSelected],
    applied: [...state.stateStatisticsCalculatorApplied],
    result: document.querySelector("[data-state-statistics-result]")?.textContent || "",
  }));
  assert.deepEqual(beforeStart.applied, []);
  assert.deepEqual(beforeStart.selected, [firstRegionKey]);
  assert.equal(beforeStart.result, initial.population);

  await page.click("[data-state-statistics-start]");
  await page.waitFor((key) => state.stateStatisticsCalculatorApplied.has(key), "statistics start", firstRegionKey);
  const afterStart = await page.evaluate(() => ({
    applied: [...state.stateStatisticsCalculatorApplied],
    result: document.querySelector("[data-state-statistics-result]")?.textContent || "",
  }));
  assert.deepEqual(afterStart.applied, [firstRegionKey]);

  const secondRegionKey = await page.evaluate((first) => [...document.querySelectorAll("[data-state-statistics-region]")].map((node) => node.dataset.stateStatisticsRegion).find((key) => key !== first) || "", firstRegionKey);
  assert.ok(secondRegionKey, "calculator should render a second selectable state");
  await page.click(`[data-state-statistics-region='${secondRegionKey}']`);
  await page.waitFor((key) => state.stateStatisticsCalculatorSelected.has(key), "second selection", secondRegionKey);
  assert.equal(await page.evaluate(() => state.stateStatisticsCalculatorDirty), true);
  assert.deepEqual(await page.evaluate(() => [...state.stateStatisticsCalculatorApplied]), [firstRegionKey]);
  await page.click("[data-state-statistics-start]");
  await page.waitFor((key) => state.stateStatisticsCalculatorApplied.has(key), "second statistics start", secondRegionKey);
  assert.deepEqual(await page.evaluate(() => [...state.stateStatisticsCalculatorApplied].sort()), [firstRegionKey, secondRegionKey].sort());
  assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-state-statistics-owner-group]"))), true);
  assert.ok(await page.evaluate(() => document.querySelectorAll("[data-state-statistics-result] .state-statistics-resource-icon").length > 0), "resource results should use building icons");
  assert.equal(await page.evaluate(() => [...document.querySelectorAll("[data-state-statistics-result] .state-statistics-resource-icon")].some((node) => node.title && node.getAttribute("aria-label"))), true);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("[data-state-statistics-result] .state-statistics-overview")).gridTemplateColumns.split(" ").length), 1, "summary metrics should use one row per metric");
  assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-state-statistics-result] .state-statistics-resource-list h4"))), false, "resource groups should not display group labels");
  assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-state-statistics-result] .state-statistics-discoverable-row"))), false, "discoverable resources should merge into resource groups");

  const search = await page.evaluate((query) => {
    const input = document.querySelector("[data-state-statistics-search]");
    input.value = query;
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    return [...document.querySelectorAll("[data-state-statistics-region]")].map((node) => node.dataset.stateStatisticsRegion);
  }, firstRegionKey);
  assert.ok(search.length > 1, "search draft should not filter before Enter");
  await page.evaluate(() => document.querySelector("[data-state-statistics-search]")?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  await page.waitFor((key) => state.stateStatisticsCalculatorSearch === key, "final search submit", firstRegionKey);
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("[data-state-statistics-region]")].map((node) => node.dataset.stateStatisticsRegion)), [firstRegionKey]);
} finally {
  page.close();
}

const mobile = await openPage({ width: 442, height: 844 });
try {
  await mobile.goto(`${baseUrl}?lang=en#/region/statistics`);
  await mobile.waitFor(() => Boolean(document.querySelector("[data-state-statistics-calculator]")), "mobile calculator page");
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `mobile calculator horizontal overflow: ${overflow}`);
} finally {
  mobile.close();
}
console.log(JSON.stringify({ state_statistics_calculator_browser: "ok" }, null, 2));
} finally {
  chrome.kill();
}

async function openPage(viewport) {
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 600 });
  return {
    async goto(url) {
      const loaded = session.next("Page.loadEventFired");
      const hash = session.next("Page.navigatedWithinDocument");
      await session.send("Page.navigate", { url });
      await Promise.race([loaded, hash]);
      await new Promise((resolve) => setTimeout(resolve, 700));
    },
    async evaluate(callback, ...args) {
      const expression = `(${callback})(${args.map((value) => JSON.stringify(value)).join(",")})`;
      const result = await session.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "browser evaluation failed");
      return result.result.value;
    },
    async click(selector) { await this.evaluate((value) => document.querySelector(value)?.click(), selector); },
    async waitFor(predicate, description, ...args) {
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        if (await this.evaluate(predicate, ...args)) return;
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      throw new Error(`${description} timed out`);
    },
    close() { session.close(); },
  };
}

async function waitForDebugger() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Chrome debug endpoint ${debugPort} timed out`);
}

async function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const events = new Map();
  let id = 0;
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    } else {
      (events.get(message.method) || []).forEach((resolve) => resolve(message));
      events.delete(message.method);
    }
  });
  return {
    send(method, params = {}) {
      const requestId = ++id;
      const promise = new Promise((resolve) => pending.set(requestId, resolve));
      socket.send(JSON.stringify({ id: requestId, method, params }));
      return promise.then((message) => {
        if (message.error) throw new Error(`${method}: ${message.error.message}`);
        return message.result || {};
      });
    },
    next(method) { return new Promise((resolve) => events.set(method, [...(events.get(method) || []), resolve])); },
    close() { socket.close(); },
  };
}
