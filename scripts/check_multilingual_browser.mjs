import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const baseUrl = process.argv[2] || "http://127.0.0.1:8876/index.html";
const screenshotRoot = path.resolve(process.argv[3] || "screenshots/multilingual");
const chromePath = process.env.VC_CHROME_PATH || "";
const siteName = process.env.VICDATA_SITE_NAME || (new URL(baseUrl).pathname.includes("/vc/") ? "vc" : "main");
const routes = [
  { board: "country", route: "country/PRU", list: "[data-country]" },
  { board: "culture", route: "culture/north_german", list: "[data-culture]" },
  { board: "region", route: "state-region/STATE_BRANDENBURG", list: "[data-state-region]" },
  { board: "company", route: "company/company_aker_mek", list: "[data-company]" },
  { board: "ideology", route: "ideology/ideology_ibadi_imamate", list: "[data-ideology]" },
  { board: "law", route: "law/law_monarchy", list: "[data-law]" },
  { board: "technology", route: "technology/academia", list: "[data-technology-key]" },
  { board: "achievement", route: "achievement/achievement_viva_la_confederacion", list: "[data-achievement-key]" },
];
const viewports = [
  { name: "1440x1000", width: 1440, height: 1000 },
  { name: "390x844", width: 390, height: 844 },
];

fs.mkdirSync(screenshotRoot, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(chromePath ? { executablePath: chromePath } : {}) });

try {
  await verifyLocaleBoundaries();
  await verifyEnglishStructuredDetails();
  await verifyEnglishSharedSurfaces();
  const screenshots = await captureBoardScreenshots();
  const detailAudit = await auditAllEnglishDetails();
  console.log(JSON.stringify({
    multilingual_browser: "ok",
    base_url: baseUrl,
    site: siteName,
    routes: routes.map(({ board }) => board),
    viewports: viewports.map(({ name }) => name),
    screenshots,
    detail_audit: detailAudit,
  }));
} finally {
  await browser.close();
}

