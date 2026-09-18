import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:4173/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9297;
const chrome = spawn(chromePath, [
  `--remote-debugging-port=${debugPort}`,
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  `--user-data-dir=${process.env.TEMP || "."}\\vicdata-population-browser`,
  "about:blank",
], { stdio: "ignore", windowsHide: true });

try {
  const page = await openPage({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/GBR`);
  const country = await page.evaluate(() => document.querySelector(".country-detail-overview")?.innerText || "");
  assert.match(country, /开局人口/);
  assert.match(country, /25,951,647/);

  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/state-region/STATE_HOME_COUNTIES`);
  const state = await page.evaluate(() => document.querySelector("#detail")?.innerText || "");
  assert.match(state, /开局人口/);
  assert.match(state, /2,805,996/);

  await page.goto(`${baseUrl}?version=1.13.11&lang=en#/country/GBR`);
  const english = await page.evaluate(() => document.querySelector(".country-detail-overview")?.innerText || "");
  assert.match(english, /Starting population/);

  page.close();
  console.log(JSON.stringify({ population_statistics_browser: "ok", baseUrl }, null, 2));
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
    async evaluate(callback) {
      const result = await session.send("Runtime.evaluate", { expression: `(${callback})()`, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "browser evaluation failed");
      return result.result?.result?.value;
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
