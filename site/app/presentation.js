function renderEntityBadge(kind, entity, label = "") {
  const text = label || entityText(entity) || entity?.name || entity?.tag || entity?.key || "?";
  const initial = text.trim().slice(0, 1).toUpperCase() || "?";
  if (kind === "country") {
    return countryFlagIconHtml(entity, "entity-badge entity-badge-flag") || `<span class="entity-badge entity-badge-square entity-badge-country">${escapeHtml(initial)}</span>`;
  }
  if (kind === "interestGroup" || kind === "interestGroupFlavor") {
    return interestGroupIconHtml(entity, "entity-badge entity-badge-interest-group");
  }
  if (kind === "interestGroupTrait") {
    return traitIconHtml(entity, "interest-group").replace('class="trait-icon"', 'class="entity-badge entity-badge-trait"');
  }
  if (kind === "company") {
    return companyIconHtml(entity).replace('class="company-logo"', 'class="entity-badge entity-badge-company"');
  }
  if (kind === "ideology") {
    return ideologyIconHtml(entity, "entity-badge entity-badge-ideology");
  }
  if (kind === "stateRegion" || kind === "strategicRegion" || kind === "geographicRegion" || kind === "region") {
    const color = entity?.map_color?.hex || entity?.colorHex || "#9b7a5f";
    return `<span class="entity-badge entity-badge-round entity-badge-region" style="--entity-color:${escapeHtml(color)}"></span>`;
  }
  if (kind === "culture" || kind === "religion" || kind === "cultureTrait" || kind === "cultureTraitGroup") {
    const color = entity?.color?.hex || entity?.colorHex || "#b28a67";
    return `<span class="entity-badge entity-badge-swatch" style="--entity-color:${escapeHtml(color)}">${escapeHtml(initial)}</span>`;
  }
  return `<span class="entity-badge entity-badge-square">${escapeHtml(initial)}</span>`;
}

function renderCountryList(filtered) {
  els.countryList.className = "country-list";
  els.countryList.innerHTML = filtered.map((country) => `
    <article class="country-row selectable-row" data-country="${country.tag}" style="${countryBorderStyle(country.colorHex)}" aria-current="${country.tag === state.selectedTag && state.detailKind === "country"}" tabindex="0">
      ${renderEntityBadge("country", country, entityText(country))}
      <span class="country-heading">
        ${conceptTag(country.tag, "country", country.tag, entityText(country))}
        <span class="name">${countryNameText(country)}</span>
        ${rowDetailButton("data-country-detail", country.tag)}
      </span>
      <span class="minor country-meta">${countryCapitalText(country)}</span>
      <span class="minor country-meta">${t("board.country.primaryCulture", "主流文化")}${t("ui.colon")}${(country.primaryCultures || []).map((cultureRef) => entityText(byCulture.get(cultureRef.key) || cultureRef)).filter(Boolean).join(t("ui.listSeparator")) || t("board.country.none", "无")}</span>
      <span class="pill-line country-tags">${countryTagPills(country)}</span>
    </article>
  `).join("");
}
function countryMobileFilterCategories() {
  return [
    { key: "type", label: t("board.country.filter.type", "类型") },
    { key: "tier", label: t("board.country.filter.tier", "位阶") },
    { key: "strategicRegion", label: t("board.country.filter.strategicRegion", "战略区域") },
    { key: "heritage", label: t("board.country.filter.heritage", "传承") },
    { key: "language", label: t("board.country.filter.language", "语言") },
    { key: "tradition", label: t("board.country.filter.tradition", "传统") },
  ];
}

function cultureMobileFilterCategories() {
  return [
    { key: "heritage", label: t("board.culture.filter.heritage", "传承") },
    { key: "language", label: t("board.culture.filter.language", "语言") },
    { key: "tradition", label: t("board.culture.filter.tradition", "传统") },
    { key: "strategicRegion", label: t("board.culture.filter.strategicRegion", "本土战略区域") },
  ];
}

function renderMobileCultureControls() {
  if (!els.mobileCultureToolbar || !els.mobileCultureFilterPanel) return;
  const visible = state.view === "culture" && !isDetailPageRoute();
  els.mobileCultureToolbar.hidden = !visible;
  els.mobileCultureFilterPanel.hidden = !visible || !state.cultureMobileFiltersOpen;
  if (!visible) return;
  const chips = renderMobileCultureFilterChips();
  els.mobileCultureToolbar.innerHTML = `
    <div class="mobile-culture-toolbar-row">
      <label class="mobile-culture-search-input" aria-label="${escapeHtml(t("board.culture.searchAria", "文化搜索与筛选条件"))}">
        ${chips}
        <input id="mobileCultureSearchInput" data-mobile-culture-search type="search" autocomplete="off" placeholder="${escapeHtml(t("board.culture.searchPlaceholder", "搜索文化、传承、语言或传统"))}" value="${escapeHtml(state.cultureMobileSearchDraft)}">
      </label>
      <button class="mobile-culture-tool-button" type="button" data-mobile-culture-search-submit aria-label="${escapeHtml(t("board.culture.search", "搜索"))}" title="${escapeHtml(t("board.culture.search", "搜索"))}"><img class="lucide-icon" src="assets/lucide/icons/search.svg" alt="" aria-hidden="true"></button>
      <button class="mobile-culture-tool-button" type="button" data-mobile-culture-filter-toggle aria-expanded="${String(state.cultureMobileFiltersOpen)}" aria-label="${escapeHtml(state.cultureMobileFiltersOpen ? t("board.culture.collapseFilters", "收起筛选") : t("board.culture.expandFilters", "展开筛选"))}" title="${escapeHtml(state.cultureMobileFiltersOpen ? t("board.culture.collapseFilters", "收起筛选") : t("board.culture.expandFilters", "展开筛选"))}"><img class="lucide-icon" src="assets/lucide/icons/sliders-horizontal.svg" alt="" aria-hidden="true"></button>
      <button class="mobile-culture-tool-button" type="button" data-mobile-culture-map-toggle aria-pressed="${String(state.cultureMobileMapOpen)}" aria-label="${escapeHtml(state.cultureMobileMapOpen ? t("board.culture.collapseMap", "收起地图") : t("board.culture.expandMap", "展开地图"))}" title="${escapeHtml(state.cultureMobileMapOpen ? t("board.culture.collapseMap", "收起地图") : t("board.culture.expandMap", "展开地图"))}"><img class="lucide-icon" src="assets/lucide/icons/map.svg" alt="" aria-hidden="true"></button>
    </div>
  `;
  els.mobileCultureFilterPanel.innerHTML = state.cultureMobileFiltersOpen ? `
    <div class="mobile-culture-filter-categories" role="tablist" aria-label="${escapeHtml(t("board.culture.filterCategories", "文化筛选分类"))}">
      ${cultureMobileFilterCategories().map((category) => `<button class="mobile-culture-filter-category" type="button" data-mobile-culture-filter-category="${category.key}" aria-selected="${String(state.cultureMobileFilterCategory === category.key)}">${escapeHtml(category.label)}</button>`).join("")}
    </div>
    ${renderMobileCultureFilterOptions()}
  ` : "";
}

function renderMobileCultureFilterChips() {
  const selected = mobileCultureSelectedFilters();
  const duplicates = new Set(selected.filter((item, index) => selected.findIndex((candidate) => candidate.label === item.label) !== index).map((item) => item.label));
  return selected.map((item) => `
    <span class="mobile-culture-filter-chip" data-mobile-culture-filter-chip="${escapeHtml(item.category)}">
      <span>${escapeHtml(duplicates.has(item.label) ? `${item.label}（${item.categoryLabel}）` : item.label)}</span>
      <button type="button" data-mobile-culture-filter-clear="${escapeHtml(item.category)}" aria-label="${escapeHtml(t("board.culture.removeFilter", "删除 {value}").replace("{value}", item.label))}">×</button>
    </span>
  `).join("");
}

