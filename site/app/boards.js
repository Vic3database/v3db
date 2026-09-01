const HOME_NEWS_PAGE_SIZE = 10;
const NEWS_PAGE_SIZE = 25;
const newsCategoryLabels = {
  all: "news.category.all",
  diary: "news.category.diary",
  patch: "news.category.patch",
  other: "news.category.other",
};

function visibleNewsItems(category = state.newsCategory) {
  return newsItems
    .filter((item) => category === "all" || item.category === category)
    .slice()
    .sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id));
}

function newsItemHtml(item, className = "news-item") {
  return `
    <a class="${className}" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
      <time datetime="${escapeHtml(item.date)}">${escapeHtml(item.date)}</time>
      <span class="news-item-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.label)}</small></span>
    </a>
  `;
}

function newsCategoryTabsHtml(className = "news-tabs") {
  return `
    <div class="${className}" role="group" aria-label="${escapeHtml(t("news.categories"))}">
      ${Object.entries(newsCategoryLabels).map(([key, label]) => `
        <button class="${className.slice(0, -1)}" type="button" data-news-category="${key}" aria-pressed="${state.newsCategory === key}">${t(label)}</button>
      `).join("")}
    </div>
  `;
}

function bindNewsCategoryControls(container, { renderTarget, resetPage = true } = {}) {
  container.querySelectorAll("[data-news-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.newsCategory = button.dataset.newsCategory || "all";
      if (resetPage) state.newsPage = 1;
      renderTarget();
    });
  });
}

function renderHomeNewsHtml() {
  const items = visibleNewsItems().slice(0, HOME_NEWS_PAGE_SIZE);
  return `
    <section class="home-side-panel home-news-panel">
      <div class="home-side-heading"><h2>${t("nav.news")}</h2><span>${t("news.latestCount", { count: localizedNumber(HOME_NEWS_PAGE_SIZE) })}</span></div>
      ${newsCategoryTabsHtml("home-news-tabs")}
      <div class="home-news-list">
        ${items.length ? items.map((item) => newsItemHtml(item, "home-news-item")).join("") : `<p class="empty">${t("news.empty")}</p>`}
      </div>
      <button class="home-news-more" type="button" data-news-more>${t("news.more")} →</button>
    </section>
  `;
}

function bindHomeNewsControls() {
  bindNewsCategoryControls(els.detail, { renderTarget: renderHomeBoard });
  els.detail.querySelector("[data-news-more]")?.addEventListener("click", () => {
    state.newsPage = 1;
    location.hash = "/news";
  });
}

function renderNewsBoard() {
  mapRuntime.filteredCountryTags = new Set();
  const items = visibleNewsItems();
  const pageCount = Math.max(1, Math.ceil(items.length / NEWS_PAGE_SIZE));
  state.newsPage = Math.min(Math.max(1, state.newsPage), pageCount);
  const start = (state.newsPage - 1) * NEWS_PAGE_SIZE;
  const pageItems = items.slice(start, start + NEWS_PAGE_SIZE);
  els.resultCount.textContent = t("nav.news");
  els.activeHint.textContent = t("news.categoryCount", { category: t(newsCategoryLabels[state.newsCategory]), count: localizedNumber(items.length) });
  els.countryList.className = "country-list news-board";
  els.detail.innerHTML = "";
  els.countryList.innerHTML = `
    <section class="news-board-panel" aria-label="${escapeHtml(t("nav.news"))}">
      <div class="news-board-heading">
        <div><h2>${t("nav.news")}</h2><p>${t("news.description")}</p></div>
        <span>${t("news.page", { page: localizedNumber(state.newsPage), count: localizedNumber(pageCount) })}</span>
      </div>
      ${newsCategoryTabsHtml("news-board-tabs")}
      <div class="news-board-list">
        ${pageItems.length ? pageItems.map((item) => newsItemHtml(item, "news-board-item")).join("") : `<p class="empty">${t("news.empty")}</p>`}
      </div>
      <div class="news-pagination" aria-label="${escapeHtml(t("news.pagination"))}">
        <button type="button" data-news-page="previous"${state.newsPage === 1 ? " disabled" : ""}>${t("news.previous")}</button>
        <span>${t("news.page", { page: localizedNumber(state.newsPage), count: localizedNumber(pageCount) })}</span>
        <button type="button" data-news-page="next"${state.newsPage === pageCount ? " disabled" : ""}>${t("news.next")}</button>
      </div>
    </section>
  `;
  bindNewsCategoryControls(els.countryList, { renderTarget: renderNewsBoard });
  els.countryList.querySelectorAll("[data-news-page]").forEach((button) => {
    button.addEventListener("click", () => {
      state.newsPage += button.dataset.newsPage === "next" ? 1 : -1;
      renderNewsBoard();
    });
  });
  renderMap([]);
}

function announcementItemHtml(item) {
  const body = escapeHtml(item.body).replaceAll("\n", "<br>");
  return `
    <article class="home-announcement-item">
      <time datetime="${escapeHtml(item.date)}">${escapeHtml(item.date)}</time>
      <strong>${escapeHtml(item.title)}</strong>
      <p>${body}</p>
    </article>
  `;
}

function renderHomeBoard() {
  const isStandaloneSite = Boolean(standaloneSiteConfig);
  const companyToolsAvailable = Boolean(standaloneSiteConfig) || loadedDataVersion === "1.13.11";
  mapRuntime.filteredCountryTags = new Set();
  els.resultCount.textContent = "";
  els.activeHint.textContent = "";
  els.countryList.className = "country-list home-board";
  const entries = [
    { category: "domestic", label: "nav.country", view: "country", icon: "assets/home/waving_flag.png" },
    { category: "domestic", label: "nav.law", view: "law", icon: "assets/home/law_enforcement.png" },
    { category: "domestic", label: "nav.ideology", view: "ideology", icon: "assets/home/democracy.png" },
    { category: "domestic", label: "nav.interestGroup", view: "interest-group", icon: "assets/technologies/corporatism.webp" },
    { category: "society", label: "nav.culture", view: "culture", icon: "assets/home/nationalism.png" },
    { category: "society", label: "nav.religion", view: "religion", icon: "assets/event-icons/religion_icons/protestant.webp" },
    { category: "economy", label: "nav.region", view: "region", icon: "assets/home/state.png" },
    { category: "economy", label: "nav.company", view: "company", icon: "assets/home/companies.png" },
    { category: "economy", label: "nav.building", view: "building", icon: "assets/home/manufacturies.png" },
    { category: "economy", label: "nav.goods", view: "goods", icon: "assets/home/grand_strategy_games_prestige.png" },
    { category: "technology", label: "nav.technology", view: "technology", icon: "assets/home/academia.png" },
    { category: "game", label: "nav.journal", view: "journal", icon: "assets/event-icons/event_icons/event_default.webp" },
    { category: "game", label: "nav.event", view: "event", icon: "assets/event-icons/event_icons/event_protest.webp" },
    { category: "game", label: "nav.decision", view: "decision", icon: "assets/event-icons/event_icons/event_default_option.webp" },
    { category: "game", label: "nav.achievement", view: "achievement", icon: "assets/home/icon_achievements_enabled.png" },
  ];
  const availableEntries = entries;
  const tools = [
    { key: "cultureIncorporation", label: "nav.cultureIncorporationEntry", description: "board.culture.incorporation.description", route: "/culture/incorporation", icon: "assets/lucide/icons/calculator.svg", available: true },
    { key: "companySolver", label: "board.company.solverEntry", description: "board.company.solverDescription", route: "/company/solver", icon: "assets/lucide/icons/workflow.svg", available: companyToolsAvailable },
    { key: "companyComposer", label: "board.company.composer.entry", description: "board.company.composer.description", route: "/company/composer", icon: "assets/lucide/icons/combine.svg", available: companyToolsAvailable },
  ].filter((tool) => tool.available);
  const categories = [
    { key: "domestic", label: "nav.domestic" },
    { key: "society", label: "nav.society" },
    { key: "economy", label: "nav.economy" },
    { key: "technology", label: "nav.technology" },
    { key: "game", label: "nav.gameContent" },
  ];
  els.countryList.innerHTML = `
    <section class="home-tools" aria-labelledby="home-tools-title">
      <div class="home-tools-heading"><h2 id="home-tools-title">${escapeHtml(t("home.tools", "工具"))}</h2></div>
      <div class="home-tool-grid">
        ${tools.map((tool) => `
          <button class="home-tool-card" type="button" data-home-tool="${escapeHtml(tool.key)}" data-home-tool-route="${escapeHtml(tool.route)}">
            <img class="home-tool-icon lucide-icon" src="${escapeHtml(tool.icon)}" alt="" aria-hidden="true">
            <span class="home-tool-copy"><strong>${escapeHtml(t(tool.label))}</strong><small>${escapeHtml(t(tool.description))}</small></span>
            <img class="home-tool-arrow lucide-icon" src="assets/lucide/icons/arrow-right.svg" alt="" aria-hidden="true">
          </button>
        `).join("")}
      </div>
    </section>
    <div class="home-category-list">
      ${categories.map((category) => {
    const categoryEntries = availableEntries.filter((entry) => entry.category === category.key);
        return `
          <section class="home-category-card" data-category="${escapeHtml(category.key)}" aria-label="${escapeHtml(t(category.label))}">
            <div class="home-category-heading"><h2>${escapeHtml(t(category.label))}</h2></div>
            <div class="home-entry-grid">
              ${categoryEntries.map((entry) => `
                <button class="home-entry" type="button" data-home-view="${escapeHtml(entry.view)}">
                  <img class="home-entry-icon" src="${escapeHtml(entry.icon)}" alt="" aria-hidden="true">
                  <span class="home-entry-copy"><strong>${escapeHtml(t(entry.label))}</strong>${entry.text ? `<small>${escapeHtml(t(entry.text))}</small>` : ""}</span>
                </button>
              `).join("")}
            </div>
          </section>
        `;
      }).join("")}
    </div>
  `;
  els.countryList.querySelectorAll("[data-home-tool]").forEach((button) => {
    button.addEventListener("click", async () => {
      replaceHash(button.dataset.homeToolRoute);
      await applyHash();
      render();
    });
  });
  els.countryList.querySelectorAll("[data-home-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      await setView(button.dataset.homeView);
      render();
    });
  });
  els.detail.innerHTML = isStandaloneSite ? "" : `
    <section class="home-side-panel home-announcement">
      <div class="home-side-heading"><h2>${t("home.announcements")}</h2><span>${t("home.onSite")}</span></div>
      ${announcementItems.length
        ? `<div class="home-announcement-list">${announcementItems.map(announcementItemHtml).join("")}</div>`
        : `<p class="home-announcement-empty">${t("home.noAnnouncements")}</p>`}
    </section>
    ${renderHomeNewsHtml()}
  `;
  if (!isStandaloneSite) bindHomeNewsControls();
  renderMap([]);
}

const interestGroupBoardOrder = [
  "ig_landowners",
  "ig_petty_bourgeoisie",
  "ig_devout",
  "ig_rural_folk",
  "ig_intelligentsia",
  "ig_industrialists",
  "ig_armed_forces",
  "ig_trade_unions",
];

const interestGroupBoardPresentationPalette = {
  ig_landowners: { standard: "#6A6AB0", background: "#1B1B2C", text: "#6A6AB0" },
  ig_petty_bourgeoisie: { standard: "#3D26B7", background: "#0F0A2E", text: "#B8A8F2" },
  ig_devout: { standard: "#4AAAB3", background: "#132B2D", text: "#4AAAB3" },
  ig_rural_folk: { standard: "#449977", background: "#11261E", text: "#449977" },
  ig_intelligentsia: { standard: "#E48B0A", background: "#392303", text: "#E48B0A" },
  ig_industrialists: { standard: "#E47639", background: "#391E0E", text: "#E47639" },
  ig_armed_forces: { standard: "#634740", background: "#191210", text: "#C6A988" },
  ig_trade_unions: { standard: "#942828", background: "#250A0A", text: "#D68A8A" },
};

function interestGroupBoardPalette(group) {
  return interestGroupBoardPresentationPalette[group.key] || {
    standard: group.color?.hex || "var(--accent)",
    background: "var(--surface)",
    text: group.color?.hex || "var(--accent)",
  };
}

function interestGroupBoardColorStyle(group) {
  const palette = interestGroupBoardPalette(group);
  return `--interest-group-color:${palette.standard};--interest-group-background:${palette.background};--interest-group-text-color:${palette.text}`;
}

function interestGroupBoardCard(group) {
  const description = cleanDescriptionText(entityText(group, "description", ""));
  return `
    <button class="interest-group-board-card" type="button" data-interest-group-key="${escapeHtml(group.key)}" style="${escapeHtml(interestGroupBoardColorStyle(group))}">
      <span class="interest-group-board-identity">
        ${interestGroupIconHtml(group, "interest-group-board-icon")}
        <span class="interest-group-board-title"><strong>${escapeHtml(entityText(group))}</strong><small>${escapeHtml(group.key)}</small></span>
      </span>
      <span class="interest-group-board-description">${escapeHtml(description)}</span>
    </button>
  `;
}

function interestGroupRuleSignature(rule) {
  return JSON.stringify({
    condition: rule?.condition_raw || "",
    names: (rule?.names || []).map((item) => item?.key || ""),
    traits: (rule?.traits || []).map((item) => item?.key || ""),
    added: (rule?.added_ideologies || []).map((item) => item?.key || ""),
    removed: (rule?.removed_ideologies || []).map((item) => item?.key || ""),
  });
}

function interestGroupTraitSignature(traits) {
  return (traits || []).map((trait) => trait?.key || "").filter(Boolean).sort().join("|");
}

function interestGroupIdeologySignature(ideologies) {
  return (ideologies || []).map((ideology) => ideology?.key || "").filter(Boolean).sort().join("|");
}

function interestGroupConditionSignature(condition) {
  return String(condition || "").replace(/\s+/g, "").toLowerCase();
}

const interestGroupConditionFlavorDefinition = {
  "ig_armed_forces:latin_spanish": { name: "军队（加勒比、加利福尼亚）", order: 10 },
  "ig_armed_forces:caudillo_cultures": { name: "军队（普拉塔/南安第斯/北安第斯/中美/墨西哥）", order: 20 },
  "ig_landowners:latin_spanish": { name: "地主（拉美西语）", order: 10 },
  "ig_landowners:boer": { name: "地主（布尔）", order: 20 },
  "ig_landowners:polish": { name: "地主（波兰）", order: 30 },
  "ig_intelligentsia:constitutionalists": { name: "知识分子（立宪派）", order: 10 },
  "ig_industrialists:colonial": { name: "实业家（殖民）", order: 10 },
  "ig_petty_bourgeoisie:mercantile": { name: "小市民（重商派）", order: 10 },
};

const armedForcesCaudilloCultureKeys = new Set([
  "platinean",
  "south_andean",
  "north_andean",
  "central_american",
  "mexican",
]);

function isArmedForcesCaudilloCultureCountry(country) {
  if (!(country?.primaryCultures || []).some((key) => armedForcesCaudilloCultureKeys.has(key))) return false;
  const latinAmerica = byGeographicRegion.get("geographic_region_latin_america");
  const latinAmericanStates = new Set((latinAmerica?.state_regions || []).map((stateRegion) => stateRegion.key));
  return (country?.locationStateRegions || []).some((stateRegion) => latinAmericanStates.has(stateRegion.key));
}

function applyArmedForcesConditionFlavorGrouping(groupKey, variants) {
  if (groupKey !== "ig_armed_forces") return;
  const latinSpanish = variants.get("latin_spanish");
  const caudilloCultures = variants.get("caudillo_cultures");
  if (!latinSpanish || !caudilloCultures) return;
  const caudilloCountryTags = countries
    .filter(isArmedForcesCaudilloCultureCountry)
    .map((country) => country.tag)
    .filter((tag) => latinSpanish.countries.has(tag));
  caudilloCultures.countries.clear();
  for (const tag of caudilloCountryTags) {
    latinSpanish.countries.delete(tag);
    caudilloCultures.countries.add(tag);
  }
  for (const [traitKey, traitUse] of latinSpanish.traits) {
    caudilloCultures.traits.set(traitKey, {
      trait: traitUse.trait,
      countries: new Set(caudilloCountryTags),
    });
  }
  for (const [ruleKey, rule] of latinSpanish.rules) caudilloCultures.rules.set(ruleKey, rule);
}

