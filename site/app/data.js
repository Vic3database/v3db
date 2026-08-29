function setOptionalText(node, text) {
  if (!node) return;
  node.replaceChildren(document.createTextNode(text));
}

async function init() {
  await initializeLocale();
  await loadCountryFlagData();
  await loadInitialDataset();
  syncStaticUiText();
  syncViewLabels();
  initTheme();
  initDisplaySettings();
  renderFilterOptions();
  bindEvents();
  globalThis.bindCharacterBoardEvents?.();
  els.homeGuideButton?.addEventListener("click", () => openInfoDialog("about"));
  await applyHash();
  render();
}

async function loadCountryFlagData() {
  countryFlagData = window.VIC3_COUNTRY_FLAGS || await loadScriptValue("assets/flags/country-flags.js", "VIC3_COUNTRY_FLAGS") || {};
}

async function loadInitialDataset() {
  if (standaloneSiteConfig) {
    await loadStandaloneDataset();
    return;
  }
  if (versionConfig) {
    const version = selectedVersionFromLocation() || versionConfig.default_version;
    await loadVersion(version || versionConfig.versions?.[0]?.version, { replaceUrl: false });
    return;
  }
  applyLoadedDataset(window.VIC3_DATA || {}, window.VIC3_MAP_DATA || null);
}

async function loadStandaloneDataset() {
  setOptionalText(els.metaLine, t("ui.loadingDataset", { dataset: "Victorian Century" }));
  const [nextDataIndex, nextMapData] = await Promise.all([
    loadScriptValue(standaloneSiteConfig.dataIndex, "VIC3_DATA_INDEX"),
    loadScriptValue(standaloneSiteConfig.mapData, "VIC3_MAP_DATA"),
  ]);
  loadedDataVersion = "";
  dataIndex = nextDataIndex || null;
  await loadSearchIndex();
  await activateInitialLocaleAfterDataIndex();
  loadedDataChunks.clear();
  applyLoadedDataset({ meta: dataIndex?.meta || {} }, nextMapData || null);
  await ensureDataChunks(["religion", ...dataChunksForCurrentRoute()]);
}

function selectedVersionFromLocation() {
  const params = new URLSearchParams(window.location.search);
  return params.get("version") || "";
}

async function loadVersion(version, options = {}) {
  const entry = versionEntry(version) || versionEntry(versionConfig?.default_version) || versionConfig?.versions?.[0];
  if (!entry) {
    applyLoadedDataset(window.VIC3_DATA || {}, window.VIC3_MAP_DATA || null);
    return;
  }
  setOptionalText(els.metaLine, t("ui.loadingDataset", { dataset: entry.label || entry.version }));
  const [nextDataIndex, nextMapData] = await Promise.all([
    loadScriptValue(entry.data_index, "VIC3_DATA_INDEX"),
    loadScriptValue(entry.map_data, "VIC3_MAP_DATA"),
  ]);
  loadedDataVersion = entry.version;
  dataIndex = nextDataIndex || null;
  await loadSearchIndex();
  await activateInitialLocaleAfterDataIndex();
  loadedDataChunks.clear();
  applyLoadedDataset({ meta: dataIndex?.meta || {} }, nextMapData || null);
  await ensureDataChunks(["religion", ...dataChunksForCurrentRoute()]);
  if (options.replaceUrl !== false) {
    const params = new URLSearchParams(window.location.search);
    params.set("version", entry.version);
    history.replaceState(null, "", `?${params.toString()}${window.location.hash}`);
  }
}

function dataChunksForView(view) {
  if (view === "country") return ["country", "culture", "region", "ideology", "law", "content"];
  if (view === "culture") return ["culture", "region", "country"];
  if (view === "region") return ["region", "country", "culture", "company"];
  if (view === "company") return ["company", "region", "country"];
  if (view === "ideology") return ["ideology", "law", "country"];
  if (view === "religion") return ["religion", "country", "ideology", "culture"];
  if (view === "interest-group") return ["ideology", "country", "culture", "region", "law"];
  if (view === "law") return ["law", "ideology", "country"];
  if (view === "technology") return ["technology"];
  if (view === "achievement") return ["achievement"];
  if (view === "event") return standaloneSiteConfig ? ["content", "country"] : ["event", "country"];
  if (view === "journal" || view === "decision") return ["content", "country"];
  if (view === "content") return ["content"]; // Compatibility routes load the shared data before redirecting.
  if (view === "building") return ["building", "goods"];
  if (view === "goods") return ["goods"];
  if (view === "character") return ["character", "culture", "ideology"];
  if (view === "name-pool") return ["name-pool", "culture"];
  return [];
}

