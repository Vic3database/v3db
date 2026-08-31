import { spawn } from "node:child_process";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9292;
const chrome = spawn(chromePath, [`--remote-debugging-port=${port}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${process.env.TEMP || "."}\\vicdata-country-diagnose`, "about:blank"], { stdio: "ignore", windowsHide: true });
try {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) { try { if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break; } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); }
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map(); let id = 0;
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  socket.addEventListener("message", ({ data }) => { const message = JSON.parse(data); if (message.id) { pending.get(message.id)?.(message); pending.delete(message.id); } });
  const send = (method, params = {}) => { const requestId = ++id; return new Promise((resolve) => { pending.set(requestId, resolve); socket.send(JSON.stringify({ id: requestId, method, params })); }); };
  await send("Page.enable"); await send("Runtime.enable");
  const url = "http://127.0.0.1:8895/index.html?version=1.13.11&lang=zh-Hans#/country/CHI";
  await send("Page.navigate", { url }); await new Promise((resolve) => setTimeout(resolve, 4000));
  const expression = `({ href: location.href, hash: location.hash, view: document.body.dataset.view, mode: document.body.dataset.pageMode, classes: document.body.className, detailKind: window.eval("state.detailKind"), selectedTag: window.eval("state.selectedTag"), tabs: document.querySelectorAll("[data-country-detail-tab]").length, detailText: document.querySelector("#detail")?.innerText?.slice(0,300), errors: performance.getEntriesByType("resource").filter((item) => item.name.includes("data-countries") && item.transferSize === 0).map((item) => item.name) })`;
  const result = await send("Runtime.evaluate", { expression, returnByValue: true }); console.log(JSON.stringify(result.result?.result?.value || result, null, 2));
} finally { chrome.kill(); }
