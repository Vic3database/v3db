function renderMapControls() {
  const mapResetLabel = state.view === "region" ? t("map.resetRegionFocus", "重置地域焦点和地图位置") : t("map.resetPosition", "重置地图位置");
  els.mapFitWidthButton?.setAttribute("aria-label", mapResetLabel);
  els.mapFitWidthButton?.setAttribute("title", mapResetLabel);
  syncMapModeForView();
  const terrainViewEnabled = state.view === "region" && state.regionMapView === "terrain";
  els.terrainMapViewButton?.setAttribute("aria-pressed", String(terrainViewEnabled));
  if (state.view === "ideology" || state.view === "law") {
    renderMapResourceContext();
    renderTerrainMapLegend();
    return;
  }
  if (!els.mapModeSelect || !els.mapSubjectSelect) {
    renderMapResourceContext();
    renderTerrainMapLegend();
    return;
  }
  els.mapModeSelect.value = state.mapMode;
  const options = mapSubjectOptions(state.mapMode);
  if (!options.some((option) => option.value === state.mapSubject)) {
    state.mapSubject = defaultMapSubject(state.mapMode, options);
  }
  els.mapSubjectSelect.innerHTML = options.map((option) => (
    `<option value="${escapeHtml(option.value)}"${state.mapSubject === option.value ? " selected" : ""}>${escapeHtml(option.label)}</option>`
  )).join("");
  renderMapResourceContext();
  renderTerrainMapLegend();
}

function renderTerrainMapLegend() {
  if (!els.terrainMapLegend) return;
  const enabled = state.view === "region" && state.regionMapView === "terrain";
  els.terrainMapLegend.hidden = !enabled;
  if (!enabled) return;
  els.terrainMapLegend.innerHTML = terrainLegendEntries.map((entry) => (
    `<span class="terrain-map-legend-item"><span class="terrain-map-legend-swatch" style="--terrain-map-color: ${escapeHtml(entry.color)}" aria-hidden="true"></span>${escapeHtml(t(entry.labelKey))}</span>`
  )).join("");
}

function mapResourceContextResourceKey() {
  if (!["resource", "resourceSelection"].includes(state.mapMode)) return "";
  return state.mapSubject || "";
}

function renderMapResourceContext() {
  if (!els.mapResourceContext) return;
  const resourceKey = mapResourceContextResourceKey();
  if (!resourceKey) {
    els.mapResourceContext.hidden = true;
    els.mapResourceContext.textContent = "";
    return;
  }
  const fileName = buildingIconFileByKey[resourceKey];
  const icon = fileName
    ? `<img class="map-resource-context-icon" src="assets/buildings/${encodeURIComponent(fileName)}" alt="">`
    : `<span class="map-resource-context-swatch" style="--map-resource-context-color: ${escapeHtml(resourceMapColor(resourceKey))}" aria-hidden="true"></span>`;
  const label = mapSubjectLabel();
  const version = standaloneSiteConfig ? t("map.vcResourceContext", "Victorian Century/真实资源储量与耕地") : (data.meta?.victoria3_version || t("ui.unknown", "未知"));
  els.mapResourceContext.hidden = false;
  els.mapResourceContext.innerHTML = `${icon}<span class="map-resource-context-name">${escapeHtml(label)}</span><span class="map-resource-context-version">· ${escapeHtml(version)}</span>`;
}

function syncMapModeForView() {
  if (state.view === "ideology" || state.view === "law") {
    state.mapMode = "";
    state.mapSubject = "";
    return;
  }
  if (state.view === "country") {
    state.mapMode = "country";
    state.mapSubject = "";
    return;
  }
  if (state.view === "company") {
    state.mapMode = "company";
    state.mapSubject = "";
    return;
  }
  if (state.view === "culture") {
    if (state.selectedCulture) {
      state.mapMode = "culture";
      state.mapSubject = state.selectedCulture;
    } else if (hasCultureSelection()) {
      state.mapMode = "cultureFilter";
      state.mapSubject = "";
    } else {
      state.mapMode = "culture";
    }
    return;
  }
  if (state.view === "region" && state.stateTraitFilters.size > 0) {
    state.mapMode = "traitIcons";
    state.mapSubject = "";
    return;
  }
  if (state.view === "region" && state.regionMapView === "terrain") {
    state.mapMode = "terrain";
    state.mapSubject = "";
    return;
  }
  if (state.view === "region" && state.resourceFilters.size > 0) {
    const filter = resourceFilterByKey.get([...state.resourceFilters][0]);
    if (filter?.mapMode === "subsistenceBuildings") {
      state.mapMode = "subsistenceBuildings";
      state.mapSubject = "";
      return;
    }
    state.mapMode = "resourceSelection";
    state.mapSubject = [...state.resourceFilters][0] || "";
    return;
  }
  if (state.view === "region") {
    state.mapMode = "strategicRegion";
    state.mapSubject = "";
    return;
  }
  state.mapMode = "country";
  state.mapSubject = "";
}

function mapSubjectOptions(mode) {
  if (mode === "country" || mode === "company" || mode === "cultureFilter" || mode === "resourceSelection" || mode === "strategicRegion" || mode === "terrain" || mode === "subsistenceBuildings") {
    return [{ value: state.mapSubject || "", label: automaticMapSubjectLabel(mode) }];
  }
  if (mode === "culture") {
    return cultures
      .slice()
      .sort(sortCultures)
      .map((culture) => ({ value: culture.key, label: entityText(culture) || culture.key }));
  }
  if (mode === "trait") {
    const traits = collectStateTraitRefs();
    return [
      { value: "__any_trait", label: t("map.allStateTraits", "全部地区特质") },
      ...traits.map((trait) => ({ value: trait.key, label: entityText(trait) || trait.key })),
    ];
  }
  return collectMapResourceRefs().map((resource) => ({ value: resource.key, label: entityText(resource) || resource.key }));
}

function defaultMapSubject(mode, options) {
  if (mode === "resource" && options.some((option) => option.value === "building_oil_rig")) return "building_oil_rig";
  if (mode === "culture" && state.selectedCulture && options.some((option) => option.value === state.selectedCulture)) return state.selectedCulture;
  if (mode === "culture" && options.some((option) => option.value === "french")) return "french";
  return options[0]?.value || "";
}

function collectMapResourceRefs() {
  const ordered = resourceFilterGroups.flatMap((group) => group.filters || []).map((filter) => {
    const source = buildingByKey.get((filter.resources || filter.arableResources || filter.companyBuildings || [])[0] || filter.key);
    return { key: filter.key, loc: source?.loc };
  });
  const byKey = new Map(ordered.map((item) => [item.key, item]));
  for (const stateRegion of stateRegions) {
    for (const item of [
      ...(stateRegion.capped_resources || []),
      ...(stateRegion.discoverable_resources || []),
      ...(stateRegion.arable_resources || []),
    ]) {
      if (item?.key && !byKey.has(item.key)) byKey.set(item.key, item);
    }
  }
  return [...byKey.values()];
}

function collectStateTraitRefs() {
  const byKey = new Map();
  for (const stateRegion of stateRegions) {
    for (const trait of stateRegion.traits || []) {
      if (!matchesVictorianCenturyChange(trait)) continue;
      if (trait?.key && !byKey.has(trait.key)) byKey.set(trait.key, trait);
    }
  }
  return [...byKey.values()].sort(sortRefByName);
}

function renderMap(mapStateRegions) {
  if (!els.mapCanvas) return;
  syncMapModeForView();
  mapRuntime.visibleStateKeys = new Set((mapStateRegions || []).map((stateRegion) => stateRegion.key));
  mapRuntime.lastMapStateRegions = mapStateRegions || [];
  if (!mapRuntime.ready) {
    ensureMapLoaded();
    return;
  }
  ensureMapLayer();
  paintMapCanvas();
}

function ensureMapLayer() {
  const signature = mapLayerSignature();
  const cachedLayer = getCachedMapLayer(signature);
  if (cachedLayer) {
    mapRuntime.featureByStateKey = cachedLayer.features;
    mapRuntime.layerCanvas = cachedLayer.canvas;
    mapRuntime.currentMaxValue = cachedLayer.currentMaxValue || 0;
    mapRuntime.currentCompanyMaxValue = cachedLayer.currentCompanyMaxValue || 0;
    mapRuntime.layerSignature = signature;
    return;
  }
  mapRuntime.currentMaxValue = 0;
  mapRuntime.currentCompanyMaxValue = 0;
  const features = buildMapFeatures();
  mapRuntime.featureByStateKey = features;
  drawMapLayer(features);
  cacheMapLayer(signature, {
    canvas: mapRuntime.layerCanvas,
    features,
    currentMaxValue: mapRuntime.currentMaxValue || 0,
    currentCompanyMaxValue: mapRuntime.currentCompanyMaxValue || 0,
  });
  mapRuntime.layerSignature = signature;
}

function mapLayerSignature() {
  const parts = [
    state.mapMode,
    state.mapSubject || "",
    `visible:${setSignature(mapRuntime.visibleStateKeys)}`,
    `stateTraits:${setSignature(state.stateTraitFilters)}`,
  ];
  if (state.mapMode === "country") {
    parts.push(`selected:${selectedCountryMapSignature()}`);
    parts.push(`white:${state.whiteDecentralized ? 1 : 0}`);
    parts.push(`subjects:${state.subjectOverlordColors ? 1 : 0}`);
    parts.push(`search:${setSignature(mapRuntime.countrySearchMatchedTags)}`);
    parts.push(`global:${state.globalSearchColorRestoreTag || ""}`);
    parts.push(`dim:${shouldDimUnfilteredCountries() ? 1 : 0}`);
    if (shouldDimUnfilteredCountries()) parts.push(`countries:${setSignature(mapRuntime.filteredCountryTags)}`);
  }
  if (state.mapMode === "company") {
    parts.push(`companies:${objectKeySignature(mapRuntime.companyMapCompanies)}`);
  }
  if (state.mapMode === "resourceSelection") {
    parts.push(`resources:${setSignature(state.resourceFilters)}`);
  }
  if (state.mapMode === "cultureFilter") {
    parts.push(`strategicRegions:${setSignature(state.strategicRegions)}`);
    parts.push(`heritageGroups:${setSignature(state.heritageGroups)}`);
    parts.push(`heritages:${setSignature(state.heritages)}`);
    parts.push(`languageGroups:${setSignature(state.languageGroups)}`);
    parts.push(`languages:${setSignature(state.languages)}`);
    parts.push(`tradition:${state.tradition || ""}`);
  }
  return parts.join("|");
}

function getCachedMapLayer(signature) {
  const entry = mapRuntime.layerCache.get(signature);
  if (!entry) return null;
  mapRuntime.layerCache.delete(signature);
  mapRuntime.layerCache.set(signature, entry);
  return entry;
}

