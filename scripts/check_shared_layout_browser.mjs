import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:8876/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9283;
const chrome = spawn(chromePath, [
  `--remote-debugging-port=${debugPort}`,
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  `--user-data-dir=${process.env.TEMP || "."}\\vicdata-shared-layout-browser`,
  "about:blank",
], { stdio: "ignore", windowsHide: true });

try {
  const page = await openPage({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country`);
  await page.waitFor(() => document.querySelectorAll("#countryList [data-country]").length > 20, "country list");
  const desktop = await page.evaluate(() => ({
    fullscreenHidden: document.querySelector("#mapFullscreenButton")?.hidden,
    mapDisplay: getComputedStyle(document.querySelector("#mapPanel")).display,
  }));
  assert.equal(desktop.fullscreenHidden, true, "desktop country view must hide the fullscreen button");
  assert.notEqual(desktop.mapDisplay, "none", "desktop country view must show the map");

  const tag = await page.evaluate(() => document.querySelector("#countryList [data-country]")?.dataset.country || "");
  await page.evaluate((countryTag) => document.querySelector(`[data-country="${CSS.escape(countryTag)}"]`)?.click(), tag);
  await page.waitFor((countryTag) => window.eval("state.selectedTag") === countryTag && location.hash === "#/country", "country selection", tag);
  const selected = await page.evaluate((countryTag) => ({
    tag: window.eval("state.selectedTag"),
    pressed: document.querySelector(`[data-country="${CSS.escape(countryTag)}"]`)?.getAttribute("aria-pressed"),
    detailPage: document.body.classList.contains("detail-page"),
  }), tag);
  assert.equal(selected.tag, tag, "country card click must select the country");
  assert.equal(selected.pressed, "true", "selected country card must expose pressed state");
  assert.equal(selected.detailPage, false, "country card click must not open detail");

  await page.evaluate((countryTag) => document.querySelector(`[data-country="${CSS.escape(countryTag)}"] [data-map-enter-tag]`)?.click(), tag);
  await page.waitFor((countryTag) => location.hash === `#/country/${encodeURIComponent(countryTag)}` && document.body.classList.contains("detail-page"), "country detail entry", tag);

  await page.setViewport({ width: 442, height: 844 });
  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country`);
  await page.waitFor(() => document.querySelectorAll("#countryList [data-country]").length > 20, "mobile country list");
  await page.click("#mapFullscreenButton");
  await page.waitFor(() => document.body.dataset.mapFullscreen === "true", "map fullscreen");
  const fullscreen = await page.evaluate(() => ({
    view: document.body.dataset.view,
    mode: document.body.dataset.pageMode,
    results: getComputedStyle(document.querySelector(".results")).display,
    filters: getComputedStyle(document.querySelector(".filters")).display,
    mapPosition: getComputedStyle(document.querySelector("#mapPanel")).position,
    collapseHidden: document.querySelector("#mapCollapseButton")?.hidden,
  }));
  assert.equal(fullscreen.view, "country", "fullscreen map must keep the country view");
  assert.equal(fullscreen.mode, "map", "fullscreen map must keep map page mode");
  assert.equal(fullscreen.results, "none", "fullscreen map must hide the list");
  assert.equal(fullscreen.filters, "none", "fullscreen map must hide filters");
  assert.equal(fullscreen.mapPosition, "fixed", "fullscreen map must occupy the viewport");
  assert.equal(fullscreen.collapseHidden, false, "fullscreen map must show the collapse button");
  await page.click("#mapCollapseButton");
  await page.waitFor(() => document.body.dataset.mapFullscreen === "false", "collapse fullscreen map");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".results")).display), "block", "collapsing fullscreen map must restore the list");

  page.close();
  console.log(JSON.stringify({ shared_layout_browser: "ok", baseUrl }, null, 2));
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
    async setViewport(nextViewport) {
      await session.send("Emulation.setDeviceMetricsOverride", { width: nextViewport.width, height: nextViewport.height, deviceScaleFactor: 1, mobile: false });
    },
    async goto(url) {
      const loaded = session.next("Page.loadEventFired");
      const hash = session.next("Page.navigatedWithinDocument");
      await session.send("Page.navigate", { url });
      await Promise.race([loaded, hash, new Promise((_, reject) => setTimeout(() => reject(new Error(`navigation timed out: ${url}`)), 45000))]);
      await new Promise((resolve) => setTimeout(resolve, 500));
    },
    async evaluate(callback, ...args) {
      const expression = `(${callback})(${args.map((value) => JSON.stringify(value)).join(",")})`;
      const result = await session.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "browser evaluation failed");
      return result.result.value;
    },
    async click(selector) { await this.evaluate((targetSelector) => document.querySelector(targetSelector)?.click(), selector); },
    async waitFor(predicate, description, ...args) {
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        if (await this.evaluate(predicate, ...args)) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`${description} timed out`);
    },
    close() { session.close(); },
  };
}

async function waitForDebugger() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Chrome debug endpoint timed out");
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
      return new Promise((resolve) => {
        pending.set(requestId, resolve);
        socket.send(JSON.stringify({ id: requestId, method, params }));
      }).then((message) => {
        if (message.error) throw new Error(`${method}: ${message.error.message}`);
        return message.result || {};
      });
    },
    next(method) { return new Promise((resolve) => events.set(method, [...(events.get(method) || []), resolve])); },
    close() { socket.close(); },
  };
}