function renderMobileCultureFilterOptions() {
  const category = state.cultureMobileFilterCategory;
  if (category === "heritage") return renderCultureMobileGroupedOptions({
    groupAttribute: "data-mobile-culture-expand-heritage-group",
    expandedGroup: state.cultureMobileExpandedHeritageGroup,
    groups: mobileCultureRefs((culture) => culture.heritage_group, sortHeritageGroupRef),
    traits: mobileCultureRefs((culture) => culture.heritage, sortRefByName),
    category,
  });
  if (category === "language") return renderCultureMobileGroupedOptions({
    groupAttribute: "data-mobile-culture-expand-language-group",
    expandedGroup: state.cultureMobileExpandedLanguageGroup,
    groups: mobileCultureRefs((culture) => culture.language_group, sortLanguageGroupRef),
    traits: mobileCultureRefs((culture) => culture.language, sortRefByName),
    category,
  });
  if (category === "strategicRegion") {
    const regions = strategicRegions
      .filter((region) => !isSeaStrategicRegion(region) && cultures.some((culture) => (culture.homeland_strategic_regions || []).some((item) => item.key === region.key)))
      .sort(sortStrategicRegionRef);
    const groups = strategicRegionContinentGroups.filter((group) => regions.some((region) => strategicRegionContinentByKey.get(region.key) === group.key));
    const expanded = state.cultureMobileExpandedStrategicRegionContinent;
    const options = regions.filter((region) => strategicRegionContinentByKey.get(region.key) === expanded);
    return `
      <div class="mobile-culture-filter-options" aria-label="${escapeHtml(t("board.culture.strategicRegionGroups", "本土战略区域洲别"))}">
        ${groups.map((group) => `<button class="mobile-culture-filter-option" type="button" data-mobile-culture-expand-strategic-region-continent="${escapeHtml(group.key)}" aria-pressed="${String(expanded === group.key)}">${escapeHtml(t(`continent.${group.key}`))}</button>`).join("")}
      </div>
      ${expanded ? `<div class="mobile-culture-filter-layer-divider"></div><div class="mobile-culture-filter-options" aria-label="${escapeHtml(t("board.culture.strategicRegionOptions", "本土战略区域选项"))}">${renderCultureMobileActualOption(category, "", t("board.culture.any", "不限"))}${options.map((item) => renderCultureMobileActualOption(category, item.key, strategicRegionName(item))).join("")}</div>` : ""}
    `;
  }
  const traditions = mobileCultureRefs((culture) => culture.traditions || [], sortRefByName);
  return `<div class="mobile-culture-filter-options" aria-label="${escapeHtml(t("board.culture.traditionOptions", "传统筛选选项"))}">${renderCultureMobileActualOption(category, "", t("board.culture.any", "不限"))}${traditions.map((item) => renderCultureMobileActualOption(category, item.key, entityText(item) || item.key)).join("")}</div>`;
}

function renderCultureMobileGroupedOptions({ groupAttribute, expandedGroup, groups, traits, category }) {
  const options = traits.filter((trait) => trait.group_key === expandedGroup);
  return `
    <div class="mobile-culture-filter-options" aria-label="${escapeHtml(cultureMobileFilterCategoryLabel())}组">
      ${groups.map((group) => `<button class="mobile-culture-filter-option" type="button" ${groupAttribute}="${escapeHtml(group.key)}" aria-pressed="${String(group.key === expandedGroup)}">${escapeHtml(entityText(group) || group.key)}</button>`).join("")}
    </div>
    ${expandedGroup ? `<div class="mobile-culture-filter-layer-divider"></div><div class="mobile-culture-filter-options" aria-label="${escapeHtml(cultureMobileFilterCategoryLabel())}选项">${renderCultureMobileActualOption(category, "", t("board.culture.any", "不限"))}${options.map((item) => renderCultureMobileActualOption(category, item.key, entityText(item) || item.key)).join("")}</div>` : ""}
  `;
}

function renderCultureMobileActualOption(category, value, label) {
  const selected = category === "heritage" ? state.heritages.has(value)
    : category === "language" ? state.languages.has(value)
      : category === "strategicRegion" ? state.strategicRegions.has(value)
        : state.tradition === value;
  const hasActualFilter = category === "heritage" ? state.heritages.size > 0
    : category === "language" ? state.languages.size > 0
      : category === "strategicRegion" ? state.strategicRegions.size > 0
        : Boolean(state.tradition);
  if (!value) return `<button class="mobile-culture-filter-option" type="button" data-mobile-culture-filter-clear-option="${escapeHtml(category)}" aria-pressed="${String(!hasActualFilter)}">${escapeHtml(label)}</button>`;
  return `<button class="mobile-culture-filter-option" type="button" data-mobile-culture-filter-option="${escapeHtml(value)}" data-mobile-culture-filter-category="${escapeHtml(category)}" aria-pressed="${String(selected)}">${escapeHtml(label)}</button>`;
}

function cultureMobileFilterCategoryLabel() {
  return cultureMobileFilterCategories().find((category) => category.key === state.cultureMobileFilterCategory)?.label || t("board.culture.filter.heritage", "传承");
}

function mobileCultureSelectedFilters() {
  const items = [];
  const add = (category, categoryLabel, value, label) => {
    if (value) items.push({ category, categoryLabel, label: mobileCultureShortName(category, label), value });
  };
  const heritage = [...state.heritages][0] || "";
  const language = [...state.languages][0] || "";
  const strategicRegion = [...state.strategicRegions][0] || "";
  add("heritage", "传承", heritage, mobileCultureRefName("heritage", heritage));
  add("language", "语言", language, mobileCultureRefName("language", language));
  add("tradition", "传统", state.tradition, mobileCultureRefName("traditions", state.tradition));
  add("strategicRegion", "本土战略区域", strategicRegion, strategicRegionName(byStrategicRegion.get(strategicRegion)) || strategicRegion);
  return items;
}

function mobileCultureRefs(getter, sorter) {
  const source = state.omitIndigenousLanguagesCultures ? cultures.filter((culture) => !isIndigenousCulture(culture)) : cultures;
  return collectCultureRefs(getter, sorter, source);
}

function mobileCultureRefName(field, key) {
  if (!key) return "";
  for (const culture of cultures) {
    const values = Array.isArray(culture[field]) ? culture[field] : [culture[field]];
    const match = values.find((item) => item?.key === key);
    if (match) return entityText(match) || match.key;
  }
  return key;
}

function mobileCultureShortName(category, label) {
  if (!label || category === "tradition" || category === "strategicRegion") return label;
  return label.replace(/(?:传承|语言|语支|语族)$/u, "") || label;
}

function renderMobileCountryControls() {
  if (!els.mobileCountryToolbar || !els.mobileCountryFilterPanel) return;
  const visible = state.view === "country" && !isDetailPageRoute();
  els.mobileCountryToolbar.hidden = !visible;
  els.mobileCountryFilterPanel.hidden = !visible || !state.countryMobileFiltersOpen;
  if (!visible) return;
  const chips = renderMobileCountryFilterChips();
  els.mobileCountryToolbar.innerHTML = `
    <div class="mobile-country-toolbar-row">
      <label class="mobile-country-search-input" aria-label="${escapeHtml(t("board.country.searchAria"))}">
        ${chips}
        <input id="mobileCountrySearchInput" data-mobile-country-search type="search" autocomplete="off" placeholder="${escapeHtml(t("board.country.searchPlaceholder", "搜索国家、文化或标签"))}" value="${escapeHtml(state.countryMobileSearchDraft)}">
      </label>
      <button class="mobile-country-tool-button" type="button" data-mobile-country-search-submit aria-label="${escapeHtml(t("board.country.executeSearch"))}" title="${escapeHtml(t("board.country.executeSearch"))}"><img class="lucide-icon" src="assets/lucide/icons/search.svg" alt="" aria-hidden="true"></button>
      <button class="mobile-country-tool-button" type="button" data-mobile-country-filter-toggle aria-expanded="${String(state.countryMobileFiltersOpen)}" aria-label="${escapeHtml(state.countryMobileFiltersOpen ? t("board.country.collapseFilters", "收起筛选") : t("board.country.expandFilters", "展开筛选"))}" title="${escapeHtml(state.countryMobileFiltersOpen ? t("board.country.collapseFilters", "收起筛选") : t("board.country.expandFilters", "展开筛选"))}"><img class="lucide-icon" src="assets/lucide/icons/sliders-horizontal.svg" alt="" aria-hidden="true"></button>
      <button class="mobile-country-tool-button" type="button" data-mobile-country-map-toggle aria-pressed="${String(state.countryMobileMapOpen)}" aria-label="${escapeHtml(state.countryMobileMapOpen ? t("board.country.collapseMap", "收起地图") : t("board.country.expandMap", "展开地图"))}" title="${escapeHtml(state.countryMobileMapOpen ? t("board.country.collapseMap", "收起地图") : t("board.country.expandMap", "展开地图"))}"><img class="lucide-icon" src="assets/lucide/icons/map.svg" alt="" aria-hidden="true"></button>
    </div>
  `;
  els.mobileCountryFilterPanel.innerHTML = state.countryMobileFiltersOpen ? `
    <div class="mobile-country-filter-categories" role="tablist" aria-label="${escapeHtml(t("board.country.filterCategories", "国家筛选分类"))}">
      ${countryMobileFilterCategories().map((category) => `<button class="mobile-country-filter-category" type="button" data-mobile-country-filter-category="${category.key}" aria-selected="${String(state.countryMobileFilterCategory === category.key)}">${escapeHtml(category.label)}</button>`).join("")}
    </div>
    <div class="mobile-country-filter-options" aria-label="${escapeHtml(countryMobileFilterCategoryLabel())}筛选选项">
      ${mobileCountryFilterOptions().map((option) => `<button class="mobile-country-filter-option" type="button" data-mobile-country-filter-option="${escapeHtml(option.value)}" aria-pressed="${String(option.selected)}">${escapeHtml(option.label)}</button>`).join("")}
    </div>
  ` : "";
}

