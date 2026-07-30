import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:8877/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9235;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });

try {
  const page = await openPage({ width: 390, height: 844 });
  await page.goto(`${baseUrl}#/culture`);
  await page.waitFor(() => Boolean(document.querySelector("#mobileCultureToolbar") && document.querySelector("[data-culture]")), "文化窄屏页面加载");

  const initial = await page.evaluate(() => ({
    toolbar: getComputedStyle(document.querySelector("#mobileCultureToolbar")).display,
    map: getComputedStyle(document.querySelector("#mapPanel")).display,
    filtersHidden: document.querySelector("#mobileCultureFilterPanel").hidden,
    filterPanelDisplay: getComputedStyle(document.querySelector("#mobileCultureFilterPanel")).display,
    mapFilterTool: getComputedStyle(document.querySelector("#leftPanelToggle")).display,
    mapListTool: getComputedStyle(document.querySelector("#bottomPanelToggle")).display,
    mapRect: document.querySelector("#mapPanel").getBoundingClientRect().toJSON(),
    mapResetRect: document.querySelector("#mapFitWidthButton").getBoundingClientRect().toJSON(),
    resultsRect: document.querySelector(".results").getBoundingClientRect().toJSON(),
  }));
  assert.notEqual(initial.toolbar, "none", "紧凑视口必须显示文化工具栏");
  assert.notEqual(initial.map, "none", "文化页面默认必须显示地图");
  assert.equal(initial.filtersHidden, true, "文化页面默认必须收起筛选区");
  assert.equal(initial.filterPanelDisplay, "none", "收起筛选区不能保留边框");
  assert.equal(initial.mapFilterTool, "none", "文化窄屏地图不应显示筛选收起按钮");
  assert.equal(initial.mapListTool, "none", "文化窄屏地图不应显示列表收起按钮");
  assert.ok(Math.abs(initial.mapResetRect.top - initial.mapRect.top - 10) < 2, "地图重置按钮必须位于右上角");
  assert.ok(Math.abs(initial.mapRect.right - initial.mapResetRect.right - 10) < 2, "地图重置按钮必须位于右上角");
  assert.ok(Math.abs(initial.resultsRect.left - initial.mapRect.left) < 2 && Math.abs(initial.resultsRect.right - initial.mapRect.right) < 2, "文化列表必须与地图左右对齐");

  const initialCount = await page.count("[data-culture]");
  await page.fill("[data-mobile-culture-search]", "不可能的文化关键词");
  assert.equal(await page.count("[data-culture]"), initialCount, "输入文化关键词时不得立即刷新列表");
  await page.click("[data-mobile-culture-search-submit]");
  await page.waitFor(() => document.querySelectorAll("[data-culture]").length === 0, "文化关键词仅在点击搜索后生效");
  await page.fill("[data-mobile-culture-search]", "");
  await page.keydown("[data-mobile-culture-search]", "Enter");
  await page.waitFor(() => document.querySelectorAll("[data-culture]").length > 0, "回车应提交文化关键词");

  await page.click("[data-mobile-culture-filter-toggle]");
  await page.waitFor(() => !document.querySelector("#mobileCultureFilterPanel").hidden, "展开文化筛选区");
  const heritageGroup = "[data-mobile-culture-expand-heritage-group]";
  await page.click(heritageGroup);
  assert.equal(await page.count("[data-mobile-culture-filter-chip]"), 0, "传承组只能展开，不能生成筛选标签");
  await page.click("[data-mobile-culture-filter-option][data-mobile-culture-filter-category='heritage']");
  await page.waitFor(() => document.querySelectorAll("[data-mobile-culture-filter-chip='heritage']").length === 1, "具体传承必须生成筛选标签");

  await page.click("[data-mobile-culture-filter-category='language']");
  await page.click("[data-mobile-culture-expand-language-group]");
  assert.equal(await page.count("[data-mobile-culture-filter-chip='language']"), 0, "语言组只能展开，不能生成筛选标签");
  await page.click("[data-mobile-culture-filter-option][data-mobile-culture-filter-category='language']");
  await page.waitFor(() => document.querySelectorAll("[data-mobile-culture-filter-chip='language']").length === 1, "具体语言必须生成筛选标签");

  await page.click("[data-mobile-culture-filter-category='tradition']");
  await page.click("[data-mobile-culture-filter-option][data-mobile-culture-filter-category='tradition']");
  await page.waitFor(() => document.querySelectorAll("[data-mobile-culture-filter-chip='tradition']").length === 1, "传统必须直接生成筛选标签");

  await page.click("[data-mobile-culture-filter-category='strategicRegion']");
  await page.click("[data-mobile-culture-expand-strategic-region-continent]");
  assert.equal(await page.count("[data-mobile-culture-filter-chip='strategicRegion']"), 0, "洲别只能展开，不能生成筛选标签");
  await page.click("[data-mobile-culture-filter-option][data-mobile-culture-filter-category='strategicRegion']");
  await page.waitFor(() => document.querySelectorAll("[data-mobile-culture-filter-chip='strategicRegion']").length === 1, "具体战略区域必须生成筛选标签");

  await page.click("[data-mobile-culture-filter-clear='heritage']");
  assert.equal(await page.count("[data-mobile-culture-filter-chip='heritage']"), 0, "删除标签必须清除实际条件");
  await page.click("[data-mobile-culture-map-toggle]");
  await page.waitFor(() => getComputedStyle(document.querySelector("#mapPanel")).display === "none", "文化地图可收起");
  await page.click("[data-mobile-culture-map-toggle]");
  await page.waitFor(() => getComputedStyle(document.querySelector("#mapPanel")).display !== "none", "文化地图可展开");

  await page.goto(`${baseUrl}?culture-selection=1#/culture`);
  await page.waitFor(() => document.querySelectorAll("[data-culture]").length > 0, "文化列表重新加载");
  await page.click("[data-culture]");
  await page.waitFor(() => document.querySelector("[data-culture][aria-current='true']"), "文化卡片选中状态");
  assert.equal(await page.evaluate(() => document.querySelector("#mapSubjectSelect")?.value), await page.evaluate(() => document.querySelector("[data-culture][aria-current='true']")?.dataset.culture), "选中文化卡片后地图必须切换到该文化关系视图");
  assert.equal(await page.evaluate(() => location.hash), "#/culture", "点击文化卡片不能进入详情");

  await page.evaluate(() => window.scrollTo(0, 480));
  await page.waitFor(() => window.scrollY > 100, "文化列表滚动位置");
  const scrollBeforeDetail = await page.evaluate(() => window.scrollY);
  await page.click("[data-culture-detail]");
  await page.waitFor(() => location.hash.startsWith("#/culture/"), "文化详情路由");
  await page.waitFor(() => getComputedStyle(document.querySelector(".detail")).display !== "none", "文化详情面板");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#mapPanel")).display), "none", "文化详情必须隐藏地图");
  await page.click("[data-culture-mobile-detail-back]");
  await page.waitFor(() => location.hash === "#/culture" && document.querySelectorAll("[data-culture]").length > 0, "文化详情返回列表");
  assert.ok(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBeforeDetail) < 8, "文化详情返回必须恢复滚动位置");

  await page.goto(`${baseUrl}?culture-browser-back=1#/culture`);
  await page.waitFor(() => document.querySelectorAll("[data-culture]").length > 0, "原生后退测试的文化列表加载");
  await page.evaluate(() => window.scrollTo(0, 480));
  await page.waitFor(() => window.scrollY > 100, "原生后退测试的文化列表滚动位置");
  const browserBackScroll = await page.evaluate(() => window.scrollY);
  await page.click("[data-culture-detail]");
  await page.waitFor(() => location.hash.startsWith("#/culture/"), "原生后退测试的文化详情路由");
  await page.evaluate(() => history.back());
  await page.waitFor(() => location.hash === "#/culture" && document.querySelectorAll("[data-culture]").length > 0, "浏览器后退返回文化列表");
  await page.waitFor(() => window.scrollY > 0, "浏览器后退后的滚动位置");
  const browserBackFinalScroll = await page.evaluate(() => window.scrollY);
  assert.ok(Math.abs(browserBackFinalScroll - browserBackScroll) < 8, `浏览器后退必须恢复文化列表滚动位置：${browserBackScroll} → ${browserBackFinalScroll}`);

  await page.setViewport({ width: 1200, height: 900 });
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.querySelector("#mobileCultureToolbar")).display), "none", "1200×900 仍属于紧凑布局");
  await page.setViewport({ width: 1600, height: 900 });
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#mobileCultureToolbar")).display), "none", "1600×900 应使用桌面布局");
  await page.close();
  console.log(JSON.stringify({ culture_mobile_narrow_screen_browser: "ok", base_url: baseUrl }, null, 2));
} finally {
  chrome.kill();
}

