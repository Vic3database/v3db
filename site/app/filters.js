function matchesCountryFilters(country) {
  if (state.omitDecentralizedTags && country.countryType === "decentralized") return false;
  if (state.flags.size > 0) {
    for (const key of state.flags) {
      if (key === "isCivilWar") {
        if (!countryCivilWarMatch(country)) return false;
      } else if (country[key] !== "是") return false;
    }
  }
  if (state.tiers.size > 0 && !state.tiers.has(country.tier)) return false;
  if (state.types.size > 0 && !state.types.has(country.countryType)) return false;
  if (!matchesRefSet(state.strategicRegions, country.locationStrategicRegions)) return false;
  if (!matchesRefSet(state.heritageGroups, country.primaryCultureHeritageGroups)) return false;
  if (!matchesRefSet(state.heritages, country.primaryCultureHeritages)) return false;
  if (!matchesRefSet(state.languageGroups, country.primaryCultureLanguageGroups)) return false;
  if (!matchesRefSet(state.languages, country.primaryCultureLanguages)) return false;
  if (state.tradition && !(country.primaryCultureTraditions || []).some((trait) => trait.key === state.tradition)) return false;
  return matchesSearchBlob(countrySearchBlob(country));
}

function countryCivilWarMatch(country) {
  if (country.isCivilWar || country.is_civil_war || country.civil_war) return true;
  return /civil_war/i.test([country.tag, country.name, country.name_zh, country.key].filter(Boolean).join(" "));
}

function isIndigenousCulture(culture) {
  return [culture?.heritage_group?.key, culture?.heritage?.group_key]
    .filter(Boolean)
    .some((key) => key === "heritage_group_indigenous_american" || key === "heritage_group_indigenous_oceanic");
}

function matchesCultureFilters(culture) {
  if (state.omitIndigenousLanguagesCultures && isIndigenousCulture(culture)) return false;
  if (!matchesRefSet(state.strategicRegions, culture.homeland_strategic_regions)) return false;
  if (!matchesRefSet(state.heritageGroups, compactRefs([culture.heritage_group]))) return false;
  if (!matchesRefSet(state.heritages, compactRefs([culture.heritage]))) return false;
  if (!matchesRefSet(state.languageGroups, compactRefs([culture.language_group]))) return false;
  if (!matchesRefSet(state.languages, compactRefs([culture.language]))) return false;
  if (state.tradition && !(culture.traditions || []).some((trait) => trait.key === state.tradition)) return false;
  return matchesSearchBlob(cultureSearchBlob(culture));
}

function matchesStateRegionFilters(stateRegion) {
  if (!matchesRefSet(state.strategicRegions, stateRegion.strategic_regions)) return false;
  if (state.view === "region" && state.selectedGeographicRegion) {
    const region = byGeographicRegion.get(state.selectedGeographicRegion);
    if (region) {
      const stateKeys = new Set(geographicRegionStateRegions(region).map((item) => item.key));
      if (!stateKeys.has(stateRegion.key)) return false;
    }
  }
  if (!matchesResourceFilters(stateRegion)) return false;
  return matchesSearchBlob(stateRegionSearchBlob(stateRegion));
}

function matchesStrategicRegionFilters(region) {
  if (state.strategicRegions.size > 0 && !state.strategicRegions.has(region.key)) return false;
  if (state.resourceFilters.size > 0 && !strategicRegionHasMatchingResource(region)) return false;
  return matchesSearchBlob(strategicRegionSearchBlob(region));
}

function matchesGeographicRegionFilters(region) {
  if (region.is_current_strategic_region) return false;
  if (state.strategicRegions.size > 0 && !geographicRegionStrategicRegionKeys(region).some((key) => state.strategicRegions.has(key))) return false;
  if (state.resourceFilters.size > 0 && !geographicRegionStateRegions(region).some(matchesResourceFilters)) return false;
  return matchesSearchBlob(geographicRegionSearchBlob(region));
}

function matchesCompanyFilters(company) {
  if (!matchesRefSet(state.strategicRegions, company.referenced_strategic_regions)) return false;
  if (!matchesCompanyGeographicRegionFilter(company)) return false;
  if (!matchesCompanyResourceFilters(company)) return false;
  if (!matchesCompanyKindFilters(company)) return false;
  if (!matchesCompanyPrestigeFilters(company)) return false;
  if (!matchesCompanyDlcFilters(company)) return false;
  return matchesSearchBlob(companySearchBlob(company));
}

