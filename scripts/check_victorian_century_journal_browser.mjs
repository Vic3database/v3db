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
const debugPort = 9250;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });
try {
  const page = await openPage({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}#/journal`);
  await page.waitFor(() => document.body.dataset.view === "journal" && document.querySelectorAll("[data-journal-id]").length === 858, "VC journal board");
  const boardLayout = await page.evaluate(() => ({
    filters: getComputedStyle(document.querySelector("#journalFilters")).display,
    results: getComputedStyle(document.querySelector(".results")).display,
    map: getComputedStyle(document.querySelector(".map-panel")).display,
    filterWidth: Math.round(document.querySelector("#journalFilters").getBoundingClientRect().width),
    resultsWidth: Math.round(document.querySelector(".results").getBoundingClientRect().width),
  }));
  assert.equal(boardLayout.filters, "block", "journal filters must be visible in the board layout");
  assert.notEqual(boardLayout.results, "none", "journal results must be visible in the board layout");
  assert.equal(boardLayout.map, "none", "journal board must hide the map panel");
  assert.ok(boardLayout.filterWidth > 200 && boardLayout.resultsWidth > 300, "journal board columns must have usable widths");
  assert.equal(await page.evaluate(() => document.querySelectorAll("[data-journal-source-filter]").length), 2, "journal source filters");
  assert.equal(await page.evaluate(() => document.querySelectorAll("[data-journal-change-filter]").length), 2, "journal change filters");
  assert.ok(await page.evaluate(() => document.querySelectorAll("[data-journal-group-target]").length > 0), "journal group navigation");
  const commercialInterests = await page.evaluate(() => document.querySelector("[data-journal-group-target='je_group_commercial_interests']")?.textContent || "");
  assert.match(commercialInterests, /经济利益/, "VC journal group navigation must use shipped Chinese localization");
  const reformCard = await page.evaluate(() => document.querySelector("[data-journal-id='alexander_reform']")?.textContent || "");
  assert.match(reformCard, /（统治者头衔）（统治者名）改革/, "journal cards must replace dynamic ruler expressions");
  assert.doesNotMatch(reformCard, /GetPrimaryRoleTitle/, "journal cards must not expose dynamic script expressions");
  await page.click("[data-journal-id='alexander_reform']");
  await page.waitFor(() => Boolean(document.querySelector(".journal-detail [data-related-country='RUS']")), "journal related country");
  await page.goto(`${baseUrl}#/journal`);
  await page.waitFor(() => document.querySelectorAll("[data-journal-id]").length === 858, "journal board after country check");
  const order = await page.evaluate(() => [...document.querySelectorAll("[data-journal-id]")].slice(0, 4).map((card) => ({ id: card.dataset.journalId, group: card.dataset.journalGroup })));
  assert.ok(order.every((row) => row.group), "journal cards must expose their group");
  assert.ok(await page.evaluate(() => document.querySelectorAll(".vc-change-added").length > 0), "journal cards must expose VC additions");
  await page.click("[data-journal-change-filter='added']");
  await page.waitFor(() => document.querySelectorAll("[data-journal-id]").length > 0 && [...document.querySelectorAll("[data-journal-id]")].every((card) => card.querySelector(".vc-change-added")), "journal VC added filter");
  const selected = await page.evaluate(() => document.querySelector("[data-journal-id]")?.dataset.journalId || "");
  assert.ok(selected, "journal filter must leave cards");
  await page.click(`[data-journal-id='${selected}']`);
  await page.waitFor(() => Boolean(document.querySelector(".journal-detail")), "journal detail");
  assert.equal(await page.evaluate(() => location.hash), `#/journal/${selected}`, "journal detail route");
  const detail = await page.evaluate(() => ({ text: document.querySelector(".journal-detail")?.textContent || "", panel: getComputedStyle(document.querySelector("#detail")).display }));
  assert.match(detail.text, /显示条件|开启条件|来源文件/, "journal detail must show conditions and source");
  assert.notEqual(detail.panel, "none", "journal detail must be visible");
  await page.close();
  const mobile = await openPage({ width: 390, height: 844 });
  await mobile.goto(`${baseUrl}#/journal`);
  await mobile.waitFor(() => document.body.dataset.view === "journal" && document.querySelectorAll("[data-journal-id]").length === 858, "VC journal mobile board");
  const mobileLayout = await mobile.evaluate(() => ({ filters: getComputedStyle(document.querySelector("#journalFilters")).display, results: getComputedStyle(document.querySelector(".results")).position, detail: getComputedStyle(document.querySelector("#detail")).position, filterWidth: Math.round(document.querySelector("#journalFilters").getBoundingClientRect().width), resultsWidth: Math.round(document.querySelector(".results").getBoundingClientRect().width) }));
  assert.equal(mobileLayout.filters, "block", "journal filters must remain visible on narrow screens");
  assert.equal(mobileLayout.results, "relative", "journal results must stack on narrow screens");
  assert.equal(mobileLayout.detail, "relative", "journal detail must stack on narrow screens");
  assert.ok(mobileLayout.filterWidth > 300 && mobileLayout.resultsWidth > 300, "journal narrow columns must use the viewport width");
  await mobile.close();
  console.log(JSON.stringify({ victorian_century_journal_browser: "ok", verified: ["board", "groups", "change-filter", "detail"] }, null, 2));
} finally { chrome.kill(); await preview?.close(); }

async function openPage(viewport) {
  await waitForDebugEndpoint();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable"); await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
  return { async goto(url) { const loaded = session.next("Page.loadEventFired"); await session.send("Page.navigate", { url }); await loaded; await new Promise((resolve) => setTimeout(resolve, 200)); }, async evaluate(expression, ...args) { const result = await session.send("Runtime.evaluate", { expression: `(${expression})(${args.map((value) => JSON.stringify(value)).join(",")})`, returnByValue: true, awaitPromise: true }); if (result.result?.exceptionDetails) throw new Error(result.result.exceptionDetails.text || "browser evaluation failed"); return result.result?.result?.value; }, async click(selector) { await this.evaluate((targetSelector) => document.querySelector(targetSelector)?.click(), selector); }, async waitFor(predicate, description) { const end = Date.now() + 30000; while (Date.now() < end) { if (await session.evaluate(predicate)) return; await new Promise((resolve) => setTimeout(resolve, 50)); } const diagnostic = await this.evaluate(() => ({ href: location.href, view: document.body?.dataset?.view, cards: document.querySelectorAll("[data-journal-id]").length, error: document.querySelector(".fatal-error")?.textContent || "" })); throw new Error(`${description} timed out: ${JSON.stringify(diagnostic)}`); }, close() { session.close(); } };
}
async function waitForDebugEndpoint() { const end = Date.now() + 10000; while (Date.now() < end) { try { if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error("Chrome debug endpoint timed out"); }
async function connect(url) { const socket = new WebSocket(url); const events = new Map(); let id = 0; socket.addEventListener("message", (event) => { const message = JSON.parse(event.data); const waiter = events.get(message.id); if (waiter) { events.delete(message.id); waiter(message); } }); await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true })); return { send(method, params = {}) { return new Promise((resolve) => { const requestId = ++id; events.set(requestId, resolve); socket.send(JSON.stringify({ id: requestId, method, params })); }); }, next(method) { return new Promise((resolve) => { const handler = (event) => { const message = JSON.parse(event.data); if (message.method === method) { socket.removeEventListener("message", handler); resolve(message); } }; socket.addEventListener("message", handler); }); }, async evaluate(fn, ...args) { const result = await this.send("Runtime.evaluate", { expression: `(${fn})(${args.map((value) => JSON.stringify(value)).join(",")})`, returnByValue: true, awaitPromise: true }); if (result.result?.exceptionDetails) throw new Error(result.result.exceptionDetails.text || "browser predicate failed"); return result.result?.result?.value; }, close() { socket.close(); } }; }
async function startPreviewServer(root) { const server = http.createServer((request, response) => { const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname); const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, ""); const file = path.resolve(root, relative); if (!file.startsWith(`${root}${path.sep}`) && file !== path.join(root, "index.html")) { response.writeHead(403).end(); return; } if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404).end(); return; } response.writeHead(200, { "content-type": contentType(file), "cache-control": "no-store" }); fs.createReadStream(file).pipe(response); }); await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) }; }
function contentType(file) { return ({ ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" })[path.extname(file).toLowerCase()] || "application/octet-stream"; }
