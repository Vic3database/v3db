import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = process.cwd();
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9262;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });
const mainServer = await startPreviewServer(path.join(root, "site"));
const vcServer = await startPreviewServer(path.join(root, "Victorian Century Database"));
const reports = [];

try {
  reports.push(await verifySite(`${mainServer.url}/index.html?version=1.13.11&lang=zh-Hans#/home`, "original"));
  reports.push(await verifySite(`${vcServer.url}/index.html?lang=zh-Hans#/home`, "vc"));
  console.log(JSON.stringify({ global_content_search_browser: "ok", reports }, null, 2));
} finally {
  chrome.kill();
  await mainServer.close();
  await vcServer.close();
}

async function verifySite(url, label) {
  const page = await openPage({ width: 1440, height: 1000 });
  try {
    await page.goto(url);
    await page.waitFor(() => document.body?.dataset?.view === "home" && Boolean(document.querySelector("#globalSearchButton")), `${label} home`);
    await page.click("#globalSearchButton");
    await page.waitFor(() => document.querySelector("#globalSearchDialog")?.hidden === false, `${label} search dialog`);
    assert.equal(await page.evaluate(() => Boolean(document.querySelector("#globalSearchDetailedToggle"))), true, `${label} must expose the detailed-search toggle`);

    await expectResult(page, "je_abolish_monarchy", "journal", "je_abolish_monarchy", label);
    await expectResult(page, "1848.1", "event", "1848.1", label);
    await expectResult(page, "revive_olympic_games_decision", "decision", "revive_olympic_games_decision", label);
    await expectResult(page, "人民之春", "event", "1848.1", label);

    await fillSearch(page, "清");
    assert.equal(await resultExists(page, "country", "CHI"), true, `${label} 清 must find CHI through 大清`);
    assert.equal(await resultExists(page, "country", "CMI"), true, `${label} 清 must continue to find CMI through 清迈`);
    const qingLabel = await page.evaluate(() => document.querySelector('[data-result-kind="country"][data-result-key="CHI"] .name')?.textContent || "");
    assert.match(qingLabel, /大清/, `${label} CHI result must expose the matched dynamic country name`);
    assert.equal(await resultCount(page, "country", "CHI"), 1, `${label} one entity must produce one row when an alias matches`);

    await fillSearch(page, "中国");
    assert.equal(await resultExists(page, "country", "CHI"), true, `${label} 中国 must continue to find CHI by its base name`);
    const chinaLabel = await page.evaluate(() => document.querySelector('[data-result-kind="country"][data-result-key="CHI"] .name')?.textContent || "");
    assert.match(chinaLabel, /中国/, `${label} a base-name query must display the base name`);
    assert.equal(await resultCount(page, "country", "CHI"), 1, `${label} a base-name query must not duplicate CHI`);

    await fillSearch(page, "埃尔萨斯‑洛林根");
    assert.equal(await resultExists(page, "stateRegion", "STATE_ALSACE_LORRAINE"), true, `${label} must find the state by its dynamic name`);
    assert.equal(await resultCount(page, "stateRegion", "STATE_ALSACE_LORRAINE"), 1, `${label} a dynamic state name must produce one row`);

    await fillSearch(page, "财团");
    assert.equal(await resultExists(page, "company", "company_basic_agriculture_1"), true, `${label} must find a company by its official dynamic type name`);
    assert.equal(await resultCount(page, "company", "company_basic_agriculture_1"), 1, `${label} a company type alias must produce one row`);

    await fillSearch(page, "building_barracks");
    assert.equal(await resultExists(page, "building", "building_barrack"), true, `${label} must find the current building through its compatibility ID`);
    const barracksLabel = await page.evaluate(() => document.querySelector('[data-result-kind="building"][data-result-key="building_barrack"] .name')?.textContent || "");
    assert.doesNotMatch(barracksLabel, /building_barracks/, `${label} must not display a compatibility ID as the title`);
    assert.equal(await resultCount(page, "building", "building_barrack"), 1, `${label} a compatibility ID must produce one row`);

    await fillSearch(page, "german_unification");
    const compactRowLayout = await page.evaluate(() => Array.from(document.querySelectorAll(".global-result-row--compact")).slice(0, 12).map((row) => {
      const content = row.querySelector(".global-search-result-content");
      const rowRect = row.getBoundingClientRect();
      const contentRect = content?.getBoundingClientRect();
      return {
        key: row.dataset.resultKey || "",
        rowHeight: Number(rowRect.height.toFixed(2)),
        contentHeight: Number((contentRect?.height || 0).toFixed(2)),
        overflowTop: Number(Math.max(0, rowRect.top - (contentRect?.top || rowRect.top)).toFixed(2)),
        overflowBottom: Number(Math.max(0, (contentRect?.bottom || rowRect.bottom) - rowRect.bottom).toFixed(2)),
      };
    }));
    assert.ok(compactRowLayout.length >= 5, `${label} layout query must return multiple compact content rows`);
    assert.deepEqual(
      compactRowLayout.filter((row) => row.overflowTop > 0.5 || row.overflowBottom > 0.5),
      [],
      `${label} compact content rows must contain both text lines`,
    );

    await fillSearch(page, "abolishing_monarchy_var");
    assert.equal(await resultExists(page, "journal", "je_abolish_monarchy"), false, `${label} default search must exclude raw script text`);
    await page.click("#globalSearchDetailedToggle");
    await page.waitFor(() => Boolean(document.querySelector('[data-result-kind="journal"][data-result-key="je_abolish_monarchy"]')), `${label} detailed raw-script match`);
    const excerpt = await page.evaluate(() => document.querySelector('[data-result-kind="journal"][data-result-key="je_abolish_monarchy"] .global-search-match-excerpt')?.textContent || "");
    assert.match(excerpt, /abolishing_monarchy_var/i, `${label} detailed match must show an excerpt`);

    for (const [kind, key] of [["journal", "je_abolish_monarchy"], ["event", "1848.1"], ["decision", "revive_olympic_games_decision"]]) {
      await fillSearch(page, key);
      await page.click(`[data-result-kind="${kind}"][data-result-key="${key}"]`);
      await page.waitFor((expected) => location.hash === expected, `${label} ${kind} navigation`, `#/${kind}/${encodeURIComponent(key)}`);
      await page.click("#globalSearchButton");
      await page.waitFor(() => document.querySelector("#globalSearchDialog")?.hidden === false, `${label} reopened search dialog`);
    }
    return {
      label,
      verified: ["default-fields", "group", "entity-aliases", "alias-deduplication", "compact-row-layout", "detail-isolation", "excerpt", "navigation"],
      compactRowSample: compactRowLayout[0],
    };
  } finally {
    page.close();
  }
}

