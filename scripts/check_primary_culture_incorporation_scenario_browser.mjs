import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const vanillaUrl = process.argv[2] || "http://127.0.0.1:8878/index.html";
const vcUrl = process.argv[3] || "http://127.0.0.1:8881/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9274;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });

try {
  await verifySite("vanilla", vanillaUrl, true);
  await verifySite("victorian-century", vcUrl, false);
  console.log(JSON.stringify({ primary_culture_incorporation_scenario_browser: "ok", vanilla: vanillaUrl, victorian_century: vcUrl }, null, 2));
} finally {
  chrome.kill();
}

async function verifySite(name, baseUrl, fullCoverage) {
  const page = await openPage({ width: 1440, height: 1000 });
  try {
    await page.goto(`${baseUrl}?lang=zh-Hans#/country/FRA`);
    await page.waitFor(() => Boolean(document.querySelector("[data-primary-culture-scenario-route]")), `${name} French scenario button`);
    await page.click("[data-primary-culture-key='catalan'] summary");
    const catalanButton = await page.evaluate(() => document.querySelector("[data-primary-culture-key='catalan'] [data-primary-culture-scenario-route]")?.getAttribute("data-primary-culture-scenario-route") || "");
    assert.ok(catalanButton, `${name} Catalan scenario button must expose a route key`);
    await page.click(`[data-primary-culture-scenario-route='${catalanButton}']`);
    await page.waitFor(() => state.mapMode === "countryIncorporation" && state.countryIncorporationScenario?.countryTag === "FRA", `${name} French incorporation scenario`);
    const frenchScenario = await page.evaluate(() => ({ cultures: state.countryIncorporationScenario.primaryCultures, context: document.querySelector("#mapCountryContext")?.innerText || "", legend: document.querySelector("#countryIncorporationMapLegend")?.innerText || "" }));
    assert.deepEqual(frenchScenario.cultures, ["catalan", "french"]);
    assert.ok(frenchScenario.context.includes("加泰罗尼亚"));
    assert.ok(frenchScenario.legend.includes("2年") && frenchScenario.legend.includes("25年"));
    await page.click("[data-country-incorporation-scenario-clear]");
    await page.waitFor(() => state.countryIncorporationScenario === null && state.mapMode === "country", `${name} restore current country`);

    if (fullCoverage) {
      await verifyAfghanistan(page, baseUrl, name);
      await verifyArgentina(page, baseUrl, name);
    }
  } finally {
    await page.close();
  }

  const mobile = await openPage({ width: 442, height: 844 });
  try {
    await mobile.goto(`${baseUrl}?lang=zh-Hans#/country/FRA`);
    await mobile.waitFor(() => Boolean(document.querySelector("[data-primary-culture-scenario-route]")), `${name} mobile scenario button`);
    await mobile.click("[data-primary-culture-key='catalan'] summary");
    await mobile.click("[data-primary-culture-key='catalan'] [data-primary-culture-scenario-route]");
    await mobile.waitFor(() => state.countryIncorporationScenario?.countryTag === "FRA", `${name} mobile scenario`);
    const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `${name} scenario map must not overflow horizontally: ${overflow}`);
  } finally {
    await mobile.close();
  }
}

async function verifyAfghanistan(page, baseUrl, name) {
  await page.goto(`${baseUrl}?lang=zh-Hans#/country/AFG`);
  await page.waitFor(() => Boolean(document.querySelector("[data-primary-culture-key='uzbek']")), `${name} Afghanistan scenario routes`);
  await page.click("[data-primary-culture-key='uzbek'] summary");
  const buttons = await page.evaluate(() => [...document.querySelectorAll("[data-primary-culture-key='uzbek'] [data-primary-culture-scenario-route]")].map((node) => node.dataset.primaryCultureScenarioRoute));
  assert.ok(buttons.length >= 2, `${name} Afghanistan should expose both Uzbek route scenarios`);
  for (const routeKey of buttons) {
    await page.click(`[data-primary-culture-scenario-route='${routeKey}']`);
    await page.waitFor(() => state.countryIncorporationScenario?.countryTag === "AFG", `${name} Afghanistan scenario`);
    const cultures = await page.evaluate(() => state.countryIncorporationScenario.primaryCultures);
    if (cultures.includes("turkmen")) assert.ok(cultures.includes("uzbek"), "Maimana scenario must include Uzbek and Turkmen");
    await page.click("[data-country-incorporation-scenario-clear]");
    await page.waitFor(() => state.countryIncorporationScenario === null, `${name} Afghanistan restore`);
  }
}

async function verifyArgentina(page, baseUrl, name) {
  await page.goto(`${baseUrl}?lang=zh-Hans#/country/ARG`);
  await page.waitFor(() => Boolean(document.querySelector("[data-primary-culture-key='argentine']")), `${name} Argentina scenario`);
  await page.click("[data-primary-culture-key='argentine'] summary");
  await page.click("[data-primary-culture-key='argentine'] [data-primary-culture-scenario-route]");
  await page.waitFor(() => state.countryIncorporationScenario?.countryTag === "ARG", `${name} Argentina scenario state`);
  assert.deepEqual(await page.evaluate(() => state.countryIncorporationScenario.primaryCultures), ["argentine"]);
  await page.click("[data-country-incorporation-scenario-clear]");
  await page.waitFor(() => state.countryIncorporationScenario === null, `${name} Argentina restore`);
}

async function openPage(viewport) {
  await waitForDebugger();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable"); await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 600 });
  return {
    async goto(url) { const loaded = session.next("Page.loadEventFired"); const hash = session.next("Page.navigatedWithinDocument"); await session.send("Page.navigate", { url }); await Promise.race([loaded, hash]); await new Promise((resolve) => setTimeout(resolve, 200)); },
    async evaluate(callback, ...args) { const result = await session.send("Runtime.evaluate", { expression: `(${callback})(${args.map((value) => JSON.stringify(value)).join(",")})`, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "browser evaluation failed"); return result.result.value; },
    async click(selector) { await this.evaluate((targetSelector) => document.querySelector(targetSelector)?.click(), selector); },
    async waitFor(predicate, description, ...args) { const deadline = Date.now() + 20000; while (Date.now() < deadline) { if (await this.evaluate(predicate, ...args)) return; await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error(`${description} timed out`); },
    close() { session.close(); },
  };
}

async function waitForDebugger() { const deadline = Date.now() + 10000; while (Date.now() < deadline) { try { if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error("Chrome debug endpoint timed out"); }
async function connect(url) { const socket = new WebSocket(url); const pending = new Map(); const events = new Map(); let id = 0; await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); }); socket.addEventListener("message", ({ data }) => { const message = JSON.parse(data); if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); } else { (events.get(message.method) || []).forEach((resolve) => resolve(message)); events.delete(message.method); } }); return { send(method, params = {}) { const requestId = ++id; return new Promise((resolve) => { pending.set(requestId, resolve); socket.send(JSON.stringify({ id: requestId, method, params })); }).then((message) => { if (message.error) throw new Error(message.error.message); return message.result || {}; }); }, next(method) { return new Promise((resolve) => events.set(method, [...(events.get(method) || []), resolve])); }, close() { socket.close(); } }; }
