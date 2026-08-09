import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const expectedPalette = {
  ig_landowners: { standard: "#6A6AB0", background: "#1B1B2C", text: "#6A6AB0" },
  ig_petty_bourgeoisie: { standard: "#3D26B7", background: "#0F0A2E", text: "#B8A8F2" },
  ig_devout: { standard: "#4AAAB3", background: "#132B2D", text: "#4AAAB3" },
  ig_rural_folk: { standard: "#449977", background: "#11261E", text: "#449977" },
  ig_intelligentsia: { standard: "#E48B0A", background: "#392303", text: "#E48B0A" },
  ig_industrialists: { standard: "#E47639", background: "#391E0E", text: "#E47639" },
  ig_armed_forces: { standard: "#634740", background: "#191210", text: "#C6A988" },
  ig_trade_unions: { standard: "#942828", background: "#250A0A", text: "#D68A8A" },
};

async function main() {
const root = process.cwd();
const options = browserCheckOptions(root);
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
assert.ok(fs.existsSync(chromePath), `Chrome was not found at ${chromePath}`);

const server = await startPreviewServer(options.siteRoot);
const debugPort = await freePort();
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "vicdata-interest-group-browser-"));
const screenshotDir = fs.mkdtempSync(path.join(os.tmpdir(), "vicdata-interest-group-screenshots-"));
const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--disable-extensions",
  "--no-first-run",
  "--no-default-browser-check",
  "--remote-allow-origins=*",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  "about:blank",
], { stdio: "ignore", windowsHide: true });