function renderMobileCountryFilterChips() {
  const selected = mobileCountrySelectedFilters();
  const duplicatedLabels = new Set(selected.filter((item, index) => selected.findIndex((candidate) => candidate.label === item.label) !== index).map((item) => item.label));
  return selected.map((item) => `
    <span class="mobile-country-filter-chip" data-mobile-country-filter-chip="${escapeHtml(item.category)}">
      <span>${escapeHtml(duplicatedLabels.has(item.label) ? `${item.label}（${item.categoryLabel}）` : item.label)}</span>
      <button type="button" data-mobile-country-filter-clear="${escapeHtml(item.category)}" aria-label="${escapeHtml(t("board.country.removeFilter", "删除 {value}").replace("{value}", item.label))}">×</button>
    </span>
  `).join("");
}

function mobileCountrySelectedFilters() {
  const items = [];
  const add = (category, categoryLabel, label, value) => {
    if (value) items.push({ category, categoryLabel, label, value });
  };
  const flagLabels = {
    existsAtStart: t("board.country.filter.type.existsAtStart", "开局存在"),
    isReleasable: t("board.country.filter.type.isReleasable", "可释放"),
    isMinorFormable: t("board.country.filter.type.isMinorFormable", "次要统一"),
    isMajorFormable: t("board.country.filter.type.isMajorFormable", "重大统一"),
    isDualHeritage: t("board.country.filter.type.isDualHeritage", "双传承"),
    isSpecial: t("board.country.filter.type.isSpecial", "彩蛋"),
    isCivilWar: t("board.country.filter.type.isCivilWar", "内战国家"),
  };
  add("type", t("board.country.filter.type", "类型"), flagLabels[[...state.flags][0]] || "", [...state.flags][0] || "");
  add("tier", t("board.country.filter.tier", "位阶"), countryTierLabel([...state.tiers][0]), [...state.tiers][0] || "");
  add("strategicRegion", t("board.country.filter.strategicRegion", "战略区域"), strategicRegionName(byStrategicRegion.get([...state.strategicRegions][0])) || "", [...state.strategicRegions][0] || "");
  add("heritage", t("board.country.filter.heritage", "传承"), mobileCountryCultureRefName("heritage", [...state.heritages][0]), [...state.heritages][0] || "");
  add("language", t("board.country.filter.language", "语言"), mobileCountryCultureRefName("language", [...state.languages][0]), [...state.languages][0] || "");
  add("tradition", t("board.country.filter.tradition", "传统"), mobileCountryCultureRefName("traditions", state.tradition), state.tradition);
  return items;
}

function countryTierLabel(key) {
  return t(`enum.tier.${key}`) || key || "";
}

function countryMobileFilterCategoryLabel() {
  return countryMobileFilterCategories().find((category) => category.key === state.countryMobileFilterCategory)?.label || t("board.country.filter.type", "类型");
}

function mobileCountryFilterOptions() {
  const category = state.countryMobileFilterCategory;
  if (category === "type") {
    const flags = [
      ["existsAtStart", t("board.country.filter.type.existsAtStart", "开局存在")], ["isReleasable", t("board.country.filter.type.isReleasable", "可释放")], ["isMinorFormable", t("board.country.filter.type.isMinorFormable", "次要统一")], ["isMajorFormable", t("board.country.filter.type.isMajorFormable", "重大统一")], ["isDualHeritage", t("board.country.filter.type.isDualHeritage", "双传承")], ["isSpecial", t("board.country.filter.type.isSpecial", "彩蛋")], ["isCivilWar", t("board.country.filter.type.isCivilWar", "内战国家")],
    ];
    return flags.map(([value, label]) => ({ value, label, selected: state.flags.has(value) }));
  }
  if (category === "tier") return tierOrder.map((key) => ({ value: key, label: countryTierLabel(key), selected: state.tiers.has(key) }));
  if (category === "strategicRegion") return strategicRegions
    .filter((region) => !isSeaStrategicRegion(region) && countries.some((country) => (country.locationStrategicRegions || []).some((item) => item.key === region.key)))
    .sort(sortStrategicRegionRef)
    .map((region) => ({ value: region.key, label: strategicRegionName(region), selected: state.strategicRegions.has(region.key) }));
  if (category === "heritage") return collectCultureRefs((culture) => culture.heritage, sortRefByName)
    .map((item) => ({ value: item.key, label: entityText(item) || item.key, selected: state.heritages.has(item.key) }));
  if (category === "language") return collectCultureRefs((culture) => culture.language, sortRefByName)
    .map((item) => ({ value: item.key, label: entityText(item) || item.key, selected: state.languages.has(item.key) }));
  return collectCultureRefs((culture) => culture.traditions || [], sortRefByName)
    .map((item) => ({ value: item.key, label: entityText(item) || item.key, selected: state.tradition === item.key }));
}

function mobileCountryCultureRefName(field, key) {
  if (!key) return "";
  for (const culture of cultures) {
    const refs = Array.isArray(culture[field]) ? culture[field] : [culture[field]];
    const match = refs.find((item) => item?.key === key);
    if (match) return entityText(match) || match.key;
  }
  return key;
}

function rowsForSelection(attribute, key) {
  if (!key || !els.countryList) return [];
  return [...els.countryList.querySelectorAll("[" + attribute + "]")]
    .filter((row) => row.getAttribute(attribute) === key);
}

function syncListSelection(attribute, previousKey, nextKey) {
  for (const row of rowsForSelection(attribute, previousKey)) row.setAttribute("aria-current", "false");
  for (const row of rowsForSelection(attribute, nextKey)) row.setAttribute("aria-current", "true");
}

function commitCountrySelection(countryTag) {
  const previousTag = state.selectedTag;
  state.globalSearchColorRestoreTag = "";
  state.selectedTag = countryTag;
  state.detailKind = "country";
  replaceHash(selectionHashForCard("/country", "/country/" + encodeURIComponent(countryTag)));
  syncListSelection("data-country", previousTag, state.selectedTag);
  renderMap(countryMapStateRegions(byTag.get(state.selectedTag)));
}

function clearFilteredOutCountryMapSelection() {
  const previousTag = state.selectedTag;
  state.globalSearchColorRestoreTag = "";
  state.selectedTag = "";
  state.detailKind = "country";
  replaceHash("/country");
  syncListSelection("data-country", previousTag, "");
  renderMap(countryMapStateRegions(null));
}

function selectCountryCard(countryTag) {
  if (!countryTag || !byTag.has(countryTag)) return;
  commitCountrySelection(countryTag);
}

function selectCountryFromMap(countryTag) {
  if (!countryTag || !byTag.has(countryTag)) return;
  if (!mapRuntime.filteredCountryTags.has(countryTag)) {
    clearFilteredOutCountryMapSelection();
    return;
  }
  commitCountrySelection(countryTag);
}

function openCountryDetail(countryTag) {
  if (!countryTag || !byTag.has(countryTag)) return;
  const isMobileCountryViewport = window.matchMedia("(max-aspect-ratio: 3 / 2)").matches;
  if (isMobileCountryViewport) state.countryMobileListScrollTop = window.scrollY || els.countryList?.scrollTop || 0;
  state.globalSearchColorRestoreTag = "";
  state.selectedTag = countryTag;
  state.detailKind = "country";
  if (isMobileCountryViewport) {
    location.hash = `/country/${encodeURIComponent(countryTag)}`;
    return;
  }
  replaceHash(`/country/${encodeURIComponent(countryTag)}`);
  render();
}

function renderRegionList(filteredStrategicRegions, filteredStateRegions, filteredSeaRegions, filteredGeographicRegions) {
  const visibleStateRegions = filteredStateRegions;
  const selectedStateRegionFromMap = byStateRegion.get(state.mapSelectedStateRegion);
  const mapSelectionIsFilteredOut = selectedStateRegionFromMap && !visibleStateRegions.some((stateRegion) => stateRegion.key === selectedStateRegionFromMap.key);
  els.countryList.className = "country-list region-list";
  const selectedFromMapHtml = mapSelectionIsFilteredOut
    ? stateRegionRowHtml(selectedStateRegionFromMap, { mapSelected: true })
    : "";
  const stateRegionHtml = visibleStateRegions.length ? `
    <div class="list-section-title">${t("board.region.stateRegion", "地域")}</div>
    ${visibleStateRegions.map((stateRegion) => stateRegionRowHtml(stateRegion)).join("")}
  ` : "";
  els.countryList.innerHTML = `${selectedFromMapHtml}${stateRegionHtml || (selectedFromMapHtml ? "" : `<p class="empty">${t("board.region.empty", "没有匹配结果。")}</p>`)}`;
}