function matchesCompanyGeographicRegionFilter(company) {
  if (state.view !== "company" || !state.selectedGeographicRegion) return true;
  const region = byGeographicRegion.get(state.selectedGeographicRegion);
  if (!region) return true;
  const companyGeographicKeys = new Set((company.referenced_geographic_regions || []).map((item) => item.key).filter(Boolean));
  if (companyGeographicKeys.has(region.key)) return true;
  const stateKeys = new Set(geographicRegionStateRegions(region).map((item) => item.key));
  const companyStateKeys = new Set((company.referenced_state_regions || []).map((item) => item.key).filter(Boolean));
  if ([...companyStateKeys].some((key) => stateKeys.has(key))) return true;
  const strategicKeys = new Set(geographicRegionStrategicRegionKeys(region));
  const companyStrategicKeys = new Set((company.referenced_strategic_regions || []).map((item) => item.key).filter(Boolean));
  return [...companyStrategicKeys].some((key) => strategicKeys.has(key));
}

function matchesIdeologyFilters(ideology) {
  if (!matchesCommonLawAndIdeologyFilter(ideology, "ideology")) return false;
  if (state.ideologyTypes.size > 0 && !state.ideologyTypes.has(ideologyTypeKey(ideology))) return false;
  if (!matchesRefSet(state.ideologyGroups, ideologyInterestGroupRefs(ideology))) return false;
  if (!matchesRefSet(state.ideologyOccurrences, ideologyOccurrenceRefs(ideology))) return false;
  if (!matchesRefSet(state.ideologyLawGroups, ideologyLawGroupRefs(ideology))) return false;
  return matchesSearchBlob(ideologySearchBlob(ideology));
}

function matchesLawFilters(law) {
  if (!matchesCommonLawAndIdeologyFilter(law, "law")) return false;
  if (state.lawGroups.size > 0 && !state.lawGroups.has(law.group_key)) return false;
  return matchesSearchBlob(lawSearchBlob(law));
}

function matchesSearchBlob(blob) {
  const value = String(blob || "");
  if (state.search && !value.includes(state.search)) return false;
  return true;
}

function matchesCompanyKindFilters(company) {
  if (state.companyKinds.size === 0) return true;
  return state.companyKinds.has(companyKindKey(company));
}

function matchesCompanyPrestigeFilters(company) {
  if (state.companyPrestigeGoods.size === 0) return true;
  for (const key of state.companyPrestigeGoods) {
    if (key === "any" && (company.possible_prestige_goods || []).length > 0) return true;
    if (key === "none" && (company.possible_prestige_goods || []).length === 0) return true;
    if (key === prestigeGoodsKindKey(company)) return true;
  }
  return false;
}

function matchesCompanyDlcFilters(company) {
  if (state.companyDlcs.size === 0) return true;
  return state.companyDlcs.has(companyDlcKey(company));
}

function matchesHomelandCultureFilters(cultureRefs) {
  if (!hasCultureTraitFilters()) return true;
  return (cultureRefs || []).some((cultureRef) => {
    const culture = byCulture.get(cultureRef.key);
    if (!culture) return false;
    if (!matchesRefSet(state.heritageGroups, compactRefs([culture.heritage_group]))) return false;
    if (!matchesRefSet(state.heritages, compactRefs([culture.heritage]))) return false;
    if (!matchesRefSet(state.languageGroups, compactRefs([culture.language_group]))) return false;
    if (!matchesRefSet(state.languages, compactRefs([culture.language]))) return false;
    if (state.tradition && !(culture.traditions || []).some((trait) => trait.key === state.tradition)) return false;
    return true;
  });
}

function hasCultureTraitFilters() {
  return state.heritageGroups.size > 0
    || state.heritages.size > 0
    || state.languageGroups.size > 0
    || state.languages.size > 0
    || Boolean(state.tradition);
}

function matchingHomelandCulturesForFilters(stateRegion) {
  if (!hasCultureTraitFilters()) return [];
  return (stateRegion.homeland_cultures || [])
    .map((cultureRef) => byCulture.get(cultureRef.key))
    .filter(Boolean)
    .filter(matchesCultureTraitSelection)
    .sort(sortCultures);
}

function matchesCultureTraitSelection(culture) {
  if (!matchesRefSet(state.heritageGroups, compactRefs([culture.heritage_group]))) return false;
  if (!matchesRefSet(state.heritages, compactRefs([culture.heritage]))) return false;
  if (!matchesRefSet(state.languageGroups, compactRefs([culture.language_group]))) return false;
  if (!matchesRefSet(state.languages, compactRefs([culture.language]))) return false;
  if (state.tradition && !(culture.traditions || []).some((trait) => trait.key === state.tradition)) return false;
  return true;
}