function cacheMapLayer(signature, entry) {
  if (!signature || !entry?.canvas || !entry?.features) return;
  mapRuntime.layerCache.set(signature, entry);
  while (mapRuntime.layerCache.size > MAP_LAYER_CACHE_LIMIT) {
    const oldestKey = mapRuntime.layerCache.keys().next().value;
    mapRuntime.layerCache.delete(oldestKey);
  }
}

function setSignature(values) {
  return [...(values || [])].filter(Boolean).sort().join(",");
}

function objectKeySignature(items) {
  return (items || []).map((item) => item?.key).filter(Boolean).sort().join(",");
}

function ensureMapLoaded() {
  if (mapRuntime.ready || mapRuntime.loading) return;
  mapRuntime.loading = true;
  if (!mapData?.runs || !mapData?.stateKeys) {
    mapRuntime.loading = false;
    mapRuntime.error = "地图索引文件缺失";
    return;
  }
  window.setTimeout(async () => {
    mapRuntime.paperMapImage = await loadImage(mapRuntime.paperMapUrl).catch(() => null);
    mapRuntime.provinceMapImage = await loadImage(mapRuntime.imageUrl).catch(() => null);
    mapRuntime.width = mapData.width || mapRuntime.width;
    mapRuntime.height = mapData.height || mapRuntime.height;
    mapRuntime.stateKeysByIndex = mapData.stateKeys || [""];
    mapRuntime.ownerKeysByIndex = mapData.ownerKeys || [""];
    mapRuntime.terrainKeysByIndex = mapData.terrainKeys || [""];
    mapRuntime.pixelStateIndexes = decodeMapRuns(mapData.runs, mapRuntime.width * mapRuntime.height);
    mapRuntime.pixelOwnerIndexes = mapData.ownerRuns
      ? decodeMapRuns(mapData.ownerRuns, mapRuntime.width * mapRuntime.height)
      : null;
    mapRuntime.pixelTerrainIndexes = mapData.terrainRuns
      ? decodeMapRuns(mapData.terrainRuns, mapRuntime.width * mapRuntime.height)
      : null;
    mapRuntime.stateCenters = computeMapStateCenters(mapRuntime.pixelStateIndexes, mapRuntime.width, mapRuntime.height, mapRuntime.stateKeysByIndex);
    await loadStateTraitIconImages();
    mapRuntime.ready = true;
    mapRuntime.loading = false;
    resetMapTransform();
    renderMap(mapRuntime.lastMapStateRegions || landStateRegions);
    focusCurrentMapSelection();
    renderCompanyDetailLocationMap();
  }, 0);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function decodeMapRuns(runs, expectedLength) {
  const indexes = new Int32Array(expectedLength);
  let cursor = 0;
  for (let i = 0; i < runs.length; i += 2) {
    const index = runs[i] || 0;
    const length = runs[i + 1] || 0;
    indexes.fill(index, cursor, cursor + length);
    cursor += length;
  }
  return indexes;
}

function computeMapStateCenters(indexes, width, height, stateKeysByIndex) {
  const halfWidth = width / 2;
  const sums = Array.from({ length: stateKeysByIndex.length }, () => ({
    x: 0,
    y: 0,
    count: 0,
    leftCount: 0,
    minX: width,
    maxX: -1,
  }));
  for (let pixel = 0; pixel < indexes.length; pixel += 1) {
    const index = indexes[pixel];
    if (!index) continue;
    const item = sums[index];
    const x = pixel % width;
    item.x += x;
    item.y += Math.floor(pixel / width);
    item.count += 1;
    if (x < halfWidth) item.leftCount += 1;
    if (x < item.minX) item.minX = x;
    if (x > item.maxX) item.maxX = x;
  }
  const centers = new Map();
  for (let index = 1; index < sums.length; index += 1) {
    const item = sums[index];
    const key = stateKeysByIndex[index];
    if (!key || !item.count) continue;
    const wrapsAroundWorldEdge = item.maxX - item.minX > halfWidth;
    const x = wrapsAroundWorldEdge
      ? ((item.x + item.leftCount * width) / item.count) % width
      : item.x / item.count;
    centers.set(key, {
      x,
      y: item.y / item.count,
      count: item.count,
    });
  }
  return centers;
}

function buildMapFeatures() {
  if (state.mapMode === "country") return buildCountryMapFeatures();
  if (state.mapMode === "strategicRegion") return buildStrategicRegionMapFeatures();
  if (state.mapMode === "traitIcons") return buildTraitIconMapFeatures();
  if (state.mapMode === "terrain") return buildTerrainMapFeatures();
  if (state.mapMode === "subsistenceBuildings") return buildSubsistenceBuildingMapFeatures();
  if (state.mapMode === "company") return buildCompanyMapFeatures();
  if (state.mapMode === "resourceSelection") return buildSelectedResourceMapFeatures();
  if (state.mapMode === "cultureFilter") return buildCultureFilterMapFeatures();
  if (state.mapMode === "culture") return buildCultureMapFeatures();
  if (state.mapMode === "trait") return buildTraitMapFeatures();
  return buildResourceMapFeatures();
}

function loadStateTraitIconImages() {
  if (mapRuntime.stateTraitIconLoading) return mapRuntime.stateTraitIconLoading;
  const fileNames = [...new Set(stateRegions
    .flatMap((stateRegion) => (stateRegion.traits || []).map(stateTraitIconFileName))
    .filter(Boolean))];
  mapRuntime.stateTraitIconLoading = Promise.all(fileNames.map(async (fileName) => {
    const image = await loadImage(`assets/state-traits/${encodeURIComponent(fileName)}`).catch(() => null);
    if (image) mapRuntime.stateTraitIconImages.set(fileName, image);
  }));
  return mapRuntime.stateTraitIconLoading;
}

function stateTraitIconFileName(trait) {
  const iconPath = String(trait?.icon || "");
  return iconPath
    ? iconPath.split(/[\\/]/).at(-1).replace(/\.dds$/i, ".png")
    : `${String(trait?.key || "").replace(/^state_trait_/, "")}.png`;
}

function buildTraitIconMapFeatures() {
  const features = new Map();
  for (const stateRegion of stateRegions) {
    const traits = stateRegion.traits || [];
    const matchingTraits = matchingStateTraits(stateRegion);
    const isSea = isSeaStateRegion(stateRegion);
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, isSea ? MAP_SEA_COLOR : "#eee9df"),
      active: matchingTraits.length > 0,
      value: matchingTraits.length,
      traits: traits,
      matchingTraits,
    });
  }
  return features;
}

function mapFeatureColor(stateRegion, color) {
  if (isSeaStateRegion(stateRegion)) return MAP_SEA_COLOR;
  return mapRuntime.visibleStateKeys.has(stateRegion.key) ? color : MAP_MUTED_COLOR;
}

const REGION_MAP_FOCUS_COLOR = "#00cc66";
const COMPANY_LOCATION_MAP_COLOR = "#00cc66";
const COMPANY_LOCATION_BORDER_COLOR = "#c8a45b";
const terrainLegendEntries = [
  { key: "plains", labelKey: "enum.terrain.plains", color: "#d9c989", rgb: [217, 201, 137] },
  { key: "forest", labelKey: "enum.terrain.forest", color: "#4f8756", rgb: [79, 135, 86] },
  { key: "hills", labelKey: "enum.terrain.hills", color: "#a98262", rgb: [169, 130, 98] },
  { key: "mountain", labelKey: "enum.terrain.mountain", color: "#887f78", rgb: [136, 127, 120] },
  { key: "jungle", labelKey: "enum.terrain.jungle", color: "#23745f", rgb: [35, 116, 95] },
  { key: "wetland", labelKey: "enum.terrain.wetland", color: "#78a69a", rgb: [120, 166, 154] },
  { key: "desert", labelKey: "enum.terrain.desert", color: "#d69d56", rgb: [214, 157, 86] },
  { key: "tundra", labelKey: "enum.terrain.tundra", color: "#9eb1a6", rgb: [158, 177, 166] },
  { key: "savanna", labelKey: "enum.terrain.savanna", color: "#b4a95a", rgb: [180, 169, 90] },
  { key: "snow", labelKey: "enum.terrain.snow", color: "#dce5ea", rgb: [220, 229, 234] },
];
const terrainLegendByKey = new Map(terrainLegendEntries.map((entry) => [entry.key, entry]));
const terrainLandKeys = new Set(terrainLegendEntries.map((entry) => entry.key));

function buildTerrainMapFeatures() {
  const features = new Map();
  for (const stateRegion of stateRegions) {
    const isSea = isSeaStateRegion(stateRegion);
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, isSea ? MAP_SEA_COLOR : "#e9edeb"),
      active: !isSea,
      value: 0,
      title: isSea ? t("board.region.sea", "海域") : t("map.provinceTerrain", "省份地形"),
    });
  }
  return features;
}

function buildCompanyMapFeatures() {
  const selectedCompanies = mapRuntime.companyMapCompanies || companies;
  const associations = buildCompanyStateAssociations(selectedCompanies);
  const maxValue = Math.max(0, ...[...associations.values()].map((item) => item.count));
  mapRuntime.currentCompanyMaxValue = maxValue;
  const features = new Map();
  for (const stateRegion of stateRegions) {
    const isSea = isSeaStateRegion(stateRegion);
    const association = associations.get(stateRegion.key) || emptyCompanyAssociation();
    const region = primaryStrategicRegionForState(stateRegion);
    const color = isSea ? MAP_SEA_COLOR : companyAssociationColor(association.count);
    const title = isSea ? t("board.region.sea", "海域") : companyAssociationTitle(association, region);
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, color),
      active: association.count > 0,
      value: association.count,
      label: association.count > 1 ? String(association.count) : "",
      title,
      companyAssociation: association,
    });
  }
  return features;
}

function buildCompanyStateAssociations(selectedCompanies) {
  const associations = new Map();
  for (const company of selectedCompanies || []) {
    const headquarters = new Set((company.preferred_headquarters || []).map((stateRegion) => stateRegion.key).filter(Boolean));
    const stateKeys = companyLocationStateRegionKeys(company);
    const referenced = new Set(stateKeys.filter((stateKey) => !headquarters.has(stateKey)));
    for (const stateKey of stateKeys) {
      const stateRegion = byStateRegion.get(stateKey);
      if (!stateRegion || isSeaStateRegion(stateRegion)) continue;
      if (!associations.has(stateKey)) associations.set(stateKey, emptyCompanyAssociation());
      const association = associations.get(stateKey);
      association.count += 1;
      if (headquarters.has(stateKey)) association.headquarters += 1;
      if (referenced.has(stateKey) && !headquarters.has(stateKey)) association.special += 1;
      association.companies.push({
        key: company.key,
        id: company.id || `company:${company.key}`,
        loc: company.loc,
        kind: headquarters.has(stateKey) ? "headquarters" : "special",
      });
    }
  }
  return associations;
}

