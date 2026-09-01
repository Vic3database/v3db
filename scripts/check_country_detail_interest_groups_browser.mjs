import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:8895/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9294;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${process.env.TEMP || "."}\\vicdata-country-interest-groups-browser`, "about:blank"], { stdio: "ignore", windowsHide: true });

try {
  const page = await openPage({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/CHI?tab=interest-groups&ig=ig_landowners`);
  const state = await page.evaluate(() => ({
    tab: window.eval("state.countryDetailTab"),
    subtab: window.eval("state.countryDetailSubtab"),
    icons: document.querySelectorAll("[data-country-interest-group]").length,
    selected: document.querySelector("[data-country-interest-group][aria-selected='true']")?.dataset.countryInterestGroup || "",
    panel: document.querySelector("[data-country-interest-group-panel]")?.dataset.countryInterestGroupPanel || "",
    potentialOpen: document.querySelector(".country-interest-group-potential")?.open,
  }));
  assert.equal(state.tab, "interest-groups", "interest-group tab query must restore");
  assert.equal(state.subtab, "ig_landowners", "interest-group subtab query must restore");
  assert.equal(state.icons, 8, "country detail must render eight interest-group icons");
  assert.equal(state.selected, "ig_landowners", "requested interest group must be selected");
  assert.equal(state.panel, "ig_landowners", "requested interest group panel must be shown");
  assert.equal(state.potentialOpen, false, "potential flavor details must start collapsed");
  assert.match(await page.evaluate(() => document.querySelector(".country-interest-group-panel")?.innerText || ""), /开局生效/, "selected interest-group panel must show starting flavor status");
  const chinaStatusLabels = await page.evaluate(() => [...document.querySelectorAll(".country-interest-group-status-badge[data-interest-group-status='flavor']")].map((node) => node.closest("[data-country-interest-group]")?.dataset.countryInterestGroup || ""));
  assert.equal(chinaStatusLabels.includes("ig_petty_bourgeoisie"), false, "China petty bourgeoisie must not receive a flavor label");
  assert.equal(chinaStatusLabels.includes("ig_rural_folk"), false, "China rural folk must not receive a flavor label");
  assert.equal(chinaStatusLabels.includes("ig_trade_unions"), false, "China trade unions must not receive a flavor label");
  assert.ok(chinaStatusLabels.includes("ig_landowners"), "China scholar officials must retain a flavor label");

  await page.click(".country-interest-group-potential > summary");
  const chinaPotential = await page.evaluate(() => document.querySelector(".country-interest-group-potential")?.innerText || "");
  assert.doesNotMatch(chinaPotential, /大名|奥地利贵族/, "China must not show unrelated country-specific potential flavors");

  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/JAP?tab=interest-groups&ig=ig_landowners`);
  await page.click(".country-interest-group-potential > summary");
  const japanPotential = await page.evaluate(() => document.querySelector(".country-interest-group-potential")?.innerText || "");
  assert.match(japanPotential, /大名/, "Japan must show its country-specific potential flavor");

  await page.click("[data-country-interest-group='ig_devout']");
  await new Promise((resolve) => setTimeout(resolve, 500));
  const switched = await page.evaluate(() => ({ subtab: window.eval("state.countryDetailSubtab"), hash: location.hash, panel: document.querySelector("[data-country-interest-group-panel]")?.dataset.countryInterestGroupPanel || "" }));
  assert.equal(switched.subtab, "ig_devout", "interest-group click must update the selected subtab");
  assert.match(switched.hash, /ig=ig_devout/, "interest-group click must update the route");
  assert.equal(switched.panel, "ig_devout", "interest-group click must replace the panel");

  await page.setViewport({ width: 442, height: 844 });
  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/CHI?tab=interest-groups&ig=ig_landowners`);
  const mobile = await page.evaluate(() => ({
    cols: getComputedStyle(document.querySelector(".country-interest-group-tabs")).gridTemplateColumns,
    scrollWidth: document.documentElement.scrollWidth,
    width: document.documentElement.clientWidth,
  }));
  assert.equal(mobile.cols.trim().split(/\s+/).length, 4, "mobile interest-group icons must use four columns");
  assert.ok(mobile.scrollWidth <= mobile.width + 1, `mobile interest-group panel must not overflow: ${JSON.stringify(mobile)}`);
  page.close();
  console.log(JSON.stringify({ country_detail_interest_groups_browser: "ok", baseUrl }, null, 2));
} finally { chrome.kill(); }

async function openPage(viewport) {
  await waitForDebugger();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable"); await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
  return {
    async setViewport(next) { await session.send("Emulation.setDeviceMetricsOverride", { width: next.width, height: next.height, deviceScaleFactor: 1, mobile: false }); },
    async goto(url) { const response = await session.send("Page.navigate", { url }); if (response.error) throw new Error(`Page.navigate: ${response.error.message}`); await new Promise((resolve) => setTimeout(resolve, 4000)); },
    async evaluate(callback, ...args) { const expression = `(${callback})(${args.map((value) => JSON.stringify(value)).join(",")})`; const result = await session.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "browser evaluation failed"); return result.result.result?.value; },
    async click(selector) { await this.evaluate((target) => { const node = document.querySelector(target); if (node) node.click(); return Boolean(node); }, selector); },
    close() { session.close(); },
  };
}

async function waitForDebugger() { const deadline = Date.now() + 10000; while (Date.now() < deadline) { try { if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error("Chrome debug endpoint timed out"); }
async function connect(url) { const socket = new WebSocket(url); const pending = new Map(); let id = 0; await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); }); socket.addEventListener("message", ({ data }) => { const message = JSON.parse(data); if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); } }); return { send(method, params = {}) { const requestId = ++id; return new Promise((resolve) => { pending.set(requestId, resolve); socket.send(JSON.stringify({ id: requestId, method, params })); }); }, close() { socket.close(); } }; }
