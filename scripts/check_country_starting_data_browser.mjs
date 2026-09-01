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
    researched: document.querySelectorAll("[data-country-detail-panel] .country-starting-technology-researched").length,
    unresearched: document.querySelectorAll("[data-country-detail-panel] .country-starting-technology-unresearched").length,
    eras: [...document.querySelectorAll(".country-starting-technology-era > h4")].map((node) => node.textContent.trim()),
  }));
  assert.equal(technology.panel, "technology", "technology tab must render");
  assert.match(technology.text, /第 4 层/, "China technology tier must render");
  assert.match(technology.text, /城镇规划|养蚕学|学术界|执法/, "China extra starting technologies must render localized names");
  assert.ok(technology.researched > 0, "China researched technologies must render");
  assert.ok(technology.unresearched > 0, "China unresearched technologies must render");
  assert.deepEqual(technology.eras, ["时代 I"], "China must omit era II when none of its technologies are researched");

  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/AUS?tab=technology`);
  const austriaTechnology = await page.evaluate(() => ({
    eras: [...document.querySelectorAll(".country-starting-technology-era > h4")].map((node) => node.textContent.trim()),
    status: document.querySelector(".country-technology-era-complete")?.textContent.trim() || "",
  }));
  assert.deepEqual(austriaTechnology.eras, ["时代 II"], "Austria must omit era I when all era I technologies are researched");
  assert.equal(austriaTechnology.status, "时代 I 全部解锁", "Austria must label fully unlocked era I");

  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/CHI?tab=laws`);
  const laws = await page.evaluate(() => ({
    panel: document.querySelector("[data-country-detail-panel]")?.dataset.countryDetailPanel || "",
    text: document.querySelector("[data-country-detail-panel]")?.innerText || "",
    cards: document.querySelectorAll(".country-starting-law-card").length,
    categories: [...document.querySelectorAll("[data-law-category]")].map((node) => node.dataset.lawCategory),
    sources: [...document.querySelectorAll(".country-starting-law-source")].map((node) => node.textContent.trim()),
    columns: getComputedStyle(document.querySelector(".country-starting-law-columns")).gridTemplateColumns,
  }));
  assert.equal(laws.panel, "laws", "laws tab must render");
  assert.match(laws.text, /广州一口通商/, "China starting laws must render localized names");
  assert.equal(laws.cards, 24, "China must render one law card for each regular law group");
  assert.deepEqual(laws.categories, ["power_structure", "economy", "human_rights"], "China starting laws must render in the three approved categories");
  assert.ok(laws.sources.includes("法律组默认"), "China starting laws must show default-source labels");
  assert.equal(laws.columns.split(" ").length, 3, "China starting laws must use three columns on desktop");

  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/AUS?tab=laws`);
  const austriaLaws = await page.evaluate(() => ({
    text: document.querySelector("[data-country-detail-panel]")?.innerText || "",
    message: localeRuntime.dataMessages?.[localeRuntime.current]?.["law_amendment:amendment_geheime_staatskonferenz.name"] || "",
    amendmentHref: document.querySelector(".country-starting-law-amendment-link")?.getAttribute("href") || "",
    amendmentDescription: document.querySelector(".country-starting-law-amendment-link")?.dataset.conceptDescription || "",
    amendmentKind: document.querySelector(".country-starting-law-amendment-link")?.dataset.conceptKind || "",
    amendmentDecoration: (() => {
      const node = document.querySelector(".country-starting-law-amendment-link");
      if (!node) return {};
      const style = getComputedStyle(node);
      return { radius: style.borderRadius, decoration: style.textDecorationLine };
    })(),
  }));
  assert.equal(austriaLaws.message, "秘密国家会议", "Austria amendment localization must be loaded");
  assert.match(austriaLaws.text, /含修正案：秘密国家会议/, "Austria starting law amendments must render localized names");
  assert.match(austriaLaws.amendmentHref, /#\/law\/law_autocracy\?amendment=amendment_geheime_staatskonferenz/, "starting amendment must link to its law detail");
  assert.equal(austriaLaws.amendmentKind, "lawAmendment", "starting amendment must use amendment tooltip semantics");
  assert.equal(austriaLaws.amendmentDescription, "", "starting amendment link must not duplicate tooltip content");
  assert.notEqual(austriaLaws.amendmentDecoration.radius, "0px", "starting amendment link must use a rounded tag frame");
  assert.notEqual(austriaLaws.amendmentDecoration.decoration, "underline", "starting amendment link must not use an underline");

  await page.evaluate(() => document.querySelector(".country-starting-law-amendment-link")?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: 400, clientY: 300 })));
  await new Promise((resolve) => setTimeout(resolve, 450));
  const amendmentTooltip = await page.evaluate(() => ({
    className: document.querySelector("#conceptTooltip")?.className || "",
    text: document.querySelector("#conceptTooltip")?.innerText || "",
  }));
  assert.match(amendmentTooltip.className, /law-amendment-tooltip/, "starting amendment must use a dedicated tooltip style");
  assert.match(amendmentTooltip.text, /效果[\s\S]*权威力|合法性/, "starting amendment tooltip must prioritize effects");
  assert.equal((amendmentTooltip.text.match(/效果/g) || []).length, 1, "starting amendment tooltip must show the effects heading once");

  await page.evaluate(() => document.querySelector(".country-starting-law-amendment-link")?.click());
  await new Promise((resolve) => setTimeout(resolve, 600));
  const amendmentDetail = await page.evaluate(() => ({
    hash: location.hash,
    open: document.querySelector(".law-amendment-card[open]")?.dataset.lawAmendment || "",
  }));
  assert.match(amendmentDetail.hash, /#\/law\/law_autocracy\?amendment=amendment_geheime_staatskonferenz/, "starting amendment link must open the parent law detail");
  assert.equal(amendmentDetail.open, "amendment_geheime_staatskonferenz", "parent law detail must open the selected amendment");

  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/CHI?tab=society`);
  const society = await page.evaluate(() => ({
    calculatorButton: document.querySelector(".country-incorporation-calculator-button")?.tagName || "",
    sourceText: document.querySelector(".country-detail-overview")?.innerText || "",
  }));
  assert.equal(society.calculatorButton, "", "country society must not contain the incorporation calculator button");
  assert.doesNotMatch(society.sourceText, /首个主流文化/, "country overview must hide the religion source suffix");

  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/CHI?tab=regions`);
  const regions = await page.evaluate(() => document.querySelector(".country-incorporation-calculator-button")?.tagName || "");
  assert.equal(regions, "BUTTON", "country regions must contain the dedicated incorporation calculator button");

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
