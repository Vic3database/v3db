import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9262;
const chromeProfile = fs.mkdtempSync(path.join(os.tmpdir(), "vicdata-company-solver-"));
const chrome = spawn(chromePath, ["--remote-debugging-port=" + debugPort, "--user-data-dir=" + chromeProfile, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });
const server = await startPreviewServer(path.join(root, "site"));
try {
  const reports = [];
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await openPage(viewport);
    try {
      await page.goto(server.url + "/index.html?version=1.13.11&lang=zh-Hans#/company/solver");
      await page.waitFor(() => document.body.dataset.view === "company" && document.querySelectorAll("[data-company-solver-building]").length === 48, "solver entry");
      assert.equal(await page.evaluate(() => document.querySelector("#filterPanelTitle")?.textContent), "公司产业求解器", "solver tool should use its title in the filter panel");
      assert.equal(await page.evaluate(() => Boolean(document.querySelector("#companySolverTopbarButton"))), false, "solver must not be in topbar");
      await page.click('[data-nav-view="company"]');
      await page.waitFor(() => document.body.dataset.view === "company" && document.querySelector("#companySolverEntry:not([hidden])"), "company board solver entry");
      await page.click("[data-company-solver-entry]");
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".filters")).display), "none", "solver must hide the left filter panel");
      assert.equal(await page.evaluate(() => Boolean(document.querySelector("#companySolverDetailPane"))), true, "solver must have a separate detail pane");
      const layoutReport = await page.evaluate(() => { const list = document.querySelector(".results").getBoundingClientRect(); const detail = document.querySelector("#companySolverDetailPane").getBoundingClientRect(); const ratio = list.width / (list.width + detail.width); return { ratio, list: { left: list.left, right: list.right, width: list.width }, detail: { left: detail.left, right: detail.right, width: detail.width } }; });
      if (viewport.width > 760) assert.ok(layoutReport.ratio >= .55 && layoutReport.ratio <= .65 && layoutReport.list.right <= layoutReport.detail.left + 1, "solver list should occupy the left 60% without overlapping the detail pane: " + JSON.stringify(layoutReport));
      if (viewport.width > 760) assert.equal(await page.evaluate(() => document.querySelector(".results").getBoundingClientRect().right <= document.querySelector("#companySolverDetailPane").getBoundingClientRect().left + 1), true, "solver list and detail pane must not overlap");
      assert.equal(await page.evaluate(() => document.querySelectorAll(".company-solver-building-group h3").length), 0, "solver must not show building group headings");
      assert.equal(await page.evaluate(() => document.querySelectorAll(".company-solver-building-grid").length), 5, "solver must use five building category groups");
      assert.deepEqual(await page.evaluate(() => Array.from(document.querySelectorAll(".company-solver-building-group")).map((group) => group.querySelectorAll("[data-company-solver-building]").length)), [10, 16, 7, 10, 5]);
      assert.equal(await page.evaluate(() => Array.from(document.querySelectorAll("[data-company-solver-building]")).filter((button) => getComputedStyle(button).borderStyle !== "none").length), 0, "solver icons must not have button frames");
      assert.equal(await page.evaluate(() => Array.from(document.querySelectorAll("[data-company-solver-building]")).filter((button) => button.textContent.trim()).length), 0, "solver building buttons must not show text labels");
      assert.ok(await page.evaluate(() => { const button = document.querySelector("[data-company-solver-building]"); const icon = button?.querySelector(".resource-icon"); return button && icon && icon.getBoundingClientRect().width >= 34 && icon.getBoundingClientRect().height >= 34; }), "solver icons should be large enough");
      assert.ok(await page.evaluate(() => { const grid = document.querySelector(".company-solver-building-grid"); return grid && Number.parseFloat(getComputedStyle(grid).columnGap) >= 4 && Number.parseFloat(getComputedStyle(grid).rowGap) >= 4; }), "solver icons should have visible spacing");
      await page.click("[data-company-solver-building='building_coal_mine']");
      assert.ok(await page.evaluate(() => { const button = document.querySelector("[data-company-solver-building='building_coal_mine']"); const style = getComputedStyle(button); return button?.getAttribute("aria-pressed") === "true" && style.backgroundColor === "rgba(0, 0, 0, 0)" && style.boxShadow.includes("inset"); }), "solver selected state should match icon filters");
      await page.click("[data-company-solver-building='building_coal_mine']");
      assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-company-solver-building='building_gold_mine']"))), true);
      assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-company-solver-building='building_gold_field']"))), false);
      for (const key of ["building_rubber_plantation", "building_oil_rig", "building_tooling_workshop"]) await page.click("[data-company-solver-building='" + key + "']");
      await page.click("[data-company-solver-run]");
      assert.equal(await page.evaluate(() => Number(document.querySelector("[data-company-solver-company-count]")?.value)), 1);
      assert.equal(await page.evaluate(() => document.querySelectorAll("[data-company-solver-company-count] option").length), 7, "company count should allow seven automatic levels");
      assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-company-solver-unrestricted-only]"))), true, "solver should expose the unrestricted-company option");
      assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-company-solver-unrestricted-only]").checked)), false, "unrestricted-company option should be off by default");
      await page.evaluate(() => { const toggle = document.querySelector("[data-company-solver-unrestricted-only]"); toggle.checked = true; toggle.dispatchEvent(new Event("change", { bubbles: true })); });
      assert.equal(await page.evaluate(() => document.querySelector("[data-company-solver-unrestricted-only]").checked), true, "unrestricted-company option should remain interactive");
      assert.equal(await page.evaluate(() => solverCompaniesForRequest().every((company) => !solverCompanyHasCultureCountryRestriction(company))), true, "unrestricted-company option should exclude culture and country restrictions");
      await page.evaluate(() => { const toggle = document.querySelector("[data-company-solver-unrestricted-only]"); toggle.checked = false; toggle.dispatchEvent(new Event("change", { bubbles: true })); });
      await page.evaluate(() => { const select = document.querySelector("[data-company-solver-company-count]"); select.value = "3"; select.dispatchEvent(new Event("change", { bubbles: true })); });
      assert.equal(await page.evaluate(() => Number(document.querySelector("[data-company-solver-company-count]")?.value)), 3, "company count select should remain interactive");
      await page.evaluate(() => { const select = document.querySelector("[data-company-solver-company-count]"); select.value = "1"; select.dispatchEvent(new Event("change", { bubbles: true })); });
      assert.equal(await page.evaluate(() => Number(document.querySelector("[data-company-solver-company-count]")?.value)), 1, "company count should remain changeable after a rerender");
      await page.click("[data-company-solver-building='building_coal_mine']");
      await page.click("[data-company-solver-building='building_coal_mine']");
      await page.click("[data-company-solver-run]");
      await page.waitFor(() => document.querySelectorAll(".company-solver-card").length > 0 || document.querySelector(".company-solver-results-head").textContent.includes("共 0 个方案") || document.querySelector(".company-solver-results-head").textContent.includes("0 plans") || document.querySelector(".company-solver-results-head").textContent.includes("失败") || document.querySelector(".company-solver-results-head").textContent.includes("Error"), "solver result");
      const cardReport = await page.evaluate(() => ({ cards: document.querySelectorAll(".company-solver-card").length, arrows: document.querySelectorAll("[data-company-solver-open]").length, anchors: document.querySelectorAll(".company-solver-card a").length, overflow: Array.from(document.querySelectorAll(".company-solver-card")).some((node) => node.scrollWidth > node.clientWidth), body: document.body.innerText.slice(0, 600) }));
      assert.ok(cardReport.cards <= 20);
      assert.equal(cardReport.arrows, cardReport.cards);
      assert.equal(cardReport.anchors, 0);
      assert.equal(cardReport.overflow, false);
      assert.equal(await page.evaluate(() => document.querySelectorAll("[data-company-solver-page]").length), 4, "solver should render pagination controls at both ends of the result list");
      assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-company-solver-usage]"))), true, "solver should show company usage statistics");
      assert.equal(await page.evaluate(() => document.querySelector("[data-company-solver-usage]")?.open), false, "company usage should be collapsed after solving");
      const collapsedUsage = await page.evaluate(() => {
        const details = document.querySelector("[data-company-solver-usage]");
        const summary = details?.querySelector("summary");
        const list = details?.querySelector(".company-solver-usage-list");
        const item = details?.querySelector(".company-solver-usage-item");
        return {
          itemRects: item?.getClientRects().length || 0,
          listDisplay: list ? getComputedStyle(list).display : "",
          detailsHeight: details?.getBoundingClientRect().height || 0,
          summaryHeight: summary?.getBoundingClientRect().height || 0,
        };
      });
      assert.equal(collapsedUsage.itemRects, 0, "collapsed company usage should hide its rows: " + JSON.stringify(collapsedUsage));
      await page.click("[data-company-solver-usage] summary");
      await page.waitFor(() => document.querySelector("[data-company-solver-usage]")?.open === true, "expanded company usage");
      assert.ok(await page.evaluate(() => Array.from(document.querySelectorAll(".company-solver-usage-item")).every((node) => /%/.test(node.textContent) && node.getClientRects().length > 0)), "expanded company usage should show percentage rows");
      await page.click("button[data-company-solver-page='next']:not(:disabled)");
      await page.waitFor(() => state.companySolver.page === 2 && document.querySelector("[data-company-solver-usage]")?.open === true, "company usage stays open after pagination");
      await page.click("[data-company-solver-run]");
      assert.equal(await page.evaluate(() => state.companySolver.usageOpen), false, "starting a new solve should clear company usage expansion");
      await page.waitFor(() => state.companySolver.status === "complete" && document.querySelectorAll(".company-solver-card").length > 0, "second solver result");
      assert.equal(await page.evaluate(() => document.querySelector("[data-company-solver-usage]")?.open), false, "company usage should collapse again after a new solve");
      assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-company-solver-exclude-construction]"))), true, "solver should expose the construction-company exclusion");
      assert.equal(await page.evaluate(() => Boolean(document.querySelector(".company-solver-prestige-filter"))), true, "solver should expose prestige-good filters");
      await page.click(".company-solver-prestige-filter summary");
      await page.waitFor(() => document.querySelectorAll("[data-company-solver-prestige]").length > 0, "available prestige-good filters");
      assert.equal(await page.evaluate(() => Array.from(document.querySelectorAll("[data-company-solver-prestige] input")).every((input) => getComputedStyle(input).pointerEvents !== "none")), true, "prestige-good icons should have a clickable input layer");
      assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-company-solver-prestige='prestige_good_armstrong_ships']"))), false, "removed Armstrong ships prestige good should not be listed");
      assert.ok(await page.evaluate(() => document.querySelectorAll("[data-company-solver-prestige]:disabled").length > 0), "prestige-good filters should show unavailable goods as disabled");
      const prestigeKey = await page.evaluate(() => document.querySelector("[data-company-solver-prestige]:not(:disabled)")?.dataset.companySolverPrestige || "");
      assert.ok(prestigeKey, "available prestige-good filter should have a key");
      await page.click("[data-company-solver-prestige='" + prestigeKey + "']");
      assert.equal(await page.evaluate((key) => state.companySolver.selectedPrestigeGoods.has(key), prestigeKey), true, "prestige-good filter should update solver state");
      const prestigeMouseTarget = await page.mouseClick("[data-company-solver-prestige='" + prestigeKey + "']");
      assert.equal(await page.evaluate((key) => state.companySolver.selectedPrestigeGoods.has(key), prestigeKey), false, "real mouse click on prestige-good icon should toggle it off; target: " + prestigeMouseTarget.selector + " rect: " + JSON.stringify(prestigeMouseTarget.rect));
      await page.mouseClick("[data-company-solver-prestige='" + prestigeKey + "']");
      assert.equal(await page.evaluate((key) => state.companySolver.selectedPrestigeGoods.has(key), prestigeKey), true, "real mouse click on prestige-good icon should toggle it on");
      await page.evaluate((key) => document.querySelector("[data-company-solver-prestige='" + key + "']")?.closest("label")?.querySelector("img")?.click(), prestigeKey);
      assert.equal(await page.evaluate((key) => state.companySolver.selectedPrestigeGoods.has(key), prestigeKey), false, "clicking the prestige-good icon should toggle it off");
      await page.evaluate((key) => document.querySelector("[data-company-solver-prestige='" + key + "']")?.closest("label")?.querySelector("img")?.click(), prestigeKey);
      assert.equal(await page.evaluate((key) => state.companySolver.selectedPrestigeGoods.has(key), prestigeKey), true, "clicking the prestige-good icon should toggle it on");
      assert.equal(await page.evaluate(() => document.querySelector(".company-solver-prestige-filter")?.open), true, "prestige-good filter should remain open after selecting an icon");
      assert.equal(await page.evaluate(() => document.querySelectorAll(".company-solver-prestige-option > span:not(.company-solver-prestige-filter-icon)").length), 0, "prestige-good filters should not render text labels beside icons");
      assert.equal(await page.evaluate(() => document.querySelectorAll(".company-solver-prestige-group > strong").length), 0, "prestige-good groups should not render base-good names");
      assert.equal(await page.evaluate(() => Array.from(document.querySelectorAll(".company-solver-prestige-group")).every((group) => getComputedStyle(group).minWidth === "0px")), true, "prestige-good group frames should size to their contents");
      assert.ok(await page.evaluate(() => document.querySelectorAll("[data-company-solver-prestige-category]").length > 0), "prestige-good filters should be organized by good category");
      assert.equal(await page.evaluate(() => Array.from(document.querySelectorAll(".company-solver-prestige-group")).every((group) => group.closest("[data-company-solver-prestige-category]"))), true, "prestige variants should stay together inside a category group");
      assert.deepEqual(await page.evaluate(() => Array.from(document.querySelectorAll("[data-company-solver-prestige-category] > h3")).map((heading) => heading.textContent.trim())), ["日用品", "工业品", "奢侈品", "军用品"], "prestige-good category headings should use the game localization");
      const prestigeLayout = await page.evaluate(() => { const grid = document.querySelector(".company-solver-prestige-groups"); return { columns: grid ? getComputedStyle(grid).gridTemplateColumns : "", width: grid?.getBoundingClientRect().width || 0 }; });
      assert.equal(prestigeLayout.columns.split(" ").length, 1, "prestige-good categories should each occupy their own row");
      assert.equal(await page.evaluate(() => document.querySelectorAll("[data-company-solver-prestige-category]").length), 4, "prestige-good categories should each occupy their own row");
      assert.ok(await page.evaluate(() => Array.from(document.querySelectorAll(".company-solver-prestige-category-groups")).every((groups) => getComputedStyle(groups).display === "flex" && getComputedStyle(groups).flexWrap === "wrap")), "prestige-good groups should be arranged horizontally and wrap when needed");
      await page.click("[data-company-solver-prestige='" + prestigeKey + "']");
      await page.click("[data-company-solver-run]");
      await page.waitFor(() => document.querySelectorAll(".company-solver-card").length > 0, "solver result after clearing prestige filter");
      assert.equal(await page.evaluate(() => document.querySelector("[data-company-solver-open]")?.classList.contains("row-detail-button")), true, "solver arrow should use the shared detail control");
      assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-company-solver-open] img.lucide-icon[src*='arrow-right.svg']"))), true, "solver arrow should use the shared arrow icon");
      assert.equal(await page.evaluate(() => Array.from(document.querySelectorAll(".company-solver-optional-group")).some((node) => /[（）()]/.test(node.textContent))), false, "dashed optional groups should not show brackets");
      assert.ok(await page.evaluate(() => { const logo = document.querySelector(".company-solver-card .company-solver-icon .company-logo, .company-solver-card .company-solver-icon .company-icon-placeholder"); const building = document.querySelector(".company-solver-card .company-solver-building-icon .resource-icon"); return logo && building && logo.getBoundingClientRect().width >= 36 && getComputedStyle(logo).borderStyle === "none" && building.getBoundingClientRect().width >= 34; }), "solver card icons should be larger and company icons borderless");
      if (cardReport.cards) {
        await page.click("[data-company-solver-open]");
        await page.waitFor(() => document.querySelectorAll(".company-solver-company-detail a[href^='#/company/']").length > 0, "solver detail");
        assert.ok(await page.evaluate(() => document.querySelectorAll(".company-solver-company-detail a[href^='#/building/']").length > 0));
        assert.ok(await page.evaluate(() => document.querySelectorAll(".company-solver-company-detail a[href^='#/goods/']").length > 0));
      }
      reports.push({ viewport, ...cardReport });
    } finally {
      page.close();
    }
  }
  const legacyPage = await openPage({ width: 1200, height: 800 });
  try {
    await legacyPage.goto(server.url + "/index.html?version=1.13.9&lang=zh-Hans#/company/solver");
    await legacyPage.waitFor(() => location.hash === "#/company" && document.body.dataset.companySolver === "false", "legacy solver redirect");
  } finally {
    legacyPage.close();
  }
  const heavyFilePage = await openPage({ width: 1200, height: 800 });
  try {
    const fileUrl = pathToFileURL(path.join(root, "site", "index.html")).href + "?version=1.13.11&lang=zh-Hans#/company/solver";
    await heavyFilePage.goto(fileUrl);
    await heavyFilePage.waitFor(() => document.body.dataset.view === "company" && document.querySelectorAll("[data-company-solver-building]").length === 48, "heavy file solver entry");
    for (const key of ["building_coal_mine", "building_iron_mine", "building_steel_mill", "building_tooling_workshop"]) await heavyFilePage.click("[data-company-solver-building='" + key + "']");
    await heavyFilePage.click("[data-company-solver-run]");
    await heavyFilePage.waitFor(() => document.querySelectorAll(".company-solver-card").length > 0 || document.querySelector(".company-solver-results-head").textContent.includes("失败"), "heavy file solver result");
    const heavyReport = await heavyFilePage.evaluate(() => ({ cards: document.querySelectorAll(".company-solver-card").length, text: document.querySelector(".company-solver-results-head")?.textContent || "", body: document.body.innerText.slice(0, 500) }));
    assert.ok(heavyReport.cards > 0, "heavy file solver must compute: " + JSON.stringify(heavyReport));
  } finally {
    heavyFilePage.close();
  }
  const englishPage = await openPage({ width: 1200, height: 800 });
  try {
    await englishPage.goto(server.url + "/index.html?version=1.13.11&lang=en#/company/solver");
    await englishPage.click('[data-nav-view="company"]');
    await englishPage.waitFor(() => document.querySelector("#companySolverEntry:not([hidden])"), "localized solver entry");
    await englishPage.waitFor(() => document.querySelector("#companySolverEntry")?.textContent.includes("Company industry solver"), "localized solver entry text");
  } finally {
    englishPage.close();
  }
  console.log(JSON.stringify({ company_solver_browser: "ok", reports }, null, 2));
} finally {
  chrome.kill();
  await server.close();
}

