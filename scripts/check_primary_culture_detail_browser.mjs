import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const suppliedVanillaUrl = process.argv[2] || "";
const suppliedVictorianCenturyUrl = process.argv[3] || "";
const defaultVanillaSite = path.join(process.cwd(), "site");
const defaultVictorianCenturySite = [
  path.join(process.cwd(), "Victorian Century Database"),
  path.resolve(process.cwd(), "..", "..", "Victorian Century Database"),
].find((candidate) => fs.statSync(candidate, { throwIfNoEntry: false })?.isDirectory()) || path.join(process.cwd(), "Victorian Century Database");
if (!suppliedVanillaUrl && !fs.statSync(defaultVanillaSite, { throwIfNoEntry: false })?.isDirectory()) {
  throw new Error(`Vanilla site is unavailable at ${defaultVanillaSite}; pass its index.html URL as the first argument.`);
}
if (!suppliedVictorianCenturyUrl && !fs.statSync(defaultVictorianCenturySite, { throwIfNoEntry: false })?.isDirectory()) {
  throw new Error(`Victorian Century standalone site is unavailable at ${defaultVictorianCenturySite}; pass its index.html URL as the second argument.`);
}
const vanillaPreview = suppliedVanillaUrl ? null : await startPreviewServer(defaultVanillaSite);
const victorianCenturyPreview = suppliedVictorianCenturyUrl ? null : await startPreviewServer(defaultVictorianCenturySite);
const vanillaBaseUrl = suppliedVanillaUrl || vanillaPreview.url;
const victorianCenturyBaseUrl = suppliedVictorianCenturyUrl || victorianCenturyPreview.url;
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9261;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });

try {
  console.log("[primary-culture-detail] vanilla");
  await verifyFullSite("vanilla", vanillaBaseUrl, true);
  console.log("[primary-culture-detail] victorian-century");
  await verifyVictorianCenturySite(victorianCenturyBaseUrl);
  console.log(JSON.stringify({ primary_culture_detail_browser: "ok", vanilla: vanillaBaseUrl, victorian_century: victorianCenturyBaseUrl }, null, 2));
} finally {
  chrome.kill();
  await vanillaPreview?.close();
  await victorianCenturyPreview?.close();
}

async function verifyFullSite(name, baseUrl, vanilla) {
  const desktop = await openPage({ width: 1440, height: 1000 });
  try {
    console.log(`[primary-culture-detail] ${name}: French`);
    await verifyFrenchCatalan(desktop, baseUrl, vanilla, name);
    console.log(`[primary-culture-detail] ${name}: exclusive`);
    await verifyExclusiveRoutes(desktop, baseUrl, name);
    console.log(`[primary-culture-detail] ${name}: formation`);
    await verifyFormationRoutes(desktop, baseUrl, name);
    console.log(`[primary-culture-detail] ${name}: replacement`);
    await verifyReplacementRoute(desktop, baseUrl, name);
    console.log(`[primary-culture-detail] ${name}: excluded`);
    await verifyExcludedChina(desktop, baseUrl, name);
    console.log(`[primary-culture-detail] ${name}: English`);
    await verifyEnglishFrenchCatalan(desktop, baseUrl, vanilla, name);
  } finally {
    await desktop.close();
  }

  const mobile = await openPage({ width: 442, height: 844 });
  try {
    console.log(`[primary-culture-detail] ${name}: mobile`);
    await mobile.goto(routeUrl(baseUrl, "zh-Hans", "country/FRA", vanilla));
    await mobile.waitFor(() => Boolean(document.querySelector("[data-country-primary-culture-expansions]")), `${name} mobile French detail`);
    await mobile.click("[data-primary-culture-key='catalan'] summary");
    const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${name} mobile detail must not overflow horizontally: ${overflow}`);
  } finally {
    await mobile.close();
  }
}

async function verifyVictorianCenturySite(baseUrl) {
  const name = "victorian-century";
  const desktop = await openPage({ width: 1440, height: 1000 });
  try {
    console.log(`[primary-culture-detail] ${name}: French`);
    await verifyFrenchCatalan(desktop, baseUrl, false, name);
    console.log(`[primary-culture-detail] ${name}: exclusive`);
    await verifyExclusiveRoutes(desktop, baseUrl, name);
    console.log(`[primary-culture-detail] ${name}: formation`);
    await verifyFormationRoutes(desktop, baseUrl, name);
    console.log(`[primary-culture-detail] ${name}: excluded`);
    await verifyExcludedChina(desktop, baseUrl, name);
    console.log(`[primary-culture-detail] ${name}: English`);
    await verifyEnglishFrenchCatalan(desktop, baseUrl, false, name);
  } finally {
    await desktop.close();
  }
  const mobile = await openPage({ width: 442, height: 844 });
  try {
    console.log(`[primary-culture-detail] ${name}: mobile`);
    await mobile.goto(routeUrl(baseUrl, "zh-Hans", "country/FRA", false));
    await mobile.waitFor(() => Boolean(document.querySelector("[data-country-primary-culture-expansions]")), `${name} mobile French detail`);
    await mobile.click("[data-primary-culture-key='catalan'] summary");
    const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${name} mobile detail must not overflow horizontally: ${overflow}`);
  } finally {
    await mobile.close();
  }
}

