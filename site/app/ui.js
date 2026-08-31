function bindTopbarNavigationMenus() {
  const desktopHover = window.matchMedia("(min-width: 761px) and (hover: hover) and (pointer: fine)");
  const groups = [...document.querySelectorAll(".topbar-nav-group")];
  const closeTimers = new Map();
  const closeOthers = (current) => groups.forEach((group) => {
    if (group !== current) group.open = false;
  });
  const cancelClose = (group) => {
    const timer = closeTimers.get(group);
    if (timer) clearTimeout(timer);
    closeTimers.delete(group);
  };
  const scheduleClose = (group) => {
    cancelClose(group);
    closeTimers.set(group, setTimeout(() => {
      group.open = false;
      closeTimers.delete(group);
    }, 180));
  };
  const syncHoverState = () => {
    groups.forEach((group) => {
      group.onpointerenter = null;
      group.onpointerleave = null;
      cancelClose(group);
    });
    if (!desktopHover.matches) return;
    groups.forEach((group) => {
      group.onpointerenter = () => {
        cancelClose(group);
        closeOthers(group);
        group.open = true;
      };
      group.onpointerleave = () => {
        scheduleClose(group);
      };
    });
  };
  syncHoverState();
  desktopHover.addEventListener?.("change", syncHoverState);
  groups.forEach((group) => {
    group.addEventListener("focusin", () => {
      if (!desktopHover.matches) return;
      closeOthers(group);
      group.open = true;
    });
    group.addEventListener("focusout", (event) => {
      if (!desktopHover.matches) return;
      if (!group.contains(event.relatedTarget)) group.open = false;
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeTopbarNavigationMenus();
  });
}

function closeTopbarNavigationMenus() {
  document.querySelectorAll(".topbar-nav-group[open]").forEach((group) => {
    group.open = false;
  });
}

function syncTopbarNavigationGroups() {
  document.querySelectorAll(".topbar-nav-group").forEach((group) => {
    const current = [...group.querySelectorAll("[data-nav-view]")]
      .some((button) => button.dataset.navView === state.view);
    group.classList.toggle("is-current", current);
  });
}

function isMapView(view) {
  return ["country", "culture", "region"].includes(view);
}

function isContentView(view) {
  return ["company", "ideology", "law", "technology", "event", "journal", "decision"].includes(view);
}

function routeHashParts() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  return {
    parts: path.split("/").filter(Boolean),
    query: new URLSearchParams(query),
  };
}

function mapFullscreenRequested() {
  return routeHashParts().query.get("map") === "fullscreen"
    && window.matchMedia("(max-width: 760px)").matches;
}

const countryDetailTabKeys = ["variants", "society", "regions", "technology", "laws", "diplomacy", "interest-groups", "flavor"];
const countryInterestGroupTabKeys = ["ig_armed_forces", "ig_devout", "ig_industrialists", "ig_intelligentsia", "ig_landowners", "ig_petty_bourgeoisie", "ig_rural_folk", "ig_trade_unions"];
const countryFlavorTabKeys = ["journal", "event", "decision"];

function countryDetailRoute(tag, tab = "variants", subtab = "", flavorTab = "") {
  const params = new URLSearchParams();
  if (countryDetailTabKeys.includes(tab) && tab !== "variants") params.set("tab", tab);
  if (tab === "interest-groups" && countryInterestGroupTabKeys.includes(subtab)) params.set("ig", subtab);
  if (tab === "flavor" && countryFlavorTabKeys.includes(flavorTab)) params.set("flavor", flavorTab);
  const query = params.toString();
  return `/country/${encodeURIComponent(tag)}${query ? `?${query}` : ""}`;
}

function countryDetailTabFromQuery(query) {
  const tab = query?.get("tab") || "variants";
  return countryDetailTabKeys.includes(tab) ? tab : "variants";
}

function countryInterestGroupTabFromQuery(query) {
  const key = query?.get("ig") || "";
  return countryInterestGroupTabKeys.includes(key) ? key : "";
}

function countryFlavorTabFromQuery(query) {
  const key = query?.get("flavor") || "journal";
  return countryFlavorTabKeys.includes(key) ? key : "journal";
}

function openDetailRoute(view, key) {
  replaceHash(`/${view}/${encodeURIComponent(key)}`);
}

function returnToBoardRoute(view) {
  replaceHash(`/${view}`);
}

function syncMapFullscreenControls() {
  const enabled = isMapView(state.view);
  const narrow = window.matchMedia("(max-width: 760px)").matches;
  if (els.mapFullscreenButton) els.mapFullscreenButton.hidden = !enabled || !narrow || state.mapFullscreen;
  if (els.mapCollapseButton) els.mapCollapseButton.hidden = !state.mapFullscreen;
}

function createMapFullscreenSnapshot() {
  const filterKeys = [
    "flags", "tiers", "types", "strategicRegions", "heritageGroups", "heritages",
    "languageGroups", "languages", "resourceFilters", "stateTraitFilters", "companyKinds",
    "companyPrestigeGoods", "companyDlcs",
  ];
  return {
    view: state.view,
    selectedTag: state.selectedTag,
    selectedCulture: state.selectedCulture,
    selectedStateRegion: state.selectedStateRegion,
    mapSelectedStateRegion: state.mapSelectedStateRegion,
    selectedStrategicRegion: state.selectedStrategicRegion,
    selectedGeographicRegion: state.selectedGeographicRegion,
    selectedCompany: state.selectedCompany,
    listScrollTop: document.querySelector(".results")?.scrollTop || window.scrollY || 0,
    mapTransform: { ...mapRuntime.transform },
    filters: Object.fromEntries(filterKeys.map((key) => [key, [...state[key]]])),
  };
}

function restoreMapFullscreenSnapshot(snapshot) {
  if (!snapshot) return;
  for (const [key, values] of Object.entries(snapshot.filters || {})) state[key] = new Set(values);
  for (const key of [
    "selectedTag", "selectedCulture", "selectedStateRegion", "mapSelectedStateRegion",
    "selectedStrategicRegion", "selectedGeographicRegion", "selectedCompany",
  ]) state[key] = snapshot[key] || "";
  if (snapshot.mapTransform) mapRuntime.transform = { ...snapshot.mapTransform };
  requestAnimationFrame(() => {
    const results = document.querySelector(".results");
    if (results) results.scrollTop = snapshot.listScrollTop || 0;
    else window.scrollTo(0, snapshot.listScrollTop || 0);
    paintMapCanvas?.();
  });
}

function enterMapFullscreen() {
  if (!isMapView(state.view) || !window.matchMedia("(max-width: 760px)").matches || state.mapFullscreen) return;
  state.mapFullscreenSnapshot = createMapFullscreenSnapshot();
  state.mapFullscreenReturn = { view: state.view };
  replaceHash(`/${state.view}?map=fullscreen`);
  void applyHash().then(render);
}

function exitMapFullscreen() {
  if (!state.mapFullscreen) return;
  const snapshot = state.mapFullscreenSnapshot;
  const view = state.mapFullscreenReturn?.view || snapshot?.view || state.view;
  state.mapFullscreen = false;
  replaceHash(`/${view}`);
  restoreMapFullscreenSnapshot(snapshot);
  state.mapFullscreenSnapshot = null;
  state.mapFullscreenReturn = null;
  void applyHash().then(render);
}

function updateBackToTopButton() {
  if (!els.backToTopButton) return;
  els.backToTopButton.hidden = window.scrollY < 160;
}

function bindEvents() {
  bindTopbarNavigationMenus();
  els.backToTopButton?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  window.addEventListener("scroll", updateBackToTopButton, { passive: true });
  updateBackToTopButton();
  els.languageMenuButton?.addEventListener("click", () => {
    const open = els.languageMenu?.hidden !== false;
    if (els.languageMenu) els.languageMenu.hidden = !open;
    els.languageMenuButton.setAttribute("aria-expanded", String(open));
  });
  els.languageMenu?.addEventListener("click", (event) => {
    const option = event.target.closest("[data-locale]");
    if (option) void switchLocale(option.dataset.locale);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLanguageMenu();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".language-menu")) closeLanguageMenu();
  });
  document.querySelectorAll("[data-nav-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      closeTopbarNavigationMenus();
      await setView(button.dataset.navView);
      render();
    });
  });
  els.settingsNavButton?.addEventListener("click", () => {
    openInfoDialog("settings");
  });
  els.aboutNavButton?.addEventListener("click", () => {
    openInfoDialog("about");
  });
  els.globalSearchButton?.addEventListener("click", openGlobalSearchDialog);
  els.globalSearchCloseButton?.addEventListener("click", closeGlobalSearchDialog);
  els.globalSearchDialog?.addEventListener("click", (event) => {
    if (event.target === els.globalSearchDialog) closeGlobalSearchDialog();
  });
  els.infoDialogCloseButton?.addEventListener("click", closeInfoDialog);
  els.infoDialog?.addEventListener("click", (event) => {
    if (event.target === els.infoDialog) closeInfoDialog();
  });
  els.globalSearchDialogInput?.addEventListener("input", () => {
    state.globalSearch = els.globalSearchDialogInput.value.trim().toLowerCase();
    state.globalSearchActiveIndex = 0;
    renderGlobalSearchDialogResults();
  });
  els.globalSearchDetailedToggle?.addEventListener("change", () => {
    state.globalSearchDetailed = els.globalSearchDetailedToggle.checked;
    state.globalSearchActiveIndex = 0;
    if (state.globalSearchDetailed) ensureGlobalSearchDetailCache();
    renderGlobalSearchDialogResults();
  });
  els.globalSearchLegacyToggle?.addEventListener("change", () => {
    state.globalSearchIncludeLegacy = els.globalSearchLegacyToggle.checked;
    renderGlobalSearchDialogResults();
  });
  document.addEventListener("keydown", handleGlobalSearchDialogKeydown);
  document.addEventListener("keydown", handleInfoDialogKeydown);
  document.addEventListener("click", async (event) => {
    const incorporationLink = event.target.closest("[data-incorporation-country]");
    if (incorporationLink) {
      event.preventDefault();
      replaceHash("/culture/incorporation");
      await applyHash();
      incorporationCalculatorInitializeFromCountry(incorporationLink.dataset.incorporationCountry);
      render();
      return;
    }
    const button = event.target.closest("[data-detail-back]");
    if (!button) return;
    if (button.matches("[data-country-mobile-detail-back]") && window.matchMedia("(max-aspect-ratio: 3 / 2)").matches) state.countryMobileRestoreScrollPending = true;
    if (button.matches("[data-culture-mobile-detail-back]") && window.matchMedia("(max-aspect-ratio: 3 / 2)").matches) state.cultureMobileRestoreScrollPending = true;
    await setView(button.dataset.detailBack || "country");
    render();
  });
  els.countryViewButton?.addEventListener("click", async () => {
    await setView("country");
    render();
  });
  els.cultureViewButton?.addEventListener("click", async () => {
    await setView("culture");
    render();
  });
  els.cultureIncorporationEntry?.addEventListener("click", async () => {
    replaceHash("/culture/incorporation");
    await applyHash();
    render();
  });
  els.regionViewButton?.addEventListener("click", async () => {
    await setView("region");
    render();
  });
  els.companyViewButton?.addEventListener("click", async () => {
    await setView("company");
    render();
  });
  els.ideologyViewButton?.addEventListener("click", async () => {
    await setView("ideology");
    render();
  });
  els.lawViewButton?.addEventListener("click", async () => {
    await setView("law");
    render();
  });
  els.viewSelect?.addEventListener("change", async () => {
    await setView(els.viewSelect.value);
    render();
  });
  els.librarySelect?.addEventListener("change", () => {
    hideTransientOverlays();
    const entry = libraryEntry(els.librarySelect.value);
    if (!entry || entry.id === "vic3") {
      els.librarySelect.value = "vic3";
      return;
    }
    const url = new URL(entry.href, window.location.href);
    url.searchParams.set("lang", localeRuntime.current);
    location.assign(url.href);
  });
  els.standaloneLibrarySelect?.addEventListener("change", () => {
    if (els.standaloneLibrarySelect.value !== "vic3") return;
    hideTransientOverlays();
    const url = new URL("../index.html", window.location.href);
    url.searchParams.set("lang", localeRuntime.current);
    location.assign(url.href);
  });
  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value.trim().toLowerCase();
    state.countryMobileSearchDraft = els.searchInput.value;
    state.cultureMobileSearchDraft = els.searchInput.value;
    state.globalSearchColorRestoreTag = "";
    render();
  });
  els.eventSearchInput?.addEventListener("input", () => {
    state.search = els.eventSearchInput.value.trim().toLowerCase();
    render();
  });
  els.eventResetButton?.addEventListener("click", () => {
    state.search = "";
    state.eventTypes.clear();
    state.eventFlavorKinds.clear();
    state.eventTags.clear();
    if (els.eventSearchInput) els.eventSearchInput.value = "";
    render();
  });
  els.mobileCountryToolbar?.addEventListener("input", (event) => {
    const input = event.target.closest("[data-mobile-country-search]");
    if (!input) return;
    state.countryMobileSearchDraft = input.value;
  });
  els.mobileCountryToolbar?.addEventListener("keydown", (event) => {
    const input = event.target.closest("[data-mobile-country-search]");
    if (!input || event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    submitMobileCountrySearch(input);
  });
  els.mobileCountryToolbar?.addEventListener("focusin", (event) => {
    const input = event.target.closest("[data-mobile-country-search]");
    if (!input) return;
    input.closest(".mobile-country-search-input")?.scrollTo({ left: 99999 });
  });
  els.mobileCountryToolbar?.addEventListener("click", (event) => {
    if (event.target.closest("[data-mobile-country-search-submit]")) {
      const input = els.mobileCountryToolbar.querySelector("[data-mobile-country-search]");
      submitMobileCountrySearch(input);
      return;
    }
    if (event.target.closest("[data-mobile-country-filter-toggle]")) {
      state.countryMobileFiltersOpen = !state.countryMobileFiltersOpen;
      render();
      return;
    }
    if (event.target.closest("[data-mobile-country-map-toggle]")) {
      state.countryMobileMapOpen = !state.countryMobileMapOpen;
      render();
      return;
    }
    const clear = event.target.closest("[data-mobile-country-filter-clear]");
    if (clear) {
      clearCountryMobileFilter(clear.dataset.mobileCountryFilterClear);
      render();
    }
  });
  els.mobileCountryFilterPanel?.addEventListener("click", (event) => {
    const category = event.target.closest("[data-mobile-country-filter-category]");
    if (category) {
      state.countryMobileFilterCategory = category.dataset.mobileCountryFilterCategory;
      render();
      return;
    }
    const option = event.target.closest("[data-mobile-country-filter-option]");
    if (option) {
      selectCountryMobileFilter(state.countryMobileFilterCategory, option.dataset.mobileCountryFilterOption);
      render();
    }
  });
  els.mobileCultureToolbar?.addEventListener("input", (event) => {
    const input = event.target.closest("[data-mobile-culture-search]");
    if (input) state.cultureMobileSearchDraft = input.value;
  });
  els.mobileCultureToolbar?.addEventListener("keydown", (event) => {
    const input = event.target.closest("[data-mobile-culture-search]");
    if (!input || event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    submitMobileCultureSearch(input);
  });
  els.mobileCultureToolbar?.addEventListener("focusin", (event) => {
    const input = event.target.closest("[data-mobile-culture-search]");
    if (input) input.closest(".mobile-culture-search-input")?.scrollTo({ left: 99999 });
  });
  els.mobileCultureToolbar?.addEventListener("click", (event) => {
    if (event.target.closest("[data-mobile-culture-search-submit]")) {
      submitMobileCultureSearch(els.mobileCultureToolbar.querySelector("[data-mobile-culture-search]"));
      return;
    }
    if (event.target.closest("[data-mobile-culture-filter-toggle]")) {
      state.cultureMobileFiltersOpen = !state.cultureMobileFiltersOpen;
      render();
      return;
    }
    if (event.target.closest("[data-mobile-culture-map-toggle]")) {
      state.cultureMobileMapOpen = !state.cultureMobileMapOpen;
      render();
      return;
    }
    const clear = event.target.closest("[data-mobile-culture-filter-clear]");
    if (clear) {
      clearCultureMobileFilter(clear.dataset.mobileCultureFilterClear);
      render();
    }
  });
  els.mobileCultureFilterPanel?.addEventListener("click", (event) => {
    const heritageGroup = event.target.closest("[data-mobile-culture-expand-heritage-group]");
    if (heritageGroup) {
      const key = heritageGroup.dataset.mobileCultureExpandHeritageGroup;
      state.cultureMobileExpandedHeritageGroup = state.cultureMobileExpandedHeritageGroup === key ? "" : key;
      render();
      return;
    }
    const languageGroup = event.target.closest("[data-mobile-culture-expand-language-group]");
    if (languageGroup) {
      const key = languageGroup.dataset.mobileCultureExpandLanguageGroup;
      state.cultureMobileExpandedLanguageGroup = state.cultureMobileExpandedLanguageGroup === key ? "" : key;
      render();
      return;
    }
    const continent = event.target.closest("[data-mobile-culture-expand-strategic-region-continent]");
    if (continent) {
      const key = continent.dataset.mobileCultureExpandStrategicRegionContinent;
      state.cultureMobileExpandedStrategicRegionContinent = state.cultureMobileExpandedStrategicRegionContinent === key ? "" : key;
      render();
      return;
    }
    const clear = event.target.closest("[data-mobile-culture-filter-clear-option]");
    if (clear) {
      clearCultureMobileFilter(clear.dataset.mobileCultureFilterClearOption);
      render();
      return;
    }
    const option = event.target.closest("[data-mobile-culture-filter-option]");
    if (option) {
      selectCultureMobileFilter(option.dataset.mobileCultureFilterCategory, option.dataset.mobileCultureFilterOption);
      render();
      return;
    }
    const category = event.target.closest("[data-mobile-culture-filter-category]");
    if (category) {
      state.cultureMobileFilterCategory = category.dataset.mobileCultureFilterCategory;
      render();
    }
  });

  bindTokenSet("[data-filter]", state.flags, "filter");
  bindTokenSet("[data-tier]", state.tiers, "tier");
  bindTokenSet("[data-type]", state.types, "type");
  els.filteredCountryMapToggle?.addEventListener("click", () => {
    state.dimUnfilteredCountries = !state.dimUnfilteredCountries;
    render();
  });
  bindContainerTokenSet(els.strategicRegionFilters, state.strategicRegions, "strategicRegion");
  els.geographicRegionFilters?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-geographic-region-filter]");
    if (!button || !els.geographicRegionFilters.contains(button)) return;
    const value = button.dataset.geographicRegionFilter;
    state.selectedGeographicRegion = state.selectedGeographicRegion === value ? "" : value;
    render();
  });
  bindResourceFilterTokens();
  bindStateTraitFilterTokens();
  bindTokenChoice(els.industryCharterFilters, "industryCharter", () => {
    state.includeIndustryCharter = !state.includeIndustryCharter;
    renderCompanyFilterOptions();
    render();
  });
  bindContainerTokenSet(els.companyKindFilters, state.companyKinds, "companyKind");
  bindContainerTokenSet(els.companyPrestigeFilters, state.companyPrestigeGoods, "companyPrestige");
  bindContainerTokenSet(els.companyDlcFilters, state.companyDlcs, "companyDlc");
  bindContainerTokenSet(els.ideologyTypeFilters, state.ideologyTypes, "ideologyType");
  bindContainerTokenSet(els.ideologyGroupFilters, state.ideologyGroups, "ideologyGroup");
  bindContainerTokenSet(els.ideologyOccurrenceFilters, state.ideologyOccurrences, "ideologyOccurrence");
  bindContainerTokenSet(els.ideologyLawGroupFilters, state.ideologyLawGroups, "ideologyLawGroup");
  bindLawGroupFilterTokens();
  els.commonLawIdeologyFilter?.addEventListener("change", () => {
    state.commonLawIdeologyOnly = els.commonLawIdeologyFilter.checked;
    render();
  });
  els.victorianCenturyAddedFilter?.addEventListener("click", () => {
    toggleVictorianCenturyChangeKind("added");
    render();
  });
  els.victorianCenturyAdjustedFilter?.addEventListener("click", () => {
    toggleVictorianCenturyChangeKind("adjusted");
    render();
  });
  bindContainerTokenSet(els.heritageGroupFilters, state.heritageGroups, "heritageGroup", () => {
    renderDependentFilterOptions();
  });
  bindContainerTokenSet(els.heritageGroupFilters, state.heritages, "heritage");
  bindContainerTokenSet(els.languageGroupFilters, state.languageGroups, "languageGroup", () => {
    renderDependentFilterOptions();
  });
  bindContainerTokenSet(els.languageGroupFilters, state.languages, "language");
  bindTokenChoice(els.traditionFilters, "tradition", (value) => {
    state.tradition = state.tradition === value ? "" : value;
    syncTokenGroup(els.traditionFilters, state.tradition);
    render();
  });

  els.sortSelect.addEventListener("change", () => {
    state.sort = els.sortSelect.value;
    render();
  });
  els.mapModeSelect.addEventListener("change", () => {
    state.mapMode = els.mapModeSelect.value;
    state.mapSubject = "";
    render();
  });
  els.mapSubjectSelect.addEventListener("change", () => {
    state.mapSubject = els.mapSubjectSelect.value;
    render();
  });
  els.countryIncorporationMapButton?.addEventListener("click", () => {
    if (state.view !== "country" || !state.selectedTag) return;
    state.countryIncorporationMapEnabled = !state.countryIncorporationMapEnabled;
    if (!state.countryIncorporationMapEnabled) state.incorporationCalculatorCultures.clear();
    render();
  });
  els.terrainMapViewButton?.addEventListener("click", () => {
    const enableTerrain = state.regionMapView !== "terrain";
    state.regionMapView = enableTerrain ? "terrain" : "default";
    if (enableTerrain) state.stateTraitFilters.clear();
    state.mapSubject = "";
    render();
  });
  els.mapFitWidthButton?.addEventListener("click", () => {
    if (state.view === "region") {
      resetRegionMapFocus();
      return;
    }
    fitMapToWidth();
  });
  els.mapFullscreenButton?.addEventListener("click", enterMapFullscreen);
  els.mapCollapseButton?.addEventListener("click", exitMapFullscreen);
  els.leftPanelToggle?.addEventListener("click", () => {
    document.body.classList.toggle("filters-collapsed");
    updatePanelToggleState();
  });
  els.bottomPanelToggle?.addEventListener("click", () => {
    cycleResultsPanelMode();
  });
  bindPrimaryListEvents();
  bindMapEvents();
  bindConceptEvents();
  els.resetButton.addEventListener("click", () => {
    hideTransientOverlays();
    state.search = "";
    state.globalSearch = "";
    state.flags.clear();
    state.tiers.clear();
    state.types.clear();
    state.strategicRegions.clear();
    state.heritageGroups.clear();
    state.heritages.clear();
    state.languageGroups.clear();
    state.languages.clear();
    state.resourceFilters.clear();
    state.stateTraitFilters.clear();
    state.companyKinds.clear();
    state.includeIndustryCharter = false;
    state.companyPrestigeGoods.clear();
    state.companyDlcs.clear();
    state.ideologyTypes.clear();
    state.ideologyGroups.clear();
    state.ideologyOccurrences.clear();
    state.ideologyLawGroups.clear();
    state.lawGroups.clear();
    state.commonLawIdeologyOnly = false;
    state.victorianCenturyChangeKinds.clear();
    state.dimUnfilteredCountries = false;
    state.regionMapView = "default";
    state.tradition = "";
    state.mapSubject = "";
    state.countryMobileFiltersOpen = false;
    state.countryMobileMapOpen = true;
    state.countryMobileSearchDraft = "";
    state.countryMobileFilterCategory = "type";
    state.countryMobileListScrollTop = 0;
    state.countryMobileRestoreScrollPending = false;
    state.cultureMobileFiltersOpen = false;
    state.cultureMobileMapOpen = true;
    state.cultureMobileListScrollTop = 0;
    state.cultureMobileSearchDraft = "";
    state.cultureMobileFilterCategory = "heritage";
    state.cultureMobileExpandedHeritageGroup = "";
    state.cultureMobileExpandedLanguageGroup = "";
    state.cultureMobileExpandedStrategicRegionContinent = "";
    state.cultureMobileRestoreScrollPending = false;
    state.selectedGlobalResult = "";
    els.searchInput.value = "";
    if (els.commonLawIdeologyFilter) els.commonLawIdeologyFilter.checked = false;
    if (els.globalSearchDialogInput) els.globalSearchDialogInput.value = "";
    document.querySelectorAll("[data-filter-token]").forEach((button) => setTokenPressed(button, false));
    setTokenPressed(els.filteredCountryMapToggle, false);
    renderDependentFilterOptions();
    render();
  });
  window.addEventListener("hashchange", async () => {
    hideTransientOverlays();
    state.globalSearch = "";
    state.selectedGlobalResult = "";
    if (els.globalSearchDialogInput) els.globalSearchDialogInput.value = "";
    const returningToCountryList = location.hash.replace(/^#\/?/, "") === "country" && state.view === "country" && state.detailKind === "country";
    if (returningToCountryList && window.matchMedia("(max-aspect-ratio: 3 / 2)").matches) state.countryMobileRestoreScrollPending = true;
    const returningToCultureList = location.hash.replace(/^#\/?/, "") === "culture" && state.view === "culture" && state.detailKind === "culture";
    if (returningToCultureList && window.matchMedia("(max-aspect-ratio: 3 / 2)").matches) state.cultureMobileRestoreScrollPending = true;
    await applyHash();
    render();
  });
}


function bindPrimaryListEvents() {
  const selectRow = (row) => {
    if (row.dataset.country) selectCountryCard(row.dataset.country);
    else if (row.dataset.stateRegion) selectStateRegionCard(row.dataset.stateRegion);
  };
  els.countryList?.addEventListener("click", (event) => {
    const detailButton = event.target.closest("[data-country-detail], [data-map-enter-tag], [data-state-region-detail]");
    if (detailButton && els.countryList.contains(detailButton)) {
      event.preventDefault();
      if (detailButton.dataset.countryDetail || detailButton.dataset.mapEnterTag) openCountryDetail(detailButton.dataset.countryDetail || detailButton.dataset.mapEnterTag);
      else openStateRegionDetail(detailButton.dataset.stateRegionDetail);
      return;
    }
    if (event.target.closest("a, button, [data-concept-key]")) return;
    const row = event.target.closest("[data-country], [data-state-region]");
    if (row && els.countryList.contains(row)) selectRow(row);
  });
  els.countryList?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target.closest("a, button, [data-concept-key]")) return;
    const row = event.target.closest("[data-country], [data-state-region]");
    if (!row || !els.countryList.contains(row)) return;
    event.preventDefault();
    selectRow(row);
  });
}

