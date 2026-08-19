import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const suppliedBaseUrl = process.argv[2] || "";
const siteRoot = path.join(process.cwd(), "site");
const preview = suppliedBaseUrl ? null : await startPreviewServer(siteRoot);
const baseUrl = suppliedBaseUrl || `${preview.url}/index.html?version=1.13.11`;
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9253;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });

try {
  const page = await openPage({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}#/country/AUS`);
  await page.waitFor(() => Boolean(document.querySelector(".country-flavor-content")), "原版国家风味内容");
  const initial = await page.evaluate(() => ({
    kinds: [...document.querySelectorAll("[data-country-content-kind]")].map((node) => node.dataset.countryContentKind),
    open: [...document.querySelectorAll("[data-country-content-kind]")].map((node) => node.open),
    counts: [...document.querySelectorAll("[data-country-content-kind]")].map((node) => node.querySelectorAll("[data-country-content-link]").length),
    sourceLabels: [...document.querySelectorAll("[data-country-content-link] .content-source-vc")].length,
    overflow: getComputedStyle(document.querySelector(".country-flavor-content")).overflowY,
  }));
  assert.deepEqual(initial.kinds, ["journal", "event", "decision"]);
  assert.deepEqual(initial.open, [false, false, false]);
  assert.ok(initial.counts.every((count) => count > 0), `奥地利三类关联应均有内容：${initial.counts.join(",")}`);
  assert.equal(initial.sourceLabels, 0, "原版国家关联不得出现 VC 来源标记");
  assert.equal(initial.overflow, "visible");

  for (const kind of ["journal", "event", "decision"]) {
    await page.click(`[data-country-content-kind='${kind}'] summary`);
    const id = await page.evaluate((selector) => document.querySelector(selector)?.dataset.countryContentId || "", `[data-country-content-kind='${kind}'] [data-country-content-link]`);
    assert.ok(id, `${kind} 分区应包含链接`);
    await page.click(`[data-country-content-kind='${kind}'] [data-country-content-link]`);
    await page.waitFor((expected) => location.hash === expected, `${kind} 原版详情路由`, `#/${kind}/${encodeURIComponent(id)}`);
    await page.waitFor(() => Boolean(document.querySelector("[data-related-country='AUS']")), `${kind} 返回奥地利的链接`);
    const sourceKinds = await page.evaluate(() => [...document.querySelectorAll(".content-source")].map((node) => node.className));
    assert.ok(sourceKinds.every((value) => value.includes("content-source-vanilla")), `${kind} 详情来源应为原版`);
    await page.click("[data-related-country='AUS']");
    await page.waitFor(() => location.hash === "#/country/AUS" && Boolean(document.querySelector(".country-flavor-content")), `${kind} 返回国家详情`);
  }
  await page.close();

  const mobile = await openPage({ width: 442, height: 844 });
  await mobile.goto(`${baseUrl}#/country/AUS`);
  await mobile.waitFor(() => Boolean(document.querySelector(".country-flavor-content")), "窄屏原版国家风味内容");
  const mobileLayout = await mobile.evaluate(() => ({
    kinds: [...document.querySelectorAll("[data-country-content-kind]")].map((node) => node.dataset.countryContentKind),
    horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    sectionOverflow: getComputedStyle(document.querySelector(".country-flavor-content")).overflowY,
    detailOverflow: getComputedStyle(document.querySelector("#detail")).overflowY,
  }));
  assert.deepEqual(mobileLayout.kinds, ["journal", "event", "decision"]);
  assert.ok(mobileLayout.horizontalOverflow <= 1, `窄屏不应横向溢出：${mobileLayout.horizontalOverflow}`);
  assert.equal(mobileLayout.sectionOverflow, "visible");
  assert.ok(["auto", "visible"].includes(mobileLayout.detailOverflow));
  await mobile.close();

  console.log(JSON.stringify({ vanilla_country_content_browser: "ok", version: "1.13.11", verified: ["sections", "collapsed", "round-trip", "vanilla-source", "mobile"] }, null, 2));
} finally {
  chrome.kill();
  await preview?.close();
}

async function openPage(viewport) {
  await waitForDebugEndpoint();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable");
  await session.send("Runtime.enable");
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
async function startPreviewServer(root) { const server = http.createServer((request, response) => { const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname); const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, ""); const file = path.resolve(root, relative); if (!file.startsWith(`${root}${path.sep}`) && file !== path.join(root, "index.html")) { response.writeHead(403).end(); return; } if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404).end(); return; } response.writeHead(200, { "content-type": contentType(file), "cache-control": "no-store" }); fs.createReadStream(file).pipe(response); }); await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) }; }
function contentType(file) { return ({ ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" })[path.extname(file).toLowerCase()] || "application/octet-stream"; }