const interestGroupCountryVariantDefinition = {
  "ig_armed_forces:ig_trait_el_buen_jefe|ig_trait_materiel_waste|ig_trait_veteran_consultation:ideology_caudillismo|ideology_jingoist|ideology_loyalist|ideology_patriotic": {
    name: "interestGroup.variant.armedForces.latinSpanish",
    order: 10,
    conditionVariant: "caudillo_cultures",
  },
  "ig_armed_forces:ig_trait_clube_militar|ig_trait_coronelismo|ig_trait_el_buen_jefe:ideology_jingoist|ideology_loyalist|ideology_patriotic": {
    name: "interestGroup.variant.armedForces.brazilSpain",
    order: 20,
  },
  "ig_armed_forces:ig_trait_do_his_duty|ig_trait_heart_of_oak|ig_trait_refuse_imperialism:ideology_jingoist|ideology_loyalist|ideology_patriotic": {
    name: "interestGroup.variant.armedForces.englandBritain",
    order: 30,
  },
  "ig_armed_forces:ig_trait_elan_vital|ig_trait_materiel_waste|ig_trait_veteran_consultation:ideology_jingoist|ideology_loyalist|ideology_patriotic": {
    name: "interestGroup.variant.armedForces.franceParisCommune",
    order: 40,
  },
  "ig_armed_forces:ig_trait_army_hasastate|ig_trait_ironcross|ig_trait_shadow_government:ideology_jingoist|ideology_loyalist|ideology_patriotic": {
    name: "interestGroup.variant.armedForces.northGermanGermany",
    order: 50,
  },
  "ig_armed_forces:ig_trait_loyal_to_nations|ig_trait_mountain_hunter|ig_trait_unavis:ideology_jingoist|ideology_loyalist|ideology_patriotic": {
    name: "interestGroup.variant.armedForces.italy",
    order: 60,
  },
  "ig_industrialists:ig_trait_chinese_boycott|ig_trait_government_cooperation|ig_trait_national_industry:ideology_individualist|ideology_laissez_faire|ideology_plutocratic": {
    name: "interestGroup.variant.industrialists.china",
    order: 10,
  },
  "ig_industrialists:ig_trait_made_in_germany|ig_trait_national_enterprise|ig_trait_tax_avoidance:ideology_economic_statism|ideology_individualist|ideology_plutocratic": {
    name: "interestGroup.variant.industrialists.german",
    order: 20,
  },
  "ig_industrialists:ig_trait_free_trade_policy|ig_trait_technological_laziness|ig_trait_textile_monopoly:ideology_british_capitalism|ideology_laissez_faire|ideology_malthusian": {
    name: "interestGroup.variant.industrialists.englandBritain",
    order: 30,
  },
  "ig_industrialists:ig_shipping_magnates|ig_trait_job_creators|ig_trait_tax_avoidance:ideology_individualist|ideology_laissez_faire|ideology_plutocratic": {
    name: "interestGroup.variant.industrialists.greeceNorway",
    order: 40,
  },
  "ig_industrialists:ig_trait_engines_of_risorgimento|ig_trait_land_of_chimneys|ig_trait_tax_avoidance:ideology_individualist|ideology_laissez_faire|ideology_plutocratic": {
    name: "interestGroup.variant.industrialists.italy",
    order: 50,
  },
  "ig_industrialists:ig_trait_capital_in_chains|ig_trait_forges_of_tigris|ig_trait_modernists_of_sublime:ideology_individualist|ideology_laissez_faire|ideology_plutocratic": {
    name: "interestGroup.variant.industrialists.turkeyRome",
    order: 60,
  },
  "ig_intelligentsia:ig_trait_avant_garde|ig_trait_propagandists|ig_trait_social_criticism:ideology_anti_clerical|ideology_anti_slavery|ideology_constitutionalist|ideology_liberal": {
    name: "interestGroup.variant.intelligentsia.constitutionalists",
    order: 5,
    conditionVariant: "constitutionalists",
  },
  "ig_intelligentsia:ig_trait_leopoldina|ig_trait_rationalismus|ig_trait_revolutionsfuhrer:ideology_anti_clerical|ideology_anti_slavery|ideology_constitutionalist|ideology_liberal": {
    name: "interestGroup.variant.intelligentsia.germanConstitutionalists",
    order: 20,
  },
  "ig_intelligentsia:ig_trait_leopoldina|ig_trait_rationalismus|ig_trait_revolutionsfuhrer:ideology_anti_clerical|ideology_anti_slavery|ideology_liberal|ideology_republican": {
    name: "interestGroup.variant.intelligentsia.german",
    order: 10,
  },
  "ig_intelligentsia:ig_trait_crisis_of_language|ig_trait_liberal_sovereignty|ig_trait_popular_writers:ideology_anti_clerical|ideology_anti_slavery|ideology_constitutionalist|ideology_liberal": {
    name: "interestGroup.variant.intelligentsia.belgiumNetherlands",
    order: 30,
  },
  "ig_intelligentsia:ig_trait_camicie_rosse|ig_trait_realists|ig_trait_risorgimento:ideology_anti_clerical|ideology_anti_slavery|ideology_liberal|ideology_republican": {
    name: "interestGroup.variant.intelligentsia.italy",
    order: 40,
  },
  "ig_landowners:ig_trait_benevolence_and_righteousness|ig_trait_local_emperor|ig_trait_wise_ruler:ideology_hierarchic|ideology_paternalistic|ideology_patriarchal": {
    name: "interestGroup.variant.landowners.hanCulture",
    order: 10,
  },
  "ig_landowners:ig_trait_adm_expert|ig_trait_bad_boyars|ig_trait_owner_of_land:ideology_hierarchic|ideology_paternalistic|ideology_patriarchal": {
    name: "interestGroup.variant.landowners.russian",
    order: 20,
  },
  "ig_landowners:ig_trait_family_ties|ig_trait_noble_privileges|ig_trait_noblesse_oblige:ideology_german_nobles|ideology_paternalistic|ideology_patriarchal": {
    name: "interestGroup.variant.landowners.german",
    order: 30,
  },
  "ig_landowners:ig_trait_family_ties|ig_trait_noble_privileges|ig_trait_patrician_philanthropy:ideology_hierarchic|ideology_paternalistic|ideology_patriarchal": {
    name: "interestGroup.variant.landowners.yankee",
    order: 40,
  },
  "ig_landowners:ig_trait_junkerdom|ig_trait_offizierskorps|ig_trait_reactionary_enthusiasm:ideology_german_nobles|ideology_paternalistic|ideology_patriarchal": {
    name: "interestGroup.variant.landowners.northGermanGermany",
    order: 50,
  },
  "ig_petty_bourgeoisie:ig_trait_middle_managers|ig_trait_treasury_bonds|ig_trait_xenophobia:ideology_meritocratic|ideology_modernizer|ideology_patriotic": {
    name: "interestGroup.variant.pettyBourgeoisie.southAsian",
    order: 10,
  },
  "ig_petty_bourgeoisie:ig_trait_conning_commoner|ig_trait_following_its_natural|ig_trait_pragmatism:ideology_meritocratic|ideology_patriotic|ideology_reactionary": {
    name: "interestGroup.variant.pettyBourgeoisie.china",
    order: 20,
  },
  "ig_petty_bourgeoisie:ig_trait_master_of_city|ig_trait_rus_westernlism|ig_trait_spread_of_dissent:ideology_meritocratic|ideology_patriotic|ideology_reactionary": {
    name: "interestGroup.variant.pettyBourgeoisie.russian",
    order: 30,
  },
  "ig_petty_bourgeoisie:ig_trait_municipality|ig_trait_patriot|ig_trait_xenophobia:ideology_meritocratic|ideology_patriotic|ideology_reactionary": {
    name: "interestGroup.variant.pettyBourgeoisie.belgiumNetherlands",
    order: 40,
  },
  "ig_petty_bourgeoisie:ig_trait_civic_watchmen|ig_trait_people_of_procedure|ig_trait_stabbed_in_the_back:ideology_meritocratic|ideology_reactionary|ideology_revivalism": {
    name: "interestGroup.variant.pettyBourgeoisie.italy",
    order: 50,
  },
  "ig_rural_folk:ig_trait_catch_a_fire|ig_trait_peaceful_times|ig_trait_rule_of_etiquette:ideology_agrarian|ideology_isolationist|ideology_particularist": {
    name: "interestGroup.variant.ruralFolk.china",
    order: 10,
  },
  "ig_rural_folk:ig_trait_efficient_cultivation|ig_trait_old_ways|ig_trait_urban_suppliers:ideology_agrarian|ideology_isolationist|ideology_particularist": {
    name: "interestGroup.variant.ruralFolk.lowCountries",
    order: 20,
  },
  "ig_trade_unions:ig_trait_worker_forces|ig_trait_worker_revolution|ig_trait_worker_soviet:ideology_anti_slavery|ideology_egalitarian|ideology_populist|ideology_proletarian": {
    name: "interestGroup.variant.tradeUnions.russian",
    order: 10,
  },
  "ig_trade_unions:ig_trait_organize_strike|ig_trait_rigorous_work|ig_trait_social_justice:ideology_anti_slavery|ideology_egalitarian|ideology_populist|ideology_proletarian": {
    name: "interestGroup.variant.tradeUnions.german",
    order: 20,
  },
  "ig_trade_unions:ig_trait_labor_value|ig_trait_work_to_rule|ig_trait_workers_community:ideology_anti_slavery|ideology_egalitarian|ideology_populist|ideology_proletarian": {
    name: "interestGroup.variant.tradeUnions.englandBritain",
    order: 30,
  },
  "ig_landowners:ig_trait_family_ties|ig_trait_noble_privileges|ig_trait_wiener_walzer:ideology_hierarchic|ideology_paternalistic|ideology_patriarchal": {
    name: "interestGroup.variant.landowners.austria",
    order: 60,
  },
  "ig_landowners:ig_trait_fazenda_ibicaba|ig_trait_latifundios|ig_trait_noble_privileges:ideology_hierarchic|ideology_paternalistic|ideology_patriarchal": {
    name: "interestGroup.variant.landowners.brazil",
    order: 70,
  },
  "ig_landowners:ig_trait_family_ties|ig_trait_noble_privileges|ig_trait_patrician_philanthropy:ideology_hierarchic|ideology_patriarchal|ideology_republican_paternalistic": {
    name: "interestGroup.variant.landowners.california",
    order: 80,
  },
  "ig_landowners:ig_trait_family_ties|ig_trait_noble_privileges|ig_trait_noblesse_oblige:ideology_hierarchic|ideology_patriarchal|ideology_republican_paternalistic": {
    name: "interestGroup.variant.landowners.latinAmericaBoer",
    order: 90,
  },
  "ig_landowners:ig_trait_family_ties|ig_trait_junkerdom|ig_trait_noble_privileges:ideology_hierarchic|ideology_paternalistic|ideology_patriarchal": {
    name: "interestGroup.variant.landowners.germanyNorthGermanFederation",
    order: 100,
  },
  "ig_landowners:ig_trait_family_ties|ig_trait_noble_privileges|ig_trait_noblesse_oblige:ideology_hierarchic|ideology_magnatial|ideology_patriarchal": {
    name: "interestGroup.variant.landowners.polish",
    order: 110,
  },
  "ig_landowners:ig_trait_family_ties|ig_trait_noble_privileges|ig_trait_noblesse_oblige:ideology_carlist_ig|ideology_hierarchic|ideology_patriarchal": {
    name: "interestGroup.variant.landowners.carlistSpain",
    order: 120,
  },
  "ig_trade_unions:ig_trait_bourse_du_travail|ig_trait_industrial_organizers|ig_trait_work_to_rule:ideology_anti_slavery|ideology_egalitarian|ideology_populist|ideology_proletarian": {
    name: "interestGroup.variant.tradeUnions.france",
    order: 40,
  },
  "ig_armed_forces:ig_trait_clube_militar|ig_trait_coronelismo|ig_trait_patriotic_fervor:ideology_jingoist|ideology_loyalist|ideology_patriotic": {
    name: "interestGroup.variant.armedForces.brazil",
    order: 70,
  },
  "ig_armed_forces:ig_trait_newly_created_army|ig_trait_parochial_leadership|ig_trait_self_strengthening:ideology_jingoist|ideology_loyalist|ideology_patriotic": {
    name: "interestGroup.variant.armedForces.china",
    order: 80,
  },
  "ig_armed_forces:ig_trait_el_buen_jefe|ig_trait_materiel_waste|ig_trait_veteran_consultation:ideology_jingoist|ideology_loyalist|ideology_patriotic": {
    name: "interestGroup.variant.armedForces.spanishLatinAmerica",
    order: 90,
  },
  "ig_devout:ig_trait_the_best_revenge|ig_trait_traditsye|ig_trait_yeshivot:ideology_moralist|ideology_patriarchal|ideology_pious": {
    name: "interestGroup.variant.devout.judaism",
    order: 10,
  },
  "ig_industrialists:ig_trait_engines_of_progress|ig_trait_job_creators|ig_trait_tax_avoidance:ideology_colonialist|ideology_individualist|ideology_plutocratic": {
    name: "interestGroup.variant.industrialists.colonialCompanies",
    order: 70,
  },
  "ig_industrialists:ig_trait_job_creators|ig_trait_tax_avoidance|ig_trait_the_goods_must_flow:ideology_individualist|ideology_laissez_faire|ideology_plutocratic": {
    name: "interestGroup.variant.industrialists.brazil",
    order: 80,
  },
  "ig_industrialists:ig_trait_engines_of_progress|ig_trait_tax_avoidance|ig_trait_ventilate_unify_beautify:ideology_individualist|ideology_laissez_faire|ideology_plutocratic": {
    name: "interestGroup.variant.industrialists.france",
    order: 90,
  },
  "ig_industrialists:ig_trait_engines_of_progress|ig_trait_kommerskollegium|ig_trait_tax_avoidance:ideology_individualist|ideology_laissez_faire|ideology_plutocratic": {
    name: "interestGroup.variant.industrialists.sweden",
    order: 100,
  },
  "ig_rural_folk:ig_trait_nucleos_coloniais|ig_trait_old_ways|ig_trait_plantation_work:ideology_agrarian|ideology_isolationist|ideology_particularist": {
    name: "interestGroup.variant.ruralFolk.brazil",
    order: 30,
  },
  "ig_rural_folk:ig_trait_honest_work|ig_trait_obshchina|ig_trait_old_ways:ideology_agrarian|ideology_isolationist|ideology_particularist": {
    name: "interestGroup.variant.ruralFolk.russia",
    order: 40,
  },
  "ig_petty_bourgeoisie:ig_trait_effendi|ig_trait_treasury_bonds|ig_trait_xenophobia:ideology_meritocratic|ideology_patriotic|ideology_reactionary": {
    name: "interestGroup.variant.pettyBourgeoisie.egypt",
    order: 60,
  },
  "ig_petty_bourgeoisie:ig_trait_haute_finance|ig_trait_master_of_the_house|ig_trait_xenophobia:ideology_meritocratic|ideology_patriotic|ideology_reactionary": {
    name: "interestGroup.variant.pettyBourgeoisie.france",
    order: 70,
  },
  "ig_petty_bourgeoisie:ig_trait_bah_humbug|ig_trait_civil_service|ig_trait_old_lady_of_threadneedle_street:ideology_meritocratic|ideology_patriotic|ideology_reactionary": {
    name: "interestGroup.variant.pettyBourgeoisie.greatBritain",
    order: 80,
  },
  "ig_petty_bourgeoisie:ig_trait_middle_managers|ig_trait_treasury_bonds|ig_trait_xenophobia:ideology_cartist|ideology_patriotic|ideology_reactionary": {
    name: "interestGroup.variant.pettyBourgeoisie.portugal",
    order: 90,
  },
  "ig_petty_bourgeoisie:ig_trait_bergsbrukens_valdistrikten|ig_trait_treasury_bonds|ig_trait_xenophobia:ideology_meritocratic|ideology_patriotic|ideology_reactionary": {
    name: "interestGroup.variant.pettyBourgeoisie.sweden",
    order: 100,
  },
  "ig_petty_bourgeoisie:ig_trait_effendi|ig_trait_reorganization|ig_trait_xenophobia:ideology_meritocratic|ideology_patriotic|ideology_reactionary": {
    name: "interestGroup.variant.pettyBourgeoisie.turkey",
    order: 110,
  },
  "ig_intelligentsia:ig_trait_avant_garde|ig_trait_bachareis|ig_trait_brasilidade|ig_trait_propagandists|ig_trait_social_criticism:ideology_anti_clerical|ideology_anti_slavery|ideology_constitutionalist|ideology_liberal": {
    name: "interestGroup.variant.intelligentsia.brazil",
    order: 50,
  },
  "ig_intelligentsia:ig_trait_avant_garde|ig_trait_les_beaux_arts|ig_trait_social_criticism:ideology_anti_clerical|ideology_anti_slavery|ideology_liberal|ideology_republican": {
    name: "interestGroup.variant.intelligentsia.france",
    order: 60,
  },
  "ig_intelligentsia:ig_trait_avant_garde|ig_trait_propagandists|ig_trait_social_criticism:ideology_anti_slavery|ideology_liberal|ideology_republican": {
    name: "interestGroup.variant.intelligentsia.rome",
    order: 70,
  },
  "ig_intelligentsia:ig_trait_avant_garde|ig_trait_crisis_of_identity|ig_trait_propagandists:ideology_anti_clerical|ideology_anti_slavery|ideology_liberal|ideology_republican": {
    name: "interestGroup.variant.intelligentsia.russiaTurkey",
    order: 80,
  },
};

function interestGroupCountryVariantKey(groupKey, traits, ideologies) {
  return `${groupKey}:${interestGroupTraitSignature(traits)}:${interestGroupIdeologySignature(ideologies)}`;
}

const interestGroupDevoutReligionOrder = [
  "oriental_orthodox", "orthodox", "catholic", "protestant", "sunni", "shiite", "ibadi", "jewish",
  "mahayana", "gelugpa", "theravada", "hindu", "confucian", "shinto", "animist", "sikh",
];

const interestGroupDevoutReligion = {
  jewish: "jewish", animist: "animist",
  ig_oriental_orthodox_church: "oriental_orthodox", ig_orthodox_church: "orthodox",
  ig_catholic_church: "catholic", ig_roman_curia: "catholic",
  ig_anglican_church: "protestant", ig_church_of_denmark: "protestant", ig_church_of_norway: "protestant",
  ig_church_of_finland: "protestant", ig_church_of_sweden: "protestant", ig_evangelicals: "protestant",
  ig_evangelical_church: "protestant", ig_christian_missionaries: "protestant", ig_london_missionary_society: "protestant",
  ig_taiping_god_worshippers: "protestant", ig_sunni_madrasahs: "sunni", ig_sunni_madrasahs_turkey: "sunni",
  ig_shia_madrasahs: "shiite", ig_ibadi_madrasahs: "ibadi", ig_hindu_priesthood: "hindu", ig_confucian: "confucian",
  ig_shinto_monks: "shinto", ig_jisha: "mahayana", ig_theravada_monks: "theravada", ig_vajrayana_monks: "gelugpa",
  ig_granthis: "sikh",
};

const interestGroupDevoutReligionNames = {
  oriental_orthodox: "东方正统教会", orthodox: "东正教", catholic: "天主教", protestant: "新教", sunni: "逊尼派",
  shiite: "什叶派", ibadi: "伊巴德派", jewish: "犹太教", mahayana: "大乘佛教", gelugpa: "格鲁派",
  theravada: "上座部佛教", hindu: "印度教", confucian: "儒教", shinto: "神道教", animist: "泛灵论", sikh: "锡克教",
};

function interestGroupDevoutReligionName(key) {
  return t(`religion.name.${key}`, interestGroupDevoutReligionNames[key] || key);
}

const interestGroupDevoutReligionIcon = {
  oriental_orthodox: "coptic", orthodox: "orthodox", catholic: "catholic", protestant: "protestant", sunni: "sunni",
  shiite: "shiite", ibadi: "ibadi", jewish: "jewish", mahayana: "mahayana", gelugpa: "gelugpa", theravada: "theravada",
  hindu: "hindu", confucian: "confucianism", shinto: "shinto", animist: "animist", sikh: "sikh", atheist: "atheist",
};

const interestGroupDevoutReligionGroups = [
  { key: "christian", nameKey: "religion.heritage.christian", religions: ["oriental_orthodox", "orthodox", "catholic", "protestant"] },
  { key: "islamic", nameKey: "religion.heritage.islamic", religions: ["sunni", "shiite", "ibadi"] },
  { key: "jewish", nameKey: "religion.heritage.jewish", religions: ["jewish"] },
  { key: "dharmic", nameKey: "religion.heritage.dharmic", religions: ["mahayana", "gelugpa", "theravada", "hindu", "sikh"] },
  { key: "taoic", nameKey: "religion.heritage.taoic", religions: ["confucian", "shinto"] },
  { key: "indigenous", nameKey: "religion.heritage.indigenous", religions: ["animist"] },
];

const interestGroupDevoutReligionParentGroups = [
  { key: "abrahamic", nameKey: "religion.group.abrahamic", groups: ["christian", "islamic", "jewish"] },
  { key: "eastern", nameKey: "religion.group.eastern", groups: ["dharmic", "taoic"] },
  { key: "naturalistic", nameKey: "religion.group.naturalistic", groups: ["indigenous"] },
];

