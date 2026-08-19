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
const debugPort = 9251;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });
try {
  const page = await openPage({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}#/decision`);
  await page.waitFor(() => document.body.dataset.view === "decision" && document.querySelectorAll("[data-decision-id]").length === 102, "VC decision board");
  const boardLayout = await page.evaluate(() => ({
    filters: getComputedStyle(document.querySelector("#decisionFilters")).display,
    results: getComputedStyle(document.querySelector(".results")).display,
    map: getComputedStyle(document.querySelector(".map-panel")).display,
    filterWidth: Math.round(document.querySelector("#decisionFilters").getBoundingClientRect().width),
    resultsWidth: Math.round(document.querySelector(".results").getBoundingClientRect().width),
  }));
  assert.equal(boardLayout.filters, "block", "decision filters must be visible in the board layout");
  assert.notEqual(boardLayout.results, "none", "decision results must be visible in the board layout");
  assert.equal(boardLayout.map, "none", "decision board must hide the map panel");
  assert.ok(boardLayout.filterWidth > 200 && boardLayout.resultsWidth > 300, "decision board columns must have usable widths");
  assert.equal(await page.evaluate(() => document.querySelectorAll("[data-decision-source-filter]").length), 2, "decision source filters");
  assert.ok(await page.evaluate(() => document.querySelectorAll("[data-decision-group-target]").length > 0), "decision group navigation");
  const canadaAustraliaGroup = await page.evaluate(() => document.querySelector("[data-decision-group-target='common/decisions/canada_australia.txt']")?.textContent || "");
  assert.match(canadaAustraliaGroup, /加拿大与澳大利亚/, "decision groups must have curated Chinese names");
  const australia = await page.evaluate(() => document.querySelector("[data-decision-id='australia_unite_aus']")?.textContent || "");
  assert.match(australia, /澳大利亚联邦/, "VC decisions must reuse the official vanilla localization");
  await page.click("[data-decision-id='decision_demand_hungary_revoke_laws']");
  await page.waitFor(() => Boolean(document.querySelector(".decision-detail [data-related-country='AUS']")), "decision related country");
  assert.equal(await page.evaluate(() => document.querySelectorAll("[data-related-country='HUN']").length), 0, "decision target countries must not be classified as the owner");
  await page.goto(`${baseUrl}#/decision`);
  await page.waitFor(() => document.querySelectorAll("[data-decision-id]").length === 102, "decision board after country check");
  await page.click("[data-decision-id='bic_end_company_rule']");
  await page.waitFor(() => Boolean(document.querySelector(".decision-detail")), "dynamic decision detail");
  const dynamicDecision = await page.evaluate(() => ({ text: document.querySelector(".decision-detail")?.textContent || "", title: document.querySelector(".decision-detail .dynamic-content-token")?.getAttribute("title") || "" }));
  assert.match(dynamicDecision.text, /（宗主国统治者头衔）/, "decision descriptions must replace dynamic ruler expressions");
  assert.equal(dynamicDecision.title, "[GetPlayer.GetTopOverlord.GetRuler.GetPrimaryRoleTitle]", "readable decision labels must retain the original expression as a tooltip");
  await page.goto(`${baseUrl}#/decision`);
  await page.waitFor(() => document.body.dataset.view === "decision" && document.querySelectorAll("[data-decision-id]").length === 102, "VC decision board after dynamic detail");
  await page.click("[data-decision-source-filter='vc']");
  await page.waitFor(() => document.querySelectorAll("[data-decision-id]").length > 0 && [...document.querySelectorAll("[data-decision-id]")].every((card) => card.querySelector(".content-source-vc")), "decision source filter");
  const selected = await page.evaluate(() => document.querySelector("[data-decision-id]")?.dataset.decisionId || "");
  assert.ok(selected, "decision source filter must leave cards");
  await page.click(`[data-decision-id='${selected}']`);
  await page.waitFor(() => Boolean(document.querySelector(".decision-detail")), "decision detail");
  assert.equal(await page.evaluate(() => location.hash), `#/decision/${selected}`, "decision detail route");
  const detail = await page.evaluate(() => ({ text: document.querySelector(".decision-detail")?.textContent || "", panel: getComputedStyle(document.querySelector("#detail")).display }));
  assert.match(detail.text, /显示条件|执行条件|执行效果|来源文件/, "decision detail must show conditions, effects, and source");
  assert.notEqual(detail.panel, "none", "decision detail must be visible");
  await page.close();
  const mobile = await openPage({ width: 390, height: 844 });
  await mobile.goto(`${baseUrl}#/decision`);
  await mobile.waitFor(() => document.body.dataset.view === "decision" && document.querySelectorAll("[data-decision-id]").length === 102, "VC decision mobile board");
  const mobileLayout = await mobile.evaluate(() => ({ filters: getComputedStyle(document.querySelector("#decisionFilters")).display, results: getComputedStyle(document.querySelector(".results")).position, detail: getComputedStyle(document.querySelector("#detail")).position, filterWidth: Math.round(document.querySelector("#decisionFilters").getBoundingClientRect().width), resultsWidth: Math.round(document.querySelector(".results").getBoundingClientRect().width) }));
  assert.equal(mobileLayout.filters, "block", "decision filters must remain visible on narrow screens");
  assert.equal(mobileLayout.results, "relative", "decision results must stack on narrow screens");
  assert.equal(mobileLayout.detail, "relative", "decision detail must stack on narrow screens");
  assert.ok(mobileLayout.filterWidth > 300 && mobileLayout.resultsWidth > 300, "decision narrow columns must use the viewport width");
  await mobile.close();
  console.log(JSON.stringify({ victorian_century_decision_browser: "ok", verified: ["board", "groups", "source-filter", "detail"] }, null, 2));
} finally { chrome.kill(); await preview?.close(); }

async function openPage(viewport) {
  await waitForDebugEndpoint();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable"); await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
  return { async goto(url) { const loaded = session.next("Page.loadEventFired"); await session.send("Page.navigate", { url }); await loaded; await new Promise((resolve) => setTimeout(resolve, 200)); }, async evaluate(expression, ...args) { const result = await session.send("Runtime.evaluate", { expression: `(${expression})(${args.map((value) => JSON.stringify(value)).join(",")})`, returnByValue: true, awaitPromise: true }); if (result.result?.exceptionDetails) throw new Error(result.result.exceptionDetails.text || "browser evaluation failed"); return result.result?.result?.value; }, async click(selector) { await this.evaluate((targetSelector) => document.querySelector(targetSelector)?.click(), selector); }, async waitFor(predicate, description) { const end = Date.now() + 30000; while (Date.now() < end) { if (await this.evaluate(predicate)) return; await new Promise((resolve) => setTimeout(resolve, 50)); } const diagnostic = await this.evaluate(() => ({ href: location.href, view: document.body?.dataset?.view, cards: document.querySelectorAll("[data-decision-id]").length, error: document.querySelector(".fatal-error")?.textContent || "" })); throw new Error(`${description} timed out: ${JSON.stringify(diagnostic)}`); }, close() { session.close(); } };
}
async function waitForDebugEndpoint() { const end = Date.now() + 10000; while (Date.now() < end) { try { if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error("Chrome debug endpoint timed out"); }
async function connect(url) { const socket = new WebSocket(url); const events = new Map(); let id = 0; socket.addEventListener("message", (event) => { const message = JSON.parse(event.data); const waiter = events.get(message.id); if (waiter) { events.delete(message.id); waiter(message); } }); await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true })); return { send(method, params = {}) { return new Promise((resolve) => { const requestId = ++id; events.set(requestId, resolve); socket.send(JSON.stringify({ id: requestId, method, params })); }); }, next(method) { return new Promise((resolve) => { const handler = (event) => { const message = JSON.parse(event.data); if (message.method === method) { socket.removeEventListener("message", handler); resolve(message); } }; socket.addEventListener("message", handler); }); }, close() { socket.close(); } }; }
async function startPreviewServer(root) { const server = http.createServer((request, response) => { const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname); const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, ""); const file = path.resolve(root, relative); if (!file.startsWith(`${root}${path.sep}`) && file !== path.join(root, "index.html")) { response.writeHead(403).end(); return; } if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404).end(); return; } response.writeHead(200, { "content-type": contentType(file), "cache-control": "no-store" }); fs.createReadStream(file).pipe(response); }); await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) }; }
function contentType(file) { return ({ ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" })[path.extname(file).toLowerCase()] || "application/octet-stream"; }
