import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:4173/index.html";
const localizedBaseUrl = (locale) => `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}lang=${encodeURIComponent(locale)}`;
const zhBaseUrl = localizedBaseUrl("zh-Hans");
const enBaseUrl = localizedBaseUrl("en");
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9230;
const chrome = spawn(chromePath, [`--remote-debugging-port=${debugPort}`, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "about:blank"], { stdio: "ignore", windowsHide: true });

try {
  const page = await openPage({ width: 1440, height: 1000 });
  await page.goto(`${zhBaseUrl}#/building`);
  await page.waitFor(() => document.querySelectorAll("[data-building-key]").length === 101, "building wall");
  const buildingWall = await page.evaluate(() => ({
    cards: document.querySelectorAll("[data-building-key]").length,
    groups: document.querySelectorAll(".economy-group").length,
    groupKeys: Array.from(document.querySelectorAll("[data-board-group]"), (group) => group.dataset.boardGroup),
    groupNames: Array.from(document.querySelectorAll("[data-board-group] > h2"), (heading) => heading.childNodes[0]?.textContent?.trim()),
    agricultureClusters: Array.from(document.querySelectorAll("[data-board-group='agriculture'] [data-building-key]"), (card) => card.dataset.buildingKey),
    map: getComputedStyle(document.querySelector("#mapPanel")).display,
    filters: getComputedStyle(document.querySelector(".filters")).display,
    lazy: document.querySelector("[data-building-key] img")?.getAttribute("loading"),
  }));
  assert.equal(buildingWall.cards, 101, "building wall must show every icon-bearing building");
  assert.equal(buildingWall.groups, 7, "building wall must show the seven confirmed display groups");
  assert.deepEqual(buildingWall.groupKeys, ["agriculture", "resources", "industry", "military", "infrastructure", "ownership", "wonders"], "building wall must preserve the confirmed group order");
  assert.deepEqual(buildingWall.groupNames, ["农业", "资源", "工业", "军事", "基建", "所有权建筑", "奇观"], "building wall must expose only the seven group headings");
  assert.deepEqual(buildingWall.agricultureClusters, [
    "building_rye_farm", "building_rice_farm", "building_wheat_farm", "building_maize_farm", "building_millet_farm",
    "building_livestock_ranch", "building_vineyard",
    "building_tea_plantation", "building_coffee_plantation", "building_cotton_plantation", "building_dye_plantation", "building_silk_plantation", "building_sugar_plantation", "building_banana_plantation", "building_opium_plantation", "building_tobacco_plantation",
    "building_subsistence_rice_farm", "building_subsistence_orchard", "building_subsistence_farm", "building_subsistence_fishing_village", "building_subsistence_pasture",
  ], "agriculture must keep the confirmed cluster order without subgroup headings");
  assert.equal(buildingWall.map, "none", "building wall must hide the map");
  assert.equal(buildingWall.filters, "none", "building wall must hide filters");
  assert.equal(buildingWall.lazy, "lazy", "building cards must defer icon loading");

  await page.evaluate(() => document.querySelector("[data-building-key='building_oil_rig']").click());
  await page.waitFor(() => location.hash === "#/building/building_oil_rig", "oil rig route");
  const oilRig = await page.evaluate(() => ({
    strip: document.querySelectorAll(".production-method-group-strip [data-production-method-picker]").length,
    stripText: document.querySelector(".production-method-group-strip")?.textContent?.trim() || "",
    openPanels: document.querySelectorAll(".production-method-group-panel:not([hidden])").length,
    legacyDetails: document.querySelector(".selected-production-method-detail"),
    combinationLabels: Array.from(document.querySelectorAll("[data-production-summary] dt"), (label) => label.textContent.trim()),
    combinationText: document.querySelector("[data-production-summary]")?.textContent || "",
    allCombinationList: document.querySelector(".production-combination-list"),
    resourceButton: Boolean(document.querySelector("[data-resource-map-building='building_oil_rig']")),
  }));
  assert.equal(oilRig.strip, 2, "oil rig must show one current icon for each production-method group");
  assert.equal(oilRig.stripText, "", "top production-method strip must contain icons only");
  assert.equal(oilRig.openPanels, 0, "production-method groups must start collapsed");
  assert.equal(oilRig.legacyDetails, null, "legacy production-method accordion must not be rendered");
  assert.deepEqual(oilRig.combinationLabels, ["劳动力：", "投入商品：", "产出商品：", "标准产值：", "修正："], "current combination must expose the five requested level-one result categories");
  assert.match(oilRig.combinationText, /劳动力：500店主，3000劳工，1000技工，500工程师/, "level-one employment must use concise population counts");
  assert.match(oilRig.combinationText, /投入商品：5发动机，10煤/, "level-one inputs must use concise goods counts");
  assert.match(oilRig.combinationText, /产出商品：60油/, "level-one outputs must use concise goods counts");
  assert.equal(await page.evaluate(() => document.querySelector("[data-production-standard-output]")?.textContent?.trim()), "£18.72/人/年", "standard output must use base prices and 52-week annual profit per worker");
  assert.equal(oilRig.allCombinationList, null, "building detail must not render a full combination list");
  assert.equal(oilRig.resourceButton, true, "oil rig must offer the resource map route");
  assert.doesNotMatch(oilRig.combinationText, /（按劳动力）/, "current combination must omit the redundant workforce-scaling suffix");
  const initialCombinationText = oilRig.combinationText;
  await page.evaluate(() => document.querySelector("[data-production-method-picker='pmg_base_building_oil_rig']").click());
  await page.waitFor(() => document.querySelectorAll(".production-method-group-panel:not([hidden])").length === 1, "base drilling panel");
  const basePanel = await page.evaluate(() => ({
    title: document.querySelector(".production-method-group-panel:not([hidden]) > h4")?.textContent?.trim() || "",
    rows: document.querySelectorAll(".production-method-group-panel:not([hidden]) [data-production-method-group='pmg_base_building_oil_rig']").length,
    otherGroups: document.querySelectorAll(".production-method-group-panel:not([hidden]) [data-production-method-group]:not([data-production-method-group='pmg_base_building_oil_rig'])").length,
    goodsRows: document.querySelectorAll(".production-method-group-panel:not([hidden]) .production-method-goods-row").length,
    workforceRows: document.querySelectorAll(".production-method-group-panel:not([hidden]) .production-method-workforce-row").length,
    goodsIcons: Array.from(document.querySelectorAll(".production-method-group-panel:not([hidden]) .production-method-goods-row img"), (icon) => icon.getAttribute("src") || ""),
    workforceIcons: Array.from(document.querySelectorAll(".production-method-group-panel:not([hidden]) .production-method-workforce-row img"), (icon) => icon.getAttribute("src") || ""),
    goodsText: document.querySelector(".production-method-group-panel:not([hidden]) .production-method-goods-row")?.textContent || "",
    extraText: document.querySelector(".production-method-group-panel:not([hidden]) .production-method-extra-row")?.textContent || "",
    rowOrder: (() => {
      const row = document.querySelector(".production-method-group-panel:not([hidden]) .production-method-row");
      if (!row) return [];
      return [".production-method-goods-row", ".production-method-workforce-row", ".production-method-extra-row"]
        .map((selector) => row.querySelector(selector)?.getBoundingClientRect().top ?? -1);
    })(),
  }));
  assert(basePanel.title, "opened group must show its group name");
  assert.equal(basePanel.rows, 2, "opened group must list all methods from the selected group");
  assert.equal(basePanel.otherGroups, 0, "opened group must not mix options from another group");
  assert.equal(basePanel.goodsRows, basePanel.rows, "each listed method must have a goods row");
  assert.equal(basePanel.workforceRows, basePanel.rows, "each listed method must have a workforce row");
  assert(basePanel.goodsIcons.every((src) => src.startsWith("assets/goods/")), "goods rows must use goods icons");
  assert(basePanel.workforceIcons.every((src) => src.startsWith("assets/pops/")), "workforce rows must use pop icons");
  assert.match(basePanel.goodsText, /[−+]/, "goods rows must distinguish inputs and outputs with signs");
  assert.doesNotMatch(basePanel.extraText, /（按劳动力）/, "method rows must omit the redundant workforce-scaling suffix");
  assert(basePanel.rowOrder[0] <= basePanel.rowOrder[1] && (basePanel.rowOrder[2] < 0 || basePanel.rowOrder[1] <= basePanel.rowOrder[2]), "goods, workforce, and extra information must stay in vertical order");
  await page.evaluate(() => document.querySelector("[data-production-method-group='pmg_base_building_oil_rig'][data-production-method-key='pm_combustion_derricks']").click());
  await page.waitFor(() => document.querySelector("[data-production-method-picker='pmg_base_building_oil_rig']")?.dataset.productionMethodKey === "pm_combustion_derricks", "changed oil rig method");
  assert.equal(await page.evaluate(() => document.querySelectorAll(".production-method-group-panel:not([hidden])").length), 1, "selected group must remain open after choosing a method");
  assert.notEqual(await page.evaluate(() => document.querySelector("[data-production-summary]")?.textContent || ""), initialCombinationText, "current combination must recalculate after a production-method selection changes");
  assert.equal(await page.evaluate(() => document.querySelector(".production-method-row.is-selected .production-method-extra-row")?.textContent?.includes("内燃机")), true, "selected method row must show its prerequisite technology");

  await page.goto(`${zhBaseUrl}#/building/building_rye_farm`);
  await page.waitFor(() => location.hash === "#/building/building_rye_farm", "rye farm route");
  const ryeFarm = await page.evaluate(() => ({
    summary: document.querySelector("[data-production-summary]")?.textContent || "",
    standardOutput: document.querySelector("[data-production-standard-output]")?.textContent?.trim() || "",
  }));
  assert.match(ryeFarm.summary, /劳动力：4000劳工，1000农民/, "rye farm must display level-one employment without modifier internals");
  assert.match(ryeFarm.summary, /投入商品：无/, "rye farm must display an empty level-one input list");
  assert.match(ryeFarm.summary, /产出商品：20谷物/, "rye farm must display level-one grain output");
  assert.equal(ryeFarm.standardOutput, "£4.16/人/年", "rye farm standard output must match the reference workbook");
  await page.evaluate(() => document.querySelector("[data-production-method-picker='pmg_harvesting_process_building_rye_farm']").click());
  await page.waitFor(() => document.querySelector(".production-method-group-panel:not([hidden]) [data-production-method-key='pm_tools']"), "rye farm harvesting alternatives");
  await page.evaluate(() => document.querySelector("[data-production-method-key='pm_tools']").click());
  await page.waitFor(() => document.querySelector("[data-production-method-picker='pmg_harvesting_process_building_rye_farm']")?.dataset.productionMethodKey === "pm_tools", "selected harvesting tools");
  const automatedRyeFarm = await page.evaluate(() => ({
    summary: document.querySelector("[data-production-summary]")?.textContent || "",
    standardOutput: document.querySelector("[data-production-standard-output]")?.textContent?.trim() || "",
  }));
  assert.match(automatedRyeFarm.summary, /劳动力：3000劳工，1000农民/, "automation must reduce level-one employment before display");
  assert.match(automatedRyeFarm.summary, /投入商品：2工具/, "automation must add level-one tool inputs");
  assert.equal(automatedRyeFarm.standardOutput, "£4.16/人/年", "automation must recalculate annual profit with its reduced workforce");

  await page.evaluate(() => document.querySelector("[data-production-method-picker='pmg_secondary_building_rye_farm']").click());
  await page.waitFor(() => document.querySelector(".production-method-group-panel:not([hidden]) [data-production-method-key='pm_apple_orchards']"), "rye farm secondary methods");
  const appleOrchards = await page.evaluate(() => {
    const row = document.querySelector(".production-method-group-panel:not([hidden]) [data-production-method-key='pm_apple_orchards']")?.closest(".production-method-row");
    return Array.from(row?.querySelectorAll(".production-method-good") || [], (token) => ({
      label: token.getAttribute("aria-label") || "",
      classes: token.className,
    }));
  });
  assert(appleOrchards.some((item) => item.label === "−8 谷物" && item.classes.includes("production-method-good--negative")), "apple orchards must show reduced grain as a negative goods change");
  assert(appleOrchards.some((item) => item.label === "+7 水果" && item.classes.includes("production-method-good--positive")), "apple orchards must show increased fruit as a positive goods change");

  await page.goto(`${zhBaseUrl}#/building/building_textile_mill`);
  await page.waitFor(() => location.hash === "#/building/building_textile_mill", "textile mill route");
  await page.evaluate(() => document.querySelector("[data-production-method-picker='pmg_luxury_building_textile_mill']").click());
  await page.waitFor(() => document.querySelector(".production-method-group-panel:not([hidden]) [data-production-method-key='pm_craftsman_sewing']"), "textile luxury methods");
  const craftsmanSewing = await page.evaluate(() => {
    const row = document.querySelector(".production-method-group-panel:not([hidden]) [data-production-method-key='pm_craftsman_sewing']")?.closest(".production-method-row");
    return Array.from(row?.querySelectorAll(".production-method-good") || [], (token) => ({
      label: token.getAttribute("aria-label") || "",
      classes: token.className,
    }));
  });
  assert(craftsmanSewing.some((item) => item.label === "+15 织物" && item.classes.includes("production-method-good--positive")), "craftsman sewing must show reduced fabric consumption as a positive goods change");
  assert(craftsmanSewing.some((item) => item.label === "−30 衣物" && item.classes.includes("production-method-good--negative")), "craftsman sewing must show reduced clothes output as a negative goods change");

  const productionGoodsAudit = await page.evaluate(() => {
    const failures = [];
    let effects = 0;
    let negativeInputs = 0;
    let negativeOutputs = 0;
    for (const method of productionMethods) {
      for (const effect of method.effects || []) {
        const input = /^goods_input_[a-z0-9_]+_add$/.test(effect.key);
        const output = /^goods_output_[a-z0-9_]+_add$/.test(effect.key);
        if (!input && !output) continue;
        effects += 1;
        if (input && Number(effect.value) < 0) negativeInputs += 1;
        if (output && Number(effect.value) < 0) negativeOutputs += 1;
        const direction = input ? "input" : "output";
        const template = document.createElement("template");
        template.innerHTML = productionMethodGoodTokenHtml(effect, direction);
        const token = template.content.firstElementChild;
        const netValue = (input ? -1 : 1) * Number(effect.value || 0);
        const expectedSign = netValue < 0 ? "−" : "+";
        const expectedClass = netValue < 0 ? "production-method-good--negative" : "production-method-good--positive";
        if (!token?.getAttribute("aria-label")?.startsWith(expectedSign) || !token?.classList.contains(expectedClass)) {
          failures.push(`${method.key}:${effect.key}:${effect.value}`);
        }
      }
    }
    return { failures, effects, negativeInputs, negativeOutputs };
  });
  assert.equal(productionGoodsAudit.failures.length, 0, `all production-method goods effects must use their net-change sign: ${productionGoodsAudit.failures.slice(0, 10).join(", ")}`);
  assert.equal(productionGoodsAudit.effects, 722, "base-game audit must cover every goods effect");
  assert.equal(productionGoodsAudit.negativeInputs, 8, "full base-game audit must cover all negative input effects");
  assert.equal(productionGoodsAudit.negativeOutputs, 21, "full base-game audit must cover all negative output effects");

  await page.goto(`${zhBaseUrl}#/building/building_subsistence_fishing_village`);
  await page.waitFor(() => location.hash === "#/building/building_subsistence_fishing_village", "subsistence fishing village route");
  await page.evaluate(() => document.querySelector("[data-production-method-picker='pmg_base_building_subsistence_fishing_village']").click());
  await page.waitFor(() => document.querySelector(".production-method-group-panel:not([hidden]) [data-production-method-key='default_building_subsistence_fishing_village']"), "subsistence fishing base method");
  const woodOutput = await page.evaluate(() => ({
    label: document.querySelector(".production-method-group-panel:not([hidden]) .production-method-good--output:has(img[src='assets/goods/wood.webp'])")?.getAttribute("aria-label") || "",
    icon: document.querySelector(".production-method-group-panel:not([hidden]) .production-method-good--output img[src='assets/goods/wood.webp']")?.getAttribute("src") || "",
  }));
  assert.equal(woodOutput.label, "+0.25 木材", "wood goods must use the Chinese goods name");
  assert.equal(woodOutput.icon, "assets/goods/wood.webp", "wood goods must use the wood icon");

  await page.goto(`${zhBaseUrl}#/building/building_company_headquarter`);
  await page.waitFor(() => location.hash === "#/building/building_company_headquarter", "company headquarters route");
  await page.evaluate(() => document.querySelector("[data-production-method-picker='pmg_ownership_building_company_headquarter']").click());
  await page.waitFor(() => document.querySelector(".production-method-group-panel:not([hidden]) [data-production-method-key='pm_company_headquarter_worker_cooperative']"), "company headquarters ownership methods");
  const ownershipConditions = await page.evaluate(() => Object.fromEntries([
    "pm_company_headquarter_privately_owned",
    "pm_company_headquarter_government_run",
    "pm_company_headquarter_worker_cooperative",
  ].map((key) => [key, document.querySelector(`.production-method-group-panel:not([hidden]) [data-production-method-key='${key}']`)?.closest(".production-method-row")?.querySelector(".production-method-extra-row")?.textContent || ""])));
  assert.match(ownershipConditions.pm_company_headquarter_privately_owned, /禁用法律：计划经济；合作社所有制/, "private ownership must present both laws as disallowing conditions");
  assert.match(ownershipConditions.pm_company_headquarter_government_run, /需要法律：计划经济/, "government run must present command economy as a requirement");
  assert.match(ownershipConditions.pm_company_headquarter_worker_cooperative, /需要法律：合作社所有制/, "worker cooperative must present cooperative ownership as a requirement");

  await page.goto(`${zhBaseUrl}#/building/building_oil_rig`);
  await page.waitFor(() => location.hash === "#/building/building_oil_rig", "oil rig route before resource map");
  await page.evaluate(() => document.querySelector("[data-resource-map-building='building_oil_rig']").click());
  await page.waitFor(() => location.hash === "#/region/resource/building_oil_rig", "resource map route");
  await page.waitFor(() => document.querySelector("[data-resource-filter='building_oil_rig'][aria-pressed='true']"), "selected oil rig resource filter");
  const resourceMap = await page.evaluate(() => ({
    selected: Array.from(document.querySelectorAll("[data-resource-filter][aria-pressed='true']"), (item) => item.dataset.resourceFilter),
    mode: document.documentElement.dataset.railSimulatorStatus || document.body.dataset.view,
  }));
  assert.equal(documentedResourceSelection(resourceMap.selected), "building_oil_rig", "resource route must select oil rig");

  await page.goto(`${zhBaseUrl}#/goods`);
  await page.waitFor(() => document.querySelectorAll("[data-good-key]").length === 53, "goods wall");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#mapPanel")).display), "none", "goods wall must hide the map");
  await page.evaluate(() => document.querySelector("[data-good-key='rubber']").click());
  await page.waitFor(() => location.hash === "#/goods/rubber", "rubber good route");
  await page.waitFor(() => {
    const results = document.querySelector(".results")?.getBoundingClientRect();
    const detail = document.querySelector(".detail")?.getBoundingClientRect();
    return Boolean(results && detail && results.right <= detail.left + 1);
  }, "settled desktop goods layout");
  const rubber = await page.evaluate(() => ({
    producers: Array.from(document.querySelectorAll("[data-good-building-relation='producer']"), (item) => item.dataset.goodBuilding),
    standardPrice: document.querySelector("[data-good-standard-price]")?.textContent?.trim() || "",
    resultsRight: document.querySelector(".results")?.getBoundingClientRect().right || 0,
    detailLeft: document.querySelector(".detail")?.getBoundingClientRect().left || 0,
    detailRight: document.querySelector(".detail")?.getBoundingClientRect().right || 0,
    factsWidth: document.querySelector(".goods-facts")?.getBoundingClientRect().width || 0,
    lastFactWidth: document.querySelector(".goods-facts > div:last-child")?.getBoundingClientRect().width || 0,
  }));
  assert(rubber.producers.includes("building_rubber_plantation"), "rubber must link to rubber plantation");
  assert.equal(rubber.standardPrice, "£40", "rubber must show its standard price");
  assert(rubber.resultsRight <= rubber.detailLeft + 1, "desktop goods wall must stop before the detail panel");
  assert(rubber.detailRight > 1300, "desktop goods detail must occupy the right side of the layout");
  assert(rubber.lastFactWidth >= rubber.factsWidth - 2, "an unpaired final goods fact must span the table width");

  await page.goto(`${zhBaseUrl}#/goods/grain`);
  await page.waitFor(() => location.hash === "#/goods/grain", "grain good route");
  const grain = await page.evaluate(() => ({
    needs: Array.from(document.querySelectorAll("[data-good-need]"), (item) => item.textContent || ""),
  }));
  assert(grain.needs.some((text) => text.includes("基础食品") && text.includes("1–29")), "grain must show basic food and its wealth range");

  await page.goto(`${zhBaseUrl}#/goods/meat`);
  await page.waitFor(() => location.hash === "#/goods/meat", "meat good route");
  const meat = await page.evaluate(() => ({
    tabooReligions: Array.from(document.querySelectorAll("[data-good-taboo-religion]"), (item) => item.textContent?.trim() || ""),
    prestigeCompanies: Array.from(document.querySelectorAll("[data-prestige-company]"), (item) => item.dataset.prestigeCompany),
  }));
  assert(meat.tabooReligions.includes("印度教"), "meat must show its Hindu taboo");
  assert(meat.prestigeCompanies.length > 0, "meat prestige variants must list possible companies");

  await page.goto(`${zhBaseUrl}#/goods/oil`);
  await page.waitFor(() => location.hash === "#/goods/oil", "oil good route");
  const oil = await page.evaluate(() => ({
    producers: Array.from(document.querySelectorAll("[data-good-building-relation='producer']"), (item) => item.dataset.goodBuilding),
    consumers: Array.from(document.querySelectorAll("[data-good-building-relation='consumer']"), (item) => item.dataset.goodBuilding),
    variants: document.querySelectorAll("[data-prestige-good]").length,
    methods: document.querySelectorAll("[data-production-method-key]").length,
  }));
  assert(oil.producers.includes("building_oil_rig"), "oil must link to oil rig");
  assert(oil.consumers.length > 0, "oil must list consuming buildings");
  assert.equal(oil.variants, 1, "oil must show its Baku prestige variant");
  assert.equal(oil.methods, 0, "goods details must not show production methods");

  await page.goto(`${enBaseUrl}#/building/building_rubber_plantation`);
  await page.waitFor(() => document.documentElement.lang === "en" && document.querySelector(".economy-detail"), "English rubber plantation detail");
  const englishBuilding = await page.evaluate(() => ({
    title: document.querySelector(".economy-detail h2")?.textContent?.trim() || "",
    methodHeading: document.querySelector(".production-method-section h3")?.textContent?.trim() || "",
    combinationLabels: Array.from(document.querySelectorAll("[data-production-summary] dt"), (label) => label.textContent.trim()),
    navLabel: document.querySelector("[data-nav-view='building']")?.textContent?.trim() || "",
    groupNames: Array.from(document.querySelectorAll("[data-board-group] > h2"), (heading) => heading.childNodes[0]?.textContent?.trim()),
    body: document.querySelector(".economy-detail")?.innerText || "",
  }));
  assert.equal(englishBuilding.title, "Rubber Plantations", "English building route must resolve the localized building name");
  assert.equal(englishBuilding.methodHeading, "Production Methods", "English building detail must localize its production-method heading");
  assert.deepEqual(englishBuilding.combinationLabels, ["Workforce:", "Input goods:", "Output goods:", "Standard output:", "Modifiers:"], "English building detail must localize the current-combination labels");
  assert.equal(englishBuilding.navLabel, "Buildings", "English navigation must label the building board");
  assert.deepEqual(englishBuilding.groupNames, ["Agriculture", "Resources", "Industrial", "Military", "Infrastructure", "Ownership Buildings", "Monuments"], "English building wall must localize the confirmed group names");
  assert.doesNotMatch(englishBuilding.body, /\$[^$]+\$|@[A-Za-z0-9_]+!|[\u3400-\u9fff]/, "English building detail contains unresolved localization");

  await page.goto(`${enBaseUrl}#/goods/rubber`);
  await page.waitFor(() => document.documentElement.lang === "en" && document.querySelector("[data-good-standard-price]"), "English rubber detail");
  const englishGood = await page.evaluate(() => ({
    title: document.querySelector(".economy-detail h2")?.textContent?.trim() || "",
    headings: Array.from(document.querySelectorAll(".economy-detail h3"), (heading) => heading.textContent.trim()),
    producer: document.querySelector("[data-good-building-relation='producer'] span")?.textContent?.trim() || "",
    navLabel: document.querySelector("[data-nav-view='goods']")?.textContent?.trim() || "",
    body: document.querySelector(".economy-detail")?.innerText || "",
  }));
  assert.equal(englishGood.title, "Rubber", "English goods route must resolve the localized goods name");
  assert(englishGood.headings.includes("Basic properties"), "English goods detail must localize basic properties");
  assert(englishGood.headings.includes("Producing buildings"), "English goods detail must localize producer relations");
  assert.equal(englishGood.producer, "Rubber Plantations", "English goods detail must localize related buildings");
  assert.equal(englishGood.navLabel, "Goods", "English navigation must label the goods board");
  assert.doesNotMatch(englishGood.body, /\$[^$]+\$|@[A-Za-z0-9_]+!|[\u3400-\u9fff]/, "English goods detail contains unresolved localization");

  const narrowPage = await openPage({ width: 390, height: 844 });
  await narrowPage.goto(`${zhBaseUrl}#/building/building_oil_rig`);
  await narrowPage.waitFor(() => location.hash === "#/building/building_oil_rig" && document.querySelector(".economy-detail"), "narrow oil rig detail");
  await narrowPage.evaluate(() => document.querySelector("[data-production-method-picker='pmg_base_building_oil_rig']").click());
  await narrowPage.waitFor(() => document.querySelector(".production-method-group-panel:not([hidden])"), "narrow oil rig method panel");
  const narrow = await narrowPage.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    detailRight: document.querySelector(".economy-detail")?.getBoundingClientRect().right || 0,
    panelRight: document.querySelector(".production-method-group-panel:not([hidden])")?.getBoundingClientRect().right || 0,
  }));
  assert(narrow.scrollWidth <= narrow.clientWidth, "production-method detail must not overflow the narrow viewport");
  assert(narrow.detailRight <= narrow.clientWidth, "production-method detail content must remain inside the narrow viewport");
  assert(narrow.panelRight <= narrow.clientWidth, "production-method panel must remain inside the narrow viewport");
  await narrowPage.close();
  await page.close();
  console.log(JSON.stringify({ economy_board_browser: "ok", base_url: baseUrl }, null, 2));
} finally {
  chrome.kill();
}

