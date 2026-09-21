import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:8895/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9298;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });
try {
  await waitForDebugger();
  const page = await openPage({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}?lang=zh-Hans#/country/GBR?tab=resources`);
  await page.waitFor(() => Boolean(document.querySelector("[data-country-detail-tab='resources']")), "VC resources tab");
  const tabs = await page.evaluate(() => [...document.querySelectorAll("[data-country-detail-tab]")].map((node) => node.dataset.countryDetailTab));
  assert.ok(tabs.includes("resources"));
  await page.waitFor(() => Boolean(document.querySelector("[data-country-detail-panel='resources']")), "VC resources panel");
  const result = await page.evaluate(() => ({
    panel: document.querySelector("[data-country-detail-panel]")?.dataset.countryDetailPanel || "",
    text: document.querySelector("[data-country-detail-panel]")?.textContent || "",
    icons: document.querySelectorAll("[data-country-detail-panel='resources'] .state-statistics-resource-icon").length,
  }));
  assert.equal(result.panel, "resources");
  assert.match(result.text, /开局人口|Starting population/);
  assert.match(result.text, /可耕土地|可耕地|Arable land/);
  assert.ok(result.icons > 0);
  page.close();
  console.log(JSON.stringify({ victorian_century_country_resources_browser: "ok" }, null, 2));
} finally { chrome.kill(); }

async function openPage(viewport) {
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map(); let id = 0;
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  socket.addEventListener("message", ({ data }) => { const message = JSON.parse(data); if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); } });
  const send = (method, params = {}) => { const requestId = ++id; return new Promise((resolve) => { pending.set(requestId, resolve); socket.send(JSON.stringify({ id: requestId, method, params })); }); };
  await send("Page.enable"); await send("Runtime.enable"); await send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
  return {
    async goto(url) { await send("Page.navigate", { url }); await new Promise((resolve) => setTimeout(resolve, 5000)); },
    async evaluate(callback) { const result = await send("Runtime.evaluate", { expression: `(${callback})()`, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "browser evaluation failed"); return result.result?.result?.value; },
    async click(selector) { await this.evaluate((value) => document.querySelector(value)?.click(), selector); },
    async waitFor(predicate, description) { const deadline = Date.now() + 30000; while (Date.now() < deadline) { if (await this.evaluate(predicate)) return; await new Promise((resolve) => setTimeout(resolve, 100)); } throw new Error(`${description} timed out`); },
    close() { socket.close(); },
  };
}
async function waitForDebugger() { const deadline = Date.now() + 10000; while (Date.now() < deadline) { try { if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error("Chrome debug endpoint timed out"); }