function resetRegionMapFocus() {
  state.selectedStateRegion = "";
  state.mapSelectedStateRegion = "";
  render();
  fitMapToWidth();
}

function initTheme() {
  setTheme("votp", false);
}

function initDisplaySettings() {
  const getStored = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      if (value === null) return fallback;
      return value === "true";
    } catch {
      return fallback;
    }
  };
  state.whiteDecentralized = getStored("vicdata-white-decentralized", state.whiteDecentralized);
  state.subjectOverlordColors = getStored("vicdata-subject-overlord-colors", state.subjectOverlordColors);
  state.omitIndigenousLanguagesCultures = getStored("vicdata-omit-indigenous", state.omitIndigenousLanguagesCultures);
  state.omitDecentralizedTags = getStored("vicdata-omit-decentralized-tags", state.omitDecentralizedTags);
}

function persistDisplaySetting(key, value) {
  try {
    localStorage.setItem(key, String(Boolean(value)));
  } catch {
    // 浏览器禁用本地存储时仅保留本次页面状态。
  }
}

function setTheme(theme, persist = true) {
  state.theme = "votp";
  document.body.dataset.theme = state.theme;
  if (persist && theme === "votp") {
    try {
      localStorage.setItem("vicdata-theme", state.theme);
    } catch {
      // 浏览器禁用本地存储时只保留本次页面状态。
    }
  }
}