function matchesResourceFilters(stateRegion) {
  if (state.resourceFilters.size === 0) return true;
  for (const key of state.resourceFilters) {
    const filter = resourceFilterByKey.get(key);
    if (filter && stateRegionMatchesResourceFilter(stateRegion, filter)) return true;
  }
  return false;
}

function matchesCompanyResourceFilters(company) {
  if (state.resourceFilters.size === 0) return true;
  for (const key of state.resourceFilters) {
    const filter = resourceFilterByKey.get(key);
    if (filter && companyMatchesResourceFilter(company, filter)) return true;
  }
  return false;
}

function companyMatchesResourceFilter(company, filter) {
  const mainBuildingKeys = new Set((company.building_types || []).map((item) => item.key));
  const extensionBuildingKeys = new Set((company.extension_building_types || []).map((item) => item.key));
  return resourceFilterBuildingKeys(filter).some((key) => (
    mainBuildingKeys.has(key) || (state.includeIndustryCharter && extensionBuildingKeys.has(key))
  ));
}

function resourceFilterBuildingKeys(filter) {
  return [...(filter.resources || []), ...(filter.arableResources || []), ...(filter.companyBuildings || [])];
}

function strategicRegionHasMatchingResource(region) {
  return (region.states || []).some((stateRef) => {
    const stateRegion = byStateRegion.get(stateRef.key);
    return stateRegion && matchesResourceFilters(stateRegion);
  });
}

function stateRegionMatchesResourceFilter(stateRegion, filter) {
  if (filter.arableResources) {
    const resourceKeys = new Set(filter.arableResources || []);
    return (stateRegion.arable_resources || []).some((item) => resourceKeys.has(item.key));
  }
  const resourceKeys = new Set(filter.resources || []);
  return stateRegionResourceKeys(stateRegion).some((key) => resourceKeys.has(key));
}

function stateRegionResourceKeys(stateRegion) {
  return [
    ...(stateRegion.capped_resources || []),
    ...(stateRegion.discoverable_resources || []),
  ].map((item) => item.key).filter(Boolean);
}

function sortCountries(a, b) {
  if (state.sort === "name") return a.name.localeCompare(b.name, "zh-Hans-CN") || a.tag.localeCompare(b.tag);
  if (state.sort === "tier") return Number(b.tierPrestige || 0) - Number(a.tierPrestige || 0) || a.tag.localeCompare(b.tag);
  if (state.sort === "states") return b.startingStateCount - a.startingStateCount || a.tag.localeCompare(b.tag);
  return a.tag.localeCompare(b.tag);
}

function sortCultures(a, b) {
  if (state.sort === "name") return a.name_zh.localeCompare(b.name_zh, "zh-Hans-CN") || a.key.localeCompare(b.key);
  if (state.sort === "homelands") return (b.homeland_state_regions || []).length - (a.homeland_state_regions || []).length || a.key.localeCompare(b.key);
  return a.key.localeCompare(b.key);
}

function sortStateRegions(a, b) {
  if (state.view === "region" && state.resourceFilters.size > 0) {
    return selectedResourceValue(b) - selectedResourceValue(a)
      || firstStrategicRegionOrder(a) - firstStrategicRegionOrder(b)
      || Number(a.numeric_id || Number.MAX_SAFE_INTEGER) - Number(b.numeric_id || Number.MAX_SAFE_INTEGER)
      || a.key.localeCompare(b.key);
  }
  if (state.sort === "name") return a.name_zh.localeCompare(b.name_zh, "zh-Hans-CN") || a.key.localeCompare(b.key);
  if (state.sort === "region") {
    return firstStrategicRegionOrder(a) - firstStrategicRegionOrder(b)
      || Number(a.numeric_id || Number.MAX_SAFE_INTEGER) - Number(b.numeric_id || Number.MAX_SAFE_INTEGER)
      || a.key.localeCompare(b.key);
  }
  if (state.sort === "resources") return stateRegionResourceCount(b) - stateRegionResourceCount(a) || a.key.localeCompare(b.key);
  return Number(a.numeric_id || Number.MAX_SAFE_INTEGER) - Number(b.numeric_id || Number.MAX_SAFE_INTEGER) || a.key.localeCompare(b.key);
}

