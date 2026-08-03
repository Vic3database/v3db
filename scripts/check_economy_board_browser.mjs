import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:4173/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9230;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });

try {
  const page = await openPage({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}#/building`);
  await page.waitFor(() => document.querySelectorAll("[data-building-key]").length === 101, "building wall");
  const buildingWall = await page.evaluate(() => ({
    cards: document.querySelectorAll("[data-building-key]").length,
    groups: document.querySelectorAll(".economy-group").length,
    map: getComputedStyle(document.querySelector("#mapPanel")).display,
    filters: getComputedStyle(document.querySelector(".filters")).display,
    lazy: document.querySelector("[data-building-key] img")?.getAttribute("loading"),
  }));
  assert.equal(buildingWall.cards, 101, "building wall must show every icon-bearing building");
  assert(buildingWall.groups > 1, "building wall must retain group sections");
  assert.equal(buildingWall.map, "none", "building wall must hide the map");
  assert.equal(buildingWall.filters, "none", "building wall must hide filters");
  assert.equal(buildingWall.lazy, "lazy", "building cards must defer icon loading");

  await page.evaluate(() => document.querySelector("[data-building-key='building_oil_rig']").click());
  await page.waitFor(() => location.hash === "#/building/building_oil_rig", "oil rig route");
  const oilRig = await page.evaluate(() => ({
    groupCount: document.querySelectorAll(".production-method-group").length,
    optionCounts: Array.from(document.querySelectorAll(".production-method-group"), (group) => group.querySelectorAll("[data-production-method-key]").length),
    combinations: document.querySelector(".production-method-section h3")?.textContent || "",
    selected: document.querySelectorAll("[data-production-method-key][aria-pressed='true']").length,
    resourceButton: Boolean(document.querySelector("[data-resource-map-building='building_oil_rig']")),
  }));
  assert.deepEqual(oilRig.optionCounts, [2, 3], "oil rig must expose two base and three automation options");
  assert.match(oilRig.combinations, /6 种组合/, "oil rig must state six combinations");
  assert.equal(oilRig.selected, 2, "one production method in each group must be selected");
  assert.equal(oilRig.resourceButton, true, "oil rig must offer the resource map route");
  await page.evaluate(() => document.querySelector("[data-production-method-group='pmg_base_building_oil_rig'][data-production-method-key='pm_combustion_derricks']").click());
  await page.waitFor(() => document.querySelector("[data-production-method-key='pm_combustion_derricks']")?.getAttribute("aria-pressed") === "true", "changed oil rig method");
  assert.equal(await page.evaluate(() => document.querySelector(".selected-production-method-detail")?.textContent?.includes("内燃机")), true, "selected method detail must show its prerequisite technology");
  assert.equal(await page.evaluate(() => document.querySelector(".selected-production-method-detail h5")?.textContent?.trim()), "\u5177\u4f53\u5185\u5bb9\u4e0e\u4fee\u6b63", "selected method detail must label its effects");
  await page.evaluate(() => document.querySelector("[data-resource-map-building='building_oil_rig']").click());
  await page.waitFor(() => location.hash === "#/region/resource/building_oil_rig", "resource map route");
  await page.waitFor(() => document.querySelector("[data-resource-filter='building_oil_rig'][aria-pressed='true']"), "selected oil rig resource filter");
  const resourceMap = await page.evaluate(() => ({
    selected: Array.from(document.querySelectorAll("[data-resource-filter][aria-pressed='true']"), (item) => item.dataset.resourceFilter),
    mode: document.documentElement.dataset.railSimulatorStatus || document.body.dataset.view,
  }));
  assert.equal(documentedResourceSelection(resourceMap.selected), "building_oil_rig", "resource route must select oil rig");

  await page.goto(`${baseUrl}#/goods`);
  await page.waitFor(() => document.querySelectorAll("[data-good-key]").length === 53, "goods wall");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#mapPanel")).display), "none", "goods wall must hide the map");
  await page.evaluate(() => document.querySelector("[data-good-key='oil']").click());
  await page.waitFor(() => location.hash === "#/goods/oil", "oil good route");
  const oil = await page.evaluate(() => ({
    producers: Array.from(document.querySelectorAll("[data-good-building]"), (item) => item.dataset.goodBuilding),
    variants: document.querySelectorAll(".economy-related-grid img[src*='prestige-goods']").length,
    methods: document.querySelectorAll("[data-production-method-key]").length,
  }));
  assert(oil.producers.includes("building_oil_rig"), "oil must link to oil rig");
  assert.equal(oil.variants, 1, "oil must show its Baku prestige variant");
  assert.equal(oil.methods, 0, "goods details must not show production methods");
  await page.close();
  console.log(JSON.stringify({ economy_board_browser: "ok", base_url: baseUrl }, null, 2));
} finally {
  chrome.kill();
}

function documentedResourceSelection(keys) {
  return keys.length === 1 ? keys[0] : "";
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
    waitFor: async (predicate, description = "browser condition") => {
      const end = Date.now() + 25000;
      while (Date.now() < end) {
        if (await session.evaluate(predicate)) return;
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
    async evaluate(predicate) {
      const result = await this.send("Runtime.evaluate", { expression: `Boolean((${predicate})())`, returnByValue: true, awaitPromise: true });
      return Boolean(result.result.value);
    },
    close() { socket.close(); },
  };
}
