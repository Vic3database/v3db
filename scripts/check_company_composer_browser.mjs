import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import os from "node:os";

const root = process.cwd();
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9274;
const chromeProfile = fs.mkdtempSync(path.join(os.tmpdir(), "vicdata-company-composer-"));
const chrome = spawn(chromePath, ["--remote-debugging-port=" + debugPort, "--user-data-dir=" + chromeProfile, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });
const server = await startPreviewServer(path.join(root, "site"));
try {
  const reports = [];
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const page = await openPage(viewport);
    try {
      await page.goto(server.url + "/index.html?version=1.13.10&lang=zh-Hans#/company");
      await page.waitFor(() => document.querySelector("#companyComposerEntry:not([hidden])"), "company composer entry");
      const regularCompanyFilterKeys = await page.evaluate(() => Array.from(document.querySelectorAll("[data-resource-filter]"), (node) => node.dataset.resourceFilter));
      assert.equal(regularCompanyFilterKeys.includes("building_gold_field"), false, "regular company filters must hide gold fields");
      assert.equal(regularCompanyFilterKeys.includes("subsistence_buildings"), false, "regular company filters must hide subsistence buildings");
      assert.equal(regularCompanyFilterKeys.includes("building_gold_mine"), true, "regular company filters must keep gold mines");
      await page.click("[data-company-composer-entry]");
      await page.waitFor(() => document.body.dataset.companyComposer === "true" && document.querySelectorAll("[data-company-composer-company]").length > 0, "company composer board");
      assert.equal(await page.evaluate(() => location.hash), "#/company/composer");
      const companyFilterKeys = await page.evaluate(() => Array.from(document.querySelectorAll("[data-resource-filter]"), (node) => node.dataset.resourceFilter));
      assert.equal(companyFilterKeys.includes("building_gold_field"), false, "company filters must hide gold fields");
      assert.equal(companyFilterKeys.includes("subsistence_buildings"), false, "company filters must hide subsistence buildings");
      assert.equal(companyFilterKeys.includes("building_gold_mine"), true, "company filters must keep gold mines");
      assert.equal(await page.evaluate(() => Boolean(document.querySelector("#companySolverDetailPane[hidden]"))), true, "old solver detail pane stays hidden");
      assert.equal(await page.evaluate(() => Boolean(document.querySelector(".filters .company-only"))), true);
      assert.equal(await page.evaluate(() => Array.from(document.querySelectorAll(".filters > .filter-section.region-only:not(:has(#resourceFilters)), .filters .company-region-filter-section")).every((node) => getComputedStyle(node).display === "none")), true, "region filters stay out of the composer");
      assert.equal(await page.evaluate(() => document.querySelectorAll(".company-composer-card").length > 0), true);
      assert.equal(await page.evaluate(() => document.querySelectorAll("[data-company-solver-page]").length), 0, "composer has no pagination");
      const cardPresentation = await page.evaluate(() => {
        const card = document.querySelector(".company-composer-card");
        const icon = card?.querySelector(".company-logo, .company-icon-placeholder");
        const label = card?.querySelector(":scope > span:last-child");
        if (!card || !icon || !label) return null;
        const cardStyle = getComputedStyle(card);
        const labelStyle = getComputedStyle(label);
        return {
          cardWidth: card.getBoundingClientRect().width,
          iconWidth: icon.getBoundingClientRect().width,
          labelDisplay: labelStyle.display,
          labelVisibility: labelStyle.visibility,
          labelOpacity: Number(labelStyle.opacity),
          labelWhiteSpace: labelStyle.whiteSpace,
          transform: cardStyle.transform,
        };
      });
      assert.ok(cardPresentation, "company card presentation should be measurable");
      assert.ok(cardPresentation.cardWidth >= (viewport.width > 760 ? 108 : 96), "company cards must reserve enough width for names: " + JSON.stringify(cardPresentation));
      assert.ok(cardPresentation.iconWidth >= (viewport.width > 760 ? 72 : 64), "company icons must be large enough: " + JSON.stringify(cardPresentation));
      assert.equal(cardPresentation.labelWhiteSpace, "normal", "company names must be allowed to wrap");
      const layout = await page.evaluate(() => {
        const filters = document.querySelector(".filters").getBoundingClientRect();
        const results = document.querySelector(".results").getBoundingClientRect();
        const detail = document.querySelector(".detail").getBoundingClientRect();
        const resultStyle = getComputedStyle(document.querySelector('.results')); const detailStyle = getComputedStyle(document.querySelector('.detail'));
        return { filters: { left: filters.left, right: filters.right, width: filters.width }, results: { left: results.left, right: results.right, width: results.width }, detail: { left: detail.left, right: detail.right, width: detail.width }, bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, body: { composer: document.body.dataset.companyComposer, detailPage: document.body.className, filtersPosition: getComputedStyle(document.querySelector('.filters')).position, filtersDisplay: getComputedStyle(document.querySelector('.filters')).display, resultsPosition: resultStyle.position, resultsLeft: resultStyle.left, resultsRight: resultStyle.right, resultsWidth: resultStyle.width, detailDisplay: detailStyle.display, detailLeft: detailStyle.left, detailRight: detailStyle.right, detailWidth: detailStyle.width } };
      });
      if (viewport.width > 760) {
        assert.ok(layout.filters.right <= layout.results.left + 1, "filters and wall must not overlap: " + JSON.stringify(layout));
        assert.ok(layout.results.right <= layout.detail.left + 1, "wall and summary must not overlap: " + JSON.stringify(layout));
      }
      assert.equal(layout.bodyOverflow, false, "composer must not overflow horizontally");

      const buildingFilter = await page.evaluate(() => document.querySelector("[data-resource-filter]")?.dataset.resourceFilter || "");
      if (buildingFilter) {
        const beforeFilter = await page.evaluate(() => Array.from(document.querySelectorAll(".company-composer-card")).map((node) => {
          const rect = node.getBoundingClientRect();
          return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
        }));
        await page.click(`[data-resource-filter='${buildingFilter}']`);
        await page.waitFor(() => document.querySelector("[data-resource-filter][aria-pressed='true']"), "company building filter");
        const afterFilter = await page.evaluate(() => Array.from(document.querySelectorAll(".company-composer-card")).map((node) => {
          const rect = node.getBoundingClientRect();
          return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
        }));
        assert.equal(afterFilter.some((rect, index) => afterFilter.slice(index + 1).some((other) => rect.left < other.right && rect.right > other.left && rect.top < other.bottom && rect.bottom > other.top)), false, "company cards must not overlap after building filtering");
        assert.ok(afterFilter.every((rect) => rect.right > rect.left && rect.bottom > rect.top), "filtered company cards must retain valid geometry");
        await page.click(`[data-resource-filter='${buildingFilter}']`);
        await page.waitFor(() => !document.querySelector("[data-resource-filter][aria-pressed='true']"), "clear company building filter");
      }

      const companyKeys = await page.evaluate(() => Array.from(document.querySelectorAll("[data-company-composer-company]")).slice(0, 2).map((node) => node.dataset.companyComposerCompany));
      assert.equal(companyKeys.length, 2);
      await page.click(`[data-company-composer-company='${companyKeys[0]}']`);
      await page.click(`[data-company-composer-company='${companyKeys[1]}']`);
      await page.waitFor(() => document.querySelectorAll(".company-composer-selected [data-company-composer-company]").length === 2, "selected company wall");
      assert.deepEqual(await page.evaluate(() => Array.from(document.querySelectorAll(".company-composer-selected [data-company-composer-company]")).map((node) => node.dataset.companyComposerCompany)), companyKeys, "selected companies preserve click order");
      assert.equal(await page.evaluate(() => document.querySelectorAll(".company-composer-selected-company-list").length), 0, "summary must not repeat the selected company list");
      assert.equal(await page.evaluate(() => document.querySelectorAll(".company-composer-building-group").length), 0, "fixed buildings must use one continuous list");
      const selectedSummary = await page.evaluate(() => window.__companyComposerDebug());
      assert.deepEqual(selectedSummary.selectedCompanyKeys, companyKeys);
      assert.equal(new Set(selectedSummary.buildingGroups.flatMap((group) => group.buildingKeys)).size, selectedSummary.buildingGroups.flatMap((group) => group.buildingKeys).length, "building summary is deduplicated");
      assert.ok(await page.evaluate(() => document.querySelectorAll(".company-composer-summary a[href^='#/building/']").length > 0), "summary should link combined buildings");

      const initialCardRects = await page.evaluate(() => Array.from(document.querySelectorAll(".company-composer-card")).map((node) => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      }));
      assert.equal(initialCardRects.some((rect, index) => initialCardRects.slice(index + 1).some((other) => rect.left < other.right && rect.right > other.left && rect.top < other.bottom && rect.bottom > other.top)), false, "company cards must not overlap in the selected state");
      assert.equal(await page.evaluate(() => Array.from(document.querySelectorAll(".company-composer-card.is-selected")).every((node) => getComputedStyle(node).transform === "none")), true, "selected company cards must not shift out of their grid tracks");

      const restrictionCompanyKey = await page.evaluate(() => {
        const company = companies.find((item) => (item.referenced_cultures || item.cultures || []).length || (item.referenced_countries || item.countries || []).length);
        return company?.key || "";
      });
      let addedRestrictionCompany = false;
      if (restrictionCompanyKey && !companyKeys.includes(restrictionCompanyKey)) {
        const selector = `[data-company-composer-company='${restrictionCompanyKey}']`;
        if (await page.evaluate((value) => Boolean(document.querySelector(value)), selector)) {
          await page.click(selector);
          addedRestrictionCompany = true;
        }
      }
      assert.equal(await page.evaluate(() => document.querySelectorAll(".company-composer-summary a[href^='#/culture/'], .company-composer-summary a[href^='#/country/']").length), 0, "culture and country restrictions must not be links");
      if (addedRestrictionCompany) await page.click(`[data-company-composer-company='${restrictionCompanyKey}']`);

      const ext = await page.evaluate(() => {
        const row = document.querySelector("[data-company-composer-extension-company]");
        return row ? { company: row.dataset.companyComposerExtensionCompany, options: Array.from(document.querySelectorAll(`[data-company-composer-extension-company='${row.dataset.companyComposerExtensionCompany}']`)).map((node) => node.dataset.companyComposerExtension) } : null;
      });
      if (ext && ext.options.length > 0) {
        await page.click(`[data-company-composer-extension-company='${ext.company}'][data-company-composer-extension='${ext.options[0]}']`);
        const first = await page.evaluate(() => window.__companyComposerDebug());
        assert.equal(first.selectedExtensions[ext.company], ext.options[0]);
        if (ext.options.length > 1) {
          await page.click(`[data-company-composer-extension-company='${ext.company}'][data-company-composer-extension='${ext.options[1]}']`);
          const second = await page.evaluate(() => window.__companyComposerDebug());
          assert.equal(second.selectedExtensions[ext.company], ext.options[1], "extension options replace one another");
          assert.equal(second.buildingGroups.flatMap((group) => group.buildingKeys).includes(ext.options[0]), false, "replaced extension disappears");
          await page.click(`[data-company-composer-extension-company='${ext.company}'][data-company-composer-extension='${ext.options[1]}']`);
          const cleared = await page.evaluate(() => window.__companyComposerDebug());
          assert.equal(cleared.selectedExtensions[ext.company], undefined, "current extension can be cleared");
        }
      }
      for (const key of companyKeys) await page.click(`[data-company-composer-company='${key}']`);
      for (const key of ["company_a_markwald_and_company", "company_ap_moller"]) await page.click(`[data-company-composer-company='${key}']`);
      const fixedOverlap = await page.evaluate(() => {
        const link = document.querySelector("[data-company-composer-building-coverage='building_port']");
        return {
          links: document.querySelectorAll("[data-company-composer-building-coverage='building_port']").length,
          badge: link?.querySelector(".company-composer-building-overlap")?.textContent || "",
          title: link?.getAttribute("title") || "",
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      assert.equal(fixedOverlap.links, 1, "overlapping coverage keeps one building icon");
      assert.equal(fixedOverlap.badge, "×2", "shared fixed coverage should show two companies");
      assert.match(fixedOverlap.title, /马克沃尔德/);
      assert.match(fixedOverlap.title, /默勒/);
      assert.equal(fixedOverlap.overflow, false);
      for (const key of ["company_a_markwald_and_company", "company_ap_moller"]) await page.click(`[data-company-composer-company='${key}']`);

      for (const key of ["company_a_markwald_and_company", "company_ansaldo"]) await page.click(`[data-company-composer-company='${key}']`);
      await page.click("[data-company-composer-extension-company='company_a_markwald_and_company'][data-company-composer-extension='building_tooling_workshop']");
      const extensionOverlap = await page.evaluate(() => {
        const link = document.querySelector("[data-company-composer-building-coverage='building_tooling_workshop']");
        return { badge: link?.querySelector(".company-composer-building-overlap")?.textContent || "", title: link?.title || "" };
      });
      assert.equal(extensionOverlap.badge, "×2", "selected extension should contribute to overlapping coverage");
      assert.match(extensionOverlap.title, /马克沃尔德/);
      assert.match(extensionOverlap.title, /安萨尔多/);
      await page.click("[data-company-composer-extension-company='company_a_markwald_and_company'][data-company-composer-extension='building_tooling_workshop']");
      assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-company-composer-building-coverage='building_tooling_workshop'] .company-composer-building-overlap"))), false, "clearing an extension should remove its overlap marker");
      for (const key of ["company_a_markwald_and_company", "company_ansaldo"]) await page.click(`[data-company-composer-company='${key}']`);

      for (const key of ["company_a_markwald_and_company", "company_compania_sansinena_de_carnes_congeladas"]) await page.click(`[data-company-composer-company='${key}']`);
      await page.waitFor(() => document.querySelectorAll(".company-composer-selected [data-company-composer-company]").length === 2, "prosperity aggregation selection");
      const prosperity = await page.evaluate(() => window.__companyComposerDebug());
      const tradeGroup = prosperity.prosperityGroups.find((group) => group.key === "state");
      const tradeModifier = tradeGroup?.modifiers.find((modifier) => modifier.key === "state_trade_advantage_mult");
      assert.equal(tradeModifier?.value, 0.15, "same prosperity fields should aggregate their numeric values");
      assert.match(await page.evaluate(() => document.querySelector(".company-composer-summary")?.textContent || ""), /15%/, "aggregated prosperity should use percentage formatting");
      reports.push({ viewport, layout, selected: companyKeys });
    } finally {
      page.close();
    }
  }
  const regionPage = await openPage({ width: 1200, height: 800 });
  try {
    await regionPage.goto(server.url + "/index.html?version=1.13.10&lang=zh-Hans#/region");
    await regionPage.waitFor(() => document.body.dataset.view === "region" && document.querySelectorAll("[data-resource-filter]").length > 0, "region resource filters");
    const regionFilterKeys = await regionPage.evaluate(() => Array.from(document.querySelectorAll("[data-resource-filter]"), (node) => node.dataset.resourceFilter));
    assert.equal(regionFilterKeys.includes("building_gold_field"), true, "region filters must keep gold fields");
    assert.equal(regionFilterKeys.includes("subsistence_buildings"), true, "region filters must keep subsistence buildings");
  } finally {
    regionPage.close();
  }
  const legacyPage = await openPage({ width: 1200, height: 800 });
  try {
    await legacyPage.goto(server.url + "/index.html?version=1.13.9&lang=zh-Hans#/company/composer");
    await legacyPage.waitFor(() => location.hash === "#/company" && document.body.dataset.companyComposer === "false", "legacy composer redirect");
  } finally {
    legacyPage.close();
  }
  const englishPage = await openPage({ width: 1200, height: 800 });
  try {
    await englishPage.goto(server.url + "/index.html?version=1.13.10&lang=en#/company/composer");
    await englishPage.waitFor(() => document.body.dataset.companyComposer === "true", "english composer route");
    assert.match(await englishPage.evaluate(() => document.body.innerText), /Combined buildings/);
  } finally {
    englishPage.close();
  }
  console.log(JSON.stringify({ company_composer_browser: "ok", reports }, null, 2));
} finally {
  chrome.kill();
  await server.close();
}