function dataChunksForCurrentRoute() {
  const chunkKeys = dataChunksForView(routeView());
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "company" && ["solver", "composer"].includes(parts[1])) chunkKeys.push("building", "goods");
  if (parts[0] === "region" && parts[1] === "resource") chunkKeys.push("building");
  if (parts[0] === "goods" && parts[1] === "needs") chunkKeys.push("needs");
  return [...new Set(chunkKeys)];
}

async function ensureDataChunksForRoute() {
  const chunkKeys = dataChunksForCurrentRoute();
  const needsRoute = chunkKeys.includes("needs");
  try {
    await ensureDataChunks(chunkKeys);
    if (needsRoute) state.needsLoadError = "";
  } catch (error) {
    if (!needsRoute) throw error;
    state.needsLoadError = error instanceof Error ? error.message : String(error);
  }
}

function routeView() {
  const segment = location.hash.replace(/^#\/?/, "").split("/")[0];
  if (["country", "culture", "region", "company", "ideology", "religion", "interest-group", "law", "technology", "achievement", "event", "journal", "decision", "content", "building", "goods", "character", "name-pool"].includes(segment)) return segment;
  if (["news", "changelog"].includes(segment)) return segment;
  if (["state-region", "strategic-region", "geographic-region"].includes(segment)) return "region";
  return "home";
}

async function ensureDataChunks(chunkKeys) {
  if (!dataIndex?.chunks) return;
  const pending = chunkKeys.filter((key) => !loadedDataChunks.has(key));
  if (!pending.length) return;
  if (dataChunkLoadPromise) {
    await dataChunkLoadPromise;
    return ensureDataChunks(chunkKeys);
  }
  dataChunkLoadPromise = (async () => {
    for (const key of pending) {
      const entry = dataIndex.chunks[key];
      for (const file of entry?.files || []) {
        const chunk = await loadScriptValue(dataChunkPath(file), "VIC3_DATA_CHUNK");
        for (const [field, value] of Object.entries(chunk || {})) {
          data[field] = field === "countries" ? [...(data[field] || []), ...(value || [])] : value;
        }
      }
      loadedDataChunks.add(key);
    }
    await ensureLocaleChunks(chunkKeys);
  })();
  try {
    await dataChunkLoadPromise;
    applyLoadedDataset(data, mapData);
  } finally {
    dataChunkLoadPromise = null;
  }
}

function dataChunkPath(file) {
  if (!standaloneSiteConfig) return `versions/${loadedDataVersion}/${file}`;
  const dataRoot = String(standaloneSiteConfig.dataRoot || ".").replace(/\\/g, "/").replace(/\/+$/, "");
  return !dataRoot || dataRoot === "." ? file : `${dataRoot}/${file}`;
}

function localeChunkPath(file) {
  return dataChunkPath(file);
}

async function loadSearchIndex() {
  const entry = dataIndex?.locales?.search_index;
  if (!entry?.path) return;
  await loadScript(`${localeChunkPath(entry.path)}?v=${encodeURIComponent(entry.sha256 || "")}`);
}

async function ensureLocaleChunks(chunkKeys, locale = localeRuntime.current, targetMessages = localeRuntime.dataMessages[locale] || {}) {
  const entries = chunkKeys.flatMap((key) => dataIndex?.locales?.chunks?.[locale]?.[key]?.files || []);
  const loaded = [];
  for (const entry of entries) {
    const cacheKey = `${locale}:${entry.path}`;
    if (localeRuntime.loadedChunks.has(cacheKey)) {
      mergeLocaleMessages(targetMessages, localeRuntime.dataMessages[locale] || {}, locale);
      continue;
    }
    await loadScript(`${localeChunkPath(entry.path)}?v=${encodeURIComponent(entry.sha256 || "")}`);
    const chunk = window.VIC3_LOCALE_CHUNKS?.[entry.id];
    if (!chunk || chunk.locale !== locale) throw new Error(`Invalid locale chunk ${entry.id}`);
    mergeLocaleMessages(targetMessages, chunk.messages || {}, locale);
    loaded.push(cacheKey);
  }
  if (!localeRuntime.dataMessages[locale]) localeRuntime.dataMessages[locale] = targetMessages;
  loaded.forEach((key) => localeRuntime.loadedChunks.add(key));
  return loaded;
}

function versionEntry(version) {
  return (versionConfig?.versions || []).find((item) => item.version === version) || null;
}

function loadScriptValue(src, globalName) {
  return new Promise((resolve, reject) => {
    if (!src) {
      resolve(null);
      return;
    }
    window[globalName] = undefined;
    const script = document.createElement("script");
    script.src = `${src}${src.includes("?") ? "&" : "?"}v=${Date.now()}`;
    script.async = true;
    script.onload = () => {
      const value = window[globalName];
      script.remove();
      resolve(value);
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(t("ui.scriptLoadFailed", { src })));
    };
    document.head.appendChild(script);
  });
}

