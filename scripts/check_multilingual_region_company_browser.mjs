import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:8876/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9237;
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
    await verifyDetail(page, {
      locale: "zh-Hans",
      route: "state-region/STATE_BRANDENBURG",
      expectedTitle: "勃兰登堡",
      expectedBody: "可发现资源",
    });
    await verifyDetail(page, {
      locale: "en",
      route: "state-region/STATE_BRANDENBURG",
      expectedTitle: "Brandenburg",
      expectedBody: "Discoverable Resources",
    });
    await verifyDetail(page, {
      locale: "zh-Hans",
      route: "company/company_a_markwald_and_company",
      expectedTitle: "马克沃尔德公司",
      expectedBody: "主营建筑",
    });
    await verifyDetail(page, {
      locale: "en",
      route: "company/company_a_markwald_and_company",
      expectedTitle: "A. Markwald & Company, Ltd.",
      expectedBody: "Primary Buildings",
      expectedAdditionalBody: "Historical Company",
    });
    await page.close();
  }
  console.log(JSON.stringify({
    multilingual_region_company_browser: "ok",
    viewports: ["1440x900", "390x844"],
    locales: ["zh-Hans", "en"],
  }, null, 2));
} finally {
  chrome.kill();
}

async function verifyDetail(page, { locale, route, expectedTitle, expectedBody, expectedAdditionalBody = "" }) {
  await page.goto(`${baseUrl}?lang=${locale}#/${route}`);
  await page.waitForSelector(".detail h2", `${locale} ${route}`);
  const snapshot = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.querySelector(".detail h2")?.textContent?.trim() || "",
    body: document.querySelector(".detail")?.textContent || "",
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  assert.equal(snapshot.lang, locale, `${route} must use ${locale}`);
  assert.ok(snapshot.title.includes(expectedTitle), `${route} title must include ${expectedTitle}`);
  assert.ok(snapshot.body.includes(expectedBody), `${route} body must include ${expectedBody}`);
  if (expectedAdditionalBody) assert.ok(snapshot.body.includes(expectedAdditionalBody), `${route} body must include ${expectedAdditionalBody}`);
  assert.ok(snapshot.scrollWidth <= snapshot.viewportWidth + 1, `${route} must not overflow horizontally at ${snapshot.viewportWidth}px`);
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
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "browser evaluation failed");
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
    async close() {
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
    next(method) {
      return new Promise((resolve) => events.set(method, [...(events.get(method) || []), { resolve }]));
    },
    close() {
      socket.close();
    },
  };
}