function stateRegionRowHtml(stateRegion, { mapSelected = false } = {}) {
  const selected = mapSelected || (stateRegion.key === state.selectedStateRegion && state.detailKind === "stateRegion");
  return `
    <article class="country-row region-row${mapSelected ? " region-map-selected" : ""} selectable-row" data-state-region="${escapeHtml(stateRegion.key)}" style="${stateRegionBorderStyle(stateRegion)}" aria-current="${selected}" tabindex="0">
      <span class="country-heading">
        ${conceptTag(stateRegion.key, "stateRegion", stateRegion.key, entityText(stateRegion))}
        <span class="name">${stateRegionNameText(stateRegion)}</span>
        ${rowDetailButton("data-state-region-detail", stateRegion.key)}
      </span>
      <span class="minor country-meta">${escapeHtml(stateRegionSummaryText(stateRegion))}</span>
      <span class="minor country-meta">${t("board.region.homelandCultures", "本土文化")}：${escapeHtml(refNames(stateRegion.homeland_cultures))}</span>
      <span class="pill-line country-tags">${stateRegionTagPills(stateRegion)}</span>
      <span class="region-building-strip">${stateRegionBuildingStrip(stateRegion)}</span>
    </article>
  `;
}

function syncMapSelectedStateRegionCard() {
  els.countryList.querySelector(".region-map-selected")?.remove();
  const selected = byStateRegion.get(state.mapSelectedStateRegion);
  const visible = rowsForSelection("data-state-region", state.mapSelectedStateRegion).length > 0;
  if (!selected || visible) return;
  els.countryList.insertAdjacentHTML("afterbegin", stateRegionRowHtml(selected, { mapSelected: true }));
}

function commitStateRegionSelection(stateRegionKey, { fromMap }) {
  const previousKey = state.selectedStateRegion;
  const isVisibleListItem = rowsForSelection("data-state-region", stateRegionKey)
    .some((row) => !row.classList.contains("region-map-selected"));
  state.selectedStateRegion = stateRegionKey;
  state.mapSelectedStateRegion = fromMap ? stateRegionKey : "";
  state.detailKind = "stateRegion";
  state.regionListMode = "state";
  if (!fromMap && !isVisibleListItem && !isDetailPageRoute()) state.selectedStateRegion = "";
  replaceHash(fromMap ? "/region" : selectionHashForCard("/region", "/state-region/" + encodeURIComponent(stateRegionKey)));
  syncMapSelectedStateRegionCard();
  syncListSelection("data-state-region", previousKey, state.selectedStateRegion);
  renderRegionMapForCurrentFilters();
}

function selectStateRegionCard(stateRegionKey) {
  if (!stateRegionKey || !byStateRegion.has(stateRegionKey)) return;
  commitStateRegionSelection(stateRegionKey, { fromMap: false });
}

function selectStateRegionFromMap(stateRegionKey) {
  if (!stateRegionKey || !byStateRegion.has(stateRegionKey)) return;
  commitStateRegionSelection(stateRegionKey, { fromMap: true });
}

function openStateRegionDetail(stateRegionKey) {
  if (!stateRegionKey || !byStateRegion.has(stateRegionKey)) return;
  state.selectedStateRegion = stateRegionKey;
  state.mapSelectedStateRegion = "";
  state.detailKind = "stateRegion";
  state.regionListMode = "state";
  replaceHash(`/state-region/${encodeURIComponent(stateRegionKey)}`);
  render();
}

function renderCultureList(filtered) {
  const visible = filtered.slice(0, 220);
  els.countryList.className = "country-list culture-list";
  els.countryList.innerHTML = visible.map((culture) => `
    <article class="culture-row selectable-row" data-culture="${escapeHtml(culture.key)}" aria-current="${culture.key === state.selectedCulture && state.detailKind === "culture"}" tabindex="0">
      <span class="country-color" style="${colorStyle(culture.color?.hex)}" aria-hidden="true"></span>
      ${conceptTag(culture.key, "culture", culture.key, entityText(culture))}
      <span>
        <span class="name">${escapeHtml(entityText(culture))}</span>
        <span class="minor">${escapeHtml([entityText(culture.heritage), entityText(culture.language)].filter(Boolean).join("?"))}</span>
      </span>
      ${rowDetailButton("data-culture-detail", culture.key)}
      <span class="minor">${escapeHtml((culture.homeland_strategic_regions || []).map((region) => entityText(region)).filter(Boolean).join("?"))}</span>
      <span class="pill-line">${traitList(culture.traditions)}${victorianCenturyBadge(culture)}</span>
    </article>
  `).join("");
  els.countryList.querySelectorAll("[data-culture]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("a, button, [data-concept-key]")) return;
      selectCultureCard(row.dataset.culture);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("a, button, [data-concept-key]")) return;
      event.preventDefault();
      selectCultureCard(row.dataset.culture);
    });
  });
  els.countryList.querySelectorAll("[data-culture-detail]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openCultureDetail(button.dataset.cultureDetail);
    });
  });
}
function selectCultureCard(cultureKey) {
  if (!cultureKey || !byCulture.has(cultureKey)) return;
  state.selectedCulture = cultureKey;
  state.detailKind = "culture";
  replaceHash(selectionHashForCard("/culture", `/culture/${encodeURIComponent(cultureKey)}`));
  render();
}

function openCultureDetail(cultureKey) {
  if (!cultureKey || !byCulture.has(cultureKey)) return;
  if (window.matchMedia("(max-aspect-ratio: 3 / 2)").matches) state.cultureMobileListScrollTop = window.scrollY || els.countryList?.scrollTop || 0;
  state.selectedCulture = cultureKey;
  state.detailKind = "culture";
  replaceHash(`/culture/${encodeURIComponent(cultureKey)}`);
  render();
}

function renderCompanyList(filtered) {
  const visible = filtered;
  els.countryList.className = "country-list company-list";
  els.countryList.innerHTML = visible.map((company) => `
    <article class="country-row company-row" data-company="${escapeHtml(company.key)}" aria-current="${company.key === state.selectedCompany && state.detailKind === "company"}" tabindex="0">
      <span class="company-heading">
        ${companyIconHtml(company)}
        <span class="company-title-text">
          <span class="name">${escapeHtml(entityText(company) || company.key)}</span>
        </span>
        ${companyDlcIconPill(company)}
      </span>
      <span class="region-building-strip">${companyBuildingStrip(company)}</span>
      <span class="pill-line country-tags company-asset-line">${companyPrestigeGoodsPills(company)}</span>
      <span class="minor country-meta">${companyMetaLine(company)}</span>
      <span class="pill-line country-tags company-tag-line">${companyTagPills(company)}</span>
    </article>
  `).join("");
  els.countryList.querySelectorAll("[data-company]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("a, button, [data-concept-key]")) return;
      openCompanyDetail(row.dataset.company);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("a, button, [data-concept-key]")) return;
      event.preventDefault();
      openCompanyDetail(row.dataset.company);
    });
  });
}

function selectCompanyCard(companyKey) {
  if (!companyKey || !byCompany.has(companyKey)) return;
  state.selectedCompany = companyKey;
  state.detailKind = "company";
  replaceHash(selectionHashForCard("/company", `/company/${encodeURIComponent(companyKey)}`));
  render();
}

function openCompanyDetail(companyKey) {
  if (!companyKey || !byCompany.has(companyKey)) return;
  state.selectedCompany = companyKey;
  state.detailKind = "company";
  replaceHash(`/company/${encodeURIComponent(companyKey)}`);
  render();
}