async function openPage(viewport) {
  await waitForDebugger();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: true });
  return {
    async goto(url) {
      const loaded = session.next("Page.loadEventFired");
      const hashNavigated = session.next("Page.navigatedWithinDocument");
      await session.send("Page.navigate", { url });
      await Promise.race([loaded, hashNavigated]);
      await delay(150);
    },
    async setViewport(nextViewport) {
      await session.send("Emulation.setDeviceMetricsOverride", { width: nextViewport.width, height: nextViewport.height, deviceScaleFactor: 1, mobile: true });
      await delay(80);
    },
    async evaluate(callback, ...args) {
      const serializedArgs = args.map((value) => JSON.stringify(value)).join(",");
      const result = await session.send("Runtime.evaluate", { expression: `(${callback})(${serializedArgs})`, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "浏览器表达式执行失败");
      return result.result.value;
    },
    async waitFor(predicate, description) {
      const end = Date.now() + 20000;
      while (Date.now() < end) {
        if (await session.evaluate(predicate)) return;
        await delay(50);
      }
      throw new Error(`${description} 超时`);
    },
    click(selector) {
      return this.evaluate((target) => {
        const element = document.querySelector(target);
        if (!element) throw new Error(`找不到元素：${target}`);
        element.click();
      }, selector);
    },
    async fill(selector, value) {
      await this.evaluate((target, nextValue) => {
        const input = document.querySelector(target);
        if (!input) throw new Error(`找不到元素：${target}`);
        input.focus();
        input.value = nextValue;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }, selector, value);
    },
    keydown(selector, key) {
      return this.evaluate((target, nextKey) => document.querySelector(target)?.dispatchEvent(new KeyboardEvent("keydown", { key: nextKey, bubbles: true })), selector, key);
    },
    count(selector) {
      return this.evaluate((target) => document.querySelectorAll(target).length, selector);
    },
    close() {
      session.close();
    },
  };
}

async function waitForDebugger() {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    try {
      await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      return;
    } catch {
      await delay(50);
    }
  }
  throw new Error("Chrome 调试端口未启动");
}

async function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const events = new Map();
  let sequence = 0;
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const deferred = pending.get(message.id);
      pending.delete(message.id);
      deferred?.resolve(message);
      return;
    }
    const waiters = events.get(message.method) || [];
    events.delete(message.method);
    waiters.forEach((deferred) => deferred.resolve(message));
  });
  return {
    send(method, params = {}) {
      const id = ++sequence;
      const response = new Promise((resolve) => pending.set(id, { resolve }));
      socket.send(JSON.stringify({ id, method, params }));
      return response.then((message) => {
        if (message.error) throw new Error(message.error.message);
        return message.result || {};
      });
    },
    next(method) {
      return new Promise((resolve) => events.set(method, [...(events.get(method) || []), { resolve }]));
    },
    async evaluate(predicate) {
      const result = await this.send("Runtime.evaluate", { expression: `Boolean((${predicate})())`, returnByValue: true, awaitPromise: true });
      return Boolean(result.result.value);
    },
    close() {
      socket.close();
    },
  };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