function emptyCompanyAssociation() {
  return {
    count: 0,
    headquarters: 0,
    special: 0,
    companies: [],
  };
}

function primaryStrategicRegionForState(stateRegion) {
  return (stateRegion.strategic_regions || [])
    .map((region) => byStrategicRegion.get(region.key))
    .filter((region) => region && !isSeaStrategicRegion(region))
    .sort(sortStrategicRegionRef)[0] || null;
}

function geographicRegionStateRegions(region) {
  if (!region) return [];
  return uniqueByKey((region.state_regions || [])
    .map((stateRef) => byStateRegion.get(stateRef.key) || stateRef)
    .filter((stateRef) => stateRef?.key))
    .sort(sortStateRegions);
}

const COMPANY_LOCATION_STATE_PATTERN = /\b(?:s:)?(STATE_[A-Z0-9_]+)\b/g;
const COMPANY_LOCATION_STRATEGIC_REGION_PATTERN = /\bsr:(region_[a-z0-9_]+)\b/g;
const COMPANY_LOCATION_GEOGRAPHIC_REGION_PATTERN = /\b(?:is_in_geographic_region\s*=\s*)(geographic_region_[a-z0-9_]+)\b/g;
const COMPANY_LOCATION_HOMELAND_CULTURE_PATTERN = /\bis_homeland\s*=\s*cu:([a-z0-9_]+)\b/g;
const COMPANY_LOCATION_STATE_TRAIT_PATTERN = /\bhas_state_trait\s*=\s*(state_trait_[a-z0-9_]+)\b/g;

function companyLocationRule(company) {
  return COMPANY_LOCATION_RULES?.[company?.key] || {};
}

function companyOperationalLocationRaw(company) {
  return [
    company?.possible_raw,
    company?.attainable_raw,
    company?.ai_construction_targets_raw,
  ].filter(Boolean).join("\n");
}

function locationMatches(raw, pattern) {
  return [...String(raw || "").matchAll(pattern)].map((match) => match[1]);
}

function homelandCultureStateRegionKeys(cultureKeys) {
  const cultures = new Set(cultureKeys || []);
  if (!cultures.size) return [];
  return stateRegions
    .filter((stateRegion) => (stateRegion.homeland_cultures || []).some((culture) => cultures.has(culture.key)))
    .map((stateRegion) => stateRegion.key);
}

function stateTraitStateRegionKeys(traitKeys) {
  const traits = new Set(traitKeys || []);
  if (!traits.size) return [];
  return stateRegions
    .filter((stateRegion) => (stateRegion.traits || []).some((trait) => traits.has(trait.key)))
    .map((stateRegion) => stateRegion.key);
}

function companyOperationalLocationStateRegionKeys(company) {
  const raw = companyOperationalLocationRaw(company);
  const directStateKeys = locationMatches(raw, COMPANY_LOCATION_STATE_PATTERN);
  const strategicStateKeys = locationMatches(raw, COMPANY_LOCATION_STRATEGIC_REGION_PATTERN)
    .flatMap((regionKey) => (byStrategicRegion.get(regionKey)?.states || []).map((stateRef) => stateRef.key));
  const geographicStateKeys = locationMatches(raw, COMPANY_LOCATION_GEOGRAPHIC_REGION_PATTERN)
    .flatMap((regionKey) => {
      const geographicStates = geographicRegionStateRegions(byGeographicRegion.get(regionKey)).map((stateRegion) => stateRegion.key);
      const strategicStates = (COMPANY_LOCATION_GEOGRAPHIC_REGION_STRATEGIC_REGIONS?.[regionKey] || [])
        .flatMap((strategicKey) => (byStrategicRegion.get(strategicKey)?.states || []).map((stateRef) => stateRef.key));
      return [...geographicStates, ...strategicStates];
    });
  const homelandStateKeys = homelandCultureStateRegionKeys(locationMatches(raw, COMPANY_LOCATION_HOMELAND_CULTURE_PATTERN));
  const stateTraitKeys = stateTraitStateRegionKeys(locationMatches(raw, COMPANY_LOCATION_STATE_TRAIT_PATTERN));
  return unique([
    ...directStateKeys,
    ...strategicStateKeys,
    ...geographicStateKeys,
    ...homelandStateKeys,
    ...stateTraitKeys,
  ]);
}

function companyLocationStateRegionKeys(company) {
  if (!companyDetailLocationMapEnabled(company)) return [];
  const rule = companyLocationRule(company);
  const headquarters = (company.preferred_headquarters || []).map((stateRegion) => stateRegion.key);
  const initialHeadquarters = COMPANY_INITIAL_HEADQUARTERS?.[company.key] || [];
  const configuredHomelands = homelandCultureStateRegionKeys(rule.homelandCultureKeys);
  const configuredStateTraits = stateTraitStateRegionKeys(rule.stateTraitKeys);
  const derivedLocationKeys = companyOperationalLocationStateRegionKeys(company);
  const baseLocationKeys = rule.replaceDerivedLocations ? [] : derivedLocationKeys;
  const excludedStateKeys = new Set(rule.excludeStateKeys || []);
  return unique([
    ...headquarters,
    ...initialHeadquarters,
    ...baseLocationKeys,
    ...configuredHomelands,
    ...configuredStateTraits,
    ...(rule.stateKeys || []),
  ]).filter((stateKey) => {
    const stateRegion = byStateRegion.get(stateKey);
    return stateRegion && !isSeaStateRegion(stateRegion) && !excludedStateKeys.has(stateKey);
  });
}

function companyDetailLocationMapEnabled(company) {
  if (!company || company.is_easter_egg_company) return false;
  if (company.key.startsWith("company_basic_")) return false;
  return companyLocationRule(company).map !== false;
}

function companyLocationSummary(company, stateKeys) {
  const rule = companyLocationRule(company);
  if (rule.homelandCultureKeys?.length === 1) {
    const cultureKey = rule.homelandCultureKeys[0];
    const culture = (company.referenced_cultures || []).find((item) => item.key === cultureKey);
    return t("map.companyCultureHomelands", { culture: entityText(culture) || cultureKey, count: localizedNumber(stateKeys.length) });
  }
  return t("map.companyHeadquartersAndConditions", { count: localizedNumber(stateKeys.length) });
}

function geographicRegionStrategicRegions(region) {
  if (!region) return [];
  const directRefs = (region.strategic_regions || [])
    .map((strategicRef) => byStrategicRegion.get(strategicRef.key) || strategicRef)
    .filter((strategicRef) => strategicRef?.key);
  const expandedRefs = geographicRegionStateRegions(region)
    .flatMap((stateRegion) => stateRegion.strategic_regions || [])
    .map((strategicRef) => byStrategicRegion.get(strategicRef.key) || strategicRef)
    .filter((strategicRef) => strategicRef?.key);
  return uniqueByKey([...directRefs, ...expandedRefs]).sort(sortStrategicRegionRef);
}

function geographicRegionStrategicRegionKeys(region) {
  return geographicRegionStrategicRegions(region).map((strategicRegion) => strategicRegion.key);
}

function uniqueByTag(items) {
  const map = new Map();
  for (const item of items || []) {
    if (!item?.tag || map.has(item.tag)) continue;
    map.set(item.tag, item);
  }
  return [...map.values()].sort((a, b) => a.tag.localeCompare(b.tag));
}

function companyAssociationColor(count) {
  return count > 0 ? COMPANY_LOCATION_MAP_COLOR : "#f5f1e8";
}

function companyAssociationTitle(association, region) {
  if (!association.count) {
    return t("map.noCompanyAssociation", { region: entityText(region) || t("map.noStrategicRegion", "无战略区域") });
  }
  const companyNames = association.companies
    .slice(0, 5)
    .map((company) => entityText(company) || company.key)
    .join("、");
  const more = association.companies.length > 5 ? t("map.moreCompanies", { count: localizedNumber(association.companies.length) }) : "";
  return [
    t("map.companyAssociationCount", { region: entityText(region) || t("map.noStrategicRegion", "无战略区域"), count: localizedNumber(association.count) }),
    t("map.companyHeadquartersCount", { count: localizedNumber(association.headquarters) }),
    t("map.companyConditionCount", { count: localizedNumber(association.special) }),
    [companyNames, more].filter(Boolean).join(""),
  ].filter(Boolean).join(t("ui.semicolon", "；"));
}

function companyMapStateRegions(selectedCompanies) {
  const stateKeys = unique((selectedCompanies || []).flatMap((company) => companyLocationStateRegionKeys(company)));
  if (!stateKeys.length) return stateRegions;
  return stateKeys.map((stateKey) => byStateRegion.get(stateKey)).filter(Boolean);
}

function regionMapStateRegions(filteredStateRegions, filteredSeaStateRegions, filteredGeographicRegions) {
  if (state.stateTraitFilters.size > 0) return filteredStateRegions;
  const selectedStateRegion = byStateRegion.get(state.selectedStateRegion);
  if (selectedStateRegion && !isSeaStateRegion(selectedStateRegion)) return [selectedStateRegion];
  if (state.selectedGeographicRegion) {
    const selectedRegion = byGeographicRegion.get(state.selectedGeographicRegion) || filteredGeographicRegions[0];
    const geographicStateKeys = new Set((selectedRegion ? geographicRegionStateRegions(selectedRegion) : []).map((stateRegion) => stateRegion.key));
    const states = filteredStateRegions.filter((stateRegion) => geographicStateKeys.has(stateRegion.key));
    return states.length ? states : filteredStateRegions;
  }
  if (state.resourceFilters.size > 0 || state.strategicRegions.size > 0) {
    return [...filteredStateRegions, ...filteredSeaStateRegions];
  }
  return stateRegions;
}

function buildStrategicRegionMapFeatures() {
  const features = new Map();
  const selectedGeographicStateKeys = state.selectedGeographicRegion
    ? new Set(geographicRegionStateRegions(byGeographicRegion.get(state.selectedGeographicRegion)).map((stateRegion) => stateRegion.key))
    : null;
  for (const stateRegion of stateRegions) {
    const region = primaryStrategicRegionForState(stateRegion);
    const isSea = isSeaStateRegion(stateRegion);
    const inGeographicRegion = selectedGeographicStateKeys?.has(stateRegion.key);
    const color = isSea
      ? MAP_SEA_COLOR
      : stateRegion.key === state.selectedStateRegion
        ? REGION_MAP_FOCUS_COLOR
        : inGeographicRegion
          ? "#4f8a61"
          : region?.map_color?.hex || "#d7d8cf";
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, color),
      active: selectedGeographicStateKeys ? Boolean(inGeographicRegion) : Boolean(region),
      value: selectedGeographicStateKeys ? Number(Boolean(inGeographicRegion)) : region ? 1 : 0,
      title: selectedGeographicStateKeys
        ? inGeographicRegion
          ? entityText(byGeographicRegion.get(state.selectedGeographicRegion)) || t("board.region.geographicRegion", "地理区域")
          : t("map.outsideGeographicRegion", "不在当前地理区域")
        : region ? strategicRegionName(region) : t("map.noStrategicRegion", "无战略区域"),
      strategicRegion: region,
    });
  }
  return features;
}