function renderIdeologyList(filtered) {
  const visible = filtered.slice(0, 220);
  els.countryList.className = "country-list ideology-list";
  if (!visible.length) {
    els.countryList.innerHTML = `<p class="empty">${t("board.ideology.empty", "没有匹配结果。")}</p>`;
    return;
  }
  const grouped = ideologyTypeOptions.map((type) => ({
    ...type,
    items: visible.filter((ideology) => ideologyTypeKey(ideology) === type.key),
  })).filter((type) => type.items.length > 0);
  els.countryList.innerHTML = grouped.map((type) => `
    <div class="list-section-title">${escapeHtml(ideologyTypeLabel(type.key))}</div>
    ${type.items.map((ideology) => `
      <article class="country-row ideology-row selectable-row" data-ideology="${escapeHtml(ideology.key)}" aria-current="${ideology.key === state.selectedIdeology && state.detailKind === "ideology"}" tabindex="0">
        <span class="country-heading ideology-row-heading">
          ${ideologyIconHtml(ideology, "ideology-icon ideology-row-icon")}
          <span class="ideology-row-title">
            ${conceptTag(ideology.key, "ideology", ideology.key, entityText(ideology))}
            <span class="name">${escapeHtml(entityText(ideology))}</span>
          </span>
          ${rowDetailButton("data-ideology-detail", ideology.key)}
        </span>
        <span class="minor country-meta">${escapeHtml(cleanIdeologyDescription(entityText(ideology, "description")) || t("ui.noDescription", "无描述"))}</span>
        <span class="pill-line country-tags">${victorianCenturyBadge(ideology)}</span>
        ${ideologyLawGroupPreviewHtml(ideology)}
      </article>
    `).join("")}
  `).join("");
  els.countryList.querySelectorAll("[data-ideology]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("a, button, [data-concept-key]")) return;
      selectIdeologyCard(row.dataset.ideology);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("a, button, [data-concept-key]")) return;
      event.preventDefault();
      selectIdeologyCard(row.dataset.ideology);
    });
  });
  els.countryList.querySelectorAll("[data-ideology-detail]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openIdeologyDetail(button.dataset.ideologyDetail);
    });
  });
}

function selectIdeologyCard(ideologyKey) {
  if (!ideologyKey || !ideologyByKey.has(ideologyKey)) return;
  state.selectedIdeology = ideologyKey;
  state.detailKind = "ideology";
  replaceHash(selectionHashForCard("/ideology", `/ideology/${encodeURIComponent(ideologyKey)}`));
  render();
}

function selectionHashForCard(boardHash, detailHash) {
  return isDetailPageRoute() ? detailHash : boardHash;
}

function openIdeologyDetail(ideologyKey) {
  if (!ideologyKey || !ideologyByKey.has(ideologyKey)) return;
  state.selectedIdeology = ideologyKey;
  state.detailKind = "ideology";
  replaceHash(`/ideology/${encodeURIComponent(ideologyKey)}`);
  render();
}

function renderLawList(filtered) {
  const categories = new Map();
  for (const law of filtered) {
    const groupKey = law.group_key || "uncategorized";
    const group = lawGroupByKey.get(groupKey) || { key: groupKey, loc: { name: law.loc?.groupName }, category: "uncategorized" };
    const categoryKey = group.category || "uncategorized";
    if (!categories.has(categoryKey)) categories.set(categoryKey, { key: categoryKey, groups: new Map() });
    const groups = categories.get(categoryKey).groups;
    if (!groups.has(groupKey)) groups.set(groupKey, { ...group, laws: [] });
    groups.get(groupKey).laws.push(law);
  }
  const sections = [...categories.values()].sort((a, b) => lawGroupCategoryOrder(a.key) - lawGroupCategoryOrder(b.key)
    || localizedCompare(lawGroupCategoryLabel(a.key), lawGroupCategoryLabel(b.key)));
  els.countryList.className = "country-list law-list";
  if (!sections.length) {
    els.countryList.innerHTML = `<p class="empty">${t("board.law.empty", "没有匹配结果。")}</p>`;
    return;
  }
  els.countryList.innerHTML = sections.map((category) => `
    <details class="law-category-section" open>
      <summary class="law-category-title">${escapeHtml(lawGroupCategoryLabel(category.key))}</summary>
      ${[...category.groups.values()].sort(sortLawGroup).map((group) => `
        <section class="law-group-section">
          <h3 class="list-section-title">${escapeHtml(entityText(group))}</h3>
          ${group.laws.sort(sortLaws).map((law) => `
      <article class="country-row law-row selectable-row" data-law="${escapeHtml(law.key)}" aria-current="${law.key === state.selectedLaw && state.detailKind === "law"}" tabindex="0">
          <span class="country-heading law-row-heading">
          ${lawIconHtml(law, "law-icon law-row-icon")}
          <span class="law-row-title">${conceptTag(law.key, "law", law.key, lawDisplayName(law))}<span class="name">${escapeHtml(lawDisplayName(law))}</span></span>
          ${rowDetailButton("data-law-detail", law.key)}
        </span>
        <span class="pill-line country-tags">${victorianCenturyBadge(law)}</span>
      </article>
          `).join("")}
        </section>
      `).join("")}
    </details>
  `).join("");
  els.countryList.querySelectorAll("[data-law]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("a, button, [data-concept-key]")) return;
      selectLawCard(row.dataset.law);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("a, button, [data-concept-key]")) return;
      event.preventDefault();
      selectLawCard(row.dataset.law);
    });
  });
  els.countryList.querySelectorAll("[data-law-detail]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openLawDetail(button.dataset.lawDetail);
    });
  });
}

function selectLawCard(lawKey) {
  if (!lawKey || !lawByKey.has(lawKey)) return;
  state.selectedLaw = lawKey;
  state.detailKind = "law";
  replaceHash(selectionHashForCard("/law", `/law/${encodeURIComponent(lawKey)}`));
  render();
}

function openLawDetail(lawKey) {
  if (!lawKey || !lawByKey.has(lawKey)) return;
  state.selectedLaw = lawKey;
  state.detailKind = "law";
  replaceHash(`/law/${encodeURIComponent(lawKey)}`);
  render();
}

function lawProgressivenessLabel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return t("ui.none", "无");
  return `${numeric > 0 ? "+" : ""}${localizedNumber(numeric)}`;
}

function globalSearchDisplayTitle(result, needle) {
  const title = result.title || result.key || "";
  const aliases = result.aliases || [];
  if (result.kind === "interestGroupFlavor" && aliases.length) return `${title}（${aliases.join("/")}）`;
  const matchedAliases = aliases.filter((alias) => normalizeSearchText(alias).includes(needle));
  if (!matchedAliases.length) return title;
  const remainingAliases = aliases.filter((alias) => !matchedAliases.includes(alias));
  return `${title}（${[...matchedAliases, ...remainingAliases].join("/")}）`;
}

function interestGroupFlavorSearchResults() {
  const candidates = countries.flatMap((country) => (country.interestGroups || [])
    .filter((group) => group.display_name?.is_flavored)
    .map((group) => ({
      id: `interestGroupFlavor:${country.tag}:${group.key}`,
      kind: "interestGroupFlavor",
      typeLabel: "利益集团风味",
      key: group.key,
      navigationKey: `${country.tag}:${group.key}`,
      title: entityText(group.display_name || group),
      aliases: [entityText(group)].filter((name) => name && name !== entityText(group.display_name)),
      subtitle: entityText(country),
      raw: group,
      countryTag: country.tag,
      searchText: [country.tag, entityText(country), group.key, entityText(group), group.display_name?.key, entityText(group.display_name)].filter(Boolean).join(" "),
    })));
  const byFlavor = new Map();
  for (const candidate of candidates) {
    const identity = `${candidate.key}:${candidate.title}`;
    const current = byFlavor.get(identity);
    if (!current || candidate.countryTag === "JAP") byFlavor.set(identity, candidate);
  }
  return [...byFlavor.values()];
}

function matchesCommonLawAndIdeologyFilter(item, kind) {
  if (!state.commonLawIdeologyOnly) return true;
  if (kind === "law") return !item.parent;
  return isCommonIdeology(item);
}

function isCommonIdeology(ideology) {
  return ideology?.is_universal === true;
}

function bindLawGroupFilterTokens() {
  els.lawGroupFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-law-group]");
    if (!button || !els.lawGroupFilters.contains(button)) return;
    const value = button.dataset.lawGroup;
    if (!value) return;
    const pressed = button.getAttribute("aria-pressed") === "true";
    state.lawGroups.clear();
    if (!pressed) state.lawGroups.add(value);
    render();
  });
}

function lawDisplayName(law) {
  if (!law) return "";
  const name = entityText(law);
  const parent = law.parent ? lawByKey.get(law.parent) : null;
  const parentName = parent ? entityText(parent) : law.parent || "";
  return parentName ? t("board.law.amendmentDisplayName", { name, parent: parentName }) : name;
}

function lawGroupCategoryLabel(category) {
  return t(`enum.lawGroupCategory.${category || "uncategorized"}`, category || t("enum.lawGroupCategory.uncategorized", "未分类"));
}

function lawGroupCategoryOrder(category) {
  return ["power_structure", "economy", "human_rights", "uncategorized"].indexOf(category);
}