function bindTokenSet(selector, set, datasetKey, afterChange) {
  document.querySelectorAll(selector).forEach((button) => {
    button.addEventListener("click", async () => {
      const pressed = button.getAttribute("aria-pressed") === "true";
      setTokenPressed(button, !pressed);
      toggleSet(set, button.dataset[datasetKey], !pressed);
      if (afterChange) afterChange();
      render();
    });
  });
}

function bindContainerTokenSet(container, set, datasetKey, afterChange) {
  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter-token]");
    if (!button || !container.contains(button)) return;
    const value = button.dataset[datasetKey];
    if (!value) return;
    const pressed = button.getAttribute("aria-pressed") === "true";
    setTokenPressed(button, !pressed);
    toggleSet(set, value, !pressed);
    if (afterChange) afterChange();
    render();
  });
}

function bindResourceFilterTokens() {
  els.resourceFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter-token]");
    if (!button || !els.resourceFilters.contains(button)) return;
    const value = button.dataset.resourceFilter;
    if (!value) return;
    const pressed = button.getAttribute("aria-pressed") === "true";
    if (state.view === "region") {
      state.resourceFilters.clear();
      if (!pressed) state.resourceFilters.add(value);
      state.mapSubject = "";
      render();
      return;
    }
    setTokenPressed(button, !pressed);
    toggleSet(state.resourceFilters, value, !pressed);
    render();
  });
}

function bindStateTraitFilterTokens() {
  els.stateTraitFilters?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-state-trait-filter]");
    if (!button || !els.stateTraitFilters.contains(button)) return;
    const value = button.dataset.stateTraitFilter;
    const pressed = button.getAttribute("aria-pressed") === "true";
    if (value === "all") {
      state.stateTraitFilters.clear();
      if (!pressed) state.stateTraitFilters.add("all");
    } else {
      state.stateTraitFilters.delete("all");
      toggleSet(state.stateTraitFilters, value, !pressed);
    }
    if (state.stateTraitFilters.size > 0) state.regionMapView = "default";
    state.mapSubject = "";
    render();
  });
}

function bindTokenChoice(container, datasetKey, onChange) {
  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter-token]");
    if (!button || !container.contains(button)) return;
    onChange(button.dataset[datasetKey]);
  });
}

function submitMobileCountrySearch(input) {
  const query = input?.value ?? state.countryMobileSearchDraft;
  state.countryMobileSearchDraft = query;
  if (query.trim().toLowerCase() === state.search) return;
  state.search = query.trim().toLowerCase();
  state.globalSearchColorRestoreTag = "";
  if (els.searchInput) els.searchInput.value = query;
  render();
}

