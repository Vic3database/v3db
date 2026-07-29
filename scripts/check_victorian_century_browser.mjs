import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const baseUrl = process.argv[2] || "http://127.0.0.1:8877/index.html";
const mainLibraryUrl = new URL("../", baseUrl).href;
const chromePath = process.env.VC_CHROME_PATH || "";
const routes = ["country", "culture", "region", "company", "ideology", "law", "technology"];
const vcChangeRowSelectorByRoute = {
  country: "[data-country]",
  culture: "[data-culture]",
  region: "[data-state-region]",
  company: "[data-company]",
  ideology: "[data-ideology]",
  law: "[data-law]",
  technology: "[data-technology-key]",
};
const vcChangeFilterSelectorsByRoute = {
  country: { added: "#victorianCenturyAddedFilter", adjusted: "#victorianCenturyAdjustedFilter" },
  culture: { added: "#victorianCenturyAddedFilter", adjusted: "#victorianCenturyAdjustedFilter" },
  region: { added: "#victorianCenturyAddedFilter", adjusted: "#victorianCenturyAdjustedFilter" },
  company: { added: "#victorianCenturyAddedFilter", adjusted: "#victorianCenturyAdjustedFilter" },
  ideology: { added: "#victorianCenturyAddedFilter", adjusted: "#victorianCenturyAdjustedFilter" },
  law: { added: "#victorianCenturyAddedFilter", adjusted: "#victorianCenturyAdjustedFilter" },
};
const browser = await chromium.launch({
  headless: true,
  ...(chromePath ? { executablePath: chromePath } : {}),
});