function buildCountryMapFeatures() {
  const selectedCountry = byTag.get(state.selectedTag);
  const selectedStateKeys = new Set(countryMapStateKeys(selectedCountry));
  const features = new Map();
  for (const stateRegion of stateRegions) {
    const isSea = isSeaStateRegion(stateRegion);
    const owners = stateRegion.starting_owners || [];
    const owner = owners[0]?.tag ? byTag.get(owners[0].tag) : null;
    if (selectedCountry && selectedStateKeys.size > 0) {
      const isSelectedTerritory = selectedStateKeys.has(stateRegion.key);
      features.set(stateRegion.key, {
        color: isSea
          ? MAP_SEA_COLOR
          : isSelectedTerritory
            ? selectedCountryMapColor(selectedCountry)
            : MAP_MUTED_COLOR,
        active: isSelectedTerritory,
        value: Number(isSelectedTerritory),
        title: isSea
          ? "娴峰煙"
          : isSelectedTerritory
            ? `${selectedCountry.name} (${selectedCountry.tag})`
            : "涓嶅湪褰撳墠鍥藉榛樿棰嗗湡",
      });
      continue;
    }
    const color = isSea
      ? "#b9d7df"
      : countryOwnerMapColor(owner, owners[0]?.tag || "");
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, color),
      active: owners.length > 0,
      value: owners.length,
      title: isSea ? "海域" : owners.length ? `开局归属：${refNames(owners)}` : "无开局归属",
    });
  }
  return features;
}

function countryMapStateRegions(country) {
  const selectedKeys = countryMapStateKeys(country);
  if (selectedKeys.length) {
    return selectedKeys
      .map((key) => byStateRegion.get(key))
      .filter(Boolean);
  }
  return stateRegions;
}

function countryMapStateKeys(country) {
  if (!country) return [];
  const formationStateKeys = [
    ...(country.formationStateRegions || []).map((stateRegion) => stateRegion.key),
    ...(country.formationStates || []),
  ].filter(Boolean);
  if (formationStateKeys.length) return unique(formationStateKeys);
  if (country.formationRegion) {
    const region = byGeographicRegion.get(country.formationRegion);
    const regionStateKeys = geographicRegionStateRegions(region).map((stateRegion) => stateRegion.key);
    if (regionStateKeys.length) return unique(regionStateKeys);
  }
  const fallbackKeys = [
    ...(country.startingStates || []),
    ...(country.releaseStates || []),
  ].filter(Boolean);
  return unique(fallbackKeys);
}

function selectedCountryMapColor(country) {
  return country?.colorHex || "#b68d42";
}

function selectedCountryMapSignature() {
  const country = byTag.get(state.selectedTag);
  if (!country) return "";
  return `${country.tag}:${countryMapStateKeys(country).sort().join(",")}`;
}

function countryMapUsesOwnerPixels() {
  if (state.mapMode !== "country" || !mapRuntime.pixelOwnerIndexes) return false;
  const selectedCountry = byTag.get(state.selectedTag);
  return !selectedCountry || countryMapStateKeys(selectedCountry).length === 0;
}

function highestStartingOverlord(country) {
  const visited = new Set();
  let current = country;
  let highest = null;
  while (current?.startingOverlordTag && !visited.has(current.tag)) {
    visited.add(current.tag);
    const overlord = byTag.get(current.startingOverlordTag);
    if (!overlord) break;
    highest = overlord;
    current = overlord;
  }
  return highest;
}

function countryOwnerMapColor(owner, ownerTag) {
  if (shouldDimUnfilteredCountries() && ownerTag && !mapRuntime.filteredCountryTags.has(ownerTag)) return "#d8dedb";
  if (state.whiteDecentralized && owner?.countryType === "decentralized") return "#f7f6f1";
  if (owner?.countryType === "decentralized") return owner?.colorHex ? interpolateColor(owner.colorHex, "#f7f6f1", 0.8) : "#efece4";
  if (owner?.startingSubjectUsesOverlordColor
    && state.subjectOverlordColors
    && !mapRuntime.countrySearchMatchedTags.has(ownerTag)
    && state.globalSearchColorRestoreTag !== ownerTag) {
    const overlord = highestStartingOverlord(owner);
    if (overlord?.colorHex) return overlord.colorHex;
  }
  if (owner?.colorHex) return owner.colorHex;
  if (ownerTag) return "#b8b1a5";
  return "#e9e5dc";
}

function shouldDimUnfilteredCountries() {
  return state.dimUnfilteredCountries || hasCountryMapFilterSelection();
}

function hasCountryMapFilterSelection() {
  return state.view === "country" && (
    Boolean(state.search)
    || state.flags.size > 0
    || state.tiers.size > 0
    || state.types.size > 0
    || state.strategicRegions.size > 0
    || state.heritageGroups.size > 0
    || state.heritages.size > 0
    || state.languageGroups.size > 0
    || state.languages.size > 0
    || Boolean(state.tradition)
  );
}

const RESOURCE_MAP_EMPTY_LAND_COLOR = "#e9edeb";
const SUBSISTENCE_BUILDING_EMPTY_COLOR = "#e9edeb";
const SUBSISTENCE_BUILDING_COLORS = new Map([
  ["building_subsistence_farm", "#c8893f"],
  ["building_subsistence_rice_farm", "#4c9f70"],
  ["building_subsistence_pasture", "#8b6f47"],
  ["building_subsistence_orchard", "#b5688b"],
  ["building_subsistence_fishing_village", "#4b87b6"],
]);
const RESOURCE_MAP_COMBINED_GRADIENT = { low: "#c9d6de", high: "#58788a" };
const RESOURCE_MAP_GRADIENT_BY_KEY = new Map([
  ["building_coal_mine", { low: "#c6ced1", high: "#596166" }],
  ["building_iron_mine", { low: "#cde0eb", high: "#557b91" }],
  ["building_lead_mine", { low: "#d3d7df", high: "#727884" }],
  ["building_sulfur_mine", { low: "#f0e4ac", high: "#c69b26" }],
  ["building_gold_mine", { low: "#f2dfaa", high: "#c9a34f" }],
  ["building_fishing_wharf", { low: "#b8dce1", high: "#3d8293" }],
  ["building_whaling_station", { low: "#c0d1dc", high: "#42667b" }],
  ["building_logging_camp", { low: "#c9dbbd", high: "#5e8750" }],
  ["building_rubber_plantation", { low: "#ced7ab", high: "#657b3a" }],
  ["building_oil_rig", { low: "#c5c7d2", high: "#47495d" }],
  ["building_wheat_farm", { low: "#f0dea8", high: "#c69b32" }],
  ["building_rye_farm", { low: "#e0ca98", high: "#8d713d" }],
  ["building_rice_farm", { low: "#cce7c7", high: "#4f9b72" }],
  ["building_maize_farm", { low: "#f2dfa4", high: "#d59d27" }],
  ["building_millet_farm", { low: "#e7d2a7", high: "#b88735" }],
  ["building_livestock_ranch", { low: "#dacdb9", high: "#87643e" }],
  ["building_vineyard", { low: "#ddc7df", high: "#7e4b86" }],
  ["building_coffee_plantation", { low: "#ddc8b5", high: "#765039" }],
  ["building_tea_plantation", { low: "#c6e2c5", high: "#3d7e4d" }],
  ["building_tobacco_plantation", { low: "#e7caa2", high: "#a66e37" }],
  ["building_opium_plantation", { low: "#e8c5d6", high: "#a85e83" }],
  ["building_banana_plantation", { low: "#efe9ab", high: "#b7a92d" }],
  ["building_sugar_plantation", { low: "#cae1bf", high: "#72a05e" }],
  ["building_silk_plantation", { low: "#e7d8e3", high: "#b27fa9" }],
  ["building_cotton_plantation", { low: "#deecf1", high: "#8baebb" }],
  ["building_dye_plantation", { low: "#c5d0ec", high: "#4c5ea7" }],
]);
const RESOURCE_MAP_COLOR_ALIASES = new Map([
  ["building_gold_field", "building_gold_mine"],
]);

function resolveResourceMapColorKey(resourceKey) {
  return RESOURCE_MAP_COLOR_ALIASES.get(resourceKey) || resourceKey;
}

function resourceMapColor(resourceKey) {
  return resourceMapGradient(resourceKey).high;
}

function resourceMapGradient(resourceKey) {
  return RESOURCE_MAP_GRADIENT_BY_KEY.get(resolveResourceMapColorKey(resourceKey)) || RESOURCE_MAP_COMBINED_GRADIENT;
}

function resourceMapGradientColor(resourceKey, value, maxValue) {
  const ratio = Number(value || 0) / Math.max(Number(maxValue || 0), 1);
  const gradient = resourceMapGradient(resourceKey);
  return interpolateColor(gradient.low, gradient.high, ratio);
}

function buildSubsistenceBuildingMapFeatures() {
  const features = new Map();
  for (const stateRegion of stateRegions) {
    const isSea = isSeaStateRegion(stateRegion);
    const buildingKey = stateRegion.subsistence_building || "";
    const arableLand = Number(stateRegion.arable_land);
    const color = isSea
      ? MAP_SEA_COLOR
      : (SUBSISTENCE_BUILDING_COLORS.get(buildingKey) || SUBSISTENCE_BUILDING_EMPTY_COLOR);
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, color),
      active: Boolean(buildingKey),
      value: Number.isFinite(arableLand) ? arableLand : 0,
      label: !isSea && Number.isFinite(arableLand) ? formatMapLabelValue(arableLand) : "",
      subsistenceBuildingKey: buildingKey,
    });
  }
  return features;
}

