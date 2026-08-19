import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";

const root = path.resolve("Victorian Century Database");
const output = path.resolve("screenshots/content-boards-visual");
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const file = path.resolve(root, relative);
  if (!file.startsWith(`${root}${path.sep}`) && file !== path.join(root, "index.html")) { response.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404).end(); return; }
  const types = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".webp": "image/webp", ".svg": "image/svg+xml" };
  response.writeHead(200, { "content-type": types[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9261;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });
try {
  const end = Date.now() + 10000;
  while (Date.now() < end) { try { if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 50)); }
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map(); let id = 0;
  socket.addEventListener("message", (event) => { const message = JSON.parse(event.data); const waiter = pending.get(message.id); if (waiter) { pending.delete(message.id); waiter(message); } });
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
  const send = (method, params = {}) => new Promise((resolve) => { const requestId = ++id; pending.set(requestId, resolve); socket.send(JSON.stringify({ id: requestId, method, params })); });
  const next = (method) => new Promise((resolve) => { const handler = (event) => { const message = JSON.parse(event.data); if (message.method === method) { socket.removeEventListener("message", handler); resolve(message); } }; socket.addEventListener("message", handler); });
  await send("Page.enable"); await send("Runtime.enable"); await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  const evaluate = async (fn, ...args) => { const result = await send("Runtime.evaluate", { expression: `(${fn})(${args.map((v) => JSON.stringify(v)).join(",")})`, returnByValue: true, awaitPromise: true }); if (result.result?.exceptionDetails) throw new Error(result.result.exceptionDetails.text || "evaluation failed"); return result.result?.result?.value; };
  const goto = async (hash) => { const loaded = next("Page.loadEventFired"); await send("Page.navigate", { url: `http://127.0.0.1:${port}/index.html${hash}` }); await loaded; const until = Date.now() + 30000; while (Date.now() < until) { const ok = await evaluate((h) => document.body?.dataset?.view === h.slice(2) && document.querySelector(".results-list, .event-list, .journal-list, .decision-list"), hash); if (ok) break; await new Promise((r) => setTimeout(r, 100)); } await new Promise((r) => setTimeout(r, 250)); };
  const inspect = async (kind, viewport) => {
    await send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 600 });
    await goto(`#/${kind}`);
    const boardShot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(output, `${kind}-${viewport.width}x${viewport.height}-board.png`), Buffer.from(boardShot.result.data, "base64"));
    const first = await evaluate(() => document.querySelector(`[data-${document.body.dataset.view}-id]`));
    if (first) await evaluate(() => document.querySelector(`[data-${document.body.dataset.view}-id]`)?.click());
    await new Promise((r) => setTimeout(r, 250));
    const metrics = await evaluate((boardKind) => { const selectors = { event: { filter: "#eventFilters", nav: "#eventGroupNav" }, journal: { filter: "#journalFilters", nav: "#journalGroupNav" }, decision: { filter: "#decisionFilters", nav: "#decisionGroupNav" } }[boardKind]; const pick = (selector) => { const el = document.querySelector(selector); if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { selector, x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), overflowY: cs.overflowY, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, display: cs.display }; }; return { view: document.body.dataset.view, left: pick(selectors.filter), results: pick(".results"), list: pick("#countryList"), detail: pick("#detail"), groupNav: pick(selectors.nav), bodyOverflow: getComputedStyle(document.body).overflowY, detailText: document.querySelector(".event-detail, .journal-detail, .decision-detail")?.textContent?.trim().slice(0, 140) || "" }; }, kind);
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const file = path.join(output, `${kind}-${viewport.width}x${viewport.height}.png`); fs.writeFileSync(file, Buffer.from(shot.result.data, "base64"));
    return { kind, viewport, metrics, file };
  };
  const results = [];
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) for (const kind of ["journal", "event", "decision"]) results.push(await inspect(kind, viewport));
  fs.writeFileSync(path.join(output, "metrics.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  socket.close();
} finally { chrome.kill(); await new Promise((resolve) => server.close(resolve)); }
