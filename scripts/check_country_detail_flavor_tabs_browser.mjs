import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:8895/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9296;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${process.env.TEMP || "."}\\vicdata-country-flavor-tabs-browser`, "about:blank"], { stdio: "ignore", windowsHide: true });

try {
  const page = await openPage();
  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/CHI?tab=flavor`);
  const journal = await page.evaluate(() => ({
    panel: document.querySelector("[data-country-detail-panel]")?.dataset.countryDetailPanel || "",
    tabs: [...document.querySelectorAll("[data-country-flavor-tab]")].map((node) => `${node.dataset.countryFlavorTab}:${node.querySelector("small")?.textContent.trim()}`),
    content: document.querySelector("[data-country-flavor-content]")?.dataset.countryFlavorContent || "",
    kinds: [...document.querySelectorAll("[data-country-content-kind]")].map((node) => node.dataset.countryContentKind),
  }));
  assert.equal(journal.panel, "flavor", "flavor tab must render");
  assert.deepEqual(journal.tabs.map((item) => item.split(":")[0]), ["journal", "event", "decision"], "flavor tabs must keep the approved order");
  assert.equal(journal.content, "journal", "flavor must default to journals");
  assert.deepEqual(journal.kinds, ["journal"], "flavor must render only the selected content category");
  assert.match(journal.tabs[0], /[1-9]/, "China must expose journal count");

  await page.click("[data-country-flavor-tab='event']");
  await new Promise((resolve) => setTimeout(resolve, 350));
  const event = await page.evaluate(() => ({ content: document.querySelector("[data-country-flavor-content]")?.dataset.countryFlavorContent || "", kinds: [...document.querySelectorAll("[data-country-content-kind]")].map((node) => node.dataset.countryContentKind), hash: location.hash }));
  assert.equal(event.content, "event", "event flavor tab must switch content");
  assert.deepEqual(event.kinds, ["event"], "event flavor tab must render only events");
  assert.match(event.hash, /flavor=event/, "event flavor tab must update the route");

  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/AFG?tab=flavor&flavor=decision`);
  const restored = await page.evaluate(() => ({ content: document.querySelector("[data-country-flavor-content]")?.dataset.countryFlavorContent || "", selected: document.querySelector("[data-country-flavor-tab][aria-selected='true']")?.dataset.countryFlavorTab || "", text: document.querySelector("[data-country-flavor-content]")?.innerText || "" }));
  assert.equal(restored.content, "decision", "flavor query must restore the selected subtab");
  assert.equal(restored.selected, "decision", "restored flavor tab must be selected");
  assert.match(restored.text, /没有符合条件的内容|没有可靠关联内容/, "empty flavor category must show its empty state");

  page.close();
  console.log(JSON.stringify({ country_detail_flavor_tabs_browser: "ok", baseUrl }, null, 2));
} finally { chrome.kill(); }

async function openPage() {
  await waitForDebugger();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable"); await session.send("Runtime.enable"); await session.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  return {
    async goto(url) { const response = await session.send("Page.navigate", { url }); if (response.error) throw new Error(response.error.message); await new Promise((resolve) => setTimeout(resolve, 5000)); },
    async evaluate(callback, ...args) { const result = await session.send("Runtime.evaluate", { expression: `(${callback})(${args.map((value) => JSON.stringify(value)).join(",")})`, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || "browser evaluation failed"); return result.result.result.value; },
    async click(selector) { await this.evaluate((target) => { document.querySelector(target)?.click(); }, selector); },
    close() { session.close(); },
  };
}
async function waitForDebugger() { const deadline = Date.now() + 10000; while (Date.now() < deadline) { try { if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error("Chrome debug endpoint timed out"); }
async function connect(url) { const socket = new WebSocket(url); const pending = new Map(); let id = 0; await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); }); socket.addEventListener("message", ({ data }) => { const message = JSON.parse(data); if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); } }); return { send(method, params = {}) { const requestId = ++id; return new Promise((resolve) => { pending.set(requestId, resolve); socket.send(JSON.stringify({ id: requestId, method, params })); }); }, close() { socket.close(); } }; }