function sortGeographicRegions(a, b) {
  if (state.sort === "name") return geographicRegionDisplayName(a).localeCompare(geographicRegionDisplayName(b), "zh-Hans-CN") || a.key.localeCompare(b.key);
  if (state.sort === "region") {
    return firstGeographicStrategicRegionOrder(a) - firstGeographicStrategicRegionOrder(b)
      || geographicRegionDisplayName(a).localeCompare(geographicRegionDisplayName(b), "zh-Hans-CN")
      || a.key.localeCompare(b.key);
  }
  if (state.sort === "resources") return geographicRegionStateRegions(b).length - geographicRegionStateRegions(a).length || a.key.localeCompare(b.key);
  return a.key.localeCompare(b.key);
}

function firstGeographicStrategicRegionOrder(region) {
  const values = geographicRegionStrategicRegionKeys(region).map((key) => orderValue(strategicRegionOrderByKey, key));
  return Math.min(...values, Number.MAX_SAFE_INTEGER);
}

function selectedResourceValue(stateRegion) {
  let total = 0;
  for (const key of state.resourceFilters) {
    const filter = resourceFilterByKey.get(key);
    const resourceKey = (filter?.resources || filter?.arableResources || [])[0] || key;
    total += Number(stateRegionResourceValue(stateRegion, resourceKey).value || 0);
  }
  return total;
}

function sortCompanies(a, b) {
  if (state.sort === "name") return (a.name_zh || a.key).localeCompare(b.name_zh || b.key, "zh-Hans-CN") || a.key.localeCompare(b.key);
  if (state.sort === "kind") return Number(b.flavored_company) - Number(a.flavored_company) || a.key.localeCompare(b.key);
  if (state.sort === "buildings") {
    return ((b.building_types || []).length + (b.extension_building_types || []).length)
      - ((a.building_types || []).length + (a.extension_building_types || []).length)
      || a.key.localeCompare(b.key);
  }
  return a.key.localeCompare(b.key);
}

function sortIdeologies(a, b) {
  if (state.sort === "name") return (a.name_zh || a.key).localeCompare(b.name_zh || b.key, "zh-Hans-CN") || a.key.localeCompare(b.key);
  if (state.sort === "type") {
    return orderValue(ideologyTypeOrder, ideologyTypeKey(a)) - orderValue(ideologyTypeOrder, ideologyTypeKey(b))
      || (a.name_zh || a.key).localeCompare(b.name_zh || b.key, "zh-Hans-CN")
      || a.key.localeCompare(b.key);
  }
  if (state.sort === "laws") return lawStanceCount(b) - lawStanceCount(a) || a.key.localeCompare(b.key);
  return a.key.localeCompare(b.key);
}