function buildSelectedResourceMapFeatures() {
  const selectedFilters = [...state.resourceFilters]
    .map((key) => resourceFilterByKey.get(key))
    .filter(Boolean);
  const selectedResourceKey = selectedFilters.length === 1
    ? (selectedFilters[0].resources || selectedFilters[0].arableResources || [])[0] || selectedFilters[0].key
    : "";
  const colorResourceKey = selectedFilters.length === 1 ? selectedResourceKey : "";
  const values = new Map();
  let maxValue = 0;
  for (const stateRegion of stateRegions) {
    const items = selectedFilters.map((filter) => {
      const resourceKey = (filter.resources || filter.arableResources || [])[0] || filter.key;
      const valueInfo = stateRegionResourceValue(stateRegion, resourceKey);
      return {
        key: resourceKey,
        label: resourceFilterLabel(filter),
        ...valueInfo,
      };
    }).filter((item) => item.value > 0);
    const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
    values.set(stateRegion.key, { total, items });
    maxValue = Math.max(maxValue, total);
  }
  const features = new Map();
  for (const stateRegion of stateRegions) {
    const valueInfo = values.get(stateRegion.key) || { total: 0, items: [] };
    const visible = mapRuntime.visibleStateKeys.has(stateRegion.key);
    const isSea = isSeaStateRegion(stateRegion);
    const color = isSea
      ? MAP_SEA_COLOR
      : valueInfo.total > 0
        ? resourceMapGradientColor(colorResourceKey, valueInfo.total, maxValue)
        : RESOURCE_MAP_EMPTY_LAND_COLOR;
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, color),
      active: valueInfo.total > 0,
      value: valueInfo.total,
      label: valueInfo.total > 0 ? formatMapLabelValue(valueInfo.total) : "",
      title: valueInfo.items.length
        ? valueInfo.items.map((item) => `${item.label} ${item.detail}`).join(t("ui.semicolon", "；"))
        : t("map.noResource", { resource: selectedResourceMapLabel() }),
      resourceItems: valueInfo.items,
    });
  }
  mapRuntime.currentMaxValue = maxValue;
  return features;
}

function buildCultureFilterMapFeatures() {
  const features = new Map();
  let maxValue = 0;
  const matchesByState = new Map();
  for (const stateRegion of stateRegions) {
    const matches = matchingHomelandCulturesForFilters(stateRegion);
    matchesByState.set(stateRegion.key, matches);
    maxValue = Math.max(maxValue, matches.length);
  }
  for (const stateRegion of stateRegions) {
    const matches = matchesByState.get(stateRegion.key) || [];
    const isSea = isSeaStateRegion(stateRegion);
    const color = isSea
      ? MAP_SEA_COLOR
      : matches.length
        ? MAP_CULTURE_MATCH_COLOR
        : "#eee9df";
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, color),
      active: matches.length > 0,
      value: matches.length,
      title: matches.length ? matches.map((culture) => entityText(culture) || culture.key).join("、") : t("map.noMatchingCultureHomelands", "无匹配文化本土"),
      cultures: matches,
    });
  }
  return features;
}

function buildResourceMapFeatures() {
  const subject = state.mapSubject;
  const resourceName = mapSubjectLabel();
  const values = new Map();
  let maxValue = 0;
  for (const stateRegion of stateRegions) {
    const valueInfo = stateRegionResourceValue(stateRegion, subject);
    values.set(stateRegion.key, valueInfo);
    maxValue = Math.max(maxValue, valueInfo.value || 0);
  }
  const features = new Map();
  for (const stateRegion of stateRegions) {
    const valueInfo = values.get(stateRegion.key) || { value: 0, detail: "" };
    const visible = mapRuntime.visibleStateKeys.has(stateRegion.key);
    const isSea = isSeaStateRegion(stateRegion);
    const color = isSea
      ? MAP_SEA_COLOR
      : valueInfo.value > 0
        ? resourceMapGradientColor(subject, valueInfo.value, maxValue)
        : RESOURCE_MAP_EMPTY_LAND_COLOR;
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, color),
      active: valueInfo.value > 0,
      value: valueInfo.value,
      title: valueInfo.value > 0 ? `${resourceName} ${valueInfo.detail}` : `无${resourceName}`,
      legend: resourceName,
    });
  }
  mapRuntime.currentMaxValue = maxValue;
  return features;
}

function buildCultureMapFeatures() {
  const selectedCulture = byCulture.get(state.mapSubject);
  const features = new Map();
  for (const stateRegion of stateRegions) {
    const relation = cultureRelationForStateRegion(stateRegion, selectedCulture);
    const visible = mapRuntime.visibleStateKeys.has(stateRegion.key);
    const color = cultureRelationColor(relation.rank, isSeaStateRegion(stateRegion));
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, color),
      active: relation.rank > 0,
      value: relation.rank,
      title: relation.label,
      relation,
    });
  }
  return features;
}

function buildTraitMapFeatures() {
  const selectedTraitKey = state.mapSubject;
  const allTraits = selectedTraitKey === "__any_trait";
  const maxCount = Math.max(1, ...stateRegions.map((stateRegion) => (stateRegion.traits || []).length));
  const features = new Map();
  for (const stateRegion of stateRegions) {
    const traits = stateRegion.traits || [];
    const matchingTraits = allTraits ? traits : traits.filter((trait) => trait.key === selectedTraitKey);
    const visible = mapRuntime.visibleStateKeys.has(stateRegion.key);
    const isSea = isSeaStateRegion(stateRegion);
    const color = isSea
      ? MAP_SEA_COLOR
      : matchingTraits.length
        ? allTraits
          ? interpolateColor("#d7e8b5", "#5f7f3f", matchingTraits.length / maxCount)
          : matchingTraits.some((trait) => trait.has_mapi)
            ? "#b46a2b"
            : "#5f8f55"
        : "#eee9df";
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, color),
      active: matchingTraits.length > 0,
      value: matchingTraits.length,
      title: matchingTraits.length ? matchingTraits.map((trait) => entityText(trait) || trait.key).join("、") : t("map.noMatchingStateTraits", "无匹配地区特质"),
      traits: matchingTraits,
    });
  }
  return features;
}

function drawMapLayer(features) {
  const canvas = document.createElement("canvas");
  canvas.width = mapRuntime.width;
  canvas.height = mapRuntime.height;
  const context = canvas.getContext("2d");
  const imageData = context.createImageData(mapRuntime.width, mapRuntime.height);
  const data = imageData.data;
  const stateIndexes = mapRuntime.pixelStateIndexes;
  const stateLayer = buildStateLayerColors(features);
  const ownerLayerColors = countryMapUsesOwnerPixels()
    ? buildOwnerLayerColors()
    : null;
  for (let pixel = 0, offset = 0; pixel < stateIndexes.length; pixel += 1, offset += 4) {
    const stateIndex = stateIndexes[pixel] || 0;
    const terrainKey = terrainKeyForPixel(pixel);
    const terrainRgb = state.mapMode === "terrain" && stateIndex
      ? terrainPixelRgb(stateIndex, terrainKey, stateLayer)
      : null;
    const rgb = terrainRgb || (ownerLayerColors && stateIndex
      ? countryPixelRgb(stateIndex, mapRuntime.pixelOwnerIndexes[pixel] || 0, stateLayer, ownerLayerColors)
      : stateLayer.colors[stateIndex] || stateLayer.colors[0]);
    data[offset] = rgb[0];
    data[offset + 1] = rgb[1];
    data[offset + 2] = rgb[2];
    data[offset + 3] = stateIndex && !(state.mapMode === "terrain" && !terrainLandKeys.has(terrainKey))
      ? mapPixelAlpha(stateIndex, stateLayer)
      : 0;
  }
  addStateBorders(data, stateIndexes, mapRuntime.width, mapRuntime.height);
  if (state.mapMode === "company") addCompanyAssociationBorders(data, stateIndexes, features, mapRuntime.width, mapRuntime.height);
  if (state.mapMode === "country" && mapRuntime.pixelOwnerIndexes) {
    addCountryBorders(data, stateIndexes, mapRuntime.pixelOwnerIndexes, mapRuntime.width, mapRuntime.height);
  }
  context.putImageData(imageData, 0, 0);
  mapRuntime.layerCanvas = canvas;
}

function mapPixelAlpha(stateIndex, stateLayer) {
  if (state.mapMode === "terrain") return stateLayer.visible[stateIndex] ? MAP_LAND_ALPHA : MAP_MUTED_ALPHA;
  if (["resource", "resourceSelection"].includes(state.mapMode)) {
    return stateLayer.sea[stateIndex] ? MAP_SEA_ALPHA : MAP_RESOURCE_LAND_ALPHA;
  }
  if (stateLayer.sea[stateIndex]) return MAP_SEA_ALPHA;
  if (!stateLayer.visible[stateIndex]) return MAP_MUTED_ALPHA;
  return MAP_LAND_ALPHA;
}

function buildStateLayerColors(features) {
  const colors = Array.from({ length: mapRuntime.stateKeysByIndex.length }, () => hexToRgb("#ebeae6"));
  const sea = new Uint8Array(mapRuntime.stateKeysByIndex.length);
  const visible = new Uint8Array(mapRuntime.stateKeysByIndex.length);
  for (let index = 1; index < mapRuntime.stateKeysByIndex.length; index += 1) {
    const stateKey = mapRuntime.stateKeysByIndex[index];
    const stateRegion = byStateRegion.get(stateKey);
    const feature = features.get(stateKey);
    const isSea = stateRegion && isSeaStateRegion(stateRegion);
    if (isSea) sea[index] = 1;
    if (stateRegion && mapRuntime.visibleStateKeys.has(stateRegion.key)) visible[index] = 1;
    const color = !stateRegion
      ? "#ebeae6"
      : isSea
        ? MAP_SEA_COLOR
        : feature?.color || "#ebeae6";
    colors[index] = hexToRgb(color);
  }
  return {
    colors,
    sea,
    visible,
    muted: hexToRgb(MAP_MUTED_COLOR),
    seaColor: hexToRgb(MAP_SEA_COLOR),
  };
}

function buildOwnerLayerColors() {
  return mapRuntime.ownerKeysByIndex.map((ownerTag) => {
    const owner = byTag.get(ownerTag);
    return hexToRgb(countryOwnerMapColor(owner, ownerTag));
  });
}

function countryPixelRgb(stateIndex, ownerIndex, stateLayer, ownerLayerColors) {
  if (stateLayer.sea[stateIndex]) return stateLayer.seaColor;
  if (!stateLayer.visible[stateIndex]) return stateLayer.muted;
  return ownerLayerColors[ownerIndex] || ownerLayerColors[0];
}

function terrainKeyForPixel(pixel) {
  const index = mapRuntime.pixelTerrainIndexes?.[pixel] || 0;
  return mapRuntime.terrainKeysByIndex?.[index] || "";
}

function terrainPixelRgb(stateIndex, terrainKey, stateLayer) {
  if (!terrainLandKeys.has(terrainKey)) return null;
  if (!stateLayer.visible[stateIndex]) return stateLayer.muted;
  return terrainLegendByKey.get(terrainKey).rgb;
}

