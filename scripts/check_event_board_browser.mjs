import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const suppliedBaseUrl = process.argv[2] || "";
const preview = suppliedBaseUrl ? null : await startPreviewServer(path.join(process.cwd(), "site"));
const baseUrl = suppliedBaseUrl || `${preview.url}/index.html`;
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9244;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });

try {
  const page = await openPage({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}#/event`);
  await page.waitFor(() => document.querySelectorAll("[data-event-id]").length === 2236, "event list");
  const overview = await page.evaluate(() => ({ cards: document.querySelectorAll("[data-event-id]").length, eventFilters: getComputedStyle(document.querySelector(".event-filters")).display, genericFilters: getComputedStyle(document.querySelector(".filters")).display, map: getComputedStyle(document.querySelector("#mapPanel")).display }));
  assert.equal(overview.cards, 2236, "event board must show 2236 game events");
  assert.notEqual(overview.eventFilters, "none", "event board must use a dedicated filter pane");
  assert.equal(overview.genericFilters, "none", "event board must hide generic map filters");
  assert.equal(overview.map, "none", "event board must hide map");
  const groups = await page.evaluate(() => [...document.querySelectorAll("[data-event-group]")].map((heading) => ({
    name: heading.dataset.eventGroup,
    events: [...heading.parentElement.querySelectorAll("[data-event-id]")].map((card) => card.dataset.eventId),
  })));
  assert.ok(groups.length > 300, "event board must render the event namespaces as groups");
  assert.equal(groups[0]?.name, "1848", "event groups must use namespace order");
  assert.deepEqual(groups[0]?.events.slice(0, 6), ["1848.1", "1848.2", "1848.3", "1848.4", "1848.5", "1848.6"], "events within a group must use numeric event ID order");
  const groupNavigation = await page.evaluate(() => ({
    count: document.querySelectorAll("[data-event-group-target]").length,
    firstLabel: document.querySelector("[data-event-group-target='1848']")?.textContent?.replace(/\s+/g, " ").trim() || "",
    japanLabel: document.querySelector("[data-event-group-target='japan_religion']")?.textContent?.replace(/\s+/g, " ").trim() || "",
    anarchismLabel: document.querySelector("[data-event-group-target='anarchism_events']")?.textContent?.replace(/\s+/g, " ").trim() || "",
    peoplesSpringtimeLabel: document.querySelector("[data-event-group-target='peoples_springtime']")?.textContent?.replace(/\s+/g, " ").trim() || "",
    indiaFederationLabel: document.querySelector("[data-event-group-target='federation_of_india']")?.textContent?.replace(/\s+/g, " ").trim() || "",
    freeStatesLabel: document.querySelector("[data-event-group-target='fsa_events']")?.textContent?.replace(/\s+/g, " ").trim() || "",
    greatGameLabel: document.querySelector("[data-event-group-target='gg_core']")?.textContent?.replace(/\s+/g, " ").trim() || "",
    navOverflowY: getComputedStyle(document.querySelector("#eventGroupNav")).overflowY,
    navMaxHeight: getComputedStyle(document.querySelector("#eventGroupNav")).maxHeight,
    filterOverflowY: getComputedStyle(document.querySelector("#eventFilters")).overflowY,
  }));
  assert.equal(groupNavigation.count, groups.length, "left event navigation must list every visible event group");
  assert.equal(await page.evaluate(() => document.querySelectorAll("[data-event-tag]").length), 12, "event tag filters must include all-tags plus 11 tags");
  assert.match(groupNavigation.firstLabel, /人民之春/, "1848 group name must use the named Springtime of the Peoples concept");
  assert.match(groupNavigation.japanLabel, /日本宗教/, "Japan religion group name must use the localized group concept");
  assert.match(groupNavigation.anarchismLabel, /无政府主义/, "unlisted namespaces must receive a token-derived group name");
  assert.match(groupNavigation.peoplesSpringtimeLabel, /人民之春/, "the Springtime of the Peoples group must use the official named concept");
  assert.match(groupNavigation.indiaFederationLabel, /印度联邦/, "the India federation group must use its dedicated proper name");
  assert.match(groupNavigation.freeStatesLabel, /美利坚自由邦/, "country-tag namespaces must use the official country name");
  assert.match(groupNavigation.greatGameLabel, /大博弈/, "Great Game namespaces must use the official named concept");
  assert.doesNotMatch(groupNavigation.firstLabel, /审判/, "event group navigation must not use the first event title as the group name");
  assert.equal(groupNavigation.navOverflowY, "visible", "event group navigation must not create its own vertical scroll container");
  assert.equal(groupNavigation.navMaxHeight, "none", "event group navigation must use the full filter-panel height");
  assert.equal(groupNavigation.filterOverflowY, "auto", "the event filter panel must own the vertical scrollbar");
  const card = await page.evaluate(() => {
    const eventCard = document.querySelector("[data-event-id='1848.1']");
    return {
      icon: eventCard?.querySelector("img.event-icon")?.getAttribute("src") || "",
      title: eventCard?.querySelector("strong")?.textContent?.trim() || "",
      meta: eventCard?.querySelector(".event-card-meta")?.textContent?.replace(/\s+/g, " ").trim() || "",
      options: [...eventCard?.querySelectorAll("[data-event-option]") || []].map((option) => option.textContent.trim()),
      description: eventCard?.querySelector(".event-card-description")?.textContent?.trim() || "",
      optionDisplays: [...eventCard?.querySelectorAll("[data-event-option]") || []].map((option) => getComputedStyle(option).display),
      modifierEffects: eventCard?.querySelectorAll(".event-option-effects").length || 0,
    };
  });
  assert.match(card.icon, /assets\/event-icons\/event_icons\/waving_flag\.webp$/, "event cards must use converted WebP icons");
  assert.match(card.title, /审判|1848/, "event cards must show the event title");
  assert.match(card.meta, /1848\.1/, "event cards must show the event ID");
  assert.match(card.meta, /国家事件/, "event cards must show the event category");
  assert.equal(card.options.length, 2, "event cards must show localized option labels");
  assert.equal(card.description, "", "event cards must not prioritize description text");
  assert.ok(card.optionDisplays.length >= 2 && card.optionDisplays.every((display) => display === "block"), "event options must be separated onto their own lines");
  assert.equal(card.modifierEffects, 0, "event list cards must not show modifier effects");
  await page.evaluate(() => document.querySelector("[data-event-flavor-filter='flavor']")?.click());
  await page.waitFor(() => document.querySelectorAll("[data-event-id]").length === 836, "flavor event filter");
  assert.ok(await page.evaluate(() => [...document.querySelectorAll("[data-event-id]")].every((eventCard) => eventCard.dataset.eventKind === "flavor")), "flavor filter must only list flavor-scoped events");
  await page.evaluate(() => document.querySelector("#eventResetButton").click());
  await page.waitFor(() => document.querySelectorAll("[data-event-id]").length === 2236, "reset before generic event filter");
  await page.evaluate(() => document.querySelector("[data-event-tag='election']")?.click());
  await page.waitFor(() => document.querySelectorAll("[data-event-id]").length === 99, "election event tag filter");
  assert.ok(await page.evaluate(() => [...document.querySelectorAll("[data-event-id]")].every((eventCard) => eventCard.querySelector(".event-tag-election"))), "election tag filter must only list election events");
  await page.evaluate(() => document.querySelector("#eventResetButton").click());
  await page.waitFor(() => document.querySelectorAll("[data-event-id]").length === 2236, "reset before generic event filter");
  await page.evaluate(() => document.querySelector("[data-event-flavor-filter='generic']")?.click());
  await page.waitFor(() => document.querySelectorAll("[data-event-id]").length === 1400, "generic event filter");
  assert.ok(await page.evaluate(() => [...document.querySelectorAll("[data-event-id]")].every((eventCard) => eventCard.dataset.eventKind === "generic")), "generic filter must only list broadly available events");
  await page.evaluate(() => document.querySelector("#eventResetButton").click());
  await page.waitFor(() => document.querySelectorAll("[data-event-id]").length === 2236, "reset flavor event filter");
  const filteredGroups = await page.evaluate(() => {
    const input = document.querySelector("#eventSearchInput");
    input.value = "1848.1";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return [...document.querySelectorAll("[data-event-group]")].map((heading) => ({
      name: heading.dataset.eventGroup,
      events: [...heading.parentElement.querySelectorAll("[data-event-id]")].map((card) => card.dataset.eventId),
    }));
  });
  assert.ok(filteredGroups.length > 0, "search must retain matching event groups");
  assert.ok(filteredGroups.every((group) => group.events.length > 0), "search must not render empty event groups");
  assert.ok(filteredGroups.find((group) => group.name === "1848")?.events.includes("1848.1"), "search results must retain the matching event in its namespace group");
  await page.evaluate(() => document.querySelector("#eventResetButton").click());
  await page.waitFor(() => document.querySelectorAll("[data-event-id]").length === 2236, "reset event groups");
  await page.evaluate(() => document.querySelector("[data-event-group-target='1848']")?.click());
  const navigationPosition = await page.evaluate(() => ({
    targetTop: document.querySelector("#event-group-1848")?.getBoundingClientRect().top ?? -1,
    cardTop: document.querySelector("[data-event-id='1848.1']")?.getBoundingClientRect().top ?? -1,
    resultsTop: document.querySelector(".results")?.getBoundingClientRect().top ?? -1,
    resultsBottom: document.querySelector(".results")?.getBoundingClientRect().bottom ?? -1,
    scrollTop: document.querySelector(".results")?.scrollTop ?? -1,
  }));
  assert.ok(navigationPosition.targetTop < navigationPosition.resultsBottom && navigationPosition.targetTop >= navigationPosition.resultsTop - 50, `left event navigation must target the matching event group: ${JSON.stringify(navigationPosition)}`);
  await page.click("[data-event-id='1848.1']");
  await page.waitFor(() => location.hash === "#/event/1848.1" && Boolean(document.querySelector(".event-detail")), "pointer event detail");
  const detail = await page.evaluate(() => {
    const panel = document.querySelector(".detail");
    const results = document.querySelector(".results");
    const panelRect = panel?.getBoundingClientRect();
    const resultsRect = results?.getBoundingClientRect();
    return {
      title: document.querySelector(".event-detail h2")?.textContent?.trim(),
      source: document.querySelector(".event-source code")?.textContent?.trim(),
      optionCards: document.querySelectorAll(".event-option-card").length,
      optionNumbers: [...document.querySelectorAll(".event-option-number")].map((item) => item.textContent.trim()),
      optionScripts: document.querySelectorAll(".event-option-script").length,
      panelDisplay: panel ? getComputedStyle(panel).display : "",
      panelLeft: panelRect?.left ?? -1,
      panelRight: panelRect?.right ?? -1,
      panelWidth: panelRect?.width ?? 0,
      resultsRight: resultsRect?.right ?? -1,
      viewportWidth: window.innerWidth,
      titleFontSize: parseFloat(getComputedStyle(document.querySelector(".event-detail h2")).fontSize),
      titleColor: getComputedStyle(document.querySelector(".event-detail h2")).color,
      sectionCount: document.querySelectorAll(".event-detail > section").length,
      detailText: document.querySelector(".event-detail")?.textContent || "",
      modifierEffects: document.querySelectorAll(".event-options .event-option-effects").length,
    };
  });
  assert.match(detail.title, /审判|1848/, "clicked event must show detail title");
  assert.equal(detail.source, "events/1848.txt:5", "clicked event must show source path");
  assert.equal(detail.optionCards, 2, "clicked event must show each choice in a distinct option card");
  assert.deepEqual(detail.optionNumbers, ["1", "2"], "option cards must have visible sequential numbers");
  assert.equal(detail.optionScripts, 2, "each option card must keep its raw script in a separate disclosure");
  const detailIcon = await page.evaluate(() => {
    const image = document.querySelector(".event-detail img.event-icon");
    return { src: image?.getAttribute("src") || "", loaded: Boolean(image?.complete && image.naturalWidth > 0) };
  });
  assert.match(detailIcon.src, /assets\/event-icons\/event_icons\/waving_flag\.webp$/, "event detail must use the converted WebP icon");
  assert.equal(detailIcon.loaded, true, "event detail WebP icon must load");
  assert.notEqual(detail.panelDisplay, "none", "clicked event detail panel must be visible");
  assert.ok(detail.panelWidth >= 240, "clicked event detail panel must have usable width");
  assert.ok(detail.panelLeft > detail.resultsRight, "event detail panel must be placed to the right of results");
  assert.ok(detail.panelRight <= detail.viewportWidth + 1, "event detail panel must stay within viewport");
  assert.ok(detail.titleFontSize >= 1.5 * 16, "event detail title must be larger");
  assert.equal(detail.titleColor, "rgb(243, 213, 139)", "event detail title must use a pale yellow");
  assert.ok(detail.sectionCount >= 4, "event detail must have readable content sections");
  assert.equal(detail.modifierEffects, 2, "modifier effects must be shown only in matching detail options");
  assert.match(detail.detailText, /country_law_enactment_success_add|立法成功率/, "modifier effects must be shown for options that add modifiers");
  await page.close();
  console.log(JSON.stringify({ event_board_browser: "ok", base_url: baseUrl }, null, 2));
} finally { chrome.kill(); await preview?.close(); }

async function openPage(viewport) { await waitForDebugEndpoint(); const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json(); const session = await connect(target.webSocketDebuggerUrl); await session.send("Page.enable"); await session.send("Runtime.enable"); await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false }); return { async goto(url) { const loaded = session.next("Page.loadEventFired"); const hashNavigated = session.next("Page.navigatedWithinDocument"); await session.send("Page.navigate", { url }); await Promise.race([loaded, hashNavigated]); await new Promise((resolve) => setTimeout(resolve, 180)); }, async evaluate(expression, ...args) { const result = await session.send("Runtime.evaluate", { expression: `(${expression})(${args.map((value) => JSON.stringify(value)).join(",")})`, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "browser evaluation failed"); return result.result.value; }, async click(selector) { const point = await this.evaluate((targetSelector) => { const element = document.querySelector(targetSelector); if (!element) return null; const box = element.getBoundingClientRect(); const target = document.elementFromPoint(box.left + box.width / 2, box.top + Math.min(16, box.height / 2)); return { x: box.left + box.width / 2, y: box.top + Math.min(16, box.height / 2), target: target?.closest("[data-event-id]")?.dataset.eventId || "", element: target?.tagName || "", className: target?.className || "" }; }, selector); assert(point?.target, `pointer target must be the event card: ${selector} ${JSON.stringify(point)}`); await session.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 }); await session.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 }); }, async waitFor(predicate, description) { const end = Date.now() + 20000; while (Date.now() < end) { if (await session.evaluate(predicate)) return; await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error(`${description} timed out`); }, close() { session.close(); } }; }
async function waitForDebugEndpoint() { const end = Date.now() + 10000; while (Date.now() < end) { try { await fetch(`http://127.0.0.1:${debugPort}/json/list`); return; } catch { await new Promise((resolve) => setTimeout(resolve, 50)); } } throw new Error("Chrome debugging endpoint did not start"); }
async function connect(url) { const socket = new WebSocket(url); const pending = new Map(); const events = new Map(); let sequence = 0; await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); }); socket.addEventListener("message", ({ data }) => { const message = JSON.parse(data); if (message.id) { const deferred = pending.get(message.id); pending.delete(message.id); deferred?.resolve(message); return; } (events.get(message.method) || []).forEach((deferred) => deferred.resolve(message)); events.delete(message.method); }); return { send(method, params = {}) { const id = ++sequence; const response = new Promise((resolve) => pending.set(id, { resolve })); socket.send(JSON.stringify({ id, method, params })); return response.then((message) => { if (message.error) throw new Error(message.error.message); return message.result || {}; }); }, next(method) { return new Promise((resolve) => events.set(method, [...(events.get(method) || []), { resolve }])); }, async evaluate(predicate) { const result = await this.send("Runtime.evaluate", { expression: `Boolean((${predicate})())`, returnByValue: true, awaitPromise: true }); return Boolean(result.result.value); }, close() { socket.close(); } }; }
async function startPreviewServer(root) { const server = http.createServer((request, response) => { const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname); const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, ""); const file = path.resolve(root, relative); if (!file.startsWith(`${root}${path.sep}`) && file !== path.join(root, "index.html")) { response.writeHead(403).end(); return; } if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404).end(); return; } response.writeHead(200, { "content-type": contentType(file), "cache-control": "no-store" }); fs.createReadStream(file).pipe(response); }); await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) }; }
function contentType(file) { return ({ ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" })[path.extname(file).toLowerCase()] || "application/octet-stream"; }