async function verifyEnglishStructuredDetails() {
  const page = await newPage(viewports[0]);
  await page.addInitScript(() => localStorage.clear());
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await page.goto(urlFor("law/law_monarchy", "en"), { waitUntil: "networkidle", timeout: 45000 });
    await waitForEnglishBoardDetail(page, "law");
    const lawEffects = await page.locator(".detail > .law-effect-list > li:not(.law-effect-section-label)").evaluateAll((nodes) => (
      nodes.map((node) => ({
        label: node.querySelector("span")?.textContent?.trim() || "",
        value: node.querySelector("strong")?.textContent?.trim() || "",
        text: node.textContent?.trim() || "",
      }))
    ));
    assert.deepEqual(
      lawEffects.map((item) => item.value),
      ["+20", "+10%", "+25%", "+200"],
      `English law effects must expose structural values at ${viewport.width}px`,
    );
    assert.ok(lawEffects.every((item) => item.label && item.label !== item.value), `English law effect labels must not repeat as values at ${viewport.width}px`);
    assertNoGameMarkup(lawEffects.map((item) => item.text).join("\n"), `English law effects at ${viewport.width}px`);

    await page.goto(urlFor("ideology/ideology_ibadi_imamate", "en"), { waitUntil: "networkidle", timeout: 45000 });
    await waitForEnglishBoardDetail(page, "ideology");
    const ideologyDescription = (await page.locator(".vic3-ideology-desc").innerText()).trim();
    assert.equal(
      ideologyDescription,
      "This group supports the leadership of an Imam, and promotes the political supremacy of the Imamate and an ideal political-religious order.",
      `English ideology description must remove game formatting at ${viewport.width}px`,
    );
    assertNoGameMarkup(ideologyDescription, `English ideology description at ${viewport.width}px`);

    await page.goto(urlFor("ideology/ideology_ibadi_imamate", "zh-Hans"), { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForFunction(() => (
      document.documentElement.lang === "zh-Hans"
        && document.body.dataset.view === "ideology"
        && Boolean(document.querySelector(".vic3-ideology-desc"))
    ), { timeout: 20000 });
    assert.equal(
      (await page.locator(".vic3-ideology-desc").innerText()).trim(),
      "这个集团支持伊玛目的领导，并主张伊玛目政权在政治上至高无上的地位，以及一种理想的政治‑宗教秩序。",
      `Chinese ideology description must remove residual game formatting at ${viewport.width}px`,
    );

    await page.goto(urlFor("company/company_aker_mek", "en"), { waitUntil: "networkidle", timeout: 45000 });
    await waitForEnglishBoardDetail(page, "company");
    const companyDetail = await page.evaluate(() => {
      const fieldValue = (label) => {
        const term = [...document.querySelectorAll(".detail dt")].find((node) => node.textContent?.trim() === label);
        return term?.nextElementSibling?.textContent?.trim() || "";
      };
      return {
        name: document.querySelector(".company-detail-base h2, .detail-title h2")?.textContent?.trim() || "",
        category: fieldValue("Ownership category"),
        listTags: [...document.querySelectorAll('[data-company="company_aker_mek"] .tag-pill')].map((node) => node.textContent?.trim() || ""),
        prosperity: [...document.querySelectorAll(".tag-effect")].map((node) => node.textContent?.trim() || ""),
        prosperityOverflow: [...document.querySelectorAll(".tag-effect")].some((node) => {
          const detailRect = document.querySelector(".detail")?.getBoundingClientRect();
          const nodeRect = node.getBoundingClientRect();
          return Boolean(detailRect && (nodeRect.right > detailRect.right + 1 || node.scrollWidth > node.clientWidth + 1));
        }),
      };
    });
    assert.equal(companyDetail.category, "None", `Company without an ownership category must not repeat its name at ${viewport.width}px`);
    assert.notEqual(companyDetail.category, companyDetail.name, `Company ownership category must differ from the company name at ${viewport.width}px`);
    assert.equal(companyDetail.listTags.includes(companyDetail.name), false, `Company list tags must not repeat the company name at ${viewport.width}px`);
    assert.deepEqual(
      companyDetail.prosperity.map((item) => item.match(/[+-][\d.,]+%?$/)?.[0] || ""),
      ["+15%", "+5%"],
      `English company prosperity effects must expose structural values at ${viewport.width}px`,
    );
    assertNoGameMarkup(companyDetail.prosperity.join("\n"), `English company prosperity effects at ${viewport.width}px`);
    assert.equal(companyDetail.prosperityOverflow, false, `English company prosperity effects must remain readable at ${viewport.width}px`);
  }
  await page.close();
}

async function waitForEnglishBoardDetail(page, view) {
  await page.waitForFunction((expectedView) => (
    document.documentElement.lang === "en"
      && document.body.dataset.view === expectedView
      && Boolean(document.querySelector(".detail h2"))
  ), view, { timeout: 20000 });
}

async function verifyLocaleBoundaries() {
  const searchPage = await newPage({ width: 1440, height: 600 });
  await searchPage.addInitScript(() => localStorage.clear());
  await searchPage.goto(urlFor("country/PRU", "zh-Hans"), { waitUntil: "networkidle", timeout: 45000 });
  await waitForDetail(searchPage, "zh-Hans");
  await searchPage.locator("#globalSearchButton").click();
  for (const query of ["普鲁士", "Prussia", "PRU"]) {
    await searchPage.locator("#globalSearchDialogInput").fill(query);
    await searchPage.waitForFunction((expected) => (
      [...document.querySelectorAll("[data-result-key]")].some((node) => node.dataset.resultKey === expected)
    ), "PRU", { timeout: 10000 });
  }
  await searchPage.locator("#globalSearchCloseButton").click();
  await searchPage.close();

  const page = await newPage({ width: 1440, height: 600 });
  await page.addInitScript(() => localStorage.clear());
  await page.goto(urlFor("country/PRU", "zh-Hans"), { waitUntil: "networkidle", timeout: 45000 });
  await waitForDetail(page, "zh-Hans");
  const before = await page.evaluate(() => {
    const input = document.querySelector("#searchInput");
    input.value = "PRU";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return { hash: location.hash, query: input.value };
  });
  await page.waitForFunction(() => document.querySelector(".detail")?.scrollHeight > document.querySelector(".detail")?.clientHeight, { timeout: 10000 });
  const beforeSwitch = await page.evaluate(() => {
    const detail = document.querySelector(".detail");
    detail.scrollTop = Math.min(80, Math.max(0, detail.scrollHeight - detail.clientHeight));
    return { scrollTop: detail.scrollTop };
  });
  assert.ok(beforeSwitch.scrollTop > 0, "test setup must establish a detail scroll position");
  await page.locator("#languageMenuButton").click();
  await page.locator('#languageMenu [data-locale="en"]').click();
  await page.waitForFunction(() => document.documentElement.lang === "en", { timeout: 20000 });
  await page.waitForTimeout(50);
  const switched = await page.evaluate(() => ({
    hash: location.hash,
    query: document.querySelector("#searchInput")?.value || "",
    scrollTop: document.querySelector(".detail")?.scrollTop || 0,
    title: document.querySelector(".detail h2")?.textContent || "",
    hanTextLines: [...new Set(document.body.innerText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /[\u3400-\u9fff\uf900-\ufaff]/.test(line)))],
  }));
  assert.equal(switched.hash, before.hash, "language switch must retain the current detail");
  assert.equal(switched.query, before.query, "language switch must retain the active filter");
  assert.equal(switched.scrollTop, beforeSwitch.scrollTop, "language switch must retain detail scroll position");
  assert.match(switched.title, /Prussia/, "English country detail must render after switching");
  assert.ok(
    switched.hanTextLines.length === 0,
    `English language switch with active filters contains Chinese text: ${switched.hanTextLines.slice(0, 8).join(" | ")}`,
  );
  await page.reload({ waitUntil: "networkidle", timeout: 45000 });
  await waitForDetail(page, "en");
  assert.match(page.url(), /[?&]lang=en(?:&|#|$)/, "refresh must retain the selected locale");
  await page.close();

  const fallbackPage = await newPage({ width: 1440, height: 600 });
  await fallbackPage.addInitScript(() => localStorage.clear());
  await fallbackPage.goto(urlFor("country/PRU", "unsupported"), { waitUntil: "networkidle", timeout: 45000 });
  await waitForDetail(fallbackPage, "zh-Hans");
  assert.match(fallbackPage.url(), /[?&]lang=zh-Hans(?:&|#|$)/, "unsupported locale must use browser language fallback");
  await fallbackPage.close();

  const failurePage = await newPage({ width: 1440, height: 600 });
  await failurePage.addInitScript(() => localStorage.clear());
  await failurePage.goto(urlFor("country/PRU", "zh-Hans"), { waitUntil: "networkidle", timeout: 45000 });
  await waitForDetail(failurePage, "zh-Hans");
  const failureBefore = await failurePage.evaluate(() => ({
    hash: location.hash,
    title: document.querySelector(".detail h2")?.textContent || "",
  }));
  await failurePage.evaluate(() => {
    window.VIC3_DATA_INDEX.locales.chunks.en.country.files[0].path = "locale-missing.en.js";
    switchLocale("en");
  });
  await failurePage.waitForTimeout(500);
  const failureAfter = await failurePage.evaluate(() => ({
    locale: document.documentElement.lang,
    hash: location.hash,
    title: document.querySelector(".detail h2")?.textContent || "",
  }));
  assert.equal(failureAfter.locale, "zh-Hans", "failed locale load must keep the active locale");
  assert.equal(failureAfter.hash, failureBefore.hash, "failed locale load must keep the current detail");
  assert.equal(failureAfter.title, failureBefore.title, "failed locale load must keep rendered data");
  await failurePage.close();

  const rapidPage = await newPage({ width: 1440, height: 600 });
  await rapidPage.addInitScript(() => localStorage.clear());
  await rapidPage.goto(urlFor("country/PRU", "zh-Hans"), { waitUntil: "networkidle", timeout: 45000 });
  await waitForDetail(rapidPage, "zh-Hans");
  await rapidPage.evaluate(() => {
    switchLocale("en");
    queueMicrotask(() => switchLocale("zh-Hans"));
  });
  await rapidPage.waitForTimeout(500);
  assert.equal(await rapidPage.evaluate(() => document.documentElement.lang), "zh-Hans", "latest rapid locale choice must win");
  await rapidPage.close();
}

async function captureBoardScreenshots() {
  const screenshots = [];
  const page = await newPage(viewports[0]);
  await page.addInitScript(() => localStorage.clear());
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const item of routes) {
      await page.goto(urlFor(item.route, "en"), { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForSelector(item.list, { state: "attached", timeout: 20000 });
      await waitForDetail(page, "en");
      await page.locator("details").evaluateAll((nodes) => nodes.forEach((node) => { node.open = true; }));
      const conceptTarget = page.locator(".detail [data-concept-kind]").first();
      if (await conceptTarget.count()) {
        await conceptTarget.hover();
        await page.waitForSelector("#conceptTooltip:not([hidden])", { timeout: 5000 });
      }
      const layout = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        hanTextLines: [...new Set(document.body.innerText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => /[\u3400-\u9fff\uf900-\ufaff]/.test(line)))],
        hanAttributes: [...new Set([...document.querySelectorAll("[placeholder], [title], [aria-label]")]
          .filter((node) => node.getClientRects().length > 0)
          .flatMap((node) => [node.getAttribute("placeholder"), node.getAttribute("title"), node.getAttribute("aria-label")])
          .filter((value) => /[\u3400-\u9fff\uf900-\ufaff]/.test(value || "")))],
        overlappingNavigationLabels: [...document.querySelectorAll(".topbar-nav-item span")].some((node, index, labels) => {
          const current = node.getBoundingClientRect();
          const next = labels[index + 1]?.getBoundingClientRect();
          return next && current.right > next.left + 1;
        }),
      }));
      assert.ok(layout.scrollWidth <= layout.viewportWidth + 1, `${item.board} English layout overflows at ${viewport.width}px`);
      assert.equal(layout.overlappingNavigationLabels, false, `${item.board} English navigation labels overlap at ${viewport.width}px`);
      assert.ok(
        layout.hanTextLines.length === 0,
        `${item.board} English page contains Chinese text at ${viewport.width}px: ${layout.hanTextLines.slice(0, 8).join(" | ")}`,
      );
      assert.ok(
        layout.hanAttributes.length === 0,
        `${item.board} English page contains Chinese accessible text at ${viewport.width}px: ${layout.hanAttributes.slice(0, 8).join(" | ")}`,
      );
      const output = path.join(screenshotRoot, `${siteName}-${item.board}-en-${viewport.name}.png`);
      await page.screenshot({ path: output, fullPage: false });
      screenshots.push(path.relative(process.cwd(), output).replace(/\\/g, "/"));
    }
  }
  await page.close();
  return screenshots;
}