async function expectResult(page, query, kind, key, label) {
  await fillSearch(page, query);
  assert.equal(await resultExists(page, kind, key), true, `${label} query ${query} must find ${kind}:${key}`);
}

async function fillSearch(page, query) {
  await page.evaluate((value) => {
    const input = document.querySelector("#globalSearchDialogInput");
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, query);
  await new Promise((resolve) => setTimeout(resolve, 80));
}

function resultExists(page, kind, key) {
  return page.evaluate((resultKind, resultKey) => Boolean(document.querySelector(`[data-result-kind="${CSS.escape(resultKind)}"][data-result-key="${CSS.escape(resultKey)}"]`)), kind, key);
}

function resultCount(page, kind, key) {
  return page.evaluate((resultKind, resultKey) => document.querySelectorAll(`[data-result-kind="${CSS.escape(resultKind)}"][data-result-key="${CSS.escape(resultKey)}"]`).length, kind, key);
}

async function openPage(viewport) {
  await waitForDebugEndpoint();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
  return {
    async goto(targetUrl) { const loaded = session.next("Page.loadEventFired"); await session.send("Page.navigate", { url: targetUrl }); await loaded; await new Promise((resolve) => setTimeout(resolve, 200)); },
    async evaluate(expression, ...args) { const result = await session.send("Runtime.evaluate", { expression: `(${expression})(${args.map((value) => JSON.stringify(value)).join(",")})`, returnByValue: true, awaitPromise: true }); if (result.result?.exceptionDetails) throw new Error(result.result.exceptionDetails.text || "browser evaluation failed"); return result.result?.result?.value; },
    async click(selector) { const clicked = await this.evaluate((targetSelector) => { const node = document.querySelector(targetSelector); if (!node) return false; node.click(); return true; }, selector); assert.equal(clicked, true, `missing clickable ${selector}`); },
    async waitFor(predicate, description, ...args) { const end = Date.now() + 45000; while (Date.now() < end) { if (await this.evaluate(predicate, ...args)) return; await new Promise((resolve) => setTimeout(resolve, 50)); } const diagnostic = await this.evaluate(() => ({ href: location.href, view: document.body?.dataset?.view, error: document.querySelector(".fatal-error")?.textContent || "" })); throw new Error(`${description} timed out: ${JSON.stringify(diagnostic)}`); },
    close() { session.close(); },
  };
}

async function waitForDebugEndpoint() { const end = Date.now() + 10000; while (Date.now() < end) { try { if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error("Chrome debug endpoint timed out"); }
async function connect(url) { const socket = new WebSocket(url); const events = new Map(); const listeners = new Map(); let id = 0; socket.addEventListener("message", (event) => { const message = JSON.parse(event.data); const waiter = events.get(message.id); if (waiter) { events.delete(message.id); waiter(message); } const queue = listeners.get(message.method); if (queue?.length) queue.shift()(message); }); await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true })); return { send(method, params = {}) { return new Promise((resolve) => { const requestId = ++id; events.set(requestId, resolve); socket.send(JSON.stringify({ id: requestId, method, params })); }); }, next(method) { return new Promise((resolve) => { if (!listeners.has(method)) listeners.set(method, []); listeners.get(method).push(resolve); }); }, close() { socket.close(); } }; }
async function startPreviewServer(siteRoot) { const resolvedRoot = path.resolve(siteRoot); const server = http.createServer((request, response) => { const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname); const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, ""); const file = path.resolve(resolvedRoot, relative); if (!file.startsWith(`${resolvedRoot}${path.sep}`) && file !== path.join(resolvedRoot, "index.html")) { response.writeHead(403).end(); return; } if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404).end(); return; } response.writeHead(200, { "content-type": contentType(file), "cache-control": "no-store" }); fs.createReadStream(file).pipe(response); }); await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) }; }
function contentType(file) { return ({ ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" })[path.extname(file).toLowerCase()] || "application/octet-stream"; }
