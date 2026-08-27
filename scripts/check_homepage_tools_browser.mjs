import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const vanillaUrl = process.argv[2] || "http://127.0.0.1:8878/index.html";
const vcUrl = process.argv[3] || "http://127.0.0.1:8881/index.html";
const siteVcUrl = process.argv[4] || "http://127.0.0.1:8882/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9278;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });

try {
  await verifyHomepageTools("vanilla", vanillaUrl, true);
  await verifyHomepageTools("victorian-century", vcUrl, false);
  await verifyHomepageTools("site-vc", siteVcUrl, false);
  console.log(JSON.stringify({ homepage_tools_browser: "ok", vanilla: vanillaUrl, victorian_century: vcUrl, site_vc: siteVcUrl }, null, 2));
} finally {
  chrome.kill();
}

async function verifyHomepageTools(name, baseUrl, legacyCoverage) {
  const page = await openPage({ width: 1600, height: 900 });
  try {
    await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/home`);
    await page.waitFor(() => document.querySelectorAll("[data-home-tool]").length === 3, `${name} homepage tools`);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("[data-home-tool]")].map((node) => node.dataset.homeTool)), ["cultureIncorporation", "companySolver", "companyComposer"]);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("[data-home-tool]")].map((node) => node.dataset.homeToolRoute)), ["/culture/incorporation", "/company/solver", "/company/composer"]);
    assert.equal(await page.evaluate(() => document.querySelectorAll(".home-tool-icon[src*='lucide/icons/']").length), 3);
    assert.equal(await page.evaluate(() => Boolean(document.querySelector(".home-tools").compareDocumentPosition(document.querySelector(".home-category-list")) & Node.DOCUMENT_POSITION_FOLLOWING)), true);

    await page.click('[data-home-tool="cultureIncorporation"]');
    await page.waitFor(() => location.hash === "#/culture/incorporation" && Boolean(document.querySelector("[data-culture-incorporation-calculator]")), "calculator direct route");
    await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/home`);
    await page.waitFor(() => document.querySelectorAll("[data-home-tool]").length === 3, "homepage tools after calculator");
    await page.click('[data-home-tool="companySolver"]');
    await page.waitFor(() => location.hash === "#/company/solver" && document.body.dataset.companySolver === "true", "solver direct route");
    await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/home`);
    await page.waitFor(() => document.querySelectorAll("[data-home-tool]").length === 3, "homepage tools after solver");
    await page.click('[data-home-tool="companyComposer"]');
    await page.waitFor(() => location.hash === "#/company/composer" && document.body.dataset.companyComposer === "true", "composer direct route");

    if (legacyCoverage) {
      await page.goto(`${baseUrl}?version=1.13.9&lang=zh-Hans#/home`);
      await page.waitFor(() => document.querySelectorAll("[data-home-tool]").length === 1, "legacy homepage tools");
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("[data-home-tool]")].map((node) => node.dataset.homeTool)), ["cultureIncorporation"]);
    }
  } finally {
    await page.close();
  }

  if (!legacyCoverage) return;
  const mobile = await openPage({ width: 442, height: 844 });
  try {
    await mobile.goto(`${baseUrl}?version=1.13.11&lang=en#/home`);
    await mobile.waitFor(() => document.querySelectorAll("[data-home-tool]").length === 3, "mobile homepage tools");
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1));
    assert.equal(await mobile.evaluate(() => getComputedStyle(document.querySelector(".home-tool-grid")).gridTemplateColumns.split(" ").length), 1);
  } finally {
    await mobile.close();
  }
}

async function openPage(viewport) {
  await waitForDebugger();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable"); await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 600 });
  return {
    async goto(url) { const loaded = session.next("Page.loadEventFired"); const hash = session.next("Page.navigatedWithinDocument"); await session.send("Page.navigate", { url }); await Promise.race([loaded, hash]); await new Promise((resolve) => setTimeout(resolve, 400)); },
    async evaluate(callback, ...args) { const expression = `(${callback})(${args.map((value) => JSON.stringify(value)).join(",")})`; const result = await session.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "browser evaluation failed"); return result.result.value; },
    async click(selector) { await this.evaluate((targetSelector) => document.querySelector(targetSelector)?.click(), selector); },
    async waitFor(predicate, description) { const deadline = Date.now() + 20000; while (Date.now() < deadline) { if (await this.evaluate(predicate)) return; await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error(`${description} timed out`); },
    close() { session.close(); },
  };
}

async function waitForDebugger() { const deadline = Date.now() + 10000; while (Date.now() < deadline) { try { if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error("Chrome debug endpoint timed out"); }
async function connect(url) { const socket = new WebSocket(url); const pending = new Map(); const events = new Map(); let id = 0; await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); }); socket.addEventListener("message", ({ data }) => { const message = JSON.parse(data); if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); } else { (events.get(message.method) || []).forEach((resolve) => resolve(message)); events.delete(message.method); } }); return { send(method, params = {}) { const requestId = ++id; return new Promise((resolve) => { pending.set(requestId, resolve); socket.send(JSON.stringify({ id: requestId, method, params })); }).then((message) => { if (message.error) throw new Error(`${method}: ${message.error.message}`); return message.result || {}; }); }, next(method) { return new Promise((resolve) => events.set(method, [...(events.get(method) || []), resolve])); }, close() { socket.close(); } }; }