function submitMobileCultureSearch(input) {
  const query = input?.value ?? state.cultureMobileSearchDraft;
  state.cultureMobileSearchDraft = query;
  if (query.trim().toLowerCase() === state.search) return;
  state.search = query.trim().toLowerCase();
  state.globalSearchColorRestoreTag = "";
  if (els.searchInput) els.searchInput.value = query;
  render();
}

function selectCultureMobileFilter(category, value) {
  const toggleSingleSet = (set) => {
    const selected = set.has(value);
    set.clear();
    if (!selected) set.add(value);
  };
  if (category === "heritage") toggleSingleSet(state.heritages);
  else if (category === "language") toggleSingleSet(state.languages);
  else if (category === "strategicRegion") toggleSingleSet(state.strategicRegions);
  else if (category === "tradition") state.tradition = state.tradition === value ? "" : value;
}

function clearCultureMobileFilter(category) {
  if (category === "heritage") state.heritages.clear();
  else if (category === "language") state.languages.clear();
  else if (category === "strategicRegion") state.strategicRegions.clear();
  else if (category === "tradition") state.tradition = "";
}

function selectCountryMobileFilter(category, value) {
  const toggleSingleSet = (set) => {
    const selected = set.has(value);
    set.clear();
    if (!selected) set.add(value);
  };
  if (category === "type") toggleSingleSet(state.flags);
  else if (category === "tier") toggleSingleSet(state.tiers);
  else if (category === "strategicRegion") toggleSingleSet(state.strategicRegions);
  else if (category === "heritage") toggleSingleSet(state.heritages);
  else if (category === "language") toggleSingleSet(state.languages);
  else if (category === "tradition") state.tradition = state.tradition === value ? "" : value;
}

function clearCountryMobileFilter(category) {
  if (category === "type") state.flags.clear();
  else if (category === "tier") state.tiers.clear();
  else if (category === "strategicRegion") state.strategicRegions.clear();
  else if (category === "heritage") state.heritages.clear();
  else if (category === "language") state.languages.clear();
  else if (category === "tradition") state.tradition = "";
}

function bindConceptEvents() {
  document.addEventListener("contextmenu", (event) => {
    const target = event.target.closest("[data-concept-key]");
    if (!target?.dataset.conceptSearch?.trim()) return;
    event.preventDefault();
    searchConcept(target);
    hideConceptTooltip();
  });
  document.addEventListener("pointerover", (event) => {
    const target = event.target.closest("[data-concept-key]");
    if (!target) return;
    scheduleConceptTooltip(target, event);
  });
  document.addEventListener("pointermove", (event) => {
    if (pendingConceptTooltipTarget) {
      scheduleConceptTooltip(pendingConceptTooltipTarget, event);
    }
    if (!els.conceptTooltip || els.conceptTooltip.hidden) return;
    moveConceptTooltip(event);
  });
  document.addEventListener("pointerout", (event) => {
    const target = event.target.closest("[data-concept-key]");
    if (!target) return;
    if (event.relatedTarget && target.contains(event.relatedTarget)) return;
    hideConceptTooltip();
  });
  document.addEventListener("mouseover", (event) => {
    const target = event.target.closest("[data-concept-key]");
    if (!target) return;
    scheduleConceptTooltip(target, event);
  });
  document.addEventListener("mousemove", (event) => {
    if (pendingConceptTooltipTarget) {
      scheduleConceptTooltip(pendingConceptTooltipTarget, event);
    }
    if (!els.conceptTooltip || els.conceptTooltip.hidden) return;
    moveConceptTooltip(event);
  });
  document.addEventListener("mouseout", (event) => {
    const target = event.target.closest("[data-concept-key]");
    if (!target) return;
    if (event.relatedTarget && target.contains(event.relatedTarget)) return;
    hideConceptTooltip();
  });
  document.addEventListener("focusin", (event) => {
    const target = event.target.closest("[data-concept-key]");
    if (!target) return;
    const rect = target.getBoundingClientRect();
    showConceptTooltip(target, { clientX: rect.right, clientY: rect.top });
  });
  document.addEventListener("focusout", (event) => {
    const target = event.target.closest("[data-concept-key]");
    if (!target) return;
    hideConceptTooltip();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideConceptTooltip();
  });
}

function scheduleConceptTooltip(target, event) {
  if (!els.conceptTooltip) return;
  if (document.body.classList.contains("results-collapsed")) {
    hideConceptTooltip();
    return;
  }
  suppressNativeTooltip(target);
  clearConceptTooltipTimer();
  pendingConceptTooltipTarget = target;
  pendingConceptTooltipPoint = conceptTooltipPoint(event);
  conceptTooltipTimer = window.setTimeout(() => {
    const delayedTarget = pendingConceptTooltipTarget;
    const delayedPoint = pendingConceptTooltipPoint;
    clearConceptTooltipTimer();
    if (!delayedTarget?.isConnected || !delayedPoint) return;
    showConceptTooltip(delayedTarget, delayedPoint);
  }, target.dataset.conceptKind === "ideology" ? 0 : CONCEPT_TOOLTIP_DELAY_MS);
}

function conceptTooltipPoint(event) {
  return { clientX: event.clientX, clientY: event.clientY };
}

function clearConceptTooltipTimer() {
  if (conceptTooltipTimer) {
    window.clearTimeout(conceptTooltipTimer);
    conceptTooltipTimer = 0;
  }
  pendingConceptTooltipTarget = null;
  pendingConceptTooltipPoint = null;
}

function showConceptTooltip(target, event) {
  if (!els.conceptTooltip) return;
  if (document.body.classList.contains("results-collapsed")) {
    hideConceptTooltip();
    return;
  }
  suppressNativeTooltip(target);
  const isIdeology = target.dataset.conceptKind === "ideology";
  els.conceptTooltip.classList.toggle("ideology-tooltip", isIdeology);
  els.conceptTooltip.classList.toggle("standard-tooltip", !isIdeology);
  els.conceptTooltip.innerHTML = isIdeology
    ? ideologyTooltipRows(target)
    : conceptTooltipRows(target);
  els.conceptTooltip.hidden = false;
  moveConceptTooltip(event);
}

function ideologyTooltipRows(target) {
  const key = target.dataset.conceptKey || "";
  const ideology = ideologyByKey.get(key);
  if (!ideology) return conceptTooltipRows(target);
  return `
    <div class="ideology-tooltip-head">
      <div class="ideology-tooltip-identity">
        ${ideologyIconHtml(ideology, "ideology-tooltip-icon")}
        <div>
          <div class="ideology-tooltip-title">${escapeHtml(entityText(ideology))}</div>
          <div class="ideology-tooltip-id">${escapeHtml(ideology.key)}</div>
        </div>
      </div>
      <div class="ideology-tooltip-type">${escapeHtml(ideologyTypeLabel(ideologyTypeKey(ideology)))}</div>
    </div>
    ${ideologyTooltipAttitudeGroups(ideology)}
    ${entityText(ideology, "description", "") ? `<p class="ideology-tooltip-desc">${escapeHtml(cleanIdeologyDescription(entityText(ideology, "description", "")))}</p>` : ""}
  `;
}

function ideologyTooltipAttitudeGroups(ideology) {
  return groupLawStances(ideology?.law_stances || []).map((group) => {
    const items = [...group.items].sort((left, right) => {
      const leftLaw = lawByKey.get(left.law_key) || left;
      const rightLaw = lawByKey.get(right.law_key) || right;
      return sortLaws(leftLaw, rightLaw);
    });
    return `
      <section class="ideology-tooltip-attitude-group">
        <h4>${escapeHtml(t("board.ideology.stanceToward", { group: group.name }))}</h4>
        ${ideologyTooltipAttitudeLines(items)}
      </section>
    `;
  }).join("");
}

function ideologyTooltipAttitudeLines(stances) {
  const grouped = new Map();
  for (const stance of stances || []) {
    const key = stance.stance || "neutral";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(stance);
  }
  return lawStanceDisplayOrder.filter((stance) => grouped.has(stance)).map((stance) => {
    const names = grouped.get(stance).map((item) => {
      const law = lawByKey.get(item.law_key) || item;
      return lawDisplayName(law);
    }).filter(Boolean).join(t("ui.listSeparator", "、"));
    return `<div class="ideology-tooltip-attitude-line ${lawStanceClassName(stance)}"><span>${escapeHtml(lawStanceSentencePrefix(stance))}</span> ${escapeHtml(names)}</div>`;
  }).join("");
}

function cultureTooltipRelationSection(title, items) {
  if (!title) return "";
  const labels = [...(items || [])]
    .map((item) => entityText(item) || item?.key || "")
    .filter(Boolean)
    .sort(localizedCompare);
  const empty = t("ui.none", "无");
  return `<section class="concept-tooltip-relation"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(labels.join(t("ui.listSeparator", "、")) || empty)}</p></section>`;
}

function cultureTooltipRelationSections(kind, key) {
  const labels = TAG_TOOLTIP_DEFAULTS.cultureRelations || {};
  if (kind === "cultureTraitGroup") {
    const group = cultureTraitGroupByKey.get(key);
    if (!group || !["heritage", "language"].includes(group.type)) return "";
    const title = t(group.type === "heritage" ? labels.heritageGroup : labels.languageGroup);
    const items = cultureTraits.filter((trait) => trait.group_key === key && trait.type === group.type);
    return cultureTooltipRelationSection(title, items);
  }
  if (kind === "cultureTrait") {
    const trait = cultureTraitByKey.get(key);
    if (!trait) return "";
    if (trait.type === "heritage") {
      return cultureTooltipRelationSection(
        t(labels.heritage),
        cultures.filter((culture) => culture.heritage?.key === key),
      );
    }
    if (trait.type === "language") {
      return cultureTooltipRelationSection(
        t(labels.language),
        cultures.filter((culture) => culture.language?.key === key),
      );
    }
    if (trait.type === "tradition") {
      return cultureTooltipRelationSection(
        t(labels.tradition),
        cultures.filter((culture) => (culture.traditions || []).some((item) => item.key === key)),
      );
    }
    return "";
  }
  if (kind === "culture") {
    const culture = byCulture.get(key);
    if (!culture) return "";
    return [
      cultureTooltipRelationSection(t(labels.primaryCultureCountries), culture.related_countries),
      cultureTooltipRelationSection(t(labels.obsessions), culture.obsessions),
      cultureTooltipRelationSection(t(labels.taboos), culture.taboos),
    ].join("");
  }
  return "";
}