async function openPage(viewport) {
  await waitForDebugEndpoint();
  const target = await (await fetch("http://127.0.0.1:" + debugPort + "/json/new?about:blank", { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  const runtimeErrors = [];
  session.listen("Runtime.exceptionThrown", (message) => { const detail = message.params && message.params.exceptionDetails; runtimeErrors.push(detail && detail.exception && detail.exception.description || detail && detail.text || "runtime exception"); });
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
  return {
    async goto(url) { const loaded = session.next("Page.loadEventFired"); await session.send("Page.navigate", { url }); await loaded; },
    async evaluate(expression, ...args) { const call = "(" + expression.toString() + ")(" + args.map((value) => JSON.stringify(value)).join(",") + ")"; const result = await session.send("Runtime.evaluate", { expression: call, returnByValue: true, awaitPromise: true }); if (result.result && result.result.exceptionDetails) throw new Error(result.result.exceptionDetails.text || "browser evaluation failed"); return result.result && result.result.result ? result.result.result.value : undefined; },
    async click(selector) { assert.equal(await this.evaluate((value) => { const node = document.querySelector(value); if (!node) return false; node.click(); return true; }, selector), true, "missing " + selector); },
    async mouseClick(selector) { const point = await this.evaluate((value) => { const node = document.querySelector(value); if (!node) return null; node.scrollIntoView({ block: "center", inline: "center" }); const rect = node.getBoundingClientRect(); const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, selector: target?.outerHTML?.slice(0, 300) || "", rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } }; }, selector); assert.ok(point, "missing " + selector); await session.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 }); await session.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 }); return point; },
    async waitFor(predicate, description) { const end = Date.now() + 60000; while (Date.now() < end) { if (await this.evaluate(predicate)) return; await new Promise((resolve) => setTimeout(resolve, 100)); } const diagnostic = await this.evaluate(() => { let renderError = ""; try { if (typeof renderCompanySolverBoard === "function") renderCompanySolverBoard(); } catch (error) { renderError = error && error.stack || String(error); } return { href: location.href, view: document.body && document.body.dataset.view, solver: document.body && document.body.dataset.companySolver, debug: window.__companySolverDebug ? window.__companySolverDebug() : null, renderError, buttons: document.querySelectorAll("[data-company-solver-building]").length, resultText: document.querySelector("#resultCount") && document.querySelector("#resultCount").textContent, meta: document.querySelector("#metaLine") && document.querySelector("#metaLine").textContent, list: document.querySelector("#countryList") && document.querySelector("#countryList").innerHTML.slice(0, 500), scripts: Array.from(document.scripts).filter((script) => script.src.indexOf("company-solver") >= 0).map((script) => script.src), body: (document.body && document.body.innerText || "").slice(0, 800) }; }); throw new Error(description + " timed out: " + JSON.stringify({ diagnostic, runtimeErrors })); },
    close() { session.close(); },
  };
}