function mapPixelColor(stateRegion, feature, pixel) {
  if (!stateRegion) return "#ebeae6";
  if (isSeaStateRegion(stateRegion)) return MAP_SEA_COLOR;
  if (countryMapUsesOwnerPixels()) {
    if (!mapRuntime.visibleStateKeys.has(stateRegion.key)) return MAP_MUTED_COLOR;
    const ownerIndex = mapRuntime.pixelOwnerIndexes[pixel] || 0;
    const ownerTag = mapRuntime.ownerKeysByIndex[ownerIndex] || "";
    const owner = byTag.get(ownerTag);
    return countryOwnerMapColor(owner, ownerTag);
  }
  if (feature) return feature.color;
  return "#ebeae6";
}

function addStateBorders(data, stateIndexes, width, height) {
  const stateBorderColor = [82, 93, 87];
  const seaBorder = hexToRgb(MAP_SEA_BORDER_COLOR);
  const terrainMode = state.mapMode === "terrain";
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width;
    const hasDown = y < height - 1;
    for (let x = 0; x < width; x += 1) {
      const pixel = rowStart + x;
      const index = stateIndexes[pixel];
      if (!index) continue;
      if (terrainMode && !terrainLandKeys.has(terrainKeyForPixel(pixel))) continue;
      const rightPixel = x === width - 1 ? rowStart : pixel + 1;
      const downPixel = hasDown ? pixel + width : -1;
      const rightIndex = stateIndexes[rightPixel];
      const downIndex = hasDown ? stateIndexes[downPixel] : index;
      if (index === rightIndex && index === downIndex) continue;
      const color = indexTouchesSea(index, rightIndex) || indexTouchesSea(index, downIndex)
        ? seaBorder
        : stateBorderColor;
      paintBorderPixel(data, pixel, color);
      if (index !== rightIndex && rightIndex && (!terrainMode || terrainLandKeys.has(terrainKeyForPixel(rightPixel)))) paintBorderPixel(data, rightPixel, color);
      if (hasDown && index !== downIndex && downIndex && (!terrainMode || terrainLandKeys.has(terrainKeyForPixel(downPixel)))) paintBorderPixel(data, downPixel, color);
    }
  }
}

function addCountryBorders(data, stateIndexes, ownerIndexes, width, height) {
  const countryBorderColor = [33, 43, 39];
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width;
    const hasDown = y < height - 1;
    for (let x = 0; x < width; x += 1) {
      const pixel = rowStart + x;
      const index = stateIndexes[pixel];
      if (!index) continue;
      const rightPixel = x === width - 1 ? rowStart : pixel + 1;
      const downPixel = hasDown ? pixel + width : -1;
      const rightIndex = stateIndexes[rightPixel];
      const downIndex = hasDown ? stateIndexes[downPixel] : index;
      const crossesRight = (ownerIndexes[pixel] || 0) !== (ownerIndexes[rightPixel] || 0);
      const crossesDown = hasDown && (ownerIndexes[pixel] || 0) !== (ownerIndexes[downPixel] || 0);
      const crossesRightLand = crossesRight && rightIndex && !indexTouchesSea(index, rightIndex);
      const crossesDownLand = crossesDown && downIndex && !indexTouchesSea(index, downIndex);
      if (!crossesRightLand && !crossesDownLand) continue;
      paintBorderPixel(data, pixel, countryBorderColor);
      if (crossesRightLand) paintBorderPixel(data, rightPixel, countryBorderColor);
      if (crossesDownLand) paintBorderPixel(data, downPixel, countryBorderColor);
    }
  }
}

function paintBorderPixel(data, pixel, color) {
  const offset = pixel * 4;
  data[offset] = color[0];
  data[offset + 1] = color[1];
  data[offset + 2] = color[2];
  data[offset + 3] = 255;
}

function indexTouchesSea(index, neighborIndex) {
  if (!neighborIndex || index === neighborIndex) return false;
  return isSeaStateRegion(byStateRegion.get(mapRuntime.stateKeysByIndex[index]))
    || isSeaStateRegion(byStateRegion.get(mapRuntime.stateKeysByIndex[neighborIndex]));
}

function paintMapCanvas() {
  if (!els.mapCanvas || !els.mapViewport) return;
  paintMapCanvasTarget(els.mapCanvas, els.mapViewport, mapRuntime.transform, true);
}

function addCompanyAssociationBorders(data, stateIndexes, features, width, height) {
  const borderColor = hexToRgb(COMPANY_LOCATION_BORDER_COLOR);
  const selectedIndexes = new Uint8Array(mapRuntime.stateKeysByIndex.length);
  for (let index = 1; index < mapRuntime.stateKeysByIndex.length; index += 1) {
    if (features.get(mapRuntime.stateKeysByIndex[index])?.companyAssociation?.count > 0) selectedIndexes[index] = 1;
  }
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width;
    const hasDown = y < height - 1;
    for (let x = 0; x < width; x += 1) {
      const pixel = rowStart + x;
      const index = stateIndexes[pixel];
      if (!index || !selectedIndexes[index]) continue;
      const rightPixel = x === width - 1 ? rowStart : pixel + 1;
      const downPixel = hasDown ? pixel + width : -1;
      const rightIndex = stateIndexes[rightPixel];
      const downIndex = hasDown ? stateIndexes[downPixel] : index;
      if (!selectedIndexes[rightIndex]) {
        paintBorderPixel(data, pixel, borderColor);
        if (rightIndex) paintBorderPixel(data, rightPixel, borderColor);
      }
      if (hasDown && !selectedIndexes[downIndex]) {
        paintBorderPixel(data, pixel, borderColor);
        if (downIndex) paintBorderPixel(data, downPixel, borderColor);
      }
    }
  }
}