function interestGroupDevoutReligionIconHtml(religion) {
  const icon = interestGroupDevoutReligionIcon[religion];
  if (!icon) return "";
  return `<img class="interest-group-devout-religion-icon" src="assets/event-icons/religion_icons/${escapeHtml(icon)}.webp" alt="" aria-hidden="true">`;
}

function interestGroupDevoutReligionLegendHtml(optionGroups) {
  const flavorsByReligion = new Map(optionGroups
    .filter((entry) => entry.key.startsWith("religion:"))
    .map((entry) => [entry.key.slice("religion:".length), entry.flavors]));
  const groupsByKey = new Map(interestGroupDevoutReligionGroups.map((group) => [group.key, group]));
  const parents = interestGroupDevoutReligionParentGroups.map((parent) => ({
    ...parent,
    groups: parent.groups.map((key) => groupsByKey.get(key)).filter((group) => group?.religions.some((religion) => flavorsByReligion.has(religion))),
  })).filter((parent) => parent.groups.length);
  if (!parents.length) return "";
  return `
    <div class="interest-group-devout-religion-legend" aria-label="虔信者宗教分类">
      ${parents.map((parent) => `
        <section class="interest-group-devout-religion-parent-group interest-group-devout-religion-parent-group--${escapeHtml(parent.key)}">
          <h3 class="interest-group-devout-religion-parent-title">${escapeHtml(t(parent.nameKey))}</h3>
          ${parent.groups.map((group) => `
            <section class="interest-group-devout-religion-group interest-group-devout-religion-group--${escapeHtml(group.key)}">
              <h4 class="interest-group-devout-religion-group-title">${escapeHtml(t(group.nameKey))}</h4>
              <div class="interest-group-devout-religion-group-rows">
                ${group.religions.filter((religion) => flavorsByReligion.has(religion)).map((religion) => `
                  <div class="interest-group-devout-religion-row">
                    <div class="interest-group-devout-religion-name">${interestGroupDevoutReligionIconHtml(religion)}<span>${escapeHtml(interestGroupDevoutReligionName(religion))}</span></div>
                    <div class="interest-group-devout-religion-flavors">${(flavorsByReligion.get(religion) || []).map((flavor) => interestGroupFlavorLinkHtml({ key: "ig_devout" }, flavor)).join(t("interestGroup.flavorSeparator", " / "))}</div>
                  </div>
                `).join("")}
              </div>
            </section>
          `).join("")}
        </section>
      `).join("")}
    </div>
  `;
}

function interestGroupFlavorCategory(groupKey, variant) {
  if (groupKey === "ig_devout" && interestGroupDevoutReligion[variant.key]) return "religion";
  if (variant.isConditionVariant) return "condition";
  if (variant.isTraitOnly) return "country";
  if (interestGroupUsesScriptedRenameCategory() && interestGroupIsScriptedRename(variant)) return "scripted";
  if (groupKey === "ig_devout") return interestGroupDevoutReligion[variant.key] ? "religion" : "named";
  return "named";
}

function interestGroupIsScriptedRename(variant) {
  const ruleFiles = (variant.rules || []).map((rule) => String(rule.source_file || "").replaceAll("\\", "/"));
  return ruleFiles.some((file) => !file.includes("/common/interest_groups/"))
    && !ruleFiles.some((file) => file.includes("/common/interest_groups/"));
}

function interestGroupUsesScriptedRenameCategory() {
  return data?.meta?.dataset_name === "Victorian Century";
}

function interestGroupFlavorOrder(groupKey, variant) {
  if (groupKey === "ig_devout") {
    const religion = interestGroupDevoutReligion[variant.key] || "";
    const religionOrder = interestGroupDevoutReligionOrder.indexOf(religion);
    return religionOrder < 0 ? Number.MAX_SAFE_INTEGER : religionOrder;
  }
  if (variant.isConditionVariant) return interestGroupConditionFlavorDefinition[`${groupKey}:${variant.key}`]?.order || Number.MAX_SAFE_INTEGER;
  if (variant.isTraitOnly) return interestGroupCountryVariantDefinition[variant.definitionKey]?.order || Number.MAX_SAFE_INTEGER;
  return Number.MAX_SAFE_INTEGER;
}

function interestGroupVariants(group) {
  const groupKey = group?.key || "";
  const baseTraitSignature = interestGroupTraitSignature(group?.base_traits);
  const baseIdeologySignature = interestGroupIdeologySignature(group?.ideologies);
  const variants = new Map();
  const ensureVariant = (source) => {
    const key = source?.key || "";
    if (!key) return null;
    const variant = variants.get(key) || {
      key,
      name: entityText(source),
      countries: new Set(),
      rules: new Map(),
      traits: new Map(),
      ideologies: new Map(),
      isPotential: false,
      isTraitOnly: false,
      isConditionVariant: false,
      hasCompleteTraits: false,
    };
    variants.set(key, variant);
    return variant;
  };
  const conditionVariantsBySignature = new Map();
  for (const conditionVariant of group?.condition_variants || []) {
    const variant = ensureVariant(conditionVariant);
    if (!variant) continue;
    variant.isConditionVariant = true;
    variant.name = interestGroupConditionFlavorDefinition[`${groupKey}:${conditionVariant.key}`]?.name
      || variant.name
      || conditionVariant.key;
    const rule = {
      condition_summary_zh: conditionVariant.condition_summary_zh || "",
      condition_raw: conditionVariant.condition_raw || "",
      source_file: group.source_file || "",
      names: [],
      traits: conditionVariant.traits || [],
      added_ideologies: conditionVariant.added_ideologies || [],
      removed_ideologies: conditionVariant.removed_ideologies || [],
    };
    variant.rules.set(interestGroupRuleSignature(rule), rule);
    for (const trait of conditionVariant.traits || []) {
      if (!trait?.key) continue;
      variant.traits.set(trait.key, { trait, countries: new Set() });
    }
    const signature = interestGroupConditionSignature(conditionVariant.condition_raw);
    if (signature) conditionVariantsBySignature.set(signature, variant);
  }
  for (const country of countries || []) {
    for (const group of country.interestGroups || []) {
      const display = group.display_name;
      if (group.key !== groupKey) continue;
      const activeTraits = group.active_traits || [];
      const activeIdeologies = group.active_ideologies || [];
      const appliedRules = group.applied_rules || [];
      const matchedConditionVariants = new Set(appliedRules
        .map((rule) => conditionVariantsBySignature.get(interestGroupConditionSignature(rule.condition_raw)))
        .filter(Boolean));
      const hasOtherExplicitRule = appliedRules.some((rule) => {
        const signature = interestGroupConditionSignature(rule.condition_raw);
        return signature && signature !== "else" && !conditionVariantsBySignature.has(signature);
      });
      for (const variant of matchedConditionVariants) variant.countries.add(country.tag);
      const definitionKey = interestGroupCountryVariantKey(groupKey, activeTraits, activeIdeologies);
      const definition = interestGroupCountryVariantDefinition[definitionKey];
      const conditionVariant = definition?.conditionVariant && variants.get(definition.conditionVariant);
      if (conditionVariant) {
        conditionVariant.countries.add(country.tag);
        continue;
      }
      if (!display?.is_flavored && matchedConditionVariants.size && !hasOtherExplicitRule) {
        continue;
      }
      const isTraitOnly = !display?.is_flavored && interestGroupTraitSignature(activeTraits) !== baseTraitSignature;
      const isIdeologyOnly = !display?.is_flavored
        && !isTraitOnly
        && interestGroupIdeologySignature(activeIdeologies) !== baseIdeologySignature;
      if (!display?.is_flavored && !isTraitOnly && !isIdeologyOnly) continue;
      const isTurkeySunni = groupKey === "ig_devout"
        && country.tag === "TUR"
        && display?.key === "ig_sunni_madrasahs";
      const displaySource = isTurkeySunni ? { ...display, key: "ig_sunni_madrasahs_turkey", name: "逊尼派乌理玛（土耳其）" } : display;
      const variant = ensureVariant(displaySource?.is_flavored
        ? displaySource
        : {
          key: `country-variant:${interestGroupCountryVariantKey(groupKey, activeTraits, activeIdeologies)}`,
          name: "",
        });
      if (!variant) continue;
      if (isTurkeySunni) variant.name = "逊尼派乌理玛（土耳其）";
      variant.isTraitOnly ||= isTraitOnly || isIdeologyOnly;
      variant.definitionKey ||= definitionKey;
      if (definition?.replacesConditionVariant) variants.delete(definition.replacesConditionVariant);
      variant.hasCompleteTraits = true;
      variant.countries.add(country.tag);
      for (const rule of appliedRules) variant.rules.set(interestGroupRuleSignature(rule), rule);
      for (const trait of activeTraits) {
        if (!trait?.key) continue;
        const traitUse = variant.traits.get(trait.key) || { trait, countries: new Set() };
        traitUse.countries.add(country.tag);
        variant.traits.set(trait.key, traitUse);
      }
      for (const ideology of activeIdeologies) {
        if (ideology?.key) variant.ideologies.set(ideology.key, ideology);
      }
    }
  }
  applyArmedForcesConditionFlavorGrouping(groupKey, variants);
  for (const flavor of group?.potential_flavors || []) {
    const variant = ensureVariant(flavor);
    if (!variant) continue;
    variant.isPotential = true;
    variant.countryTags = [...new Set([...(variant.countryTags || []), ...(flavor.country_tags || [])])];
    for (const rule of flavor.rules || []) variant.rules.set(interestGroupRuleSignature(rule), rule);
    for (const trait of flavor.traits || []) {
      if (!trait?.key) continue;
      const traitUse = variant.traits.get(trait.key) || { trait, countries: new Set() };
      variant.traits.set(trait.key, traitUse);
    }
  }
  return [...variants.values()]
    .map((variant) => ({
      ...variant,
      countries: interestGroupCountryTags(variant.countries),
      rules: [...variant.rules.values()],
      ideologies: [...variant.ideologies.values()],
      traits: [...variant.traits.values()].map((traitUse) => ({
        ...traitUse,
        countries: interestGroupCountryTags(traitUse.countries),
      })),
    }))
    .map((variant) => ({
      ...variant,
      name: variant.isConditionVariant && groupKey !== "ig_devout"
        ? (interestGroupConditionFlavorDefinition[`${groupKey}:${variant.key}`]?.name || variant.name || variant.key)
        : variant.isTraitOnly
        ? (interestGroupCountryVariantDefinition[variant.definitionKey]?.name
          ? t(interestGroupCountryVariantDefinition[variant.definitionKey].name)
          : variant.countries.length === 1
            ? t("interestGroup.singleCountryTraitVariant", {
              group: entityText(group) || groupKey,
              country: entityText(byTag.get(variant.countries[0]) || { tag: variant.countries[0] }) || variant.countries[0],
            })
            : `${countryRefLabel(byTag.get(variant.countries[0]) || { tag: variant.countries[0] })}${t("interestGroup.traitFlavor")}`)
        : (variant.name || variant.key),
    }))
    .sort((left, right) => (
      interestGroupFlavorOrder(groupKey, left) - interestGroupFlavorOrder(groupKey, right)
      || localizedCompare(left.name || left.key, right.name || right.key)
    ));
}

function interestGroupCountryTags(tags) {
  return [...new Set(tags || [])]
    .filter(Boolean)
    .sort((left, right) => {
      const leftCountry = byTag.get(left) || { tag: left };
      const rightCountry = byTag.get(right) || { tag: right };
      return (
        orderValueByList(tierOrder, leftCountry.tier) - orderValueByList(tierOrder, rightCountry.tier)
        || localizedCompare(entityText(leftCountry) || left, entityText(rightCountry) || right)
        || left.localeCompare(right)
      );
    });
}

function interestGroupCountryList(tags) {
  const countryTags = interestGroupCountryTags(tags);
  if (!countryTags.length) return `<span class="interest-group-country-empty">${escapeHtml(t("interestGroup.noStartingCountries"))}</span>`;
  return `
    <div class="interest-group-country-list">
      <div class="interest-group-country-tags">${countryLinks(countryTags)}</div>
    </div>
  `;
}

const interestGroupTraitSlotDefinitions = [
  { key: "unhappy", minimum: "", maximum: "unhappy" },
  { key: "happy", minimum: "happy", maximum: "" },
  { key: "loyal", minimum: "loyal", maximum: "" },
];

function interestGroupTraitSlotKey(trait) {
  if (trait?.max_approval === "unhappy") return "unhappy";
  if (trait?.min_approval === "happy") return "happy";
  if (trait?.min_approval === "loyal") return "loyal";
  return "";
}

function interestGroupTraitSlots(traits) {
  const slots = new Map(interestGroupTraitSlotDefinitions.map((slot) => [slot.key, {
    ...slot,
    traits: [],
  }]));
  for (const trait of traits || []) {
    const slotKey = interestGroupTraitSlotKey(trait);
    const slot = slots.get(slotKey);
    if (!slot || !trait?.key) return;
    slot.traits.push(trait);
  }
  return interestGroupTraitSlotDefinitions.map((definition) => {
    const slot = slots.get(definition.key);
    const trait = slot.traits
      .slice()
      .sort((left, right) => localizedCompare(entityText(left), entityText(right)))[0] || null;
    return { ...definition, trait };
  });
}

function interestGroupTraitSlotHtml(slot) {
  return `
    <section class="interest-group-trait-slot is-${escapeHtml(slot.key)}" data-interest-group-trait-slot="${escapeHtml(slot.key)}" data-interest-group-approval-order="${interestGroupTraitApprovalOrder(slot.key)}" aria-label="${escapeHtml(t(`interestGroup.approval.${slot.key}`))}">
      ${slot.trait ? interestGroupTraitDetailCard(slot.trait, false) : `<p class="empty compact">${escapeHtml(t("interestGroup.noTraitForSlot"))}</p>`}
    </section>
  `;
}

function interestGroupTraitSlotListHtml(traits) {
  return `<div class="interest-group-trait-slot-list">${interestGroupTraitSlots(traits).map(interestGroupTraitSlotHtml).join("")}</div>`;
}

function interestGroupTraitApprovalOrder(slotKey) {
  return { unhappy: 1, happy: 2, loyal: 3 }[slotKey] || 99;
}

function interestGroupFlavorOptions(group, variants) {
  const traitSetForVariant = (variant) => {
    const traitsBySlot = new Map();
    for (const trait of group.base_traits || []) {
      const slotKey = interestGroupTraitSlotKey(trait);
      if (slotKey && !traitsBySlot.has(slotKey)) traitsBySlot.set(slotKey, trait);
    }
    for (const traitUse of variant.traits || []) {
      const slotKey = interestGroupTraitSlotKey(traitUse.trait);
      if (slotKey && traitUse.trait) traitsBySlot.set(slotKey, traitUse.trait);
    }
    return interestGroupTraitSlotDefinitions.map((slot) => traitsBySlot.get(slot.key)).filter(Boolean);
  };
  return [
    {
      key: "base",
      name: t("interestGroup.baseTraitOption"),
      traits: group.base_traits || [],
      countries: [],
      rules: [],
      ideologies: group.ideologies || [],
      category: "base",
      isBase: true,
    },
    ...(variants || []).map((variant) => ({
      key: variant.key,
      name: variant.name || variant.key,
      traits: traitSetForVariant(variant),
      countries: variant.countries || [],
      rules: variant.rules || [],
      ideologies: variant.ideologies || [],
      isTraitOnly: Boolean(variant.isTraitOnly),
      isConditionVariant: Boolean(variant.isConditionVariant),
      isPotential: Boolean(variant.isPotential),
      category: interestGroupFlavorCategory(group.key, variant),
      religion: group.key === "ig_devout" ? interestGroupDevoutReligion[variant.key] || "" : "",
      isBase: false,
    })),
  ];
}

function interestGroupFlavorGroupLabel(key) {
  if (key.startsWith("religion:")) return interestGroupDevoutReligionName(key.slice("religion:".length));
  if (key === "country") return t("interestGroup.specialCountryVariants");
  if (key === "condition") return t("interestGroup.conditionVariants");
  if (key === "scripted") return t("interestGroup.scriptedVariants");
  return t("interestGroup.namedVariants");
}

function interestGroupFlavorOptionGroups(flavors) {
  const groupOrder = ["named", "condition", "country"];
  const groups = new Map();
  for (const flavor of flavors.filter((item) => !item.isBase)) {
    const key = flavor.category === "religion"
      ? `religion:${flavor.religion}`
      : flavor.category === "scripted" ? "named" : flavor.category;
    const entry = groups.get(key) || { key, flavors: [] };
    entry.flavors.push(flavor);
    groups.set(key, entry);
  }
  return [...groups.values()]
    .map((entry) => ({
      ...entry,
      order: entry.key.startsWith("religion:")
        ? interestGroupDevoutReligionOrder.indexOf(entry.key.slice("religion:".length))
        : interestGroupDevoutReligionOrder.length + groupOrder.indexOf(entry.key),
    }))
    .sort((left, right) => left.order - right.order || localizedCompare(left.key, right.key));
}

function interestGroupFlavorIdeologies(group, flavor) {
  if (flavor.ideologies?.length) return flavor.ideologies;
  const ideologies = new Map((group.ideologies || []).filter((item) => item?.key).map((item) => [item.key, item]));
  for (const rule of flavor.rules || []) {
    for (const ideology of rule.removed_ideologies || []) ideologies.delete(ideology?.key);
    for (const ideology of rule.added_ideologies || []) {
      if (ideology?.key) ideologies.set(ideology.key, ideology);
    }
  }
  return [...ideologies.values()];
}

function interestGroupFlavorSourceText(flavor) {
  if (flavor.isBase) return t("interestGroup.baseFlavorDescription");
  if (flavor.category === "country") return t("interestGroup.countryTraitFlavorDescription");
  if (flavor.category === "condition") return t("interestGroup.conditionFlavorDescription");
  if (flavor.category === "scripted") return t("interestGroup.scriptedVariants");
  if (flavor.isPotential) return t("interestGroup.postStartFlavorDescription");
  return t("interestGroup.namedFlavorDescription");
}

function interestGroupIdeologySummaryHtml(group, ideologies) {
  return `
    <div class="interest-group-ideology-summary">
      ${ideologyPills(ideologies, "tag-ideology")}
      ${ideologyPills(group.character_ideologies, "tag-tradition")}
    </div>
  `;
}