function applyLoadedDataset(nextData, nextMapData, options = {}) {
  data = nextData || {};
  globalSearchDetailCache = null;
  countries = data.countries || [];
  cultures = data.cultures || [];
  cultureTraits = data.cultureTraits || [];
  cultureTraitGroups = data.cultureTraitGroups || [];
  cultureHomelandEffects = data.cultureHomelandEffects || [];
  stateRegions = data.stateRegions || [];
  strategicRegions = data.strategicRegions || [];
  geographicRegions = data.geographicRegions || [];
  companies = data.companies || [];
  companyCharterTypes = data.companyCharterTypes || [];
  interestGroups = data.interestGroups || [];
  interestGroupTraits = data.interestGroupTraits || [];
  ideologies = data.ideologies || [];
  religions = data.religions || [];
  laws = data.laws || [];
  lawGroups = data.lawGroups || [];
  technologies = data.technologies || [];
  technologyEras = data.technologyEras || [];
  achievements = data.achievements || [];
  events = data.events || data.contentEvents || [];
  journalEntries = data.journalEntries || [];
  journalEntryGroups = data.journalEntryGroups || [];
  contentEvents = data.contentEvents || [];
  decisions = data.decisions || [];
  contentByCountry = data.contentByCountry || {};
  if (standaloneSiteConfig && data.contentEvents?.length) events = data.contentEvents;
  buildings = data.buildings || [];
  buildingGroups = data.buildingGroups || [];
  productionMethodGroups = data.productionMethodGroups || [];
  productionMethods = data.productionMethods || [];
  goods = data.goods || [];
  prestigeGoods = data.prestigeGoods || [];
  needsData = data.needsData || null;
  historicalCharacters = data.historicalCharacters || [];
  historicalCharacterStats = data.historicalCharacterStats || {};
  historicalCharacterImages = data.historicalCharacterImages || [];
  historicalCharacterImageStats = data.historicalCharacterImageStats || {};
  namePools = data.namePools || [];
  namePoolStats = data.namePoolStats || {};
  mapData = nextMapData || null;
  siteTitle = versionConfig?.site_title || data.meta?.site_title || data.meta?.dataset_name || "Vicdata";

  byTag = new Map(countries.map((country) => [country.tag, country]));
  byCulture = new Map(cultures.map((culture) => [culture.key, culture]));
  byStateRegion = new Map(stateRegions.map((stateRegion) => [stateRegion.key, stateRegion]));
  byStrategicRegion = new Map(strategicRegions.map((strategicRegion) => [strategicRegion.key, strategicRegion]));
  byGeographicRegion = new Map(geographicRegions.map((region) => [region.key, region]));
  byCompany = new Map(companies.map((company) => [company.key, company]));
  byInterestGroup = new Map(interestGroups.map((group) => [group.key, group]));
  interestGroupTraitByKey = new Map(interestGroupTraits.map((trait) => [trait.key, trait]));
  ideologyByKey = new Map(ideologies.map((ideology) => [ideology.key, ideology]));
  religionByKey = new Map(religions.map((religion) => [religion.key, religion]));
  lawByKey = new Map(laws.map((law) => [law.key, law]));
  lawGroupByKey = new Map(lawGroups.map((group) => [group.key, group]));
  technologyByKey = new Map(technologies.map((technology) => [technology.key, technology]));
  achievementByKey = new Map(achievements.map((achievement) => [achievement.key, achievement]));
  eventByKey = new Map(events.map((event) => [event.key || event.id, { ...event, key: event.key || event.id, script: event.script || { trigger: event.trigger_raw || "", immediate: event.immediate_raw || "" }, loc: event.loc || { title: event.title_key, desc: event.desc_key, flavor: event.flavor_key, options: Object.fromEntries((event.options || []).map((option) => [option.name_key, option.name_key])) } }]));
  events = [...eventByKey.values()];
  buildingRecordByKey = new Map(buildings.map((building) => [building.key, building]));
  buildingGroupByKey = new Map(buildingGroups.map((group) => [group.key, group]));
  productionMethodGroupByKey = new Map(productionMethodGroups.map((group) => [group.key, group]));
  productionMethodByKey = new Map(productionMethods.map((method) => [method.key, method]));
  goodByKey = new Map(goods.map((good) => [good.key, good]));
  prestigeGoodByKey = new Map(prestigeGoods.map((good) => [good.key, good]));
  byHistoricalCharacter = new Map(historicalCharacters.map((character) => [character.key, character]));
  byHistoricalCharacterImage = new Map(historicalCharacterImages.flatMap((person) => (
    (person.character_keys || []).map((key) => [key, person])
  )));
  byNamePool = new Map(namePools.map((pool) => [pool.key, pool]));
  cultureTraitByKey = new Map(cultureTraits.map((trait) => [trait.key, trait]));
  cultureTraitGroupByKey = new Map(cultureTraitGroups.map((group) => [group.key, group]));
  buildSemanticTagIndexes();
  stateKeyByProvinceColor = buildStateKeyByProvinceColor();
  landStrategicRegions = strategicRegions.filter((region) => !isSeaStrategicRegion(region));
  seaStrategicRegions = strategicRegions.filter(isSeaStrategicRegion);
  seaStateRegionKeys = new Set(seaStrategicRegions.flatMap((region) => (
    (region.states || []).map((stateRegion) => stateRegion.key)
  )));
  landStateRegions = stateRegions.filter((stateRegion) => !isSeaStateRegion(stateRegion));
  landGeographicRegions = geographicRegions.filter((region) => geographicRegionStateRegions(region).some((stateRegion) => !isSeaStateRegion(stateRegion)));
  groupedGeographicRegions = geographicRegions.filter((region) => region.geographic_region_group && !region.is_current_strategic_region);
  if (!options.preserveState) {
    resetDatasetState();
    resetMapRuntime();
  }
  updateMetaLine();
  renderLibraryOptions();
}