async function verifyFrenchCatalan(page, baseUrl, vanilla, name) {
  await page.goto(routeUrl(baseUrl, "zh-Hans", "country/FRA", vanilla));
  await page.waitFor(() => Boolean(document.querySelector("[data-country-primary-culture-expansions]")), `${name} French expansion section`);
  await page.click("[data-primary-culture-key='catalan'] summary");
  const text = await page.text("[data-primary-culture-key='catalan']");
  const normalized = text.replace(/\s+/g, "");
  for (const expected of ["加泰罗尼亚", "条件获得", "拥有加泰罗尼亚本土", "拥有加泰罗尼亚文化人口", "已选择语言整合", "平均文化接纳度至少为第 5 级", "06_vernacular_buttons.txt:80"]) {
    assert.ok(normalized.includes(expected.replace(/\s+/g, "")), `${name} French Catalan path must contain ${expected}: ${text}`);
  }
}

async function verifyExclusiveRoutes(page, baseUrl, name) {
  await page.goto(routeUrl(baseUrl, "zh-Hans", "country/SAF"));
  await page.waitFor(() => Boolean(document.querySelector("[data-primary-culture-key='boer']")), `${name} South Africa Boer route`);
  await page.click("[data-primary-culture-key='boer'] summary");
  const boer = await page.text("[data-primary-culture-key='boer']");
  assert.ok(boer.includes("互斥路线") && boer.includes("格里夸"), `${name} Boer path must identify Griqua as an alternate route`);
  await page.click("[data-primary-culture-key='griqua'] summary");
  const griqua = await page.text("[data-primary-culture-key='griqua']");
  assert.ok(griqua.includes("互斥路线") && griqua.includes("布尔"), `${name} Griqua path must identify Boer as an alternate route`);

  await page.goto(routeUrl(baseUrl, "zh-Hans", "country/AFG"));
  await page.waitFor(() => Boolean(document.querySelector("[data-primary-culture-key='kho']")), `${name} Afghanistan routes`);
  await page.click("[data-primary-culture-key='kho'] summary");
  const kho = await page.text("[data-primary-culture-key='kho']");
  const normalizedKho = kho.replace(/\s+/g, "");
  assert.ok(normalizedKho.includes("进行阿富汗统一日志") && normalizedKho.includes("(KAF)"), `${name} Khowar route must retain journal and KAF origin conditions: ${kho}`);

  await page.click("[data-primary-culture-key='uzbek'] summary");
  for (const [origin, alternatives] of [["KUN", ["土库曼", "吉德拉尔"]], ["MAI", ["吉德拉尔"]]]) {
    const selector = `[data-primary-culture-key='uzbek'] [data-primary-culture-route-origin='${origin}']`;
    await page.waitFor((targetSelector) => Boolean(document.querySelector(targetSelector)), `${name} Uzbek ${origin} route`, selector);
    const text = (await page.text(selector)).replace(/\s+/g, "");
    for (const alternative of alternatives) {
      assert.ok(text.includes(alternative), `${name} Uzbek ${origin} route must show the ${alternative} alternative route: ${text}`);
    }
  }
}

async function verifyFormationRoutes(page, baseUrl, name) {
  for (const [tag, culture, originTag] of [["GCO", "platinean", "PLT"], ["PLT", "guarani", "PRG"]]) {
    await page.goto(routeUrl(baseUrl, "zh-Hans", `country/${tag}`));
    await page.waitFor((key) => Boolean(document.querySelector(`[data-primary-culture-key='${key}']`)), `${name} ${tag} ${culture} route`, culture);
    await page.click(`[data-primary-culture-key='${culture}'] summary`);
    const text = await page.text(`[data-primary-culture-key='${culture}']`);
    assert.ok(text.replace(/\s+/g, "").includes(`(${originTag})`), `${name} ${tag} ${culture} route must retain the source origin tag: ${text}`);
  }
}

async function verifyReplacementRoute(page, baseUrl, name) {
  await page.goto(routeUrl(baseUrl, "zh-Hans", "country/ARG"));
  await page.waitFor(() => Boolean(document.querySelector("[data-primary-culture-key='argentine']")), `${name} Argentina replacement route`);
  await page.click("[data-primary-culture-key='argentine'] summary");
  const text = await page.text("[data-primary-culture-key='argentine']");
  const normalized = text.replace(/\s+/g, "");
  for (const expected of ["替换", "加入", "移除", "culture_south_america.1", "culture_south_america.txt:4"]) {
    assert.ok(normalized.includes(expected), `${name} Argentina replacement route must contain ${expected}: ${text}`);
  }
}

