import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const mainBaseUrl = process.argv[2] || "http://127.0.0.1:4173/index.html";
const vcBaseUrl = process.argv[3] || "http://127.0.0.1:4173/vc/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9242;
const chrome = spawn(chromePath, [
  `--remote-debugging-port=${debugPort}`,
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "about:blank",
], { stdio: "ignore", windowsHide: true });

try {
  const page = await openPage({ width: 1680, height: 1050 });
  await checkGoodsLazyLoading(page);
  await checkVanillaSubstitutes(page);
  await checkVanillaWealth(page);
  await checkWealthDividerAlignment(page, "vanilla");
  await checkEnglishNeeds(page);
  await checkVictorianCenturyComparison(page);
  await checkWealthDividerAlignment(page, "victorian century");
  assert.deepEqual(page.problems, [], `desktop needs routes raised browser errors: ${JSON.stringify(page.problems)}`);
  await page.close();

  const narrowPage = await openPage({ width: 390, height: 844 });
  await checkNarrowWealth(narrowPage);
  assert.deepEqual(narrowPage.problems, [], `narrow needs route raised browser errors: ${JSON.stringify(narrowPage.problems)}`);
  await narrowPage.close();

  const portraitPage = await openPage({ width: 826, height: 1200 });
  await checkNarrowPortraitBlankSpace(portraitPage);
  assert.deepEqual(portraitPage.problems, [], `826px portrait needs routes raised browser errors: ${JSON.stringify(portraitPage.problems)}`);
  await portraitPage.close();
  console.log(JSON.stringify({
    goods_needs_browser: "ok",
    main: mainBaseUrl,
    victorian_century: vcBaseUrl,
    verified: ["substitutes", "wealth", "locales", "vc-comparison", "narrow-scroll", "portrait-826-blank-space", "wealth-divider-alignment"],
  }, null, 2));
} finally {
  chrome.kill();
}

async function checkGoodsLazyLoading(page) {
  await page.goto(routeUrl(mainBaseUrl, "zh-Hans", "goods", true));
  await page.waitFor(() => document.querySelectorAll("[data-good-key]").length > 0, "ordinary goods list");
  const resources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
  assert.equal(resources.some((name) => /data-needs\.js(?:\?|$)/.test(name)), false, "ordinary goods routes must not request the needs data chunk");
}

