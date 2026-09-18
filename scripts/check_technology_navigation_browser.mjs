import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const baseUrl = process.argv[2] || "http://127.0.0.1:8876/index.html";
const chromePath = process.env.VC_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9246;
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
    await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/technology`);
    await page.waitFor(() => document.body.dataset.view === "technology" && document.querySelectorAll("[data-technology-mode]").length === 6, "technology home");
    const home = await page.evaluate(() => ({
      modes: [...document.querySelectorAll("[data-technology-mode]")].map((node) => node.dataset.technologyMode),
      categories: [...document.querySelectorAll("[data-technology-category]")].map((node) => node.dataset.technologyCategory),
    }));
    assert.deepEqual(home.modes.sort(), ["list", "list", "list", "tree", "tree", "tree"]);
    assert.deepEqual(home.categories.sort(), ["military", "production", "society"]);

    await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/technology/list/military`);
    await page.waitFor(() => document.querySelectorAll(".technology-list-card").length === 58, "military technology list");
    const list = await page.evaluate(() => ({
      mode: document.querySelector(".technology-list-board") ? "list" : "",
      cards: document.querySelectorAll(".technology-list-card").length,
      effects: document.querySelectorAll(".technology-effect-chip").length,
      switchHref: document.querySelector(".technology-board-switch")?.getAttribute("href") || "",
      toolbarGroups: document.querySelectorAll(".technology-list-toolbar-group").length,
      toolbarInputWidth: Math.round(document.querySelector("[data-technology-search]")?.getBoundingClientRect().width || 0),
      categorySwitcher: document.querySelectorAll(".technology-floating-controls .technology-category-switcher").length,
      categoryButtons: document.querySelectorAll(".technology-category-switcher [data-technology-category]").length,
      backIcon: document.querySelector(".technology-board-back .technology-control-icon")?.getAttribute("src") || "",
      backText: document.querySelector(".technology-board-back")?.textContent.trim() || "",
      controlColor: getComputedStyle(document.querySelector(".technology-icon-button")).color,
      categoryActiveColor: getComputedStyle(document.querySelector(".technology-category-tab.is-active")).color,
      iconFilter: getComputedStyle(document.querySelector(".technology-control-icon")).filter,
      floatingPosition: getComputedStyle(document.querySelector(".technology-floating-controls")).position,
      listToolbarBorder: getComputedStyle(document.querySelector(".technology-list-toolbar")).borderBottomWidth,
      researchKinds: [...document.querySelectorAll(".technology-research-kind")].map((node) => node.textContent.trim()),
    }));
    assert.equal(list.mode, "list");
    assert.equal(list.cards, 58);
    assert.ok(list.effects >= list.cards, "technology list must expose at least one effect area per card");
    await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/technology/list/society`);
    await page.waitForSelector('[data-technology-key="anarchism"] .technology-party-icon');
    const partyUnlock = await page.evaluate(() => ({
      iconCount: document.querySelectorAll('[data-technology-key="anarchism"] .technology-party-icon').length,
      title: document.querySelector('[data-technology-key="anarchism"] .technology-party-icon')?.getAttribute("title") || "",
    }));
    assert.ok(partyUnlock.iconCount > 0, "technology list should show party unlock icons");
    assert.equal(partyUnlock.title, "无政府主义社团", "party unlock icons should use the standard localized party name");
    await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/technology/anarchism?from=list`);
    await page.waitFor(() => document.querySelector(".technology-detail")?.textContent.includes("解锁政党"), "party unlock detail references");
    const partyDetail = await page.evaluate(() => ({
      text: document.querySelector(".technology-detail")?.textContent || "",
      partyItems: [...document.querySelectorAll(".technology-related-group")].find((node) => node.textContent.includes("解锁政党"))?.querySelectorAll(".technology-related-item")?.length || 0,
      partyLinks: [...document.querySelectorAll(".technology-related-group")].find((node) => node.textContent.includes("解锁政党"))?.querySelectorAll("a")?.length || 0,
    }));
    assert.match(partyDetail.text, /无政府主义社团/);
    assert.equal(partyDetail.partyItems, 1, "technology detail should show the unlocked party");
    assert.equal(partyDetail.partyLinks, 0, "party detail entries should remain informational and non-clickable");
    await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/technology/list/military`);
    await page.waitFor(() => document.querySelectorAll(".technology-list-card").length === 58, "military technology list after party check");
    assert.equal(list.switchHref, "#/technology/tree/military");
    assert.equal(list.toolbarGroups, 2, "technology list toolbar should keep only filters and search");
    assert.ok(list.toolbarInputWidth >= 260, "technology search should have a readable width");
    assert.equal(list.categorySwitcher, 1, "technology list should use a segmented category switcher");
    assert.equal(list.categoryButtons, 3, "technology category switcher should expose three categories");
    assert.match(list.backIcon, /arrow-left\.svg$/, "technology back control should use the Lucide left arrow icon");
    assert.equal(list.backText, "", "technology list back control should be icon-only");
    const toolbarInk = baseUrl.includes("8877") ? "rgb(238, 229, 223)" : "rgb(238, 232, 221)";
    assert.equal(list.controlColor, toolbarInk, "technology controls should use the map toolbar white color");
    assert.equal(list.categoryActiveColor, toolbarInk, "active technology category should use the map toolbar white color");
    assert.notEqual(list.iconFilter, "none", "technology control icons should use the white icon treatment");
    assert.equal(list.floatingPosition, "absolute", "technology controls should float over the content corner");
    assert.equal(list.listToolbarBorder, "0px", "technology list should not render a second full-width toolbar line");
    assert.equal(list.researchKinds.length, 0, "non-research technologies should not show research outcome labels");
    const listOrder = await page.evaluate(() => [...document.querySelectorAll(".technology-list-card")].map((node) => node.dataset.technologyKey));
    await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/technology/tree/military`);
    await page.waitForSelector(".technology-graph-canvas > .technology-node");
    const treeOrder = await page.evaluate(() => [...document.querySelectorAll(".technology-graph-canvas > .technology-node")].map((node) => ({ key: node.dataset.technologyKey, left: Number.parseFloat(node.style.left), top: Number.parseFloat(node.style.top) })).sort((left, right) => left.top - right.top || left.left - right.left).map((node) => node.key));
    assert.deepEqual(listOrder, treeOrder, "military list must follow tree top-to-bottom, left-to-right order");
    await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/technology/list/military`);
    await page.waitForSelector(".technology-list-card");
    const militaryUnits = await page.evaluate(() => ({
      land: document.querySelectorAll('[data-technology-key="line_infantry"] .technology-unit-icon').length,
      naval: document.querySelectorAll('[data-technology-key="submarine"] .technology-unit-icon').length,
      mobilization: document.querySelectorAll('[data-technology-key="artillery"] .technology-unit-icon').length,
      plusCount: [...document.querySelectorAll('[data-technology-key="artillery"] .technology-effect-chip')].filter((node) => node.textContent.trim().startsWith("+")).length,
      effectRows: document.querySelectorAll('[data-technology-key="mandatory_service"] .technology-effect-text').length,
      iconRows: document.querySelectorAll('[data-technology-key="artillery"] .technology-effect-icons .technology-content-chip').length,
    }));
    assert.ok(militaryUnits.land > 0, "line infantry technology must expose a land unit icon");
    assert.ok(militaryUnits.naval > 0, "submarine technology must expose a naval unit icon");
    assert.ok(militaryUnits.mobilization > 0, "artillery technology must expose a mobilization option icon");
    assert.equal(militaryUnits.plusCount, 0, "technology cards should not summarize military content with +n");
    assert.ok(militaryUnits.effectRows > 0, "technology list must show every text effect");
    assert.ok(militaryUnits.iconRows > 0, "technology list must keep icon effects in a separate group");

    await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/technology/list/production`);
    await page.waitForSelector(".technology-list-card");
    const contentCards = await page.evaluate(() => ({
      baking: document.querySelector('[data-technology-key="baking_powder"]')?.textContent || "",
      railway: document.querySelector('[data-technology-key="electric_railway"]')?.textContent || "",
      icons: document.querySelectorAll('[data-technology-key="baking_powder"] .technology-content-icon').length,
      labels: [...document.querySelectorAll('[data-technology-key="baking_powder"] .technology-content-chip')].map((node) => node.textContent.trim()),
      foodFactoryIcon: document.querySelector('[data-technology-key="manufacturies"] .technology-content-icon[src*="building_food_industry.webp"]')?.getAttribute("src") || "",
      repeatedProductionMethods: document.querySelectorAll('[data-technology-key="atmospheric_engine"] .technology-content-icon[src*="production-methods"]').length,
      contentChipStyle: (() => { const node = document.querySelector('[data-technology-key="atmospheric_engine"] .technology-content-chip'); return node ? { background: getComputedStyle(node).backgroundColor, padding: getComputedStyle(node).padding, iconWidth: getComputedStyle(node.querySelector(".technology-content-icon")).width } : null; })(),
      textBottom: (() => { const text = document.querySelector('[data-technology-key="cotton_gin"] .technology-effect-text-group'); const icons = document.querySelector('[data-technology-key="cotton_gin"] .technology-effect-icons'); return text && icons ? text.getBoundingClientRect().bottom <= icons.getBoundingClientRect().top : false; })(),
    }));
    assert.ok(contentCards.icons > 0, "technology content should use production-method icons");
    assert.equal(contentCards.foodFactoryIcon, "assets/buildings/building_food_industry.webp", "building technology references should use the building icon");
    assert.ok(contentCards.labels.every((label) => !/^(生产方式|建筑)：/.test(label)), "technology list content must be icon-only");
    assert.equal(contentCards.repeatedProductionMethods, 1, "same-name production methods must appear once in the technology list");
    assert.deepEqual(contentCards.contentChipStyle, { background: "rgba(0, 0, 0, 0)", padding: "0px", iconWidth: "32px" });
    await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/technology/list/society`);
    await page.waitForSelector('[data-technology-key="urbanization"]');
    const urbanizationEffects = await page.evaluate(() => document.querySelectorAll('[data-technology-key="urbanization"] .technology-effect-text').length);
    assert.ok(urbanizationEffects >= 4, "technology cards must show every technology effect");
    const harvestEffect = await page.evaluate(() => document.querySelector('[data-technology-key="modern_sewerage"]')?.textContent || "");
    assert.match(harvestEffect, /洪水收获状况影响/);
    assert.doesNotMatch(harvestEffect, /GetHarvestConditionType/);

    await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/technology/list/production`);
    await page.waitForSelector(".technology-list-card");
    assert.equal(contentCards.textBottom, true, "technology text and icon groups must be on separate rows");

    await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/technology/list/society`);
    await page.waitForSelector('[data-technology-key="international_relations"]');
    const internationalRelations = await page.evaluate(() => ({
      placeholder: document.querySelector('[data-technology-key="international_relations"]')?.textContent.includes("暂无已投影内容") || false,
      card: document.querySelector('[data-technology-key="international_relations"]')?.textContent || "",
    }));
    assert.equal(internationalRelations.placeholder, false, "empty technology icon content must not show a placeholder");
    assert.doesNotMatch(internationalRelations.card, /民族主义|殖民/);
    await page.evaluate(() => document.querySelector('[data-technology-key="international_relations"]')?.click());
    await page.waitFor(() => document.querySelector(".technology-detail")?.textContent.includes("外交行动"), "international relations detail references");
    const diplomacy = await page.evaluate(() => document.querySelector(".technology-detail")?.textContent || "");
    assert.match(diplomacy, /宿敌/);
    assert.match(diplomacy, /共同防御条约/);

    await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/technology/list/production`);
    await page.waitForSelector(".technology-list-card");

    const searchState = await page.evaluate(() => {
      const input = document.querySelector('[data-technology-search]');
      input.focus();
      input.value = "electric railway";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return { value: input.value, focused: document.activeElement === input, cards: document.querySelectorAll(".technology-list-card").length };
    });
    assert.deepEqual(searchState, { value: "electric railway", focused: true, cards: 1 });

    const vanillaVcFilters = await page.evaluate(() => document.querySelectorAll('[data-technology-change]').length);
    assert.equal(vanillaVcFilters, baseUrl.includes("8877") ? 2 : 0, "technology list should expose VC filters only on the VC site");

    await page.evaluate(() => { const input = document.querySelector('[data-technology-search]'); input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true })); input.value = "机"; input.dispatchEvent(new Event("input", { bubbles: true })); });
    await page.waitFor(() => document.querySelectorAll('[data-technology-key="shaft_mining"]').length === 0, "scoped technology search");
    const scopedSearch = await page.evaluate(() => [...document.querySelectorAll(".technology-list-card")].map((node) => node.dataset.technologyKey));
    assert.ok(!scopedSearch.includes("shaft_mining"), "searching 机 must not match shaft mining through related content");

    await page.goto(`${baseUrl.replace("8876", "8877")}?lang=zh-Hans#/technology/list/military`);
    await page.waitForSelector(".technology-list-card");
    const standaloneAdjusted = await page.evaluate(() => ({
      filters: document.querySelectorAll('[data-technology-change]').length,
      cardBorder: getComputedStyle(document.querySelector('[data-technology-key="concrete_fortifications"]')).borderTopColor,
      addedEffect: (() => { const card = document.querySelector('[data-technology-key="military_statistics"]'); const effect = [...(card?.querySelectorAll('.technology-effect-text') || [])].find((node) => node.textContent.includes('损耗风险乘数')); return { text: effect?.textContent.trim() || '', className: effect?.className || '', color: effect ? getComputedStyle(effect).color : '' }; })(),
    }));
    assert.equal(standaloneAdjusted.filters, 2, "VC technology list must retain VC filters");
    assert.notEqual(standaloneAdjusted.cardBorder, "rgb(214, 138, 58)", "VC technology cards should keep their normal color");
    assert.match(standaloneAdjusted.addedEffect.text, /损耗风险乘数/);
    assert.match(standaloneAdjusted.addedEffect.className, /technology-vc-effect/);
    assert.equal(standaloneAdjusted.addedEffect.color, "rgb(240, 160, 75)", "VC-only technology effects should use orange");
    const mobilizationLabels = await page.evaluate(() => {
      const card = document.querySelector('[data-technology-key="military_statistics"]');
      return {
        text: card?.textContent || "",
        titles: [...(card?.querySelectorAll(".technology-content-chip") || [])].map((node) => node.getAttribute("title") || ""),
      };
    });
    assert.doesNotMatch(mobilizationLabels.text, /mobilization_option_[a-z0-9_]+/i, "VC mobilization options should not display internal keys");
    assert.ok(mobilizationLabels.titles.some((title) => title === "奢侈补给" || title.includes("奢侈补给")), `VC military statistics should display the localized mobilization option: ${JSON.stringify({ ...mobilizationLabels, localized: typeof localeRuntime !== "undefined" ? localeRuntime.dataMessages?.[localeRuntime.current]?.["item:0:mobilization_option_luxurious_supplies.name"] : "missing-runtime" })}`);
    await page.goto(`${baseUrl.replace("8876", "8877")}?lang=zh-Hans#/technology/nationalism?from=list`);
    await page.waitFor(() => document.querySelector("[data-technology-research-effect]"), "localized ideology research results");
    const nationalismResearch = await page.evaluate(() => document.querySelector("[data-technology-research-effect]")?.textContent || "");
    assert.match(nationalismResearch, /孤立主义者/);
    assert.match(nationalismResearch, /扩张主义者/);
    assert.doesNotMatch(nationalismResearch, /ideology_|remove_ideology|add_ideology/);
    await page.goto(`${baseUrl.replace("8876", "8877")}?lang=zh-Hans#/technology/central_archives?from=list`);
    await page.waitFor(() => document.querySelector("[data-technology-key=central_archives] .technology-research-kind")?.textContent.includes("发起政治运动"), "political movement research label");
    await page.goto(`${baseUrl.replace("8876", "8877")}?lang=zh-Hans#/technology/egalitarianism?from=list`);
    await page.waitFor(() => document.querySelector("[data-technology-research-effect]")?.textContent.includes("人民之春"), "localized journal research result");
    const egalitarianismResearch = await page.evaluate(() => document.querySelector("[data-technology-research-effect]")?.textContent || "");
    assert.doesNotMatch(egalitarianismResearch, /je_springtime|add_involved_country/);
    await page.goto(`${baseUrl.replace("8876", "8877")}?lang=zh-Hans#/technology/triage?from=list`);
    await page.waitFor(() => document.querySelector("[data-technology-research-effect]")?.textContent.includes("提灯女士"), "localized event research result");
    const triageResearch = await page.evaluate(() => document.querySelector("[data-technology-research-effect]")?.textContent || "");
    assert.doesNotMatch(triageResearch, /historical_agitators\.23|trigger_event|create_character/);
    await page.goto(`${baseUrl.replace("8876", "8877")}?lang=zh-Hans#/technology/list/production`);
    await page.waitForSelector('[data-technology-key="united_fruit_banana_tech"]');
    const standaloneAdded = await page.evaluate(() => ({
      border: getComputedStyle(document.querySelector('[data-technology-key="united_fruit_banana_tech"]')).borderTopColor,
      effects: [...document.querySelectorAll('[data-technology-key="united_fruit_banana_tech"] .technology-effect-text')].map((node) => ({ text: node.textContent.trim(), className: node.className, color: getComputedStyle(node).color })),
    }));
    assert.notEqual(standaloneAdded.border, "rgb(240, 160, 75)", "VC added technology cards should keep their normal color");
    assert.ok(standaloneAdded.effects.some((effect) => effect.className.includes("technology-vc-effect") && effect.color === "rgb(240, 160, 75)"), "VC added technology effects should use orange");

    await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/technology/tree/production`);
    await page.waitFor(() => document.querySelectorAll(".technology-graph-canvas > .technology-node").length === document.querySelectorAll(".technology-graph-canvas > .technology-node").length && document.querySelectorAll(".technology-graph-canvas > .technology-node").length > 0, "production technology tree");
    const tree = await page.evaluate(() => ({
      nodes: document.querySelectorAll(".technology-graph-canvas > .technology-node").length,
      switchHref: document.querySelector(".technology-board-switch")?.getAttribute("href") || "",
      graphUserSelect: getComputedStyle(document.querySelector(".technology-graph-viewport")).userSelect,
      graphTouchAction: getComputedStyle(document.querySelector(".technology-graph-viewport")).touchAction,
      search: document.querySelector("[data-technology-search]") !== null,
      resetInPrimary: Boolean(document.querySelector(".technology-floating-controls [data-technology-reset]")),
      listIcon: document.querySelector(".technology-board-switch .technology-control-icon")?.getAttribute("src") || "",
      backIcon: document.querySelector(".technology-board-back .technology-control-icon")?.getAttribute("src") || "",
      floatingControls: document.querySelectorAll(".technology-floating-controls").length,
      iconControls: document.querySelectorAll(".technology-floating-controls .technology-icon-button").length,
      categorySwitcher: document.querySelectorAll(".technology-floating-controls .technology-category-switcher").length,
      floatingPosition: getComputedStyle(document.querySelector(".technology-floating-controls")).position,
    }));
    assert.equal(tree.switchHref, "#/technology/list/production");
    assert.ok(tree.nodes >= 57, "production technology tree must expose the base-game technologies");
    assert.equal(tree.graphUserSelect, "none", "technology tree dragging should not select text");
    assert.equal(tree.graphTouchAction, "none", "technology tree dragging should reserve pointer gestures");
    assert.equal(tree.search, false, "technology tree should hide the search control");
    assert.equal(tree.resetInPrimary, true, "technology tree reset should stay in the upper-left controls");
    assert.match(tree.listIcon, /layout-list\.svg$/, "technology tree list switch should use the list icon");
    assert.match(tree.backIcon, /arrow-left\.svg$/, "technology tree back control should use the Lucide left arrow icon");
    assert.equal(tree.floatingControls, 1, "technology tree controls should use a floating upper-left container");
    assert.equal(tree.iconControls, 3, "technology tree should expose three icon controls");
    assert.equal(tree.categorySwitcher, 1, "technology tree should use a segmented category switcher");
    assert.equal(tree.floatingPosition, "absolute", "technology tree controls should float over the content corner");

    await page.evaluate(() => document.querySelector('[data-technology-key="cotton_gin"]')?.click());
    await page.waitFor(() => location.hash.includes("/technology/cotton_gin") && document.querySelector("[data-technology-effects]"), "technology tree detail");
    const treeDetail = await page.evaluate(() => ({
      title: document.querySelector(".technology-detail h2")?.textContent.trim() || "",
      backRoute: document.querySelector("[data-technology-back]")?.dataset.technologyBackRoute || "",
    }));
    assert.deepEqual(treeDetail, { title: "轧棉机", backRoute: "/technology/tree/production" });

    await page.goto(`${baseUrl}?version=1.13.11&lang=zh-Hans#/technology/list/production`);
    await page.waitForSelector(".technology-list-card");
    await page.evaluate(() => document.querySelector('[data-technology-key="cotton_gin"]')?.click());
    await page.waitFor(() => location.hash.includes("/technology/cotton_gin") && document.querySelector("[data-technology-effects]"), "shared technology detail");
    const detail = await page.evaluate(() => ({
      title: document.querySelector(".technology-detail h2")?.textContent.trim() || "",
      effects: Boolean(document.querySelector("[data-technology-effects]")),
      research: Boolean(document.querySelector("[data-technology-research-effect]")),
      prerequisites: Boolean([...document.querySelectorAll(".technology-detail h3")].find((node) => node.textContent.includes("前置科技"))),
      relationIcons: document.querySelectorAll(".technology-relation-link .technology-relation-icon").length,
      relationIconFilter: getComputedStyle(document.querySelector(".technology-relation-link .technology-relation-icon"))?.filter || "",
      relationLabels: [...document.querySelectorAll(".technology-relation-link")].map((node) => node.textContent.trim()),
      backRoute: document.querySelector("[data-technology-back]")?.dataset.technologyBackRoute || "",
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      detailPosition: getComputedStyle(document.querySelector(".detail")).position,
      resultsOverflowY: getComputedStyle(document.querySelector(".results")).overflowY,
      overviewCards: document.querySelectorAll(".technology-detail-overview-card").length,
      meta: document.querySelector(".technology-detail-meta")?.textContent.trim() || "",
      effectsHeading: document.querySelector("[data-technology-effects] h3")?.textContent.trim() || "",
      stickyHeader: document.querySelector(".technology-detail-header") ? getComputedStyle(document.querySelector(".technology-detail-header")).position : "",
      groupedRelated: document.querySelectorAll(".technology-related-group").length,
      emptySections: [...document.querySelectorAll(".technology-detail-section")].filter((node) => !node.textContent.trim()).length,
      sectionOrder: [...document.querySelectorAll(".technology-detail > *")].map((node) => node.classList.contains("technology-detail-header") ? "标题" : node.classList.contains("technology-detail-meta") ? "元信息" : node.querySelector("h3")?.textContent.trim() || "其他"),
      selectedListCard: document.querySelector('[data-technology-key="cotton_gin"]')?.classList.contains("is-selected") || false,
      selectedListCardPressed: document.querySelector('[data-technology-key="cotton_gin"]')?.getAttribute("aria-pressed") || "",
    }));
    assert.equal(detail.title, "轧棉机");
    assert.equal(detail.effects, true);
    assert.equal(detail.research, false, "technologies without ideology changes should omit that section");
    assert.equal(detail.prerequisites, true);
    assert.ok(detail.relationIcons > 0, "technology prerequisites and unlocks should use technology icons");
    assert.equal(detail.relationIconFilter, "none", "technology relation icons should preserve their original colors");
    assert.ok(detail.relationLabels.includes("车床"), "technology unlocks should render the localized technology name");
    assert.equal(detail.backRoute, "/technology/list/production");
    assert.equal(detail.overflow, false);
    assert.equal(detail.detailPosition, "fixed");
    assert.equal(detail.resultsOverflowY, "auto");
    assert.equal(detail.overviewCards, 0, "technology detail should use one compact metadata line");
    assert.match(detail.meta, /社会|生产|军事/);
    assert.match(detail.meta, /时代 I|时代 II|时代 III|时代 IV|时代 V/);
    assert.match(detail.effectsHeading, /修正|Modifiers/);
    assert.equal(detail.stickyHeader, "sticky", "technology detail header should stay visible while the right panel scrolls");
    assert.ok(detail.groupedRelated >= 1, "technology detail related content should use grouped sections");
    assert.equal(detail.emptySections, 0, "technology detail should omit empty sections");
    assert.ok(detail.sectionOrder.indexOf("前置科技") > detail.sectionOrder.indexOf("标题"), "technology prerequisites should follow the title");
    assert.ok(detail.sectionOrder.indexOf("前置科技") < detail.sectionOrder.indexOf("后续科技"), "technology prerequisites should precede subsequent technologies");
    assert.equal(detail.sectionOrder.at(-1), "后续科技", "subsequent technologies should be the last detail section");
    assert.equal(detail.selectedListCard, true, "the selected technology card should stay highlighted in the list");
    assert.equal(detail.selectedListCardPressed, "true", "the selected technology card should expose its selected state");

    const relatedLinks = await page.evaluate(() => ({
      production: [...document.querySelectorAll(".technology-related-item")].filter((node) => node.textContent.includes("生产") || node.href.includes("/building/")).length,
      hrefs: [...document.querySelectorAll(".technology-related-item[href]")].map((node) => node.getAttribute("href")),
      icons: document.querySelectorAll(".technology-related-item .technology-content-icon, .technology-related-item .technology-unit-icon").length,
    }));
    assert.ok(relatedLinks.icons > 0, "technology detail related content should show icons");
    assert.ok(relatedLinks.hrefs.every((href) => href && !href.includes("/production-method/")), "technology related content links must be valid board routes");
    await page.close();
  }
  console.log(JSON.stringify({ technology_navigation_browser: "ok", viewports: ["1440x900", "390x844"], locales: ["zh-Hans"] }, null, 2));
} finally {
  chrome.kill();
}

async function openPage(viewport) {
  await waitForDebugger();
  const target = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" }).then((response) => response.json());
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let sequence = 0;
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    const deferred = pending.get(message.id);
    if (!deferred) return;
    pending.delete(message.id);
    deferred(message);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, (message) => message.error ? reject(new Error(message.error.message)) : resolve(message.result || {}));
    socket.send(JSON.stringify({ id, method, params }));
  });
  await send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
  return {
    async goto(url) {
      await send("Page.enable");
      await send("Page.navigate", { url });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    },
    async evaluate(fn, argument) {
      const expression = argument === undefined ? `(${fn})()` : `(${fn})(${JSON.stringify(argument)})`;
      const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || "browser evaluation failed");
      return result.result.value;
    },
    async waitForSelector(selector) { return this.waitFor((value) => Boolean(document.querySelector(value)), selector, selector); },
    async waitFor(fn, argument, description = "browser condition") {
      const end = Date.now() + 20000;
      while (Date.now() < end) {
        if (await this.evaluate(fn, argument)) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(`${description} timed out`);
    },
    async close() { socket.close(); },
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
