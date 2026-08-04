import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:8876/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9238;
const chrome = spawn(chromePath, [
  `--remote-debugging-port=${debugPort}`,
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "about:blank",
], { stdio: "ignore", windowsHide: true });

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await openPage(viewport);
    await verifyLocaleSwitch(page, {
      route: "ideology/ideology_abolitionist",
      zhTitle: "\u5e9f\u5974\u4e3b\u4e49\u8005",
      zhBody: "\u89d2\u8272\u6743\u91cd",
      enTitle: "Abolitionist",
      enBody: "Character weight",
      query: "ideology_abolitionist",
    });
    await verifyLocaleSwitch(page, {
      route: "law/law_monarchy",
      zhTitle: "\u541b\u4e3b\u5236",
      zhBody: "\u6cbb\u7406\u539f\u5219",
      enTitle: "Monarchy",
      enBody: "Governance Principles",
      query: "law_monarchy",
      tooltipKind: "ideology",
    });
    await page.close();
  }
  console.log(JSON.stringify({
    multilingual_ideology_law_browser: "ok",
    viewports: ["1440x900", "390x844"],
    locales: ["zh-Hans", "en"],
    state_preservation: ["detail", "search", "scroll"],
    tooltip: "ideology",
  }, null, 2));
} finally {
  chrome.kill();
}