async function checkVanillaSubstitutes(page) {
  await page.goto(routeUrl(mainBaseUrl, "zh-Hans", "goods/needs/substitutes", true));
  await page.waitFor(() => document.querySelectorAll(".needs-substitutes-row").length === 15, "vanilla substitutes table");
  const view = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".needs-substitutes-row")];
    const goods = [...document.querySelectorAll(".needs-substitute-good")];
    const basicFood = document.querySelector("[data-good-key='grain']")?.closest(".needs-substitutes-row");
    const crude = rows.find((row) => row.querySelector(".needs-substitute-label")?.textContent.includes("粗制物品"));
    return {
      hash: location.hash,
      outerButtons: [...document.querySelectorAll("[data-goods-panel]")].map((button) => [button.textContent.trim(), button.getAttribute("aria-pressed")]),
      tableButtons: [...document.querySelectorAll("[data-needs-table]")].map((button) => [button.textContent.trim(), button.getAttribute("aria-pressed")]),
      rowCount: rows.length,
      uniqueRowHeights: [...new Set(rows.map((row) => Math.round(row.getBoundingClientRect().height)))],
      relationCount: goods.length,
      individualBorders: goods.some((item) => getComputedStyle(item).borderTopStyle !== "none"),
      individualBackgrounds: goods.some((item) => getComputedStyle(item).backgroundColor !== "rgba(0, 0, 0, 0)"),
      maxIconHeight: Math.max(...goods.map((item) => item.querySelector("img")?.getBoundingClientRect().height || 0)),
      basicFoodRange: basicFood?.querySelector(".needs-substitute-active")?.getBoundingClientRect().width || 0,
      crudeBoundaries: [...(crude?.querySelectorAll(".needs-range-boundary") || [])].map((item) => item.textContent.trim()),
      fullRangeBoundaries: rows.slice(0, 2).map((row) => row.querySelectorAll(".needs-range-boundary").length),
      compareButton: Boolean(document.querySelector("[data-needs-compare]")),
      detail: document.querySelector("#detail")?.textContent?.trim() || "",
      map: getComputedStyle(document.querySelector("#mapPanel")).display,
      filters: getComputedStyle(document.querySelector(".filters")).display,
    };
  });
  assert.equal(view.hash, "#/goods/needs/substitutes");
  assert.deepEqual(view.outerButtons, [["商品列表", "false"], ["人群需求", "true"]]);
  assert.deepEqual(view.tableButtons, [["需求与商品", "true"], ["财富等级需求量", "false"]]);
  assert.equal(view.rowCount, 15);
  assert.equal(view.relationCount, 52);
  assert(view.uniqueRowHeights.length >= 2, "substitute rows must expand according to their contents");
  assert.equal(view.individualBorders, false, "individual goods must not have borders");
  assert.equal(view.individualBackgrounds, false, "individual goods must not have colored backgrounds");
  assert(view.maxIconHeight <= 22.5, "substitute icons must remain close to text height");
  assert(view.basicFoodRange > 0, "basic food range must render");
  assert.deepEqual(view.crudeBoundaries, ["5", "14"]);
  assert.deepEqual(view.fullRangeBoundaries, [0, 0], "wealth boundaries 1 and 99 must be omitted");
  assert.equal(view.compareButton, false, "vanilla must not expose a comparison toggle");
  assert.equal(view.detail, "");
  assert.equal(view.map, "none");
  assert.equal(view.filters, "none");
}

async function checkVanillaWealth(page) {
  await page.click("[data-needs-table='wealth']");
  await page.waitFor(() => location.hash === "#/goods/needs/wealth" && document.querySelectorAll(".needs-wealth-head-level").length === 99, "vanilla wealth table");
  const view = await page.evaluate(() => {
    const cell = (needKey, level) => document.querySelector(`[data-need-key='${needKey}']`)?.querySelectorAll("td")[level - 1]?.innerText.trim() || "";
    const style = (selector) => getComputedStyle(document.querySelector(selector));
    return {
      needRows: document.querySelectorAll(".needs-wealth-need-row").length,
      tierSpans: [...document.querySelectorAll(".needs-wealth-tier")].map((cell) => Number(cell.colSpan)),
      grayLines: document.querySelectorAll(".needs-wealth-line-layer > span").length,
      tierLines: document.querySelectorAll(".needs-tier-divider").length,
      z: {
        gray: style(".needs-wealth-line-layer").zIndex,
        tier: style(".needs-tier-line-layer").zIndex,
        project: style("tbody .needs-wealth-project-cell").zIndex,
        projectHead: style("thead .needs-wealth-project-cell").zIndex,
      },
      basicFood1: cell("popneed_basic_food", 1),
      communication20: cell("popneed_communication", 20),
      minorDigits: document.querySelectorAll(".needs-number-minor").length,
      firstColumnIcons: document.querySelectorAll(".needs-wealth-project-goods img").length,
      iconOverflowRows: [...document.querySelectorAll(".needs-wealth-project-goods")]
        .filter((group) => group.scrollWidth > group.clientWidth + 1)
        .map((group) => ({
          need: group.closest("tr")?.dataset.needKey || "",
          clientWidth: group.clientWidth,
          scrollWidth: group.scrollWidth,
          projectWidth: group.closest("th")?.clientWidth || 0,
          copyWidth: group.previousElementSibling?.getBoundingClientRect().width || 0,
          icons: group.querySelectorAll("img").length,
        })),
      tableClasses: [...new Set([...document.querySelectorAll(".needs-wealth-table [class*='needs-sol-']")].flatMap((item) => [...item.classList].filter((name) => name.startsWith("needs-sol-"))))],
    };
  });
  assert.equal(view.needRows, 15);
  assert.deepEqual(view.tierSpans, [4, 5, 5, 5, 5, 5, 10, 10, 10, 40]);
  assert.equal(view.grayLines, 89);
  assert.equal(view.tierLines, 9);
  assert.deepEqual(view.z, { gray: "6", tier: "8", project: "10", projectHead: "12" });
  assert.equal(view.basicFood1, "90");
  assert.equal(view.communication20, "16");
  assert(view.minorDigits > 0, "large values must de-emphasize lower digits");
  assert.equal(view.firstColumnIcons, 52, "the first column must restore all goods icons");
  assert.equal(view.iconOverflowRows.length, 0, `first-column goods icons must remain inside the fixed cell: ${JSON.stringify(view.iconOverflowRows)}`);
  assert.equal(view.tableClasses.length, 10, "wealth columns must carry all ten standard-of-living colors");
}

