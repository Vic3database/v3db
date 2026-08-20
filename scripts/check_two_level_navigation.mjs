import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

const root = process.cwd();
const indexSource = readText("site/index.html");
const uiSource = readText("site/app/ui.js");
const i18nSource = readText("site/app/i18n.js");
const foundationSource = readText("site/styles/foundation.css");
const shellSource = readText("site/styles/shell.css");
const stylesheetSource = readText("site/styles.css");
const vcBuildSource = readText("scripts/build_victorian_century_site.mjs");
const zhSource = readText("site/locales/ui.zh-Hans.js");
const enSource = readText("site/locales/ui.en.js");

const groups = {
  domestic: ["country", "law", "ideology", "interest-group"],
  society: ["culture"],
  economy: ["region", "company", "building", "goods"],
  technology: ["technology"],
  game: ["achievement"],
};

for (const [group, views] of Object.entries(groups)) {
  const menu = groupSource(group);
  assert.ok(menu, `missing ${group} topbar navigation group`);
  assert.ok(/<summary\b[^>]*class="[^"]*\btopbar-nav-summary\b/.test(menu), `${group} group needs a menu summary`);
  assert.ok(/class="[^"]*\btopbar-nav-popover\b/.test(menu), `${group} group needs a submenu container`);
  for (const view of views) {
    assert.ok(new RegExp(`data-nav-view="${view}"`).test(menu), `${group} group is missing ${view}`);
  }
}

for (const group of ["diplomacy", "military"]) {
  assert.ok(!new RegExp(`data-nav-group="${group}"`).test(indexSource), `${group} should remain hidden until it has records`);
}

for (const [key, zh, en] of [
  ["nav.domestic", "内政", "Domestic"],
  ["nav.society", "社会", "Society"],
  ["nav.economy", "经济", "Economy"],
  ["nav.gameContent", "游戏内容", "Game content"],
]) {
  assert.ok(zhSource.includes(`"${key}": "${zh}"`), `missing Simplified Chinese label for ${key}`);
  assert.ok(enSource.includes(`"${key}": "${en}"`), `missing English label for ${key}`);
}