function interestGroupFlavorStateHtml(group, flavor, active) {
  const ideologies = interestGroupFlavorIdeologies(group, flavor);
  return `
    <section class="interest-group-flavor-state" data-interest-group-flavor-state="${escapeHtml(flavor.key)}"${active ? "" : " hidden"}>
      <div class="interest-group-flavor-context" data-interest-group-flavor-source>
        <div class="interest-group-flavor-context-heading">
          <strong>${escapeHtml(flavor.name)}</strong>
          <span>${escapeHtml(interestGroupFlavorSourceText(flavor))}</span>
        </div>
        ${flavor.isBase ? "" : `
          <div class="interest-group-flavor-context-meta">
            ${interestGroupCountryList(flavor.countries)}
            ${interestGroupRuleDetails(flavor.rules)}
          </div>
        `}
      </div>
      ${interestGroupTraitSlotListHtml(flavor.traits)}
      <div class="interest-group-selected-information">
        ${interestGroupIdeologySummaryHtml(group, ideologies)}
      </div>
      ${interestGroupPopulationAttractionHtml(group.pop_attraction)}
    </section>
  `;
}

function interestGroupFlavorSelectorHtml(group, variants) {
  const flavors = interestGroupFlavorOptions(group, variants);
  const baseFlavor = flavors.find((flavor) => flavor.isBase);
  const optionGroups = interestGroupFlavorOptionGroups(flavors);
  return `
    <div class="interest-group-flavor-selector">
      ${group.key === "ig_devout" ? interestGroupDevoutReligionLegendHtml(optionGroups) : ""}
      <label>
        <span>${escapeHtml(t("interestGroup.traitFlavor"))}</span>
        <select data-interest-group-flavor-select data-interest-group-flavor-page aria-label="${escapeHtml(t("interestGroup.traitFlavor"))}">
          <option value="${escapeHtml(baseFlavor.key)}">${escapeHtml(baseFlavor.name)}</option>
          ${optionGroups.map((entry) => `
            <optgroup label="${escapeHtml(interestGroupFlavorGroupLabel(entry.key))}">
              ${entry.flavors.map((flavor) => `<option value="${escapeHtml(flavor.key)}">${escapeHtml(flavor.name)}</option>`).join("")}
            </optgroup>
          `).join("")}
        </select>
      </label>
    </div>
    <div class="interest-group-flavor-states">
      ${flavors.map((flavor, index) => interestGroupFlavorStateHtml(group, flavor, index === 0)).join("")}
    </div>
  `;
}

function bindInterestGroupFlavorPageLinks(container, group) {
  container.querySelectorAll("[data-interest-group-flavor-page]").forEach((selector) => {
    selector.addEventListener("change", () => {
      if (!selector.value || selector.value === "base") return;
      location.hash = interestGroupFlavorRoute(group.key, selector.value);
    });
  });
}

function interestGroupFlavorRoute(groupKey, flavorKey) {
  return `/interest-group/${encodeURIComponent(groupKey)}/flavor/${encodeURIComponent(flavorKey)}`;
}

function interestGroupFlavorLinkHtml(group, flavor) {
  return `<a href="#${interestGroupFlavorRoute(group.key, flavor.key)}">${escapeHtml(flavor.name || flavor.key)}</a>`;
}

function interestGroupFlavorHeadingHtml(group, flavor) {
  return `${escapeHtml(flavor.name || flavor.key)}<span class="interest-group-detail-flavor-names">（<a class="interest-group-flavor-parent" href="#/interest-group/${encodeURIComponent(group.key)}">${escapeHtml(entityText(group))}</a>）</span>`;
}

function interestGroupFlavorLinkRowsHtml(group, variants) {
  const named = variants.filter((variant) => !variant.isTraitOnly && !variant.isConditionVariant);
  const condition = variants.filter((variant) => variant.isConditionVariant);
  const country = variants.filter((variant) => variant.isTraitOnly);
  const row = (category, items) => items.length ? `
    <section class="interest-group-flavor-link-row interest-group-flavor-link-row--${escapeHtml(category)}">
      <h3>${escapeHtml(interestGroupFlavorGroupLabel(category))}</h3>
      <div>${items.map((flavor) => interestGroupFlavorLinkHtml(group, flavor)).join(t("interestGroup.flavorSeparator", " / "))}</div>
    </section>
  ` : "";
  return {
    heading: named.length ? `<span class="interest-group-detail-flavor-names">（${named.map((flavor) => interestGroupFlavorLinkHtml(group, flavor)).join(t("interestGroup.flavorSeparator", " / "))}）</span>` : "",
    rows: `${row("condition", condition)}${row("country", country)}`,
  };
}

function renderInterestGroupFlavorBoardDetail(group, flavor) {
  const flavorOption = interestGroupFlavorOptions(group, [flavor]).find((option) => option.key === flavor.key);
  const flavorTraits = flavorOption?.traits || group.base_traits || [];
  const ideologies = interestGroupFlavorIdeologies(group, flavor);
  return `
    <section class="interest-group-board-shell interest-group-board-detail interest-group-flavor-page" style="${escapeHtml(interestGroupBoardColorStyle(group))}">
      <a class="detail-back-button" href="#/interest-group/${encodeURIComponent(group.key)}" aria-label="${escapeHtml(t("ui.back"))}" title="${escapeHtml(t("ui.back"))}"><img class="lucide-icon" src="assets/lucide/icons/arrow-left.svg" alt="" aria-hidden="true"></a>
      <header class="interest-group-detail-heading">
        ${interestGroupIconHtml(group, "interest-group-detail-icon")}
        <div>
          <h2>${interestGroupFlavorHeadingHtml(group, flavor)}</h2>
          <p class="minor">${escapeHtml(flavor.key)}</p>
          <p class="interest-group-detail-description">${escapeHtml(cleanDescriptionText(entityText(group, "description", "")))}</p>
        </div>
      </header>
      <section class="interest-group-detail-section interest-group-trait-section">
        <div class="interest-group-detail-section-heading"><h2>${escapeHtml(t("interestGroup.traits"))}</h2></div>
        ${interestGroupTraitSlotListHtml(flavorTraits)}
      </section>
      <section class="interest-group-detail-section">
        <div class="interest-group-detail-section-heading"><h2>${escapeHtml(t("interestGroup.applicableCountries"))}</h2></div>
        ${interestGroupCountryList(flavor.countries)}
      </section>
      ${flavor.rules.length ? `
        <section class="interest-group-detail-section">
          <div class="interest-group-detail-section-heading"><h2>${escapeHtml(t("interestGroup.triggerRules"))}</h2></div>
          ${interestGroupRuleDetails(flavor.rules)}
        </section>
      ` : ""}
      <section class="interest-group-detail-section">
        <div class="interest-group-detail-section-heading"><h2>${escapeHtml(t("interestGroup.ideologies"))}</h2></div>
        ${interestGroupIdeologySummaryHtml(group, ideologies)}
      </section>
      ${interestGroupPopulationAttractionHtml(group.pop_attraction)}
    </section>
  `;
}

function interestGroupPopulationValue(entry) {
  const value = String(entry?.value_raw || "");
  const multiplier = String(entry?.multiplier_raw || "");
  const dynamic = value === "literacy_rate"
    ? t("interestGroup.populationValue.literacyRate")
    : value === "standard_of_living" || value === "this.standard_of_living"
      ? t("interestGroup.populationValue.standardOfLiving")
      : value;
  if (!multiplier) return dynamic;
  return t("interestGroup.populationValue.multiplied", { value: dynamic, multiplier });
}

function interestGroupPopulationAttractionHtml(entries) {
  const grouped = new Map();
  for (const entry of entries || []) {
    const row = grouped.get(entry.label_key) || { ...entry, entries: [] };
    row.entries.push(entry);
    grouped.set(entry.label_key, row);
  }
  return `
    <details class="interest-group-population-disclosure">
      <summary><span>${escapeHtml(t("interestGroup.populationAttraction"))}</span><small>${escapeHtml(t("interestGroup.populationAttractionHint"))}</small></summary>
      <div class="interest-group-pop-attraction-list">
      ${[...grouped.values()].map((row) => `
        <section class="interest-group-pop-attraction">
          <h3>${escapeHtml(entityText(row, "label", row.label_key))}</h3>
          <ul class="interest-group-pop-attraction-entries">
            ${row.entries.map((entry) => `
              <li class="interest-group-pop-attraction-entry${entry.is_otherwise ? " is-otherwise" : ""}">
                <strong>${escapeHtml(interestGroupPopulationValue(entry))}</strong>
                ${interestGroupPopulationConditionHtml(entry)}
              </li>
            `).join("")}
          </ul>
        </section>
      `).join("") || `<p class="empty compact">${escapeHtml(t("interestGroup.noPopulationAttraction"))}</p>`}
      </div>
    </details>
  `;
}

function interestGroupPopulationConditionHtml(entry) {
  const parts = [];
  const named = (items, label, negativeLabel) => {
    const positive = (items || []).filter((item) => !item.negated).map((item) => entityText(item)).filter(Boolean);
    const negative = (items || []).filter((item) => item.negated).map((item) => entityText(item)).filter(Boolean);
    if (positive.length) parts.push(`${label}${t("ui.colon", "：")}${positive.join(t("ui.listSeparator", "、"))}`);
    if (negative.length) parts.push(`${negativeLabel}${t("ui.colon", "：")}${negative.join(t("ui.listSeparator", "、"))}`);
  };
  named(entry.pop_types, t("interestGroup.conditionPopulation"), t("interestGroup.conditionNotPopulation"));
  named(entry.employment_building_groups, t("interestGroup.conditionEmployment"), t("interestGroup.conditionNotEmployment"));
  const summary = entityText(entry, "conditionSummary", "");
  if (summary) parts.push(summary);
  if (entry.is_otherwise) parts.push(t("interestGroup.otherwise"));
  const lines = parts.length ? parts : [t("interestGroup.noExtraConditions")];
  return `<p>${lines.map((part) => escapeHtml(part)).join("<br>")}</p>`;
}

function bindInterestGroupFlavorSelector(container) {
  container.querySelectorAll("[data-interest-group-flavor-select]").forEach((selector) => {
    selector.addEventListener("change", () => {
      const section = selector.closest(".interest-group-trait-section");
      if (!section) return;
      section.querySelectorAll("[data-interest-group-flavor-state]").forEach((state) => {
        state.hidden = state.dataset.interestGroupFlavorState !== selector.value;
      });
    });
  });
}

function renderInterestGroupBoardDetail(group) {
  const variants = interestGroupVariants(group);
  const flavorLinks = interestGroupFlavorLinkRowsHtml(group, variants);
  if (group.key === "ig_devout") {
    const optionGroups = interestGroupFlavorOptionGroups(interestGroupFlavorOptions(group, variants));
    return `
      <section class="interest-group-board-shell interest-group-board-detail interest-group-devout-navigation" style="${escapeHtml(interestGroupBoardColorStyle(group))}">
        <a class="detail-back-button" href="#/interest-group" aria-label="${escapeHtml(t("ui.back"))}" title="${escapeHtml(t("ui.back"))}"><img class="lucide-icon" src="assets/lucide/icons/arrow-left.svg" alt="" aria-hidden="true"></a>
        <header class="interest-group-detail-heading">
          ${interestGroupIconHtml(group, "interest-group-detail-icon")}
          <div>
            <h2>${escapeHtml(entityText(group))}</h2>
            <p class="minor">${escapeHtml(group.key)}</p>
            <p class="interest-group-detail-description">${escapeHtml(cleanDescriptionText(entityText(group, "description", "")))}</p>
          </div>
        </header>
        <section class="interest-group-devout-navigation-panel">
          ${interestGroupDevoutReligionLegendHtml(optionGroups)}
        </section>
      </section>
    `;
  }
  return `
    <section class="interest-group-board-shell interest-group-board-detail" style="${escapeHtml(interestGroupBoardColorStyle(group))}">
      <a class="detail-back-button" href="#/interest-group" aria-label="${escapeHtml(t("ui.back"))}" title="${escapeHtml(t("ui.back"))}"><img class="lucide-icon" src="assets/lucide/icons/arrow-left.svg" alt="" aria-hidden="true"></a>
      <header class="interest-group-detail-heading">
        ${interestGroupIconHtml(group, "interest-group-detail-icon")}
        <div>
          <h2>${escapeHtml(entityText(group))}${group.key === "ig_devout" ? "" : flavorLinks.heading}</h2>
          <p class="minor">${escapeHtml(group.key)}</p>
          <p class="interest-group-detail-description">${escapeHtml(cleanDescriptionText(entityText(group, "description", "")))}</p>
        </div>
      </header>
      ${flavorLinks.rows}
      <section class="interest-group-detail-section interest-group-trait-section">
        <div class="interest-group-detail-section-heading"><h2>${escapeHtml(t("interestGroup.traits"))}</h2></div>
        ${interestGroupFlavorSelectorHtml(group, variants)}
      </section>
    </section>
  `;
}

function renderInterestGroupBoard() {
  mapRuntime.filteredCountryTags = new Set();
  const groups = interestGroupBoardOrder.map((key) => byInterestGroup.get(key)).filter(Boolean);
  const selected = byInterestGroup.get(state.selectedInterestGroup);
  els.resultCount.textContent = t("nav.interestGroup");
  els.activeHint.textContent = "";
  els.countryList.className = "country-list interest-group-board";
  els.detail.innerHTML = "";
  if (selected) {
    const flavor = interestGroupVariants(selected).find((item) => item.key === state.selectedInterestGroupFlavor);
    els.countryList.innerHTML = flavor
      ? renderInterestGroupFlavorBoardDetail(selected, flavor)
      : renderInterestGroupBoardDetail(selected);
    bindInterestGroupFlavorSelector(els.countryList);
    bindInterestGroupFlavorPageLinks(els.countryList, selected);
    renderMap([]);
    return;
  }
  els.countryList.innerHTML = `
    <section class="interest-group-board-shell">
      <header class="interest-group-board-heading"><h2>${escapeHtml(t("nav.interestGroup"))}</h2></header>
      <div class="interest-group-board-grid">${groups.map(interestGroupBoardCard).join("")}</div>
    </section>
  `;
  els.countryList.querySelectorAll("[data-interest-group-key]").forEach((card) => {
    card.addEventListener("click", () => {
      location.hash = "/interest-group/" + encodeURIComponent(card.dataset.interestGroupKey);
    });
  });
  renderMap([]);
}

function religionIconHtml(religion, className = "religion-board-icon") {
  const icon = String(religion?.icon_source || "").split(/[\\/]/).at(-1).replace(/\.dds$/i, ".webp");
  return icon ? `<img class="${escapeHtml(className)}" src="assets/event-icons/religion_icons/${escapeHtml(icon)}" alt="" aria-hidden="true">` : "";
}

const religionHeritageDefinitions = [
  { key: "heritage_christian", parentKey: "heritage_group_abrahamic", religions: ["oriental_orthodox", "orthodox", "catholic", "protestant"] },
  { key: "heritage_islamic", parentKey: "heritage_group_abrahamic", religions: ["sunni", "shiite", "ibadi"] },
  { key: "heritage_jewish", parentKey: "heritage_group_abrahamic", religions: ["jewish"] },
  { key: "heritage_dharmic", parentKey: "heritage_group_eastern", religions: ["theravada", "gelugpa", "mahayana", "sikh", "hindu"] },
  { key: "heritage_taoic", parentKey: "heritage_group_eastern", religions: ["confucian", "shinto"] },
  { key: "heritage_indigenous", parentKey: "heritage_group_naturalistic", religions: ["animist"] },
  { key: "heritage_materialist", parentKey: "heritage_group_non_spiritual", religions: ["atheist"] },
];

const religionGroupDefinitions = [
  { key: "heritage_group_abrahamic", nameKey: "religion.group.abrahamic", heritages: ["heritage_christian", "heritage_islamic", "heritage_jewish"] },
  { key: "heritage_group_eastern", nameKey: "religion.group.eastern", heritages: ["heritage_dharmic", "heritage_taoic"] },
  { key: "heritage_group_naturalistic", nameKey: "religion.group.naturalistic", heritages: ["heritage_indigenous"] },
  { key: "heritage_group_non_spiritual", nameKey: "religion.group.nonSpiritual", heritages: ["heritage_materialist"] },
];

function religionName(religion) {
  const fallbackNames = {
    catholic: "天主教",
    protestant: "新教",
    orthodox: "东正教",
    oriental_orthodox: "东方正统教会",
    sunni: "逊尼派",
    shiite: "什叶派",
    ibadi: "伊巴德派",
    jewish: "犹太教",
    mahayana: "大乘佛教",
    gelugpa: "格鲁派",
    theravada: "上座部佛教",
    confucian: "儒教",
    hindu: "印度教",
    shinto: "神道教",
    sikh: "锡克教",
    animist: "泛灵论",
    atheist: "无神论",
  };
  const key = religion?.key || "";
  return translateMessage(`religion:${key}.name`, fallbackNames[key] || religion?.name_zh || key || "");
}

function religionHeritageName(key, religion = null) {
  const names = {
    heritage_christian: "基督教",
    heritage_islamic: "伊斯兰教",
    heritage_dharmic: "达摩宗教",
    heritage_taoic: "道",
    heritage_jewish: "犹太教",
    heritage_indigenous: "原生宗教",
    heritage_materialist: "唯物主义",
  };
  return translateMessage(religion?.loc?.heritageName || `religion:${religion?.key || key}.heritageName`, names[key] || key || t("religion.none"));
}

function religionGroupCardsHtml() {
  const byKey = new Map(religions.map((religion) => [religion.key, religion]));
  return religionGroupDefinitions.map((group) => {
    const childGroups = religionHeritageDefinitions.filter((heritage) => heritage.parentKey === group.key).map((heritage) => ({
      ...heritage,
      items: heritage.religions.map((key) => byKey.get(key)).filter(Boolean),
    })).filter((heritage) => heritage.items.length);
    if (!childGroups.length) return "";
    return `
      <section class="religion-board-parent-group" data-religion-parent-group="${escapeHtml(group.key)}">
        <h3 class="religion-board-parent-title">${escapeHtml(t(group.nameKey))}</h3>
        ${childGroups.map((heritage) => `
          <section class="religion-board-group" data-religion-group="${escapeHtml(heritage.key)}">
            <h4>${escapeHtml(religionHeritageName(heritage.key, heritage.items[0]))}</h4>
            <div class="religion-board-rows">${heritage.items.map((religion) => `<button type="button" class="religion-board-row" data-religion-key="${escapeHtml(religion.key)}" style="--religion-color:${escapeHtml(religionColor(religion))};--religion-background:${escapeHtml(religionBackground(religion))}">${religionIconHtml(religion)}<span class="religion-board-row-name"><strong>${escapeHtml(religionName(religion))}</strong><small>${escapeHtml(religion.key)}</small></span><span class="religion-board-row-meta"><span>${escapeHtml(t("religion.countries"))}：${escapeHtml(String(religion.country_count || 0))}</span><span>${escapeHtml(t("religion.devoutFlavors"))}：${escapeHtml(String((religion.devout_flavors || []).filter((flavor) => flavor.is_used_by_country).length))}</span></span></button>`).join("")}</div>
          </section>
        `).join("")}
      </section>
    `;
  }).join("");
}

