import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:8895/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9295;
const chrome = spawn(chromePath, [
  `--remote-debugging-port=${debugPort}`,
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  `--user-data-dir=${process.env.TEMP || "."}\\vicdata-country-starting-diplomacy-browser`,
  "about:blank",
], { stdio: "ignore", windowsHide: true });

try {
  const page = await openPage({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/CHI?tab=diplomacy`);
  const china = await page.evaluate(() => ({
    panel: document.querySelector("[data-country-detail-panel]")?.dataset.countryDetailPanel || "",
    text: document.querySelector("[data-country-detail-panel]")?.innerText || "",
    records: document.querySelectorAll(".country-diplomacy-record").length,
  }));
  assert.equal(china.panel, "diplomacy", "diplomacy tab must render");
  assert.match(china.text, /附属关系|关系值/, "China diplomacy headings must render");
  assert.match(china.text, /西藏|朝鲜/, "China diplomacy targets must render localized names or labels");
  assert.ok(china.records >= 5, "China diplomacy records must render");
  const chinaLayout = await page.evaluate(() => ({
    records: [...document.querySelectorAll(".country-diplomacy-record")].slice(0, 3).map((node) => ({ width: node.getBoundingClientRect().width, target: node.querySelector(".country-diplomacy-target")?.getBoundingClientRect().width || 0, kind: node.querySelector(".country-diplomacy-kind")?.getBoundingClientRect().width || 0 })),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  assert.ok(chinaLayout.records.every((item) => item.width > item.target && item.width > item.kind), "diplomacy cards must keep target and metadata inside the card");
  assert.ok(chinaLayout.overflow <= 1, `diplomacy detail must not overflow horizontally: ${JSON.stringify(chinaLayout)}`);

  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/GBR?tab=diplomacy`);
  const britain = await page.evaluate(() => document.querySelector("[data-country-detail-panel]")?.innerText || "");
  assert.match(britain, /宿敌/, "Great Britain diplomacy must show rivalries");
  assert.match(britain, /俄罗斯/, "Great Britain rivalry target must render");

  await page.setViewport({ width: 442, height: 844 });
  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/ALK?tab=diplomacy`);
  const mobile = await page.evaluate(() => ({
    overviewCards: document.querySelectorAll(".country-overview-card").length,
    record: document.querySelector(".country-diplomacy-record")?.innerText || "",
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  assert.equal(mobile.overviewCards, 6, "mobile country overview must keep six cards");
  assert.match(mobile.record, /宗主国|俄罗斯/, "Alaska diplomacy card must keep its relationship content");
  assert.ok(mobile.overflow <= 1, `mobile country detail must not overflow horizontally: ${JSON.stringify(mobile)}`);

  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/ABK?tab=diplomacy`);
  const empty = await page.evaluate(() => document.querySelector("[data-country-detail-panel]")?.innerText || "");
  assert.match(empty, /不存在|没有记录的开局外交关系/, "countries without starting diplomacy must show an explicit state");

  page.close();
  console.log(JSON.stringify({ country_starting_diplomacy_browser: "ok", baseUrl }, null, 2));
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
    async setViewport(next) { await session.send("Emulation.setDeviceMetricsOverride", { width: next.width, height: next.height, deviceScaleFactor: 1, mobile: false }); },
    async goto(url) {
      const response = await session.send("Page.navigate", { url });
      if (response.error) throw new Error(`Page.navigate: ${response.error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    },
    async evaluate(callback, ...args) {
      const expression = `(${callback})(${args.map((value) => JSON.stringify(value)).join(",")})`;
      const result = await session.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "browser evaluation failed");
      return result.result.result.value;
    },
    close() { session.close(); },
  };
}

async function waitForDebugger() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Chrome debug endpoint timed out");
}

async function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let id = 0;
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); }
  });
  return {
    send(method, params = {}) { const requestId = ++id; return new Promise((resolve) => { pending.set(requestId, resolve); socket.send(JSON.stringify({ id: requestId, method, params })); }); },
    close() { socket.close(); },
  };
}