function renderLawDetail(law) {
  if (!law) {
    els.detail.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  const group = lawGroupByKey.get(law.group_key);
  const stances = lawIdeologyStances(law);
  els.detail.innerHTML = `
    <div class="detail-title law-detail-title">
      ${detailBackButton("law")}
      <div class="detail-title-main">
        ${lawIconHtml(law, "law-icon law-detail-icon")}
      <h2>${escapeHtml(lawDisplayName(law))}</h2>
      </div>
      <span class="tag">${escapeHtml(law.key)}</span>
    </div>
    <h3>基础</h3>
    <dl class="field-grid">
      ${field("法律组", tagPill(group?.name_zh || law.group_name_zh || law.group_key, "tag-type", law.group_key))}
      ${field("进步度", lawProgressivenessLabel(law.progressiveness))}
      ${field("前置科技", refItemsPills(law.unlocking_technologies, "technology", "tag-technology"))}
      ${field("互斥法律", lawPills(law.disallowing_laws || []))}
      ${field("来源文件", escapeHtml(fileBaseName(law.source_file)))}
    </dl>
    <h3>效果</h3>
    ${lawEffectListHtml(law)}
    ${lawAmendmentDetailsHtml(law.amendments)}
    <h3>意识形态态度</h3>
    ${lawIdeologyStanceHtml(stances)}
    <h3>条件脚本</h3>
    ${rawDetails("可见条件", law.is_visible?.raw)}
    ${rawDetails("颁布条件", law.can_enact?.raw)}
    ${rawDetails("法律组启用条件", group?.enable?.raw)}
    ${rawDetails("法律组变更条件", group?.change_allowed_trigger?.raw)}
  `;
}

function lawIdeologyStances(law) {
  const lawKey = lawStanceSourceKey(law);
  const grouped = new Map();
  for (const ideology of ideologies) {
    const stance = (ideology.law_stances || []).find((item) => item.law_key === lawKey);
    if (!stance) continue;
    if (!grouped.has(stance.stance)) grouped.set(stance.stance, []);
    grouped.get(stance.stance).push(ideology);
  }
  for (const items of grouped.values()) items.sort(sortIdeologyRefsByType);
  return grouped;
}

function lawStanceSourceKey(law) {
  const visited = new Set();
  let current = law;
  while (current?.parent && !visited.has(current.key)) {
    visited.add(current.key);
    current = lawByKey.get(current.parent);
  }
  return current?.key || law?.key || "";
}

function lawIdeologyStanceHtml(grouped) {
  const blocks = lawStanceDisplayOrder.map((stance) => {
    const items = grouped.get(stance) || [];
    if (!items.length) return "";
    return `
      <section class="law-ideology-stance ${lawStanceClassName(stance)}">
        <h4>${escapeHtml(lawStanceSentencePrefix(stance))}</h4>
        ${ideologyPillGroups(items, `tag-ideology ${lawStanceClassName(stance)}`)}
      </section>
    `;
  }).filter(Boolean).join("");
  return blocks ? `<div class="law-ideology-stance-list">${blocks}</div>` : `<p class="empty compact">没有意识形态态度数据。</p>`;
}

function sortLaws(a, b) {
  return Number(a.sort_order ?? Number.MAX_SAFE_INTEGER) - Number(b.sort_order ?? Number.MAX_SAFE_INTEGER)
    || a.key.localeCompare(b.key);
}

function sortCountriesByTag(a, b) {
  return a.tag.localeCompare(b.tag);
}

function renderSortOptions() {
  const options = state.view === "culture"
    ? [
      ["key", "按 Key"],
      ["name", "按名称"],
      ["homelands", "按本土州数"],
    ]
    : state.view === "region"
      ? [
        ["key", "按州编号"],
        ["name", "按名称"],
        ["region", "按战略区域"],
        ["resources", "按资源项数"],
      ]
      : state.view === "company"
        ? [
          ["key", "按 Key"],
          ["name", "按名称"],
          ["kind", "按类型"],
          ["buildings", "按建筑数"],
        ]
        : state.view === "ideology"
          ? [
            ["key", "按编号"],
            ["name", "按名称"],
            ["type", "按类型"],
          ]
          : state.view === "law"
            ? [["key", "游戏内顺序"]]
    : [
      ["key", "按 Tag"],
      ["name", "按名称"],
      ["tier", "按位阶"],
      ["states", "按开局州数"],
    ];
  if (!options.some(([key]) => key === state.sort)) state.sort = options[0][0];
  els.sortSelect.innerHTML = options.map(([key, label]) => (
    `<option value="${key}"${state.sort === key ? " selected" : ""}>${escapeHtml(label)}</option>`
  )).join("");
}

function collectCultureRefs(getter, sorter = sortRefByName, sourceCultures = cultures) {
  const map = new Map();
  for (const culture of sourceCultures) {
    const value = getter(culture);
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      if (!item?.key || map.has(item.key)) continue;
      map.set(item.key, item);
    }
  }
  return [...map.values()].sort(sorter);
}

function renderDependentFilterOptions() {
  const filterCultures = state.omitIndigenousLanguagesCultures
    ? cultures.filter((culture) => !isIndigenousCulture(culture))
    : cultures;
  const heritageGroups = collectCultureRefs((culture) => culture.heritage_group, sortHeritageGroupRef, filterCultures);
  const languageGroups = collectCultureRefs((culture) => culture.language_group, sortLanguageGroupRef, filterCultures);
  const heritages = collectCultureRefs((culture) => culture.heritage, sortRefByName, filterCultures)
    .filter((trait) => !state.heritageGroups.size || state.heritageGroups.has(trait.group_key));
  const languages = collectCultureRefs((culture) => culture.language, sortRefByName, filterCultures)
    .filter((trait) => !state.languageGroups.size || state.languageGroups.has(trait.group_key));

  syncSetWithOptions(state.heritages, heritages);
  syncSetWithOptions(state.languages, languages);

  renderGroupedFilterOptions({
    container: els.heritageGroupFilters,
    groups: heritageGroups,
    traits: heritages,
    selectedGroups: state.heritageGroups,
    selectedTraits: state.heritages,
    groupKind: "heritage-group",
    traitKind: "heritage",
  });
  renderGroupedFilterOptions({
    container: els.languageGroupFilters,
    groups: languageGroups,
    traits: languages,
    selectedGroups: state.languageGroups,
    selectedTraits: state.languages,
    groupKind: "language-group",
    traitKind: "language",
  });
  if (els.heritageFilters) els.heritageFilters.innerHTML = "";
  if (els.languageFilters) els.languageFilters.innerHTML = "";
}