function religionDevoutFlavorName(flavor) {
  const routeKey = flavor.key === "ig_sunni_madrasahs_turkey" ? "ig_sunni_madrasahs" : flavor.key;
  const group = byInterestGroup.get("ig_devout");
  const variant = group ? interestGroupVariants(group).find((item) => item.key === routeKey) : null;
  const label = flavor.key === "ig_sunni_madrasahs_turkey"
    ? translateMessage(flavor.loc?.name, localeRuntime.current === "en" ? "Sunni Ulema (Turkey)" : "逊尼派乌理玛（土耳其）")
    : variant?.name || flavor.name_zh || translateMessage(flavor.loc?.name, flavor.key);
  return label;
}

function religionDetailFlavorRowsHtml(religion) {
  const flavors = religion?.devout_flavors || [];
  if (!flavors.length) return `<p class="empty compact">${escapeHtml(t("religion.none"))}</p>`;
  return flavors.map((flavor) => `
    <div class="religion-board-detail-flavor-row">
      <a class="religion-board-detail-flavor-name religion-board-detail-flavor-button religion-board-detail-flavor-link" href="#${interestGroupFlavorRoute("ig_devout", flavor.key === "ig_sunni_madrasahs_turkey" ? "ig_sunni_madrasahs" : flavor.key)}">${escapeHtml(religionDevoutFlavorName(flavor))}<span aria-hidden="true">↗</span></a>
      ${flavor.is_used_by_country ? `<small>${escapeHtml(t("religion.flavorUsed"))}</small>` : `<small>${escapeHtml(t("religion.flavorPotential"))}</small>`}
      <div class="religion-board-detail-flavors">${(flavor.traits || []).map((key) => { const trait = interestGroupTraitByKey.get(key) || { key }; const label = entityText(trait); const description = entityText(trait, "description", ""); const modifierSummary = entityText(trait, "modifierSummary", ""); return `<span class="religion-board-detail-trait religion-board-detail-trait-hover" tabindex="0" data-concept-kind="interestGroupTrait" data-concept-key="${escapeHtml(key)}" data-concept-label="${escapeHtml(label)}" data-concept-category="${escapeHtml(t("board.ideology.interestGroupTrait", "利益集团特质"))}" data-concept-description="${escapeHtml(description)}" data-concept-secondary-description="${escapeHtml(modifierSummary)}" data-concept-search="${escapeHtml(key + " " + label)}">${escapeHtml(label)}</span>`; }).join("、") || escapeHtml(t("religion.none"))}</div>
    </div>
  `).join("");
}

function renderReligionBoard() {
  mapRuntime.filteredCountryTags = new Set();
  const selected = religionByKey.get(state.selectedReligion);
  els.resultCount.textContent = t("nav.religion");
  els.activeHint.textContent = "";
  els.countryList.className = "country-list religion-board";
  els.detail.innerHTML = "";
  if (selected) {
    els.countryList.innerHTML = `
      <section class="religion-board-detail" style="--religion-color:${escapeHtml(religionColor(selected))}">
        <button class="detail-back-button religion-board-back" type="button" data-religion-back aria-label="${escapeHtml(t("ui.back"))}" title="${escapeHtml(t("ui.back"))}"><img class="lucide-icon" src="assets/lucide/icons/arrow-left.svg" alt="" aria-hidden="true"></button>
        <header class="religion-board-detail-heading">
          ${religionIconHtml(selected, "religion-board-detail-icon")}
          <div><h2>${escapeHtml(religionName(selected))}</h2><p>${escapeHtml(selected.key)}</p></div>
        </header>
        <div class="religion-board-detail-grid">
          <section class="religion-board-detail-section"><h3>${escapeHtml(t("religion.heritage"))}</h3><p>${escapeHtml(religionHeritageName(selected.heritage_key, selected))}</p><small>${escapeHtml(t("religion.parentGroup"))}：${escapeHtml(translateMessage(selected.loc?.heritageGroupName, selected.heritage_group_key || ""))}</small></section>
          <section class="religion-board-detail-section"><h3>${escapeHtml(t("religion.taboos"))}</h3><p>${escapeHtml((selected.taboos || []).map((key) => { const good = goodByKey.get(key); return good ? economyDisplayName(good) : key; }).join("、") || t("religion.none"))}</p></section>
          <section class="religion-board-detail-section"><h3>${escapeHtml(t("religion.countries"))}</h3><p>${escapeHtml(String(selected.country_count || 0))}</p><div>${countryLinks(selected.country_tags || [])}</div></section>
          <section class="religion-board-detail-section religion-board-detail-flavor-section"><h3>${escapeHtml(t("religion.devoutFlavors"))}</h3><div>${religionDetailFlavorRowsHtml(selected)}</div></section>
        </div>
      </section>
    `;
    els.countryList.querySelector("[data-religion-back]")?.addEventListener("click", () => { state.selectedReligion = ""; replaceHash("/religion"); render(); });
    renderMap([]);
    return;
  }
  els.countryList.innerHTML = `
    <section class="religion-board-panel">
      <header class="religion-board-heading"><h2>${escapeHtml(t("nav.religion"))}</h2><p>${escapeHtml(t("religion.description"))}</p></header>
      ${religionGroupCardsHtml()}
    </section>
  `;
  els.countryList.querySelectorAll("[data-religion-key]").forEach((card) => card.addEventListener("click", () => { state.selectedReligion = card.dataset.religionKey; replaceHash(`/religion/${encodeURIComponent(state.selectedReligion)}`); render(); }));
  renderMap([]);
}

function religionColor(religion) {
  return religion?.color?.hex || (religion?.key === "atheist" ? "#87909a" : "#4aaab3");
}

function religionBackground(religion) {
  const hex = religionColor(religion).replace("#", "");
  const red = Number.parseInt(hex.slice(0, 2), 16) || 74;
  const green = Number.parseInt(hex.slice(2, 4), 16) || 170;
  const blue = Number.parseInt(hex.slice(4, 6), 16) || 179;
  return `rgb(${Math.round(red * 0.22 + 19 * 0.78)}, ${Math.round(green * 0.22 + 29 * 0.78)}, ${Math.round(blue * 0.22 + 32 * 0.78)})`;
}

function renderSettingsDialogContent() {
  return `
    <section class="settings-placeholder settings-panel">
      <p>${t("settings.description")}</p>
      <label class="settings-toggle">
        <input id="whiteDecentralizedSetting" type="checkbox"${state.whiteDecentralized ? " checked" : ""}>
        <span>${t("settings.whiteDecentralized")}</span>
      </label>
      <label class="settings-toggle">
        <input id="subjectOverlordColorsSetting" type="checkbox"${state.subjectOverlordColors ? " checked" : ""}>
        <span>${t("settings.subjectOverlordColors")}</span>
      </label>
      <label class="settings-toggle">
        <input id="omitIndigenousSetting" type="checkbox"${state.omitIndigenousLanguagesCultures ? " checked" : ""}>
        <span>${t("settings.omitIndigenous")}</span>
      </label>
      <label class="settings-toggle">
        <input id="omitDecentralizedTagsSetting" type="checkbox"${state.omitDecentralizedTags ? " checked" : ""}>
        <span>${t("settings.omitDecentralizedTags")}</span>
      </label>
    </section>
  `;
}

function renderAboutDialogContent() {
  const version = data.meta?.victoria3_version || t("ui.unknown");
  const isStandaloneSite = Boolean(standaloneSiteConfig);
  const siteName = isStandaloneSite ? "Victorian Century" : "Vicdata";
  const sourceText = t(isStandaloneSite ? "about.sourceVc" : "about.sourceMain");
  return `
    <div class="about-dialog-grid">
      <section class="settings-placeholder about-intro">
        <h3>${escapeHtml(siteTitle)}</h3>
        <p>${escapeHtml(t("about.intro", { site: siteName, version }))}</p>
        <p>${escapeHtml(t("about.usage"))}</p>
      </section>
      <section class="about-stat-grid" aria-label="${escapeHtml(t("about.dataScope"))}">
        ${aboutStat(t("about.currentVersion"), version)}
        ${aboutStat(t("nav.country"), localizedNumber(dataCount("countries", countries)))}
        ${aboutStat(t("nav.region"), localizedNumber(landStateRegions.length))}
        ${aboutStat(t("nav.culture"), localizedNumber(dataCount("cultures", cultures)))}
        ${aboutStat(t("nav.company"), localizedNumber(dataCount("companies", companies)))}
        ${aboutStat(t("nav.ideology"), localizedNumber(dataCount("ideologies", ideologies)))}
      </section>
      <section class="settings-placeholder about-note">
        <h3>${t("about.dataAndDisclaimer")}</h3>
        <p>${escapeHtml(sourceText)}</p>
      </section>
    </div>
    <section class="settings-placeholder developer-card" aria-label="${escapeHtml(t("about.developerProfile"))}">
      <img class="developer-avatar" src="assets/about/developer.jpg" alt="${escapeHtml(t("about.developerAvatar"))}">
      <div class="developer-copy">
        <h3>${t("about.developer")}</h3>
        <p>${t("about.developerBio")}</p>
        <p>${t("about.developerWork")}</p>
        <a class="support-link" href="https://afdian.com/a/shimotsukiyukimi" target="_blank" rel="noopener noreferrer">BUY ME A TEA</a>
        <a class="feedback-link" href="${feedbackMailto}">${t("about.feedback", { email: feedbackEmail })}</a>
      </div>
    </section>
  `;
}

