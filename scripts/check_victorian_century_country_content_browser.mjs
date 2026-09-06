import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const suppliedBaseUrl = process.argv[2] || "";
const root = path.join(process.cwd(), "Victorian Century Database");
const preview = suppliedBaseUrl ? null : await startPreviewServer(root);
const baseUrl = suppliedBaseUrl || `${preview.url}/index.html`;
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9252;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });

try {
  const page = await openPage({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}#/country/GBR?tab=flavor`);
  await page.waitFor(() => Boolean(document.querySelector(".country-flavor-tab-content")), "country flavor content");
  const initial = await page.evaluate(() => ({
    kinds: [...document.querySelectorAll("[data-country-content-kind]")].map((node) => node.dataset.countryContentKind),
    open: [...document.querySelectorAll("[data-country-content-kind]")].map((node) => node.open),
    ids: [...document.querySelectorAll("[data-country-content-link]")].map((node) => node.dataset.countryContentId),
    overflow: getComputedStyle(document.querySelector(".country-flavor-tab-content")).overflowY,
  }));
  assert.deepEqual(initial.kinds, ["journal"]);
  assert.deepEqual(initial.open, [true]);
  assert.ok(initial.ids.length > 0);
  assert.equal(initial.overflow, "visible");

  for (const kind of ["journal", "event", "decision"]) {
    await page.click(`[data-country-flavor-tab='${kind}']`);
    await page.waitFor((expected) => document.querySelector("[data-country-flavor-content]")?.dataset.countryFlavorContent === expected, `${kind} flavor tab`, kind);
    const id = await page.evaluate((selector) => document.querySelector(selector)?.dataset.countryContentId || "", `[data-country-content-kind='${kind}'] [data-country-content-link]`);
    assert.ok(id, `${kind} section must contain links`);
    await page.click(`[data-country-content-kind='${kind}'] [data-country-content-link]`);
    await page.waitFor((expected) => location.hash === expected, `${kind} detail route`, `#/${kind}/${encodeURIComponent(id)}`);
    await page.waitFor(() => Boolean(document.querySelector("[data-related-country='GBR']")), `${kind} related country return link`);
    await page.click("[data-related-country='GBR']");
    await page.waitFor(() => location.hash === "#/country/GBR" && Boolean(document.querySelector("[data-country-detail-tab='flavor']")), `${kind} return to country`);
    await page.click("[data-country-detail-tab='flavor']");
    await page.waitFor(() => Boolean(document.querySelector(".country-flavor-tab-content")), `${kind} reopen flavor tab`);
  }
  await page.close();

  const mobile = await openPage({ width: 442, height: 844 });
  await mobile.goto(`${baseUrl}#/country/GBR?tab=flavor`);
  await mobile.waitFor(() => Boolean(document.querySelector(".country-flavor-tab-content")), "mobile country flavor content");
  const mobileLayout = await mobile.evaluate(() => ({
    kinds: [...document.querySelectorAll("[data-country-content-kind]")].map((node) => node.dataset.countryContentKind),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    sectionOverflow: getComputedStyle(document.querySelector(".country-flavor-tab-content")).overflowY,
  }));
  assert.deepEqual(mobileLayout.kinds, ["journal"]);
  assert.ok(mobileLayout.overflow <= 1, "mobile country detail must not overflow horizontally");
  assert.equal(mobileLayout.sectionOverflow, "visible");
  await mobile.close();

  console.log(JSON.stringify({ victorian_century_country_content_browser: "ok", verified: ["sections", "collapsed", "round-trip", "mobile"] }, null, 2));
} finally {
  chrome.kill();
  await preview?.close();
}

async function openPage(viewport) {
  await waitForDebugEndpoint();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable"); await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
  return {
    async goto(url) { const loaded = session.next("Page.loadEventFired"); await session.send("Page.navigate", { url }); await loaded; await new Promise((resolve) => setTimeout(resolve, 200)); },
    async evaluate(expression, ...args) { const result = await session.send("Runtime.evaluate", { expression: `(${expression})(${args.map((value) => JSON.stringify(value)).join(",")})`, returnByValue: true, awaitPromise: true }); if (result.result?.exceptionDetails) throw new Error(result.result.exceptionDetails.text || "browser evaluation failed"); return result.result?.result?.value; },
    async click(selector) { await this.evaluate((targetSelector) => document.querySelector(targetSelector)?.click(), selector); },
    async waitFor(predicate, description, ...args) { const end = Date.now() + 30000; while (Date.now() < end) { if (await this.evaluate(predicate, ...args)) return; await new Promise((resolve) => setTimeout(resolve, 50)); } const diagnostic = await this.evaluate(() => ({ href: location.href, view: document.body?.dataset?.view, flavor: Boolean(document.querySelector(".country-flavor-content")), error: document.querySelector(".fatal-error")?.textContent || "" })); throw new Error(`${description} timed out: ${JSON.stringify(diagnostic)}`); },
    close() { session.close(); },
  };
}
async function waitForDebugEndpoint() { const end = Date.now() + 10000; while (Date.now() < end) { try { if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error("Chrome debug endpoint timed out"); }
async function connect(url) { const socket = new WebSocket(url); const events = new Map(); let id = 0; socket.addEventListener("message", (event) => { const message = JSON.parse(event.data); const waiter = events.get(message.id); if (waiter) { events.delete(message.id); waiter(message); } }); await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true })); return { send(method, params = {}) { return new Promise((resolve) => { const requestId = ++id; events.set(requestId, resolve); socket.send(JSON.stringify({ id: requestId, method, params })); }); }, next(method) { return new Promise((resolve) => { const handler = (event) => { const message = JSON.parse(event.data); if (message.method === method) { socket.removeEventListener("message", handler); resolve(message); } }; socket.addEventListener("message", handler); }); }, close() { socket.close(); } }; }
async function startPreviewServer(siteRoot) { const server = http.createServer((request, response) => { const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname); const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, ""); const file = path.resolve(siteRoot, relative); if (!file.startsWith(`${siteRoot}${path.sep}`) && file !== path.join(siteRoot, "index.html")) { response.writeHead(403).end(); return; } if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404).end(); return; } response.writeHead(200, { "content-type": contentType(file), "cache-control": "no-store" }); fs.createReadStream(file).pipe(response); }); await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) }; }
function contentType(file) { return ({ ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" })[path.extname(file).toLowerCase()] || "application/octet-stream"; }