function lawEffectListHtml(law) {
  const modifiers = (law.modifiers || []).map((modifier) => ({ kind: "modifier", modifier }));
  const institutionModifiers = (law.institution_modifiers || []).map((modifier) => ({ kind: "modifier", modifier }));
  const enactmentEffects = (law.enactment_effects || []).map((label) => ({ kind: "enactment", label }));
  const hasInstitutionEffects = Boolean(law.institution) || institutionModifiers.length > 0;
  if (!modifiers.length && !hasInstitutionEffects && !enactmentEffects.length) return `<p class="empty compact">${t("board.law.noEffects", "暂无可直接展示的效果。")}</p>`;
  return `<ul class="law-effect-list">
    ${modifiers.map(lawEffectItemHtml).join("")}
    ${law.institution ? lawEffectItemHtml({ kind: "institution", institution: law.institution }) : ""}
    ${institutionModifiers.length ? `<li class="law-effect-section-label">${t("board.law.institutionEffectPerLevel", "机构效果（每级）：")}</li>${institutionModifiers.map(lawEffectItemHtml).join("")}` : ""}
    ${enactmentEffects.map(lawEffectItemHtml).join("")}
  </ul>`;
}

function lawEffectItemHtml(entry) {
  if (entry.kind === "institution") return `<li class="law-effect-neutral">${escapeHtml(t("board.law.unlockInstitutionValue", { institution: entityText(entry.institution) }))}</li>`;
  if (entry.kind === "enactment") return `<li class="law-effect-neutral">${escapeHtml(renderTextSpec(entry.label))}</li>`;
  const modifier = entry.modifier || entry;
  const label = modifierNameLabel(modifier);
  const value = modifierValueLabel(modifier);
  return `<li class="law-effect-neutral"><span>${escapeHtml(label)}</span>${value ? ` <strong class="law-effect-value ${lawEffectClassName(modifier)}">${escapeHtml(value)}</strong>` : ""}</li>`;
}

function lawEffectClassName(modifier) {
  const value = Number(modifier?.value);
  if (Number.isFinite(value) && value > 0) return "law-effect-positive";
  if (Number.isFinite(value) && value < 0) return "law-effect-negative";
  return "law-effect-neutral";
}

function lawAmendmentDetailsHtml(amendments) {
  if (!(amendments || []).length) return "";
  return `
    <h3>${t("board.law.amendments", "相关修正案")}</h3>
    <div class="law-amendment-list">
      ${amendments.map((amendment) => `
        <details class="law-amendment-card">
          <summary>${escapeHtml(entityText(amendment))}</summary>
          ${entityText(amendment, "description", "") ? `<p>${escapeHtml(cleanDescriptionText(entityText(amendment, "description", "")))}</p>` : ""}
          <dl class="field-grid">
            ${field(t("board.law.parentLaw", "上位法"), lawPill(lawByKey.get(amendment.parent_law) || { key: amendment.parent_law }))}
            ${field(t("board.law.allowedLaws", "适用法律"), lawPills(amendment.allowed_laws || []))}
          </dl>
          <h4>${t("board.law.effects", "效果")}</h4>
          ${lawEffectListHtml({ modifiers: amendment.modifiers || [] })}
          ${amendment.possible ? `<p>${escapeHtml(renderTextSpec({ message: amendment.possible.loc?.summary, fallback: t("board.law.scriptCondition", "脚本条件") }))}</p>` : ""}
          ${rawDetails(t("board.law.triggerCondition", "触发条件"), amendment.possible?.raw)}
        </details>
      `).join("")}
    </div>
  `;
}

function ideologyLawGroupPreviewHtml(ideology) {
  const groups = ideologyLawGroupRefs(ideology).slice(0, 6);
  if (!groups.length) return "";
  return `
    <span class="ideology-law-preview" aria-label="${escapeHtml(t("board.ideology.relatedLawGroups", "相关法律组"))}">
      ${groups.map((group) => `<span>${escapeHtml(entityText(group))}</span>`).join("")}
    </span>
  `;
}

function companyDetailLocationHtml(company) {
  if (!companyDetailLocationMapEnabled(company)) return "";
  const stateKeys = companyLocationStateRegionKeys(company);
  return `
    <section class="company-location-section" aria-label="${escapeHtml(t("board.company.locationAria"))}">
      <h3>${t("board.company.location", "位置")}</h3>
      ${stateKeys.length ? `
        <div class="company-location-map">
          <canvas data-company-location-map aria-label="${escapeHtml(t("board.company.locationMapAria", { name: entityText(company) || company.key }))}"></canvas>
        </div>
      ` : `<p class="empty">${t("board.company.noLocation", "暂无可定位地点。")}</p>`}
    </section>
  `;
}

function companyLocationFieldsHtml(company) {
  if (!companyDetailLocationMapEnabled(company)) return "";
  return `
    <dl class="field-grid company-location-fields">
      ${field(t("board.company.headquarters", "总部倾向"), stateRegionLinks(company.preferred_headquarters))}
      ${field(t("board.company.strategicRegions", "相关战略区域"), strategicRegionLinks(company.referenced_strategic_regions))}
      ${field(t("board.company.geographicRegions", "相关地理区域"), geographicRegionLinks(company.referenced_geographic_regions))}
      ${field(t("board.company.stateRegions", "相关地域"), stateRegionLinks(company.referenced_state_regions))}
    </dl>
  `;
}

function renderCompanyDetail(company) {
  if (!company) {
    els.detail.innerHTML = `<p class="empty">${t("board.company.empty", "没有匹配结果。")}</p>`;
    return;
  }
  els.detail.innerHTML = `
    <div class="detail-title">
      ${detailBackButton("company")}
      <div class="detail-title-main">
        <span class="company-icon-box">${companyIconHtml(company)}</span>
        <h2>${escapeHtml(entityText(company) || company.key)}</h2>
      </div>
      ${victorianCenturyBadge(company)}
    </div>

    <div class="company-detail-overview${companyDetailLocationMapEnabled(company) ? " has-location-map" : ""}">
      <section class="company-detail-base">
        <h3>${t("board.company.base", "基础")}</h3>
        <dl class="field-grid">
          ${field(t("board.company.type", "类型"), tagPill(companyKindText(company), companyKindKey(company) === "historical" ? "tag-special" : "tag-type"))}
          ${field(t("board.company.category", "控股类别"), companyCategoryLabel(company) ? tagPill(companyCategoryLabel(company), "tag-company-ownership", company.category, `company-ownership-category:${company.category}`) : "")}
          ${field(t("board.company.dlc", "资料片"), companyDlcIconPill(company) || tagPill(companyDlcLabel(company), "tag-dlc", companyDlcKey(company)))}
          ${field(t("board.company.prestige", "名贵商品状态"), tagPill(companyPrestigeLabel(company), "tag-good"))}
          ${field(t("board.company.relatedCultures", "相关文化"), cultureLinks(company.referenced_cultures))}
          ${field(t("board.company.relatedCountries", "相关国家"), countryLinks((company.referenced_countries || []).map((item) => item.tag), (company.referenced_countries || []).map((item) => entityText(item))))}
          ${field(t("board.company.requiredTechnologies", "所需科技"), technologyPills(company.required_technologies))}
          ${field(t("board.company.aiWillDoTechnologies", "AI 倾向科技"), technologyPills(company.ai_will_do_technologies))}
        </dl>
        ${companyLocationFieldsHtml(company)}
      </section>

      ${companyDetailLocationHtml(company)}
    </div>

    <h3>${t("board.company.operation", "经营")}</h3>
    <dl class="field-grid">
      ${field(t("board.company.primaryBuildings", "主营建筑"), buildingList(company.building_types, "tag-industry"))}
      ${field(t("board.company.expansionBuildings", "扩展建筑"), buildingList(company.extension_building_types, "extension-building-pill"))}
      ${field(t("board.company.prestigeGoods", "名贵商品"), companyPrestigeGoodsPills(company))}
      ${field(t("board.company.prosperityEffect", "繁荣效果"), modifierPills(company.prosperity_modifiers))}
    </dl>

    <h3>${t("board.company.scriptConditions", "条件脚本")}</h3>
    ${rawDetails(t("board.company.potentialCondition", "潜在条件"), company.potential_raw)}
    ${rawDetails(t("board.company.attainableCondition", "可见条件"), company.attainable_raw)}
    ${rawDetails(t("board.company.possibleCondition", "成立条件"), company.possible_raw)}
    ${rawDetails(t("board.company.prestigeGoodsCondition", "名贵商品条件"), company.prestige_goods_trigger_raw)}
    ${rawDetails(t("board.company.aiWillDoCondition", "AI 倾向条件"), company.ai_will_do_raw)}
    ${rawDetails(t("board.company.aiConstructionTargets", "AI 建造目标"), company.ai_construction_targets_raw)}
  `;
  queueMicrotask(() => renderCompanyDetailLocationMap(company));
}

