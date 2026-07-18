function setOptionalText(node, text) {
  if (!node) return;
  node.replaceChildren(document.createTextNode(text));
}

async function init() {
  await loadCountryFlagData();
  await loadInitialDataset();
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
  if (versionConfig) {
    const version = selectedVersionFromLocation() || versionConfig.default_version;
    await loadVersion(version || versionConfig.versions?.[0]?.version, { replaceUrl: false });
    return;
  }
  applyLoadedDataset(window.VIC3_DATA || {}, window.VIC3_MAP_DATA || null);
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
  dataIndex = nextDataIndex || null;
  loadedDataVersion = entry.version;
  loadedDataChunks.clear();
  applyLoadedDataset({ meta: dataIndex?.meta || {} }, nextMapData || null);
  await ensureDataChunksForRoute();
  if (els.versionSelect) els.versionSelect.value = entry.version;
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
  return [];
}

async function ensureDataChunksForRoute() {
  return ensureDataChunks(dataChunksForView(routeView()));
}

function routeView() {
  const segment = location.hash.replace(/^#\/?/, "").split("/")[0];
  if (["country", "culture", "region", "company", "ideology", "law", "technology"].includes(segment)) return segment;
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
        const chunk = await loadScriptValue(`versions/${loadedDataVersion}/${file}`, "VIC3_DATA_CHUNK");
        for (const [field, value] of Object.entries(chunk || {})) {
          data[field] = field === "countries" ? [...(data[field] || []), ...(value || [])] : value;
        }
      }
      loadedDataChunks.add(key);
    }
  })();
  try {
    await dataChunkLoadPromise;
    applyLoadedDataset(data, mapData);
  } finally {
    dataChunkLoadPromise = null;
  }
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

function applyLoadedDataset(nextData, nextMapData) {
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
  cultureTraitByKey = new Map(cultureTraits.map((trait) => [trait.key, trait]));
  cultureTraitGroupByKey = new Map(cultureTraitGroups.map((group) => [group.key, group]));
  stateKeyByProvinceColor = buildStateKeyByProvinceColor();
  landStrategicRegions = strategicRegions.filter((region) => !isSeaStrategicRegion(region));
  seaStrategicRegions = strategicRegions.filter(isSeaStrategicRegion);
  seaStateRegionKeys = new Set(seaStrategicRegions.flatMap((region) => (
    (region.states || []).map((stateRegion) => stateRegion.key)
  )));
  landStateRegions = stateRegions.filter((stateRegion) => !isSeaStateRegion(stateRegion));
  landGeographicRegions = geographicRegions.filter((region) => geographicRegionStateRegions(region).some((stateRegion) => !isSeaStateRegion(stateRegion)));
  groupedGeographicRegions = geographicRegions.filter((region) => region.geographic_region_group && !region.is_current_strategic_region);
  resetDatasetState();
  resetMapRuntime();
  updateMetaLine();
  renderVersionOptions();
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
  state.dimUnfilteredCountries = false;
  state.tradition = "";
  state.mapSubject = "";
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
  setOptionalText(els.metaLine, `${datasetPrefix}版本 ${data.meta?.victoria3_version || "未知"}，国家 ${dataCount("countries", countries)} 个，文化 ${dataCount("cultures", cultures)} 个，州地区 ${dataCount("stateRegions", stateRegions)} 个，地理区域 ${dataCount("geographicRegions", groupedGeographicRegions)} 个，公司 ${dataCount("companies", companies)} 个，意识形态 ${dataCount("ideologies", ideologies)} 个，法律 ${dataCount("laws", laws)} 条`);
}

function renderVersionOptions() {
  if (!els.versionSelect || !versionConfig) return;
  const entries = (versionConfig.versions || []).slice();
  els.versionSelect.innerHTML = entries.map((entry) => (
    `<option value="${escapeHtml(entry.version)}"${data.meta?.victoria3_version === entry.version ? " selected" : ""}>${escapeHtml(entry.label || entry.version)}</option>`
  )).join("");
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
