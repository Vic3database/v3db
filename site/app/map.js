function renderMapControls() {
  if (!els.mapModeSelect || !els.mapSubjectSelect) return;
  if (state.view === "ideology" || state.view === "law") {
    return;
  }
  syncMapModeForView();
  els.mapModeSelect.value = state.mapMode;
  const options = mapSubjectOptions(state.mapMode);
  if (!options.some((option) => option.value === state.mapSubject)) {
    state.mapSubject = defaultMapSubject(state.mapMode, options);
  }
  els.mapSubjectSelect.innerHTML = options.map((option) => (
    `<option value="${escapeHtml(option.value)}"${state.mapSubject === option.value ? " selected" : ""}>${escapeHtml(option.label)}</option>`
  )).join("");
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
    if (hasCultureTraitFilters()) {
      state.mapMode = "cultureFilter";
      state.mapSubject = "";
    } else {
      state.mapMode = "culture";
      if (state.selectedCulture) state.mapSubject = state.selectedCulture;
    }
    return;
  }
  if (state.view === "region" && state.resourceFilters.size > 0) {
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
  if (mode === "country" || mode === "company" || mode === "cultureFilter" || mode === "resourceSelection" || mode === "strategicRegion") {
    return [{ value: state.mapSubject || "", label: automaticMapSubjectLabel(mode) }];
  }
  if (mode === "culture") {
    return cultures
      .slice()
      .sort(sortCultures)
      .map((culture) => ({ value: culture.key, label: culture.name_zh || culture.key }));
  }
  if (mode === "trait") {
    const traits = collectStateTraitRefs();
    return [
      { value: "__any_trait", label: "全部地区特质" },
      ...traits.map((trait) => ({ value: trait.key, label: trait.name_zh || trait.key })),
    ];
  }
  return collectMapResourceRefs().map((resource) => ({ value: resource.key, label: resource.name_zh || resource.key }));
}

function defaultMapSubject(mode, options) {
  if (mode === "resource" && options.some((option) => option.value === "building_oil_rig")) return "building_oil_rig";
  if (mode === "culture" && state.selectedCulture && options.some((option) => option.value === state.selectedCulture)) return state.selectedCulture;
  if (mode === "culture" && options.some((option) => option.value === "french")) return "french";
  return options[0]?.value || "";
}

function collectMapResourceRefs() {
  const ordered = resourceFilterGroups.flatMap((group) => group.filters || []).map((filter) => ({
    key: filter.key,
    name_zh: filter.label,
  }));
  const byKey = new Map(ordered.map((item) => [item.key, item]));
  for (const stateRegion of stateRegions) {
    for (const item of [
      ...(stateRegion.capped_resources || []),
      ...(stateRegion.discoverable_resources || []),
      ...(stateRegion.arable_resources || []),
    ]) {
      if (item?.key && !byKey.has(item.key)) byKey.set(item.key, { key: item.key, name_zh: item.name_zh || item.key });
    }
  }
  return [...byKey.values()];
}