function renderGroupedFilterOptions({ container, groups, traits, selectedGroups, selectedTraits, groupKind, traitKind }) {
  const traitsByGroup = new Map();
  for (const trait of traits || []) {
    if (!trait?.group_key) continue;
    if (!traitsByGroup.has(trait.group_key)) traitsByGroup.set(trait.group_key, []);
    traitsByGroup.get(trait.group_key).push(trait);
  }
  container.innerHTML = (groups || []).map((group) => {
    const groupTraits = traitsByGroup.get(group.key) || [];
    const singleTraitClass = groupKind === "language-group" && groupTraits.length === 1 ? " filter-single-trait" : "";
    return `
      <div class="filter-row filter-group-block${singleTraitClass}">
        <div class="filter-row-label">${optionToken(groupKind, group.key, group.name_zh || group.key, selectedGroups.has(group.key), "filter-token-group")}</div>
        <span class="filter-row-items">
          ${groupTraits.map((trait) => (
            optionToken(traitKind, trait.key, trait.name_zh || trait.key, selectedTraits.has(trait.key))
          )).join("")}
        </span>
      </div>
    `;
  }).join("");
}

function renderStrategicRegionFilterOptions() {
  const regionKeys = state.view === "culture"
    ? new Set(cultures.flatMap((culture) => (culture.homeland_strategic_regions || []).map((region) => region.key)))
    : state.view === "region"
      ? new Set(landStrategicRegions.map((region) => region.key))
      : state.view === "company"
        ? new Set(companies.flatMap((company) => (company.referenced_strategic_regions || []).map((region) => region.key)))
        : new Set(countries.flatMap((country) => (country.locationStrategicRegions || []).map((region) => region.key)));
  const options = strategicRegions
    .filter((region) => regionKeys.has(region.key) && !isSeaStrategicRegion(region))
    .sort(sortStrategicRegionRef);
  syncSetWithOptions(state.strategicRegions, options);
  renderStrategicRegionGroups(options);
}

function renderResourceFilterOptions() {
  const groups = visibleResourceFilterGroups();
  syncSetWithOptions(state.resourceFilters, groups.flatMap((group) => group.filters || []));
  els.resourceFilters.innerHTML = groups.map((group) => `
    <div class="filter-row resource-filter-row">
      <span class="filter-row-items resource-filter-items">
        ${group.filters.map((filter) => (
          resourceOptionToken(filter)
        )).join("")}
      </span>
    </div>
  `).join("");
}

function renderCompanyFilterOptions() {
  syncSetWithOptions(state.companyKinds, companyKindOptions);
  syncSetWithOptions(state.companyPrestigeGoods, companyPrestigeOptions);
  syncSetWithOptions(state.companyDlcs, companyDlcOptions);
  els.industryCharterFilters.innerHTML = optionToken(
    "industry-charter",
    industryCharterOption.key,
    industryCharterOption.label,
    state.includeIndustryCharter,
  );
  els.companyKindFilters.innerHTML = companyKindOptions.map((option) => (
    optionToken("company-kind", option.key, option.label, state.companyKinds.has(option.key))
  )).join("");
  els.companyPrestigeFilters.innerHTML = companyPrestigeOptions.map((option) => (
    optionToken("company-prestige", option.key, option.label, state.companyPrestigeGoods.has(option.key))
  )).join("");
  els.companyDlcFilters.innerHTML = companyDlcOptions.map((option) => (
    companyDlcOptionToken(option, state.companyDlcs.has(option.key))
  )).join("");
}