async function waitForDebugEndpoint() {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    try { if ((await fetch("http://127.0.0.1:" + debugPort + "/json/version")).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Chrome debug endpoint timed out");
}

async function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const listeners = new Map();
  let id = 0;
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const callback = pending.get(message.id);
    if (callback) {
      pending.delete(message.id);
      callback(message);
    }
    const queue = listeners.get(message.method);
    if (queue && queue.length) queue.shift()(message);
  });
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
  return {
    send(method, params = {}) { return new Promise((resolve) => { const requestId = ++id; pending.set(requestId, resolve); socket.send(JSON.stringify({ id: requestId, method, params })); }); },
    next(method) { return new Promise((resolve) => { if (!listeners.has(method)) listeners.set(method, []); listeners.get(method).push(resolve); }); },
    listen(method, callback) { if (!listeners.has(method)) listeners.set(method, []); listeners.get(method).push(callback); },
    close() { socket.close(); },
  };
}

async function startPreviewServer(siteRoot) {
  const resolvedRoot = path.resolve(siteRoot);
  const server = http.createServer((request, response) => {
    const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
    const file = path.resolve(resolvedRoot, relative);
    if (!file.startsWith(resolvedRoot + path.sep) && file !== path.join(resolvedRoot, "index.html")) return response.writeHead(403).end();
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return response.writeHead(404).end();
    response.writeHead(200, { "content-type": contentType(file), "cache-control": "no-store" });
    fs.createReadStream(file).pipe(response);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { url: "http://127.0.0.1:" + server.address().port, close: () => new Promise((resolve) => server.close(resolve)) };
}

function contentType(file) {
  return ({ ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".mjs": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" })[path.extname(file).toLowerCase()] || "application/octet-stream";
}