const errors = [];
try {
  const homePage = await openPage();
  await homePage.goto(`${baseUrl}#/home`, { waitUntil: "networkidle", timeout: 45000 });
  await homePage.waitForSelector("#countryList .home-category-card", { timeout: 20000 });
  const home = await homePage.evaluate(() => ({
    title: document.title,
    meta: document.querySelector("#metaLine")?.textContent?.trim() || "",
    librarySelector: Boolean(document.querySelector("#librarySelect")),
    standaloneLibrarySelector: Boolean(document.querySelector("#standaloneLibrarySelect")),
    standaloneLibraryOptions: Array.from(document.querySelectorAll("#standaloneLibrarySelect option"), (option) => ({
      value: option.value,
      text: option.textContent.trim(),
    })),
    announcements: document.documentElement.textContent.includes("公告"),
    news: document.documentElement.textContent.includes("游戏资讯"),
    changelog: document.documentElement.textContent.includes("更新日志"),
    canvas: {
      width: document.querySelector("#mapCanvas")?.width || 0,
      height: document.querySelector("#mapCanvas")?.height || 0,
    },
  }));
  assert(home.title === "首页 - Victorian Century Database", `unexpected home title: ${home.title}`);
  assert(!home.librarySelector && home.standaloneLibrarySelector && !home.announcements && !home.news && !home.changelog, "standalone home has an incorrect header feature set");
  assert(JSON.stringify(home.standaloneLibraryOptions) === JSON.stringify([
    { value: "victorian-century", text: "Victorian Century" },
    { value: "vic3", text: "Victoria 3 原版 1.13.9" },
  ]), "standalone library selector options are incorrect");
  assert(home.canvas.width === 4096 && home.canvas.height === 1808, "map canvas dimensions are incorrect");
  await Promise.all([
    homePage.waitForURL(mainLibraryUrl, { timeout: 20000 }),
    homePage.selectOption("#standaloneLibrarySelect", "vic3"),
  ]);
  await homePage.close();

  const views = {};
  for (const route of routes) {
    const page = await openPage();
    await page.goto(`${baseUrl}#/${route}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForFunction((expected) => document.body.dataset.view === expected, route, { timeout: 20000 });
    views[route] = await page.evaluate(() => ({
      view: document.body.dataset.view,
      title: document.title,
      resultCount: document.querySelector("#resultCount")?.textContent?.trim() || "",
      hasRows: Boolean(document.querySelector("#countryList button, #countryList article, #countryList .technology-tree")),
      mapHidden: Boolean(document.querySelector("#mapPanel")?.hidden),
    }));
    assert(views[route].hasRows, `${route} board has no rendered rows`);
    assert(!views[route].mapHidden, `${route} board unexpectedly hides the map`);
    if (route === "technology") {
      await page.waitForSelector(".technology-graph-canvas [data-technology-key='united_fruit_banana_tech']", { state: "attached", timeout: 15000 });
      views[route].addedTechnologyLayout = await page.evaluate(() => {
        const fruit = document.querySelector(".technology-graph-canvas [data-technology-key='united_fruit_banana_tech']")?.getBoundingClientRect();
        const sericulture = document.querySelector(".technology-graph-canvas [data-technology-key='sericulture']")?.getBoundingClientRect();
        return {
          addedFilterButton: Boolean(document.querySelector("[data-technology-victorian-added-filter]")),
          adjustedFilterButton: Boolean(document.querySelector("[data-technology-victorian-adjusted-filter]")),
          horizontalOffset: fruit && sericulture ? fruit.left - sericulture.left : Number.NaN,
        };
      });
      assert(!views[route].addedTechnologyLayout.addedFilterButton && !views[route].addedTechnologyLayout.adjustedFilterButton, "technology board still shows VC change filter buttons");
      assert(Math.abs(views[route].addedTechnologyLayout.horizontalOffset + 166) <= 1, `VC added technology position is incorrect: ${JSON.stringify(views[route].addedTechnologyLayout)}`);
      await page.close();
      continue;
    }
    process.stderr.write(`checking VC change filter: ${route}\n`);
    await page.waitForSelector(vcChangeRowSelectorByRoute[route], { state: "attached", timeout: 15000 });
    const filterSelectors = vcChangeFilterSelectorsByRoute[route];
    await page.waitForSelector("#victorianCenturyChangeFilterSection:not([hidden])", { state: "visible", timeout: 15000 });
    await page.click("#victorianCenturyChangeFilterSection > summary");
    await page.click(filterSelectors.added);
    await page.waitForFunction(({ rowSelector, addedSelector }) => {
      const rows = [...document.querySelectorAll(rowSelector)];
      return document.querySelector(addedSelector)?.getAttribute("aria-pressed") === "true"
        && rows.every((row) => row.querySelector(".tag-vc-added"));
    }, { rowSelector: vcChangeRowSelectorByRoute[route], addedSelector: filterSelectors.added }, { timeout: 15000 });
    views[route].vcAddedFilter = await page.evaluate(({ added, adjusted, rowSelector }) => ({
      addedPressed: document.querySelector(added)?.getAttribute("aria-pressed") || "",
      adjustedPressed: document.querySelector(adjusted)?.getAttribute("aria-pressed") || "",
      resultCount: document.querySelector("#resultCount")?.textContent?.trim() || "",
      visibleRows: document.querySelectorAll(rowSelector).length,
    }), { ...filterSelectors, rowSelector: vcChangeRowSelectorByRoute[route] });
    assert(views[route].vcAddedFilter.addedPressed === "true" && views[route].vcAddedFilter.adjustedPressed === "false", `${route} VC added filter state is incorrect`);
    assert(route === "region" || views[route].vcAddedFilter.visibleRows > 0, `${route} VC added filter returned no entries`);
    await page.click(filterSelectors.adjusted);
    await page.waitForFunction(({ rowSelector, added, adjusted }) => {
      const rows = [...document.querySelectorAll(rowSelector)];
      return document.querySelector(added)?.getAttribute("aria-pressed") === "true"
        && document.querySelector(adjusted)?.getAttribute("aria-pressed") === "true"
        && rows.length > 0
        && rows.every((row) => row.querySelector(".tag-vc-added, .tag-vc-adjusted"));
    }, { rowSelector: vcChangeRowSelectorByRoute[route], ...filterSelectors }, { timeout: 15000 });
    await page.click(filterSelectors.added);
    await page.waitForFunction(({ rowSelector, added, adjusted, expectsEmpty }) => {
      const rows = [...document.querySelectorAll(rowSelector)];
      return document.querySelector(added)?.getAttribute("aria-pressed") === "false"
        && document.querySelector(adjusted)?.getAttribute("aria-pressed") === "true"
        && (expectsEmpty ? rows.length === 0 : rows.length > 0 && rows.every((row) => row.querySelector(".tag-vc-adjusted")));
    }, { rowSelector: vcChangeRowSelectorByRoute[route], ...filterSelectors, expectsEmpty: false }, { timeout: 15000 });
    views[route].vcAdjustedFilter = await page.evaluate(({ added, adjusted, rowSelector }) => ({
      addedPressed: document.querySelector(added)?.getAttribute("aria-pressed") || "",
      adjustedPressed: document.querySelector(adjusted)?.getAttribute("aria-pressed") || "",
      resultCount: document.querySelector("#resultCount")?.textContent?.trim() || "",
      visibleRows: document.querySelectorAll(rowSelector).length,
    }), { ...filterSelectors, rowSelector: vcChangeRowSelectorByRoute[route] });
    assert(views[route].vcAdjustedFilter.addedPressed === "false" && views[route].vcAdjustedFilter.adjustedPressed === "true", `${route} VC adjusted filter state is incorrect`);
    assert(
      views[route].vcAdjustedFilter.visibleRows > 0,
      `${route} VC adjusted filter returned an incorrect number of entries`,
    );
    await page.close();
  }

  const companyListPage = await openPage();
  await companyListPage.goto(`${baseUrl}#/company`, { waitUntil: "networkidle", timeout: 45000 });
  await companyListPage.waitForSelector("[data-company='company_admiralty_rijkswerf'], [data-company='company_a_markwald_and_company']", { state: "attached", timeout: 15000 });
  const companyIconLayout = await companyListPage.evaluate(() => {
    const readLayout = (companyKey) => {
      const row = document.querySelector(`[data-company='${companyKey}']`);
      const heading = row?.querySelector(".company-heading")?.getBoundingClientRect();
      const icon = row?.querySelector(".company-logo")?.getBoundingClientRect();
      return {
        usesWebpPicture: Boolean(row?.querySelector("picture source[type='image/webp']")),
        relativeTop: heading && icon ? icon.top - heading.top : Number.NaN,
      };
    };
    return {
      victorianCentury: readLayout("company_admiralty_rijkswerf"),
      regular: readLayout("company_a_markwald_and_company"),
    };
  });
  assert(companyIconLayout.victorianCentury.usesWebpPicture && !companyIconLayout.regular.usesWebpPicture, "company icon layout fixtures are incorrect");
  assert(
    Math.abs(companyIconLayout.victorianCentury.relativeTop - companyIconLayout.regular.relativeTop) <= 1,
    `VC company icon is vertically misaligned: ${JSON.stringify(companyIconLayout)}`,
  );
  await companyListPage.close();

  const companyPage = await openPage();
  await companyPage.goto(`${baseUrl}#/company/company_benz_cie`, { waitUntil: "networkidle", timeout: 45000 });
  await companyPage.waitForSelector("picture source[type='image/webp'][srcset*='benz_cie.webp']", { state: "attached", timeout: 15000 });
  const webp = await companyPage.evaluate(() => ({
    source: document.querySelector("picture source[type='image/webp'][srcset*='benz_cie.webp']")?.getAttribute("srcset") || "",
    fallback: document.querySelector("picture img.company-logo[src*='benz_cie.png']")?.getAttribute("src") || "",
  }));
  assert(webp.source.endsWith("benz_cie.webp") && webp.fallback.endsWith("benz_cie.png"), "VC company icon lacks WebP and PNG fallback");
  await companyPage.close();

  const victorianCountryFlags = {};
  for (const expected of [
    { tag: "IMP", name: "帝国联邦", defaultImage: "assets/victorian-century-flags/IMP/IMP.png", variants: 3 },
    { tag: "RME", name: "罗马帝国", defaultImage: "assets/victorian-century-flags/RME/RME_Flag_Monarchy.png", variants: 4 },
  ]) {
    const page = await openPage();
    await page.goto(`${baseUrl}#/country/${expected.tag}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForSelector(".detail-title .country-flag-title", { state: "visible", timeout: 15000 });
    await page.waitForFunction(() => Array.from(document.querySelectorAll(".country-flag-variant-image")).every((image) => image.complete && image.naturalWidth > 0), { timeout: 15000 });
    const flagState = await page.evaluate(() => ({
      title: document.querySelector(".detail-title h2")?.textContent?.trim() || "",
      defaultImage: document.querySelector(".detail-title .country-flag-title")?.getAttribute("src") || "",
      variantImages: Array.from(document.querySelectorAll(".country-flag-variant-image"), (image) => ({
        src: image.getAttribute("src") || "",
        width: image.naturalWidth,
        height: image.naturalHeight,
      })),
    }));
    victorianCountryFlags[expected.tag] = flagState;
    assert(flagState.title === expected.name, `${expected.tag} country detail title is incorrect: ${flagState.title}`);
    assert(flagState.defaultImage === expected.defaultImage, `${expected.tag} default flag path is incorrect: ${flagState.defaultImage}`);
    assert(flagState.variantImages.length === expected.variants, `${expected.tag} flag variant count is incorrect: ${flagState.variantImages.length}`);
    assert(flagState.variantImages.every((image) => image.width === 240 && image.height === 144), `${expected.tag} has an unloaded or incorrectly sized flag image`);
    await page.close();
  }

  const regionPage = await openPage();
  await regionPage.goto(`${baseUrl}#/region`, { waitUntil: "networkidle", timeout: 45000 });
  const reset = await regionPage.evaluate(() => {
    const button = document.querySelector("#mapFitWidthButton");
    button?.click();
    return Boolean(button);
  });
  assert(reset, "region map reset button is missing");
  await regionPage.close();

  if (errors.length) throw new Error(errors.join("\n"));
  console.log(JSON.stringify({ victorian_century_browser: "ok", home, views, companyIconLayout, webp, victorianCountryFlags }, null, 2));
} finally {
  await browser.close();
}

function openPage() {
  return browser.newPage({ viewport: { width: 1440, height: 1000 } }).then((page) => {
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    return page;
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