function conceptTooltipHeader(target) {
  const label = target.dataset.conceptLabel || target.textContent?.trim() || "";
  const key = target.dataset.conceptKey || "";
  const type = conceptTooltipType(target);
  return `
    <div class="concept-tooltip-head">
      <div class="concept-tooltip-identity">
        <strong>${escapeHtml(label || key)}</strong>
        <div class="concept-tooltip-key">${escapeHtml(key)}</div>
      </div>
      <div class="concept-tooltip-type">${escapeHtml(type)}</div>
    </div>
  `;
}

function conceptTooltipType(target) {
  const kind = target.dataset.conceptKind || "";
  const key = target.dataset.conceptKey || "";
  if (kind === "cultureTraitGroup") {
    const group = cultureTraitGroupByKey.get(key);
    return t("tooltip.cultureTraitGroupType", { type: t(`enum.cultureTraitType.${group?.type || "unknown"}`) });
  }
  if (kind === "cultureTrait") {
    const trait = cultureTraitByKey.get(key);
    return t("tooltip.cultureTraitType", { type: t(`enum.cultureTraitType.${trait?.type || "unknown"}`) });
  }
  return target.dataset.conceptCategory || conceptKindLabel(kind);
}

function conceptTooltipContent(target, relationSections = "") {
  const label = target.dataset.conceptLabel || target.textContent?.trim() || "";
  const key = target.dataset.conceptKey || "";
  const kind = target.dataset.conceptKind || "";
  const relations = relationSections || cultureTooltipRelationSections(kind, key);
  const context = relations || kind === "country" ? "" : conceptTooltipContextLine(kind, key);
  const resourceSummary = relations || kind !== "stateRegion" ? "" : stateRegionTooltipResourceHtml(conceptTooltipEntity(kind, key));
  const description = relations ? "" : conceptTooltipDescription(target, kind, key, label);
  const secondaryDescription = relations ? "" : target.dataset.conceptSecondaryDescription || "";
  const rows = [
    context ? `<span>${escapeHtml(context)}</span>` : "",
    resourceSummary,
    description ? `<span class="concept-tooltip-description">${escapeHtml(description)}</span>` : "",
    description && secondaryDescription ? `<div class="concept-tooltip-divider"></div>` : "",
    secondaryDescription ? `<span class="concept-tooltip-description">${escapeHtml(secondaryDescription)}</span>` : "",
    relations ? `<div class="concept-tooltip-relations">${relations}</div>` : "",
  ].filter(Boolean).join("");
  return rows ? `<div class="concept-tooltip-content">${rows}</div>` : "";
}

function conceptTooltipActionHints(target) {
  return [
    target.matches("a[href]") ? t("tooltip.openDetail") : "",
    target.dataset.conceptSearch?.trim() ? t("tooltip.filter") : "",
  ].filter(Boolean).join(t("ui.actionSeparator"));
}

function conceptTooltipRows(target, relationSections = "") {
  const content = conceptTooltipContent(target, relationSections);
  const actions = conceptTooltipActionHints(target);
  return [
    conceptTooltipHeader(target),
    content ? `<div class="concept-tooltip-divider"></div>` : "",
    content,
    actions ? `<div class="concept-tooltip-divider"></div>` : "",
    actions ? `<small class="concept-tooltip-actions">${escapeHtml(actions)}</small>` : "",
  ].filter(Boolean).join("");
}

function suppressNativeTooltip(target) {
  if (!target) return;
  target.removeAttribute("title");
  target.querySelectorAll("[title]").forEach((node) => node.removeAttribute("title"));
}

function conceptTooltipDescription(target, kind, key, label) {
  const explicit = target.dataset.conceptDescription || "";
  const entity = conceptTooltipEntity(kind, key);
  if (kind === "country") return [countryTooltipMainInfo(entity), explicit].filter(Boolean).join("\n");
  if (explicit) return explicit;
  const description = String(entityText(entity, "description", "") || entityText(entity, "modifierSummary", "")).replace(/\s+/g, " ").trim();
  if (description) return description;
  const category = target.dataset.conceptCategory || conceptKindLabel(kind);
  const defaults = TAG_TOOLTIP_DEFAULTS.concept || {};
  return formatTooltipDescription(defaults.description, { label: label || key, key, category });
}

function countryTooltipMainInfo(country) {
  if (!country) return "";
  const primaryCultures = (country.primaryCultures || []).map((key) => entityText(byCulture.get(key)) || key).filter(Boolean).join(t("ui.listSeparator"));
  const religion = localizedReligionName(country.religion);
  const capital = entityText(byStateRegion.get(country.capital)) || country.capital || "";
  return [
    primaryCultures ? t("tooltip.country.primaryCultures", { value: primaryCultures }) : "",
    religion ? t("tooltip.country.religion", { value: religion }) : "",
    capital ? t("tooltip.country.capital", { value: capital }) : "",
  ].filter(Boolean).join("\n");
}

function localizedReligionName(key) {
  if (!key) return "";
  return translateMessage(`religion:${key}.name`, key);
}

function conceptTooltipEntity(kind, key) {
  if (kind === "country") return byTag.get(key);
  if (kind === "culture") return byCulture.get(key);
  if (kind === "stateRegion") return byStateRegion.get(key);
  if (kind === "strategicRegion") return byStrategicRegion.get(key);
  if (kind === "geographicRegion") return byGeographicRegion.get(key);
  if (kind === "company") return byCompany.get(key);
  if (kind === "ideology") return ideologyByKey.get(key);
  if (kind === "law") return lawByKey.get(key);
  if (kind === "interestGroup") return byInterestGroup.get(key);
  if (kind === "interestGroupTrait") return interestGroupTraitByKey.get(key);
  if (kind === "cultureTrait") return cultureTraitByKey.get(key);
  if (kind === "cultureTraitGroup") return cultureTraitGroupByKey.get(key);
  if (kind === "stateTrait") return stateTraitByKey.get(key);
  if (kind === "building") return buildingByKey.get(key);
  if (kind === "goods") return goodsByKey.get(key);
  if (kind === "technology") return technologyByKey.get(key);
  return null;
}

function conceptTooltipContextLine(kind, key) {
  if (!key) return "";
  if (kind === "country") {
    const country = byTag.get(key);
    return [countryTypeTagLabel(country || {}), t(`enum.tier.${country?.tier}`)].filter(Boolean).join(" · ");
  }
  if (kind === "culture") {
    const culture = byCulture.get(key);
    return [entityText(culture?.heritage), entityText(culture?.language)].filter(Boolean).join(" · ");
  }
  if (kind === "stateRegion") {
    const stateRegion = byStateRegion.get(key);
    return refNames(stateRegion?.strategic_regions);
  }
  if (kind === "strategicRegion") {
    const region = byStrategicRegion.get(key);
    const count = (region?.states || []).length;
    return count ? t("tooltip.stateRegionCount", { count: localizedNumber(count) }) : "";
  }
  if (kind === "geographicRegion") {
    const region = byGeographicRegion.get(key);
    const count = geographicRegionStateRegions(region).length;
    return count ? t("tooltip.stateRegionCount", { count: localizedNumber(count) }) : "";
  }
  if (kind === "company") {
    const company = byCompany.get(key);
    return [companyKindText(company || {}), entityText(company, "category", "") || company?.category].filter(Boolean).join(" · ");
  }
  if (kind === "ideology") {
    const ideology = ideologyByKey.get(key);
    return [
      ideologyTypeLabel(ideologyTypeKey(ideology || {})),
      refNames(ideologyInterestGroupRefs(ideology || {})),
      conceptTooltipIdeologyLawStance(ideology),
    ].filter(Boolean).join(" · ");
  }
  if (kind === "stateTrait") {
    return (stateTraitByKey.get(key)?.categories || []).map((category) => entityText(category)).filter(Boolean).join(" · ");
  }
  if (kind === "technology") {
    const technology = technologyByKey.get(key);
    return [entityText(technology, "category", ""), entityText(technology, "eraLabel", "")].filter(Boolean).join(" · ");
  }
  if (kind === "building" || kind === "goods") return "";
  if (kind === "cultureTrait" || kind === "cultureTraitGroup") return "文化特质";
  if (kind === "interestGroup") return t("board.ideology.interestGroup", "利益集团");
  if (kind === "interestGroupTrait") return t("board.ideology.interestGroupTrait", "利益集团特质");
  if (kind === "law") return t("board.law.title", "法律");
  return "";
}

function conceptTooltipIdeologyLawStance(ideology) {
  const law = state.detailKind === "law" ? lawByKey.get(state.selectedLaw) : null;
  const stanceLaw = law ? lawByKey.get(lawStanceSourceKey(law)) || law : null;
  const stance = stanceLaw && (ideology?.law_stances || []).find((item) => item.law_key === stanceLaw.key);
  return stance ? t("tooltip.ideologyLawStance", { law: lawDisplayName(law), stance: lawStanceLabel(stance.stance) }) : "";
}

function moveConceptTooltip(event) {
  if (!els.conceptTooltip) return;
  const margin = 14;
  const rect = els.conceptTooltip.getBoundingClientRect();
  const x = Math.min(event.clientX + margin, window.innerWidth - rect.width - margin);
  const y = Math.min(event.clientY + margin, window.innerHeight - rect.height - margin);
  els.conceptTooltip.style.left = `${Math.max(margin, x)}px`;
  els.conceptTooltip.style.top = `${Math.max(margin, y)}px`;
}

function hideConceptTooltip() {
  clearConceptTooltipTimer();
  if (!els.conceptTooltip) return;
  els.conceptTooltip.hidden = true;
  els.conceptTooltip.classList.remove("ideology-tooltip", "standard-tooltip");
}

function searchConcept(target) {
  const text = target.dataset.conceptSearch || target.dataset.conceptLabel || target.dataset.conceptKey || "";
  state.globalSearch = "";
  state.selectedGlobalResult = "";
  state.search = text.trim().toLowerCase();
  els.searchInput.value = text.trim();
  if (els.globalSearchDialogInput) els.globalSearchDialogInput.value = "";
  render();
}

function conceptKindLabel(kind) {
  return t(`tooltip.kind.${kind || "concept"}`);
}