function documentedResourceSelection(keys) {
  return keys.length === 1 ? keys[0] : "";
}

async function openPage(viewport) {
  await waitForTargets();
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" })).json();
  const session = await connect(target.webSocketDebuggerUrl);
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
  return {
    goto: async (url) => {
      const loaded = session.next("Page.loadEventFired");
      const hashNavigated = session.next("Page.navigatedWithinDocument");
      await session.send("Page.navigate", { url });
      await Promise.race([loaded, hashNavigated]);
      await new Promise((resolve) => setTimeout(resolve, 150));
    },
    evaluate: async (expression, ...args) => {
      const serializedArgs = args.map((value) => JSON.stringify(value)).join(",");
      const value = await session.send("Runtime.evaluate", { expression: `(${expression})(${serializedArgs})`, returnByValue: true, awaitPromise: true });
      if (value.exceptionDetails) throw new Error(value.exceptionDetails.text || "browser evaluation failed");
      return value.result.value;
    },
    waitFor: async (predicate, description = "browser condition") => {
      const end = Date.now() + 25000;
      while (Date.now() < end) {
        if (await session.evaluate(predicate)) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(`${description} timed out`);
    },
    close: async () => session.close(),
  };
}

async function waitForTargets() {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    try { await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json(); return; } catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
  }
  throw new Error("Chrome debugging endpoint did not start");
}

async function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const events = new Map();
  let sequence = 0;
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) { const deferred = pending.get(message.id); pending.delete(message.id); deferred?.resolve(message); return; }
    const waiters = events.get(message.method) || [];
    events.delete(message.method);
    waiters.forEach((deferred) => deferred.resolve(message));
  });
  return {
    send(method, params = {}) {
      const id = ++sequence;
      const response = new Promise((resolve) => pending.set(id, { resolve }));
      socket.send(JSON.stringify({ id, method, params }));
      return response.then((message) => { if (message.error) throw new Error(message.error.message); return message.result || {}; });
    },
    next(method) { return new Promise((resolve) => events.set(method, [...(events.get(method) || []), { resolve }])); },
    async evaluate(predicate) {
      const result = await this.send("Runtime.evaluate", { expression: `Boolean((${predicate})())`, returnByValue: true, awaitPromise: true });
      return Boolean(result.result.value);
    },
    close() { socket.close(); },
  };
}