function buildSemanticTagIndexes() {
  stateTraitByKey = new Map();
  stateTraitRegionsByKey = new Map();
  buildingByKey = new Map();
  goodsByKey = new Map();

  for (const stateRegion of stateRegions) {
    indexSemanticItems(stateTraitByKey, stateRegion.traits);
    indexStateTraitRegions(stateRegion);
    indexSemanticItems(buildingByKey, stateRegion.arable_resources);
    indexSemanticItems(buildingByKey, stateRegion.capped_resources);
    indexSemanticItems(buildingByKey, stateRegion.discoverable_resources);
  }

  for (const company of companies) {
    indexSemanticItems(buildingByKey, company.building_types);
    indexSemanticItems(buildingByKey, company.extension_building_types);
    indexSemanticItems(buildingByKey, company.referenced_buildings);
    indexSemanticItems(goodsByKey, company.possible_prestige_goods);
  }
  indexSemanticItems(buildingByKey, buildings);
  indexSemanticItems(goodsByKey, goods);
  syncEconomyResourceFilters();
}

function indexStateTraitRegions(stateRegion) {
  const region = {
    id: stateRegion?.id || `state_region:${stateRegion?.key || ""}`,
    key: stateRegion?.key || "",
    loc: stateRegion?.loc || {},
  };
  if (!region.key) return;
  for (const trait of stateRegion?.traits || []) {
    const key = trait?.key || "";
    if (!key) continue;
    const regions = stateTraitRegionsByKey.get(key) || [];
    if (!regions.some((item) => item.key === region.key)) regions.push(region);
    stateTraitRegionsByKey.set(key, regions);
  }
}

