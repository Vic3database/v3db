import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:8895/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9297;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${process.env.TEMP || "."}\\vicdata-country-starting-technology-tree-browser`, "about:blank"], { stdio: "ignore", windowsHide: true });

try {
  const page = await openPage();
  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/CHI?tab=technology`);
  const view = await page.evaluate(() => ({
    panel: document.querySelector("[data-country-detail-panel]")?.dataset.countryDetailPanel || "",
    eras: [...document.querySelectorAll(".country-starting-technology-era > h4")].map((node) => node.textContent.trim()),
    categories: [...document.querySelectorAll(".country-starting-technology-category h5")].map((node) => node.textContent.trim()),
    researched: document.querySelectorAll(".country-starting-technology-researched").length,
    unresearched: document.querySelectorAll(".country-starting-technology-unresearched").length,
    text: document.querySelector("[data-country-detail-panel]")?.innerText || "",
  }));
  assert.equal(view.panel, "technology", "technology detail panel must render");
  assert.deepEqual(view.eras, ["时代 I", "时代 II"], "country detail must show technology eras I and II");
  assert.deepEqual(view.categories, ["生产", "军事", "社会", "生产", "军事", "社会"], "each era must separate production, military, and society");
  assert.ok(view.researched > 0, "researched technologies must have a distinct class");
  assert.ok(view.unresearched > 0, "unresearched technologies must have a distinct class");
  assert.match(view.text, /开局科技模板/);
  assert.match(view.text, /城镇规划/);

  page.close();
  console.log(JSON.stringify({ country_starting_technology_tree_browser: "ok", baseUrl }, null, 2));
} finally { chrome.kill(); }

async function openPage() {
  await waitForDebugger();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable"); await session.send("Runtime.enable"); await session.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  return {
    async goto(url) { const response = await session.send("Page.navigate", { url }); if (response.error) throw new Error(response.error.message); await new Promise((resolve) => setTimeout(resolve, 5000)); },
    async evaluate(callback, ...args) { const result = await session.send("Runtime.evaluate", { expression: `(${callback})(${args.map((value) => JSON.stringify(value)).join(",")})`, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || "browser evaluation failed"); return result.result.result.value; },
    close() { session.close(); },
  };
}
async function waitForDebugger() { const deadline = Date.now() + 10000; while (Date.now() < deadline) { try { if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error("Chrome debug endpoint timed out"); }
async function connect(url) { const socket = new WebSocket(url); const pending = new Map(); let id = 0; await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); }); socket.addEventListener("message", ({ data }) => { const message = JSON.parse(data); if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); } }); return { send(method, params = {}) { const requestId = ++id; return new Promise((resolve) => { pending.set(requestId, resolve); socket.send(JSON.stringify({ id: requestId, method, params })); }); }, close() { socket.close(); } }; }