async function checkEnglishNeeds(page) {
  await page.goto(routeUrl(mainBaseUrl, "en", "goods/needs/substitutes", true));
  await page.waitFor(() => document.documentElement.lang === "en" && document.querySelectorAll(".needs-substitutes-row").length === 15, "English needs table");
  const view = await page.evaluate(() => ({
    outer: [...document.querySelectorAll("[data-goods-panel]")].map((button) => button.textContent.trim()),
    tables: [...document.querySelectorAll("[data-needs-table]")].map((button) => button.textContent.trim()),
    names: [...document.querySelectorAll(".needs-substitute-label strong")].map((item) => item.textContent.trim()),
    body: document.querySelector(".needs-shell")?.innerText || "",
  }));
  assert.deepEqual(view.outer, ["Goods List", "Pop Needs"]);
  assert.deepEqual(view.tables, ["Needs and Goods", "Needs by Wealth Level"]);
  assert(view.names.includes("Basic Food"));
  assert.doesNotMatch(view.body, /popneed_|board\.needs\./);
}

async function checkVictorianCenturyComparison(page) {
  await page.goto(routeUrl(vcBaseUrl, "zh-Hans", "goods/needs/substitutes", false));
  await page.waitFor(() => document.querySelectorAll(".needs-substitute-good").length === 53 && document.querySelector("[data-needs-compare]"), "VC substitutes table");
  assert.equal(await page.evaluate(() => document.querySelector("[data-needs-compare]").getAttribute("aria-pressed")), "false");
  await page.click("[data-needs-compare]");
  await page.waitFor(() => document.querySelector("[data-needs-compare]")?.getAttribute("aria-pressed") === "true", "VC comparison enabled");
  const substitutes = await page.evaluate(() => ({
    addedFineArt: Boolean(document.querySelector(".needs-substitute-good[data-good-key='fine_art'] .needs-delta-added")),
    increases: document.querySelectorAll(".needs-substitute-good .needs-delta-increase").length,
    decreases: document.querySelectorAll(".needs-substitute-good .needs-delta-decrease").length,
    shell: document.querySelector(".needs-shell")?.classList.contains("needs-compare-enabled"),
  }));
  assert.equal(substitutes.addedFineArt, true, "VC services must mark fine art as added");
  assert(substitutes.increases > 0);
  assert(substitutes.decreases > 0);
  assert.equal(substitutes.shell, true);

  await page.click("[data-needs-table='wealth']");
  await page.waitFor(() => location.hash === "#/goods/needs/wealth" && document.querySelectorAll(".needs-cell-delta").length > 0, "VC wealth comparison");
  const service62 = await page.evaluate(() => document.querySelector("[data-need-key='popneed_services']")?.querySelectorAll("td")[61]?.innerText.trim() || "");
  assert.match(service62, /^5,284\s*\([+-][\d,]+\)$/);
  if (process.env.VC_NEEDS_SCREENSHOT_DIR) {
    await page.screenshot(path.join(process.env.VC_NEEDS_SCREENSHOT_DIR, "goods-needs-vc-compare.png"));
  }
}

