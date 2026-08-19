import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9286;
const chromeProfile = fs.mkdtempSync(path.join(os.tmpdir(), "vicdata-vc-company-tools-"));
const chrome = spawn(chromePath, [
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${chromeProfile}`,
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "about:blank",
], { stdio: "ignore", windowsHide: true });
const server = await startPreviewServer(root);
const outputs = [
  { name: "standalone", path: "/Victorian%20Century%20Database/index.html" },
  { name: "published", path: "/site/vc/index.html" },
];

try {
  const reports = [];
  for (const output of outputs) {
    console.log(`[vc-company-tools] ${output.name}: company board`);
    const page = await openPage({ width: 1440, height: 1000 });
    try {
      const baseUrl = `${server.url}${output.path}`;
      await page.goto(`${baseUrl}?lang=zh-Hans#/company`);
      await page.waitFor(() => document.body.dataset.view === "company" && companies.length === 231, `${output.name} VC company data`);
      assert.equal(await page.evaluate(() => Boolean(document.querySelector("#companySolverEntry:not([hidden])"))), true, `${output.name} must show the solver entry`);
      assert.equal(await page.evaluate(() => Boolean(document.querySelector("#companyComposerEntry:not([hidden])"))), true, `${output.name} must show the composer entry`);

      await page.click("[data-company-composer-entry]");
      console.log(`[vc-company-tools] ${output.name}: composer`);
      await page.waitFor(() => document.body.dataset.companyComposer === "true" && document.querySelectorAll("[data-company-composer-company]").length === 231, `${output.name} VC composer wall`);
      await page.click("[data-company-composer-company='company_benz_cie']");
      await page.waitFor(() => window.__companyComposerDebug?.().selectedCompanyKeys?.[0] === "company_benz_cie", `${output.name} Benz composer selection`);
      const composer = await page.evaluate(() => ({
        summary: window.__companyComposerDebug(),
        extension: Boolean(document.querySelector("[data-company-composer-extension='building_tooling_workshop']")),
        prestige: Boolean(document.querySelector(".company-composer-good-link[href='#/goods/automobiles']")),
        prestigeDetails: Array.from(document.querySelectorAll(".company-composer-good-link"), (node) => ({ href: node.getAttribute("href"), title: node.getAttribute("title"), html: node.outerHTML })),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }));
      assert.deepEqual(composer.summary.selectedCompanyKeys, ["company_benz_cie"], `${output.name} must retain the VC-added company selection`);
      const combinedBuildings = composer.summary.buildingGroups.flatMap((group) => group.buildingKeys).concat(composer.summary.unclassifiedBuildingKeys || []);
      assert.equal(combinedBuildings.includes("building_automotive_industry"), true, `${output.name} Benz summary must include automobile industries`);
      assert.equal(combinedBuildings.includes("building_motor_industry"), true, `${output.name} Benz summary must include motor industries`);
      assert.equal(composer.extension, true, `${output.name} Benz summary must offer tooling workshops`);
      assert.equal(composer.prestige, true, `${output.name} Benz summary must show Benz automobiles: ${JSON.stringify(composer.prestigeDetails)}`);
      assert.equal(composer.overflow, false, `${output.name} composer must not overflow horizontally`);

      await page.click("[data-company-composer-company='company_benz_cie']");
      for (const key of ["company_a_markwald_and_company", "company_ap_moller"]) await page.click(`[data-company-composer-company='${key}']`);
      await page.waitFor(() => window.__companyComposerDebug?.().selectedCompanyKeys?.length === 2, `${output.name} shared port selection`);
      const overlap = await page.evaluate(() => {
        const link = document.querySelector("[data-company-composer-building-coverage='building_port']");
        return {
          links: document.querySelectorAll("[data-company-composer-building-coverage='building_port']").length,
          badge: link?.querySelector(".company-composer-building-overlap")?.textContent || "",
          title: link?.getAttribute("title") || "",
        };
      });
      assert.equal(overlap.links, 1, `${output.name} must keep one shared port icon`);
      assert.equal(overlap.badge, "×2", `${output.name} must mark two companies covering ports`);
      assert.match(overlap.title, /马克沃尔德/, `${output.name} shared port tooltip must name Markwald`);
      assert.match(overlap.title, /默勒/, `${output.name} shared port tooltip must name Moller`);

      await page.goto(`${baseUrl}?lang=zh-Hans&test=solver#/company/solver`);
      console.log(`[vc-company-tools] ${output.name}: solver`);
      await page.waitFor(() => document.body.dataset.companySolver === "true" && document.querySelectorAll("[data-company-solver-building]").length === 48, `${output.name} VC solver buildings`);
      for (const key of ["building_automotive_industry", "building_motor_industry"]) await page.click(`[data-company-solver-building='${key}']`);
      await page.click(".company-solver-prestige-filter summary");
      await page.waitFor(() => Boolean(document.querySelector("[data-company-solver-prestige='prestige_good_benz_car']:not(:disabled)")), `${output.name} Benz prestige filter`);
      await page.click("[data-company-solver-prestige='prestige_good_benz_car']");
      await page.click("[data-company-solver-run]");
      await page.waitFor(() => state.companySolver.status === "complete" && document.querySelectorAll(".company-solver-card").length > 0, `${output.name} VC solver result`);
      const solver = await page.evaluate(() => ({
        total: state.companySolver.total,
        solutions: state.companySolver.solutions.map((solution) => solution.companyKeys),
        selectedPrestigeGoods: [...state.companySolver.selectedPrestigeGoods],
        usage: {
          exists: Boolean(document.querySelector("[data-company-solver-usage]")),
          open: Boolean(document.querySelector("[data-company-solver-usage]")?.open),
        },
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }));
      assert.deepEqual(solver.selectedPrestigeGoods, ["prestige_good_benz_car"], `${output.name} must retain the Benz prestige condition`);
      assert.equal(solver.solutions.every((companyKeys) => companyKeys.includes("company_benz_cie")), true, `${output.name} Worker must enforce the Benz prestige condition: ${JSON.stringify(solver.solutions)}`);
      assert.equal(solver.usage.exists, true, `${output.name} solver must show company usage`);
      assert.equal(solver.usage.open, false, `${output.name} company usage must be collapsed by default`);
      assert.equal(solver.overflow, false, `${output.name} solver must not overflow horizontally`);

      await page.goto(`${baseUrl}?lang=zh-Hans&test=solver-prestige#/company/solver`);
      await page.waitFor(() => document.body.dataset.companySolver === "true" && document.querySelectorAll("[data-company-solver-building]").length === 48, `${output.name} fresh VC solver`);
      await page.click("[data-company-solver-building='building_glassworks']");
      await page.click(".company-solver-prestige-filter summary");
      await page.waitFor(() => Boolean(document.querySelector("[data-company-solver-prestige='prestige_good_bohemian_crystal']:not(:disabled)")), `${output.name} Bohemian crystal filter`);
      await page.click("[data-company-solver-prestige='prestige_good_bohemian_crystal']");
      const crystalRequest = await page.evaluate(() => ({
        companyCount: state.companySolver.companyCount,
        autoCompanyCount: state.companySolver.autoCompanyCount,
        groups: solverPrestigeGoodGroups(),
        provider: companies.find((company) => company.key === "company_ludwig_moser_and_sons"),
      }));
      await page.click("[data-company-solver-run]");
      await page.waitFor(() => state.companySolver.status === "complete", `${output.name} Bohemian crystal result`);
      const crystal = await page.evaluate(() => ({
        total: state.companySolver.total,
        companyCount: state.companySolver.companyCount,
        autoCompanyCount: state.companySolver.autoCompanyCount,
        solutions: state.companySolver.solutions.map((solution) => solution.companyKeys),
      }));
      assert.equal(crystalRequest.companyCount, 1, `${output.name} fresh prestige solve must begin with one company: ${JSON.stringify(crystalRequest)}`);
      assert.deepEqual(crystalRequest.groups, [["prestige_good_bohemian_crystal"]], `${output.name} must send the selected crystal group`);
      assert.equal(crystal.total, 1, `${output.name} glassworks and Bohemian crystal must find Moser: ${JSON.stringify({ crystalRequest, crystal })}`);
      assert.deepEqual(crystal.solutions, [["company_ludwig_moser_and_sons"]], `${output.name} crystal solution must use Moser`);
      reports.push({ output: output.name, companies: 231, overlap, solverBuildings: 48, solverTotal: solver.total, solverCompanies: solver.solutions, crystal });
    } finally {
      page.close();
    }

    for (const route of ["company/composer", "company/solver"]) {
      const narrow = await openPage({ width: 390, height: 844 });
      try {
        await narrow.goto(`${server.url}${output.path}?lang=zh-Hans#/${route}`);
        await narrow.waitFor(() => document.body.dataset.view === "company" && (document.body.dataset.companyComposer === "true" || document.body.dataset.companySolver === "true"), `${output.name} narrow ${route}`);
        const narrowLayout = await narrow.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          viewport: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          offenders: Array.from(document.querySelectorAll("body *"), (node) => {
            const rect = node.getBoundingClientRect();
            return rect.right > document.documentElement.clientWidth + 1 || rect.left < -1 ? { tag: node.tagName, className: node.className, left: rect.left, right: rect.right, width: rect.width, scrollWidth: node.scrollWidth } : null;
          }).filter(Boolean).slice(0, 12),
        }));
        assert.equal(narrowLayout.overflow, false, `${output.name} narrow ${route} must not overflow horizontally: ${JSON.stringify(narrowLayout)}`);
        if (route.endsWith("composer")) assert.equal(await narrow.evaluate(() => document.querySelectorAll("[data-company-composer-company]").length), 231, `${output.name} narrow composer must show every VC company`);
        else assert.equal(await narrow.evaluate(() => document.querySelectorAll("[data-company-solver-building]").length), 48, `${output.name} narrow solver must show every supported building`);
      } finally {
        narrow.close();
      }
    }
  }

  console.log("[vc-company-tools] standalone: local-file prestige solver");
  const filePage = await openPage({ width: 1440, height: 1000 });
  try {
    const fileUrl = `${pathToFileURL(path.join(root, "Victorian Century Database", "index.html")).href}?lang=zh-Hans&test=solver-file-prestige#/company/solver`;
    await filePage.goto(fileUrl);
    await filePage.waitFor(() => document.body.dataset.companySolver === "true" && document.querySelectorAll("[data-company-solver-building]").length === 48, "standalone local-file VC solver");
    await filePage.click("[data-company-solver-building='building_glassworks']");
    await filePage.click(".company-solver-prestige-filter summary");
    await filePage.waitFor(() => Boolean(document.querySelector("[data-company-solver-prestige='prestige_good_bohemian_crystal']:not(:disabled)")), "standalone local-file Bohemian crystal filter");
    await filePage.click("[data-company-solver-prestige='prestige_good_bohemian_crystal']");
    await filePage.click("[data-company-solver-run]");
    await filePage.waitFor(() => state.companySolver.status === "complete", "standalone local-file prestige result");
    assert.equal(await filePage.evaluate(() => state.companySolver.total), 1, "local-file glassworks and Bohemian crystal must find one company");
    assert.deepEqual(await filePage.evaluate(() => state.companySolver.solutions.map((solution) => solution.companyKeys)), [["company_ludwig_moser_and_sons"]], "local-file prestige result must use Moser");

    await filePage.evaluate(() => {
      const select = document.querySelector("[data-company-solver-company-count]");
      select.value = "7";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await filePage.click("[data-company-solver-run]");
    await filePage.waitFor(() => state.companySolver.status === "complete", "standalone local-file seven-company result");
    assert.equal(await filePage.evaluate(() => state.companySolver.total), 0, "seven companies cannot form a minimal one-building crystal solution");

    await filePage.evaluate(() => {
      const select = document.querySelector("[data-company-solver-company-count]");
      select.value = "1";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    assert.deepEqual(await filePage.evaluate(() => [...state.companySolver.selectedPrestigeGoods]), ["prestige_good_bohemian_crystal"], "changing company count must retain the prestige selection");
    await filePage.click("[data-company-solver-run]");
    await filePage.waitFor(() => state.companySolver.status === "complete", "standalone local-file one-company result after seven");
    const fileCrystal = await filePage.evaluate(() => ({
      total: state.companySolver.total,
      companyCount: state.companySolver.companyCount,
      solutions: state.companySolver.solutions.map((solution) => solution.companyKeys),
    }));
    assert.deepEqual(fileCrystal, { total: 1, companyCount: 1, solutions: [["company_ludwig_moser_and_sons"]] }, `local-file prestige result must recover after changing 7 to 1: ${JSON.stringify(fileCrystal)}`);
    reports.push({ output: "standalone-file", crystal: fileCrystal });
  } finally {
    filePage.close();
  }
  console.log(JSON.stringify({ victorian_century_company_tools_browser: "ok", reports }, null, 2));
} finally {
  chrome.kill();
  await server.close();
}

async function openPage(viewport) {
  await waitForDebugEndpoint();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  const runtimeErrors = [];
  session.listen("Runtime.exceptionThrown", (message) => {
    const detail = message.params?.exceptionDetails;
    runtimeErrors.push(detail?.exception?.description || detail?.text || "runtime exception");
  });
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
  return {
    async goto(url) {
      const loaded = session.next("Page.loadEventFired");
      await session.send("Page.navigate", { url });
      await loaded;
    },
    async evaluate(expression, ...args) {
      const call = `(${expression.toString()})(${args.map((value) => JSON.stringify(value)).join(",")})`;
      const result = await session.send("Runtime.evaluate", { expression: call, returnByValue: true, awaitPromise: true });
      if (result.result?.exceptionDetails) throw new Error(result.result.exceptionDetails.text || "browser evaluation failed");
      return result.result?.result?.value;
    },
    async click(selector) {
      assert.equal(await this.evaluate((value) => {
        const node = document.querySelector(value);
        if (!node) return false;
        node.click();
        return true;
      }, selector), true, `missing ${selector}`);
    },
    async waitFor(predicate, description) {
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        if (await this.evaluate(predicate)) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const diagnostic = await this.evaluate(() => ({
        href: location.href,
        view: document.body?.dataset?.view,
        solver: document.body?.dataset?.companySolver,
        composer: document.body?.dataset?.companyComposer,
        companies: typeof companies === "undefined" ? -1 : companies.length,
        cards: document.querySelectorAll(".company-solver-card").length,
        result: document.querySelector(".company-solver-results-head")?.textContent || "",
        body: document.body?.innerText?.slice(0, 1000) || "",
        solverState: typeof state === "undefined" ? null : {
          status: state.companySolver?.status,
          companyCount: state.companySolver?.companyCount,
          total: state.companySolver?.total,
          error: state.companySolver?.error,
          progress: state.companySolver?.progress,
          selectedBuildings: [...(state.companySolver?.selectedBuildings || [])],
          selectedPrestigeGoods: [...(state.companySolver?.selectedPrestigeGoods || [])],
        },
      }));
      throw new Error(`${description} timed out: ${JSON.stringify({ diagnostic, runtimeErrors })}`);
    },
    close() { session.close(); },
  };
}

async function waitForDebugEndpoint() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Chrome debug endpoint timed out");
}

async function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const listeners = new Map();
  let id = 0;
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const callback = pending.get(message.id);
    if (callback) {
      pending.delete(message.id);
      callback(message);
    }
    const queue = listeners.get(message.method);
    if (queue?.length) queue.shift()(message);
  });
  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const requestId = ++id;
        pending.set(requestId, (message) => message.error ? reject(new Error(message.error.message)) : resolve(message));
        socket.send(JSON.stringify({ id: requestId, method, params }));
      });
    },
    next(method) {
      return new Promise((resolve) => listeners.set(method, [...(listeners.get(method) || []), resolve]));
    },
    listen(method, listener) {
      const handler = (message) => {
        listener(message);
        this.listen(method, listener);
      };
      listeners.set(method, [...(listeners.get(method) || []), handler]);
    },
    close() { socket.close(); },
  };
}

async function startPreviewServer(baseDir) {
  const mimeTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
  };
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const candidate = path.resolve(baseDir, `.${pathname}`);
    if (candidate !== baseDir && !candidate.startsWith(`${baseDir}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    fs.readFile(candidate, (error, body) => {
      if (error) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { "Content-Type": mimeTypes[path.extname(candidate)] || "application/octet-stream", "Cache-Control": "no-store" });
      response.end(body);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return { url: `http://127.0.0.1:${address.port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}