function renderIdeologyFilterOptions() {
  syncSetWithOptions(state.ideologyTypes, ideologyTypeOptions);
  const groups = collectIdeologyInterestGroupOptions();
  const occurrences = ideologyOccurrenceOptions;
  const lawGroups = collectIdeologyLawGroupOptions();
  syncSetWithOptions(state.ideologyGroups, groups);
  syncSetWithOptions(state.ideologyOccurrences, occurrences);
  syncSetWithOptions(state.ideologyLawGroups, lawGroups);
  els.ideologyTypeFilters.innerHTML = ideologyTypeOptions.map((option) => (
    ideologyChoiceToken("ideology-type", option.key, option.label, state.ideologyTypes.has(option.key))
  )).join("");
  els.ideologyGroupFilters.innerHTML = groups.map((group) => (
    ideologyGroupIconToken(group, state.ideologyGroups.has(group.key))
  )).join("");
  els.ideologyOccurrenceFilters.innerHTML = occurrences.map((option) => (
    ideologyChoiceToken("ideology-occurrence", option.key, option.label, state.ideologyOccurrences.has(option.key))
  )).join("");
  els.ideologyLawGroupFilters.innerHTML = renderIdeologyLawGroupFilterSections(lawGroups);
}

function renderLawFilterOptions() {
  const groups = lawGroups.slice().sort(sortLawGroup);
  syncSetWithOptions(state.lawGroups, groups);
  els.lawGroupFilters.innerHTML = renderLawGroupFilterSections(groups);
}

function renderLawGroupFilterSections(groups) {
  const byCategory = new Map();
  for (const group of groups) {
    const category = group.category || "uncategorized";
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(group);
  }
  return [...byCategory.entries()]
    .sort(([a], [b]) => lawGroupCategoryOrder(a) - lawGroupCategoryOrder(b) || lawGroupCategoryLabel(a).localeCompare(lawGroupCategoryLabel(b), "zh-Hans-CN"))
    .map(([category, categoryGroups]) => `
      <section class="ideology-law-filter-group">
        <h3>${escapeHtml(lawGroupCategoryLabel(category))}</h3>
        <div class="ideology-law-filter-items">
          ${categoryGroups.map((group) => ideologyChoiceToken("law-group", group.key, group.name_zh || group.key, state.lawGroups.has(group.key))).join("")}
        </div>
      </section>
    `).join("");
}

function sortLawGroup(a, b) {
  return orderValue(ideologyLawGroupOrderMap, a.key) - orderValue(ideologyLawGroupOrderMap, b.key)
    || (a.name_zh || a.key).localeCompare(b.name_zh || b.key, "zh-Hans-CN")
    || a.key.localeCompare(b.key);
}

function collectIdeologyInterestGroupOptions() {
  return (interestGroups || []).filter((group) => group?.key).slice(0, 8);
}

function collectIdeologyLawGroupOptions() {
  const map = new Map();
  for (const ideology of ideologies || []) {
    for (const stance of ideology.law_stances || []) {
      if (!stance.law_group_key || map.has(stance.law_group_key)) continue;
      map.set(stance.law_group_key, {
        key: stance.law_group_key,
        name_zh: stance.law_group_name_zh || stance.law_group_key,
      });
    }
  }
  return [...map.values()].sort(sortIdeologyLawGroup);
}

function renderIdeologyLawGroupFilterSections(lawGroups) {
  const byCategory = new Map([
    ...ideologyLawFilterGroups.map((group) => [group.key, []]),
    [ideologyLawUnknownFilterGroup.key, []],
  ]);
  for (const lawGroup of lawGroups || []) {
    const groupKey = ideologyLawFilterGroupByLawKey.get(lawGroup.key) || ideologyLawUnknownFilterGroup.key;
    byCategory.get(groupKey).push(lawGroup);
  }
  const visibleGroups = [
    ...ideologyLawFilterGroups,
    ...((byCategory.get(ideologyLawUnknownFilterGroup.key) || []).length ? [ideologyLawUnknownFilterGroup] : []),
  ];
  return visibleGroups.map((group) => {
    const items = byCategory.get(group.key) || [];
    if (!items.length) return "";
    return `
      <section class="ideology-law-filter-group">
        <h3>${escapeHtml(group.label)}</h3>
        <div class="ideology-law-filter-items">
          ${items.map((option) => (
            ideologyChoiceToken("ideology-law-group", option.key, option.name_zh || option.label || option.key, state.ideologyLawGroups.has(option.key))
          )).join("")}
        </div>
      </section>
    `;
  }).join("");
}

function sortIdeologyLawGroup(a, b) {
  const aName = a.name_zh || a.name || a.key;
  const bName = b.name_zh || b.name || b.key;
  return orderValue(ideologyLawGroupOrderMap, a.key) - orderValue(ideologyLawGroupOrderMap, b.key)
    || aName.localeCompare(bName, "zh-Hans-CN")
    || a.key.localeCompare(b.key);
}