async function openGlobalSearchDialog() {
  if (state.infoDialog) {
    state.infoDialog = "";
    syncInfoDialogVisibility();
  }
  await ensureDataChunks(Object.keys(dataIndex?.chunks || {}));
  state.globalSearchDialogOpen = true;
  state.globalSearchActiveIndex = 0;
  if (!els.globalSearchDialog) return;
  els.globalSearchDialog.hidden = false;
  document.body.classList.add("global-search-dialog-open");
  if (els.globalSearchDialogInput) els.globalSearchDialogInput.value = state.globalSearch || "";
  if (els.globalSearchDetailedToggle) els.globalSearchDetailedToggle.checked = state.globalSearchDetailed;
  if (els.globalSearchLegacyToggle) els.globalSearchLegacyToggle.checked = state.globalSearchIncludeLegacy;
  renderGlobalSearchDialogResults();
  requestAnimationFrame(() => els.globalSearchDialogInput?.focus());
}

function closeGlobalSearchDialog() {
  state.globalSearchDialogOpen = false;
  if (els.globalSearchDialog) els.globalSearchDialog.hidden = true;
  document.body.classList.remove("global-search-dialog-open");
  els.globalSearchButton?.focus();
}

function openInfoDialog(kind) {
  if (state.globalSearchDialogOpen) closeGlobalSearchDialog();
  state.infoDialog = kind === "settings" ? "settings" : "about";
  syncInfoDialogVisibility();
  requestAnimationFrame(() => els.infoDialogCloseButton?.focus());
}

function closeInfoDialog() {
  const previous = state.infoDialog;
  state.infoDialog = "";
  if (els.infoDialog) els.infoDialog.hidden = true;
  if (els.infoDialogTitle) els.infoDialogTitle.textContent = "";
  if (els.infoDialogBody) els.infoDialogBody.innerHTML = "";
  document.body.classList.remove("info-dialog-open");
  if (previous === "settings") els.settingsNavButton?.focus();
  else els.aboutNavButton?.focus();
}

function renderInfoDialog() {
  if (!els.infoDialogTitle || !els.infoDialogBody || !state.infoDialog) return;
  if (state.infoDialog === "settings") {
    els.infoDialogTitle.textContent = t("ui.settings");
    els.infoDialogBody.innerHTML = renderSettingsDialogContent();
    bindSettingsControls(els.infoDialogBody);
    return;
  }
  els.infoDialogTitle.textContent = t("ui.about");
  els.infoDialogBody.innerHTML = renderAboutDialogContent();
}

function syncInfoDialogVisibility() {
  if (!els.infoDialog) return;
  els.infoDialog.querySelector(".info-dialog")?.classList.toggle("info-dialog-about", state.infoDialog === "about");
  if (!state.infoDialog) {
    els.infoDialog.hidden = true;
    document.body.classList.remove("info-dialog-open");
    return;
  }
  renderInfoDialog();
  els.infoDialog.hidden = false;
  document.body.classList.add("info-dialog-open");
}

function handleGlobalSearchDialogKeydown(event) {
  if (!state.globalSearchDialogOpen) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeGlobalSearchDialog();
    return;
  }
  const items = [...(els.globalSearchDialogResults?.querySelectorAll("[data-global-dialog-result]") || [])];
  if (!items.length) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.globalSearchActiveIndex = Math.min(items.length - 1, state.globalSearchActiveIndex + 1);
    updateGlobalSearchActiveDescendant();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    state.globalSearchActiveIndex = Math.max(0, state.globalSearchActiveIndex - 1);
    updateGlobalSearchActiveDescendant();
  } else if (event.key === "Enter") {
    event.preventDefault();
    items[state.globalSearchActiveIndex]?.click();
  }
}

function handleInfoDialogKeydown(event) {
  if (!state.infoDialog) return;
  if (event.key !== "Escape") return;
  event.preventDefault();
  closeInfoDialog();
}

async function applyHash() {
  await ensureDataChunksForRoute();
  if (routeView() === "religion" && !loadedDataChunks.has("religion")) await ensureDataChunks(["religion"]);
  const { parts, query } = routeHashParts();
  state.mapFullscreen = false;
  if (query.get("map") !== "fullscreen") {
    state.mapFullscreenReturn = null;
    state.mapFullscreenSnapshot = null;
  }
  state.infoDialog = "";
  if (standaloneSiteConfig && ["news", "changelog"].includes(parts[0])) {
    changeBoard("home", "home");
    return;
  }
  if (parts[0] === "achievement" && !achievementBoardAvailable()) {
    changeBoard("home", "home");
    return;
  }
  if (parts[0] === "building" && !economyBoardAvailable("building")) {
    changeBoard("home", "home");
    return;
  }
  if (parts[0] === "goods" && !economyBoardAvailable("goods")) {
    changeBoard("home", "home");
    return;
  }
  if (!parts.length || parts[0] === "home") {
    changeBoard("home", "home");
    return;
  }
  if (parts[0] === "settings") {
    state.infoDialog = "settings";
    return;
  }
  if (parts[0] === "news") {
    changeBoard("news", "news");
    if (!Number.isInteger(state.newsPage) || state.newsPage < 1) state.newsPage = 1;
    return;
  }
  if (parts[0] === "changelog") {
    changeBoard("changelog", "changelog");
    return;
  }
  if (parts[0] === "about") {
    state.infoDialog = "about";
    return;
  }
  if (parts[0] === "country" && !parts[1]) {
    changeBoard("country", "country");
    state.mapFullscreen = mapFullscreenRequested();
    return;
  }
  if (parts[0] === "country" && parts[1] && byTag.has(parts[1].toUpperCase())) {
    changeBoard("country", "country");
    state.selectedTag = parts[1].toUpperCase();
    state.countryDetailTab = countryDetailTabFromQuery(query);
    state.countryDetailSubtab = countryInterestGroupTabFromQuery(query);
    state.countryDetailFlavorTab = countryFlavorTabFromQuery(query);
    return;
  }
  if (parts[0] === "culture" && !parts[1]) {
    changeBoard("culture", "culture");
    state.mapFullscreen = mapFullscreenRequested();
    return;
  }
  if (parts[0] === "culture" && parts[1] === "incorporation") {
    changeBoard("culture", "cultureIncorporation");
    clearCultureIncorporationCalculatorState();
    return;
  }
  if (parts[0] === "culture" && parts[1] && byCulture.has(decodeURIComponent(parts[1]))) {
    changeBoard("culture", "culture");
    state.selectedCulture = decodeURIComponent(parts[1]);
    return;
  }
  if (parts[0] === "region") {
    changeBoard("region", "stateRegion");
    state.mapFullscreen = mapFullscreenRequested();
    if (parts[1] === "resource" && parts[2] && resourceFilterByKey.has(decodeURIComponent(parts[2]))) {
      state.resourceFilters = new Set([decodeURIComponent(parts[2])]);
      state.regionMapView = "default";
    }
    return;
  }
  if (parts[0] === "state-region" && parts[1] && byStateRegion.has(decodeURIComponent(parts[1]))) {
    changeBoard("region", "stateRegion");
    state.selectedStateRegion = decodeURIComponent(parts[1]);
    return;
  }
  if (parts[0] === "strategic-region" && parts[1] && byStrategicRegion.has(decodeURIComponent(parts[1]))) {
    changeBoard("region", "strategicRegion");
    state.regionListMode = "strategic";
    state.selectedStrategicRegion = decodeURIComponent(parts[1]);
    return;
  }
  if (parts[0] === "geographic-region" && parts[1] && byGeographicRegion.has(decodeURIComponent(parts[1]))) {
    changeBoard("region", "geographicRegion");
    state.regionListMode = "geographic";
    state.selectedGeographicRegion = decodeURIComponent(parts[1]);
    return;
  }
  if (parts[0] === "company" && !parts[1]) {
    changeBoard("company", "company");
    return;
  }
  if (parts[0] === "company" && parts[1] === "solver" && typeof companySolverAvailable === "function" && companySolverAvailable()) {
    changeBoard("company", "companySolver");
    state.selectedCompany = "";
    renderCompanySolverBoard();
    return;
  }
  if (parts[0] === "company" && parts[1] === "solver") {
    changeBoard("company", "company");
    replaceHash("/company");
    return;
  }
  if (parts[0] === "company" && parts[1] === "composer" && typeof companyComposerAvailable === "function" && companyComposerAvailable()) {
    changeBoard("company", "companyComposer");
    state.selectedCompany = "";
    render();
    return;
  }
  if (parts[0] === "company" && parts[1] === "composer") {
    changeBoard("company", "company");
    replaceHash("/company");
    return;
  }
  if (parts[0] === "company" && parts[1] && byCompany.has(decodeURIComponent(parts[1]))) {
    changeBoard("company", "company");
    state.selectedCompany = decodeURIComponent(parts[1]);
    return;
  }
  if (parts[0] === "ideology" && !parts[1]) {
    changeBoard("ideology", "ideology");
    return;
  }
  if (parts[0] === "ideology" && parts[1] && ideologyByKey.has(decodeURIComponent(parts[1]))) {
    changeBoard("ideology", "ideology");
    state.selectedIdeology = decodeURIComponent(parts[1]);
    return;
  }
  if (parts[0] === "religion" && !parts[1]) {
    changeBoard("religion", "religion");
    state.selectedReligion = "";
    return;
  }
  if (parts[0] === "religion" && parts[1] && religionByKey.has(decodeURIComponent(parts[1]))) {
    changeBoard("religion", "religion");
    state.selectedReligion = decodeURIComponent(parts[1]);
    return;
  }
  if (parts[0] === "interest-group" && !parts[1]) {
    changeBoard("interest-group", "interestGroup");
    state.selectedInterestGroup = "";
    state.selectedInterestGroupFlavor = "";
    return;
  }
  if (parts[0] === "event" && !eventBoardAvailable()) {
    changeBoard("home", "home");
    return;
  }
  if (parts[0] === "interest-group" && parts[1] && parts[2] === "flavor" && parts[3] && byInterestGroup.has(decodeURIComponent(parts[1]))) {
    changeBoard("interest-group", "interestGroup");
    const group = byInterestGroup.get(decodeURIComponent(parts[1]));
    const flavor = interestGroupVariants(group).find((item) => item.key === decodeURIComponent(parts[3]));
    if (flavor) {
      state.selectedInterestGroup = group.key;
      state.selectedInterestGroupFlavor = flavor.key;
      return;
    }
  }
  if (parts[0] === "interest-group" && parts[1] && byInterestGroup.has(decodeURIComponent(parts[1]))) {
    changeBoard("interest-group", "interestGroup");
    state.selectedInterestGroup = decodeURIComponent(parts[1]);
    state.selectedInterestGroupFlavor = "";
    return;
  }
  if (parts[0] === "law" && !parts[1]) {
    changeBoard("law", "law");
    return;
  }
  if (parts[0] === "law" && parts[1] && lawByKey.has(decodeURIComponent(parts[1]))) {
    changeBoard("law", "law");
    state.selectedLaw = decodeURIComponent(parts[1]);
    return;
  }
  if (parts[0] === "technology" && !parts[1]) {
    changeBoard("technology", "technology");
    state.selectedTechnology = "";
    return;
  }
  if (parts[0] === "technology" && parts[1] && technologyByKey.has(decodeURIComponent(parts[1]))) {
    changeBoard("technology", "technology");
    state.selectedTechnology = decodeURIComponent(parts[1]);
    state.technologyCategory = technologyByKey.get(state.selectedTechnology).category;
    return;
  }
  if (parts[0] === "achievement" && achievementBoardAvailable() && !parts[1]) {
    changeBoard("achievement", "achievement");
    state.selectedAchievement = "";
    return;
  }
  if (parts[0] === "achievement" && parts[1] && achievementByKey.has(decodeURIComponent(parts[1]))) {
    changeBoard("achievement", "achievement");
    state.selectedAchievement = decodeURIComponent(parts[1]);
    return;
  }
  if (parts[0] === "building" && economyBoardAvailable("building") && !parts[1]) {
    changeBoard("building", "building");
    state.selectedBuilding = "";
    return;
  }
  if (parts[0] === "building" && parts[1] && buildingRecordByKey.has(decodeURIComponent(parts[1]))) {
    changeBoard("building", "building");
    state.selectedBuilding = decodeURIComponent(parts[1]);
    return;
  }
  if (parts[0] === "event" && eventBoardAvailable() && !parts[1]) {
    changeBoard("event", "event");
    state.selectedEvent = "";
    return;
  }
  if (parts[0] === "event" && parts[1] && eventByKey.has(decodeURIComponent(parts[1]))) {
    changeBoard("event", "event");
    state.selectedEvent = decodeURIComponent(parts[1]);
    return;
  }
  if (parts[0] === "journal" && journalBoardAvailable()) {
    changeBoard("journal", "journal");
    state.selectedJournal = parts[1] ? decodeURIComponent(parts[1]) : "";
    return;
  }
  if (parts[0] === "decision" && decisionBoardAvailable()) {
    changeBoard("decision", "decision");
    state.selectedDecision = parts[1] ? decodeURIComponent(parts[1]) : "";
    return;
  }
  if (parts[0] === "content") {
    const kind = ["journal", "event", "decision"].includes(parts[1]) ? parts[1] : "journal";
    replaceHash(`/${kind}${parts[2] ? `/${encodeURIComponent(decodeURIComponent(parts[2]))}` : ""}`);
    changeBoard(kind, kind);
    if (kind === "journal") state.selectedJournal = parts[2] ? decodeURIComponent(parts[2]) : "";
    if (kind === "decision") state.selectedDecision = parts[2] ? decodeURIComponent(parts[2]) : "";
    if (kind === "event") state.selectedEvent = parts[2] ? decodeURIComponent(parts[2]) : "";
    return;
  }
  if (parts[0] === "goods" && parts[1] === "needs") {
    changeBoard("goods", "goods");
    state.goodsPanel = "needs";
    state.needsTable = parts[2] === "wealth" ? "wealth" : "substitutes";
    state.selectedGood = "";
    if (!['substitutes', 'wealth'].includes(parts[2])) replaceHash("/goods/needs/substitutes");
    return;
  }
  if (parts[0] === "goods" && economyBoardAvailable("goods") && !parts[1]) {
    changeBoard("goods", "goods");
    state.goodsPanel = "list";
    state.selectedGood = "";
    return;
  }
  if (parts[0] === "goods" && parts[1] && goodByKey.has(decodeURIComponent(parts[1]))) {
    changeBoard("goods", "goods");
    state.goodsPanel = "list";
    state.selectedGood = decodeURIComponent(parts[1]);
    return;
  }
  if (parts[0] === "religion" && parts[1]) {
    state.search = decodeURIComponent(parts[1]).toLowerCase();
    els.searchInput.value = state.search;
  }
}

