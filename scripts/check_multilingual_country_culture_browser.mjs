import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:8876/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9236;
const chrome = spawn(
  chromePath,
  [
    `--remote-debugging-port=${debugPort}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ],
  { stdio: "ignore", windowsHide: true },
);

try {
  const desktop = await openPage({ width: 1440, height: 900 });

  await verifyBoard(desktop, "zh-Hans", "country", "PRU", "#/country", "[data-country]", "#mobileCountryToolbar", /[\u4e00-\u9fff]/u, "普鲁士");
  await verifyBoard(desktop, "en", "country", "PRU", "#/country", "[data-country]", "#mobileCountryToolbar", /[A-Za-z]/u, "Prussia");
  await verifyBoard(desktop, "zh-Hans", "culture", "north_german", "#/culture", "[data-culture]", "#mobileCultureToolbar", /[\u4e00-\u9fff]/u, "北德意志");
  await verifyBoard(desktop, "en", "culture", "north_german", "#/culture", "[data-culture]", "#mobileCultureToolbar", /[A-Za-z]/u, "North German");

  await desktop.close();
  console.log(JSON.stringify({ multilingual_country_culture_browser: "ok", base_url: baseUrl }, null, 2));
} finally {
  chrome.kill();
}

async function verifyBoard(page, locale, route, key, boardRoute, rowSelector, toolbarSelector, titlePattern, expectedTitleSample) {
  await page.goto(`${baseUrl}?lang=${locale}${boardRoute}`);
  await page.waitForSelector(rowSelector, `${route} list`);
  assert.equal(await page.evaluate(() => document.documentElement.lang), locale, `${route} page lang must follow the requested locale`);
  assert.equal(await page.evaluate((selector) => getComputedStyle(document.querySelector(selector)).display, toolbarSelector), "none", `${route} desktop toolbar must stay hidden`);

  await page.goto(`${baseUrl}?lang=${locale}${boardRoute}/${key}`);
  await page.waitForSelector(".detail h2", `${route} detail`);
  const detailTitle = await page.evaluate(() => document.querySelector(".detail h2")?.textContent?.trim() || "");
  assert.match(detailTitle, titlePattern, `${route} detail title must follow the active locale`);
  assert.ok(detailTitle.includes(expectedTitleSample), `${route} detail title must include the expected sample text`);
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
      const hashNavigated = session.next("Page.navigatedWithinDocument");
      await session.send("Page.navigate", { url });
      await Promise.race([loaded, hashNavigated]);
      await new Promise((resolve) => setTimeout(resolve, 150));
    },
    async evaluate(callback, ...args) {
      const serializedArgs = args.map((value) => JSON.stringify(value)).join(",");
      const result = await session.send("Runtime.evaluate", { expression: `(${callback})(${serializedArgs})`, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "browser evaluation failed");
      return result.result.value;
    },
    async waitForSelector(selector, description) {
      const end = Date.now() + 20000;
      while (Date.now() < end) {
        const result = await session.send("Runtime.evaluate", { expression: `Boolean(document.querySelector(${JSON.stringify(selector)}))`, returnByValue: true, awaitPromise: true });
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