async function openPage(viewport) {
  await waitForDebugEndpoint();
  const target = await (await fetch("http://127.0.0.1:" + debugPort + "/json/new?about:blank", { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  const runtimeErrors = [];
  session.listen("Runtime.exceptionThrown", (message) => {
    const detail = message.params && message.params.exceptionDetails;
    runtimeErrors.push(detail && detail.exception && detail.exception.description || detail && detail.text || "runtime exception");
  });
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
  return {
    async goto(url) { const loaded = session.next("Page.loadEventFired"); await session.send("Page.navigate", { url }); await loaded; },
    async evaluate(expression, ...args) { const call = "(" + expression.toString() + ")(" + args.map((value) => JSON.stringify(value)).join(",") + ")"; const result = await session.send("Runtime.evaluate", { expression: call, returnByValue: true, awaitPromise: true }); if (result.result && result.result.exceptionDetails) throw new Error(result.result.exceptionDetails.text || "browser evaluation failed"); return result.result && result.result.result ? result.result.result.value : undefined; },
    async click(selector) { assert.equal(await this.evaluate((value) => { const node = document.querySelector(value); if (!node) return false; node.click(); return true; }, selector), true, "missing " + selector); },
    async waitFor(predicate, description) { const end = Date.now() + 60000; while (Date.now() < end) { if (await this.evaluate(predicate)) return; await new Promise((resolve) => setTimeout(resolve, 100)); } const diagnostic = await this.evaluate(() => ({ href: location.href, body: document.body.innerText.slice(0, 1000), runtimeErrors: window.__companyComposerDebug ? window.__companyComposerDebug() : null })); throw new Error(description + " timed out: " + JSON.stringify({ diagnostic, runtimeErrors })); },
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
    if (callback) { pending.delete(message.id); callback(message); }
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