function collectStateTraitRefs() {
  const byKey = new Map();
  for (const stateRegion of stateRegions) {
    for (const trait of stateRegion.traits || []) {
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
    mapRuntime.width = mapData.width || mapRuntime.width;
    mapRuntime.height = mapData.height || mapRuntime.height;
    mapRuntime.stateKeysByIndex = mapData.stateKeys || [""];
    mapRuntime.ownerKeysByIndex = mapData.ownerKeys || [""];
    mapRuntime.pixelStateIndexes = decodeMapRuns(mapData.runs, mapRuntime.width * mapRuntime.height);
    mapRuntime.pixelOwnerIndexes = mapData.ownerRuns
      ? decodeMapRuns(mapData.ownerRuns, mapRuntime.width * mapRuntime.height)
      : null;
    mapRuntime.stateCenters = computeMapStateCenters(mapRuntime.pixelStateIndexes, mapRuntime.width, mapRuntime.height, mapRuntime.stateKeysByIndex);
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
  const sums = Array.from({ length: stateKeysByIndex.length }, () => ({ x: 0, y: 0, count: 0 }));
  for (let pixel = 0; pixel < indexes.length; pixel += 1) {
    const index = indexes[pixel];
    if (!index) continue;
    const item = sums[index];
    item.x += pixel % width;
    item.y += Math.floor(pixel / width);
    item.count += 1;
  }
  const centers = new Map();
  for (let index = 1; index < sums.length; index += 1) {
    const item = sums[index];
    const key = stateKeysByIndex[index];
    if (!key || !item.count) continue;
    centers.set(key, {
      x: item.x / item.count,
      y: item.y / item.count,
      count: item.count,
    });
  }
  return centers;
}

function buildMapFeatures() {
  if (state.mapMode === "country") return buildCountryMapFeatures();
  if (state.mapMode === "strategicRegion") return buildStrategicRegionMapFeatures();
  if (state.mapMode === "company") return buildCompanyMapFeatures();
  if (state.mapMode === "resourceSelection") return buildSelectedResourceMapFeatures();
  if (state.mapMode === "cultureFilter") return buildCultureFilterMapFeatures();
  if (state.mapMode === "culture") return buildCultureMapFeatures();
  if (state.mapMode === "trait") return buildTraitMapFeatures();
  return buildResourceMapFeatures();
}

function mapFeatureColor(stateRegion, color) {
  if (isSeaStateRegion(stateRegion)) return MAP_SEA_COLOR;
  return mapRuntime.visibleStateKeys.has(stateRegion.key) ? color : MAP_MUTED_COLOR;
}

const COMPANY_LOCATION_MAP_COLOR = "#00cc66";

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
    const title = isSea ? "海域" : companyAssociationTitle(association, region);
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
        name_zh: company.name_zh || company.key,
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
    return `${culture?.name_zh || cultureKey}文化本土，共 ${stateKeys.length} 个州地区`;
  }
  return `总部及成立条件，共 ${stateKeys.length} 个州地区`;
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
    return `${region?.name_zh || "无战略区域"}：无公司关联`;
  }
  const companyNames = association.companies
    .slice(0, 5)
    .map((company) => company.name_zh)
    .join("、");
  const more = association.companies.length > 5 ? `等 ${association.companies.length} 个` : "";
  return [
    `${region?.name_zh || "无战略区域"}：关联公司 ${association.count} 个`,
    `总部 ${association.headquarters} 个`,
    `条件 ${association.special} 个`,
    [companyNames, more].filter(Boolean).join(""),
  ].filter(Boolean).join("；");
}

function companyMapStateRegions(selectedCompanies) {
  const stateKeys = unique((selectedCompanies || []).flatMap((company) => companyLocationStateRegionKeys(company)));
  if (!stateKeys.length) return stateRegions;
  return stateKeys.map((stateKey) => byStateRegion.get(stateKey)).filter(Boolean);
}