function renderIdeologyDetail(ideology) {
  if (!ideology) {
    els.detail.innerHTML = `<p class="empty">${t("board.ideology.empty", "没有匹配结果。")}</p>`;
    return;
  }
  const typeKey = ideologyTypeKey(ideology);
  const related = relatedIdeologyUsage(ideology);
  const relatedGroups = ideologyInterestGroupRefs(ideology).slice(0, 8);
  const description = cleanIdeologyDescription(entityText(ideology, "description", ""));
  els.detail.innerHTML = `
    <article class="vic3-ideology-panel">
      <header class="vic3-ideology-header">
        ${detailBackButton("ideology")}
        <div class="vic3-ideology-title">
          ${ideologyIconHtml(ideology, "ideology-icon ideology-detail-icon")}
          <div>
            <h2>${escapeHtml(entityText(ideology))}</h2>
            <div class="vic3-ideology-meta">
              <span>${escapeHtml(ideologyTypeLabel(typeKey))}</span>
              <span>${escapeHtml(ideology.key)}</span>
              ${victorianCenturyBadge(ideology)}
            </div>
          </div>
        </div>
        <span class="vic3-ideology-kind">${t("board.ideology.title", "意识形态")}</span>
      </header>
      ${relatedGroups.length ? `
        <div class="vic3-ideology-interest-groups">
          ${relatedGroups.map((group) => `
            <span class="vic3-ig-icon" title="${escapeHtml(entityText(group))}">${interestGroupIconHtml(group)}</span>
          `).join("")}
        </div>
      ` : ""}
      ${lawStanceGroupsHtml(ideology)}
      ${description ? `<p class="vic3-ideology-desc">${escapeHtml(description)}</p>` : ""}
      ${ideologyUnlockTagsHtml(ideology)}
      ${ideologyRuleSourceLabel(ideology)}
      ${ideologyFlavorDefinitionHtml(ideology)}
      ${ideologyReplacementUsageHtml(related)}
      ${ideologyWeightSectionHtml(ideology)}
    </article>
  `;
}

function renderCountryDetail(country) {
  if (!country) {
    els.detail.innerHTML = `<p class="empty">${t("board.country.empty", "没有匹配结果。")}</p>`;
    return;
  }
  const primaryCultureNames = (country.primaryCultures || []).map((item) => entityText(byCulture.get(item.key) || item)).filter(Boolean);
  const capitalName = country.capital ? entityText(byStateRegion.get(country.capital), "name", country.capital) || country.capital : "";
  els.detail.innerHTML = `
    <div class="detail-title">
      ${detailBackButton("country")}
      <div class="detail-title-main">
        ${countryFlagIconHtml(country, "country-flag-title") || `<span class="country-color large" style="${colorStyle(country.colorHex)}" aria-hidden="true"></span>`}
        <h2>${escapeHtml(entityText(country))}</h2>
      </div>
      ${conceptTag(country.tag, "country", country.tag, entityText(country))}
      ${victorianCenturyBadge(country)}
    </div>

    <h3>${t("board.country.section.basic", "基础")}</h3>
    <dl class="field-grid">
      ${field(t("board.country.type", "国家类型"), tagPill(countryTypeTagLabel(country), "tag-type"))}
      ${field(t("board.country.tier", "国家位阶"), tagPill(countryTierLabel(country.tier), "tag-tier"))}
      ${field(t("board.country.standardColor", "标准色"), colorValue(country.colorHex, country.colorRgb))}
      ${field(t("board.country.unitColor", "部队颜色"), unitColorText(country))}
      ${field(t("board.country.primaryCulture", "主流文化"), linkedTerms(country.primaryCultures, primaryCultureNames, "culture"))}
      ${field(t("board.country.locationStrategicRegions", "所在战略区域"), strategicRegionLinks(country.locationStrategicRegions))}
      ${field(t("board.country.locationStateRegions", "所在地域"), stateRegionLinks(country.locationStateRegions))}
      ${field(t("board.country.primaryCultureHomelandStrategicRegions", "主流文化本土战略区域"), strategicRegionLinks(country.primaryCultureHomelandStrategicRegions))}
      ${field(t("board.country.heritage", "传承"), `<span class="grouped-trait-pills">${groupedTraitPills(country.primaryCultureHeritageGroups, country.primaryCultureHeritages, "tag-heritage-group", "tag-heritage")}</span>`)}
      ${field(t("board.country.language", "语言"), `<span class="grouped-trait-pills">${groupedTraitPills(country.primaryCultureLanguageGroups, country.primaryCultureLanguages, "tag-language-group", "tag-language")}</span>`)}
      ${field(t("board.country.tradition", "传统"), traitList(country.primaryCultureTraditions))}
      ${field(t("board.country.religion", "宗教"), linkedTerms([country.religion], [entityText(country.religion)], "religion") + sourceSuffix(country.religionSource))}
      ${field(t("board.country.capital", "首都"), stateRegionLinks(country.capital ? [byStateRegion.get(country.capital) || { key: country.capital, id: `state_region:${country.capital}` }] : []))}
    </dl>

    ${collapsibleDetailSection(t("board.country.interestGroupFlavor", "利益集团风味"), interestGroupFlavorList(country.interestGroups), t("board.country.groupCount", "{count} 组", { count: (country.interestGroups || []).length }))}

    <h3>${t("board.country.section.dynamicNames", "国名变体")}</h3>
    ${dynamicNameList(country)}

    <h3>${t("board.country.section.mapColors", "地图色")}</h3>
    ${dynamicMapColorList(country)}

    ${countryFlagVariantSection(country)}

    <h3>${t("board.country.section.start", "开局")}</h3>
    <dl class="field-grid">
      ${field(t("board.country.existsAtStart", "开局存在"), localizedBoolean(country.existsAtStart))}
      ${field(t("board.country.startingStateCount", "开局州数"), String(country.startingStateCount))}
      ${field(t("board.country.startingStates", "开局州"), countryStartingStateRegionLinks(country))}
      ${field(t("board.country.historyFile", "历史文件"), localizedBoolean(country.hasHistoryCountryFile))}
    </dl>

    <h3>${t("board.country.section.formation", "成立")}</h3>
    <dl class="field-grid">
      ${field(t("board.country.isMinorFormable", "次要统一"), localizedBoolean(country.isMinorFormable))}
      ${field(t("board.country.isMajorFormable", "重大统一"), localizedBoolean(country.isMajorFormable))}
      ${field(t("board.country.specialMechanic", "特殊机制"), renderTextSpec({ message: country.specialMechanic, fallback: "" }))}
      ${field(t("board.country.canForm", "同文化可成立"), countryLinks(country.canFormTags))}
      ${field(t("board.country.formationCultures", "成立文化"), cultureLinks((country.formationRequiredCultures || []).map((key) => byCulture.get(key) || { key, id: `culture:${key}` })))}
      ${field(t("board.country.formationStrategicRegions", "成立范围战略区域"), strategicRegionLinks(country.formationStrategicRegions))}
      ${field(t("board.country.formationStateRegions", "成立范围地域"), stateRegionLinks(country.formationStateRegions))}
      ${field(t("board.country.formationStates", "规则直接列州"), stateRegionLinks((country.formationStates || []).map((key) => byStateRegion.get(key) || { key, id: `state_region:${key}` })))}
      ${field(t("board.country.formationRegion", "成立地区"), escapeHtml(country.formationRegion || ""))}
    </dl>

    <h3>${t("board.country.section.release", "释放")}</h3>
    <dl class="field-grid">
      ${field(t("board.country.isReleasable", "可释放"), localizedBoolean(country.isReleasable))}
      ${field(t("board.country.releaseStates", "释放州"), stateRegionLinks((country.releaseStates || []).map((key) => byStateRegion.get(key) || { key, id: `state_region:${key}` })))}
    </dl>
  `;
}
function renderCountryDetailPage(country) {
  renderCountryDetail(country);
}

function detailBackButton(view = state.view) {
  const target = view === "region" ? "region" : view || "country";
  const label = viewLabel(target);
  const mobileBackAttribute = target === "country" ? " data-country-mobile-detail-back" : target === "culture" ? " data-culture-mobile-detail-back" : "";
  return `<button class="detail-back-button" type="button" data-detail-back="${escapeHtml(target)}"${mobileBackAttribute} aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"><img class="lucide-icon" src="assets/lucide/icons/arrow-left.svg" alt="" aria-hidden="true"></button>`;
}

function rowDetailButton(attributeName, key) {
  const label = t("ui.openDetail");
  return `<button class="row-detail-button" type="button" ${attributeName}="${escapeHtml(key)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"><img class="lucide-icon" src="assets/lucide/icons/arrow-right.svg" alt="" aria-hidden="true"></button>`;
}