try {
  const browserVersion = await waitFor(() => requestJson(`http://127.0.0.1:${debugPort}/json/version`), "Chrome debugging endpoint");
  const browser = await CdpClient.connect(browserVersion.webSocketDebuggerUrl);
  try {
    const desktop = await openPage(browser, { width: 1440, height: 1000 }, debugPort);
    if (options.englishIdeologyLabelsOnly) {
      const englishIdeologyLabels = await checkEnglishIdeologyLabels(desktop, server.url);
      console.log(JSON.stringify({
        interest_group_english_ideology_labels_browser: "ok",
        siteRoot: options.siteRoot,
        englishIdeologyLabels,
      }, null, 2));
      await desktop.close();
      return;
    }
    if (options.victorianCenturyFlavorsOnly) {
      const homeInterestGroupEntry = await checkHomeInterestGroupEntry(desktop, server.url);
      const victorianCenturyFlavors = await checkVictorianCenturyFlavorGroups(desktop, server.url);
      const namedCountryVariants = await checkNamedCountryVariants(desktop, server.url);
      const singleCountryTraitVariantNames = await checkSingleCountryTraitVariantNames(desktop, server.url);
      const countryListOrder = await checkCountryListOrder(desktop, server.url);
      console.log(JSON.stringify({
        victorian_century_interest_group_flavor_groups_browser: "ok",
        siteRoot: options.siteRoot,
        homeInterestGroupEntry,
        victorianCenturyFlavors,
        namedCountryVariants,
        singleCountryTraitVariantNames,
        countryListOrder,
      }, null, 2));
      await desktop.close();
      return;
    }
    const homeInterestGroupEntry = await checkHomeInterestGroupEntry(desktop, server.url);
    const desktopBoard = await checkDesktopBoard(desktop, server.url);
    const landowners = await checkSelectedFlavorDetail(desktop, server.url, "ig_landowners");
    const intelligentsia = await checkIntelligentsiaDetail(desktop, server.url);
    const englishIdeologyLabels = await checkEnglishIdeologyLabels(desktop, server.url);
    fs.writeFileSync(path.join(screenshotDir, "interest-group-intelligentsia-detail.png"), Buffer.from(await desktop.screenshot(), "base64"));
    fs.writeFileSync(path.join(screenshotDir, "interest-group-intelligentsia-detail-full.png"), Buffer.from((await desktop.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
    const tradeUnions = await checkTradeUnionDetail(desktop, server.url);
    const descriptiveVariants = await checkDescriptiveConditionVariants(desktop, server.url);
    const countryListOrder = await checkCountryListOrder(desktop, server.url);
    const laterFlavors = await checkLaterAvailableFlavors(desktop, server.url);
    const scrollChrome = await checkScrollChrome(desktop, server.url);
    const mobile = await openPage(browser, { width: 390, height: 844 }, debugPort);
    const mobileBoard = await checkMobileBoard(mobile, server.url, screenshotDir);
    console.log(JSON.stringify({
      interest_group_board_browser: "ok",
      homeInterestGroupEntry,
      desktop: desktopBoard,
      landowners,
      intelligentsia,
      englishIdeologyLabels,
      tradeUnions,
      descriptiveVariants,
      countryListOrder,
      laterFlavors,
      scrollChrome,
      mobile: mobileBoard,
      screenshots: screenshotDir,
    }, null, 2));
    await desktop.close();
    await mobile.close();
  } finally {
    await browser.close();
  }
} finally {
  chrome.kill();
  await waitForChromeExit(chrome);
  await server.close();
  fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function browserCheckOptions(root) {
  const args = process.argv.slice(2);
  const siteIndex = args.indexOf("--site");
  const siteRoot = siteIndex >= 0
    ? path.resolve(args[siteIndex + 1] || "")
    : path.join(root, "site");
  assert.ok(siteIndex < 0 || args[siteIndex + 1], "--site requires a site directory");
  assert.ok(fs.existsSync(path.join(siteRoot, "index.html")), `site index was not found at ${siteRoot}`);
  return {
    siteRoot,
    englishIdeologyLabelsOnly: args.includes("--english-ideology-labels-only"),
    victorianCenturyFlavorsOnly: args.includes("--victorian-century-flavors-only"),
  };
}
}

async function checkHomeInterestGroupEntry(page, baseUrl) {
  await navigateAndWait(page, `${baseUrl}/index.html?lang=zh-Hans#/home`, () => (
    document.body.dataset.view === "home" && Boolean(document.querySelector('[data-home-view="interest-group"]'))
  ));
  const entry = await page.evaluate(`(() => {
    const interestGroup = document.querySelector('[data-home-view="interest-group"]');
    return {
      iconSource: interestGroup?.querySelector('img')?.getAttribute('src') || '',
      topbarBoardIcons: document.querySelectorAll('.topbar-nav-item img').length,
      topbarActionIcons: document.querySelectorAll('.topbar-actions img.lucide-icon').length,
    };
  })()`);
  assert.equal(entry.iconSource, 'assets/technologies/corporatism.webp', 'the home interest-group entry must use the corporatism technology icon');
  assert.equal(entry.topbarBoardIcons, 0, 'topbar board entries must not render icons');
  assert.ok(entry.topbarActionIcons > 0, 'topbar action icons must remain visible');
  return entry;
}

async function checkDesktopBoard(page, baseUrl) {
  await navigateAndWait(page, `${baseUrl}/index.html?lang=zh-Hans#/interest-group`, () => (
    document.body.dataset.view === "interest-group"
      && document.querySelectorAll("[data-interest-group-key]").length === 8
  ));
  const layout = await page.evaluate(`(() => {
    const grid = document.querySelector('.interest-group-board-grid');
    return {
      view: document.body.dataset.view,
      cards: document.querySelectorAll('[data-interest-group-key]').length,
      icons: document.querySelectorAll('.interest-group-board-card .interest-group-board-icon').length,
      iconSources: [...document.querySelectorAll('.interest-group-board-card .interest-group-board-icon')].map((icon) => icon.getAttribute('src') || ''),
      topbarBoardIcons: document.querySelectorAll('.topbar-nav-item img').length,
      columns: getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
      mapDisplay: getComputedStyle(document.querySelector('.map-panel')).display,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
      palette: Object.fromEntries([...document.querySelectorAll('[data-interest-group-key]')].map((card) => {
        const style = getComputedStyle(card);
        const description = card.querySelector('.interest-group-board-description');
        const textRange = document.createRange();
        const cardTop = card.getBoundingClientRect().top;
        textRange.selectNodeContents(description);
        return [card.dataset.interestGroupKey, {
          standard: style.getPropertyValue('--interest-group-color').trim().toUpperCase(),
          background: style.getPropertyValue('--interest-group-background').trim().toUpperCase(),
          text: style.getPropertyValue('--interest-group-text-color').trim().toUpperCase(),
          dividerOffset: Math.round((description.getBoundingClientRect().top - cardTop) * 10) / 10,
          firstLineOffset: Math.round(((textRange.getClientRects()[0]?.top || 0) - cardTop) * 10) / 10,
        }];
      })),
    };
  })()`);
  assert.equal(layout.view, "interest-group", "desktop route must render the interest-group board");
  assert.equal(layout.cards, 8, "desktop board must render eight cards");
  assert.equal(layout.icons, 8, "desktop cards must render eight icons");
  assert.ok(layout.iconSources.every((source) => source.startsWith('assets/interest-groups/') && source.endsWith('.webp')), "desktop cards must use WebP interest-group icons");
  assert.equal(layout.topbarBoardIcons, 0, "topbar board entries must not render icons");
  assert.equal(layout.columns, 4, "desktop board must have four columns");
  assert.equal(layout.mapDisplay, "none", "interest-group board must not display the map");
  assert.ok(layout.scrollWidth <= layout.viewportWidth + 1, "desktop board must not overflow horizontally");
  for (const [key, palette] of Object.entries(expectedPalette)) {
    assert.equal(layout.palette[key]?.standard, palette.standard, `${key} must use its recorded standard color`);
    assert.equal(layout.palette[key]?.background, palette.background, `${key} must use its recorded background color`);
    assert.equal(layout.palette[key]?.text, palette.text, `${key} must use its recorded text color`);
  }
  const dividerOffsets = Object.values(layout.palette).map((item) => item.dividerOffset);
  const firstLineOffsets = Object.values(layout.palette).map((item) => item.firstLineOffset);
  assert.ok(Math.max(...dividerOffsets) - Math.min(...dividerOffsets) <= 1, "interest-group description dividers must share one relative vertical position");
  assert.ok(Math.max(...firstLineOffsets) - Math.min(...firstLineOffsets) <= 1, "interest-group description first lines must share one relative vertical position");
  return layout;
}

async function checkTradeUnionDetail(page, baseUrl) {
  await navigateAndWait(page, `${baseUrl}/index.html?lang=zh-Hans#/interest-group/ig_trade_unions`, () => (
    document.body.dataset.view === "interest-group" && Boolean(document.querySelector(".interest-group-board-detail"))
  ));
  const detail = await page.evaluate(`(() => ({
    title: document.querySelector('.interest-group-detail-heading h2')?.textContent?.trim() || '',
    standardColorField: [...document.querySelectorAll('.interest-group-board-detail dt')].some((node) => node.textContent?.trim() === '\u6807\u51c6\u8272'),
    selectorOptions: [...document.querySelectorAll('[data-interest-group-flavor-select] option')].map((option) => ({ value: option.value, text: option.textContent?.trim() || '' })),
    duplicateVariants: document.querySelectorAll('.interest-group-variant-section, .interest-group-variant').length,
  }))()`);
  assert.ok(detail.title.includes('\u5de5\u4f1a'), 'trade-union detail must show its base name');
  assert.equal(detail.standardColorField, false, 'presentation colors must not be shown as standard-color data');
  assert.equal(detail.duplicateVariants, 0, 'flavors must only be represented by the selector');
  const franceFlavor = detail.selectorOptions.find((option) => option.text.includes('\u6cd5\u5170\u897f'));
  assert.ok(franceFlavor, `French trade-union trait flavor must be selectable: ${JSON.stringify(detail.selectorOptions)}`);
  const selected = await page.evaluate(`(() => {
    const selector = document.querySelector('[data-interest-group-flavor-select]');
    const target = [...selector.options].find((option) => option.textContent?.includes('\u6cd5\u5170\u897f'));
    selector.value = target.value;
    selector.dispatchEvent(new Event('change', { bubbles: true }));
    const active = document.querySelector('[data-interest-group-flavor-state]:not([hidden])');
    return {
      traits: [...active.querySelectorAll('.interest-group-trait-card')].map((card) => card.dataset.conceptKey || ''),
      countryLists: active.querySelectorAll('.interest-group-country-list').length,
      countryDisclosureControls: active.querySelectorAll('.interest-group-country-disclosure, .interest-group-country-list summary').length,
      hasRules: Boolean(active.querySelector('.interest-group-rule-details')),
    };
  })()`);
  assert.ok(selected.traits.includes('ig_trait_bourse_du_travail'), 'French selection must show the Bourse du Travail trait');
  assert.ok(!selected.traits.includes('ig_trait_solidarity'), 'French selection must replace generic solidarity');
  assert.equal(selected.countryLists, 1, 'French country tags must be shown directly');
  assert.equal(selected.countryDisclosureControls, 0, 'French country tags must not offer a disclosure control');
  assert.equal(selected.hasRules, true, 'French selection must include its matching rules');
  return { detail, selected };
}

async function checkSelectedFlavorDetail(page, baseUrl, key) {
  await navigateAndWait(page, `${baseUrl}/index.html?lang=zh-Hans#/interest-group/${key}`, () => (
    document.body.dataset.view === "interest-group" && Boolean(document.querySelector(".interest-group-board-detail"))
  ));
  const detail = await page.evaluate(`(() => ({
    selectorOptions: document.querySelectorAll('[data-interest-group-flavor-select] option').length,
    visibleStates: document.querySelectorAll('[data-interest-group-flavor-state]:not([hidden])').length,
    countryLists: document.querySelectorAll('.interest-group-country-list').length,
    countryDisclosureControls: document.querySelectorAll('.interest-group-country-disclosure, .interest-group-country-list summary').length,
    duplicateVariants: document.querySelectorAll('.interest-group-variant-section, .interest-group-variant').length,
  }))()`);
  assert.ok(detail.selectorOptions > 1, `${key} must offer selectable flavor entries`);
  assert.equal(detail.visibleStates, 1, `${key} must show one selected flavor state`);
  assert.ok(detail.countryLists > 0, `${key} country tags must be shown directly`);
  assert.equal(detail.countryDisclosureControls, 0, `${key} country tags must not have a disclosure control`);
  assert.equal(detail.duplicateVariants, 0, `${key} must not duplicate flavors below the selector`);
  return detail;
}

async function checkIntelligentsiaDetail(page, baseUrl) {
  await navigateAndWait(page, `${baseUrl}/index.html?lang=zh-Hans#/interest-group/ig_intelligentsia`, () => (
    document.body.dataset.view === "interest-group"
      && Boolean(document.querySelector(".interest-group-board-detail"))
  ));
  const before = await page.evaluate(`(() => ({
    title: document.querySelector('.interest-group-detail-heading h2')?.textContent?.trim() || '',
    arrowIcon: document.querySelector('.interest-group-board-detail .detail-back-button .lucide-icon')?.getAttribute('src') || '',
    softHeading: getComputedStyle(document.querySelector('.interest-group-detail-heading')).backgroundColor,
    descriptionInsideHeading: Boolean(document.querySelector('.interest-group-detail-heading .interest-group-detail-description')),
    flavorSelector: document.querySelector('[data-interest-group-flavor-select]')?.value || '',
    flavorOptions: document.querySelectorAll('[data-interest-group-flavor-select] option').length,
    slotSwitches: document.querySelectorAll('[data-interest-group-trait-choice]').length,
    slots: [...document.querySelectorAll('[data-interest-group-flavor-state]:not([hidden]) .interest-group-trait-slot')].map((slot) => ({
      tone: getComputedStyle(slot).getPropertyValue('--slot-tone').trim(),
      height: Math.round(slot.getBoundingClientRect().height),
      active: slot.querySelector('.interest-group-trait-card')?.dataset.conceptKey || '',
    })),
    populationEntries: document.querySelectorAll('.interest-group-pop-attraction-entry').length,
    populationDisclosure: document.querySelector('.interest-group-population-disclosure')?.open || false,
    populationList: document.querySelector('.interest-group-population-disclosure ul')?.tagName || '',
    literacy: [...document.querySelectorAll('.interest-group-pop-attraction')].some((node) => node.textContent?.includes('\u8bc6\u5b57\u7387')),
  }))()`);
  assert.ok(before.title.includes('\u77e5\u8bc6\u5206\u5b50'), 'intelligentsia detail must show its base name');
  assert.ok(before.title.includes('\uff08') && before.title.includes('\uff09'), 'intelligentsia detail heading must list flavor names');
  assert.ok(before.title.includes(' / '), 'intelligentsia flavor names must use slash separators');
  assert.equal(before.arrowIcon, 'assets/lucide/icons/arrow-left.svg', 'detail return control must use the icon-library left arrow');
  assert.ok(before.softHeading && before.softHeading !== 'rgb(19, 43, 45)', 'detail heading must use its softened card background');
  assert.equal(before.descriptionInsideHeading, true, 'the group description must be placed inside the title card');
  assert.deepEqual(before.slots.map((slot) => slot.tone), ['#7c3830', '#496d47', '#927338'], 'trait cards must retain red, green, and gold approval surfaces');
  assert.equal(new Set(before.slots.map((slot) => slot.height)).size, 1, 'the three trait cards must share one height');
  assert.equal(before.flavorSelector, 'base', 'the compact trait layout must start with the base flavor');
  assert.ok(before.flavorOptions > 1, 'intelligentsia must expose its flavors in one selector');
  assert.equal(before.slotSwitches, 0, 'individual trait slots must not duplicate flavor switches');
  assert.equal(before.populationDisclosure, false, 'population conditions must begin collapsed');
  assert.equal(before.populationList, 'UL', 'population conditions must be rendered as a list');
  assert.ok(before.populationEntries > 0 && before.literacy, 'intelligentsia detail must show population attraction and literacy conditions');
  const ideologyLayout = await page.evaluate(`(() => {
    const content = document.querySelector('[data-interest-group-flavor-state]:not([hidden]) .interest-group-selected-information');
    return {
      label: content?.querySelector('dt')?.textContent?.trim() || '',
      groupCount: content?.querySelectorAll('.tag-ideology').length || 0,
      characterCount: content?.querySelectorAll('.tag-tradition').length || 0,
      text: content?.textContent?.replace(/\s+/g, ' ').trim() || '',
      groupLabelCount: (content?.textContent?.match(/\u5229\u76ca\u96c6\u56e2\uff1a/g) || []).length,
      characterLabelCount: (content?.textContent?.match(/\u89d2\u8272\uff1a/g) || []).length,
    };
  })()`);
  assert.equal(ideologyLayout.label, '', 'the merged ideology section must not repeat a field heading');
  assert.ok(ideologyLayout.groupCount > 0, 'the merged ideology section must keep interest-group ideologies');
  assert.ok(ideologyLayout.characterCount > 0, 'the merged ideology section must keep character ideologies');
  assert.equal(ideologyLayout.groupLabelCount, 1, 'the interest-group ideology label must appear once');
  assert.equal(ideologyLayout.characterLabelCount, 1, 'the character ideology label must appear once');

  const switchResult = await page.evaluate(`(() => {
    const selector = document.querySelector('[data-interest-group-flavor-select]');
    if (!selector) return null;
    const activeSlots = () => [...document.querySelectorAll('[data-interest-group-flavor-state]:not([hidden]) .interest-group-trait-slot')];
    const before = activeSlots().map((slot) => slot.querySelector('.interest-group-trait-card')?.dataset.conceptKey || '').join('|');
    const target = [...selector.options].find((option) => option.value !== 'base');
    if (!target) return null;
    selector.value = target.value;
    selector.dispatchEvent(new Event('change', { bubbles: true }));
    return {
      before,
      after: activeSlots().map((slot) => slot.querySelector('.interest-group-trait-card')?.dataset.conceptKey || '').join('|'),
      visibleStates: document.querySelectorAll('[data-interest-group-flavor-state]:not([hidden])').length,
      target: target.textContent?.trim() || '',
      source: document.querySelector('[data-interest-group-flavor-state]:not([hidden]) [data-interest-group-flavor-source]')?.textContent?.trim() || '',
    };
  })()`);
  assert.ok(switchResult?.target, 'the selector must permit switching to another flavor');
  assert.equal(switchResult.visibleStates, 1, 'switching flavors must retain one visible state');
  assert.notEqual(switchResult.after, switchResult.before, 'switching flavors must replace the displayed trait set');
  assert.ok(switchResult.source.includes(switchResult.target), 'the selected flavor summary must match the selector choice');
  return { before, ideologyLayout, switchResult };
}

async function checkLaterAvailableFlavors(page, baseUrl) {
  const cases = [
    { key: 'ig_armed_forces', flavor: '\u7ea2\u519b' },
  ];
  const results = [];
  for (const item of cases) {
    await navigateAndWait(page, `${baseUrl}/index.html?lang=zh-Hans#/interest-group/${item.key}`, () => (
      document.body.dataset.view === 'interest-group' && Boolean(document.querySelector('.interest-group-board-detail'))
    ));
    const result = await page.evaluate(`(() => ({
      title: document.querySelector('.interest-group-detail-heading h2')?.textContent?.trim() || '',
      laterFlavor: [...document.querySelectorAll('[data-interest-group-flavor-select] option')].some((option) => (
        option.textContent?.trim() === ${JSON.stringify(item.flavor)}
      )),
    }))()`);
    assert.ok(result.title.includes(item.flavor), `${item.flavor} must be listed in the detail heading`);
    assert.equal(result.laterFlavor, true, `${item.flavor} must be shown as a flavor available after the opening setup`);
    results.push({ ...item, ...result });
  }
  return results;
}

async function checkNamedCountryVariants(page, baseUrl) {
  const cases = [
    { key: 'ig_armed_forces', expected: '\u519b\u961f\uff08\u62c9\u7f8e\u897f\u8bed\uff09' },
    { key: 'ig_industrialists', expected: '\u5b9e\u4e1a\u5bb6\uff08\u4e2d\u56fd\uff09' },
    { key: 'ig_intelligentsia', expected: '\u77e5\u8bc6\u5206\u5b50\uff08\u7acb\u5baa\u6d3e\uff09' },
    { key: 'ig_intelligentsia', expected: '\u77e5\u8bc6\u5206\u5b50\uff08\u5fb7\u610f\u5fd7\uff0f\u7acb\u5baa\u6d3e\uff09' },
    { key: 'ig_landowners', expected: '\u5730\u4e3b\uff08\u6c49\u6587\u5316\uff09' },
    { key: 'ig_petty_bourgeoisie', expected: '\u5c0f\u5e02\u6c11\uff08\u5357\u4e9a\uff09' },
    { key: 'ig_rural_folk', expected: '\u4e61\u6751\u6c11\u4f17\uff08\u4f4e\u5730\uff09' },
    { key: 'ig_trade_unions', expected: '\u5de5\u4f1a\uff08\u5fb7\u610f\u5fd7\uff09' },
  ];
  const results = [];
  for (const item of cases) {
    await navigateAndWait(page, `${baseUrl}/index.html?lang=zh-Hans#/interest-group/${item.key}`, () => (
      document.body.dataset.view === 'interest-group'
        && Boolean(document.querySelector('[data-interest-group-flavor-select]'))
    ));
    const options = await page.evaluate(`(() => [...document.querySelectorAll('[data-interest-group-flavor-select] option')].map((option) => option.textContent?.trim() || ''))()`);
    assert.ok(options.includes(item.expected), `${item.expected} must replace its temporary country name: ${JSON.stringify(options)}`);
    assert.equal(options.filter((option) => option === item.expected).length, 1, `${item.expected} must have one selector option: ${JSON.stringify(options)}`);
    results.push(item);
  }
  return results;
}

async function checkSingleCountryTraitVariantNames(page, baseUrl) {
  const cases = [
    { language: 'zh-Hans', key: 'ig_petty_bourgeoisie', expected: '\u5c0f\u5e02\u6c11\uff08\u57c3\u53ca\uff09' },
    { language: 'en', key: 'ig_petty_bourgeoisie', expected: 'Petite Bourgeoisie (Egypt)' },
  ];
  const results = [];
  for (const item of cases) {
    await navigateAndWait(page, `${baseUrl}/index.html?lang=${item.language}#/interest-group/${item.key}`, () => (
      document.body.dataset.view === 'interest-group'
        && Boolean(document.querySelector('[data-interest-group-flavor-select]'))
    ));
    const options = await page.evaluate(`(() => [...document.querySelectorAll('[data-interest-group-flavor-select] option')].map((option) => option.textContent?.trim() || ''))()`);
    assert.ok(options.includes(item.expected), `${item.expected} must replace the temporary single-country flavor name: ${JSON.stringify(options)}`);
    assert.equal(options.filter((option) => option === item.expected).length, 1, `${item.expected} must have one selector option: ${JSON.stringify(options)}`);
    results.push(item);
  }
  return results;
}

async function checkEnglishIdeologyLabels(page, baseUrl) {
  await navigateAndWait(page, `${baseUrl}/index.html?lang=en#/interest-group/ig_intelligentsia`, () => (
    document.documentElement.lang === 'en'
      && document.body.dataset.view === 'interest-group'
      && Boolean(document.querySelector('.interest-group-board-detail'))
  ));
  const labels = await page.evaluate(`(() => {
    const content = document.querySelector('[data-interest-group-flavor-state]:not([hidden]) .interest-group-selected-information');
    const text = content?.textContent?.replace(/\s+/g, ' ').trim() || '';
    return {
      text,
      groupLabelCount: content?.querySelectorAll('.ideology-pill-group-label').length
        ? [...content.querySelectorAll('.ideology-pill-group-label')].filter((label) => label.textContent?.trim() === 'Interest Group:').length
        : 0,
      characterLabelCount: content?.querySelectorAll('.ideology-pill-group-label').length
        ? [...content.querySelectorAll('.ideology-pill-group-label')].filter((label) => label.textContent?.trim() === 'Character:').length
        : 0,
    };
  })()`);
  assert.equal(labels.groupLabelCount, 1, `English interest-group ideology label must appear once: ${JSON.stringify(labels)}`);
  assert.equal(labels.characterLabelCount, 1, `English character ideology label must appear once: ${JSON.stringify(labels)}`);
  return labels;
}

async function checkVictorianCenturyFlavorGroups(page, baseUrl) {
  await navigateAndWait(page, `${baseUrl}/index.html?lang=zh-Hans#/interest-group/ig_armed_forces`, () => (
    document.body.dataset.view === 'interest-group'
      && Boolean(document.querySelector('[data-interest-group-flavor-select]'))
  ));
  const armedForces = await page.evaluate(`(() => {
    const selector = document.querySelector('[data-interest-group-flavor-select]');
    return {
      baseFlavor: [...selector.children].find((node) => node.tagName === 'OPTION')?.textContent?.trim() || '',
      groups: [...selector.querySelectorAll('optgroup')].map((group) => ({
        label: group.label,
        options: [...group.querySelectorAll('option')].map((option) => option.textContent?.trim() || ''),
      })),
    };
  })()`);
  assert.equal(armedForces.baseFlavor, '\u57fa\u7840', `VC armed forces must begin with the base flavor: ${JSON.stringify(armedForces)}`);
  assert.deepEqual(armedForces.groups.map((group) => group.label), [
    '\u98ce\u5473\u540d\u79f0', '\u6761\u4ef6\u53d8\u4f53', '\u56fd\u5bb6\u98ce\u5473',
  ], `VC flavor groups must follow base, flavored names, condition variants, then country flavors: ${JSON.stringify(armedForces)}`);
  const named = armedForces.groups.find((group) => group.label === '\u98ce\u5473\u540d\u79f0');
  assert.ok(named?.options.includes('\u7ea2\u519b'), `VC flavored names must include the Red Army: ${JSON.stringify(armedForces)}`);
  assert.ok(named?.options.includes('\u56fd\u6c11\u81ea\u536b\u519b'), `VC flavored names must include the National Guard: ${JSON.stringify(armedForces)}`);

  await navigateAndWait(page, `${baseUrl}/index.html?lang=zh-Hans#/interest-group/ig_landowners`, () => (
    document.body.dataset.view === 'interest-group'
      && Boolean(document.querySelector('[data-interest-group-flavor-select]'))
  ));
  const landowners = await page.evaluate(`(() => ([...document.querySelectorAll('[data-interest-group-flavor-select] optgroup')].map((group) => ({
    label: group.label,
    options: [...group.querySelectorAll('option')].map((option) => option.textContent?.trim() || ''),
  }))))()`);
  const landownerNamed = landowners.find((group) => group.label === '\u98ce\u5473\u540d\u79f0');
  assert.ok(landownerNamed?.options.includes('\u5965\u5730\u5229\u8d35\u65cf'), `VC flavored names must include Austrian Aristocracy: ${JSON.stringify(landowners)}`);
  assert.ok(landownerNamed?.options.includes('\u9ec4\u4fc4\u7f57\u65af\u653f\u5e9c'), `VC flavored names must include the Russia-China Government: ${JSON.stringify(landowners)}`);
  return { armedForces, landowners };
}

async function checkDescriptiveConditionVariants(page, baseUrl) {
  await navigateAndWait(page, `${baseUrl}/index.html?lang=zh-Hans#/interest-group/ig_armed_forces`, () => (
    document.body.dataset.view === 'interest-group' && Boolean(document.querySelector('.interest-group-board-detail'))
  ));
  const armedForces = await page.evaluate(`(() => {
    const selector = document.querySelector('[data-interest-group-flavor-select]');
    return {
    baseFlavor: [...selector.children].find((node) => node.tagName === 'OPTION')?.textContent?.trim() || '',
    groups: [...selector.querySelectorAll('optgroup')].map((group) => ({
      label: group.label,
      options: [...group.querySelectorAll('option')].map((option) => option.textContent?.trim() || ''),
    })),
    };
  })()`);
  assert.equal(armedForces.baseFlavor, '\u57fa\u7840', `armed forces must begin with the base flavor: ${JSON.stringify(armedForces)}`);
  assert.deepEqual(armedForces.groups.map((group) => group.label), [
    '\u98ce\u5473\u540d\u79f0', '\u6761\u4ef6\u53d8\u4f53', '\u56fd\u5bb6\u98ce\u5473',
  ], `flavor groups must follow base, flavored names, condition variants, then country flavors: ${JSON.stringify(armedForces)}`);
  const conditionGroup = armedForces.groups.find((group) => group.label === '\u6761\u4ef6\u53d8\u4f53');
  assert.deepEqual(conditionGroup?.options, [
    '\u519b\u961f\uff08\u62c9\u7f8e\u897f\u8bed\uff09',
    '\u519b\u961f\uff08\u666e\u62c9\u5854/\u5357\u5b89\u7b2c\u65af/\u5317\u5b89\u7b2c\u65af/\u4e2d\u7f8e/\u58a8\u897f\u54e5\uff09',
  ], 'armed-force condition variants must use the agreed descriptive names and order');

  await navigateAndWait(page, `${baseUrl}/index.html?lang=zh-Hans#/interest-group/ig_devout`, () => (
    document.body.dataset.view === 'interest-group' && Boolean(document.querySelector('.interest-group-board-detail'))
  ));
  const devout = await page.evaluate(`(() => ([...document.querySelectorAll('[data-interest-group-flavor-select] optgroup')].map((group) => ({
    label: group.label,
    options: [...group.querySelectorAll('option')].map((option) => option.textContent?.trim() || ''),
  }))))()`);
  const labels = devout.map((group) => group.label);
  const expectedReligionOrder = [
    '\u4e1c\u65b9\u6b63\u7edf\u6559\u4f1a', '\u4e1c\u6b63\u6559', '\u5929\u4e3b\u6559', '\u65b0\u6559', '\u900a\u5c3c\u6d3e', '\u4ec0\u53f6\u6d3e', '\u4f0a\u5df4\u5fb7\u6d3e',
    '\u72b9\u592a\u6559', '\u4f5b\u6559', '\u5370\u5ea6\u6559', '\u5112\u6559', '\u795e\u9053\u6559', '\u6cdb\u7075\u8bba', '\u9521\u514b\u6559',
  ];
  let cursor = -1;
  for (const label of expectedReligionOrder) {
    const index = labels.indexOf(label);
    if (index < 0) continue;
    assert.ok(index > cursor, `devout religion group ${label} must retain the requested ordering`);
    cursor = index;
  }
  assert.ok(devout.find((group) => group.label === '\u72b9\u592a\u6559')?.options.includes('\u72b9\u592a\u6559'), 'Jewish traits must be grouped by religion');
  assert.ok(devout.find((group) => group.label === '\u6cdb\u7075\u8bba')?.options.includes('\u6cdb\u7075\u8bba'), 'Animist traits must be grouped by religion');
  assert.ok(devout.find((group) => group.label === '\u9521\u514b\u6559')?.options.length, 'Sikh flavors must remain distinct from Animism');
  return { armedForces, devout };
}

async function checkCountryListOrder(page, baseUrl) {
  await navigateAndWait(page, `${baseUrl}/index.html?lang=zh-Hans#/interest-group/ig_devout`, () => (
    document.body.dataset.view === 'interest-group' && Boolean(document.querySelector('[data-interest-group-flavor-select]'))
  ));
  const countryLists = await page.evaluate(`(() => {
    const selector = document.querySelector('[data-interest-group-flavor-select]');
    const selectCountries = (name) => {
      const target = [...selector.options].find((option) => option.textContent?.trim() === name);
      selector.value = target.value;
      selector.dispatchEvent(new Event('change', { bubbles: true }));
      const active = document.querySelector('[data-interest-group-flavor-state]:not([hidden])');
      return {
        countries: [...active.querySelectorAll('.interest-group-country-tags [data-concept-key]')].map((node) => node.dataset.conceptKey || ''),
        hasCountryList: Boolean(active.querySelector('.interest-group-country-list')),
        disclosureControls: active.querySelectorAll('.interest-group-country-disclosure, .interest-group-country-list summary').length,
      };
    };
    return {
      hinduPriesthood: selectCountries('\u5370\u5ea6\u6559\u4e0a\u5e08'),
      churchOfNorway: selectCountries('\u632a\u5a01\u6559\u4f1a'),
      churchOfSweden: selectCountries('\u745e\u5178\u6559\u4f1a'),
    };
  })()`);
  assert.equal(countryLists.hinduPriesthood.hasCountryList, true, 'country lists must be shown before a flavor is selected');
  assert.equal(countryLists.hinduPriesthood.disclosureControls, 0, 'country lists must not be collapsible');
  assert.ok(countryLists.hinduPriesthood.countries.indexOf('HND') < countryLists.hinduPriesthood.countries.indexOf('IND'), 'India must appear before Indore and the other princely states');
  assert.deepEqual(countryLists.churchOfNorway.countries, ['NOR', 'JAN'], 'Norway must appear before the lower-tier Jan Mayen');
  assert.deepEqual(countryLists.churchOfSweden.countries, ['SWE', 'SCN'], 'Sweden must appear before the lower-tier Scania');
  return countryLists;
}

async function checkScrollChrome(page, baseUrl) {
  await navigateAndWait(page, `${baseUrl}/index.html?lang=zh-Hans#/interest-group/ig_intelligentsia`, () => (
    document.body.dataset.view === 'interest-group' && Boolean(document.querySelector('.interest-group-board-detail'))
  ));
  const before = await page.evaluate(`(() => {
    const button = document.querySelector('#backToTopButton');
    return { sticky: getComputedStyle(document.querySelector('.topbar')).position, hidden: button.hidden };
  })()`);
  assert.equal(before.sticky, 'sticky', 'the top bar must use sticky positioning');
  assert.equal(before.hidden, true, 'back-to-top control must be hidden at the top');
  await page.evaluate(`document.querySelector('.interest-group-board-detail').style.minHeight = '2000px'; window.scrollTo(0, 700)`);
  await waitFor(async () => await page.evaluate(`window.scrollY >= 160 && !document.querySelector('#backToTopButton').hidden`), 'back-to-top button to become visible');
  const afterScroll = await page.evaluate(`(() => ({
    headerTop: Math.round(document.querySelector('.topbar').getBoundingClientRect().top),
    hidden: document.querySelector('#backToTopButton').hidden,
  }))()`);
  assert.equal(afterScroll.headerTop, 0, 'the top bar must remain at the viewport edge while scrolling');
  assert.equal(afterScroll.hidden, false, 'back-to-top control must appear after scrolling');
  await page.evaluate(`document.querySelector('#backToTopButton').click()`);
  await waitFor(async () => await page.evaluate(`window.scrollY < 3`), 'back-to-top action');
  return { before, afterScroll };
}

async function checkMobileBoard(page, baseUrl, screenshotDir) {
  await navigateAndWait(page, `${baseUrl}/index.html?lang=zh-Hans#/interest-group`, () => (
    document.body.dataset.view === "interest-group"
      && document.querySelectorAll("[data-interest-group-key]").length === 8
  ));
  const layout = await page.evaluate(`(() => {
    const grid = document.querySelector('.interest-group-board-grid');
    return {
      view: document.body.dataset.view,
      viewportWidth: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      cards: document.querySelectorAll('[data-interest-group-key]').length,
      columns: getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
      gridWidth: grid.getBoundingClientRect().width,
      firstCardWidth: document.querySelector('.interest-group-board-card')?.getBoundingClientRect().width || 0,
      descriptionMetrics: [...document.querySelectorAll('.interest-group-board-description')].map((node) => ({
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight,
      })),
    };
  })()`);
  const screenshot = await page.screenshot();
  fs.writeFileSync(path.join(screenshotDir, "interest-group-mobile.png"), Buffer.from(screenshot, "base64"));
  assert.equal(layout.view, "interest-group", "mobile route must render the interest-group board");
  assert.equal(layout.viewportWidth, 390, "mobile verification must use a 390px viewport");
  assert.equal(layout.cards, 8, "mobile board must render eight cards");
  assert.equal(layout.columns, 2, "mobile board must have two columns");
  assert.ok(layout.scrollWidth <= layout.viewportWidth + 1, "mobile board must not overflow horizontally");
  assert.ok(layout.descriptionMetrics.every((item) => item.scrollHeight <= item.clientHeight + 1), "mobile interest-group descriptions must not be clipped");
  return layout;
}

async function openPage(browser, viewport, debugPort) {
  const created = await browser.send("Target.createTarget", { url: "about:blank" });
  const targets = await waitFor(async () => {
    const items = await requestJson(`http://127.0.0.1:${debugPort}/json/list`);
    return items.find((item) => item.id === created.targetId);
  }, "page target");
  const page = await CdpClient.connect(targets.webSocketDebuggerUrl);
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  return page;
}

async function navigateAndWait(page, url, condition) {
  await page.send("Page.navigate", { url });
  await waitFor(async () => {
    const result = await page.evaluate(`(${condition.toString()})()`);
    return result === true;
  }, `page route ${url}`);
}

async function freePort() {
  const listener = http.createServer();
  await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
  const { port } = listener.address();
  await new Promise((resolve) => listener.close(resolve));
  return port;
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
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

async function requestJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        if ((response.statusCode || 500) >= 400) {
          reject(new Error(`${url} returned ${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

async function waitFor(check, label) {
  const deadline = Date.now() + 20000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ""}`);
}

async function waitForChromeExit(process) {
  if (process.exitCode !== null) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return;
  }
  await Promise.race([
    new Promise((resolve) => process.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
}

class CdpClient {
  static connect(url) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      const pending = new Map();
      let nextId = 1;
      socket.addEventListener("error", (event) => reject(event.error || new Error(`WebSocket failed for ${url}`)), { once: true });
      socket.addEventListener("open", () => {
        resolve({
          send(method, params = {}) {
            const id = nextId++;
            socket.send(JSON.stringify({ id, method, params }));
            return new Promise((resolveSend, rejectSend) => pending.set(id, { resolve: resolveSend, reject: rejectSend }));
          },
          async evaluate(expression) {
            const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
            if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
            return result.result?.value;
          },
          screenshot() {
            return this.send("Page.captureScreenshot", { format: "png" }).then((result) => result.data);
          },
          close() {
            for (const request of pending.values()) request.reject(new Error("CDP connection closed"));
            socket.close();
          },
        });
      }, { once: true });
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        const request = pending.get(message.id);
        if (!request) return;
        pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error.message));
        else request.resolve(message.result);
      });
    });
  }
}

await main();