async function checkNarrowWealth(page) {
  await page.goto(routeUrl(mainBaseUrl, "zh-Hans", "goods/needs/wealth", true));
  await page.waitFor(() => document.querySelectorAll(".needs-wealth-head-level").length === 99, "narrow wealth table");
  const view = await page.evaluate(() => {
    const wrap = document.querySelector(".needs-wealth-wrap");
    const project = document.querySelector("tbody .needs-wealth-project-cell");
    const initial = { wrapLeft: wrap.getBoundingClientRect().left, projectLeft: project.getBoundingClientRect().left };
    wrap.scrollLeft = 1200;
    const after = { wrapLeft: wrap.getBoundingClientRect().left, projectLeft: project.getBoundingClientRect().left };
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      resultsTop: document.querySelector(".results")?.getBoundingClientRect().top || 0,
      topbarBottom: document.querySelector(".topbar")?.getBoundingClientRect().bottom || 0,
      innerScrollable: wrap.scrollWidth > wrap.clientWidth,
      initial,
      after,
    };
  });
  assert(view.documentWidth <= view.viewportWidth, "wealth table must not widen the document on a narrow screen");
  assert(view.resultsTop <= view.topbarBottom + 24, `wealth results must begin below the narrow topbar: ${JSON.stringify(view)}`);
  assert.equal(view.innerScrollable, true);
  assert(Math.abs(view.initial.projectLeft - view.initial.wrapLeft) <= 2);
  assert(Math.abs(view.after.projectLeft - view.after.wrapLeft) <= 2, "first column must remain fixed during horizontal scrolling");
  if (process.env.VC_NEEDS_SCREENSHOT_DIR) {
    await page.screenshot(path.join(process.env.VC_NEEDS_SCREENSHOT_DIR, "goods-needs-narrow-wealth.png"));
  }
}

async function checkNarrowPortraitBlankSpace(page) {
  await page.goto(routeUrl(mainBaseUrl, "zh-Hans", "goods/needs/wealth", true));
  await page.waitFor(() => document.querySelectorAll(".needs-wealth-head-level").length === 99, "826px portrait main wealth table");
  const mainView = await page.evaluate(() => ({
    resultsTop: document.querySelector(".results")?.getBoundingClientRect().top || 0,
    topbarBottom: document.querySelector(".topbar")?.getBoundingClientRect().bottom || 0,
    layoutPaddingTop: getComputedStyle(document.querySelector(".layout")).paddingTop,
  }));
  assert(mainView.resultsTop <= mainView.topbarBottom + 24, `main site 826px portrait goods results must begin below the topbar without a large blank gap: ${JSON.stringify(mainView)}`);

  await page.goto(routeUrl(vcBaseUrl, "zh-Hans", "goods/needs/wealth", false));
  await page.waitFor(() => document.querySelectorAll(".needs-wealth-head-level").length === 99, "826px portrait VC wealth table");
  const vcView = await page.evaluate(() => ({
    resultsTop: document.querySelector(".results")?.getBoundingClientRect().top || 0,
    topbarBottom: document.querySelector(".topbar")?.getBoundingClientRect().bottom || 0,
    layoutPaddingTop: getComputedStyle(document.querySelector(".layout")).paddingTop,
  }));
  assert(vcView.resultsTop <= vcView.topbarBottom + 24, `victorian century 826px portrait goods results must begin below the topbar without a large blank gap: ${JSON.stringify(vcView)}`);
}