function renderCultureDetail(culture) {
  if (!culture) {
    els.detail.innerHTML = `<p class="empty">${t("board.culture.empty", "没有匹配结果。")}</p>`;
    return;
  }
  const relatedCountryNames = (culture.related_countries || []).map((countryRef) => entityText(byTag.get(countryRef.tag) || countryRef)).filter(Boolean);
  els.detail.innerHTML = `
    <section class="culture-detail">
    <div class="detail-title">
      ${detailBackButton("culture")}
      <div class="detail-title-main">
        <span class="country-color large" style="${colorStyle(culture.color?.hex)}" aria-hidden="true"></span>
        <h2>${escapeHtml(entityText(culture) || culture.key)}</h2>
      </div>
      ${conceptTag(culture.key, "culture", culture.key, entityText(culture))}
      ${victorianCenturyBadge(culture)}
    </div>

    <h3>${t("board.culture.section.basic", "基础")}</h3>
    <dl class="field-grid">
      ${field(t("board.culture.color", "颜色"), colorValue(culture.color?.hex, culture.color?.rgb))}
      ${field(t("board.culture.defaultReligion", "默认宗教"), linkedTerms([culture.religion?.key], [entityText(culture.religion)], "religion"))}
      ${field(t("board.culture.heritage", "传承"), `<span class="grouped-trait-pills">${groupedTraitPills(compactRefs([culture.heritage_group]), compactRefs([culture.heritage]), "tag-heritage-group", "tag-heritage")}</span>`)}
      ${field(t("board.culture.language", "语言"), `<span class="grouped-trait-pills">${groupedTraitPills(compactRefs([culture.language_group]), compactRefs([culture.language]), "tag-language-group", "tag-language")}</span>`)}
      ${field(t("board.culture.tradition", "传统"), traitList(culture.traditions))}
      ${field(t("board.culture.homelandStrategicRegions", "本土战略区域"), strategicRegionLinks(culture.homeland_strategic_regions))}
      ${field(t("board.culture.homelandStateRegions", "本土地域"), stateRegionLinks(culture.homeland_state_regions))}
    </dl>

    <h3>${t("board.culture.section.consumption", "消费")}</h3>
    <dl class="field-grid">
      ${field(t("board.culture.obsessions", "痴迷"), goodsList(culture.obsessions))}
      ${field(t("board.culture.taboos", "禁忌"), goodsList(culture.taboos))}
    </dl>

    <h3>${t("board.culture.section.related", "关联")}</h3>
    <dl class="field-grid">
      ${field(t("board.culture.relatedCountries", "相关国家"), countryLinks((culture.related_countries || []).map((countryRef) => countryRef.tag), relatedCountryNames))}
      ${field(t("board.culture.sameHeritageGroupCultures", "同传承组文化"), cultureLinks(culture.same_heritage_group_cultures))}
      ${field(t("board.culture.sameHeritageCultures", "同传承文化"), cultureLinks(culture.same_heritage_cultures))}
      ${field(t("board.culture.sameLanguageGroupCultures", "同语言组文化"), cultureLinks(culture.same_language_group_cultures))}
      ${field(t("board.culture.sameLanguageCultures", "同语言文化"), cultureLinks(culture.same_language_cultures))}
      ${field(t("board.culture.sameTraditionCultures", "同传统文化"), sameTraditionCultures(culture.traditions, culture.same_tradition_cultures))}
    </dl>
    </section>
  `;
}
function renderStateRegionDetail(stateRegion) {
  const relatedCompanies = companiesForStateRegion(stateRegion);
  els.detail.innerHTML = `
    <div class="detail-title">
      ${detailBackButton("region")}
      <div class="detail-title-main">
        <h2>${stateRegionNameText(stateRegion)}</h2>
      </div>
      ${conceptTag(stateRegion.key, "stateRegion", stateRegion.key, entityText(stateRegion))}
      ${victorianCenturyBadge(stateRegion)}
    </div>
    <h3>${t("board.region.base", "基础")}</h3>
    <dl class="field-grid">
      ${field(t("board.region.strategicRegion", "战略区域"), strategicRegionLinks(stateRegion.strategic_regions))}
      ${field(t("board.region.startingOwners", "开局归属"), countryLinks((stateRegion.starting_owners || []).map((country) => country.tag), (stateRegion.starting_owners || []).map((country) => entityText(country))))}
      ${field(t("board.region.homelandCultures", "本土文化"), cultureLinks(stateRegion.homeland_cultures))}
      ${field(t("board.region.traits", "地区特质"), stateTraitPills(stateRegion.traits, stateRegion))}
      ${field(t("board.region.resourcePotential", "固定资源"), cappedResourceList(stateRegion.capped_resources))}
      ${field(t("board.region.discoverableResources", "可发现资源"), discoverableResourceList(stateRegion.discoverable_resources))}
      ${field(t("board.region.buildings", "农业建筑"), buildingList(stateRegion.arable_resources))}
      ${field(t("board.region.arableLand", "耕地"), stateRegion.arable_land === null ? "" : String(stateRegion.arable_land))}
    </dl>
    <h3>${t("board.region.relatedCompanies", "相关公司")}</h3>
    <dl class="field-grid">
      ${field(t("board.region.headquartersPreference", "总部倾向"), companyAssociationLinks(relatedCompanies.filter((item) => item.kind === "headquarters")))}
      ${field(t("board.region.reference", "条件引用"), companyAssociationLinks(relatedCompanies.filter((item) => item.kind === "special")))}
    </dl>
    <h3>${t("board.region.effects", "地区特质效果")}</h3>
    ${stateTraitEffectList(stateRegion.traits)}
    <h3>${t("board.region.nameVariants", "名称变体")}</h3>
    ${dynamicStateNameList(stateRegion)}
  `;
}

function renderStrategicRegionDetail(region) {
  const regionKind = isSeaStrategicRegion(region) ? t("board.region.sea", "海域") : t("board.region.strategicRegion", "战略区域");
  els.detail.innerHTML = `
    <div class="detail-title">
      ${detailBackButton("region")}
      <div class="detail-title-main">
        <span class="country-color large" style="${colorStyle(region.map_color?.hex)}" aria-hidden="true"></span>
        <h2>${escapeHtml(strategicRegionName(region))}</h2>
      </div>
      ${conceptTag(region.key, "strategicRegion", region.key, strategicRegionName(region))}
      ${victorianCenturyBadge(region)}
    </div>
    <h3>${t("board.region.base", "基础")}</h3>
    <dl class="field-grid">
      ${field(t("board.region.type", "类型"), tagPill(regionKind, isSeaStrategicRegion(region) ? "tag-sea" : "tag-region"))}
      ${field(t("board.region.color", "颜色"), colorValue(region.map_color?.hex, region.map_color?.rgb))}
      ${field(t("board.region.stateRegion", "地域"), stateRegionLinks(region.states))}
      ${field(t("board.region.homelandCultures", "本土文化"), cultureLinks(region.homeland_cultures))}
      ${field(t("board.region.startingOwners", "开局国家"), countryLinks((region.starting_owners || []).map((country) => country.tag), (region.starting_owners || []).map((country) => entityText(country))))}
    </dl>
  `;
}

function renderGeographicRegionDetail(region) {
  const stateRefs = geographicRegionStateRegions(region);
  const strategicRefs = geographicRegionStrategicRegions(region);
  const startingOwners = uniqueByTag(stateRefs.flatMap((stateRegion) => stateRegion.starting_owners || []));
  const homelandCultures = uniqueByKey(stateRefs.flatMap((stateRegion) => stateRegion.homeland_cultures || []));
  els.detail.innerHTML = `
    <div class="detail-title">
      ${detailBackButton("region")}
      <div class="detail-title-main">
        <h2>${escapeHtml(geographicRegionDisplayName(region))}</h2>
      </div>
      ${conceptTag(region.key, "geographicRegion", region.key, geographicRegionDisplayName(region))}
      ${victorianCenturyBadge(region)}
    </div>
    <h3>${t("board.region.base", "基础")}</h3>
    <dl class="field-grid">
      ${field(t("board.region.type", "类型"), tagPill(t("board.region.geographicRegion", "地理区域"), "tag-region"))}
      ${field(t("board.region.group", "分组"), tagPill(t(`enum.geographicRegionGroup.${region.geographic_region_group}`) || region.geographic_region_group, "tag-muted"))}
      ${field(t("board.region.strategicRegion", "战略区域"), strategicRegionLinks(strategicRefs))}
      ${field(t("board.region.stateRegion", "地域"), stateRegionLinks(stateRefs))}
      ${field(t("board.region.count", "地域数量"), escapeHtml(String(stateRefs.length)))}
      ${field(t("board.region.startingOwners", "开局国家"), countryLinks(startingOwners.map((country) => country.tag), startingOwners.map((country) => entityText(country))))}
      ${field(t("board.region.homelandCultures", "本土文化"), cultureLinks(homelandCultures))}
    </dl>
    <h3>${t("board.region.source", "来源")}</h3>
    <dl class="field-grid">
      ${field(t("board.region.file", "文件"), escapeHtml(region.source_file || ""))}
    </dl>
  `;
}