function aboutStat(label, value) {
  return `
    <article class="about-stat">
      <span class="about-stat-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderChangelogBoard() {
  const defaultPair = changelogPairs()[0]?.id || "";
  if (!state.changelogPair && defaultPair) state.changelogPair = defaultPair;
  mapRuntime.filteredCountryTags = new Set();
  els.resultCount.textContent = t("nav.changelog");
  els.activeHint.textContent = changelogData.targetVersion && changelogData.baseVersion
    ? `${changelogData.baseVersion} -> ${changelogData.targetVersion}`
    : t("changelog.versionChanges");
  els.countryList.className = "country-list changelog-board";
  els.detail.innerHTML = "";
  renderMap([]);
  if (state.changelogLoading) {
    els.countryList.innerHTML = `<p class="empty">${t("changelog.loading")}</p>`;
    return;
  }
  if (state.changelogError) {
    els.countryList.innerHTML = `<p class="empty">${escapeHtml(state.changelogError)}</p>`;
    return;
  }
  if (changelogLoadedPair !== state.changelogPair) {
    els.countryList.innerHTML = `<p class="empty">${t("changelog.empty")}</p>`;
    ensureChangelogLoaded();
    return;
  }
  const visible = filteredChangelogChanges();
  const duplicateState = duplicateStateByDiff(visible);
  const diffCount = visible.reduce((sum, change) => sum + (change.diffs || []).length, 0);
  const repeatedCount = [...duplicateState.values()].filter((item) => item.repeated).length;
  const repeatedText = repeatedCount ? `，${repeatedCount} 个为同类后续表现` : "";
  els.countryList.innerHTML = `
    <section class="changelog-panel embedded-changelog-panel" aria-label="更新日志">
      <div class="changelog-heading">
        <div>
          <h2>${escapeHtml(changelogData.targetVersion || "")} 相对 ${escapeHtml(changelogData.baseVersion || "")}</h2>
          <p class="changelog-note">完整记录 ${escapeHtml(String(changelogData.changes.length))} 条对象变化。</p>
        </div>
        <label class="changelog-search">
          <span>版本段</span>
          <select id="changelogPairSelect" aria-label="更新日志版本段">
            ${changelogPairs().map((pair) => `<option value="${escapeHtml(pair.id)}"${pair.id === state.changelogPair ? " selected" : ""}>${escapeHtml(pair.label)}</option>`).join("")}
          </select>
        </label>
        <label class="changelog-search">
          <span>搜索</span>
          <input id="changelogSearch" type="search" autocomplete="off" value="${escapeHtml(state.changelogSearch)}" placeholder="条目、字段、源文件">
        </label>
      </div>
      <div id="changelogBoardFilters" class="changelog-filters" aria-label="板块筛选">
        ${renderChangelogFiltersHtml()}
      </div>
      <div class="changelog-stats">显示 ${escapeHtml(String(visible.length))} 条对象变化，${escapeHtml(String(diffCount))} 个字段差异${escapeHtml(repeatedText)}。</div>
      <div class="changelog-list">
        ${visible.length ? visible.map((change) => changeHtml(change, duplicateState)).join("") : `<p class="empty">没有匹配的变化。</p>`}
      </div>
    </section>
  `;
  bindChangelogControls();
}

function ensureChangelogLoaded() {
  const pair = changelogPairs().find((item) => item.id === state.changelogPair) || changelogPairs()[0];
  if (!pair || state.changelogLoading || changelogLoadedPair === pair.id) return;
  loadChangelogPair(pair.id).catch((error) => {
    state.changelogLoading = false;
    state.changelogError = error?.message || String(error);
    render();
  });
}

async function loadChangelogPair(pairId) {
  const pair = changelogPairs().find((item) => item.id === pairId) || changelogPairs()[0];
  if (!pair) return;
  const requestPairId = pair.id;
  state.changelogLoading = true;
  state.changelogError = "";
  state.changelogPair = requestPairId;
  state.changelogBoard = "all";
  state.changelogSearch = "";
  changelogLoadedPair = "";
  changelogData = { baseVersion: "", targetVersion: "", boards: [], changes: [] };
  changelogBoardOrder = ["all"];
  renderChangelogBoard();
  const loaded = await loadScriptValue(pair.data, "VIC3_CHANGELOG_DATA");
  if (state.changelogPair !== requestPairId) return;
  changelogData = loaded || { baseVersion: "", targetVersion: "", boards: [], changes: [] };
  changelogBoardOrder = ["all", ...(changelogData.boards || []).map((board) => board.key)];
  changelogLoadedPair = requestPairId;
  state.changelogLoading = false;
  render();
}

function changelogPairs() {
  return (versionConfig?.changelogs || []).map((pair) => ({
    ...pair,
    id: pair.id || `${pair.base_version}_to_${pair.target_version}`,
  }));
}

function bindChangelogControls() {
  const pairSelect = els.countryList.querySelector("#changelogPairSelect");
  const searchInput = els.countryList.querySelector("#changelogSearch");
  const filters = els.countryList.querySelector("#changelogBoardFilters");
  pairSelect?.addEventListener("change", () => {
    loadChangelogPair(pairSelect.value).catch((error) => {
      state.changelogLoading = false;
      state.changelogError = error?.message || String(error);
      render();
    });
  });
  searchInput?.addEventListener("input", () => {
    state.changelogSearch = searchInput.value.trim().toLowerCase();
    renderChangelogBoard();
  });
  filters?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-board-filter]");
    if (!button || !filters.contains(button)) return;
    state.changelogBoard = button.dataset.boardFilter || "all";
    renderChangelogBoard();
  });
}

function renderChangelogFiltersHtml() {
  const counts = changelogBoardCounts();
  return changelogBoardOrder.map((boardKey) => {
    const label = boardKey === "all"
      ? "全部"
      : (changelogData.boards || []).find((board) => board.key === boardKey)?.label || boardKey;
    const count = boardKey === "all" ? (changelogData.changes || []).length : counts.get(boardKey) || 0;
    return `<button class="filter-token" type="button" data-board-filter="${escapeHtml(boardKey)}" aria-pressed="${state.changelogBoard === boardKey}">${escapeHtml(label)} ${escapeHtml(String(count))}</button>`;
  }).join("");
}

function filteredChangelogChanges() {
  const search = state.changelogSearch;
  return (changelogData.changes || []).filter((change) => {
    if (state.changelogBoard !== "all" && change.board !== state.changelogBoard) return false;
    if (!search) return true;
    return changelogSearchBlob(change).includes(search);
  });
}

function changelogBoardCounts() {
  const counts = new Map();
  for (const change of changelogData.changes || []) {
    counts.set(change.board, (counts.get(change.board) || 0) + 1);
  }
  return counts;
}

function duplicateStateByDiff(changes) {
  const seen = new Map();
  const states = new Map();
  for (const change of changes || []) {
    (change.diffs || []).forEach((diff, index) => {
      const key = diff.duplicateKey || `${change.id}:${index}`;
      const current = (seen.get(key) || 0) + 1;
      const total = Number(diff.duplicateCount) || 1;
      seen.set(key, current);
      states.set(diffStateKey(change, index), {
        current,
        total,
        repeated: total > 1 && current > 1,
      });
    });
  }
  return states;
}

function diffStateKey(change, index) {
  return `${change.id}:${index}`;
}

function changeHtml(change, duplicateState) {
  const source = change.sourceFile ? `<div class="change-source">${escapeHtml(change.sourceFile)}</div>` : "";
  return `
    <article class="change-card">
      <div class="change-card-head">
        <div>
          <div class="change-label">${escapeHtml(change.boardLabel)}</div>
          <h3>${escapeHtml(change.title)}</h3>
          ${source}
        </div>
        <div class="change-actions">
          <a class="topbar-link" href="${escapeHtml(change.baseUrl)}">查看 ${escapeHtml(changelogData.baseVersion)}</a>
          <a class="topbar-link" href="${escapeHtml(change.targetUrl)}">查看 ${escapeHtml(changelogData.targetVersion)}</a>
        </div>
      </div>
      <div class="change-diffs">
        ${(change.diffs || []).map((diff, index) => diffHtml(change, diff, index, duplicateState)).join("")}
      </div>
    </article>
  `;
}

function diffHtml(change, diff, index, duplicateState) {
  const kindLabel = diff.kind === "raw" ? "源代码" : "抽取字段";
  const currentState = duplicateState.get(diffStateKey(change, index)) || { current: 1, total: 1, repeated: false };
  const duplicateClass = currentState.repeated ? " is-duplicate" : "";
  const duplicateLabel = currentState.total > 1
    ? `<span class="change-duplicate-badge">同类 ${currentState.current}/${currentState.total}</span>`
    : "";
  return `
    <details class="change-diff${duplicateClass}">
      <summary>
        <span>${escapeHtml(diff.label)}</span>
        <span class="change-summary-actions">
          ${duplicateLabel}
          <span class="change-open-label">查看对应内容的源代码变化</span>
          <span class="change-kind">${escapeHtml(kindLabel)}</span>
        </span>
      </summary>
      <div class="source-compare" aria-label="源代码变化 ${index + 1}">
        <section>
          <h4>${escapeHtml(changelogData.baseVersion)}</h4>
          <pre><code>${escapeHtml(diff.oldText)}</code></pre>
        </section>
        <section>
          <h4>${escapeHtml(changelogData.targetVersion)}</h4>
          <pre><code>${escapeHtml(diff.newText)}</code></pre>
        </section>
      </div>
    </details>
  `;
}

function changelogSearchBlob(change) {
  return [
    change.boardLabel,
    change.key,
    change.title,
    change.sourceFile,
    ...(change.diffs || []).flatMap((diff) => [diff.path, diff.label, diff.oldText, diff.newText]),
  ].join("\n").toLowerCase();
}

function bindSettingsControls(container = els.countryList) {
  const white = container?.querySelector("#whiteDecentralizedSetting");
  const subjectOverlordColors = container?.querySelector("#subjectOverlordColorsSetting");
  const omitIndigenous = container?.querySelector("#omitIndigenousSetting");
  const omitDecentralized = container?.querySelector("#omitDecentralizedTagsSetting");
  white?.addEventListener("change", () => {
    state.whiteDecentralized = white.checked;
    persistDisplaySetting("vicdata-white-decentralized", state.whiteDecentralized);
    render();
    renderInfoDialog();
  });
  subjectOverlordColors?.addEventListener("change", () => {
    state.subjectOverlordColors = subjectOverlordColors.checked;
    persistDisplaySetting("vicdata-subject-overlord-colors", state.subjectOverlordColors);
    render();
    renderInfoDialog();
  });
  omitIndigenous?.addEventListener("change", () => {
    state.omitIndigenousLanguagesCultures = omitIndigenous.checked;
    persistDisplaySetting("vicdata-omit-indigenous", state.omitIndigenousLanguagesCultures);
    renderFilterOptions();
    render();
    renderInfoDialog();
  });
  omitDecentralized?.addEventListener("change", () => {
    state.omitDecentralizedTags = omitDecentralized.checked;
    persistDisplaySetting("vicdata-omit-decentralized-tags", state.omitDecentralizedTags);
    render();
    renderInfoDialog();
  });
}

function renderCountryBoard() {
  const filtered = countries.filter(matchesCountryFilters).sort(sortCountries);
  mapRuntime.filteredCountryTags = new Set(filtered.map((country) => country.tag));
  mapRuntime.countrySearchMatchedTags = state.search
    ? new Set(filtered.map((country) => country.tag))
    : new Set();
  if (state.selectedTag && !byTag.has(state.selectedTag)) state.selectedTag = "";
  if (!isDetailPageRoute() && state.selectedTag && !filtered.some((country) => country.tag === state.selectedTag)) state.selectedTag = "";
  const selectedCountry = byTag.get(state.selectedTag);
  if (!selectedCountry) state.countryIncorporationMapEnabled = false;
  if (els.countryIncorporationMapButton) {
    const enabled = Boolean(selectedCountry);
    els.countryIncorporationMapButton.disabled = !enabled;
    els.countryIncorporationMapButton.setAttribute("aria-pressed", String(enabled && state.countryIncorporationMapEnabled));
  }
  els.resultCount.textContent = t("board.country.resultCount", { count: localizedNumber(filtered.length) });
  els.activeHint.textContent = buildActiveHint(filtered.length);
  renderCountryList(filtered);
  renderMap(state.countryIncorporationMapEnabled && selectedCountry ? stateRegions : countryMapStateRegions(selectedCountry));
  if (!state.countryIncorporationMapEnabled) focusCountryOnMap(selectedCountry);
  renderMobileCountryControls();
  if (state.countryMobileRestoreScrollPending) {
    state.countryMobileRestoreScrollPending = false;
    if (window.matchMedia("(max-aspect-ratio: 3 / 2)").matches) {
      requestAnimationFrame(() => {
        window.scrollTo(0, state.countryMobileListScrollTop);
      });
    }
  }
}

function renderCultureBoard() {
  if (state.detailKind === "cultureIncorporation") {
    renderCultureIncorporationCalculator();
    els.countryList.innerHTML = "";
    renderMap(stateRegions);
    return;
  }
  if (els.cultureIncorporationPanel) els.cultureIncorporationPanel.hidden = true;
  const filtered = cultures.filter(matchesCultureFilters).sort(sortCultures);
  if (state.selectedCulture && !byCulture.has(state.selectedCulture)) state.selectedCulture = "";
  if (!isDetailPageRoute() && state.selectedCulture && !filtered.some((culture) => culture.key === state.selectedCulture)) state.selectedCulture = "";
  els.resultCount.textContent = t("board.culture.resultCount", { count: localizedNumber(filtered.length) });
  els.activeHint.textContent = buildActiveHint(filtered.length);
  renderCultureList(filtered);
  renderMap(stateRegions);
  focusCultureOnMap(byCulture.get(state.selectedCulture));
  renderMobileCultureControls();
  if (state.cultureMobileRestoreScrollPending) {
    state.cultureMobileRestoreScrollPending = false;
    if (window.matchMedia("(max-aspect-ratio: 3 / 2)").matches) {
      requestAnimationFrame(() => {
        window.scrollTo(0, state.cultureMobileListScrollTop);
      });
    }
  }
}

function renderRegionBoard() {
  const {
    filteredStrategicRegions,
    filteredSeaRegions,
    filteredStateRegions,
    filteredGeographicRegions,
    filteredSeaStateRegions,
  } = regionBoardMapInputs();
  if (state.selectedStateRegion && !byStateRegion.has(state.selectedStateRegion)) state.selectedStateRegion = "";
  if (state.mapSelectedStateRegion && !byStateRegion.has(state.mapSelectedStateRegion)) state.mapSelectedStateRegion = "";
  if (!isDetailPageRoute() && state.selectedStateRegion && !filteredStateRegions.some((stateRegion) => stateRegion.key === state.selectedStateRegion) && state.selectedStateRegion !== state.mapSelectedStateRegion) state.selectedStateRegion = "";
  if (state.selectedStrategicRegion && ![...filteredStrategicRegions, ...filteredSeaRegions].some((region) => region.key === state.selectedStrategicRegion)) {
    state.selectedStrategicRegion = "";
  }
  if (state.selectedGeographicRegion && !filteredGeographicRegions.some((region) => region.key === state.selectedGeographicRegion)) {
    state.selectedGeographicRegion = "";
  }
  if (!["stateRegion", "strategicRegion", "geographicRegion"].includes(state.detailKind)) {
    state.detailKind = regionListModeDetailKind();
  }
  const selectedStateRegion = byStateRegion.get(state.selectedStateRegion);
  els.resultCount.textContent = t("board.region.resultCount", { count: localizedNumber(filteredStateRegions.length) });
  els.activeHint.textContent = buildActiveHint(filteredStateRegions.length);
  renderRegionList(filteredStrategicRegions, filteredStateRegions, filteredSeaRegions, filteredGeographicRegions);
  renderMap(regionMapStateRegions(filteredStateRegions, filteredSeaStateRegions, filteredGeographicRegions));
  focusStateRegionOnMap(selectedStateRegion);
}

function regionBoardMapInputs() {
  const filteredStrategicRegions = landStrategicRegions.filter(matchesStrategicRegionFilters).sort(sortStrategicRegionRef);
  const filteredSeaRegions = seaStrategicRegions.filter(matchesStrategicRegionFilters).sort(sortStrategicRegionRef);
  const filteredStateRegions = landStateRegions.filter(matchesStateRegionFilters).sort(sortStateRegions);
  const filteredGeographicRegions = geographicRegions.filter(matchesGeographicRegionFilters).sort(sortGeographicRegions);
  const filteredSeaStateRegions = uniqueByKey(filteredSeaRegions
    .flatMap((region) => region.states || [])
    .map((stateRef) => byStateRegion.get(stateRef.key))
    .filter(Boolean));
  return {
    filteredStrategicRegions,
    filteredSeaRegions,
    filteredStateRegions,
    filteredGeographicRegions,
    filteredSeaStateRegions,
  };
}

function renderRegionMapForCurrentFilters() {
  const inputs = regionBoardMapInputs();
  renderMap(regionMapStateRegions(
    inputs.filteredStateRegions,
    inputs.filteredSeaStateRegions,
    inputs.filteredGeographicRegions,
  ));
}

function renderCompanyBoard() {
  if (state.detailKind === "companySolver") {
    if (els.companySolverEntry) els.companySolverEntry.hidden = true;
    if (els.companyComposerEntry) els.companyComposerEntry.hidden = true;
    renderCompanySolverBoard();
    return;
  }
  if (state.detailKind === "companyComposer") {
    if (els.companySolverEntry) els.companySolverEntry.hidden = true;
    if (els.companyComposerEntry) els.companyComposerEntry.hidden = true;
    if (els.companySolverDetailPane) els.companySolverDetailPane.hidden = true;
    renderCompanyComposerBoard();
    return;
  }
  if (els.companySolverDetailPane) els.companySolverDetailPane.hidden = true;
  if (els.companySolverEntry) {
    const available = typeof companySolverAvailable === "function" && companySolverAvailable();
    els.companySolverEntry.hidden = !available;
    els.companySolverEntry.innerHTML = available ? '<button type="button" class="company-solver-entry-button" data-company-solver-entry><span><strong>' + escapeHtml(t("board.company.solverEntry", "公司产业求解器")) + '</strong><small>' + escapeHtml(t("board.company.solverDescription", "选择希望覆盖的建筑，查找公司组合。")) + '</small></span><span aria-hidden="true">→</span></button>' : "";
  }
  if (els.companyComposerEntry) {
    const available = typeof companyComposerAvailable === "function" && companyComposerAvailable();
    els.companyComposerEntry.hidden = !available;
    els.companyComposerEntry.innerHTML = available ? '<button type="button" class="company-solver-entry-button" data-company-composer-entry><span><strong>' + escapeHtml(t("board.company.composer.entry", "公司建筑组合器")) + '</strong><small>' + escapeHtml(t("board.company.composer.description", "选择公司并查看固定建筑、可选扩展与合并效果。")) + '</small></span><span aria-hidden="true">→</span></button>' : "";
  }
  const filtered = companies.filter(matchesCompanyFilters).sort(sortCompanies);
  if (state.selectedCompany && !byCompany.has(state.selectedCompany)) state.selectedCompany = "";
  if (!isDetailPageRoute() && state.selectedCompany && !filtered.some((company) => company.key === state.selectedCompany)) state.selectedCompany = "";
  const selectedCompany = byCompany.get(state.selectedCompany);
  mapRuntime.companyMapCompanies = selectedCompany ? [selectedCompany] : filtered;
  els.resultCount.textContent = t("board.company.resultCount", { count: localizedNumber(filtered.length) });
  els.activeHint.textContent = buildActiveHint(filtered.length);
  renderCompanyList(filtered);
}

function renderIdeologyBoard() {
  const filtered = ideologies.filter(matchesIdeologyFilters).sort(sortIdeologies);
  if (state.selectedIdeology && !ideologyByKey.has(state.selectedIdeology)) state.selectedIdeology = "";
  if (!isDetailPageRoute() && state.selectedIdeology && !filtered.some((ideology) => ideology.key === state.selectedIdeology)) state.selectedIdeology = "";
  els.resultCount.textContent = t("board.ideology.resultCount", { count: localizedNumber(filtered.length) });
  els.activeHint.textContent = buildActiveHint(filtered.length);
  renderIdeologyList(filtered);
}

function renderLawBoard() {
  const filtered = laws.filter(matchesLawFilters).sort(sortLaws);
  if (state.selectedLaw && !lawByKey.has(state.selectedLaw)) state.selectedLaw = "";
  if (!isDetailPageRoute() && state.selectedLaw && !filtered.some((law) => law.key === state.selectedLaw)) state.selectedLaw = "";
  els.resultCount.textContent = t("board.law.resultCount", { count: localizedNumber(filtered.length) });
  els.activeHint.textContent = buildActiveHint(filtered.length);
  renderLawList(filtered);
}

const technologyGridPositions = {
  production: {
    united_fruit_banana_tech: { column: 8, row: 1 },
    sericulture: { column: 10, row: 1 },
    enclosure: { column: 14, row: 1 },
    manufacturies: { column: 21, row: 1 },
    shaft_mining: { column: 17, row: 2 },
    distillation: { column: 22, row: 2 },
    cotton_gin: { column: 24, row: 2 },
    prospecting: { column: 14, row: 3 },
    steelworking: { column: 16, row: 3 },
    lathe: { column: 24, row: 3 },
    intensive_agriculture: { column: 10, row: 4 },
    bessemer_process: { column: 16, row: 4 },
    atmospheric_engine: { column: 18, row: 4 },
    mechanical_tools: { column: 20, row: 4 },
    fractional_distillation: { column: 22, row: 4 },
    crystal_glass: { column: 24, row: 4 },
    canneries: { column: 26, row: 4 },
    nitroglycerin: { column: 10, row: 5 },
    watertube_boiler: { column: 17, row: 5 },
    railways: { column: 19, row: 5 },
    baking_powder: { column: 21, row: 5 },
    mechanized_workshops: { column: 23, row: 5 },
    chemical_bleaching: { column: 25, row: 5 },
    improved_fertilizer: { column: 4, row: 6 },
    steam_donkey: { column: 6, row: 6 },
    dynamite: { column: 8, row: 6 },
    open_hearth_process: { column: 10, row: 6 },
    reinforced_concrete: { column: 13, row: 6 },
    rotary_valve_engine: { column: 15, row: 6 },
    steel_railway_cars: { column: 17, row: 6 },
    shift_work: { column: 19, row: 6 },
    vacuum_canning: { column: 21, row: 6 },
    rubber_mastication: { column: 23, row: 6 },
    threshing_machine: { column: 5, row: 7 },
    pumpjacks: { column: 7, row: 7 },
    electrical_generation: { column: 17, row: 7 },
    aniline: { column: 23, row: 7 },
    vulcanization: { column: 25, row: 7 },
    nitrogen_fixation: { column: 1, row: 8 },
    mechanized_farming: { column: 3, row: 8 },
    electric_arc_process: { column: 5, row: 8 },
    plastics: { column: 7, row: 8 },
    pneumatic_tools: { column: 9, row: 8 },
    steam_turbine: { column: 11, row: 8 },
    electrical_capacitors: { column: 13, row: 8 },
    combustion_engine: { column: 15, row: 8 },
    telephone: { column: 17, row: 8 },
    conveyors: { column: 20, row: 8 },
    art_silk: { column: 23, row: 8 },
    automatic_bottle_blowers: { column: 25, row: 8 },
    electric_railway: { column: 16, row: 9 },
    radio: { column: 18, row: 9 },
    pasteurization: { column: 20, row: 9 },
    arc_welding: { column: 7, row: 10 },
    oil_turbine: { column: 11, row: 10 },
    compression_ignition: { column: 15, row: 10 },
    flash_freezing: { column: 20, row: 10 },
    dough_rollers: { column: 22, row: 10 },
  },
  military: {
    navigation: { column: 20, row: 1 },
    admiralty: { column: 19, row: 2 },
    drydocks: { column: 21, row: 2 },
    paddle_steamer: { column: 20, row: 3 },
    power_of_the_purse: { column: 17, row: 5 },
    screw_frigate: { column: 20, row: 5 },
    hydraulic_cranes: { column: 22, row: 5 },
    self_propelled_torpedoes: { column: 16, row: 7 },
    ironclad_tech: { column: 19, row: 7 },
    gantry_cranes: { column: 22, row: 7 },
    monitor_tech: { column: 15, row: 8 },
    jeune_ecole: { column: 17, row: 8 },
    floating_harbor: { column: 23, row: 8 },
    submarine: { column: 16, row: 9 },
    landing_craft: { column: 18, row: 9 },
    sea_lane_strategies: { column: 20, row: 9 },
    pre_dreadnought_tech: { column: 22, row: 9 },
    concrete_dockyards: { column: 24, row: 9 },
    dreadnought_tech: { column: 19, row: 10 },
    destroyer: { column: 15, row: 11 },
    carrier_tech: { column: 17, row: 11 },
    battleship_tech: { column: 19, row: 11 },
    battlefleet_tactics: { column: 20, row: 12 },
    standing_army: { column: 7, row: 1 },
    mandatory_service: { column: 5, row: 2 },
    military_drill: { column: 7, row: 2 },
    gunsmithing: { column: 9, row: 2 },
    line_infantry: { column: 6, row: 3 },
    artillery: { column: 8, row: 3 },
    army_reserves: { column: 5, row: 4 },
    napoleonic_warfare: { column: 7, row: 4 },
    general_staff: { column: 4, row: 5 },
    logistics: { column: 6, row: 5 },
    field_works: { column: 8, row: 5 },
    shell_gun: { column: 10, row: 5 },
    percussion_cap: { column: 12, row: 5 },
    triage: { column: 6, row: 6 },
    rifling: { column: 12, row: 6 },
    enlistment_offices: { column: 3, row: 7 },
    modern_nursing: { column: 6, row: 7 },
    electric_telegraph: { column: 9, row: 7 },
    breech_loading_artillery: { column: 11, row: 7 },
    repeaters: { column: 13, row: 7 },
    military_statistics: { column: 5, row: 8 },
    handcranked_machine_gun: { column: 11, row: 8 },
    war_propaganda: { column: 2, row: 9 },
    trench_works: { column: 5, row: 9 },
    wargaming: { column: 7, row: 9 },
    military_aviation: { column: 11, row: 9 },
    bolt_action_rifles: { column: 13, row: 9 },
    defense_in_depth: { column: 7, row: 10 },
    automatic_machine_guns: { column: 11, row: 10 },
    nco_training: { column: 2, row: 11 },
    stormtroopers: { column: 4, row: 11 },
    flamethrowers: { column: 7, row: 11 },
    concrete_fortifications: { column: 9, row: 11 },
    chemical_warfare: { column: 11, row: 11 },
    mobile_armor: { column: 6, row: 12 },
  },
  society: {
    urbanization: { column: 7, row: 1 },
    rationalism: { column: 22, row: 1 },
    urban_planning: { column: 6, row: 2 },
    tech_bureaucracy: { column: 8, row: 2 },
    democracy: { column: 21, row: 2 },
    academia: { column: 23, row: 2 },
    law_enforcement: { column: 7, row: 3 },
    international_trade: { column: 9, row: 3 },
    centralization: { column: 11, row: 3 },
    international_relations: { column: 13, row: 3 },
    mass_communication: { column: 22, row: 3 },
    medical_degrees: { column: 24, row: 3 },
    romanticism: { column: 26, row: 3 },
    empiricism: { column: 28, row: 3 },
    stock_exchange: { column: 8, row: 4 },
    currency_standards: { column: 10, row: 4 },
    colonization: { column: 15, row: 4 },
    banking: { column: 10, row: 5 },
    modern_sewerage: { column: 3, row: 6 },
    corporate_charters: { column: 5, row: 6 },
    postal_savings: { column: 8, row: 6 },
    central_banking: { column: 11, row: 6 },
    central_archives: { column: 13, row: 6 },
    nationalism: { column: 16, row: 6 },
    egalitarianism: { column: 18, row: 6 },
    pharmaceuticals: { column: 23, row: 6 },
    realism: { column: 25, row: 6 },
    dialectics: { column: 27, row: 6 },
    psychiatry: { column: 29, row: 6 },
    joint_stock_companies: { column: 8, row: 7 },
    organized_sports: { column: 15, row: 7 },
    quinine: { column: 20, row: 7 },
    labor_movement: { column: 22, row: 7 },
    steel_frame_buildings: { column: 3, row: 8 },
    mutual_funds: { column: 9, row: 8 },
    identification_documents: { column: 11, row: 8 },
    "pan-nationalism": { column: 13, row: 8 },
    human_rights: { column: 15, row: 8 },
    civilizing_mission: { column: 17, row: 8 },
    anarchism: { column: 19, row: 8 },
    corporatism: { column: 21, row: 8 },
    camera: { column: 23, row: 8 },
    socialism: { column: 25, row: 8 },
    philosophical_pragmatism: { column: 29, row: 8 },
    investment_banks: { column: 8, row: 9 },
    feminism: { column: 15, row: 9 },
    elevator: { column: 1, row: 10 },
    zeppelins: { column: 3, row: 10 },
    corporate_management: { column: 6, row: 10 },
    international_exchange_standards: { column: 9, row: 10 },
    central_planning: { column: 11, row: 10 },
    multilateral_alliances: { column: 13, row: 10 },
    malaria_prevention: { column: 17, row: 10 },
    political_agitation: { column: 21, row: 10 },
    film: { column: 23, row: 10 },
    psychoanalysis: { column: 29, row: 10 },
    paved_roads: { column: 1, row: 11 },
    macroeconomics: { column: 7, row: 11 },
    modern_financial_instruments: { column: 9, row: 11 },
    mass_surveillance: { column: 11, row: 11 },
    antibiotics: { column: 17, row: 11 },
    mass_propaganda: { column: 22, row: 11 },
    behaviorism: { column: 26, row: 11 },
    analytical_philosophy: { column: 29, row: 11 },
  },
};

function technologyGraphLayout() {
  const eras = technologyEras.map((era) => era.key);
  const technologyGraphCategory = state.technologyCategory;
  const technologyPositions = technologyGridPositions[technologyGraphCategory] || {};
  const technologyGridColumns = Math.max(1, ...Object.values(technologyPositions).map((position) => position.column));
  let technologyGridRows = Math.max(1, ...Object.values(technologyPositions).map((position) => position.row));
  const technologyGridCellWidth = 83;
  const technologyGridCellHeight = 138;
  const technologyGridLeft = 76;
  const technologyGridTop = 38;
  const eraBaseRows = [0, 2, 4, 6, 8];
  const occupiedPositions = new Set(Object.values(technologyPositions).map((position) => `${position.column}:${position.row}`));
  const nextAvailablePosition = (eraIndex) => {
    for (let row = eraBaseRows[eraIndex] + 1; ; row += 1) {
      for (let column = 1; column <= technologyGridColumns; column += 1) {
        const key = `${column}:${row}`;
        if (occupiedPositions.has(key)) continue;
        occupiedPositions.add(key);
        technologyGridRows = Math.max(technologyGridRows, row);
        return { column, row };
      }
    }
  };
  const nodes = new Map();
  eras.forEach((era, eraIndex) => {
    const eraTechnologies = technologies.filter((item) => item.category === technologyGraphCategory && item.era === era)
      .sort((a, b) => localizedCompare(entityText(a), entityText(b)));
    eraTechnologies.forEach((technology) => {
      const position = technologyPositions?.[technology.key] || nextAvailablePosition(eraIndex);
      const { column, row } = position;
      nodes.set(technology.key, {
        technology,
        x: technologyGridLeft + (column - 1) * technologyGridCellWidth - 50,
        y: technologyGridTop + (row - 1) * technologyGridCellHeight - 40,
      });
    });
  });
  return { nodes, width: technologyGridLeft * 2 + technologyGridColumns * technologyGridCellWidth, height: technologyGridTop + 76 + technologyGridRows * technologyGridCellHeight, technologyGridColumns, technologyGridRows, technologyGridCellWidth, technologyGridCellHeight, technologyGridLeft, technologyGridTop, eraBaseRows, technologyGraphCategory };
}

function technologyGraphEdges(layout) {
  return [...layout.nodes.values()].flatMap((to) => to.technology.prerequisites.map((key) => {
    const from = layout.nodes.get(key);
    return from ? { from, to } : null;
  }).filter(Boolean));
}

function technologyEdgePath(from, to) {
  const cardWidth = 144;
  const cardHeight = 88;
  const fromCenterX = from.x + cardWidth / 2;
  const fromCenterY = from.y + cardHeight / 2;
  const toCenterX = to.x + cardWidth / 2;
  const toCenterY = to.y + cardHeight / 2;
  const downward = toCenterY >= fromCenterY;
  const startY = downward ? from.y + cardHeight : from.y;
  const endY = downward ? to.y : to.y + cardHeight;
  const stubLength = 16;
  const startStubY = startY + (downward ? stubLength : -stubLength);
  const endStubY = endY + (downward ? -stubLength : stubLength);
  const diagonalX = toCenterX - fromCenterX;
  const diagonalY = endStubY - startStubY;
  const diagonalLength = Math.hypot(diagonalX, diagonalY) || 1;
  const curveLength = Math.min(12, diagonalLength / 3);
  const unitX = diagonalX / diagonalLength;
  const unitY = diagonalY / diagonalLength;
  const startCurveX = fromCenterX;
  const startCurveY = startStubY - (downward ? curveLength : -curveLength);
  const startDiagonalX = fromCenterX + unitX * curveLength;
  const startDiagonalY = startStubY + unitY * curveLength;
  const endDiagonalX = toCenterX - unitX * curveLength;
  const endDiagonalY = endStubY - unitY * curveLength;
  const endCurveX = toCenterX;
  const endCurveY = endStubY + (downward ? curveLength : -curveLength);
  return `M${fromCenterX} ${startY} V${startCurveY} Q${startCurveX} ${startStubY} ${startDiagonalX} ${startDiagonalY} L${endDiagonalX} ${endDiagonalY} Q${endCurveX} ${endStubY} ${toCenterX} ${endCurveY} V${endY}`;
}

function technologyNodeHtml(node) {
  const selected = node.technology.key === state.selectedTechnology;
  const iconFile = node.technology.icon.split("/").pop().replace(/\.dds$/i, ".webp");
  return `<button class="technology-node" type="button" data-technology-key="${escapeHtml(node.technology.key)}" aria-pressed="${selected}" style="left:${node.x}px;top:${node.y}px"><img src="assets/technologies/${escapeHtml(iconFile)}" alt="" aria-hidden="true"><span>${escapeHtml(entityText(node.technology))}</span>${victorianCenturyBadge(node.technology)}</button>`;
}

function renderTechnologyBoard() {
  const layout = technologyGraphLayout();
  const selected = technologyByKey.get(state.selectedTechnology) || null;
  const normalizedSearch = state.technologySearch.trim();
  const visibleNodes = [...layout.nodes.values()].filter((node) => !normalizedSearch || matchesLocalizedQuery(node.technology, normalizedSearch));
  const visibleNodeKeys = new Set(visibleNodes.map((node) => node.technology.key));
  const edges = technologyGraphEdges(layout).filter(({ from, to }) => visibleNodeKeys.has(from.technology.key) && visibleNodeKeys.has(to.technology.key));
  els.countryList.className = "country-list technology-board";
  els.resultCount.textContent = "";
  els.activeHint.textContent = "";
  const categoryLabels = Object.fromEntries(["production", "military", "society"].map((key) => [key, t(`enum.technology.${key}`, key)]));
  els.countryList.innerHTML = `<section class="technology-shell"><div class="technology-controls"><select data-technology-category-select aria-label="${escapeHtml(t("board.technology.category", "科技类别"))}">${Object.entries(categoryLabels).map(([key,label]) => `<option value="${key}" ${layout.technologyGraphCategory === key ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select><input type="search" data-technology-search aria-label="${escapeHtml(t("board.technology.search", "搜索科技"))}" placeholder="${escapeHtml(t("board.technology.search", "搜索科技"))}" value="${escapeHtml(state.technologySearch)}"><button class="map-tool-button" type="button" data-technology-reset aria-label="${escapeHtml(t("board.technology.resetView", "重置视图"))}" title="${escapeHtml(t("board.technology.resetView", "重置视图"))}"><img class="lucide-icon" src="assets/lucide/icons/refresh-ccw.svg" alt="" aria-hidden="true"></button></div><div class="technology-graph-viewport"><div class="technology-graph-canvas technology-grid-${layout.technologyGridColumns}x${layout.technologyGridRows}" style="width:${layout.width}px;height:${layout.height}px;transform:translate(${state.technologyViewport.x}px,${state.technologyViewport.y}px) scale(${state.technologyViewport.scale})"><svg class="technology-graph-edges" width="${layout.width}" height="${layout.height}" aria-hidden="true">${edges.map(({ from, to }) => { const highlighted = selected && (from.technology.key === selected.key || to.technology.key === selected.key); const stroke = highlighted ? "#c8a45b" : "#b7a883"; const strokeWidth = highlighted ? 5 : 3; const path = technologyEdgePath(from, to); return `<path d="${path}" fill="none" class="${highlighted ? "is-highlighted" : ""}" style="fill:none !important;stroke:${stroke} !important;stroke-width:${strokeWidth} !important"/>`; }).join("")}</svg>${visibleNodes.map(technologyNodeHtml).join("")}</div></div><div class="technology-mobile-list">${technologyEras.map((era) => `<details open><summary>${escapeHtml(entityText(era, "label", t(`enum.technologyEra.${era.key}`, era.key)))}</summary>${visibleNodes.filter((node) => node.technology.era === era.key).map(technologyNodeHtml).join("")}</details>`).join("")}</div><div class="technology-local-graph">${selected ? t("board.technology.localRelation", { name: entityText(selected), prerequisites: localizedNumber(selected.prerequisites.length), unlocks: localizedNumber(selected.unlocks.length) }) : t("board.technology.selectForRelations", "选择科技查看局部关系")}</div></section>`;
  els.detail.innerHTML = renderTechnologyDetail(selected);
  els.countryList.querySelectorAll("[data-technology-key]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => event.stopPropagation());
    button.addEventListener("click", () => { location.hash = `/technology/${encodeURIComponent(button.dataset.technologyKey)}`; });
  });
  els.countryList.querySelector("[data-technology-category-select]")?.addEventListener("change", (event) => { state.technologyCategory = event.target.value; state.technologySearch = ""; state.selectedTechnology = ""; state.technologyViewport = { x: 0, y: 0, scale: 1 }; render(); });
  els.countryList.querySelector("[data-technology-search]")?.addEventListener("input", (event) => { state.technologySearch = event.target.value; renderTechnologyBoard(); });
  els.countryList.querySelector("[data-technology-reset]")?.addEventListener("click", () => { state.technologyViewport = { x: 0, y: 0, scale: 1 }; render(); });
  const viewport = els.countryList.querySelector(".technology-graph-viewport");
  let drag = null;
  viewport?.addEventListener("pointerdown", (event) => { if (event.target.closest(".technology-node")) return; drag = { x: event.clientX, y: event.clientY, startX: state.technologyViewport.x, startY: state.technologyViewport.y }; viewport.setPointerCapture(event.pointerId); });
  viewport?.addEventListener("pointermove", (event) => { if (!drag) return; state.technologyViewport.x = drag.startX + event.clientX - drag.x; state.technologyViewport.y = drag.startY + event.clientY - drag.y; const canvas = viewport.querySelector(".technology-graph-canvas"); if (canvas) canvas.style.transform = `translate(${state.technologyViewport.x}px,${state.technologyViewport.y}px) scale(${state.technologyViewport.scale})`; });
  viewport?.addEventListener("pointerup", () => { drag = null; });
  viewport?.addEventListener("wheel", (event) => { event.preventDefault(); state.technologyViewport.scale = Math.max(.7, Math.min(1.8, state.technologyViewport.scale * (event.deltaY < 0 ? 1.1 : .9))); const canvas = viewport.querySelector(".technology-graph-canvas"); if (canvas) canvas.style.transform = `translate(${state.technologyViewport.x}px,${state.technologyViewport.y}px) scale(${state.technologyViewport.scale})`; }, { passive: false });
}

function renderTechnologyDetail(technology) {
  if (!technology) return "";
  const relation = (items, label) => `<section><h3>${escapeHtml(label)}</h3><div class="technology-relation-tags">${items.length ? items.map((item) => `<button class="pill tag-technology" type="button" data-technology-target="${escapeHtml(item.key)}">${escapeHtml(entityText(item))}</button>`).join("") : t("ui.none", "无")}</div></section>`;
  const refs = technology.references || { laws: [], companies: [] };
  const linkItems = (items, route) => items.length ? items.map((item) => `<a class="pill" href="#/${route}/${encodeURIComponent(item.key)}">${escapeHtml(entityText(item))}</a>`).join("") : t("ui.none", "无");
  queueMicrotask(() => {
    document.querySelectorAll("[data-technology-target]").forEach((button) => button.addEventListener("click", () => { location.hash = `/technology/${encodeURIComponent(button.dataset.technologyTarget)}`; }));
    document.querySelector("[data-technology-back]")?.addEventListener("click", () => { location.hash = "/technology"; });
  });
  const eraLabel = t(`enum.technologyEra.${technology.era}`, technology.era);
  const meta = t("board.technology.meta", { category: t(`enum.technology.${technology.category}`, technology.category), era: eraLabel, cost: localizedNumber(technology.era_cost) });
  const description = entityText(technology, "description", t("ui.noDescription", "无说明"));
  return `<section class="technology-detail"><div class="detail-title"><button class="detail-back-button" type="button" data-technology-back aria-label="${escapeHtml(t("board.technology.back", "返回科技树"))}" title="${escapeHtml(t("board.technology.back", "返回科技树"))}"><img class="lucide-icon" src="assets/lucide/icons/arrow-left.svg" alt="" aria-hidden="true"></button><div class="detail-title-main"><h2>${escapeHtml(entityText(technology))}</h2></div>${victorianCenturyBadge(technology)}</div><p>${escapeHtml(meta)}</p><p>${escapeHtml(description)}</p>${relation(technology.prerequisites.map((key) => technologyByKey.get(key)).filter(Boolean), t("board.technology.prerequisites", "前置科技"))}${relation(technology.unlocks, t("board.technology.unlocks", "后续科技"))}<section><h3>${t("board.technology.modifiers", "修正效果")}</h3>${technology.modifiers.length ? technology.modifiers.map((item) => `<p>${escapeHtml(renderTextSpec({ message: item.loc?.summary, fallback: item.key }))}</p>`).join("") : t("ui.none", "无")}</section><section><h3>${t("board.technology.relatedLaws", "关联法律")}</h3>${linkItems(refs.laws, "law")}</section><section><h3>${t("board.technology.relatedCompanies", "关联公司")}</h3>${linkItems(refs.companies, "company")}</section></section>`;
}

function renderDetailForState() {
  const activeDetailRouteKey = detailRouteKey();
  if (state.detailKind === "companySolver") {
    renderCompanySolverDetail();
    return;
  }
  if (state.detailKind === "law" && lawByKey.has(state.selectedLaw)) {
    renderLawDetail(lawByKey.get(state.selectedLaw));
    return;
  }
  if (state.detailKind === "ideology" && ideologyByKey.has(state.selectedIdeology)) {
    renderIdeologyDetail(ideologyByKey.get(state.selectedIdeology));
    return;
  }
  if (state.detailKind === "company" && byCompany.has(state.selectedCompany) && activeDetailRouteKey) {
    renderCompanyDetail(byCompany.get(state.selectedCompany));
    return;
  }
  if (state.detailKind === "culture" && byCulture.has(state.selectedCulture)) {
    renderCultureDetail(byCulture.get(state.selectedCulture));
    return;
  }
  if (state.detailKind === "stateRegion" && byStateRegion.has(state.selectedStateRegion)) {
    renderStateRegionDetail(byStateRegion.get(state.selectedStateRegion));
    return;
  }
  if (state.detailKind === "strategicRegion" && byStrategicRegion.has(state.selectedStrategicRegion)) {
    renderStrategicRegionDetail(byStrategicRegion.get(state.selectedStrategicRegion));
    return;
  }
  if (state.detailKind === "geographicRegion" && byGeographicRegion.has(state.selectedGeographicRegion)) {
    renderGeographicRegionDetail(byGeographicRegion.get(state.selectedGeographicRegion));
    return;
  }
  renderCountryDetailPage(byTag.get(state.selectedTag));
}

function renderGlobalSearchBoard() {
  const results = globalSearchResults(state.globalSearch);
  if (!state.selectedGlobalResult || !results.some((item) => item.id === state.selectedGlobalResult)) {
    state.selectedGlobalResult = results[0]?.id || "";
  }
  els.resultCount.textContent = tc("results.count", results.length, { count: localizedNumber(results.length) });
  els.activeHint.textContent = state.globalSearch ? t("search.activeQuery", { query: state.globalSearch }) : "";
  renderGlobalSearchList(results);
  renderGlobalSearchDetail(results.find((item) => item.id === state.selectedGlobalResult) || null);
}

function renderGlobalSearchList(results) {
  els.countryList.className = "country-list global-search-list";
  if (!results.length) {
    els.countryList.innerHTML = `<p class="empty">${t("search.noResults")}</p>`;
    return;
  }
  const groups = [];
  for (const result of results) {
    let group = groups.find((item) => item.label === result.typeLabel);
    if (!group) {
      group = { label: result.typeLabel, items: [] };
      groups.push(group);
    }
    group.items.push(result);
  }
  els.countryList.innerHTML = groups.map((group) => `
    <div class="list-section-title">${escapeHtml(group.label)}</div>
    ${group.items.map((result) => `
      <button class="country-row global-result-row" type="button" data-global-result="${escapeHtml(result.id)}" aria-current="${result.id === state.selectedGlobalResult}">
        <span class="country-heading">
          ${result.kind === "country" ? countryFlagIconHtml(result.raw, "country-flag-inline") : result.color ? `<span class="country-color" style="${colorStyle(result.color)}" aria-hidden="true"></span>` : ""}
          ${globalSearchResultIdentifier(result) ? `<span class="tag">${escapeHtml(globalSearchResultIdentifier(result))}</span>` : ""}
          <span class="name">${escapeHtml(result.displayTitle || result.title)}</span>
        </span>
        <span class="minor country-meta">${escapeHtml(result.subtitle || result.searchHint || "")}</span>
      </button>
    `).join("")}
  `).join("");
  els.countryList.querySelectorAll("[data-global-result]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.selectedGlobalResult = button.dataset.globalResult;
      render();
    });
  });
}

