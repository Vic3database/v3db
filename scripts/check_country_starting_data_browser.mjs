import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:8895/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9294;
const chrome = spawn(chromePath, [
  `--remote-debugging-port=${debugPort}`,
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  `--user-data-dir=${process.env.TEMP || "."}\\vicdata-country-starting-data-browser`,
  "about:blank",
], { stdio: "ignore", windowsHide: true });

try {
  const page = await openPage({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/CHI?tab=technology`);
  const technology = await page.evaluate(() => ({
    panel: document.querySelector("[data-country-detail-panel]")?.dataset.countryDetailPanel || "",
    text: document.querySelector("[data-country-detail-panel]")?.innerText || "",
    pills: document.querySelectorAll("[data-country-detail-panel] .tag-technology").length,
  }));
  assert.equal(technology.panel, "technology", "technology tab must render");
  assert.match(technology.text, /第 4 层/, "China technology tier must render");
  assert.match(technology.text, /城镇规划|养蚕学|学术界|执法/, "China extra starting technologies must render localized names");
  assert.ok(technology.pills >= 4, "China extra starting technologies must render as technology pills");

  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/CHI?tab=laws`);
  const laws = await page.evaluate(() => ({
    panel: document.querySelector("[data-country-detail-panel]")?.dataset.countryDetailPanel || "",
    text: document.querySelector("[data-country-detail-panel]")?.innerText || "",
    cards: document.querySelectorAll(".country-starting-law-card").length,
  }));
  assert.equal(laws.panel, "laws", "laws tab must render");
  assert.match(laws.text, /广州一口通商/, "China starting laws must render localized names");
  assert.ok(laws.cards >= 10, "China starting laws must render as cards");

  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/ABK?tab=technology`);
  const nonStarting = await page.evaluate(() => document.querySelector(".country-detail-data-status")?.innerText || "");
  assert.match(nonStarting, /不存在/, "non-starting countries must show an explicit status");

  page.close();
  console.log(JSON.stringify({ country_starting_data_browser: "ok", baseUrl }, null, 2));
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