async function verifyLocaleSwitch(page, { route, zhTitle, zhBody, enTitle, enBody, query, tooltipKind = "" }) {
  await page.goto(`${baseUrl}?lang=zh-Hans#/${route}`);
  await page.waitForSelector(".detail h2", `zh-Hans ${route}`);
  const before = await page.evaluate((searchQuery) => {
    const input = document.querySelector("#searchInput");
    input.value = searchQuery;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const panel = document.querySelector(".detail");
    panel.scrollTop = Math.min(80, Math.max(0, panel.scrollHeight - panel.clientHeight));
    window.scrollTo(0, Math.min(80, Math.max(0, document.documentElement.scrollHeight - window.innerHeight)));
    return {
      lang: document.documentElement.lang,
      hash: location.hash,
      title: document.querySelector(".detail h2")?.textContent?.trim() || "",
      body: panel?.textContent || "",
      query: input.value,
      scrollTop: window.innerWidth <= 390 ? window.scrollY : panel?.scrollTop || 0,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      overflow: [...document.querySelectorAll("body *")].map((node) => {
        const rect = node.getBoundingClientRect();
        return { tag: node.tagName, className: node.className || "", left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
      }).filter((item) => item.left < -1 || item.right > window.innerWidth + 1).slice(0, 12),
    };
  }, query);
  assert.equal(before.lang, "zh-Hans", `${route} must start in zh-Hans`);
  assert.ok(before.title.includes(zhTitle), `${route} Chinese title must include ${zhTitle}`);
  assert.ok(before.body.includes(zhBody), `${route} Chinese detail must include ${zhBody}`);
  assert.ok(before.scrollWidth <= before.viewportWidth + 1, `${route} must not overflow horizontally in zh-Hans: ${JSON.stringify(before)}`);

  await page.evaluate(() => {
    document.querySelector("#languageMenuButton")?.click();
    document.querySelector('#languageMenu [data-locale="en"]')?.click();
  });
  await page.waitFor(() => document.documentElement.lang === "en", `English switch for ${route}`);
  const after = await page.evaluate(() => {
    const panel = document.querySelector(".detail");
    return {
      lang: document.documentElement.lang,
      hash: location.hash,
      title: document.querySelector(".detail h2")?.textContent?.trim() || "",
      body: panel?.textContent || "",
      query: document.querySelector("#searchInput")?.value || "",
      scrollTop: window.innerWidth <= 390 ? window.scrollY : panel?.scrollTop || 0,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  assert.equal(after.lang, "en", `${route} must switch to English`);
  assert.equal(after.hash, before.hash, `${route} must preserve the current detail route`);
  assert.equal(after.query, before.query, `${route} must preserve the current search filter`);
  assert.equal(after.scrollTop, before.scrollTop, `${route} must preserve the detail scroll position`);
  assert.ok(after.title.includes(enTitle), `${route} English title must include ${enTitle}`);
  assert.ok(after.body.includes(enBody), `${route} English detail must include ${enBody}`);
  assert.ok(after.scrollWidth <= after.viewportWidth + 1, `${route} must not overflow horizontally in English at ${after.viewportWidth}px`);

  if (tooltipKind) {
    const tooltip = await page.evaluate((kind) => {
      const target = document.querySelector(`[data-concept-kind="${kind}"]`);
      if (!target) return null;
      showConceptTooltip(target, { clientX: 24, clientY: 24 });
      return {
        hidden: document.querySelector("#conceptTooltip")?.hidden,
        text: document.querySelector("#conceptTooltip")?.textContent || "",
        label: target.dataset.conceptLabel || "",
        dedicated: document.querySelector("#conceptTooltip")?.classList.contains("ideology-tooltip"),
      };
    }, tooltipKind);
    assert.ok(tooltip, `${route} must render a ${tooltipKind} concept`);
    assert.equal(tooltip.hidden, false, `${route} ${tooltipKind} tooltip must be visible`);
    assert.equal(tooltip.dedicated, true, `${route} must retain the dedicated ideology tooltip layout`);
    assert.ok(tooltip.label && tooltip.text.includes(tooltip.label), `${route} tooltip must use the localized concept label`);
  }
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
      const loaded = session.next("Page.loadEventFired");
      const navigated = session.next("Page.navigatedWithinDocument");
      await session.send("Page.navigate", { url });
      await Promise.race([loaded, navigated]);
      await new Promise((resolve) => setTimeout(resolve, 150));
    },
    async evaluate(callback, argument) {
      const expression = argument === undefined
        ? `(${callback})()`
        : `(${callback})(${JSON.stringify(argument)})`;
      const result = await session.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "browser evaluation failed");
      return result.result.value;
    },
    async waitForSelector(selector, description) {
      const end = Date.now() + 20000;
      while (Date.now() < end) {
        const result = await session.send("Runtime.evaluate", { expression: `Boolean(document.querySelector(${JSON.stringify(selector)}))`, returnByValue: true });
        if (result.result.value) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const diagnostic = await session.send("Runtime.evaluate", {
        expression: `JSON.stringify({status:document.documentElement.dataset.vicdataStatus || "",hash:location.hash,body:document.body?.innerText?.slice(0,500) || ""})`,
        returnByValue: true,
      });
      throw new Error(`${description} timed out: ${diagnostic.result.value || "no diagnostic"}`);
    },
    async waitFor(predicate, description) {
      const end = Date.now() + 20000;
      while (Date.now() < end) {
        const result = await session.send("Runtime.evaluate", { expression: `(${predicate})()`, returnByValue: true });
        if (result.result.value) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(`${description} timed out`);
    },
    async close() {
      session.close();
    },
  };
}

async function waitForDebugger() {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    try {
      await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error("Chrome debug port did not start");
}

async function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const events = new Map();
  let sequence = 0;
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const deferred = pending.get(message.id);
      pending.delete(message.id);
      deferred?.resolve(message);
      return;
    }
    const waiters = events.get(message.method) || [];
    events.delete(message.method);
    waiters.forEach((deferred) => deferred.resolve(message));
  });
  return {
    send(method, params = {}) {
      const id = ++sequence;
      const response = new Promise((resolve) => pending.set(id, { resolve }));
      socket.send(JSON.stringify({ id, method, params }));
      return response.then((message) => {
        if (message.error) throw new Error(message.error.message);
        return message.result || {};
      });
    },
    next(method) {
      return new Promise((resolve) => events.set(method, [...(events.get(method) || []), { resolve }]));
    },
    close() {
      socket.close();
    },
  };
}