function renderGlobalSearchDialogResults() {
  if (!els.globalSearchDialogResults) return;
  const results = globalSearchResults(state.globalSearch);
  if (!state.globalSearch) {
    els.globalSearchDialogResults.innerHTML = `<p class="empty">${t("search.enterQuery")}</p>`;
    return;
  }
  if (!results.length) {
    els.globalSearchDialogResults.innerHTML = `<p class="empty">${t("search.noResults")}</p>`;
    return;
  }
  const groups = [];
  for (const result of results) {
    let group = groups.find((item) => item.label === result.typeLabel);
    if (!group) {
      group = { label: result.typeLabel, items: [] };
      groups.push(group);
    }
    group.items.push(result);
  }
  let itemIndex = 0;
  els.globalSearchDialogResults.innerHTML = groups.map((group) => `
    <div class="list-section-title">${escapeHtml(group.label)}</div>
    ${group.items.map((result) => {
      const active = itemIndex === state.globalSearchActiveIndex;
      const badge = globalSearchResultBadge(result);
      const html = `
        <button class="country-row global-result-row ${badge ? "global-result-row--with-icon" : "global-result-row--compact"}" type="button" data-global-dialog-result="${escapeHtml(result.id)}" data-result-kind="${escapeHtml(result.kind)}" data-result-key="${escapeHtml(result.navigationKey || result.key)}" aria-selected="${active}">
          ${badge}
          <span class="global-search-result-content">
            <span class="country-heading">
              ${globalSearchResultIdentifier(result) ? `<span class="tag">${escapeHtml(globalSearchResultIdentifier(result))}</span>` : ""}
              <span class="name">${escapeHtml(result.displayTitle || result.title)}</span>
            </span>
            ${(result.subtitle || result.searchHint) ? `<span class="minor country-meta">${escapeHtml(result.subtitle || result.searchHint || "")}</span>` : ""}
            ${result.matchExcerpt ? `<span class="minor global-search-match-excerpt">${escapeHtml(result.matchExcerpt)}</span>` : ""}
          </span>
        </button>
      `;
      itemIndex += 1;
      return html;
    }).join("")}
  `).join("");
  els.globalSearchDialogResults.querySelectorAll("[data-global-dialog-result]").forEach((button, index) => {
    button.addEventListener("click", async () => {
      state.globalSearchActiveIndex = index;
      await navigateGlobalSearchResult(button.dataset.resultKind, button.dataset.resultKey);
      closeGlobalSearchDialog();
    });
  });
  updateGlobalSearchActiveDescendant();
}

