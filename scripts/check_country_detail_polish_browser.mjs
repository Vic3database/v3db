import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:8895/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9298;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${process.env.TEMP || "."}\\vicdata-country-detail-polish-browser`, "about:blank"], { stdio: "ignore", windowsHide: true });

try {
  const page = await openPage({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/AUS?tab=interest-groups&ig=ig_rural_folk`);
  const interestGroup = await page.evaluate(() => ({
    religion: document.querySelector(".country-detail-overview")?.innerText || "",
    flavorName: document.querySelector(".country-interest-group-panel-head h4")?.innerText || "",
    baseName: document.querySelector(".country-interest-group-panel-head .minor")?.innerText || "",
    detailLink: document.querySelector(".country-interest-group-detail-link")?.getAttribute("href") || "",
    approvals: [...document.querySelectorAll(".country-interest-group-panel [data-interest-group-trait-slot]")].map((node) => ({ order: node.dataset.interestGroupApprovalOrder, top: node.getBoundingClientRect().top })),
    descriptions: [...document.querySelectorAll(".country-interest-group-panel .interest-group-trait-card p")].map((node) => ({ text: node.innerText, height: node.getBoundingClientRect().height, scrollHeight: node.scrollHeight })),
  }));
  assert.match(interestGroup.religion, /天主教/, "country religion must use the localized name");
  assert.notEqual(interestGroup.flavorName, interestGroup.baseName, "country detail must prefer the flavored interest-group name");
  assert.equal(interestGroup.baseName, "乡村民众", "country detail must retain the base interest-group name as secondary text");
  assert.equal(interestGroup.detailLink, "#/interest-group/ig_rural_folk", "country detail must provide the interest-group detail link");
  assert.deepEqual(interestGroup.approvals.sort((left, right) => left.top - right.top).map((item) => item.order), ["3", "2", "1"], "vertical country interest-group approval cards must read gold, green, red from top to bottom");
  assert.ok(interestGroup.descriptions.every((item) => item.scrollHeight <= item.height + 1), "interest-group descriptions must not be clipped");

  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/AUS?tab=variants`);
  const flags = await page.evaluate(() => ({
    section: Boolean(document.querySelector(".country-flag-variant-section")),
    details: document.querySelectorAll(".country-flag-variant-section > details").length,
    cards: document.querySelectorAll(".country-flag-variant-card").length,
  }));
  assert.equal(flags.section, true, "flag variants must render in a visible section");
  assert.equal(flags.details, 0, "flag variants must not be collapsed into details");
  assert.ok(flags.cards > 0, "Austria must render flag variants");

  await page.setViewport({ width: 442, height: 844 });
  await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/country/AUS?tab=interest-groups&ig=ig_rural_folk`);
  const mobile = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    order: [...document.querySelectorAll(".country-interest-group-panel [data-interest-group-trait-slot]")].map((node) => ({ order: node.dataset.interestGroupApprovalOrder, top: node.getBoundingClientRect().top })),
  }));
  assert.deepEqual(mobile.order.sort((left, right) => left.top - right.top).map((item) => item.order), ["3", "2", "1"], "mobile approval cards must keep the bottom-up approval order");
  assert.ok(mobile.overflow <= 1, `country detail must not overflow horizontally: ${JSON.stringify(mobile)}`);

  page.close();
  console.log(JSON.stringify({ country_detail_polish_browser: "ok", baseUrl }, null, 2));
} finally { chrome.kill(); }

async function openPage(viewport) {
  await waitForDebugger();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable"); await session.send("Runtime.enable"); await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
  return {
    async setViewport(next) { await session.send("Emulation.setDeviceMetricsOverride", { width: next.width, height: next.height, deviceScaleFactor: 1, mobile: false }); },
    async goto(url) { const response = await session.send("Page.navigate", { url }); if (response.error) throw new Error(response.error.message); await new Promise((resolve) => setTimeout(resolve, 5000)); },
    async evaluate(callback, ...args) { const result = await session.send("Runtime.evaluate", { expression: `(${callback})(${args.map((value) => JSON.stringify(value)).join(",")})`, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || "browser evaluation failed"); return result.result.result.value; },
    close() { session.close(); },
  };
}
async function waitForDebugger() { const deadline = Date.now() + 10000; while (Date.now() < deadline) { try { if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error("Chrome debug endpoint timed out"); }
async function connect(url) { const socket = new WebSocket(url); const pending = new Map(); let id = 0; await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); }); socket.addEventListener("message", ({ data }) => { const message = JSON.parse(data); if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); } }); return { send(method, params = {}) { const requestId = ++id; return new Promise((resolve) => { pending.set(requestId, resolve); socket.send(JSON.stringify({ id: requestId, method, params })); }); }, close() { socket.close(); } }; }