function indexSemanticItems(index, items) {
  for (const item of items || []) {
    const key = item?.key || "";
    if (!key || index.has(key)) continue;
    index.set(key, item);
  }
}

function dataCount(field, loadedRows) {
  if (loadedDataChunks.size || !dataIndex?.chunks) return loadedRows.length;
  for (const chunk of Object.values(dataIndex.chunks)) {
    if (Object.hasOwn(chunk.counts || {}, field)) return chunk.counts[field];
  }
  return loadedRows.length;
}

function resetDatasetState() {
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
  state.companyKinds.clear();
  state.includeIndustryCharter = false;
  state.companyPrestigeGoods.clear();
  state.companyDlcs.clear();
  state.ideologyTypes.clear();
  state.ideologyGroups.clear();
  state.ideologyOccurrences.clear();
  state.ideologyLawGroups.clear();
  state.lawGroups.clear();
  state.eventTypes.clear();
  state.eventFlavorKinds.clear();
  state.eventTags.clear();
  state.victorianCenturyOnly = false;
  state.dimUnfilteredCountries = false;
  state.regionMapView = "default";
    state.tradition = "";
    state.mapSubject = "";
    state.countryMobileFiltersOpen = false;
    state.countryMobileMapOpen = true;
    state.countryMobileFilterCategory = "type";
    state.countryMobileListScrollTop = 0;
    state.countryMobileRestoreScrollPending = false;
    state.selectedTag = "";
  state.selectedCulture = "";
  state.selectedStateRegion = "";
  state.selectedStrategicRegion = "";
  state.selectedGeographicRegion = "";
  state.selectedCompany = "";
  state.companyComposer.selectedCompanyKeys = [];
  state.companyComposer.selectedExtensions = {};
  state.selectedIdeology = "";
  state.selectedLaw = "";
  state.selectedEvent = "";
  state.selectedBuilding = "";
  state.selectedGood = "";
  state.selectedCharacter = "";
  state.characterPage = 1;
  state.selectedNamePool = "";
  state.characterSources?.clear?.();
  state.characterGenders?.clear?.();
  state.economySearch = "";
  state.goodsPanel = "list";
  state.needsTable = "substitutes";
  state.needsCompareBaseline = false;
  state.needsLoadError = "";
  state.selectedProductionMethods.clear();
  state.openProductionMethodGroup = "";
  state.selectedGlobalResult = "";
  if (els.searchInput) els.searchInput.value = "";
  if (els.globalSearchDialogInput) els.globalSearchDialogInput.value = "";
  if (els.globalSearchDetailedToggle) els.globalSearchDetailedToggle.checked = state.globalSearchDetailed;
  if (els.globalSearchLegacyToggle) els.globalSearchLegacyToggle.checked = false;
  hasInitializedFilterSections = false;
}

function resetMapRuntime() {
  if (!mapRuntime) return;
  mapRuntime.ready = false;
  mapRuntime.loading = false;
  mapRuntime.error = "";
  mapRuntime.sourcePixels = null;
  mapRuntime.provinceMapImage = null;
  mapRuntime.provinceSampleContext = null;
  mapRuntime.stateTraitIconImages = new Map();
  mapRuntime.stateTraitIconLoading = null;
  mapRuntime.stateKeysByIndex = [""];
  mapRuntime.ownerKeysByIndex = [""];
  mapRuntime.terrainKeysByIndex = [""];
  mapRuntime.pixelStateIndexes = null;
  mapRuntime.pixelOwnerIndexes = null;
  mapRuntime.pixelTerrainIndexes = null;
  mapRuntime.filteredCountryTags = new Set();
  mapRuntime.countrySearchMatchedTags = new Set();
  mapRuntime.layerCache = new Map();
  mapRuntime.layerSignature = "";
  mapRuntime.lastMapStateRegions = null;
}