function updateGlobalSearchActiveDescendant() {
  const items = [...(els.globalSearchDialogResults?.querySelectorAll("[data-global-dialog-result]") || [])];
  items.forEach((item, index) => {
    item.setAttribute("aria-selected", String(index === state.globalSearchActiveIndex));
    if (index === state.globalSearchActiveIndex) item.scrollIntoView({ block: "nearest" });
  });
}

async function navigateGlobalSearchResult(kind, key) {
  if (!kind || !key) return;
  if (kind !== "country") state.globalSearchColorRestoreTag = "";
  if (kind === "interestGroupFlavor") {
    const [groupKey, flavorKey] = key.split(":");
    if (!groupKey || !flavorKey) return;
    replaceHash(interestGroupFlavorRoute(groupKey, flavorKey));
    await applyHash();
    render();
    return;
  }
  if (kind === "country") {
    state.globalSearchColorRestoreTag = key.toUpperCase();
    replaceHash(`/country/${encodeURIComponent(key)}`);
  }
  else if (kind === "culture") replaceHash(`/culture/${encodeURIComponent(key)}`);
  else if (kind === "stateRegion") replaceHash(`/state-region/${encodeURIComponent(key)}`);
  else if (kind === "strategicRegion") replaceHash(`/strategic-region/${encodeURIComponent(key)}`);
  else if (kind === "geographicRegion") replaceHash(`/geographic-region/${encodeURIComponent(key)}`);
  else if (kind === "company") replaceHash(`/company/${encodeURIComponent(key)}`);
  else if (kind === "ideology") replaceHash(`/ideology/${encodeURIComponent(key)}`);
  else if (kind === "interestGroup") replaceHash(`/interest-group/${encodeURIComponent(key)}`);
  else if (kind === "law") replaceHash(`/law/${encodeURIComponent(key)}`);
  else if (kind === "technology") replaceHash(`/technology/${encodeURIComponent(key)}`);
  else if (kind === "achievement") replaceHash(`/achievement/${encodeURIComponent(key)}`);
  else if (kind === "building") replaceHash(`/building/${encodeURIComponent(key)}`);
  else if (kind === "goods") replaceHash(`/goods/${encodeURIComponent(key)}`);
  else if (kind === "journal") replaceHash(`/journal/${encodeURIComponent(key)}`);
  else if (kind === "event") replaceHash(`/event/${encodeURIComponent(key)}`);
  else if (kind === "decision") replaceHash(`/decision/${encodeURIComponent(key)}`);
  else if (kind === "character") replaceHash(`/character/${encodeURIComponent(key)}`);
  else if (kind === "namePool") replaceHash(`/name-pool/${encodeURIComponent(key)}`);
  else if (kind === "prestigeGood") {
    const good = prestigeGoodByKey.get(key);
    if (!good?.base_good_key) return;
    replaceHash(`/goods/${encodeURIComponent(good.base_good_key)}`);
  }
  else if (kind === "productionMethodGroup" || kind === "productionMethod") {
    const buildingKey = globalSearchEconomyBuildingKey(kind, key);
    if (!buildingKey) return;
    replaceHash(`/building/${encodeURIComponent(buildingKey)}`);
  }
  else return;
  await applyHash();
  render();
}

function renderGlobalSearchDetail(result) {
  if (!result) {
    els.detail.innerHTML = `<p class="empty">${t("search.noResults")}</p>`;
    return;
  }
  if (result.kind === "country") return renderCountryDetail(byTag.get(result.key));
  if (result.kind === "culture") return renderCultureDetail(byCulture.get(result.key));
  if (result.kind === "character") return renderHistoricalCharacterDetail(byHistoricalCharacter.get(result.key));
  if (result.kind === "namePool") return renderNamePoolDetail(byNamePool.get(result.key));
  if (result.kind === "stateRegion") return renderStateRegionDetail(byStateRegion.get(result.key));
  if (result.kind === "strategicRegion") return renderStrategicRegionDetail(byStrategicRegion.get(result.key));
  if (result.kind === "geographicRegion") return renderGeographicRegionDetail(byGeographicRegion.get(result.key));
  if (result.kind === "company") return renderCompanyDetail(byCompany.get(result.key));
  if (result.kind === "ideology") return renderIdeologyDetail(ideologyByKey.get(result.key));
  if (result.kind === "law") return renderLawDetail(lawByKey.get(result.key));
  if (result.kind === "cultureTrait" || result.kind === "cultureTraitGroup") return renderCultureTraitDetail(result);
  if (result.kind === "interestGroup") return renderInterestGroupDetail(result);
  if (result.kind === "interestGroupTrait") return renderInterestGroupTraitDetail(result);
  if (result.kind === "interestGroupFlavor") {
    const group = byInterestGroup.get(result.interestGroupKey);
    const flavor = interestGroupVariants(group).find((item) => item.key === result.key);
    if (group && flavor) {
      els.detail.innerHTML = renderInterestGroupFlavorBoardDetail(group, flavor);
      return;
    }
  }
  els.detail.innerHTML = `
    <div class="detail-title">
      <div class="detail-title-main"><h2>${escapeHtml(result.title)}</h2></div>
      <span class="tag">${escapeHtml(result.typeLabel)}</span>
    </div>
    <dl class="field-grid">
      ${field("编号", escapeHtml(result.key))}
      ${field("类型", escapeHtml(result.typeLabel))}
    </dl>
  `;
}

function globalSearchResults(query) {
  const needle = normalizeSearchText(query);
  if (!needle) return [];
  const results = (window.VIC3_SEARCH_INDEX?.entries || []).flatMap((entry) => {
    const names = Object.values(entry.names || {}).filter(Boolean);
    const localizedAliases = entry.aliases?.[localeRuntime.current] || [];
    const otherAliases = Object.entries(entry.aliases || {})
      .filter(([locale]) => locale !== localeRuntime.current)
      .flatMap(([, values]) => values || []);
    const internalAliases = entry.internalAliases || [];
    const groupNames = Object.values(entry.groupNames || {}).filter(Boolean);
    const countryNames = entry.kind === "interestGroupFlavor"
      ? (entry.countryTags || []).map((tag) => entityText(byTag.get(tag) || { tag }))
      : [];
    const haystack = normalizeSearchText([entry.key, entry.groupKey, entry.interestGroupKey, ...(entry.countryTags || []), ...countryNames, ...names, ...localizedAliases, ...otherAliases, ...internalAliases, ...groupNames].join(" "));
    const defaultMatch = haystack.includes(needle);
    const detail = state.globalSearchDetailed ? ensureGlobalSearchDetailCache().get(entry.id) : null;
    const detailedMatch = Boolean(detail?.text.includes(needle));
    if (!defaultMatch && !detailedMatch) return [];
    const title = entry.names?.[localeRuntime.current] || entry.names?.en || entry.key;
    const aliases = [...new Set(names.filter((name) => name !== title))];
    const matchedAlias = localizedAliases.find((alias) => normalizeSearchText(alias).includes(needle)) || "";
    const normalizedTitle = normalizeSearchText(title);
    const normalizedKey = normalizeSearchText(entry.key);
    const normalizedCurrentAliases = localizedAliases.map((value) => normalizeSearchText(value));
    const normalizedOtherAliases = otherAliases.map((value) => normalizeSearchText(value));
    const normalizedInternalAliases = internalAliases.map((value) => normalizeSearchText(value));
    const score = !defaultMatch
      ? 1000 + detail.text.indexOf(needle)
      : normalizedTitle === needle
        ? 0
        : normalizedCurrentAliases.includes(needle)
          ? 1
          : normalizedKey === needle
            ? 2
            : normalizedTitle.startsWith(needle)
              ? 3
              : normalizedCurrentAliases.some((value) => value.startsWith(needle))
                ? 4
                : [...normalizedOtherAliases, ...Object.values(entry.names || {}).map((value) => normalizeSearchText(value))]
                    .some((value) => value === needle || value.startsWith(needle))
                  ? 5
                  : normalizedInternalAliases.some((value) => value === needle || value.startsWith(needle))
                    ? 6
                    : haystack.indexOf(needle) + 20;
    const kind = searchResultKind(entry.kind);
    const result = {
      ...entry,
      kind,
      typeLabel: t(`entity.${kind}`),
      title,
      aliases,
      matchedAlias,
      raw: searchResultEntity(kind, entry.key, entry),
      subtitle: matchedAlias ? title : globalSearchResultSubtitle(kind, entry),
      matchExcerpt: !defaultMatch && detailedMatch ? globalSearchMatchExcerpt(detail, needle) : "",
      countryTags: entry.countryTags || [],
      score,
    };
    return [{ ...result, displayTitle: globalSearchDisplayTitle(result, needle) }];
  });
  const order = new Map(["country", "culture", "character", "namePool", "stateRegion", "geographicRegion", "cultureTrait", "cultureTraitGroup", "strategicRegion", "company", "ideology", "law", "technology", "achievement", "journal", "event", "decision", "interestGroup", "interestGroupTrait", "interestGroupFlavor"].map((kind, index) => [kind, index]));
  return results
    .sort((a, b) => a.score - b.score || orderValue(order, a.kind) - orderValue(order, b.kind) || localizedCompare(a.title, b.title))
    .slice(0, 120);
}

function searchResultKind(kind) {
  return kind === "region" ? "stateRegion" : kind;
}

function globalSearchResultSubtitle(kind, entry) {
  if (kind === "interestGroupFlavor") return entityText(byInterestGroup.get(entry.interestGroupKey));
  if (!["journal", "event", "decision"].includes(kind)) return "";
  const groupName = entry.groupNames?.[localeRuntime.current] || entry.groupNames?.en || entry.groupKey || "";
  return [entry.key, groupName].filter(Boolean).join(" · ");
}

function ensureGlobalSearchDetailCache() {
  if (globalSearchDetailCache) return globalSearchDetailCache;
  globalSearchDetailCache = new Map();
  for (const row of journalEntries) addGlobalSearchDetail("journal", journalId(row), [
    row.locales?.zhHans?.reason, row.locales?.en?.reason, row.is_shown_when_inactive_raw,
    row.possible_raw, row.complete_raw, row.fail_raw, row.invalid_raw, row.on_complete_raw,
    row.on_fail_raw, row.on_timeout_raw, row.source_file, ...(row.source_files || []).map((item) => item.file), row.raw,
  ]);
  for (const row of contentEvents) addGlobalSearchDetail("event", row.id || row.script_key, [
    row.locales?.zhHans?.desc, row.locales?.en?.desc, row.locales?.zhHans?.flavor, row.locales?.en?.flavor,
    ...Object.values(row.locales?.zhHans?.options || {}), ...Object.values(row.locales?.en?.options || {}),
    ...(row.options || []).map((option) => option.raw), row.trigger_raw, row.immediate_raw, row.source_file,
    ...(row.source_files || []).map((item) => item.file), row.raw,
  ]);
  for (const row of decisions) addGlobalSearchDetail("decision", decisionId(row), [
    row.locales?.zhHans?.desc, row.locales?.en?.desc, row.is_shown_raw, row.possible_raw,
    row.when_taken_raw, row.ai_chance_raw, row.source_file, ...(row.source_files || []).map((item) => item.file), row.raw,
  ]);
  return globalSearchDetailCache;
}

function addGlobalSearchDetail(kind, key, values) {
  const segments = values.filter(Boolean).map((value) => String(value).replace(/\s+/g, " ").trim()).filter(Boolean);
  globalSearchDetailCache.set(`${kind}:${key}`, { segments, text: normalizeSearchText(segments.join(" ")) });
}

function globalSearchMatchExcerpt(detail, needle) {
  const segment = detail?.segments?.find((value) => normalizeSearchText(value).includes(needle)) || "";
  if (!segment) return "";
  const index = normalizeSearchText(segment).indexOf(needle);
  const start = Math.max(0, index - 48);
  const end = Math.min(segment.length, index + needle.length + 72);
  return `${start ? "…" : ""}${segment.slice(start, end)}${end < segment.length ? "…" : ""}`;
}

function searchResultEntity(kind, key, entry = null) {
  if (kind === "country") return byTag.get(key);
  if (kind === "culture") return byCulture.get(key);
  if (kind === "stateRegion") return byStateRegion.get(key);
  if (kind === "strategicRegion") return byStrategicRegion.get(key);
  if (kind === "geographicRegion") return byGeographicRegion.get(key);
  if (kind === "company") return byCompany.get(key);
  if (kind === "ideology") return ideologyByKey.get(key);
  if (kind === "law") return lawByKey.get(key);
  if (kind === "technology") return technologyByKey.get(key);
  if (kind === "achievement") return achievementByKey.get(key);
  if (kind === "building") return buildingRecordByKey.get(key);
  if (kind === "goods") return goodByKey.get(key);
  if (kind === "prestigeGood") return prestigeGoodByKey.get(key);
  if (kind === "journal") return journalEntries.find((row) => journalId(row) === key);
  if (kind === "event") return eventByKey.get(key);
  if (kind === "decision") return decisions.find((row) => decisionId(row) === key);
  if (kind === "productionMethodGroup") return productionMethodGroupByKey.get(key);
  if (kind === "productionMethod") return productionMethodByKey.get(key);
  if (kind === "cultureTrait") return cultureTraitByKey.get(key);
  if (kind === "interestGroup") return interestGroups.find((item) => item.key === key);
  if (kind === "interestGroupTrait") return interestGroupTraitByKey.get(key);
  if (kind === "interestGroupFlavor") return byInterestGroup.get(entry?.interestGroupKey);
  if (kind === "character") return byHistoricalCharacter.get(key);
  if (kind === "namePool") return byNamePool.get(key);
  return null;
}

function globalSearchResultBadge(result) {
  const badge = renderEntityBadge(result.kind, result.raw || result, result.displayTitle || result.title);
  return badge.includes("<img") ? badge : "";
}

function globalSearchResultIdentifier(result) {
  return result.kind === "country" || ["journal", "event", "decision"].includes(result.kind) ? result.key : "";
}

function globalSearchEconomyBuildingKey(kind, key) {
  if (kind === "productionMethodGroup") {
    return buildings.find((building) => (building.production_method_group_keys || []).includes(key))?.key || "";
  }
  return buildings.find((building) => (building.production_method_group_keys || []).some((groupKey) => (
    productionMethodGroupByKey.get(groupKey)?.production_method_keys?.includes(key)
  )))?.key || "";
}

function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase();
}

function renderCultureTraitDetail(result) {
  const trait = result.kind === "cultureTrait" ? cultureTraitByKey.get(result.key) : null;
  const group = result.kind === "cultureTraitGroup" ? cultureTraitGroupByKey.get(result.key) : null;
  const relatedCultures = cultures.filter((culture) => {
    if (trait) {
      return [culture.heritage, culture.language, ...(culture.traditions || [])].some((item) => item?.key === trait.key);
    }
    if (group) {
      return [culture.heritage_group, culture.language_group].some((item) => item?.key === group.key);
    }
    return false;
  }).sort(sortCultures);
  const title = entityText(trait || group) || result.title;
  els.detail.innerHTML = `
    <div class="detail-title">
      <div class="detail-title-main"><h2>${escapeHtml(title)}</h2></div>
      <span class="tag">${escapeHtml(result.typeLabel)}</span>
    </div>
    <dl class="field-grid">
      ${field("编号", escapeHtml(result.key))}
      ${field("类型", escapeHtml(result.typeLabel))}
      ${field("所属组", escapeHtml(entityText(trait, "groupName", "") || entityText(group, "type", "")))}
      ${field("相关文化", cultureLinks(relatedCultures))}
    </dl>
  `;
}

function renderInterestGroupDetail(result) {
  const group = byInterestGroup.get(result.key);
  if (!group) {
    els.detail.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  els.detail.innerHTML = `
    <div class="detail-title">
      <div class="detail-title-main">
        ${interestGroupIconHtml(group)}
        <h2>${escapeHtml(entityText(group))}</h2>
      </div>
      <span class="tag">${escapeHtml(group.key)}</span>
    </div>
    <dl class="field-grid">
      ${field("标准色", colorValue(group.color?.hex, group.color?.rgb))}
      ${field("意识形态", ideologyPills(group.ideologies, "tag-ideology"))}
      ${field("角色意识形态", ideologyPills(group.character_ideologies, "tag-tradition"))}
      ${field("基础特质", interestGroupTraitDetailsHtml(group.base_traits, false))}
    </dl>
  `;
}

function renderInterestGroupTraitDetail(result) {
  const trait = interestGroupTraitByKey.get(result.key);
  if (!trait) {
    els.detail.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  els.detail.innerHTML = `
    <div class="detail-title">
      <div class="detail-title-main"><h2>${escapeHtml(entityText(trait))}</h2></div>
      <span class="tag">${escapeHtml(trait.key)}</span>
    </div>
    ${interestGroupTraitDetailCard(trait)}
  `;
}
