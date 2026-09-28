import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.resolve(process.argv[2] || "Victorian Century Database");
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9266;
const preview = await startPreviewServer(root);
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });
try {
  await waitForDebugEndpoint();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  const url = `${preview.url}/index.html#/vc-updates`;
  const loaded = session.next("Page.loadEventFired");
  await session.send("Page.navigate", { url });
  await loaded;
  await waitUntil(session, () => document.querySelectorAll(".vc-change-group").length === window.VIC3_VC_CHANGELOG_DATA?.changes?.length, "VC update groups");
  const initial = await evaluate(session, () => ({ groups: document.querySelectorAll(".vc-change-group").length, text: document.body.innerText }));
  assert.equal(initial.groups, await evaluate(session, () => window.VIC3_VC_CHANGELOG_DATA.changes.length));
  assert.match(initial.text, /近期更新/);
  await evaluate(session, () => { const input = document.querySelector("#vcChangelogSearch"); input.value = "AHU"; input.dispatchEvent(new Event("input", { bubbles: true })); });
  await waitUntil(session, () => document.querySelectorAll(".vc-change-group").length > 0 && document.querySelectorAll(".vc-change-group").length < 405, "VC update search");
  await evaluate(session, () => document.querySelector("[data-vc-change-group]")?.click());
  await waitUntil(session, () => document.querySelectorAll(".vc-change-member").length > 0 || document.querySelectorAll(".vc-change-detail").length > 0, "VC update group members");
  const result = await evaluate(session, () => ({ members: document.querySelectorAll(".vc-change-member").length, details: document.querySelectorAll(".vc-change-detail").length, icons: document.querySelectorAll(".vc-change-member-icon").length, href: document.querySelector(".vc-change-member")?.getAttribute("href") || "" }));
  assert.ok(result.members > 0);
  assert.ok(result.members > 0);
  assert.ok(result.icons > 0, "expanded update members must render icons when available");
  assert.match(result.href, /#\/country\//);
  await evaluate(session, () => { const input = document.querySelector("#vcChangelogSearch"); input.value = "company_ricordi"; input.dispatchEvent(new Event("input", { bubbles: true })); });
  await waitUntil(session, () => document.querySelectorAll(".vc-change-group").length > 0, "VC company search");
  await evaluate(session, () => document.querySelector("[data-vc-change-group]")?.click());
  await waitUntil(session, () => document.querySelectorAll(".vc-change-detail").length >= 2, "VC company detail rows");
  session.close();
  console.log(JSON.stringify({ victorian_century_recent_updates_browser: "ok", groups: initial.groups, expandedMembers: result.members }, null, 2));
} finally { chrome.kill(); await preview.close(); }

async function evaluate(session, fn) { const result = await session.send("Runtime.evaluate", { expression: `(${fn})()`, returnByValue: true, awaitPromise: true }); if (result.result?.exceptionDetails) throw new Error(result.result.exceptionDetails.text || "browser evaluation failed"); return result.result?.result?.value; }
async function waitUntil(session, predicate, label) { const end = Date.now() + 30000; while (Date.now() < end) { if (await evaluate(session, predicate)) return; await new Promise((resolve) => setTimeout(resolve, 100)); } throw new Error(`${label} timed out`); }
async function waitForDebugEndpoint() { const end = Date.now() + 10000; while (Date.now() < end) { try { if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error("Chrome debug endpoint timed out"); }
function connect(url) { const socket = new WebSocket(url); const events = new Map(); let id = 0; socket.addEventListener("message", (event) => { const message = JSON.parse(event.data); const waiter = events.get(message.id); if (waiter) { events.delete(message.id); waiter(message); } }); return new Promise((resolve) => socket.addEventListener("open", () => resolve({ send(method, params = {}) { return new Promise((done) => { const requestId = ++id; events.set(requestId, done); socket.send(JSON.stringify({ id: requestId, method, params })); }); }, next(method) { return new Promise((done) => { const handler = (event) => { const message = JSON.parse(event.data); if (message.method === method) { socket.removeEventListener("message", handler); done(message); } }; socket.addEventListener("message", handler); }); }, close() { socket.close(); } }), { once: true })); }
async function startPreviewServer(siteRoot) { const server = http.createServer((request, response) => { const relative = decodeURIComponent(new URL(request.url, "http://localhost").pathname).replace(/^\/+/, "") || "index.html"; const file = path.resolve(siteRoot, relative); if (!file.startsWith(`${siteRoot}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404).end(); return; } response.writeHead(200, { "content-type": file.endsWith(".js") ? "application/javascript" : file.endsWith(".css") ? "text/css" : "text/html", "cache-control": "no-store" }); fs.createReadStream(file).pipe(response); }); await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) }; }