function updateMetaLine() {
  setOptionalText(els.metaLine, t("ui.datasetSummary", {
    dataset: data.meta?.dataset_name || siteTitle,
    version: data.meta?.victoria3_version || t("ui.unknown"),
    countries: localizedNumber(dataCount("countries", countries)),
    cultures: localizedNumber(dataCount("cultures", cultures)),
    regions: localizedNumber(dataCount("stateRegions", stateRegions)),
    geographicRegions: localizedNumber(dataCount("geographicRegions", groupedGeographicRegions)),
    companies: localizedNumber(dataCount("companies", companies)),
    ideologies: localizedNumber(dataCount("ideologies", ideologies)),
    laws: localizedNumber(dataCount("laws", laws)),
  }));
}

function renderLibraryOptions() {
  if (!els.librarySelect || !versionConfig) return;
  const entries = Array.isArray(versionConfig.libraries) ? versionConfig.libraries : [];
  els.librarySelect.innerHTML = entries.map((entry) => (
    `<option value="${escapeHtml(entry.id)}">${escapeHtml(t(entry.labelKey || "ui.libraryLabel", { label: entry.label }))}</option>`
  )).join("");
  els.librarySelect.value = "vic3";
}

function libraryEntry(id) {
  return (versionConfig?.libraries || []).find((entry) => entry.id === id) || null;
}

function syncViewLabels() {
  const buttonByView = {
    country: els.countryViewButton,
    culture: els.cultureViewButton,
    region: els.regionViewButton,
    company: els.companyViewButton,
    ideology: els.ideologyViewButton,
    law: els.lawViewButton,
  };
  for (const view of Object.keys(viewLabels)) {
    const label = viewLabel(view);
    if (buttonByView[view]) buttonByView[view].textContent = label;
    const option = els.viewSelect?.querySelector(`option[value="${view}"]`);
    if (option) option.textContent = label;
  }
}

function renderFilterOptions() {
  const tiers = unique(countries.map((country) => country.tier).filter(Boolean))
    .sort((a, b) => orderValueByList(tierOrder, a) - orderValueByList(tierOrder, b) || a.localeCompare(b));
  const types = unique(countries.map((country) => country.countryType).filter(Boolean))
    .sort((a, b) => orderValueByList(countryTypeOrder, a) - orderValueByList(countryTypeOrder, b) || a.localeCompare(b));
  const heritageGroups = collectCultureRefs((culture) => culture.heritage_group, sortHeritageGroupRef);
  const languageGroups = collectCultureRefs((culture) => culture.language_group);
  const traditions = collectCultureRefs((culture) => culture.traditions || []);

  els.tierFilters.innerHTML = tiers.map((tier) => {
    return optionToken("tier", tier, t(`enum.tier.${tier}`), state.tiers.has(tier));
  }).join("");

  els.countryTypeFilters.innerHTML = types.map((type) => {
    const sample = countries.find((country) => country.countryType === type);
    return optionToken("type", type, countryTypeTagLabel(sample || { countryType: type }), state.types.has(type));
  }).join("");

  els.heritageGroupFilters.innerHTML = heritageGroups.map((group) => (
    optionToken("heritage-group", group.key, entityText(group), state.heritageGroups.has(group.key))
  )).join("");

  els.languageGroupFilters.innerHTML = languageGroups.map((group) => (
    optionToken("language-group", group.key, entityText(group), state.languageGroups.has(group.key))
  )).join("");

  els.traditionFilters.innerHTML = traditions.map((trait) => (
    optionToken("tradition", trait.key, entityText(trait), state.tradition === trait.key)
  )).join("");

  renderDependentFilterOptions();
  renderStrategicRegionFilterOptions();
  renderGeographicRegionFilterOptions();
  renderResourceFilterOptions();
  renderCompanyFilterOptions();
  renderIdeologyFilterOptions();
  renderLawFilterOptions();
  renderSortOptions();
}
