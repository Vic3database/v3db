import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:8877/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9234;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });

try {
  const page = await openPage({ width: 390, height: 844 });
  await page.goto(`${baseUrl}?homepageUnderlay=1#/home`);
  await page.waitFor(() => document.body.dataset.view === "home", "首页加载");
  const homeUnderlay = await page.evaluate(() => getComputedStyle(document.querySelector(".layout"), "::before").display);
  assert.equal(homeUnderlay, "none", "首页不能保留左侧筛选栏底色");

  await page.goto(`${baseUrl}#/country`);
  await page.waitFor(() => Boolean(document.querySelector("#mobileCountryToolbar") && document.querySelector("[data-country]")), "国家窄屏页面加载");
  let initial = await page.evaluate(() => ({
    toolbar: getComputedStyle(document.querySelector("#mobileCountryToolbar")).display,
    map: getComputedStyle(document.querySelector("#mapPanel")).display,
    filtersHidden: document.querySelector("#mobileCountryFilterPanel").hidden,
    toolbarTop: document.querySelector("#mobileCountryToolbar").getBoundingClientRect().top,
    mapTop: document.querySelector("#mapPanel").getBoundingClientRect().top,
  }));
  assert.notEqual(initial.toolbar, "none", "国家页必须显示窄屏工具栏");
  assert.notEqual(initial.map, "none", "国家页默认必须显示地图");
  assert.equal(initial.filtersHidden, true, "国家页默认必须收起筛选区");
  assert.ok(initial.toolbarTop < initial.mapTop, "窄屏工具栏必须位于地图之前");
  await page.evaluate(() => {
    const input = document.querySelector("[data-mobile-country-search]");
    input.focus();
    input.value = "测试";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitFor(() => document.querySelector("[data-mobile-country-search]")?.value === "测试", "移动搜索关键词同步");
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector("[data-mobile-country-search]")), true, "移动搜索重渲染后必须保留输入焦点");
  await page.evaluate(() => {
    const input = document.querySelector("[data-mobile-country-search]");
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitFor(() => document.querySelectorAll("[data-country]").length > 0, "清空移动搜索关键词");

  await page.click("[data-mobile-country-filter-toggle]");
  await page.waitFor(() => !document.querySelector("#mobileCountryFilterPanel").hidden, "展开国家筛选区");
  const optionLayout = await page.evaluate(() => {
    const options = [...document.querySelectorAll("[data-mobile-country-filter-option]")];
    return {
      count: options.length,
      distinctTops: new Set(options.map((option) => Math.round(option.getBoundingClientRect().top))).size,
      maxWidth: Math.max(...options.map((option) => option.getBoundingClientRect().width)),
      panelWidth: document.querySelector("#mobileCountryFilterPanel").getBoundingClientRect().width,
    };
  });
  assert.ok(optionLayout.count >= 7, "类型分类必须显示完整选项集");
  assert.ok(optionLayout.distinctTops > 1, "窄屏类型选项必须按可用宽度自然换行");
  assert.ok(optionLayout.maxWidth < optionLayout.panelWidth, "窄屏类型选项不得逐项占满整行");
  await page.click("[data-mobile-country-filter-option='existsAtStart']");
  await page.waitFor(() => Boolean(document.querySelector("[data-mobile-country-filter-chip='type']")), "类型筛选标签");
  assert.equal(normalizeText(await page.text("[data-mobile-country-filter-chip='type']")), "开局存在×", "类型筛选标签必须进入搜索框");

  await page.click("[data-mobile-country-filter-option='isReleasable']");
  assert.equal(normalizeText(await page.text("[data-mobile-country-filter-chip='type']")), "可释放×", "同一分类的新条件必须替换旧条件");

  await page.click("[data-mobile-country-filter-category='tier']");
  await page.click("[data-mobile-country-filter-option]");
  assert.equal(await page.count("[data-mobile-country-filter-chip]"), 2, "不同分类的条件必须同时保留");

  await page.click("[data-mobile-country-filter-clear='type']");
  assert.equal(await page.count("[data-mobile-country-filter-chip='type']"), 0, "删除按钮必须清除对应条件");

  await page.click("[data-mobile-country-map-toggle]");
  await page.waitFor(() => getComputedStyle(document.querySelector("#mapPanel")).display === "none", "收起国家地图");
  await page.click("[data-mobile-country-filter-toggle]");
  await page.click("[data-mobile-country-filter-clear='tier']");
  await page.waitFor(() => document.querySelectorAll("[data-country]").length > 0, "恢复未筛选国家列表");
  await page.evaluate(() => window.scrollTo({ top: 480 }));
  await page.waitFor(() => window.scrollY > 100, "国家列表滚动位置");
  const scrollBeforeDetail = await page.evaluate(() => window.scrollY);
  await page.click("[data-country-detail]");
  await page.waitFor(() => location.hash.startsWith("#/country/"), "国家详情路由");
  await page.waitFor(() => getComputedStyle(document.querySelector(".detail")).display !== "none", "国家详情面板");
  const detail = await page.evaluate(() => ({
    results: getComputedStyle(document.querySelector(".results")).display,
    map: getComputedStyle(document.querySelector("#mapPanel")).display,
  }));
  assert.equal(detail.results, "none", "窄屏国家详情必须隐藏结果列表");
  assert.equal(detail.map, "none", "窄屏国家详情必须隐藏地图");
  await page.click("[data-country-mobile-detail-back]");
  await page.waitFor(() => location.hash === "#/country" && document.querySelectorAll("[data-country]").length > 0, "返回国家列表");
  const scrollAfterBack = await page.evaluate(() => window.scrollY);
  assert.ok(Math.abs(scrollAfterBack - scrollBeforeDetail) < 6, `返回国家列表必须恢复滚动位置：${scrollBeforeDetail} → ${scrollAfterBack}`);

  await page.goto(`${baseUrl}?countryMobileBrowserBack=1#/country`);
  await page.waitFor(() => document.querySelectorAll("[data-country]").length > 0, "原生后退测试的国家列表");
  await page.evaluate(() => window.scrollTo({ top: 480 }));
  await page.waitFor(() => window.scrollY > 100, "原生后退测试的滚动位置");
  const scrollBeforeBrowserBack = await page.evaluate(() => window.scrollY);
  await page.click("[data-country-detail]");
  await page.waitFor(() => location.hash.startsWith("#/country/"), "原生后退测试的国家详情路由");
  await page.evaluate(() => history.back());
  await page.waitFor(() => location.hash === "#/country" && document.querySelectorAll("[data-country]").length > 0, "浏览器后退返回国家列表");
  assert.ok(Math.abs(scrollBeforeBrowserBack - 480) < 6, `原生后退测试必须从预设位置进入详情：${scrollBeforeBrowserBack}`);
  await page.waitFor(() => Math.abs(window.scrollY - 480) < 6, "浏览器后退后的滚动位置恢复");
  await page.close();
  console.log(JSON.stringify({ country_mobile_narrow_screen_browser: "ok", base_url: baseUrl }, null, 2));
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
      await new Promise((resolve) => setTimeout(resolve, 150));
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
        await new Promise((resolve) => setTimeout(resolve, 50));
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
    text(selector) {
      return this.evaluate((target) => document.querySelector(target)?.textContent?.trim() || "", selector);
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
      await new Promise((resolve) => setTimeout(resolve, 50));
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
      const response = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
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

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, "");
}
