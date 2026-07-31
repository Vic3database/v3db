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
  setOptionalText(els.metaLine, "正在加载 Victorian Century 数据");
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
  await ensureDataChunksForRoute();
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
  setOptionalText(els.metaLine, `正在加载 ${entry.label || entry.version}`);
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
  await ensureDataChunksForRoute();
  if (options.replaceUrl !== false) {
    const params = new URLSearchParams(window.location.search);
    params.set("version", entry.version);
    history.replaceState(null, "", `?${params.toString()}${window.location.hash}`);
  }
}

function dataChunksForView(view) {
  if (view === "country") return ["country", "culture", "region", "ideology"];
  if (view === "culture") return ["culture", "region", "country"];
  if (view === "region") return ["region", "country", "culture", "company"];
  if (view === "company") return ["company", "region", "country"];
  if (view === "ideology") return ["ideology", "law", "country"];
  if (view === "law") return ["law", "ideology", "country"];
  if (view === "technology") return ["technology"];
  if (view === "achievement") return ["achievement"];
  return [];
}

async function ensureDataChunksForRoute() {
  return ensureDataChunks(dataChunksForView(routeView()));
}

function routeView() {
  const segment = location.hash.replace(/^#\/?/, "").split("/")[0];
  if (["country", "culture", "region", "company", "ideology", "law", "technology", "achievement"].includes(segment)) return segment;
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
    hydrateLegacyLocalizedFields(data);
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
  await loadScript(localeChunkPath(entry.path));
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
    await loadScript(localeChunkPath(entry.path));
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
      reject(new Error(`无法加载 ${src}`));
    };
    document.head.appendChild(script);
  });
}

function applyLoadedDataset(nextData, nextMapData, options = {}) {
  data = nextData || {};
  countries = data.countries || [];
  cultures = data.cultures || [];
  cultureTraits = data.cultureTraits || [];
  cultureTraitGroups = data.cultureTraitGroups || [];
  stateRegions = data.stateRegions || [];
  strategicRegions = data.strategicRegions || [];
  geographicRegions = data.geographicRegions || [];
  companies = data.companies || [];
  companyCharterTypes = data.companyCharterTypes || [];
  interestGroups = data.interestGroups || [];
  interestGroupTraits = data.interestGroupTraits || [];
  ideologies = data.ideologies || [];
  laws = data.laws || [];
  lawGroups = data.lawGroups || [];
  technologies = data.technologies || [];
  technologyEras = data.technologyEras || [];
  achievements = data.achievements || [];
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
  lawByKey = new Map(laws.map((law) => [law.key, law]));
  lawGroupByKey = new Map(lawGroups.map((group) => [group.key, group]));
  technologyByKey = new Map(technologies.map((technology) => [technology.key, technology]));
  achievementByKey = new Map(achievements.map((achievement) => [achievement.key, achievement]));
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

function hydrateLegacyLocalizedFields(value) {
  const fields = {
    name: ["name_zh", "name"],
    description: ["desc_zh", "description_zh"],
    tier: ["tierZh", "tier_zh"],
    countryType: ["countryTypeZh", "country_type_zh"],
    category: ["category_zh"],
    type: ["type_zh"],
    groupName: ["group_name_zh"],
    sourceName: ["source_name_zh"],
    label: ["label_zh"],
    summary: ["summary_zh"],
    valueDisplay: ["value_zh"],
    adjective: ["adjective_zh"],
    dlcName: ["dlc_name_zh"],
  };
  function visit(item) {
    if (Array.isArray(item)) return item.forEach(visit);
    if (!item || typeof item !== "object") return;
    for (const [field, messageId] of Object.entries(item.loc || {})) {
      const text = translateMessage(messageId, item.key || item.tag || messageId);
      for (const legacyField of fields[field] || [`${field}_zh`]) item[legacyField] = text;
    }
    const searchEntry = window.VIC3_SEARCH_INDEX?.entries?.find((entry) => entry.id === item.id);
    if (searchEntry?.names?.en) item.name_en = searchEntry.names.en;
    for (const child of Object.values(item)) visit(child);
  }
  visit(value);
  return value;
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
}

function indexStateTraitRegions(stateRegion) {
  const region = { key: stateRegion?.key || "", name_zh: stateRegion?.name_zh || "" };
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
  state.victorianCenturyOnly = false;
  state.dimUnfilteredCountries = false;
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
  state.selectedIdeology = "";
  state.selectedLaw = "";
  state.selectedGlobalResult = "";
  if (els.searchInput) els.searchInput.value = "";
  if (els.globalSearchDialogInput) els.globalSearchDialogInput.value = "";
  if (els.globalSearchLegacyToggle) els.globalSearchLegacyToggle.checked = false;
  hasInitializedFilterSections = false;
}

function resetMapRuntime() {
  if (!mapRuntime) return;
  mapRuntime.ready = false;
  mapRuntime.loading = false;
  mapRuntime.error = "";
  mapRuntime.sourcePixels = null;
  mapRuntime.stateKeysByIndex = [""];
  mapRuntime.ownerKeysByIndex = [""];
  mapRuntime.pixelStateIndexes = null;
  mapRuntime.pixelOwnerIndexes = null;
  mapRuntime.filteredCountryTags = new Set();
  mapRuntime.countrySearchMatchedTags = new Set();
  mapRuntime.layerCache = new Map();
  mapRuntime.layerSignature = "";
  mapRuntime.lastMapStateRegions = null;
}

function updateMetaLine() {
  const datasetPrefix = data.meta?.dataset_name ? `${data.meta.dataset_name}，` : "";
  setOptionalText(els.metaLine, `${datasetPrefix}版本 ${data.meta?.victoria3_version || "未知"}，国家 ${dataCount("countries", countries)} 个，文化 ${dataCount("cultures", cultures)} 个，地域 ${dataCount("stateRegions", stateRegions)} 个，地理区域 ${dataCount("geographicRegions", groupedGeographicRegions)} 个，公司 ${dataCount("companies", companies)} 个，意识形态 ${dataCount("ideologies", ideologies)} 个，法律 ${dataCount("laws", laws)} 条`);
}

function renderLibraryOptions() {
  if (!els.librarySelect || !versionConfig) return;
  const entries = Array.isArray(versionConfig.libraries) ? versionConfig.libraries : [];
  els.librarySelect.innerHTML = entries.map((entry) => (
    `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.label)}</option>`
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
  for (const [view, label] of Object.entries(viewLabels)) {
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
    const sample = countries.find((country) => country.tier === tier);
    return optionToken("tier", tier, sample?.tierZh || tier, state.tiers.has(tier));
  }).join("");

  els.countryTypeFilters.innerHTML = types.map((type) => {
    const sample = countries.find((country) => country.countryType === type);
    return optionToken("type", type, countryTypeTagLabel(sample || { countryType: type }), state.types.has(type));
  }).join("");

  els.heritageGroupFilters.innerHTML = heritageGroups.map((group) => (
    optionToken("heritage-group", group.key, group.name_zh, state.heritageGroups.has(group.key))
  )).join("");

  els.languageGroupFilters.innerHTML = languageGroups.map((group) => (
    optionToken("language-group", group.key, group.name_zh, state.languageGroups.has(group.key))
  )).join("");

  els.traditionFilters.innerHTML = traditions.map((trait) => (
    optionToken("tradition", trait.key, trait.name_zh || trait.key, state.tradition === trait.key)
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
