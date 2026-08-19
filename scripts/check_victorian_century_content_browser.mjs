import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const suppliedBaseUrl = process.argv[2] || "";
const preview = suppliedBaseUrl ? null : await startPreviewServer(path.join(process.cwd(), "Victorian Century Database"));
const baseUrl = suppliedBaseUrl || `${preview.url}/index.html`;
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9248;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });
try {
  const page = await openPage({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}#\/event`);
  await page.waitFor(() => document.body.dataset.view === "event" && document.querySelectorAll("[data-event-id]").length === 2947, "VC event board");
  const acreCard = await page.evaluate(() => document.querySelector("[data-event-id='acre_dispute.1']")?.textContent || "");
  assert.match(acreCard, /阿克里纠纷/, "event cards must use embedded merged Chinese localization");
  assert.doesNotMatch(acreCard, /acre_dispute\.1\.t/, "event cards must not expose unresolved localization keys");
  const acreGroup = await page.evaluate(() => document.querySelector("[data-event-group-target='acre_dispute']")?.textContent || "");
  assert.match(acreGroup, /阿克里纠纷/, "event group navigation must use the curated Chinese group name");
  assert.doesNotMatch(acreGroup, /event-group:/, "event group navigation must not expose a localization message key");
  const dynamicTitleCard = await page.evaluate(() => document.querySelector("[data-event-id='acw_events.9']")?.textContent || "");
  assert.match(dynamicTitleCard, /星杠旗（美利坚联盟国国旗）／给我的自由/, "the Stars and Bars title must identify the Confederate flag");
  const placeholderCard = await page.evaluate(() => document.querySelector("[data-event-id='joi_flavor_ger.25']")?.textContent || "");
  assert.doesNotMatch(placeholderCard, /joi_flavor_ger\.25\.t|joi_flavor_ger\.25\.[ab]/, "empty VC placeholders must not expose unresolved localization keys");
  assert.match(placeholderCard, /未命名选项/, "empty VC options must be identified without inventing option text");
  const rulerCard = await page.evaluate(() => document.querySelector("[data-event-id='1848.1']")?.textContent || "");
  assert.match(rulerCard, /审判（统治者头衔）（统治者名）/, "event cards must replace script expressions with readable labels");
  assert.doesNotMatch(rulerCard, /GetPrimaryRoleTitle/, "event cards must not expose dynamic script expressions");
  const rulerTokenTitle = await page.evaluate(() => document.querySelector("[data-event-id='1848.1'] .dynamic-content-token")?.getAttribute("title") || "");
  assert.equal(rulerTokenTitle, "[ROOT.GetCountry.GetRuler.GetPrimaryRoleTitle]", "readable event labels must retain the original expression as a tooltip");
  await page.goto(`${baseUrl}#\/event\/acw_events.1`);
  await page.waitFor(() => Boolean(document.querySelector(".event-detail [data-related-country]")), "event related countries");
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("[data-related-country]")].map((item) => item.dataset.relatedCountry)), ["CSA", "FSA", "USA"]);
  await page.goto(`${baseUrl}#\/event\/1848.4`);
  await page.waitFor(() => Boolean(document.querySelector(".event-detail")), "generic event detail");
  assert.equal(await page.evaluate(() => document.querySelectorAll(".content-related-countries").length), 0, "generic events must not render an empty country section");
  await page.goto(`${baseUrl}#\/event`);
  await page.waitFor(() => document.body.dataset.view === "event" && document.querySelectorAll("[data-event-id]").length === 2947, "VC event board after country checks");
  await page.evaluate(() => document.querySelector("[data-event-id]")?.click());
  await page.waitFor(() => Boolean(document.querySelector(".event-detail")), "VC event detail");
  await page.goto(`${baseUrl}#\/content\/journal`);
  await page.waitFor(() => document.body.dataset.view === "journal" && document.querySelectorAll("[data-journal-id]").length === 858, "legacy journal route redirect");
  await page.goto(`${baseUrl}#\/decision`);
  await page.waitFor(() => document.body.dataset.view === "decision" && document.querySelectorAll("[data-decision-id]").length === 102, "VC decision board");
  await page.click("[data-decision-source-filter='vc']");
  await page.waitFor(() => document.querySelectorAll("[data-decision-id]").length > 0, "VC decision source filter");
  const first = await page.evaluate(() => document.querySelector("[data-decision-id]")?.dataset.decisionId || "");
  assert.ok(first, "VC event source filter must leave event cards");
  await page.click(`[data-decision-id='${first}']`);
  await page.waitFor(() => Boolean(document.querySelector(".decision-detail")), "VC decision detail");
  assert.ok(await page.evaluate(() => document.querySelectorAll(".content-source-vc").length > 0), "content detail must display VC provenance");
  await page.close();
  console.log(JSON.stringify({ victorian_century_content_browser: "ok", verified: ["journal-board", "event-board", "decision-filter", "source-filter", "detail"] }, null, 2));
} finally { chrome.kill(); await preview?.close(); }