async function setView(view) {
  hideTransientOverlays();
  closeTopbarNavigationMenus();
  changeBoard(view, view === "region" ? "stateRegion" : view);
  if (view === "region") state.regionListMode = "state";
  if (view === "interest-group") {
    state.selectedInterestGroup = "";
    state.selectedInterestGroupFlavor = "";
  }
  if (view === "religion") state.selectedReligion = "";
  replaceHash(`/${view}`);
  await ensureDataChunksForRoute();
  renderStrategicRegionFilterOptions();
  renderSortOptions();
}

function changeBoard(view, detailKind) {
  if (state.view !== view) {
    resetBoardView();
    clearCultureIncorporationCalculatorState();
    state.mapFullscreen = false;
    state.mapFullscreenReturn = null;
    state.mapFullscreenSnapshot = null;
  }
  if (view !== "region") state.regionMapView = "default";
  state.view = view;
  state.detailKind = detailKind;
}

function resetBoardView() {
  state.resultsPanelMode = "side";
  document.body.classList.remove("filters-collapsed");
  updatePanelToggleState();
}

function regionListModeDetailKind() {
  return "stateRegion";
}

function replaceHash(hashPath) {
  const prefix = window.location.search || "";
  history.replaceState(null, "", `${prefix}#${hashPath}`);
}

function hideTransientOverlays() {
  hideMapTooltip();
  hideConceptTooltip();
}

function updatePageChrome() {
  const label = viewLabel(state.view);
  const title = t("template.documentTitle", { board: label, site: siteTitle });
  setOptionalText(els.pageTitle, title);
  document.title = title;
  const achievementAvailable = achievementBoardAvailable();
  const eventAvailable = eventBoardAvailable();
  const buildingAvailable = economyBoardAvailable("building");
  const goodsAvailable = economyBoardAvailable("goods");
  document.querySelectorAll('[data-nav-view="achievement"]').forEach((button) => { button.hidden = !achievementAvailable; });
  document.querySelector('#viewSelect option[value="achievement"]')?.toggleAttribute("hidden", !achievementAvailable);
  document.querySelectorAll('[data-nav-view="event"]').forEach((button) => { button.hidden = !eventAvailable; });
  document.querySelector('#viewSelect option[value="event"]')?.toggleAttribute("hidden", !eventAvailable);
  document.querySelectorAll('[data-nav-view="journal"]').forEach((button) => { button.hidden = !journalBoardAvailable(); });
  document.querySelectorAll('[data-nav-view="decision"]').forEach((button) => { button.hidden = !decisionBoardAvailable(); });
  document.querySelector('#viewSelect option[value="journal"]')?.toggleAttribute("hidden", !journalBoardAvailable());
  document.querySelector('#viewSelect option[value="decision"]')?.toggleAttribute("hidden", !decisionBoardAvailable());
  document.querySelectorAll('[data-nav-view="building"]').forEach((button) => { button.hidden = !buildingAvailable; });
  document.querySelectorAll('[data-nav-view="goods"]').forEach((button) => { button.hidden = !goodsAvailable; });
  document.querySelector('#viewSelect option[value="building"]')?.toggleAttribute("hidden", !buildingAvailable);
  document.querySelector('#viewSelect option[value="goods"]')?.toggleAttribute("hidden", !goodsAvailable);
  document.querySelectorAll(".topbar-nav-group").forEach((group) => {
    group.hidden = [...group.querySelectorAll("[data-nav-view]")].every((button) => button.hidden);
  });
  if (els.viewSelect) {
    els.viewSelect.value = state.view;
  }
}

function cycleResultsPanelMode() {
  const order = ["side", "collapsed"];
  const index = order.indexOf(state.resultsPanelMode);
  state.resultsPanelMode = order[(index + 1) % order.length];
  updateResultsPanelMode();
  if (state.resultsPanelMode === "collapsed") hideConceptTooltip();
  if (mapRuntime.ready) paintMapCanvas();
}

function updateResultsPanelMode() {
  const mode = state.resultsPanelMode || "side";
  document.body.dataset.resultsPanel = mode;
  document.body.classList.toggle("results-collapsed", mode === "collapsed");
  updatePanelToggleState();
}

function updatePanelToggleState() {
  if (els.leftPanelToggle) {
    const collapsed = document.body.classList.contains("filters-collapsed");
    els.leftPanelToggle.setAttribute("aria-pressed", String(collapsed));
    const label = t(collapsed ? "ui.expandFilters" : "ui.collapseFilters");
    els.leftPanelToggle.setAttribute("aria-label", label);
    els.leftPanelToggle.title = label;
  }
  if (els.bottomPanelToggle) {
    const collapsed = (state.resultsPanelMode || "side") === "collapsed";
    els.bottomPanelToggle.setAttribute("aria-pressed", String(collapsed));
    const label = t(collapsed ? "ui.expandList" : "ui.collapseList");
    els.bottomPanelToggle.setAttribute("aria-label", label);
    els.bottomPanelToggle.title = label;
  }
}

function toolPanelTitle() {
  if (state.view === "culture" && state.detailKind === "cultureIncorporation") return t("board.culture.incorporation.title", "整合时长计算器");
  if (state.view === "company" && state.detailKind === "companySolver") return t("board.company.solverTitle", "公司产业求解器");
  if (state.view === "company" && state.detailKind === "companyComposer") return t("board.company.composer.entry", "公司建筑组合器");
  return t("ui.filters", "筛选");
}

function syncBoardOwnedToolPanels() {
  const cultureCalculator = state.view === "culture" && state.detailKind === "cultureIncorporation";
  const cultureBoard = state.view === "culture";
  if (els.cultureIncorporationEntry) els.cultureIncorporationEntry.hidden = !cultureBoard || cultureCalculator;
  if (els.cultureIncorporationPanel) els.cultureIncorporationPanel.hidden = !cultureCalculator;

  const companyBoard = state.view === "company";
  const companyToolOpen = ["companySolver", "companyComposer"].includes(state.detailKind);
  for (const entry of [els.companySolverEntry, els.companyComposerEntry]) {
    if (!entry) continue;
    if (!companyBoard || companyToolOpen) {
      entry.hidden = true;
      entry.innerHTML = "";
    }
  }
  if (els.companySolverDetailPane) {
    els.companySolverDetailPane.hidden = !(companyBoard && state.detailKind === "companySolver");
    if (!companyBoard) els.companySolverDetailPane.innerHTML = "";
  }
}