async function checkWealthDividerAlignment(page, label) {
  const view = await page.evaluate(() => {
    const stage = document.querySelector(".needs-wealth-table-stage");
    const table = document.querySelector(".needs-wealth-table");
    const wrap = document.querySelector(".needs-wealth-wrap");
    const measure = () => [...stage.querySelectorAll(".needs-wealth-line-layer > span[data-level], .needs-tier-divider[data-level]")].map((line) => {
      const headCell = table.querySelector(`.needs-wealth-head-level[data-level="${line.dataset.level}"]`);
      const lineLeft = line.getBoundingClientRect().left;
      const cellLeft = headCell ? headCell.getBoundingClientRect().left : NaN;
      return Math.abs(lineLeft - cellLeft);
    });
    const before = measure();
    wrap.scrollLeft = 900;
    const after = measure();
    return { before, after, count: before.length };
  });
  assert(view.count > 0, `${label} wealth table must expose divider lines to check`);
  assert(view.before.every((diff) => diff <= 1), `${label} wealth divider lines must align with header column boundaries before scroll: ${JSON.stringify(view.before)}`);
  assert(view.after.every((diff) => diff <= 1), `${label} wealth divider lines must align with header column boundaries after horizontal scroll: ${JSON.stringify(view.after)}`);
}

function routeUrl(base, locale, route, versioned) {
  const url = new URL(base);
  url.searchParams.set("lang", locale);
  if (versioned) url.searchParams.set("version", "1.13.9");
  url.hash = `/${route}`;
  return url.href;
}

async function openPage(viewport) {
  await waitForTargets();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
  return {
    goto: async (url) => {
      const loaded = session.next("Page.loadEventFired");
      const hashNavigated = session.next("Page.navigatedWithinDocument");
      await session.send("Page.navigate", { url });
      await Promise.race([loaded, hashNavigated]);
      await new Promise((resolve) => setTimeout(resolve, 150));
    },
    click: async (selector) => {
      const result = await session.send("Runtime.evaluate", { expression: `document.querySelector(${JSON.stringify(selector)})?.click()`, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || `cannot click ${selector}`);
    },
    evaluate: async (expression, ...args) => {
      const serializedArgs = args.map((value) => JSON.stringify(value)).join(",");
      const value = await session.send("Runtime.evaluate", { expression: `(${expression})(${serializedArgs})`, returnByValue: true, awaitPromise: true });
      if (value.exceptionDetails) throw new Error(value.exceptionDetails.text || "browser evaluation failed");
      return value.result.value;
    },
    waitFor: async (predicate, description = "browser condition") => {
      const end = Date.now() + 25000;
      while (Date.now() < end) {
        if (await session.evaluate(predicate)) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(`${description} timed out`);
    },
    screenshot: async (file) => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const result = await session.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      fs.writeFileSync(file, Buffer.from(result.data, "base64"));
    },
    close: async () => session.close(),
    problems: session.problems,
  };
}

async function waitForTargets() {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    try { await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json(); return; } catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
  }
  throw new Error("Chrome debugging endpoint did not start");
}

async function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const events = new Map();
  const problems = [];
  let sequence = 0;
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) { const deferred = pending.get(message.id); pending.delete(message.id); deferred?.resolve(message); return; }
    if (message.method === "Runtime.exceptionThrown") problems.push(message.params?.exceptionDetails?.exception?.description || message.params?.exceptionDetails?.text || "runtime exception");
    if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") problems.push((message.params.args || []).map((argument) => argument.value || argument.description || "").join(" "));
    const waiters = events.get(message.method) || [];
    events.delete(message.method);
    waiters.forEach((deferred) => deferred.resolve(message));
  });
  return {
    send(method, params = {}) {
      const id = ++sequence;
      const response = new Promise((resolve) => pending.set(id, { resolve }));
      socket.send(JSON.stringify({ id, method, params }));
      return response.then((message) => { if (message.error) throw new Error(message.error.message); return message.result || {}; });
    },
    next(method) { return new Promise((resolve) => events.set(method, [...(events.get(method) || []), { resolve }])); },
    async evaluate(predicate) {
      const result = await this.send("Runtime.evaluate", { expression: `Boolean((${predicate})())`, returnByValue: true, awaitPromise: true });
      return Boolean(result.result.value);
    },
    problems,
    close() { socket.close(); },
  };
}