function ideologyChoiceToken(kind, value, label, checked = false) {
  return `<button class="ideology-choice" type="button" data-filter-token data-${kind}="${escapeHtml(value)}" aria-pressed="${checked ? "true" : "false"}">${escapeHtml(label)}</button>`;
}

function ideologyGroupIconToken(group, checked = false) {
  const label = group.name_zh || group.key;
  return `
    <button class="ideology-group-icon-button" type="button" data-filter-token data-ideology-group="${escapeHtml(group.key)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" aria-pressed="${checked ? "true" : "false"}">
      ${interestGroupIconHtml(group)}
    </button>
  `;
}

function visibleResourceFilterGroups() {
  if (state.view === "company") return resourceFilterGroups;
  const groups = resourceFilterGroups.filter((group) => !group.companyOnly);
  const merged = [];
  const agricultureFilters = [];
  for (const group of groups) {
    if (group.key.startsWith("agriculture")) {
      agricultureFilters.push(...(group.filters || []));
    } else {
      merged.push(group);
    }
  }
  if (agricultureFilters.length) {
    merged.push({ key: "agriculture", filters: agricultureFilters });
  }
  return merged;
}

function renderStrategicRegionGroups(options) {
  const regionsByGroup = new Map(strategicRegionContinentGroups.map((group) => [group.key, []]));
  const otherRegions = [];
  for (const region of options || []) {
    const groupKey = strategicRegionContinentByKey.get(region.key);
    if (groupKey && regionsByGroup.has(groupKey)) regionsByGroup.get(groupKey).push(region);
    else otherRegions.push(region);
  }
  const rows = strategicRegionContinentGroups
    .map((group) => renderStrategicRegionGroupRow(group.name, regionsByGroup.get(group.key)))
    .filter(Boolean);
  if (otherRegions.length) {
    rows.push(renderStrategicRegionGroupRow("其他", otherRegions.sort(sortStrategicRegionRef)));
  }
  els.strategicRegionFilters.innerHTML = rows.join("");
}

function renderGeographicRegionFilterOptions() {
  if (!els.geographicRegionFilters) return;
  const regions = groupedGeographicRegions
    .filter((region) => matchesSearchBlob(geographicRegionSearchBlob(region)))
    .sort(sortGeographicRegions);
  const rows = geographicRegionGroupRows(regions).map((group) => renderGeographicRegionFilterGroupRow(group.label, group.regions));
  els.geographicRegionFilters.innerHTML = rows.join("") || `<p class="empty small-empty">没有匹配地理区域。</p>`;
}

function geographicRegionGroupRows(regions) {
  const byGroup = new Map(geographicRegionGroupOrder.map((key) => [key, []]));
  for (const region of regions || []) {
    const groupKey = region.geographic_region_group || "pending";
    if (!byGroup.has(groupKey)) byGroup.set(groupKey, []);
    byGroup.get(groupKey).push(region);
  }
  return [...byGroup.entries()]
    .map(([key, groupRegions]) => ({
      key,
      label: geographicRegionGroupLabels.get(key) || groupRegions[0]?.geographic_region_group_zh || key,
      regions: groupRegions.sort(sortGeographicRegions),
    }))
    .filter((group) => group.regions.length);
}

function renderGeographicRegionFilterGroupRow(label, regions) {
  if (!(regions || []).length) return "";
  return `
    <div class="filter-row geographic-filter-row">
      <span class="filter-row-label">${escapeHtml(label)}</span>
      <span class="filter-row-items">
        ${regions.map((region) => (
          `<button class="filter-token geographic-filter-token" type="button" data-geographic-region-filter="${escapeHtml(region.key)}" aria-pressed="${String(region.key === state.selectedGeographicRegion)}">
            <span class="filter-token-main">${escapeHtml(geographicRegionDisplayName(region))}</span>
            <span class="filter-token-count">${escapeHtml(String(geographicRegionStateRegions(region).length))}</span>
          </button>`
        )).join("")}
      </span>
    </div>
  `;
}

function renderStrategicRegionGroupRow(label, regions) {
  if (!(regions || []).length) return "";
  return `
    <div class="filter-row filter-group-block">
      <span class="filter-row-label">${escapeHtml(label)}</span>
      <span class="filter-row-items">
        ${regions.map((region) => (
          optionToken("strategic-region", region.key, strategicRegionName(region), state.strategicRegions.has(region.key))
        )).join("")}
      </span>
    </div>
  `;
}
