import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const siteRoot = path.join(root, "site");
const port = await freePort();
const debugPort = await freePort();
const profileDir = fsTempDir("vicdata-character-board-chrome-");
const screenshotDir = process.env.VICDATA_SCREENSHOT_DIR || "";
const site = spawn(process.execPath, ["scripts/serve_site.mjs", siteRoot, String(port)], { stdio: "ignore", windowsHide: true });
const chrome = spawn(chromePath, [
  "--headless=new", "--disable-gpu", "--disable-extensions", "--no-first-run", "--no-default-browser-check",
  "--remote-allow-origins=*", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`, "about:blank",
], { stdio: "ignore", windowsHide: true });

try {
  const version = await waitFor(() => fetchJson(`http://127.0.0.1:${debugPort}/json/version`), "Chrome debugging endpoint");
  const browser = await cdpConnect(version.webSocketDebuggerUrl);
  try {
    const desktop = await browser.openPage({ width: 1440, height: 1000 });
    await desktop.goto(`http://127.0.0.1:${port}/index.html#/character`);
    await desktop.waitFor(() => document.querySelectorAll("[data-character-key]").length > 0, "character rows");
    const characterBoard = await desktop.evaluate(() => ({
      view: document.body.dataset.view,
      rows: document.querySelectorAll("[data-character-key]").length,
      map: getComputedStyle(document.querySelector("#mapPanel")).display,
      viewSwitch: getComputedStyle(document.querySelector(".view-switch")).display,
      foreignFilters: [...document.querySelectorAll(".filters .filter-section:not(.character-only)")]
        .filter((node) => getComputedStyle(node).display !== "none").length,
      roleFilters: [...document.querySelectorAll(".filters .character-only")]
        .filter((node) => getComputedStyle(node).display !== "none").length,
      nav: Boolean(document.querySelector('[data-nav-view="name-pool"]')),
      count: document.querySelector("#resultCount")?.textContent || "",
      row: (() => {
        const node = document.querySelector(".character-row");
        const name = node?.querySelector(".name");
        const key = node?.querySelector(".character-row-key");
        const title = node?.querySelector(".character-row-title");
        const inlineIdentityNodes = [...(title?.querySelectorAll(".character-row-identity") || [])];
        const identityNodes = [...(node?.querySelectorAll(".character-row-identity") || [])];
        return {
          display: node ? getComputedStyle(node).display : "",
          gridTemplateColumns: node ? getComputedStyle(node).gridTemplateColumns : "",
          overflow: name ? getComputedStyle(name).overflowWrap : "",
          rowOverflow: node ? node.scrollWidth > node.clientWidth : true,
          keyText: key?.textContent.trim() || "",
          rowKey: node?.dataset.characterKey || "",
          keyTextAlign: key ? getComputedStyle(key).textAlign : "",
          keyWhiteSpace: key ? getComputedStyle(key).whiteSpace : "",
          keyWidth: key?.getBoundingClientRect().width || 0,
          keyHeight: key?.getBoundingClientRect().height || 0,
          identityCount: identityNodes.length,
          inlineIdentityCount: inlineIdentityNodes.length,
          separateIdentityRow: Boolean(node?.querySelector(".character-row-title + .character-row-identities")),
          interestGroupIcon: Boolean(node?.querySelector(".interest-group-icon")),
          ideologyIcon: Boolean(node?.querySelector(".ideology-icon")),
          identityText: identityNodes.map((identity) => identity.textContent.trim()).join(" "),
        };
      })(),
    }));
    assert.equal(characterBoard.view, "character");
    assert.equal(characterBoard.rows, 100, "character board should cap each page at 100 rows");
    assert.equal(characterBoard.map, "none", "character board should hide the map");
    assert.equal(characterBoard.viewSwitch, "none", "character board should not show the map board switcher");
    assert.equal(characterBoard.foreignFilters, 0, "character board should only show character filters");
    assert.equal(characterBoard.roleFilters, 2, "character board should keep source and gender filters");
    assert.equal(characterBoard.row.display, "flex", "character rows should use a dedicated non-map layout");
    assert.equal(characterBoard.row.gridTemplateColumns, "none", "character rows should not inherit country grid columns");
    assert.notEqual(characterBoard.row.overflow, "normal", "character names should wrap inside the list row");
    assert.equal(characterBoard.row.rowOverflow, false, "character row content should stay inside the list");
    assert.equal(characterBoard.row.keyText, characterBoard.row.rowKey, "character rows should show the English key");
    assert.equal(characterBoard.row.keyTextAlign, "right", "character keys should align to the right");
    assert.equal(characterBoard.row.keyWhiteSpace, "nowrap", "character keys should stay on one line");
    assert.ok(characterBoard.row.keyWidth >= 140, `character key column should not collapse: ${JSON.stringify(characterBoard.row)}`);
    assert.ok(characterBoard.row.keyHeight <= 24, `character keys should not break into narrow vertical strips: ${JSON.stringify(characterBoard.row)}`);
    assert.ok(characterBoard.row.identityCount >= 2, "character rows should show default identity labels");
    assert.equal(characterBoard.row.inlineIdentityCount, 2, "character identity icons should follow the Chinese name");
    assert.equal(characterBoard.row.separateIdentityRow, false, "character identity icons should not occupy a separate row");
    assert.equal(characterBoard.row.interestGroupIcon, true, "character rows should show the interest-group icon");
    assert.equal(characterBoard.row.ideologyIcon, true, "character rows should show the ideology icon");
    assert.doesNotMatch(characterBoard.row.identityText, /(?:^|\s)(?:ig|ideology)_[a-z0-9_]+/i, "identity labels should use localized names");
    assert.equal(characterBoard.nav, true, "name-pool navigation should be present");
    assert.match(characterBoard.count, /1[，,]?983|1983/, "character count should report all templates");
    const pagination = await desktop.evaluate(() => ({
      controls: document.querySelectorAll(".character-pagination").length,
      pages: document.querySelectorAll(".character-pagination-page").length,
      current: document.querySelector('.character-pagination-page[aria-current="page"]')?.textContent.trim() || "",
      nextDisabled: document.querySelector('[data-character-page="next"]')?.disabled ?? true,
    }));
    assert.equal(pagination.controls, 2, "character list should render pagination above and below the rows");
    assert.equal(pagination.pages / pagination.controls, 20, "1983 characters should produce 20 pages at 100 rows per page");
    assert.equal(pagination.current, "1", "character list should start on page 1");
    assert.equal(pagination.nextDisabled, false, "the first page should enable the next control");

    const firstPageKey = await desktop.evaluate(() => document.querySelector("[data-character-key]")?.dataset.characterKey || "");
    await desktop.evaluate(() => document.querySelector('[data-character-page="next"]')?.click());
    await desktop.waitFor(() => document.querySelector('.character-pagination-page[aria-current="page"]')?.textContent.trim() === "2", "character page 2");
    const secondPage = await desktop.evaluate(() => ({
      firstKey: document.querySelector("[data-character-key]")?.dataset.characterKey || "",
      rows: document.querySelectorAll("[data-character-key]").length,
      current: document.querySelector('.character-pagination-page[aria-current="page"]')?.textContent.trim() || "",
    }));
    assert.equal(secondPage.rows, 100, "page 2 should also contain at most 100 rows");
    assert.notEqual(secondPage.firstKey, firstPageKey, "page 2 should show a different first character");
    assert.equal(secondPage.current, "2", "page 2 should be marked current");

    await desktop.evaluate(() => document.querySelector('[data-character-source="starting"]')?.click());
    await desktop.waitFor(() => document.querySelector('.character-pagination-page[aria-current="page"]')?.textContent.trim() === "1", "filtered character page 1");
    assert.equal(await desktop.evaluate(() => document.querySelector('.character-pagination-page[aria-current="page"]')?.textContent.trim() || ""), "1", "character filters should reset pagination to page 1");

    await desktop.evaluate(() => document.querySelector("[data-character-key]")?.click());
    await desktop.waitFor(() => Boolean(document.querySelector(".character-detail")), "character detail");
    const characterDetail = await desktop.evaluate(() => ({ hash: location.hash, fields: document.querySelector(".character-detail")?.textContent || "" }));
    assert.match(characterDetail.hash, /^#\/character\//);
    assert.match(characterDetail.fields, /DNA/);
    assert.match(characterDetail.fields, /开局历史|Starting history/);
    await desktop.evaluate(() => document.querySelector('[data-detail-back="character"]')?.click());
    await desktop.waitFor(() => Boolean(document.querySelector("[data-character-key]")), "character list after detail back");
    assert.equal(await desktop.evaluate(() => document.querySelector('.character-pagination-page[aria-current="page"]')?.textContent.trim() || ""), "1", "returning from detail should keep the filtered page");

    await desktop.evaluate(() => document.querySelector('[data-character-source="starting"]')?.click());
    await desktop.waitFor(() => document.querySelector('[data-character-source="starting"]')?.getAttribute("aria-pressed") === "false", "clear character source filter");

    const historicalImageTag = await desktop.evaluate(() => ({
      text: document.querySelector('[data-character-key="ada_lovelace_template"] .tag-historical-image')?.textContent.trim() || "",
      absentOnUnmatchedCharacter: !document.querySelector('[data-character-key="ABU_khalifa_al_nahyan"] .tag-historical-image'),
    }));
    assert.match(historicalImageTag.text, /有史实图片|Historical image/, "confirmed characters should show the historical-image tag");
    assert.equal(historicalImageTag.absentOnUnmatchedCharacter, true, "unmatched characters should not show the historical-image tag");
    const einsteinImageTag = await desktop.evaluate(() => document.querySelector('[data-character-key="albert_einstein_template"] .tag-historical-image')?.textContent.trim() || "");
    assert.match(einsteinImageTag, /有史实图片|Historical image/, "manually reviewed Einstein should show the historical-image tag");
    if (screenshotDir) await desktop.screenshot(path.join(screenshotDir, "historical-character-list.png"));

    await desktop.goto(`http://127.0.0.1:${port}/index.html#/character/ada_lovelace_template`);
    await desktop.waitFor(() => {
      const image = document.querySelector(".character-historical-image img");
      return Boolean(image?.complete && image.naturalWidth > 0);
    }, "historical character image");
    const imageDetail = await desktop.evaluate(() => {
      const figure = document.querySelector(".character-historical-image");
      const image = figure?.querySelector("img");
      const source = figure?.querySelector('a[href*="commons.wikimedia.org"]');
      return {
        complete: image?.complete,
        naturalWidth: image?.naturalWidth || 0,
        source: source?.href || "",
        text: figure?.textContent || "",
      };
    });
    assert.equal(imageDetail.complete, true, "historical image should finish loading");
    assert.ok(imageDetail.naturalWidth > 0, "historical image should have natural dimensions");
    assert.match(imageDetail.source, /^https:\/\/commons\.wikimedia\.org\//, "historical image should link to its Commons file page");
    assert.match(imageDetail.text, /照片|Photograph/, "historical image should show its localized type");
    if (screenshotDir) await desktop.screenshot(path.join(screenshotDir, "historical-character-desktop.png"));

    await desktop.goto(`http://127.0.0.1:${port}/index.html#/character/albert_einstein_template`);
    await desktop.waitFor(() => {
      const image = document.querySelector(".character-historical-image img");
      return Boolean(image?.complete && image.naturalWidth > 0);
    }, "Einstein historical character image");
    const einsteinImageDetail = await desktop.evaluate(() => ({
      source: document.querySelector('.character-historical-image a[href*="commons.wikimedia.org"]')?.href || "",
      image: document.querySelector(".character-historical-image img")?.src || "",
      text: document.querySelector(".character-historical-image")?.textContent || "",
    }));
    assert.match(einsteinImageDetail.source, /Einstein_1921_by_F_Schmutzer_-_restoration\.jpg/, "Einstein detail should link to the reviewed Commons file");
    assert.match(einsteinImageDetail.image, /Einstein_1921_by_F_Schmutzer_-_restoration\.jpg/, "Einstein detail should load the reviewed thumbnail");
    assert.match(einsteinImageDetail.text, /照片|Photograph/, "Einstein detail should identify the image as a photograph");
    if (screenshotDir) await desktop.screenshot(path.join(screenshotDir, "historical-character-einstein.png"));

    await desktop.goto(`http://127.0.0.1:${port}/index.html#/character/usa_andrew_jackson_template`);
    await desktop.waitFor(() => {
      const image = document.querySelector(".character-historical-image img");
      return Boolean(image?.complete && image.naturalWidth > 0);
    }, "Andrew Jackson historical character image");
    const jacksonImageDetail = await desktop.evaluate(() => ({
      source: document.querySelector('.character-historical-image a[href*="commons.wikimedia.org"]')?.href || "",
      text: document.querySelector(".character-historical-image")?.textContent || "",
    }));
    assert.match(jacksonImageDetail.source, /Andrew_jackson_head\.jpg/, "Andrew Jackson detail should link to the reviewed Commons file");
    assert.match(jacksonImageDetail.text, /肖像画|Painting/, "Andrew Jackson detail should identify the image as a painting");

    await desktop.goto(`http://127.0.0.1:${port}/index.html#/character/GRE_alexandros_koumoundouros`);
    await desktop.waitFor(() => {
      const image = document.querySelector(".character-historical-image img");
      return Boolean(image?.complete && image.naturalWidth > 0);
    }, "Alexandros Koumoundouros historical character image");
    const koumoundourosImageDetail = await desktop.evaluate(() => ({
      source: document.querySelector('.character-historical-image a[href*="commons.wikimedia.org"]')?.href || "",
      text: document.querySelector(".character-historical-image")?.textContent || "",
    }));
    assert.match(koumoundourosImageDetail.source, /Alexandros_Koumoundouros\.png/, "Alexandros Koumoundouros detail should link to the reviewed Commons file");
    assert.match(koumoundourosImageDetail.text, /肖像画|Painting/, "Alexandros Koumoundouros detail should identify the image as a painting");

    await desktop.goto(`http://127.0.0.1:${port}/index.html#/character/BIC_amy_carmichael`);
    await desktop.waitFor(() => Boolean(document.querySelector(".character-detail")), "Amy Carmichael character detail");
    assert.equal(await desktop.evaluate(() => Boolean(document.querySelector(".character-historical-image"))), false, "rejected Amy Carmichael group image should not be shown");

    for (const key of ["BRZ_anesia_cauacu", "GBR_andrew_scott_waugh", "agitator_alexandru_bogdan_pitesti"]) {
      await desktop.goto(`http://127.0.0.1:${port}/index.html#/character/${key}`);
      await desktop.waitFor(() => Boolean(document.querySelector(".character-detail")), `${key} character detail`);
      assert.equal(await desktop.evaluate(() => Boolean(document.querySelector(".character-historical-image"))), false, `${key} rejected image should not be shown`);
    }

    for (const key of ["DEN_arnold_peter_moller", "mug_bakht_khan", "BIC_dwarkanath_tagore", "sar_general_de_sonnaz", "VNZ_francisco_linares_alcantara", "AST_george_fife_angas", "SER_gligorije_vozarevic", "BIC_haji_shariatullah", "mon_kenjo_jankoviC_", "TRN_louis_tregardt", "ASM_maniram_dewan_template", "CHL_manuel_garcia_banqueda", "BAV_max_stirner", "BIC_mithuben_petit", "pan_nau_nihal_singh", "SPA_nazario_equia"]) {
      await desktop.goto(`http://127.0.0.1:${port}/index.html#/character/${key}`);
      await desktop.waitFor(() => Boolean(document.querySelector(".character-detail")), `${key} character detail`);
      assert.equal(await desktop.evaluate(() => Boolean(document.querySelector(".character-historical-image"))), false, `${key} rejected image should not be shown`);
    }

    await desktop.goto(`http://127.0.0.1:${port}/index.html#/character/ABU_khalifa_al_nahyan`);
    await desktop.waitFor(() => Boolean(document.querySelector(".character-detail .tag-trait")), "localized character trait");
    const traitText = await desktop.evaluate(() => document.querySelector(".character-detail .tag-trait")?.textContent || "");
    assert.notEqual(traitText.trim().toLowerCase(), "imperious", "character traits should use the installed localization");

    await desktop.goto(`http://127.0.0.1:${port}/index.html#/name-pool`);
    await desktop.waitFor(() => document.querySelectorAll("[data-name-pool-key]").length === 317, "name-pool rows");
    const poolBoard = await desktop.evaluate(() => ({
      view: document.body.dataset.view,
      rows: document.querySelectorAll("[data-name-pool-key]").length,
      map: getComputedStyle(document.querySelector("#mapPanel")).display,
    }));
    assert.deepEqual(poolBoard, { view: "name-pool", rows: 317, map: "none" });
    await desktop.evaluate(() => document.querySelector("[data-name-pool-key]")?.click());
    await desktop.waitFor(() => document.querySelectorAll(".name-pool-group").length === 9, "name-pool detail");
    assert.match(await desktop.evaluate(() => location.hash), /^#\/name-pool\//);
    await desktop.close();

    const mobile = await browser.openPage({ width: 390, height: 844 });
    await mobile.goto(`http://127.0.0.1:${port}/index.html#/character/ada_lovelace_template`);
    await mobile.waitFor(() => Boolean(document.querySelector(".character-historical-image img")), "mobile character detail image");
    const mobileLayout = await mobile.evaluate(() => {
      const detail = document.querySelector(".detail");
      const figure = document.querySelector(".character-historical-image");
      const detailRect = detail?.getBoundingClientRect();
      const figureRect = figure?.getBoundingClientRect();
      return {
        results: getComputedStyle(document.querySelector(".results")).display,
        detail: getComputedStyle(detail).display,
        imageInsideDetail: Boolean(detailRect && figureRect && figureRect.left >= detailRect.left && figureRect.right <= detailRect.right),
        documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    assert.equal(mobileLayout.results, "none", "mobile character detail should replace the list");
    assert.notEqual(mobileLayout.detail, "none", "mobile character detail should remain visible");
    assert.equal(mobileLayout.imageInsideDetail, true, "mobile historical image should stay inside the detail panel");
    assert.equal(mobileLayout.documentOverflow, false, "mobile historical image should not cause document overflow");
    if (screenshotDir) await mobile.screenshot(path.join(screenshotDir, "historical-character-mobile.png"));
    await mobile.close();

    const wide = await browser.openPage({ width: 2048, height: 1024 });
    await wide.goto(`http://127.0.0.1:${port}/index.html#/character/ada_lovelace_template`);
    await wide.waitFor(() => {
      const results = document.querySelector(".results")?.getBoundingClientRect();
      const detail = document.querySelector(".detail")?.getBoundingClientRect();
      const image = document.querySelector(".character-historical-image img");
      return Boolean(document.querySelector(".character-detail") && image?.complete && image.naturalWidth > 0 && results && detail && detail.right >= innerWidth - 20 && results.right <= detail.left - 1);
    }, "wide character layout");
    const wideLayout = await wide.evaluate(() => {
      const results = document.querySelector(".results").getBoundingClientRect();
      const detail = document.querySelector(".detail").getBoundingClientRect();
      return { resultsWidth: results.width, detailWidth: detail.width, resultsRight: results.right, detailLeft: detail.left, detailRight: detail.right, viewport: innerWidth };
    });
    assert.ok(wideLayout.detailRight >= wideLayout.viewport - 20, `wide detail should stay at the right edge: ${JSON.stringify(wideLayout)}`);
    assert.ok(wideLayout.resultsRight <= wideLayout.detailLeft - 1, `wide list and detail must not overlap: ${JSON.stringify(wideLayout)}`);
    assert.ok(wideLayout.detailWidth >= 560, `wide detail should be wider than the old map-style panel: ${JSON.stringify(wideLayout)}`);
    assert.ok(wideLayout.resultsWidth <= 1120, `wide list should be narrower than the old map-style list: ${JSON.stringify(wideLayout)}`);
    if (screenshotDir) await wide.screenshot(path.join(screenshotDir, "historical-character-wide.png"));
    await wide.close();
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify({ character_board_browser: "ok", historical_characters: 1983, name_pools: 317 }, null, 2));
} finally {
  site.kill();
  chrome.kill();
}

function fsTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

async function freePort() {
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const value = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return value;
}

async function fetchJson(url) {
  const response = await fetch(url);
  return response.json();
}

async function waitFor(task, description) {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    try { const value = await task(); if (value) return value; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${description} timed out`);
}

async function cdpConnect(url) {
    const socket = new WebSocket(url);
    const pending = new Map();
    const events = new Map();
    let sequence = 0;
    await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) { const deferred = pending.get(message.id); pending.delete(message.id); deferred?.resolve(message); return; }
      const waiters = events.get(message.method) || [];
      events.delete(message.method);
      waiters.forEach((deferred) => deferred.resolve(message));
    });
    const send = (method, params = {}) => {
      const id = ++sequence;
      const result = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      socket.send(JSON.stringify({ id, method, params }));
      return result.then((message) => { if (message.error) throw new Error(message.error.message); return message.result || {}; });
    };
    const next = (method) => new Promise((resolve) => events.set(method, [...(events.get(method) || []), { resolve }]));
    const openPage = async (viewport) => {
      const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
      const page = await cdpConnect(target.webSocketDebuggerUrl);
      await page.send("Page.enable");
      await page.send("Runtime.enable");
      await page.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
      page.goto = async (url) => { const loaded = page.next("Page.loadEventFired"); const hash = page.next("Page.navigatedWithinDocument"); await page.send("Page.navigate", { url }); await Promise.race([loaded, hash]); await new Promise((resolve) => setTimeout(resolve, 300)); };
      page.evaluate = async (fn, ...args) => { const serialized = args.map((value) => JSON.stringify(value)).join(","); const result = await page.send("Runtime.evaluate", { expression: `(${fn})(${serialized})`, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "browser evaluation failed"); return result.result?.value; };
      page.waitFor = async (fn, description) => waitFor(() => page.evaluate(fn), description);
      page.screenshot = async (file) => {
        const result = await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, Buffer.from(result.data, "base64"));
      };
      page.close = () => page.send("Page.close");
      return page;
    };
    return { send, next, openPage, close: () => socket.close() };
}
