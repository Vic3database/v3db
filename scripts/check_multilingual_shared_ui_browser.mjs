import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:8876/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9240;
const chrome = spawn(chromePath, [
  `--remote-debugging-port=${debugPort}`,
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "about:blank",
], { stdio: "ignore", windowsHide: true });

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await openPage(viewport);
    await page.goto(`${baseUrl}?lang=zh-Hans#/home`);
    await page.waitForSelector(".home-category-card", "localized home board");
    const home = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      title: document.title,
      body: document.body.textContent,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
    }));
    assert.equal(home.lang, "zh-Hans");
    assert.ok(home.title.includes("首页 - Vicdata"));
    assert.ok(home.body.includes("公告") && home.body.includes("游戏资讯"));
    assert.ok(home.scrollWidth <= home.viewportWidth + 1, `home must not overflow at ${viewport.width}px`);

    await page.evaluate(() => document.querySelector("#settingsNavButton")?.click());
    await page.waitFor(() => !document.querySelector("#infoDialog")?.hidden, "settings dialog");
    assert.ok((await page.evaluate(() => document.querySelector("#infoDialog")?.textContent || "")).includes("松散政权显示为白地"));
    await page.evaluate(() => document.querySelector("#infoDialogCloseButton")?.click());

    await page.evaluate(() => document.querySelector("#globalSearchButton")?.click());
    await page.evaluate(() => {
      const input = document.querySelector("#globalSearchDialogInput");
      input.value = "Prussia";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitFor(() => document.querySelector("[data-result-key=\"PRU\"]"), "Prussia search result");
    assert.ok((await page.evaluate(() => document.querySelector("[data-result-key=\"PRU\"]")?.textContent || "")).includes("普鲁士"));
    await page.evaluate(() => document.querySelector("#globalSearchCloseButton")?.click());

    await page.goto(`${baseUrl}?lang=zh-Hans#/country/PRU`);
    await page.waitFor(() => document.body.dataset.view === "country" && document.querySelector(".detail-title h2")?.textContent.includes("普鲁士"), "PRU detail");
    const before = await page.evaluate(() => {
      const panel = document.querySelector(".detail");
      panel.scrollTop = Math.min(40, Math.max(0, panel.scrollHeight - panel.clientHeight));
      return { hash: location.hash, scrollTop: panel.scrollTop };
    });
    await page.evaluate(() => {
      document.querySelector("#languageMenuButton")?.click();
      document.querySelector('#languageMenu [data-locale="en"]')?.click();
    });
    await page.waitFor(() => document.documentElement.lang === "en", "English locale");
    const english = await page.evaluate(() => ({
      title: document.querySelector(".detail-title h2")?.textContent || "",
      pageTitle: document.title,
      hash: location.hash,
      scrollTop: document.querySelector(".detail")?.scrollTop || 0,
      searchLabel: document.querySelector("#globalSearchButton")?.getAttribute("aria-label"),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
    }));
    assert.ok(english.title.includes("Prussia"), `English country title was ${JSON.stringify(english)}`);
    assert.ok(english.pageTitle.includes("Countries - Vicdata"));
    assert.equal(english.searchLabel, "Global search");
    assert.equal(english.hash, before.hash);
    assert.equal(english.scrollTop, before.scrollTop);
    assert.ok(english.scrollWidth <= english.viewportWidth + 1, `English detail must not overflow at ${viewport.width}px`);

    await page.evaluate(() => document.querySelector("#aboutNavButton")?.click());
    await page.waitFor(() => !document.querySelector("#infoDialog")?.hidden, "about dialog");
    assert.ok((await page.evaluate(() => document.querySelector("#infoDialog")?.textContent || "")).includes("Data and disclaimer"));
    await page.close();
  }
  console.log(JSON.stringify({ multilingual_shared_ui_browser: "ok", viewports: ["1440x900", "390x844"], locales: ["zh-Hans", "en"], search: ["Prussia", "PRU"] }, null, 2));
} finally {
  chrome.kill();
}

async function openPage(viewport) {
  await waitForDebugger();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
  return {
    async goto(url) {
      const loaded = session.next("Page.loadEventFired");
      const navigated = session.next("Page.navigatedWithinDocument");
      await session.send("Page.navigate", { url });
      await Promise.race([loaded, navigated]);
      await new Promise((resolve) => setTimeout(resolve, 150));
    },
    async evaluate(callback) {
      const result = await session.send("Runtime.evaluate", { expression: `(${callback})()`, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "browser evaluation failed");
      return result.result.value;
    },
    async waitForSelector(selector, description) {
      const end = Date.now() + 20000;
      while (Date.now() < end) {
        const result = await session.send("Runtime.evaluate", { expression: `Boolean(document.querySelector(${JSON.stringify(selector)}))`, returnByValue: true });
        if (result.result.value) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(`${description} timed out`);
    },
    async waitFor(predicate, description) {
      const end = Date.now() + 20000;
      while (Date.now() < end) {
        const result = await session.send("Runtime.evaluate", { expression: `(${predicate})()`, returnByValue: true });
        if (result.result.value) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(`${description} timed out`);
    },
    async close() { session.close(); },
  };
}

async function waitForDebugger() {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    try { await fetch(`http://127.0.0.1:${debugPort}/json/list`); return; }
    catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
  }
  throw new Error("Chrome debug port did not start");
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
    next(method) { return new Promise((resolve) => events.set(method, [...(events.get(method) || []), { resolve }])); },
    close() { socket.close(); },
  };
}
