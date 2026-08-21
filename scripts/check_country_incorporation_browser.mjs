import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:8876/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9237;
const chrome = spawn(chromePath, [
  `--remote-debugging-port=${debugPort}`,
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "about:blank",
], { stdio: "ignore", windowsHide: true });

try {
  const page = await openPage({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}#/country`);
  await page.waitForSelector("[data-country]", "country list");
  await page.waitForSelector("#countryIncorporationMapButton", "incorporation toggle");
  assert.equal(await page.evaluate(() => document.querySelector("#countryIncorporationMapButton").disabled), true, "toggle must be disabled without a country");
  assert.equal(await page.evaluate(() => document.querySelector("#countryIncorporationMapLegend").hidden), true, "legend must be hidden without a country");

  await page.goto(`${baseUrl}#/country`);
  await page.waitForSelector('[data-country="FRA"]', "country list row");
  await page.evaluate(() => document.querySelector('[data-country="FRA"]').click());
  assert.equal(await page.evaluate(() => document.querySelector("#countryIncorporationMapButton").disabled), false, "toggle must enable after country selection");
  await page.waitForSelector("#mapCountryContext:not([hidden])", "selected country context");
  await new Promise((resolve) => setTimeout(resolve, 500));
  const countryContext = await page.evaluate(() => ({
    name: document.querySelector("#mapCountryContext .map-country-context-name")?.textContent?.trim(),
    tag: document.querySelector("#mapCountryContext .map-country-context-tag")?.textContent?.trim(),
    flag: document.querySelector("#mapCountryContext .map-country-context-flag")?.getAttribute("src"),
    flagStyle: (() => { const element = document.querySelector("#mapCountryContext .map-country-context-flag"); const style = element ? getComputedStyle(element) : null; return style ? { width: style.width, height: style.height, flex: style.flex } : null; })(),
  }));
  assert.ok(countryContext.name, "selected country context must show a localized country name");
  assert.equal(countryContext.tag, "FRA", "selected country context must show the selected country tag");
  assert.ok(countryContext.flag, "selected country context must show the selected country flag");
  assert.deepEqual(countryContext.flagStyle, { width: "24px", height: "16px", flex: "0 0 auto" }, "selected country context flag must stay compact");
  const regionCount = await page.evaluate(() => stateRegions.length);
  await page.evaluate(() => document.querySelector("#countryIncorporationMapButton").click());
  await page.waitForSelector("#countryIncorporationMapLegend:not([hidden])", "incorporation legend");
  const result = await page.evaluate(() => ({
    mode: state.mapMode,
    visibleCount: mapRuntime.visibleStateKeys.size,
    legend: document.querySelector("#countryIncorporationMapLegend").innerText,
    legendState: (() => { const element = document.querySelector("#countryIncorporationMapLegend"); const style = getComputedStyle(element); const rect = element.getBoundingClientRect(); return { hidden: element.hidden, display: style.display, width: rect.width, height: rect.height }; })(),
  }));
  assert.equal(result.mode, "countryIncorporation", "map mode must switch to incorporation");
  assert.equal(result.visibleCount, regionCount, "incorporation map must use all state regions");
  for (const label of ["2年", "5年", "10年", "15年", "25年"]) assert.ok(result.legend.includes(label), `${label} legend entry should be visible`);
  assert.equal(result.legendState.hidden, false, "incorporation legend must not be hidden");
  assert.ok(result.legendState.width > 0 && result.legendState.height > 0, "incorporation legend must occupy visible space");
  await page.evaluate(() => { document.querySelector("#leftPanelToggle").click(); document.querySelector("#bottomPanelToggle").click(); });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const collapsedLegend = await page.evaluate(() => { const element = document.querySelector("#countryIncorporationMapLegend"); const rect = element.getBoundingClientRect(); const style = getComputedStyle(element); return { hidden: element.hidden, display: style.display, width: rect.width, height: rect.height, bottom: rect.bottom, bodyClass: document.body.className }; });
  assert.equal(collapsedLegend.hidden, false, "incorporation legend must remain visible with panels collapsed");
  assert.ok(collapsedLegend.width > 0 && collapsedLegend.height > 0, "incorporation legend must remain visible with panels collapsed");

  await page.evaluate(() => document.querySelector("#countryIncorporationMapButton").click());
  assert.equal(await page.evaluate(() => state.mapMode), "country", "toggle off must restore country map");
  assert.equal(await page.evaluate(() => document.querySelector("#countryIncorporationMapLegend").hidden), true, "legend must hide when mode is off");
  await page.close();
  console.log("country incorporation browser contract passed");
} finally {
  chrome.kill();
}

async function openPage(viewport) {
  await waitForDebugger();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
  return {
    async goto(url) {
      const loaded = session.next("Page.loadEventFired");
      const navigated = session.next("Page.navigatedWithinDocument");
      await session.send("Page.navigate", { url });
      await Promise.race([loaded, navigated]);
      await new Promise((resolve) => setTimeout(resolve, 250));
    },
    async evaluate(callback, ...args) {
      const expression = `(${callback})(${args.map((value) => JSON.stringify(value)).join(",")})`;
      const result = await session.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "browser evaluation failed");
      return result.result.value;
    },
    async waitForSelector(selector, description) {
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        if (await this.evaluate((query) => Boolean(document.querySelector(query)), selector)) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`${description} timed out`);
    },
    async close() {},
  };
}

async function waitForDebugger() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error("Chrome debug port did not start");
}

async function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const events = new Map();
  let sequence = 0;
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      pending.get(message.id)?.resolve(message);
      pending.delete(message.id);
      return;
    }
    for (const deferred of events.get(message.method) || []) deferred.resolve(message);
    events.delete(message.method);
  });
  return {
    send(method, params = {}) {
      const id = ++sequence;
      const response = new Promise((resolve) => pending.set(id, { resolve }));
      socket.send(JSON.stringify({ id, method, params }));
      return response.then((message) => {
        if (message.error) throw new Error(message.error.message);
        return message.result || {};
      });
    },
    next(method) {
      return new Promise((resolve) => events.set(method, [...(events.get(method) || []), { resolve }]));
    },
  };
}