async function verifyExcludedChina(page, baseUrl, name) {
  await page.goto(routeUrl(baseUrl, "zh-Hans", "country/CHI"));
  await page.waitFor(() => Boolean(document.querySelector(".detail h2")), `${name} China detail`);
  assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-country-primary-culture-expansions]"))), false, `${name} China must not expose the unassigned Boxer condition`);
}

async function verifyEnglishFrenchCatalan(page, baseUrl, vanilla, name) {
  await page.goto(routeUrl(baseUrl, "en", "country/FRA", vanilla));
  await page.waitFor(() => Boolean(document.querySelector("[data-primary-culture-key='catalan']")), `${name} English French route`);
  await page.click("[data-primary-culture-key='catalan'] summary");
  const text = await page.text("[data-primary-culture-key='catalan']");
  const normalized = text.replace(/\s+/g, "");
  for (const expected of ["Catalan", "Conditional gain", "Has Catalan homelands", "Has selected linguistic integration"]) {
    assert.ok(normalized.includes(expected.replace(/\s+/g, "")), `${name} English Catalan path must contain ${expected}: ${text}`);
  }
}

function routeUrl(baseUrl, locale, route, vanilla = false) {
  const url = new URL(baseUrl);
  url.searchParams.set("lang", locale);
  if (vanilla) url.searchParams.set("version", "1.13.11");
  url.hash = `#/${route}`;
  return url.href;
}

async function openPage(viewport) {
  await waitForDebugEndpoint();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 600 });
  return {
    async goto(url) { const loaded = session.next("Page.loadEventFired"); const hash = session.next("Page.navigatedWithinDocument"); await session.send("Page.navigate", { url }); await Promise.race([loaded, hash]); await new Promise((resolve) => setTimeout(resolve, 200)); },
    async evaluate(expression, ...args) { const result = await session.send("Runtime.evaluate", { expression: `(${expression})(${args.map((value) => JSON.stringify(value)).join(",")})`, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "browser evaluation failed"); return result.result.value; },
    async text(selector) { return this.evaluate((targetSelector) => document.querySelector(targetSelector)?.innerText?.replace(/\s+/g, " ").trim() || "", selector); },
    async click(selector) { await this.evaluate((targetSelector) => document.querySelector(targetSelector)?.click(), selector); },
    async waitFor(predicate, description, ...args) { const end = Date.now() + 30000; while (Date.now() < end) { if (await this.evaluate(predicate, ...args)) return; await new Promise((resolve) => setTimeout(resolve, 50)); } const diagnostic = await this.evaluate(() => ({ href: location.href, view: document.body?.dataset?.view, error: document.querySelector(".fatal-error")?.textContent || "", detail: document.querySelector(".detail")?.innerText?.slice(0, 400) || "" })); throw new Error(`${description} timed out: ${JSON.stringify(diagnostic)}`); },
    close() { session.close(); },
  };
}

async function waitForDebugEndpoint() { const end = Date.now() + 10000; while (Date.now() < end) { try { if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error("Chrome debug endpoint timed out"); }

async function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const events = new Map();
  let id = 0;
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  socket.addEventListener("message", ({ data }) => { const message = JSON.parse(data); if (message.id) { const resolve = pending.get(message.id); pending.delete(message.id); resolve?.(message); return; } const waiters = events.get(message.method) || []; events.delete(message.method); waiters.forEach((resolve) => resolve(message)); });
  return { send(method, params = {}) { const requestId = ++id; const response = new Promise((resolve) => pending.set(requestId, resolve)); socket.send(JSON.stringify({ id: requestId, method, params })); return response.then((message) => { if (message.error) throw new Error(message.error.message); return message.result || {}; }); }, next(method) { return new Promise((resolve) => events.set(method, [...(events.get(method) || []), resolve])); }, close() { socket.close(); } };
}

async function startPreviewServer(root) {
  const server = http.createServer((request, response) => { const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, ""); const file = path.resolve(root, relative); if (!file.startsWith(`${root}${path.sep}`) && file !== path.join(root, "index.html")) { response.writeHead(403).end(); return; } if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404).end(); return; } response.writeHead(200, { "content-type": contentType(file), "cache-control": "no-store" }); fs.createReadStream(file).pipe(response); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { url: `http://127.0.0.1:${server.address().port}/index.html`, close: () => new Promise((resolve) => server.close(resolve)) };
}

function contentType(file) { return ({ ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" })[path.extname(file).toLowerCase()] || "application/octet-stream"; }
