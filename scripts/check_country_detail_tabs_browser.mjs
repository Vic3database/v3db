import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:8895/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9293;
const chrome = spawn(chromePath, [
  `--remote-debugging-port=${debugPort}`,
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  `--user-data-dir=${process.env.TEMP || "."}\\vicdata-country-detail-tabs-browser`,
  "about:blank",
], { stdio: "ignore", windowsHide: true });

try {
  const page = await openPage({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/CHI`);
  const desktop = await page.evaluate(() => ({
    view: document.body.dataset.view,
    detailPage: document.body.classList.contains("detail-page"),
    overview: document.querySelector(".country-detail-overview")?.innerText || "",
    tabs: [...document.querySelectorAll("[data-country-detail-tab]")].map((node) => node.textContent.trim()),
    selected: document.querySelector("[data-country-detail-tab][aria-selected='true']")?.dataset.countryDetailTab || "",
    panel: document.querySelector("[data-country-detail-panel]")?.dataset.countryDetailPanel || "",
  }));
  assert.equal(desktop.view, "country", "country detail must keep the country board");
  assert.equal(desktop.detailPage, true, "country detail route must open the detail page state");
  assert.equal(desktop.tabs.length, 8, "country detail must render eight tabs");
  assert.equal(desktop.tabs[0], "变体", "country detail tab localization must be loaded");
  assert.deepEqual(desktop.tabs, ["变体", "社会", "地区", "科技", "法律", "外交", "利益集团", "风味"], "country detail tabs must use the approved order");
  assert.equal(desktop.selected, "variants", "country detail must default to variants");
  assert.equal(desktop.panel, "variants", "default country detail panel must be variants");
  for (const label of ["国家类型", "国家位阶", "首都", "主流文化", "宗教", "标准色"]) assert.match(desktop.overview, new RegExp(label), `overview must show ${label}`);
  assert.doesNotMatch(desktop.overview, /部队颜色|开局州数/, "overview must not show excluded fields");

  await page.click("[data-country-detail-tab='society']");
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal(await page.evaluate(() => window.eval("state.countryDetailTab")), "society", "society tab selection must update state");
  assert.equal(await page.evaluate(() => location.hash.includes("tab=society")), true, "society tab selection must update the route");
  assert.equal(await page.evaluate(() => document.querySelector("[data-country-detail-panel]")?.dataset.countryDetailPanel), "society");

  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/CHI?tab=regions`);
  const restored = await page.evaluate(() => ({ tab: window.eval("state.countryDetailTab"), panel: document.querySelector("[data-country-detail-panel]")?.dataset.countryDetailPanel || "" }));
  assert.equal(restored.tab, "regions", "country tab query must restore state");
  assert.equal(restored.panel, "regions", "country tab query must restore the panel");
  assert.equal(await page.evaluate(() => document.querySelector("[data-country-detail-tab='regions']")?.getAttribute("aria-selected")), "true");

  await page.setViewport({ width: 442, height: 844 });
  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/CHI?tab=society`);
  assert.equal(await page.evaluate(() => window.eval("state.countryDetailTab")), "society", "mobile country detail must restore its tab");
  const mobile = await page.evaluate(() => {
    const tabs = document.querySelector(".country-detail-tabs");
    return {
      overflowX: getComputedStyle(tabs).overflowX,
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  assert.equal(mobile.overflowX, "auto", "mobile country detail tabs must scroll horizontally");
  assert.ok(mobile.scrollWidth <= mobile.viewportWidth + 1, `mobile country detail must not overflow the page: ${JSON.stringify(mobile)}`);

  page.close();
  console.log(JSON.stringify({ country_detail_tabs_browser: "ok", baseUrl }, null, 2));
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
    async setViewport(next) { await session.send("Emulation.setDeviceMetricsOverride", { width: next.width, height: next.height, deviceScaleFactor: 1, mobile: false }); },
    async goto(url) {
      const response = await session.send("Page.navigate", { url });
      if (response.error) throw new Error(`Page.navigate: ${response.error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 12000));
    },
    async evaluate(callback, ...args) {
      const expression = `(${callback})(${args.map((value) => JSON.stringify(value)).join(",")})`;
      const result = await session.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "browser evaluation failed");
      if (result.result?.result?.value === undefined) throw new Error(`browser evaluation returned no value: ${JSON.stringify(result)}`);
      return result.result.result.value;
    },
    async click(selector) { await this.evaluate((target) => { const node = document.querySelector(target); if (node) node.click(); return Boolean(node); }, selector); },
    async waitFor(predicate, description, ...args) {
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        if (await this.evaluate(predicate, ...args)) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const state = await this.evaluate(() => ({ href: location.href, hash: location.hash, view: document.body.dataset.view, classes: document.body.className, detailKind: window.eval("state.detailKind"), selectedTag: window.eval("state.selectedTag"), tabs: document.querySelectorAll("[data-country-detail-tab]").length, title: document.querySelector("#detail")?.innerText?.slice(0, 120) || "" }));
      throw new Error(`${description} timed out: ${JSON.stringify(state)}`);
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
    if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); return; }
    (events.get(message.method) || []).forEach((resolve) => resolve(message));
    events.delete(message.method);
  });
  return {
    send(method, params = {}) { const requestId = ++id; return new Promise((resolve) => { pending.set(requestId, resolve); socket.send(JSON.stringify({ id: requestId, method, params })); }); },
    next(method) { return new Promise((resolve) => { const listeners = events.get(method) || []; listeners.push(resolve); events.set(method, listeners); }); },
    close() { socket.close(); },
  };
}