async function verifyEnglishSharedSurfaces() {
  const page = await newPage({ width: 1440, height: 1000 });
  await page.addInitScript(() => localStorage.clear());
  await page.goto(urlFor("country/PRU", "en"), { waitUntil: "networkidle", timeout: 45000 });
  await waitForDetail(page, "en");

  for (const [button, name] of [["#settingsNavButton", "settings"], ["#aboutNavButton", "about"]]) {
    await page.locator(button).click();
    await page.waitForSelector("#infoDialog:not([hidden])", { timeout: 5000 });
    assertNoHanText(await page.locator("#infoDialog").innerText(), `${name} dialog`);
    await page.locator("#infoDialogCloseButton").click();
  }

  await page.locator("#globalSearchButton").click();
  await page.locator("#globalSearchDialogInput").fill("Prussia");
  await page.waitForSelector('[data-result-key="PRU"]', { timeout: 10000 });
  assertNoHanText(await page.locator("#globalSearchDialog").innerText(), "global search dialog");
  await page.locator("#globalSearchCloseButton").click();

  await page.goto(urlFor("region", "en"), { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForFunction(() => document.documentElement.lang === "en" && document.body.dataset.view === "region" && Boolean(document.querySelector("#mapCanvas")), { timeout: 20000 });
  const resourceKeys = await page.locator("[data-resource-filter]").evaluateAll((nodes) => (
    nodes.map((node) => node.dataset.resourceFilter).filter(Boolean)
  ));
  assert.ok(resourceKeys.length > 0, "English region page must expose resource filters");
  for (const resourceKey of resourceKeys) {
    await page.locator(`[data-resource-filter="${resourceKey}"]`).click();
    await page.waitForFunction((key) => (
      document.querySelector(`[data-resource-filter="${key}"]`)?.getAttribute("aria-pressed") === "true"
        && Boolean(document.querySelector("#mapResourceContext:not([hidden])"))
    ), resourceKey, { timeout: 10000 });
    assertNoHanText(await page.locator("body").innerText(), `region selected resource ${resourceKey}`);
  }
  const box = await page.locator("#mapCanvas").boundingBox();
  let tooltipText = "";
  for (let y = box.y + 20; y < box.y + box.height - 10 && !tooltipText; y += 50) {
    for (let x = box.x + 20; x < box.x + box.width - 10 && !tooltipText; x += 50) {
      await page.mouse.move(x, y);
      if (await page.locator("#mapTooltip:not([hidden])").count()) tooltipText = await page.locator("#mapTooltip").innerText();
    }
  }
  assert.ok(tooltipText, "English region map must expose a state-region tooltip");
  assertNoHanText(tooltipText, "region map tooltip");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(urlFor("region", "en"), { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForFunction(() => document.documentElement.lang === "en" && document.body.dataset.view === "region", { timeout: 20000 });
  await page.locator('[data-resource-filter="building_coal_mine"]').click();
  await page.waitForFunction(() => document.querySelector("#mapResourceContext")?.textContent?.trim(), { timeout: 10000 });
  assertNoHanText(await page.locator("body").innerText(), "region selected resource at 390px");
  await page.close();
}

async function auditAllEnglishDetails() {
  const page = await newPage({ width: 1440, height: 1000 });
  await page.addInitScript(() => localStorage.clear());
  for (const item of routes) {
    await page.goto(urlFor(item.route, "en"), { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForSelector(item.list, { state: "attached", timeout: 20000 });
    await page.waitForFunction((expectedView) => document.body.dataset.view === expectedView, item.board, { timeout: 20000 });
    await waitForDetail(page, "en");
  }
  const audit = await page.evaluate(() => {
    const sets = [
      ["country", countries, renderCountryDetail, (item) => item.tag],
      ["culture", cultures, renderCultureDetail, (item) => item.key],
      ["stateRegion", stateRegions, renderStateRegionDetail, (item) => item.key],
      ["strategicRegion", strategicRegions, renderStrategicRegionDetail, (item) => item.key],
      ["geographicRegion", geographicRegions, renderGeographicRegionDetail, (item) => item.key],
      ["company", companies, renderCompanyDetail, (item) => item.key],
      ["ideology", ideologies, renderIdeologyDetail, (item) => item.key],
      ["law", laws, renderLawDetail, (item) => item.key],
      ["technology", technologies, (item) => { els.detail.innerHTML = renderTechnologyDetail(item); }, (item) => item.key],
      ["achievement", achievements, renderAchievementDetail, (item) => item.key],
    ];
    return sets.map(([kind, items, renderDetail, keyOf]) => {
      const findings = [];
      const markupFindings = [];
      for (const item of items) {
        renderDetail(item);
        document.querySelectorAll(".detail details").forEach((node) => { node.open = true; });
        const lines = [...new Set((els.detail.innerText || "")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => /[\u3400-\u9fff\uf900-\ufaff]/.test(line)))];
        if (lines.length) findings.push({ key: keyOf(item), samples: lines.slice(0, 8) });
        const markupSelector = kind === "law"
          ? ".law-effect-list"
          : kind === "ideology"
            ? ".vic3-ideology-desc"
            : kind === "company"
              ? ".tag-effect"
              : "";
        const markupSamples = markupSelector
          ? [...els.detail.querySelectorAll(markupSelector)]
            .map((node) => node.textContent?.trim() || "")
            .filter((text) => /#!|#(?:lore|italic)\b|\[(?:concept_[A-Za-z0-9_]+|Nbsp)\]|\$[A-Za-z0-9_:.]+\$|@[A-Za-z0-9_]+!/.test(text))
            .slice(0, 8)
          : [];
        if (markupSamples.length) markupFindings.push({ key: keyOf(item), samples: markupSamples });
        if (findings.length >= 8 && markupFindings.length >= 8) break;
      }
      return { kind, count: items.length, findings, markupFindings };
    });
  });
  await page.close();
  const failures = audit.filter((entry) => entry.findings.length);
  const markupFailures = audit.filter((entry) => entry.markupFindings.length);
  const emptySets = audit.filter((entry) => entry.count === 0);
  assert.ok(emptySets.length === 0, `English detail audit did not load: ${emptySets.map((entry) => entry.kind).join(", ")}`);
  assert.ok(
    failures.length === 0,
    `English detail audit contains Chinese text: ${failures.map((entry) => `${entry.kind} ${JSON.stringify(entry.findings)}`).join(" | ")}`,
  );
  assert.ok(
    markupFailures.length === 0,
    `English detail audit contains raw game localization markup: ${markupFailures.map((entry) => `${entry.kind} ${JSON.stringify(entry.markupFindings)}`).join(" | ")}`,
  );
  return Object.fromEntries(audit.map((entry) => [entry.kind, entry.count]));
}

function urlFor(route, locale) {
  const url = new URL(baseUrl);
  url.searchParams.set("lang", locale);
  url.hash = `/${route}`;
  return url.href;
}

async function waitForDetail(page, locale) {
  await page.waitForFunction((expectedLocale) => (
    document.documentElement.lang === expectedLocale
      && Boolean(document.querySelector(".detail h2, .technology-detail h2, .achievement-detail h2"))
  ), locale, { timeout: 20000 });
}

async function newPage(viewport) {
  return browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
}

function assertNoHanText(text, label) {
  const lines = [...new Set(String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /[\u3400-\u9fff\uf900-\ufaff]/.test(line)))];
  assert.ok(lines.length === 0, `${label} contains Chinese text: ${lines.slice(0, 8).join(" | ")}`);
}

function assertNoGameMarkup(text, label) {
  assert.doesNotMatch(
    String(text || ""),
    /#!|#(?:lore|italic)\b|\[(?:concept_[A-Za-z0-9_]+|Nbsp)\]|\$[A-Za-z0-9_:.]+\$|@[A-Za-z0-9_]+!/,
    `${label} contains raw game localization markup`,
  );
}
