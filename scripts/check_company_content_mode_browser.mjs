import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:8876/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9284;
const chrome = spawn(chromePath, [
  `--remote-debugging-port=${debugPort}`,
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  `--user-data-dir=${process.env.TEMP || "."}\\vicdata-company-content-mode-browser`,
  "about:blank",
], { stdio: "ignore", windowsHide: true });

try {
  const page = await openPage();
  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/company`);
  await page.waitFor(() => document.body.dataset.pageMode === "content" && document.querySelectorAll("[data-company]").length > 20, "company content board");
  const listState = await page.evaluate(() => ({
    view: document.body.dataset.view,
    mode: document.body.dataset.pageMode,
    map: getComputedStyle(document.querySelector("#mapPanel")).display,
    fullscreen: document.querySelector("#mapFullscreenButton")?.hidden,
    cards: document.querySelectorAll("[data-company]").length,
  }));
  assert.equal(listState.view, "company", "company route must remain available");
  assert.equal(listState.mode, "content", "company must use content mode");
  assert.equal(listState.map, "none", "company list must hide the main map");
  assert.equal(listState.fullscreen, true, "company content mode must not show map fullscreen");

  const companyKey = await page.evaluate(() => document.querySelector("[data-company]")?.dataset.company || "");
  await page.evaluate((key) => document.querySelector(`[data-company="${CSS.escape(key)}"]`)?.click(), companyKey);
  await page.waitFor((key) => location.hash === `#/company/${encodeURIComponent(key)}` && document.body.classList.contains("detail-page"), "company detail route", companyKey);
  const detailState = await page.evaluate(() => ({
    map: getComputedStyle(document.querySelector("#mapPanel")).display,
    detail: getComputedStyle(document.querySelector("#detail")).display,
    locationMap: Boolean(document.querySelector("[data-company-location-map]")),
  }));
  assert.equal(detailState.map, "none", "company detail must keep the main map hidden");
  assert.notEqual(detailState.detail, "none", "company detail must be visible");
  assert.equal(detailState.locationMap, true, "company detail must retain its auxiliary location map when available");
  page.close();
  console.log(JSON.stringify({ company_content_mode_browser: "ok", baseUrl, companyKey }, null, 2));
} finally {
  chrome.kill();
}

async function openPage() {
  await waitForDebugger();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  return {
    async goto(url) {
      const loaded = session.next("Page.loadEventFired");
      await session.send("Page.navigate", { url });
      await Promise.race([loaded, new Promise((_, reject) => setTimeout(() => reject(new Error(`navigation timed out: ${url}`)), 45000))]);
      await new Promise((resolve) => setTimeout(resolve, 500));
    },
    async evaluate(callback, ...args) {
      const expression = `(${callback})(${args.map((value) => JSON.stringify(value)).join(",")})`;
      const result = await session.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "browser evaluation failed");
      return result.result.value;
    },
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