async function openPage(viewport) {
  await waitForDebugEndpoint();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable"); await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
  return { async goto(url) { const loaded = session.next("Page.loadEventFired"); await session.send("Page.navigate", { url }); await loaded; await new Promise((resolve) => setTimeout(resolve, 200)); }, async evaluate(expression, ...args) { const result = await session.send("Runtime.evaluate", { expression: `(${expression})(${args.map((value) => JSON.stringify(value)).join(",")})`, returnByValue: true, awaitPromise: true }); if (result.result?.exceptionDetails) throw new Error(result.result.exceptionDetails.text || "browser evaluation failed"); return result.result?.result?.value; }, async click(selector) { await this.evaluate((targetSelector) => document.querySelector(targetSelector)?.click(), selector); }, async waitFor(predicate, description) { const end = Date.now() + 30000; while (Date.now() < end) { if (await session.evaluate(predicate)) return; await new Promise((resolve) => setTimeout(resolve, 50)); } const diagnostic = await this.evaluate(() => ({ href: location.href, view: document.body?.dataset?.view, cards: document.querySelectorAll("[data-event-id]").length, events: typeof events !== "undefined" ? events.length : -1, contentEvents: typeof contentEvents !== "undefined" ? contentEvents.length : -1, journalEntries: typeof journalEntries !== "undefined" ? journalEntries.length : -1, dataIndex: Boolean(window.VIC3_DATA_INDEX), chunk: Boolean(window.journalEntries?.length || window.contentEvents?.length || window.decisions?.length), error: document.querySelector(".fatal-error")?.textContent || "" })); throw new Error(`${description} timed out: ${JSON.stringify(diagnostic)}`); }, close() { session.close(); } };
}
async function waitForDebugEndpoint() { const end = Date.now() + 10000; while (Date.now() < end) { try { if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error("Chrome debug endpoint timed out"); }
async function connect(url) { const socket = new WebSocket(url); const events = new Map(); let id = 0; socket.addEventListener("message", (event) => { const message = JSON.parse(event.data); const waiter = events.get(message.id); if (waiter) { events.delete(message.id); waiter(message); } }); await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true })); return { send(method, params = {}) { return new Promise((resolve) => { const requestId = ++id; events.set(requestId, resolve); socket.send(JSON.stringify({ id: requestId, method, params })); }); }, next(method) { return new Promise((resolve) => { const handler = (event) => { const message = JSON.parse(event.data); if (message.method === method) { socket.removeEventListener("message", handler); resolve(message); } }; socket.addEventListener("message", handler); }); }, async evaluate(fn, ...args) { const result = await this.send("Runtime.evaluate", { expression: `(${fn})(${args.map((value) => JSON.stringify(value)).join(",")})`, returnByValue: true, awaitPromise: true }); if (result.result?.exceptionDetails) throw new Error(result.result.exceptionDetails.text || "browser predicate failed"); return result.result?.result?.value; }, close() { socket.close(); } }; }
async function startPreviewServer(root) { const server = http.createServer((request, response) => { const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname); const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, ""); const file = path.resolve(root, relative); if (!file.startsWith(`${root}${path.sep}`) && file !== path.join(root, "index.html")) { response.writeHead(403).end(); return; } if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404).end(); return; } response.writeHead(200, { "content-type": contentType(file), "cache-control": "no-store" }); fs.createReadStream(file).pipe(response); }); await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) }; }
function contentType(file) { return ({ ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" })[path.extname(file).toLowerCase()] || "application/octet-stream"; }
