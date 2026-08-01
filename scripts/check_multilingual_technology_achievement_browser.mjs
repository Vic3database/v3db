import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:8876/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9239;
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
    await verifyDetailSwitch(page, {
      route: "technology/academia",
      selector: ".technology-detail h2",
      searchSelector: "[data-technology-search]",
      zhTitle: "\u5b66\u672f\u754c",
      zhBody: "\u524d\u7f6e\u79d1\u6280",
      enTitle: "Academia",
      enBody: "Prerequisites",
      query: "academia",
    });
    await verifyDetailSwitch(page, {
      route: "achievement/achievement_viva_la_confederacion",
      selector: ".achievement-detail h2",
      searchSelector: "[data-achievement-search]",
      zhTitle: "\u90a6\u8054\u4e07\u5c81\uff01",
      zhBody: "\u5df2\u6210\u7acb\u79d8\u9c81-\u73bb\u5229\u7ef4\u4e9a",
      enTitle: "Viva la Confederaci\u00f3n!",
      enBody: "Has formed Peru-Bolivia",
      query: "Viva la Confederaci\u00f3n!",
    });
    await page.close();
  }
  console.log(JSON.stringify({
    multilingual_technology_achievement_browser: "ok",
    viewports: ["1440x900", "390x844"],
    locales: ["zh-Hans", "en"],
    state_preservation: ["detail", "search", "scroll"],
  }, null, 2));
} finally {
  chrome.kill();
}

async function verifyDetailSwitch(page, { route, selector, searchSelector, zhTitle, zhBody, enTitle, enBody, query }) {
  await page.goto(`${baseUrl}?lang=zh-Hans#/${route}`);
  await page.waitForSelector(selector, `zh-Hans ${route}`);
  const before = await page.evaluate(({ selector, searchSelector, query }) => {
    const input = document.querySelector(searchSelector);
    input.value = query;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.closest("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    const panel = document.querySelector(".detail");
    panel.scrollTop = Math.min(60, Math.max(0, panel.scrollHeight - panel.clientHeight));
    window.scrollTo(0, Math.min(60, Math.max(0, document.documentElement.scrollHeight - window.innerHeight)));
    return {
      lang: document.documentElement.lang,
      hash: location.hash,
      title: document.querySelector(selector)?.textContent?.trim() || "",
      body: panel?.textContent || "",
      query: document.querySelector(searchSelector)?.value || "",
      scrollTop: window.innerWidth <= 390 ? window.scrollY : panel?.scrollTop || 0,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  }, { selector, searchSelector, query });
  verifySnapshot(before, { locale: "zh-Hans", route, title: zhTitle, body: zhBody });

  await page.evaluate(() => {
    document.querySelector("#languageMenuButton")?.click();
    document.querySelector('#languageMenu [data-locale="en"]')?.click();
  });
  await page.waitFor(() => document.documentElement.lang === "en", `English switch for ${route}`);
  const after = await page.evaluate(({ selector, searchSelector }) => {
    const panel = document.querySelector(".detail");
    return {
      lang: document.documentElement.lang,
      hash: location.hash,
      title: document.querySelector(selector)?.textContent?.trim() || "",
      body: panel?.textContent || "",
      query: document.querySelector(searchSelector)?.value || "",
      scrollTop: window.innerWidth <= 390 ? window.scrollY : panel?.scrollTop || 0,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  }, { selector, searchSelector });
  verifySnapshot(after, { locale: "en", route, title: enTitle, body: enBody });
  assert.equal(after.hash, before.hash, `${route} must preserve its detail route`);
  assert.equal(after.query, before.query, `${route} must preserve its search text`);
  assert.equal(after.scrollTop, before.scrollTop, `${route} must preserve its scroll position`);
}

function verifySnapshot(value, { locale, route, title, body }) {
  assert.equal(value.lang, locale, `${route} must use ${locale}`);
  assert.ok(value.title.includes(title), `${route} title must include ${title}`);
  assert.ok(value.body.includes(body), `${route} body must include ${body}`);
  assert.ok(value.scrollWidth <= value.viewportWidth + 1, `${route} must not overflow horizontally at ${value.viewportWidth}px`);
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
    async evaluate(callback, argument) {
      const expression = argument === undefined ? `(${callback})()` : `(${callback})(${JSON.stringify(argument)})`;
      const result = await session.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
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
    try {
      await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
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
