import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:4173/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9229;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });

try {
  const desktop = await openPage({ width: 1440, height: 1000 });
  await desktop.goto(`${baseUrl}#/achievement`);
  await desktop.waitFor(() => document.querySelectorAll("[data-achievement-key]").length === 141);
  const wall = await desktop.evaluate(() => ({
    cards: document.querySelectorAll("[data-achievement-key]").length,
    groups: document.querySelectorAll(".achievement-group").length,
    mapDisplay: getComputedStyle(document.querySelector("#mapPanel")).display,
    filtersDisplay: getComputedStyle(document.querySelector(".filters")).display,
  }));
  assert.equal(wall.cards, 141, "achievement wall should render 141 cards");
  assert.equal(wall.groups, 4, "achievement wall should render four difficulty groups");
  assert.equal(wall.mapDisplay, "none", "achievement wall must not show the map");
  assert.equal(wall.filtersDisplay, "none", "achievement wall must not show legacy filters");
  const iconBox = await desktop.evaluate(() => {
    const image = document.querySelector("[data-achievement-key] img");
    const card = image.closest("[data-achievement-key]");
    const rect = image.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const style = getComputedStyle(image);
    return {
      width: rect.width,
      height: rect.height,
      marginTop: parseFloat(style.marginTop),
      marginLeft: parseFloat(style.marginLeft),
      topInset: rect.top - cardRect.top,
      leftInset: rect.left - cardRect.left,
      rightInset: cardRect.right - rect.right,
    };
  });
  assert.ok(Math.abs(iconBox.width - iconBox.height) < 1, "achievement card icons must use a square canvas so the top and side frames match");
  assert.equal(iconBox.marginTop, iconBox.marginLeft, "achievement card icons must use equal top and side frames");
  assert.equal(iconBox.marginTop, 12, "achievement card icons must use a 12px outer frame");
  assert.ok(Math.abs(iconBox.topInset - iconBox.leftInset) < 1, `achievement card icon top and left rendered insets must match: ${JSON.stringify(iconBox)}`);
  assert.ok(Math.abs(iconBox.leftInset - iconBox.rightInset) < 1, `achievement card icon left and right rendered insets must match: ${JSON.stringify(iconBox)}`);
  await desktop.evaluate(() => {
    const input = document.querySelector("[data-achievement-search]");
    input.value = "Thanks, Obama";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  assert.equal(await desktop.evaluate(() => document.querySelectorAll("[data-achievement-key]").length), 141, "typing must not filter the achievement wall before Enter");
  await desktop.evaluate(() => document.querySelector("[data-achievement-search]").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, isComposing: true })));
  assert.equal(await desktop.evaluate(() => document.querySelectorAll("[data-achievement-key]").length), 141, "IME confirmation Enter must not filter the achievement wall");
  await desktop.evaluate(() => document.querySelector("[data-achievement-search]").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  await desktop.waitFor(() => document.querySelectorAll("[data-achievement-key]").length === 1);
  const searchCaret = await desktop.evaluate(() => {
    const input = document.querySelector("[data-achievement-search]");
    return { value: input.value, start: input.selectionStart, end: input.selectionEnd };
  });
  assert.deepEqual(searchCaret, { value: "Thanks, Obama", start: "Thanks, Obama".length, end: "Thanks, Obama".length }, "submitted achievement searches must keep the caret at the end of the query");
  await desktop.evaluate(() => document.querySelector("[data-achievement-key='achievement_thanks_obama']").click());
  await desktop.waitFor(() => location.hash === "#/achievement/achievement_thanks_obama");
  const desktopDetail = await desktop.evaluate(() => ({
    english: document.querySelector(".achievement-detail-english")?.textContent?.trim() || "",
    open: Array.from(document.querySelectorAll(".achievement-detail details"), (detail) => detail.open),
    columns: getComputedStyle(document.querySelector(".achievement-wall-grid")).gridTemplateColumns.split(" ").filter(Boolean).length,
  }));
  assert.equal(desktopDetail.english, "Thanks, Obama", "detail must retain the English full name");
  assert.deepEqual(desktopDetail.open, [true, true], "both source script sections must be open by default");
  assert.equal(desktopDetail.columns, 10, "desktop detail pane must retain ten wall columns");
  await desktop.evaluate(() => document.querySelector("[data-achievement-back]").click());
  await desktop.waitFor(() => location.hash === "#/achievement");
  assert.equal(await desktop.evaluate(() => document.querySelector("[data-achievement-search]").value), "Thanks, Obama", "closing detail must retain the search query");
  await desktop.close();

  const mobile = await openPage({ width: 390, height: 844 });
  await mobile.goto(`${baseUrl}#/achievement/achievement_thanks_obama`);
  await mobile.waitFor(() => Boolean(document.querySelector(".achievement-detail")));
  const narrow = await mobile.evaluate(() => ({
    resultsDisplay: getComputedStyle(document.querySelector(".results")).display,
    detailDisplay: getComputedStyle(document.querySelector(".detail")).display,
  }));
  assert.equal(narrow.resultsDisplay, "none", "narrow-screen detail must replace the wall");
  assert.notEqual(narrow.detailDisplay, "none", "narrow-screen detail must remain visible");
  await mobile.evaluate(() => document.querySelector("[data-achievement-back]").click());
  await mobile.waitFor(() => location.hash === "#/achievement" && document.querySelectorAll("[data-achievement-key]").length === 141);
  const mobileIconInset = await mobile.evaluate(() => {
    const image = document.querySelector("[data-achievement-key] img");
    const style = getComputedStyle(image);
    return {
      top: parseFloat(style.marginTop),
      side: parseFloat(style.marginLeft),
    };
  });
  assert.equal(mobileIconInset.top, mobileIconInset.side, "mobile achievement card icons must use equal top and side frames");
  assert.equal(mobileIconInset.top, 12, "mobile achievement card icons must use a 12px outer frame");
  await mobile.close();
  console.log(JSON.stringify({ achievement_board_browser: "ok", base_url: baseUrl }, null, 2));
} finally {
  chrome.kill();
}

async function openPage(viewport) {
  const targets = await waitForTargets();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
  return {
    goto: async (url) => {
      const loaded = session.next("Page.loadEventFired");
      await session.send("Page.navigate", { url });
      await loaded;
      await new Promise((resolve) => setTimeout(resolve, 150));
    },
    evaluate: async (expression) => {
      const value = await session.send("Runtime.evaluate", { expression: `(${expression})()`, returnByValue: true, awaitPromise: true });
      if (value.exceptionDetails) throw new Error(value.exceptionDetails.text || "browser evaluation failed");
      return value.result.value;
    },
    waitFor: async (predicate) => {
      const end = Date.now() + 20000;
      while (Date.now() < end) {
        if (await session.evaluate(predicate)) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error("browser condition timed out");
    },
    close: async () => session.close(),
  };
}

async function waitForTargets() {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    try { return await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json(); } catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
  }
  throw new Error("Chrome debugging endpoint did not start");
}

async function connect(url) {
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
  return {
    send(method, params = {}) {
      const id = ++sequence;
      const response = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      socket.send(JSON.stringify({ id, method, params }));
      return response.then((message) => { if (message.error) throw new Error(message.error.message); return message.result || {}; });
    },
    next(method) {
      return new Promise((resolve, reject) => events.set(method, [...(events.get(method) || []), { resolve, reject }]));
    },
    async evaluate(predicate) {
      const expression = `Boolean((${predicate})())`;
      const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      return Boolean(result.result.value);
    },
    close() { socket.close(); },
  };
}