function render() {
  hideTransientOverlays();
  document.body.dataset.view = state.view;
  document.body.dataset.pageMode = isMapView(state.view) ? "map" : isContentView(state.view) ? "content" : "special";
  document.body.dataset.detailOpen = String(isDetailPageRoute());
  document.body.dataset.mapFullscreen = String(state.mapFullscreen);
  document.body.dataset.companySolver = String(state.detailKind === "companySolver");
  document.body.dataset.companyComposer = String(state.detailKind === "companyComposer");
  document.body.dataset.countryMobileMap = String(state.countryMobileMapOpen);
  document.body.dataset.countryMobileFilters = String(state.countryMobileFiltersOpen);
  document.body.dataset.countryMobileDetail = String(state.view === "country" && isDetailPageRoute() ? "open" : "closed");
  document.body.dataset.cultureMobileMap = String(state.cultureMobileMapOpen);
  document.body.dataset.cultureMobileFilters = String(state.cultureMobileFiltersOpen);
  document.body.dataset.cultureMobileDetail = String(state.view === "culture" && isDetailPageRoute() && state.detailKind !== "cultureIncorporation" ? "open" : "closed");
  document.body.dataset.cultureIncorporation = String(state.view === "culture" && state.detailKind === "cultureIncorporation");
  if (els.homeWelcome) els.homeWelcome.hidden = state.view !== "home";
  if (els.homeLinks) els.homeLinks.hidden = state.view !== "home";
  document.body.classList.toggle("detail-page", isDetailPageRoute() && state.detailKind !== "cultureIncorporation");
  document.body.classList.toggle("global-search-active", Boolean(state.globalSearch));
  updatePageChrome();
  syncMapFullscreenControls();
  if (els.filterPanelTitle) {
    const title = toolPanelTitle();
    els.filterPanelTitle.textContent = title;
    els.filterPanelTitle.closest(".filters")?.setAttribute("aria-label", title);
  }
  syncInfoDialogVisibility();
  updateResultsPanelMode();
  els.countryViewButton?.setAttribute("aria-pressed", String(state.view === "country"));
  els.cultureViewButton?.setAttribute("aria-pressed", String(state.view === "culture"));
  els.regionViewButton?.setAttribute("aria-pressed", String(state.view === "region"));
  els.companyViewButton?.setAttribute("aria-pressed", String(state.view === "company"));
  els.ideologyViewButton?.setAttribute("aria-pressed", String(state.view === "ideology"));
  els.lawViewButton?.setAttribute("aria-pressed", String(state.view === "law"));
  document.querySelectorAll("[data-nav-view]").forEach((button) => {
    button.setAttribute("aria-current", String(button.dataset.navView === state.view));
  });
  syncTopbarNavigationGroups();
  setTokenPressed(els.filteredCountryMapToggle, state.dimUnfilteredCountries);
  els.strategicRegionFilterTitle.textContent = state.view === "culture"
    ? t("filter.homelandStrategicRegions")
    : state.view === "company"
      ? t("filter.relatedStrategicRegions")
      : t("filter.strategicRegions");
  els.resourceFilterTitle.textContent = state.view === "company" ? t("filter.relatedBuildings") : t("filter.resources");
  els.searchInput.placeholder = searchPlaceholder();
  if (els.eventSearchInput && state.view === "event" && els.eventSearchInput.value !== state.search) els.eventSearchInput.value = state.search;
  if (els.eventFilters) els.eventFilters.hidden = state.view !== "event";
  if (els.journalFilters) els.journalFilters.hidden = state.view !== "journal";
  if (els.decisionFilters) els.decisionFilters.hidden = state.view !== "decision";
  renderSortOptions();
  renderStrategicRegionFilterOptions();
  renderGeographicRegionFilterOptions();
  renderResourceFilterOptions();
  renderStateTraitFilterOptions();
  renderCompanyFilterOptions();
  renderIdeologyFilterOptions();
  renderLawFilterOptions();
  renderEventFilterOptions();
  syncVictorianCenturyChangeFilter();
  syncFilterSectionOpenStates();
  renderMapControls();

  if (state.view === "home") {
    renderHomeBoard();
  } else if (state.view === "news") {
    renderNewsBoard();
  } else if (state.view === "changelog") {
    renderChangelogBoard();
  } else if (state.view === "culture") {
    renderCultureBoard();
  } else if (state.view === "region") {
    renderRegionBoard();
  } else if (state.view === "company") {
    renderCompanyBoard();
  } else if (state.view === "ideology") {
    renderIdeologyBoard();
  } else if (state.view === "religion") {
    renderReligionBoard();
  } else if (state.view === "interest-group") {
    renderInterestGroupBoard();
  } else if (state.view === "law") {
    renderLawBoard();
  } else if (state.view === "technology") {
    renderTechnologyBoard();
  } else if (state.view === "achievement") {
    renderAchievementBoard();
  } else if (state.view === "event") {
    renderEventBoard();
  } else if (state.view === "journal") {
    renderJournalBoard();
  } else if (state.view === "decision") {
    renderDecisionBoard();
  } else if (state.view === "building") {
    renderBuildingBoard();
  } else if (state.view === "goods") {
    renderGoodsBoard();
  } else {
    renderCountryBoard();
  }
  syncBoardOwnedToolPanels();
  const boardManagesDetail = state.view === "home" || state.view === "interest-group" || state.view === "religion" || state.view === "technology" || state.view === "achievement" || state.view === "event" || state.view === "journal" || state.view === "decision" || state.view === "building" || state.view === "goods" || state.view === "news";
  if (!boardManagesDetail && state.view !== "changelog" && isDetailPageRoute()) {
    renderDetailForState();
  } else if (!boardManagesDetail && state.detailKind !== "companyComposer") {
    els.detail.innerHTML = "";
  }
}

function isDetailPageRoute() {
  return Boolean(detailRouteKey());
}

function detailRouteKey() {
  const [route, key] = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (!route || !key) return "";
  if (route === "goods" && key === "needs") return "";
  if (route === "company" && ["solver", "composer"].includes(key)) return "";
  return ["country", "culture", "state-region", "strategic-region", "geographic-region", "company", "ideology", "religion", "law", "technology", "achievement", "event", "journal", "decision", "building", "goods"].includes(route) ? key : "";
}

function syncFilterSectionOpenStates() {
  const hasPressedToken = (container) => Boolean(container?.querySelector('[data-filter-token][aria-pressed="true"]'));
  const setSection = (selector, open) => {
    document.querySelectorAll(selector).forEach((section) => {
      if (open) section.open = true;
    });
  };

  if (!hasInitializedFilterSections) initializeDefaultFilterSectionOpenStates();
  setSection(".filter-section:has(#resourceFilters)", state.resourceFilters.size > 0 || state.includeIndustryCharter);
  setSection(".filter-section:has(#stateTraitFilters)", state.stateTraitFilters.size > 0);
  setSection(".filter-section:has(#countryTypeFilters)", state.view === "country" || state.types.size > 0 || state.flags.size > 0);
  setSection(".filter-section:has(#tierFilters)", state.view === "country" || state.tiers.size > 0);
  setSection(".filter-section:has(#strategicRegionFilters)", state.view === "country" || state.strategicRegions.size > 0);
  setSection(".filter-section:has(#geographicRegionFilters)", state.view === "company" && Boolean(state.selectedGeographicRegion));
  setSection(".filter-section:has(#companyKindFilters)", state.companyKinds.size > 0);
  setSection(".filter-section:has(#companyPrestigeFilters)", state.companyPrestigeGoods.size > 0);
  setSection(".filter-section:has(#companyDlcFilters)", state.companyDlcs.size > 0);
  setSection(".filter-section:has(#ideologyTypeFilters)", state.ideologyTypes.size > 0);
  setSection(".filter-section:has(#ideologyGroupFilters)", state.ideologyGroups.size > 0);
  setSection(".filter-section:has(#ideologyOccurrenceFilters)", state.ideologyOccurrences.size > 0);
  setSection(".filter-section:has(#ideologyLawGroupFilters)", state.ideologyLawGroups.size > 0);
  setSection(".filter-section:has(#lawGroupFilters)", ["law", "ideology"].includes(state.view) || state.lawGroups.size > 0 || state.commonLawIdeologyOnly);
  setSection(".filter-section:has(#victorianCenturyAddedFilter)", state.victorianCenturyChangeKinds.size > 0);
  setSection(".filter-section:has(#heritageGroupFilters)", state.heritageGroups.size > 0 || state.heritages.size > 0);
  setSection(".filter-section:has(#languageGroupFilters)", state.languageGroups.size > 0 || state.languages.size > 0);
  setSection(".filter-section:has(#traditionFilters)", Boolean(state.tradition));
  document.querySelectorAll(".filter-section").forEach((section) => {
    if (!section.open && hasPressedToken(section)) section.open = true;
  });
  hasInitializedFilterSections = true;
}

function syncVictorianCenturyChangeFilter() {
  if (!els.victorianCenturyChangeFilterSection || !els.victorianCenturyAddedFilter || !els.victorianCenturyAdjustedFilter) return;
  const available = Boolean(standaloneSiteConfig) || [
    countries,
    cultures,
    cultureTraits,
    stateRegions,
    companies,
    interestGroups,
    interestGroupTraits,
    ideologies,
    laws,
    technologies,
  ].some((items) => (items || []).some(hasVictorianCenturyChange));
  if (!available) state.victorianCenturyChangeKinds.clear();
  els.victorianCenturyChangeFilterSection.hidden = !available;
  setTokenPressed(els.victorianCenturyAddedFilter, state.victorianCenturyChangeKinds.has("added"));
  setTokenPressed(els.victorianCenturyAdjustedFilter, state.victorianCenturyChangeKinds.has("adjusted"));
}

function initializeDefaultFilterSectionOpenStates() {
  const defaultOpenFilterIds = new Set([
    "resourceFilters",
    "terrainMapViewButton",
    "companyKindFilters",
    "companyPrestigeFilters",
    "companyDlcFilters",
    "strategicRegionFilters",
  ]);
  document.querySelectorAll(".filter-section").forEach((section) => {
    section.open = [...defaultOpenFilterIds].some((filterId) => section.querySelector(`#${filterId}`));
  });
}