assert.ok(/function\s+bindTopbarNavigationMenus\s*\(/.test(uiSource), "topbar menu behavior binder is missing");
assert.ok(/function\s+closeTopbarNavigationMenus\s*\(/.test(uiSource), "topbar menu close helper is missing");
assert.ok(/function\s+syncTopbarNavigationGroups\s*\(/.test(uiSource), "topbar active-group synchronizer is missing");
assert.ok(/matchMedia\("\(min-width: 761px\) and \(hover: hover\) and \(pointer: fine\)"\)/.test(uiSource), "desktop hover behavior must remain limited to the desktop layout");
assert.ok(/closeTopbarNavigationMenus\s*\(\)/.test(uiSource), "selecting a route should close open menus");
assert.ok(/syncTopbarNavigationGroups\s*\(\)/.test(uiSource), "rendering should synchronize active topbar groups");
assert.ok(/\.topbar-nav-group\s*\{[\s\S]*position:\s*relative/.test(foundationSource), "topbar category group needs a positioned desktop anchor");
assert.ok(/\.topbar-nav-popover\s*\{[\s\S]*position:\s*absolute/.test(foundationSource), "desktop submenu needs a popover layout");
assert.ok(/\.topbar-nav-group\.is-current\s*>\s*\.topbar-nav-summary/.test(foundationSource), "active topbar category needs a visible state");
assert.ok(/@media\s*\(max-width:\s*760px\)[\s\S]*\.topbar-nav-popover\s*\{[\s\S]*position:\s*static/.test(shellSource), "narrow screens need inline click-disclosure submenus");
assert.ok(/styles\.css\?v=20260813-character-images1/.test(indexSource), "topbar stylesheet cache version is stale");
assert.ok(/styles\/foundation\.css\?v=20260810-topbar-cache1/.test(stylesheetSource), "topbar foundation stylesheet cache version is stale");
assert.ok(/styles\/shell\.css\?v=20260810-topbar-cache1/.test(stylesheetSource), "topbar responsive stylesheet cache version is stale");
assert.ok(/app\/ui\.js\?v=20260810-interest-group-tooltip-layout1/.test(indexSource), "topbar UI script cache version is stale");
assert.ok(/app\/i18n\.js\?v=20260813-character-images1/.test(indexSource), "topbar localization runtime cache version is stale");
assert.ok(/v=20260813-character-images1/.test(i18nSource), "dynamic locale loading cache version is stale");
assert.ok(vcBuildSource.includes('/<link rel="stylesheet" href="styles\\.css\\?v=[^"]+"\\s*\\/?>/'), "Victorian Century builder must match the base stylesheet independently of its cache version");

console.log(JSON.stringify({
  two_level_navigation: "ok",
  groups: Object.keys(groups),
}, null, 2));

if (process.argv.includes("--browser")) await checkBrowser();

function groupSource(group) {
  const match = indexSource.match(new RegExp(`<details\\b[^>]*data-nav-group="${group}"[\\s\\S]*?<\\/details>`));
  return match?.[0] || "";
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, "");
}

async function checkBrowser() {
  const { chromium } = require("playwright");
  const urlIndex = process.argv.indexOf("--url");
  const publicIndexUrl = urlIndex >= 0 ? process.argv[urlIndex + 1] : "";
  assert.ok(urlIndex < 0 || publicIndexUrl, "--url requires a public index URL");
  const server = publicIndexUrl ? null : await startPreviewServer(root);
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.VC_CHROME_PATH ? { executablePath: process.env.VC_CHROME_PATH } : {}),
  });
  try {
    if (publicIndexUrl) {
      await checkBrowserSite(browser, publicIndexUrl, "public");
    } else {
      await checkBrowserSite(browser, `${server.url}/site/index.html`, "main");
      await checkBrowserSite(browser, `${server.url}/Victorian%20Century%20Database/index.html`, "victorian-century-standalone");
      await checkBrowserSite(browser, `${server.url}/site/vc/index.html`, "victorian-century-published");
    }
    console.log(JSON.stringify({ two_level_navigation_browser: "ok", base_url: publicIndexUrl || server.url }, null, 2));
  } finally {
    await browser.close();
    await server?.close();
  }
}

async function checkBrowserSite(browser, indexUrl, name) {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const browserErrors = [];
  desktop.on("pageerror", (error) => browserErrors.push(error.message));
  await desktop.goto(`${indexUrl}#/country`, { waitUntil: "domcontentloaded" });
  await desktop.waitForFunction(() => document.body.dataset.view === "country" && Boolean(document.querySelector('[data-nav-group="economy"]')));
  const economy = desktop.locator('[data-nav-group="economy"]');
  await economy.hover();
  await assertVisible(economy.locator(".topbar-nav-popover"), `${name}: desktop hover should reveal the economy submenu`);
  assert.equal(await economy.getAttribute("open"), "", `${name}: desktop hover should open the economy menu`);
  const menuGeometry = await economy.evaluate((node) => {
    const summary = node.querySelector("summary").getBoundingClientRect();
    const popover = node.querySelector(".topbar-nav-popover").getBoundingClientRect();
    return { summary, popover };
  });
  assert.ok(menuGeometry.popover.top > menuGeometry.summary.bottom, `${name}: desktop submenu should retain a visible gap below its summary`);
  await desktop.mouse.move(menuGeometry.summary.left + (menuGeometry.summary.width / 2), menuGeometry.summary.top + (menuGeometry.summary.height / 2));
  await desktop.mouse.move(menuGeometry.summary.left + (menuGeometry.summary.width / 2), menuGeometry.summary.bottom + 3);
  await desktop.waitForTimeout(20);
  assert.equal(await economy.getAttribute("open"), "", `${name}: crossing the submenu gap should keep the economy menu open`);
  const goodsGeometry = await economy.locator('[data-nav-view="goods"]').evaluate((node) => node.getBoundingClientRect());
  await desktop.mouse.move(goodsGeometry.left + (goodsGeometry.width / 2), goodsGeometry.top + (goodsGeometry.height / 2));
  assert.equal(await economy.getAttribute("open"), "", `${name}: entering a submenu item after crossing the gap should keep the economy menu open`);
  await economy.locator('[data-nav-view="goods"]').click();
  await desktop.waitForFunction(() => location.hash === "#/goods" && document.body.dataset.view === "goods");
  assert.equal(await economy.evaluate((node) => node.classList.contains("is-current")), true, `${name}: goods route should highlight the economy category`);
  await desktop.locator('[data-nav-group="technology"] > summary').focus();
  await desktop.waitForFunction(() => document.querySelector('[data-nav-group="technology"]')?.open === true);
  await desktop.locator('[data-nav-group="technology"] [data-nav-view="technology"]').click();
  await desktop.waitForFunction(() => location.hash === "#/technology" && document.body.dataset.view === "technology");
  assert.deepEqual(browserErrors, [], `${name}: desktop navigation errors: ${browserErrors.join(" | ")}`);
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 442, height: 844 } });
  await mobile.goto(`${indexUrl}#/country`, { waitUntil: "domcontentloaded" });
  await mobile.waitForFunction(() => document.body.dataset.view === "country" && Boolean(document.querySelector('[data-nav-group="domestic"]')));
  const mobileDomestic = mobile.locator('[data-nav-group="domestic"]');
  assert.equal(await mobileDomestic.getAttribute("open"), null, `${name}: narrow screen menus should start closed`);
  await mobileDomestic.locator("summary").click();
  await mobile.waitForFunction(() => document.querySelector('[data-nav-group="domestic"]')?.open === true);
  const mobileLayout = await mobileDomestic.locator(".topbar-nav-popover").evaluate((node) => ({
    position: getComputedStyle(node).position,
    width: node.getBoundingClientRect().width,
    parentWidth: node.closest(".topbar-nav-group").getBoundingClientRect().width,
    navWidth: node.closest(".topbar-nav").getBoundingClientRect().width,
  }));
  assert.equal(mobileLayout.position, "static", `${name}: narrow screen submenu should remain in the topbar flow`);
  assert.ok(mobileLayout.width <= mobileLayout.parentWidth + 1, `${name}: narrow screen submenu should not overflow its category row`);
  assert.ok(mobileLayout.parentWidth >= mobileLayout.navWidth - 1, `${name}: an open narrow-screen category should occupy the full navigation row`);
  const mobileOverlap = await mobile.evaluate(() => {
    const openGroup = document.querySelector('[data-nav-group="domestic"]');
    const popover = openGroup.querySelector(".topbar-nav-popover").getBoundingClientRect();
    return [...document.querySelectorAll(".topbar-nav-group:not([data-nav-group='domestic']) > .topbar-nav-summary")].some((summary) => {
      const rect = summary.getBoundingClientRect();
      return rect.left < popover.right && rect.right > popover.left && rect.top < popover.bottom && rect.bottom > popover.top;
    });
  });
  assert.equal(mobileOverlap, false, `${name}: an open narrow-screen submenu must not overlap the other category summaries`);
  await mobile.close();
}

async function assertVisible(locator, message) {
  const visible = await locator.evaluate((node) => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  });
  assert.equal(visible, true, message);
}

function startPreviewServer(siteRoot) {
  const mime = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
  };
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
    const requested = path.resolve(siteRoot, pathname.slice(1));
    if (requested !== siteRoot && !requested.startsWith(`${siteRoot}${path.sep}`)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    const target = fs.statSync(requested, { throwIfNoEntry: false })?.isDirectory()
      ? path.join(requested, "index.html")
      : requested;
    fs.readFile(target, (error, body) => {
      if (error) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": mime[path.extname(target).toLowerCase()] || "application/octet-stream" });
      response.end(body);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}