function regionMapStateRegions(filteredStateRegions, filteredSeaStateRegions, filteredGeographicRegions) {
  if (state.selectedGeographicRegion) {
    const selectedRegion = byGeographicRegion.get(state.selectedGeographicRegion) || filteredGeographicRegions[0];
    const states = selectedRegion ? geographicRegionStateRegions(selectedRegion) : [];
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
      : inGeographicRegion
        ? "#4f8a61"
        : region?.map_color?.hex || "#d7d8cf";
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, color),
      active: selectedGeographicStateKeys ? Boolean(inGeographicRegion) : Boolean(region),
      value: selectedGeographicStateKeys ? Number(Boolean(inGeographicRegion)) : region ? 1 : 0,
      title: selectedGeographicStateKeys
        ? inGeographicRegion
          ? byGeographicRegion.get(state.selectedGeographicRegion)?.name_zh || "地理区域"
          : "不在当前地理区域"
        : region ? strategicRegionName(region) : "无战略区域",
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

function buildSelectedResourceMapFeatures() {
  const selectedFilters = [...state.resourceFilters]
    .map((key) => resourceFilterByKey.get(key))
    .filter(Boolean);
  const values = new Map();
  let maxValue = 0;
  for (const stateRegion of stateRegions) {
    const items = selectedFilters.map((filter) => {
      const resourceKey = (filter.resources || filter.arableResources || [])[0] || filter.key;
      const valueInfo = stateRegionResourceValue(stateRegion, resourceKey);
      return {
        key: resourceKey,
        label: filter.label,
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
        ? interpolateColor("#f6d89a", "#9b4a2f", Math.sqrt(valueInfo.total / Math.max(maxValue, 1)))
        : "#eee9df";
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, color),
      active: valueInfo.total > 0,
      value: valueInfo.total,
      label: valueInfo.total > 0 ? formatMapLabelValue(valueInfo.total) : "",
      title: valueInfo.items.length
        ? valueInfo.items.map((item) => `${item.label} ${item.detail}`).join("；")
        : `无${selectedResourceMapLabel()}`,
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
      title: matches.length ? matches.map((culture) => culture.name_zh || culture.key).join("、") : "无匹配文化本土",
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
        ? interpolateColor("#f6d89a", "#9b4a2f", Math.sqrt(valueInfo.value / Math.max(maxValue, 1)))
        : "#eee9df";
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
      title: matchingTraits.length ? matchingTraits.map((trait) => trait.name_zh || trait.key).join("、") : "无匹配地区特质",
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
    const rgb = ownerLayerColors && stateIndex
      ? countryPixelRgb(stateIndex, mapRuntime.pixelOwnerIndexes[pixel] || 0, stateLayer, ownerLayerColors)
      : stateLayer.colors[stateIndex] || stateLayer.colors[0];
    data[offset] = rgb[0];
    data[offset + 1] = rgb[1];
    data[offset + 2] = rgb[2];
    data[offset + 3] = stateIndex
      ? mapPixelAlpha(stateIndex, stateLayer)
      : 0;
  }
  addStateBorders(data, stateIndexes, mapRuntime.width, mapRuntime.height);
  if (state.mapMode === "country" && mapRuntime.pixelOwnerIndexes) {
    addCountryBorders(data, stateIndexes, mapRuntime.pixelOwnerIndexes, mapRuntime.width, mapRuntime.height);
  }
  context.putImageData(imageData, 0, 0);
  mapRuntime.layerCanvas = canvas;
}

function mapPixelAlpha(stateIndex, stateLayer) {
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
      if (index === rightIndex && index === downIndex) continue;
      const color = indexTouchesSea(index, rightIndex) || indexTouchesSea(index, downIndex)
        ? seaBorder
        : stateBorderColor;
      paintBorderPixel(data, pixel, color);
      if (index !== rightIndex && rightIndex) paintBorderPixel(data, rightPixel, color);
      if (hasDown && index !== downIndex && downIndex) paintBorderPixel(data, downPixel, color);
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
  const transform = mapTransformForStateRegions(stateKeys, viewport, { maxWorldScale: 2.6, padding: 180 });
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
  return transform;
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
      const stateRegion = stateRegionFromPointerEvent(event);
      if (stateRegion) {
        selectStateRegionFromMap(stateRegion.key);
      }
    }
  });
  els.mapCanvas.addEventListener("dblclick", (event) => {
    if (state.view !== "region") return;
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
  if (!stateRegion) {
    hideMapTooltip();
    return;
  }
  const feature = mapRuntime.featureByStateKey?.get(stateRegion.key);
  const ownerTag = countryOwnerTagFromPointerEvent(event);
  els.mapTooltip.hidden = false;
  els.mapTooltip.innerHTML = mapTooltipHtml(stateRegion, feature, ownerTag);
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

function mapTooltipHtml(stateRegion, feature, ownerTag = "") {
  const isSea = isSeaStateRegion(stateRegion);
  const kind = isSea ? "海域" : "州地区";
  const variants = stateRegionVariantNames(stateRegion);
  const variantText = variants.length ? `（${escapeHtml(variants.join("/"))}）` : "";
  if (isSea) {
    return `
      <div class="map-tooltip-title">${escapeHtml(stateRegion.name_zh || stateRegion.key)}</div>
      <div class="map-tooltip-sub">${escapeHtml(kind)} · ${escapeHtml(stateRegion.key)}</div>
    `;
  }
  const rows = mapTooltipRowsForView(stateRegion, feature, ownerTag);
  return `
    <div class="map-tooltip-title">${escapeHtml(stateRegion.name_zh || stateRegion.key)}${variantText}</div>
    <div class="map-tooltip-sub">${escapeHtml(kind)} · ${escapeHtml(stateRegion.key)}</div>
    <dl>
      ${rows.map(([label, value]) => tooltipField(label, value)).join("")}
    </dl>
  `;
}

function mapTooltipRowsForView(stateRegion, feature, ownerTag = "") {
  if (state.view === "country" || state.mapMode === "country") {
    return compactTooltipRows([
      ["开局归属", refNames(stateRegion.starting_owners)],
      ["当前省份归属", ownerTag ? countryNameWithTag(ownerTag) : ""],
      ["战略区域", refNames(stateRegion.strategic_regions)],
      ["本土文化", refNames(stateRegion.homeland_cultures)],
    ]);
  }
  if (state.view === "culture" || state.mapMode === "culture") {
    const selectedCulture = byCulture.get(state.selectedCulture);
    return compactTooltipRows([
      ["开局归属", refNames(stateRegion.starting_owners)],
      ["当前省份归属", ownerTag ? countryNameWithTag(ownerTag) : ""],
      ["本土文化", refNames(stateRegion.homeland_cultures)],
      ["文化关系", selectedCulture ? cultureRelationForStateRegion(stateRegion, selectedCulture).label : feature?.title || ""],
    ]);
  }
  if (state.view === "company" || state.mapMode === "company") {
    return compactTooltipRows([
      ["开局归属", countryRefNames(stateRegion.starting_owners)],
      ["战略区域", refNames(stateRegion.strategic_regions)],
      ...mapTooltipResourceRows(stateRegion),
      ["地区特质", mapTooltipTraitSummary(stateRegion)],
    ]);
  }
  return compactTooltipRows([
    ["战略区域", refNames(stateRegion.strategic_regions)],
    ...mapTooltipResourceRows(stateRegion),
    ["耕地", stateRegion.arable_land === null ? "" : String(stateRegion.arable_land)],
    ["地区特质", mapTooltipTraitSummary(stateRegion)],
  ]);
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
      const amount = item.undiscovered_amount ?? item.discovered_amount ?? item.amount ?? "";
      return compactResourceLabel(item, amount);
    }),
    ...(stateRegion?.arable_resources || []).map((item) => compactResourceLabel(item, "")),
  ].filter(Boolean);
  return summarizeTextItems(resources, 5);
}

function mapTooltipTraitSummary(stateRegion) {
  const traits = (stateRegion?.traits || []).map((trait) => trait.name_zh || trait.key).filter(Boolean);
  return summarizeTextItems(traits, 4);
}

function compactResourceLabel(item, amount = "") {
  const label = item?.name_zh || item?.key || "";
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
    ["采矿", tooltipHtml(mapTooltipResourceGroupHtml(groups.mining))],
    ["其他资源", tooltipHtml(mapTooltipResourceGroupHtml(groups.other))],
    ["农业", tooltipHtml(mapTooltipResourceGroupHtml(groups.agriculture))],
  ]);
}

function mapTooltipResourceGroups(stateRegion) {
  const capped = (stateRegion?.capped_resources || []).map((item) => ({ item, amount: item.amount, className: "resource-chip" }));
  const discoverable = (stateRegion?.discoverable_resources || []).map((item) => {
    const amount = item.undiscovered_amount ?? item.discovered_amount ?? item.amount ?? "";
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