function paintMapCanvasTarget(canvas, viewport, transform, drawLabels = false) {
  if (!mapRuntime.layerCanvas || !canvas || !viewport || !transform) return;
  const rect = viewport.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1) * 1.4);
  const width = Math.max(1, Math.floor(rect.width * ratio));
  const height = Math.max(1, Math.floor(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#d7c2a4";
  context.fillRect(0, 0, width, height);
  context.setTransform(
    transform.scale * ratio,
    0,
    0,
    transform.scale * ratio,
    transform.x * ratio,
    transform.y * ratio,
  );
  context.imageSmoothingEnabled = false;
  const copyRange = visibleMapCopyRange(rect.width, transform);
  for (let copy = copyRange.start; copy <= copyRange.end; copy += 1) {
    if (mapRuntime.paperMapImage) {
      context.drawImage(mapRuntime.paperMapImage, copy * mapRuntime.width, 0, mapRuntime.width, mapRuntime.height);
    }
    context.drawImage(mapRuntime.layerCanvas, copy * mapRuntime.width, 0);
  }
  if (drawLabels) drawMapLabels(context, copyRange, transform);
  drawStateTraitMapIcons(context, copyRange, transform);
}

function resetMapTransform() {
  if (!els.mapViewport) return;
  const rect = els.mapViewport.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const scale = Math.min(rect.width / mapRuntime.width, rect.height / mapRuntime.height);
  mapRuntime.transform.scale = scale;
  mapRuntime.transform.x = (rect.width - mapRuntime.width * scale) / 2;
  mapRuntime.transform.y = (rect.height - mapRuntime.height * scale) / 2;
  normalizeMapTransformX();
}

function fitMapToWidth() {
  if (!els.mapViewport || !mapRuntime.ready) return;
  const rect = els.mapViewport.getBoundingClientRect();
  if (!rect.width || !rect.height || !mapRuntime.width || !mapRuntime.height) return;
  const scale = rect.width / mapRuntime.width;
  mapRuntime.transform.scale = scale;
  mapRuntime.transform.x = 0;
  mapRuntime.transform.y = (rect.height - mapRuntime.height * scale) / 2;
  normalizeMapTransformX();
  hideMapTooltip();
  paintMapCanvas();
}

function focusCompanyOnMap(company) {
  if (state.view !== "company" || !company || !mapRuntime.ready || !els.mapViewport || !mapRuntime.stateCenters) return;
  focusStateRegionsOnMap(companyStateRegionKeys(company), { maxWorldScale: 2.2, padding: 260 });
}

function focusCountryOnMap(country) {
  if (state.view !== "country" || !country || !mapRuntime.ready || !els.mapViewport || !mapRuntime.stateCenters) return;
  focusStateRegionsOnMap(countryMapStateKeys(country), { maxWorldScale: 2.1, padding: 280 });
}

function focusCultureOnMap(culture) {
  if (state.view !== "culture" || !culture || !mapRuntime.ready || !els.mapViewport || !mapRuntime.stateCenters) return;
  focusStateRegionsOnMap((culture.homeland_state_regions || []).map((stateRegion) => stateRegion.key), { maxWorldScale: 2.1, padding: 280 });
}

function focusStateRegionOnMap(stateRegion) {
  if (state.view !== "region" || !stateRegion || isSeaStateRegion(stateRegion) || !mapRuntime.ready || !els.mapViewport || !mapRuntime.stateCenters) return;
  focusStateRegionsOnMap([stateRegion.key], { maxWorldScale: 2.1, padding: 320 });
}

function focusCurrentMapSelection() {
  if (state.view === "country") {
    focusCountryOnMap(byTag.get(state.selectedTag));
    return;
  }
  if (state.view === "region") {
    focusStateRegionOnMap(byStateRegion.get(state.selectedStateRegion));
    return;
  }
  if (state.view === "culture") {
    focusCultureOnMap(byCulture.get(state.selectedCulture));
    return;
  }
  if (state.view === "company") {
    focusCompanyOnMap(byCompany.get(state.selectedCompany));
  }
}

function renderCompanyDetailLocationMap(company = byCompany.get(state.selectedCompany)) {
  if (state.view !== "company" || !isDetailPageRoute() || !companyDetailLocationMapEnabled(company)) return;
  const canvas = els.detail?.querySelector("[data-company-location-map]");
  const viewport = canvas?.closest(".company-location-map");
  const stateKeys = companyLocationStateRegionKeys(company);
  if (!canvas || !viewport || !stateKeys.length) return;
  if (!mapRuntime.ready) {
    ensureMapLoaded();
    return;
  }
  ensureMapLayer();
  const transform = mapTransformForStateRegions(stateKeys, viewport, { maxWorldScale: 4, padding: 180, clampVerticalEdges: true });
  if (transform) paintMapCanvasTarget(canvas, viewport, transform, false);
}

function focusStateRegionsOnMap(stateKeys, options = {}) {
  const transform = mapTransformForStateRegions(stateKeys, els.mapViewport, options);
  if (!transform) return;
  Object.assign(mapRuntime.transform, transform);
  hideMapTooltip();
  paintMapCanvas();
}

function companyStateRegionKeys(company) {
  return companyLocationStateRegionKeys(company);
}

function mapTransformForStateRegions(stateKeys, viewport, options = {}) {
  if (!mapRuntime.ready || !mapRuntime.stateCenters) return null;
  const centers = (stateKeys || []).map((key) => mapRuntime.stateCenters.get(key)).filter(Boolean);
  const rect = viewport?.getBoundingClientRect();
  if (!centers.length || !rect?.width || !rect?.height) return null;
  const padding = options.padding ?? 70;
  const minX = Math.min(...centers.map((point) => point.x));
  const maxX = Math.max(...centers.map((point) => point.x));
  const minY = Math.min(...centers.map((point) => point.y));
  const maxY = Math.max(...centers.map((point) => point.y));
  const targetScale = Math.min(
    rect.width / Math.max(80, maxX - minX + padding * 2),
    rect.height / Math.max(80, maxY - minY + padding * 2),
  );
  const worldFitScale = Math.min(rect.width / mapRuntime.width, rect.height / mapRuntime.height);
  const maxScale = options.maxWorldScale
    ? worldFitScale * options.maxWorldScale
    : options.maxScale ?? 2.8;
  const transform = {
    scale: clampNumber(targetScale, options.minScale ?? worldFitScale, maxScale),
    x: 0,
    y: 0,
  };
  transform.x = rect.width / 2 - ((minX + maxX) / 2) * transform.scale;
  transform.y = rect.height / 2 - ((minY + maxY) / 2) * transform.scale;
  normalizeMapTransformX(transform);
  if (options.clampVerticalEdges) clampMapTransformY(transform, rect.height);
  return transform;
}

function clampMapTransformY(transform, viewportHeight) {
  const scaledMapHeight = mapRuntime.height * Math.max(transform.scale, 0.001);
  if (!Number.isFinite(scaledMapHeight) || !Number.isFinite(viewportHeight) || scaledMapHeight <= viewportHeight) return;
  transform.y = clampNumber(transform.y, viewportHeight - scaledMapHeight, 0);
}

function visibleMapCopyRange(viewportWidth, transform = mapRuntime.transform) {
  const scale = Math.max(transform.scale, 0.001);
  const left = -transform.x / scale;
  const right = (viewportWidth - transform.x) / scale;
  return {
    start: Math.floor(left / mapRuntime.width) - 1,
    end: Math.ceil(right / mapRuntime.width) + 1,
  };
}

function normalizeMapTransformX(transform = mapRuntime.transform) {
  const scaledMapWidth = mapRuntime.width * Math.max(transform.scale, 0.001);
  if (!Number.isFinite(scaledMapWidth) || scaledMapWidth <= 0) return;
  let x = transform.x % scaledMapWidth;
  if (x > 0) x -= scaledMapWidth;
  transform.x = x;
}

function drawMapLabels(context, copyRange = { start: 0, end: 0 }, transform = mapRuntime.transform) {
  if (!["resourceSelection", "company"].includes(state.mapMode) || !mapRuntime.stateCenters || !mapRuntime.featureByStateKey) return;
  const inverseScale = 1 / Math.max(transform.scale, 0.001);
  const baseFontSize = state.mapMode === "resourceSelection" ? 14 : 16;
  context.save();
  context.font = `700 ${Math.round(baseFontSize * inverseScale)}px ${MAP_LABEL_FONT_FAMILY}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.lineWidth = (state.mapMode === "resourceSelection" ? 3.2 : 4.5) * inverseScale;
  const drawQueue = [];
  for (const [stateKey, feature] of mapRuntime.featureByStateKey) {
    if (!feature?.label) continue;
    const center = mapRuntime.stateCenters.get(stateKey);
    if (!center || center.count < 6) continue;
    const text = String(feature.label);
    const priority = Number(feature.value || 0) * 1000000 + center.count;
    for (let copy = copyRange.start; copy <= copyRange.end; copy += 1) {
      drawQueue.push({
        text,
        x: center.x + copy * mapRuntime.width,
        y: center.y + 0.5 * inverseScale,
        priority,
      });
    }
  }
  drawQueue.sort((a, b) => a.priority - b.priority);
  for (const item of drawQueue) {
    context.strokeStyle = "rgba(255, 254, 249, 0.96)";
    context.strokeText(item.text, item.x, item.y);
    context.fillStyle = "#18231f";
    context.fillText(item.text, item.x, item.y);
  }
  context.restore();
}

function drawStateTraitMapIcons(context, copyRange = { start: 0, end: 0 }, transform = mapRuntime.transform) {
  if (state.mapMode !== "traitIcons" || !mapRuntime.featureByStateKey) return;
  const iconSize = 32;
  const inverseScale = 1 / Math.max(transform.scale, 0.001);
  const mapIconSize = iconSize * inverseScale;
  const specificFiltersActive = state.stateTraitFilters.size > 0 && !state.stateTraitFilters.has("all");
  context.save();
  for (const [stateKey, feature] of mapRuntime.featureByStateKey) {
    const center = mapRuntime.stateCenters.get(stateKey);
    if (!center || !feature?.traits?.length) continue;
    for (const [index, trait] of feature.traits.entries()) {
      const image = mapRuntime.stateTraitIconImages.get(stateTraitIconFileName(trait));
      if (!image) continue;
      const offsetX = (index - (feature.traits.length - 1) / 2) * mapIconSize;
      const visible = mapRuntime.visibleStateKeys.has(stateKey);
      const matching = feature.matchingTraits?.includes(trait);
      context.globalAlpha = visible ? (specificFiltersActive && !matching ? 0.18 : 1) : 0.36;
      for (let copy = copyRange.start; copy <= copyRange.end; copy += 1) {
        context.drawImage(
          image,
          center.x + copy * mapRuntime.width + offsetX - mapIconSize / 2,
          center.y - mapIconSize / 2,
          mapIconSize,
          mapIconSize,
        );
      }
    }
  }
  context.restore();
}

function bindMapEvents() {
  if (!els.mapCanvas || !els.mapViewport) return;
  els.mapCanvas.addEventListener("wheel", (event) => {
    if (!mapRuntime.ready) return;
    event.preventDefault();
    const rect = els.mapCanvas.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const before = screenToMapPoint(pointerX, pointerY);
    const factor = event.deltaY < 0 ? 1.18 : 0.85;
    mapRuntime.transform.scale = clampNumber(mapRuntime.transform.scale * factor, 0.12, 8);
    mapRuntime.transform.x = pointerX - before.x * mapRuntime.transform.scale;
    mapRuntime.transform.y = pointerY - before.y * mapRuntime.transform.scale;
    normalizeMapTransformX();
    paintMapCanvas();
    updateMapTooltip(event);
  }, { passive: false });
  els.mapCanvas.addEventListener("pointerdown", (event) => {
    mapRuntime.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: mapRuntime.transform.x,
      y: mapRuntime.transform.y,
      moved: false,
    };
    els.mapCanvas.setPointerCapture(event.pointerId);
  });
  els.mapCanvas.addEventListener("pointermove", (event) => {
    if (mapRuntime.drag) {
      const dx = event.clientX - mapRuntime.drag.startX;
      const dy = event.clientY - mapRuntime.drag.startY;
      if (Math.abs(dx) + Math.abs(dy) > 2) mapRuntime.drag.moved = true;
      mapRuntime.transform.x = mapRuntime.drag.x + dx;
      mapRuntime.transform.y = mapRuntime.drag.y + dy;
      normalizeMapTransformX();
      paintMapCanvas();
      hideMapTooltip();
      return;
    }
    updateMapTooltip(event);
  });
  els.mapCanvas.addEventListener("pointerup", (event) => {
    const drag = mapRuntime.drag;
    mapRuntime.drag = null;
    if (drag?.pointerId) els.mapCanvas.releasePointerCapture(drag.pointerId);
    if (drag && !drag.moved) {
      if (state.view === "country") {
        const countryTag = countryOwnerTagFromPointerEvent(event);
        if (countryTag) selectCountryFromMap(countryTag);
        return;
      }
      if (state.mapMode === "terrain" && !terrainLandKeys.has(terrainKeyFromPointerEvent(event))) return;
      const stateRegion = stateRegionFromPointerEvent(event);
      if (stateRegion) {
        selectStateRegionFromMap(stateRegion.key);
      }
    }
  });
  els.mapCanvas.addEventListener("dblclick", (event) => {
    if (state.view !== "region") return;
    if (state.mapMode === "terrain" && !terrainLandKeys.has(terrainKeyFromPointerEvent(event))) return;
    const stateRegion = stateRegionFromPointerEvent(event);
    if (stateRegion) openStateRegionDetail(stateRegion.key);
  });
  els.mapCanvas.addEventListener("pointerleave", () => {
    mapRuntime.drag = null;
    hideMapTooltip();
  });
  window.addEventListener("resize", () => {
    if (state.view === "region" && mapRuntime.ready) {
      resetMapTransform();
      paintMapCanvas();
    }
    renderCompanyDetailLocationMap();
  });
}

function updateMapTooltip(event) {
  const stateRegion = stateRegionFromPointerEvent(event);
  if (!stateRegion || (state.mapMode === "terrain" && !terrainLandKeys.has(terrainKeyFromPointerEvent(event)))) {
    hideMapTooltip();
    return;
  }
  const feature = mapRuntime.featureByStateKey?.get(stateRegion.key);
  const ownerTag = countryOwnerTagFromPointerEvent(event);
  const terrainKey = terrainKeyFromPointerEvent(event);
  const provinceCode = terrainProvinceCodeFromPointerEvent(event);
  els.mapTooltip.hidden = false;
  els.mapTooltip.innerHTML = mapTooltipHtml(stateRegion, feature, ownerTag, terrainKey, provinceCode);
  const viewportRect = els.mapViewport.getBoundingClientRect();
  const x = event.clientX - viewportRect.left + 12;
  const y = event.clientY - viewportRect.top + 12;
  const tooltipWidth = els.mapTooltip.offsetWidth || 440;
  const tooltipHeight = els.mapTooltip.offsetHeight || 280;
  els.mapTooltip.style.left = `${Math.max(8, Math.min(x, viewportRect.width - tooltipWidth - 8))}px`;
  els.mapTooltip.style.top = `${Math.max(8, Math.min(y, viewportRect.height - tooltipHeight - 8))}px`;
}

function hideMapTooltip() {
  if (els.mapTooltip) els.mapTooltip.hidden = true;
}

function stateRegionFromPointerEvent(event) {
  const pixel = mapPixelIndexFromPointerEvent(event);
  if (pixel < 0) return null;
  const index = mapRuntime.pixelStateIndexes?.[pixel] || 0;
  const stateKey = mapRuntime.stateKeysByIndex?.[index] || "";
  return byStateRegion.get(stateKey) || null;
}

function countryOwnerTagFromPointerEvent(event) {
  if (!mapRuntime.pixelOwnerIndexes) return "";
  const pixel = mapPixelIndexFromPointerEvent(event);
  if (pixel < 0) return "";
  const index = mapRuntime.pixelOwnerIndexes[pixel] || 0;
  return mapRuntime.ownerKeysByIndex?.[index] || "";
}

function terrainKeyFromPointerEvent(event) {
  const pixel = mapPixelIndexFromPointerEvent(event);
  return pixel < 0 ? "" : terrainKeyForPixel(pixel);
}

function terrainProvinceCodeFromPointerEvent(event) {
  return provinceColorFromPointerEvent(event);
}

function provinceColorFromPointerEvent(event) {
  const pixel = mapPixelIndexFromPointerEvent(event);
  if (pixel < 0 || !mapRuntime.provinceMapImage) return "";
  if (!mapRuntime.provinceSampleContext) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    mapRuntime.provinceSampleContext = canvas.getContext("2d", { willReadFrequently: true });
  }
  const context = mapRuntime.provinceSampleContext;
  const x = pixel % mapRuntime.width;
  const y = Math.floor(pixel / mapRuntime.width);
  context.drawImage(mapRuntime.provinceMapImage, x, y, 1, 1, 0, 0, 1, 1);
  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
  const hex = [red, green, blue]
    .map((value) => value.toString(16).padStart(2, "0").toUpperCase())
    .join("");
  return `x${hex}`;
}

function mapPixelIndexFromPointerEvent(event) {
  const rect = els.mapCanvas.getBoundingClientRect();
  const point = screenToMapPoint(event.clientX - rect.left, event.clientY - rect.top);
  const x = wrapMapX(Math.floor(point.x));
  const y = Math.floor(point.y);
  if (y < 0 || y >= mapRuntime.height) return -1;
  return y * mapRuntime.width + x;
}

function screenToMapPoint(x, y) {
  return {
    x: (x - mapRuntime.transform.x) / mapRuntime.transform.scale,
    y: (y - mapRuntime.transform.y) / mapRuntime.transform.scale,
  };
}

function wrapMapX(x) {
  const width = mapRuntime.width || 1;
  return ((x % width) + width) % width;
}

function mapTooltipHtml(stateRegion, feature, ownerTag = "", terrainKey = "", provinceCode = "") {
  const isSea = isSeaStateRegion(stateRegion);
  const kind = isSea ? t("board.region.sea", "海域") : t("board.region.stateRegion", "地域");
  const variants = stateRegionVariantNames(stateRegion);
  const variantText = variants.length ? `（${escapeHtml(variants.join("/"))}）` : "";
  if (isSea) {
    return `
      <div class="map-tooltip-title">${escapeHtml(entityText(stateRegion) || stateRegion.key)}</div>
      <div class="map-tooltip-sub">${escapeHtml(kind)} · ${escapeHtml(stateRegion.key)}</div>
    `;
  }
  const rows = mapTooltipRowsForView(stateRegion, feature, ownerTag, terrainKey, provinceCode);
  return `
    <div class="map-tooltip-title">${escapeHtml(entityText(stateRegion) || stateRegion.key)}${variantText}</div>
    <div class="map-tooltip-sub">${escapeHtml(kind)} · ${escapeHtml(stateRegion.key)}</div>
    <dl>
      ${rows.map(([label, value]) => tooltipField(label, value)).join("")}
    </dl>
  `;
}

function mapTooltipRowsForView(stateRegion, feature, ownerTag = "", terrainKey = "", provinceCode = "") {
  if (state.mapMode === "terrain") {
    if (!terrainLandKeys.has(terrainKey)) return [];
    return compactTooltipRows([
      [t("map.provinceCode", "省份代码"), provinceCode],
      [t("map.terrain", "地形"), terrainLabel(terrainKey)],
      [t("map.stateRegion", "所属地域"), entityText(stateRegion) || stateRegion.key],
      [t("board.region.strategicRegion", "战略区域"), refNames(stateRegion.strategic_regions)],
    ]);
  }
  if (state.mapMode === "traitIcons") {
    return compactTooltipRows([
      [t("board.region.strategicRegion", "战略区域"), refNames(stateRegion.strategic_regions)],
      [t("board.region.traits", "地区特质"), tooltipHtml(mapTooltipStateTraitHtml(feature?.traits || stateRegion.traits || []))],
    ]);
  }
  if (state.view === "country" || state.mapMode === "country") {
    return compactTooltipRows([
      [t("board.region.startingOwners", "开局归属"), refNames(stateRegion.starting_owners)],
      [t("map.currentProvinceOwner", "当前省份归属"), ownerTag ? countryNameWithTag(ownerTag) : ""],
      [t("board.region.strategicRegion", "战略区域"), refNames(stateRegion.strategic_regions)],
      [t("board.region.homelandCultures", "本土文化"), refNames(stateRegion.homeland_cultures)],
    ]);
  }
  if (state.view === "culture" || state.mapMode === "culture") {
    const selectedCulture = byCulture.get(state.selectedCulture);
    return compactTooltipRows([
      [t("board.region.startingOwners", "开局归属"), refNames(stateRegion.starting_owners)],
      [t("map.currentProvinceOwner", "当前省份归属"), ownerTag ? countryNameWithTag(ownerTag) : ""],
      [t("board.region.homelandCultures", "本土文化"), refNames(stateRegion.homeland_cultures)],
      [t("map.cultureRelation", "文化关系"), selectedCulture ? cultureRelationForStateRegion(stateRegion, selectedCulture).label : feature?.title || ""],
    ]);
  }
  if (state.view === "company" || state.mapMode === "company") {
    return compactTooltipRows([
      [t("board.region.startingOwners", "开局归属"), countryRefNames(stateRegion.starting_owners)],
      [t("board.region.strategicRegion", "战略区域"), refNames(stateRegion.strategic_regions)],
      ...mapTooltipResourceRows(stateRegion),
      [t("board.region.traits", "地区特质"), tooltipHtml(mapTooltipStateTraitHtml(stateRegion.traits || []))],
    ]);
  }
  return compactTooltipRows([
    [t("board.region.strategicRegion", "战略区域"), refNames(stateRegion.strategic_regions)],
    ...mapTooltipResourceRows(stateRegion),
    [t("board.region.arableLand", "耕地"), stateRegion.arable_land === null ? "" : String(stateRegion.arable_land)],
    [t("board.region.traits", "地区特质"), tooltipHtml(mapTooltipStateTraitHtml(stateRegion.traits || []))],
  ]);
}

function terrainLabel(key) {
  const entry = terrainLegendByKey.get(key);
  return entry ? t(entry.labelKey) : key;
}

function compactTooltipRows(rows) {
  return rows.filter(([, value]) => tooltipValuePresent(value));
}

function tooltipValuePresent(value) {
  if (value && typeof value === "object" && "html" in value) return Boolean(String(value.html || "").trim());
  return Boolean(String(value || "").trim());
}

function resourceSummaryText(stateRegion) {
  const resources = [
    ...(stateRegion?.capped_resources || []).map((item) => compactResourceLabel(item, item.amount)),
    ...(stateRegion?.discoverable_resources || []).map((item) => {
      const amount = discoverableResourceAmount(item);
      return compactResourceLabel(item, amount);
    }),
    ...(stateRegion?.arable_resources || []).map((item) => compactResourceLabel(item, "")),
  ].filter(Boolean);
  return summarizeTextItems(resources, 5);
}

function mapTooltipStateTraitHtml(traits) {
  return (traits || []).map((trait) => {
    const fileName = stateTraitIconFileName(trait);
    const label = entityText(trait) || trait.key;
    const effect = (trait?.modifiers || []).map(modifierSummaryLabel).filter(Boolean).join(t("ui.listSeparator"));
    return `<span class="map-tooltip-trait"><img class="map-tooltip-trait-icon" src="assets/state-traits/${encodeURIComponent(fileName)}" alt=""><span>${escapeHtml(label)}${effect ? `${escapeHtml(t("ui.colon"))}${escapeHtml(effect)}` : ""}</span></span>`;
  }).join("");
}

function compactResourceLabel(item, amount = "") {
  const label = entityText(item) || item?.key || "";
  if (!label) return "";
  return amount !== "" && amount !== null ? `${label} ${amount}` : label;
}

const miningResourceBuildingKeys = new Set([
  "building_coal_mine",
  "building_iron_mine",
  "building_lead_mine",
  "building_sulfur_mine",
  "building_gold_mine",
  "building_gold_fields",
  "building_gold_field",
]);

function mapTooltipResourceRows(stateRegion) {
  const groups = mapTooltipResourceGroups(stateRegion);
  return compactTooltipRows([
    [t("map.mining", "采矿"), tooltipHtml(mapTooltipResourceGroupHtml(groups.mining))],
    [t("map.otherResources", "其他资源"), tooltipHtml(mapTooltipResourceGroupHtml(groups.other))],
    [t("map.agriculture", "农业"), tooltipHtml(mapTooltipResourceGroupHtml(groups.agriculture))],
  ]);
}

function mapTooltipResourceGroups(stateRegion) {
  const capped = (stateRegion?.capped_resources || []).map((item) => ({ item, amount: item.amount, className: "resource-chip" }));
  const discoverable = (stateRegion?.discoverable_resources || []).map((item) => {
    const amount = discoverableResourceAmount(item);
    return { item, amount, className: "resource-chip discoverable-chip" };
  });
  const resources = [...capped, ...discoverable].filter((entry) => entry.item?.key);
  return {
    mining: resources.filter((entry) => miningResourceBuildingKeys.has(entry.item.key)),
    other: resources.filter((entry) => !miningResourceBuildingKeys.has(entry.item.key)),
    agriculture: (stateRegion?.arable_resources || []).map((item) => ({ item, amount: "", className: "resource-chip arable-chip" })),
  };
}

function mapTooltipResourceGroupHtml(entries) {
  const chips = (entries || []).map((entry) => buildingChip(entry.item, entry.amount, entry.className)).filter(Boolean);
  return chips.length ? `<span class="map-tooltip-resource-row">${chips.join("")}</span>` : "";
}

function tooltipHtml(html) {
  return { html };
}

function summarizeTextItems(items, limit) {
  const values = [...new Set((items || []).filter(Boolean))];
  if (!values.length) return "";
  const visible = values.slice(0, limit);
  const more = values.length > limit ? `等 ${values.length} 项` : "";
  return [...visible, more].filter(Boolean).join("、");
}

function tooltipField(label, value) {
  const htmlValue = value && typeof value === "object" && "html" in value;
  return `<dt>${escapeHtml(label)}</dt><dd>${htmlValue ? value.html : escapeHtml(value || "无")}</dd>`;
}
