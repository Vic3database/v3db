function renderEntityBadge(kind, entity, label = "") {
  const text = label || entity?.name_zh || entity?.name || entity?.tag || entity?.key || "?";
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
      ${renderEntityBadge("country", country, country.name)}
      <span class="country-heading">
        <span class="tag">${escapeHtml(country.tag)}</span>
        <span class="name">${countryNameText(country)}</span>
        ${rowDetailButton("data-country-detail", country.tag)}
      </span>
      <span class="minor country-meta">${countryCapitalText(country)}</span>
      <span class="minor country-meta">主流文化：${escapeHtml((country.primaryCulturesZh || []).join("、") || "无")}</span>
      <span class="pill-line country-tags">${countryTagPills(country)}</span>
    </article>
  `).join("");
  els.countryList.querySelectorAll("[data-country]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("a, button, [data-concept-key]")) return;
      selectCountryCard(row.dataset.country);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("a, button, [data-concept-key]")) return;
      event.preventDefault();
      selectCountryCard(row.dataset.country);
    });
  });
  els.countryList.querySelectorAll("[data-country-detail]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openCountryDetail(button.dataset.countryDetail);
    });
  });
}

function selectCountryCard(countryTag) {
  if (!countryTag || !byTag.has(countryTag)) return;
  state.globalSearchColorRestoreTag = "";
  state.selectedTag = countryTag;
  state.detailKind = "country";
  replaceHash(selectionHashForCard("/country", `/country/${encodeURIComponent(countryTag)}`));
  render();
}

function selectCountryFromMap(countryTag) {
  if (!countryTag || !byTag.has(countryTag)) return;
  selectCountryCard(countryTag);
  requestAnimationFrame(() => {
    const selectedRow = els.countryList.querySelector(`[data-country="${countryTag}"]`);
    selectedRow?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

function openCountryDetail(countryTag) {
  if (!countryTag || !byTag.has(countryTag)) return;
  state.globalSearchColorRestoreTag = "";
  state.selectedTag = countryTag;
  state.detailKind = "country";
  replaceHash(`/country/${encodeURIComponent(countryTag)}`);
  render();
}

function renderRegionList(filteredStrategicRegions, filteredStateRegions, filteredSeaRegions, filteredGeographicRegions) {
  const visibleStateRegions = filteredStateRegions;
  const selectedStateRegionFromMap = byStateRegion.get(state.mapSelectedStateRegion);
  const mapSelectionIsFilteredOut = selectedStateRegionFromMap && !visibleStateRegions.some((stateRegion) => stateRegion.key === selectedStateRegionFromMap.key);
  els.countryList.className = "country-list region-list";
  const selectedFromMapHtml = mapSelectionIsFilteredOut ? `
    <article class="country-row region-row region-map-selected selectable-row" data-state-region="${escapeHtml(selectedStateRegionFromMap.key)}" style="${stateRegionBorderStyle(selectedStateRegionFromMap)}" aria-current="true" tabindex="0">
      <span class="country-heading">
        <span class="tag">${escapeHtml(selectedStateRegionFromMap.key)}</span>
        <span class="name">${stateRegionNameText(selectedStateRegionFromMap)}</span>
        ${rowDetailButton("data-state-region-detail", selectedStateRegionFromMap.key)}
      </span>
      <span class="minor country-meta">${escapeHtml(stateRegionSummaryText(selectedStateRegionFromMap))}</span>
      <span class="minor country-meta">本土文化：${escapeHtml(refNames(selectedStateRegionFromMap.homeland_cultures))}</span>
      <span class="pill-line country-tags">${stateRegionTagPills(selectedStateRegionFromMap)}</span>
      <span class="region-building-strip">${stateRegionBuildingStrip(selectedStateRegionFromMap)}</span>
    </article>
  ` : "";
  const stateRegionHtml = visibleStateRegions.length ? `
    <div class="list-section-title">州地区</div>
    ${visibleStateRegions.map((stateRegion) => `
      <article class="country-row region-row selectable-row" data-state-region="${escapeHtml(stateRegion.key)}" style="${stateRegionBorderStyle(stateRegion)}" aria-current="${stateRegion.key === state.selectedStateRegion && state.detailKind === "stateRegion"}" tabindex="0">
        <span class="country-heading">
          <span class="tag">${escapeHtml(stateRegion.key)}</span>
          <span class="name">${stateRegionNameText(stateRegion)}</span>
          ${rowDetailButton("data-state-region-detail", stateRegion.key)}
        </span>
        <span class="minor country-meta">${escapeHtml(stateRegionSummaryText(stateRegion))}</span>
        <span class="minor country-meta">本土文化：${escapeHtml(refNames(stateRegion.homeland_cultures))}</span>
        <span class="pill-line country-tags">${stateRegionTagPills(stateRegion)}</span>
        <span class="region-building-strip">${stateRegionBuildingStrip(stateRegion)}</span>
      </article>
    `).join("")}
  ` : "";
  els.countryList.innerHTML = `${selectedFromMapHtml}${stateRegionHtml || (selectedFromMapHtml ? "" : `<p class="empty">没有匹配结果。</p>`)}`;
  els.countryList.querySelectorAll("[data-state-region]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("a, button, [data-concept-key]")) return;
      selectStateRegionCard(row.dataset.stateRegion);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("a, button, [data-concept-key]")) return;
      event.preventDefault();
      selectStateRegionCard(row.dataset.stateRegion);
    });
  });
  els.countryList.querySelectorAll("[data-state-region-detail]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openStateRegionDetail(button.dataset.stateRegionDetail);
    });
  });
}

function selectStateRegionCard(stateRegionKey) {
  if (!stateRegionKey || !byStateRegion.has(stateRegionKey)) return;
  state.selectedStateRegion = stateRegionKey;
  state.mapSelectedStateRegion = "";
  state.detailKind = "stateRegion";
  state.regionListMode = "state";
  replaceHash(selectionHashForCard("/region", `/state-region/${encodeURIComponent(stateRegionKey)}`));
  render();
}

function selectStateRegionFromMap(stateRegionKey) {
  if (!stateRegionKey || !byStateRegion.has(stateRegionKey)) return;
  state.selectedStateRegion = stateRegionKey;
  state.mapSelectedStateRegion = stateRegionKey;
  state.detailKind = "stateRegion";
  state.regionListMode = "state";
  replaceHash("/region");
  render();
  requestAnimationFrame(() => {
    const selectedRow = els.countryList.querySelector(`[data-state-region="${stateRegionKey}"]`);
    selectedRow?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
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
      <span class="tag">${escapeHtml(culture.key)}</span>
      <span>
        <span class="name">${escapeHtml(culture.name_zh)}</span>
        <span class="minor">${escapeHtml([culture.heritage?.name_zh, culture.language?.name_zh].filter(Boolean).join("、"))}</span>
      </span>
      ${rowDetailButton("data-culture-detail", culture.key)}
      <span class="minor">${escapeHtml((culture.homeland_strategic_regions || []).map((region) => region.name_zh).join("、"))}</span>
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
          <span class="name">${escapeHtml(company.name_zh || company.key)}</span>
          <span class="tag">${escapeHtml(company.key)}</span>
        </span>
        ${companyDlcIconPill(company)}
        ${rowDetailButton("data-company-detail", company.key)}
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
      selectCompanyCard(row.dataset.company);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("a, button, [data-concept-key]")) return;
      event.preventDefault();
      selectCompanyCard(row.dataset.company);
    });
  });
  els.countryList.querySelectorAll("[data-company-detail]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openCompanyDetail(button.dataset.companyDetail);
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
    els.countryList.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  const grouped = ideologyTypeOptions.map((type) => ({
    ...type,
    items: visible.filter((ideology) => ideologyTypeKey(ideology) === type.key),
  })).filter((type) => type.items.length > 0);
  els.countryList.innerHTML = grouped.map((type) => `
    <div class="list-section-title">${escapeHtml(type.label)}</div>
    ${type.items.map((ideology) => `
      <article class="country-row ideology-row selectable-row" data-ideology="${escapeHtml(ideology.key)}" aria-current="${ideology.key === state.selectedIdeology && state.detailKind === "ideology"}" tabindex="0">
        <span class="country-heading ideology-row-heading">
          ${ideologyIconHtml(ideology, "ideology-icon ideology-row-icon")}
          <span class="ideology-row-title">
            <span class="tag">${escapeHtml(ideology.key)}</span>
            <span class="name">${escapeHtml(ideology.name_zh || ideology.key)}</span>
          </span>
          ${rowDetailButton("data-ideology-detail", ideology.key)}
        </span>
        <span class="minor country-meta">${escapeHtml(cleanIdeologyDescription(ideology.desc_zh) || "无描述")}</span>
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
    const group = lawGroupByKey.get(groupKey) || { key: groupKey, name_zh: law.group_name_zh || groupKey, category: "uncategorized" };
    const categoryKey = group.category || "uncategorized";
    if (!categories.has(categoryKey)) categories.set(categoryKey, { key: categoryKey, groups: new Map() });
    const groups = categories.get(categoryKey).groups;
    if (!groups.has(groupKey)) groups.set(groupKey, { ...group, laws: [] });
    groups.get(groupKey).laws.push(law);
  }
  const sections = [...categories.values()].sort((a, b) => lawGroupCategoryOrder(a.key) - lawGroupCategoryOrder(b.key)
    || lawGroupCategoryLabel(a.key).localeCompare(lawGroupCategoryLabel(b.key), "zh-Hans-CN"));
  els.countryList.className = "country-list law-list";
  if (!sections.length) {
    els.countryList.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  els.countryList.innerHTML = sections.map((category) => `
    <details class="law-category-section" open>
      <summary class="law-category-title">${escapeHtml(lawGroupCategoryLabel(category.key))}</summary>
      ${[...category.groups.values()].sort(sortLawGroup).map((group) => `
        <section class="law-group-section">
          <h3 class="list-section-title">${escapeHtml(group.name_zh)}</h3>
          ${group.laws.sort(sortLaws).map((law) => `
      <article class="country-row law-row selectable-row" data-law="${escapeHtml(law.key)}" aria-current="${law.key === state.selectedLaw && state.detailKind === "law"}" tabindex="0">
        <span class="country-heading law-row-heading">
          ${lawIconHtml(law, "law-icon law-row-icon")}
          <span class="law-row-title"><span class="tag">${escapeHtml(law.key)}</span><span class="name">${escapeHtml(lawDisplayName(law))}</span></span>
          ${rowDetailButton("data-law-detail", law.key)}
        </span>
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
  if (!Number.isFinite(numeric)) return "进步度：无";
  return `进步度：${numeric > 0 ? "+" : ""}${numeric}`;
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
      title: group.display_name?.name_zh || group.name_zh || group.key,
      aliases: [group.name_zh].filter((name) => name && name !== group.display_name?.name_zh),
      subtitle: country.name,
      raw: group,
      countryTag: country.tag,
      searchText: [country.tag, country.name, group.key, group.name_zh, group.display_name?.key, group.display_name?.name_zh].filter(Boolean).join(" "),
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
  const name = law.name_zh || law.key || "";
  const parent = law.parent ? lawByKey.get(law.parent) : null;
  const parentName = parent?.name_zh || law.parent || "";
  return parentName ? `${name}（${parentName}）` : name;
}

function lawGroupCategoryLabel(category) {
  return {
    power_structure: "权力结构",
    economy: "经济",
    human_rights: "人权",
    uncategorized: "未分类",
  }[category] || category || "未分类";
}

function lawGroupCategoryOrder(category) {
  return ["power_structure", "economy", "human_rights", "uncategorized"].indexOf(category);
}

function lawEffectListHtml(law) {
  const modifiers = (law.modifiers || []).map((modifier) => ({ kind: "modifier", modifier }));
  const institutionModifiers = (law.institution_modifiers || []).map((modifier) => ({ kind: "modifier", modifier }));
  const enactmentEffects = (law.enactment_effects || []).map((label) => ({ kind: "enactment", label }));
  const hasInstitutionEffects = Boolean(law.institution) || institutionModifiers.length > 0;
  if (!modifiers.length && !hasInstitutionEffects && !enactmentEffects.length) return `<p class="empty compact">暂无可直接展示的效果。</p>`;
  return `<ul class="law-effect-list">
    ${modifiers.map(lawEffectItemHtml).join("")}
    ${law.institution ? lawEffectItemHtml({ kind: "institution", institution: law.institution }) : ""}
    ${institutionModifiers.length ? `<li class="law-effect-section-label">机构效果(每级):</li>${institutionModifiers.map(lawEffectItemHtml).join("")}` : ""}
    ${enactmentEffects.map(lawEffectItemHtml).join("")}
  </ul>`;
}

function lawEffectItemHtml(entry) {
  if (entry.kind === "institution") return `<li class="law-effect-neutral">解锁${escapeHtml(entry.institution.name_zh || entry.institution.key)}机构</li>`;
  if (entry.kind === "enactment") return `<li class="law-effect-neutral">${escapeHtml(entry.label)}</li>`;
  const modifier = entry.modifier || entry;
  const label = modifier?.name_zh || modifier?.key || "";
  const value = modifier?.value_zh || "";
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
    <h3>相关修正案</h3>
    <div class="law-amendment-list">
      ${amendments.map((amendment) => `
        <details class="law-amendment-card">
          <summary>${escapeHtml(amendment.name_zh || amendment.key)}</summary>
          ${amendment.desc_zh ? `<p>${escapeHtml(cleanDescriptionText(amendment.desc_zh))}</p>` : ""}
          <dl class="field-grid">
            ${field("上位法", lawPill(lawByKey.get(amendment.parent_law) || { key: amendment.parent_law, name_zh: amendment.parent_law }))}
            ${field("适用法律", lawPills(amendment.allowed_laws || []))}
          </dl>
          <h4>效果</h4>
          ${lawEffectListHtml({ modifiers: amendment.modifiers || [] })}
          ${rawDetails("触发条件", amendment.possible?.raw)}
        </details>
      `).join("")}
    </div>
  `;
}

function ideologyLawGroupPreviewHtml(ideology) {
  const groups = ideologyLawGroupRefs(ideology).slice(0, 6);
  if (!groups.length) return "";
  return `
    <span class="ideology-law-preview" aria-label="相关法律组">
      ${groups.map((group) => `<span>${escapeHtml(group.name_zh || group.key)}</span>`).join("")}
    </span>
  `;
}

function companyDetailLocationHtml(company) {
  if (!companyDetailLocationMapEnabled(company)) return "";
  const stateKeys = companyLocationStateRegionKeys(company);
  return `
    <section class="company-location-section" aria-label="公司位置">
      <h3>位置</h3>
      ${stateKeys.length ? `
        <div class="company-location-map">
          <canvas data-company-location-map aria-label="${escapeHtml(company.name_zh || company.key)}的关联地点地图"></canvas>
        </div>
        <p class="minor company-location-summary">${escapeHtml(companyLocationSummary(company, stateKeys))}</p>
      ` : `<p class="empty">暂无可定位地点。</p>`}
      <dl class="field-grid company-location-fields">
        ${field("总部倾向", stateRegionLinks(company.preferred_headquarters))}
        ${field("相关战略区域", strategicRegionLinks(company.referenced_strategic_regions))}
        ${field("相关地理区域", geographicRegionLinks(company.referenced_geographic_regions))}
        ${field("相关州地区", stateRegionLinks(company.referenced_state_regions))}
      </dl>
    </section>
  `;
}

function renderCompanyDetail(company) {
  if (!company) {
    els.detail.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  els.detail.innerHTML = `
    <div class="detail-title">
      ${detailBackButton("company")}
      <div class="detail-title-main">
        <span class="company-icon-box">${companyIconHtml(company)}</span>
        <h2>${escapeHtml(company.name_zh || company.key)}</h2>
      </div>
      <span class="tag">${escapeHtml(company.key)}</span>
      ${victorianCenturyBadge(company)}
    </div>

    <h3>基础</h3>
    <dl class="field-grid">
      ${field("类型", tagPill(companyKindText(company), companyKindKey(company) === "historical" ? "tag-special" : "tag-type"))}
      ${field("控股类别", tagPill(company.category_zh || company.category, "tag-tier", company.category))}
      ${field("资料片", companyDlcIconPill(company) || tagPill(companyDlcLabel(company), "tag-dlc", company.dlc_name_en || companyDlcKey(company)))}
      ${field("名贵商品状态", tagPill(companyPrestigeLabel(company), "tag-good"))}
      ${field("相关文化", cultureLinks(company.referenced_cultures))}
      ${field("相关国家", countryLinks((company.referenced_countries || []).map((item) => item.tag), (company.referenced_countries || []).map((item) => item.name_zh)))}
      ${field("所需科技", listText(company.required_technologies))}
      ${field("AI 倾向科技", listText(company.ai_will_do_technologies))}
    </dl>

    ${companyDetailLocationHtml(company)}

    <h3>经营</h3>
    <dl class="field-grid">
      ${field("主营建筑", buildingList(company.building_types, "tag-industry"))}
      ${field("扩展建筑", buildingList(company.extension_building_types, "extension-building-pill"))}
      ${field("名贵商品", companyPrestigeGoodsPills(company))}
      ${field("繁荣效果", modifierPills(company.prosperity_modifiers))}
    </dl>

    <h3>条件脚本</h3>
    ${rawDetails("潜在条件", company.potential_raw)}
    ${rawDetails("可见条件", company.attainable_raw)}
    ${rawDetails("成立条件", company.possible_raw)}
    ${rawDetails("名贵商品条件", company.prestige_goods_trigger_raw)}
    ${rawDetails("AI 倾向条件", company.ai_will_do_raw)}
    ${rawDetails("AI 建造目标", company.ai_construction_targets_raw)}
  `;
  queueMicrotask(() => renderCompanyDetailLocationMap(company));
}

function renderIdeologyDetail(ideology) {
  if (!ideology) {
    els.detail.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  const typeKey = ideologyTypeKey(ideology);
  const related = relatedIdeologyUsage(ideology);
  const relatedGroups = ideologyInterestGroupRefs(ideology).slice(0, 8);
  const description = cleanIdeologyDescription(ideology.desc_zh);
  els.detail.innerHTML = `
    <article class="vic3-ideology-panel">
      <header class="vic3-ideology-header">
        ${detailBackButton("ideology")}
        <div class="vic3-ideology-title">
          ${ideologyIconHtml(ideology, "ideology-icon ideology-detail-icon")}
          <div>
            <h2>${escapeHtml(ideology.name_zh || ideology.key)}</h2>
            <div class="vic3-ideology-meta">
              <span>${escapeHtml(ideologyTypeLabels.get(typeKey) || "意识形态")}</span>
              <span>${escapeHtml(ideology.key)}</span>
              ${victorianCenturyBadge(ideology)}
            </div>
          </div>
        </div>
        <span class="vic3-ideology-kind">意识形态</span>
      </header>
      ${relatedGroups.length ? `
        <div class="vic3-ideology-interest-groups">
          ${relatedGroups.map((group) => `
            <span class="vic3-ig-icon" title="${escapeHtml(group.name_zh || group.key)}">${interestGroupIconHtml(group)}</span>
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
    els.detail.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  els.detail.innerHTML = `
    <div class="detail-title">
      ${detailBackButton("country")}
      <div class="detail-title-main">
        ${countryFlagIconHtml(country, "country-flag-title") || `<span class="country-color large" style="${colorStyle(country.colorHex)}" aria-hidden="true"></span>`}
        <h2>${escapeHtml(country.name)}</h2>
      </div>
      <span class="tag">${country.tag}</span>
      ${victorianCenturyBadge(country)}
    </div>

    <h3>基础</h3>
    <dl class="field-grid">
      ${field("国家类型", tagPill(countryTypeTagLabel(country), "tag-type"))}
      ${field("国家位阶", tagPill(country.tierZh, "tag-tier"))}
      ${field("标准色", colorValue(country.colorHex, country.colorRgb))}
      ${field("部队颜色", unitColorText(country))}
      ${field("主流文化", linkedTerms(country.primaryCultures, country.primaryCulturesZh, "culture"))}
      ${field("所在战略区域", strategicRegionLinks(country.locationStrategicRegions))}
      ${field("所在州地区", stateRegionLinks(country.locationStateRegions))}
      ${field("主流文化本土战略区域", strategicRegionLinks(country.primaryCultureHomelandStrategicRegions))}
      ${field("传承", `<span class="grouped-trait-pills">${groupedTraitPills(country.primaryCultureHeritageGroups, country.primaryCultureHeritages, "tag-heritage-group", "tag-heritage")}</span>`)}
      ${field("语言", `<span class="grouped-trait-pills">${groupedTraitPills(country.primaryCultureLanguageGroups, country.primaryCultureLanguages, "tag-language-group", "tag-language")}</span>`)}
      ${field("传统", traitList(country.primaryCultureTraditions))}
      ${field("宗教", linkedTerms([country.religion], [country.religionZh], "religion") + sourceSuffix(country.religionSource))}
      ${field("首都", stateRegionLinks(country.capital ? [{ key: country.capital, name_zh: country.capitalZh }] : []))}
    </dl>

    ${collapsibleDetailSection("利益集团风味", interestGroupFlavorList(country.interestGroups), `${(country.interestGroups || []).length} 组`)}

    <h3>国名变体</h3>
    ${dynamicNameList(country)}

    <h3>地图色</h3>
    ${dynamicMapColorList(country)}

    ${countryFlagVariantSection(country)}

    <h3>开局</h3>
    <dl class="field-grid">
      ${field("开局存在", country.existsAtStart)}
      ${field("开局州数", String(country.startingStateCount))}
      ${field("开局州", countryStartingStateRegionLinks(country))}
      ${field("历史文件", country.hasHistoryCountryFile)}
    </dl>

    <h3>成立</h3>
    <dl class="field-grid">
      ${field("次要统一", country.isMinorFormable)}
      ${field("重大统一", country.isMajorFormable)}
      ${field("特殊机制", country.specialMechanic)}
      ${field("同文化可成立", countryLinks(country.canFormTags, country.canFormNames))}
      ${field("成立文化", linkedTerms(country.formationRequiredCultures, country.formationRequiredCulturesZh, "culture"))}
      ${field("成立范围战略区域", strategicRegionLinks(country.formationStrategicRegions))}
      ${field("成立范围州地区", stateRegionLinks(country.formationStateRegions))}
      ${field("规则直接列州", stateRegionLinks((country.formationStates || []).map((key) => ({ key, name_zh: byStateRegion.get(key)?.name_zh || key }))))}
      ${field("成立地区", escapeHtml(country.formationRegion || ""))}
    </dl>

    <h3>释放</h3>
    <dl class="field-grid">
      ${field("可释放", country.isReleasable)}
      ${field("释放州", stateRegionLinks((country.releaseStates || []).map((key) => ({ key, name_zh: byStateRegion.get(key)?.name_zh || key }))))}
    </dl>
  `;
}

function renderCountryDetailPage(country) {
  renderCountryDetail(country);
}

function detailBackButton(view = state.view) {
  const target = view === "region" ? "region" : view || "country";
  const label = viewLabels[target] || "国家";
  return `<button class="detail-back-button" type="button" data-detail-back="${escapeHtml(target)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"><img class="lucide-icon" src="assets/lucide/icons/arrow-left.svg" alt="" aria-hidden="true"></button>`;
}

function rowDetailButton(attributeName, key) {
  return `<button class="row-detail-button" type="button" ${attributeName}="${escapeHtml(key)}" aria-label="进入详情" title="进入详情"><img class="lucide-icon" src="assets/lucide/icons/arrow-right.svg" alt="" aria-hidden="true"></button>`;
}

function renderCultureDetail(culture) {
  if (!culture) {
    els.detail.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  els.detail.innerHTML = `
    <section class="culture-detail">
    <div class="detail-title">
      ${detailBackButton("culture")}
      <div class="detail-title-main">
        <span class="country-color large" style="${colorStyle(culture.color?.hex)}" aria-hidden="true"></span>
        <h2>${escapeHtml(culture.name_zh)}</h2>
      </div>
      <span class="tag">${escapeHtml(culture.key)}</span>
      ${victorianCenturyBadge(culture)}
    </div>

    <h3>基础</h3>
    <dl class="field-grid">
      ${field("颜色", colorValue(culture.color?.hex, culture.color?.rgb))}
      ${field("默认宗教", linkedTerms([culture.religion?.key], [culture.religion?.name_zh], "religion"))}
      ${field("传承", `<span class="grouped-trait-pills">${groupedTraitPills(compactRefs([culture.heritage_group]), compactRefs([culture.heritage]), "tag-heritage-group", "tag-heritage")}</span>`)}
      ${field("语言", `<span class="grouped-trait-pills">${groupedTraitPills(compactRefs([culture.language_group]), compactRefs([culture.language]), "tag-language-group", "tag-language")}</span>`)}
      ${field("传统", traitList(culture.traditions))}
      ${field("本土战略区域", strategicRegionLinks(culture.homeland_strategic_regions))}
      ${field("本土州", stateRegionLinks(culture.homeland_state_regions))}
    </dl>

    <h3>消费</h3>
    <dl class="field-grid">
      ${field("痴迷", goodsList(culture.obsessions))}
      ${field("禁忌", goodsList(culture.taboos))}
    </dl>

    <h3>关联</h3>
    <dl class="field-grid">
      ${field("相关国家", countryLinks(
        (culture.related_countries || []).map((countryRef) => countryRef.tag),
        (culture.related_countries || []).map((countryRef) => countryRef.name_zh),
      ))}
      ${field("同传承组文化", cultureLinks(culture.same_heritage_group_cultures))}
      ${field("同传承文化", cultureLinks(culture.same_heritage_cultures))}
      ${field("同语言组文化", cultureLinks(culture.same_language_group_cultures))}
      ${field("同语言文化", cultureLinks(culture.same_language_cultures))}
      ${field("同传统文化", sameTraditionCultures(culture.traditions, culture.same_tradition_cultures))}
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
      <span class="tag">${escapeHtml(stateRegion.key)}</span>
      ${victorianCenturyBadge(stateRegion)}
    </div>
    <h3>基础</h3>
    <dl class="field-grid">
      ${field("战略区域", strategicRegionLinks(stateRegion.strategic_regions))}
      ${field("开局归属", countryLinks((stateRegion.starting_owners || []).map((country) => country.tag), (stateRegion.starting_owners || []).map((country) => country.name_zh)))}
      ${field("本土文化", cultureLinks(stateRegion.homeland_cultures))}
      ${field("地区特质", stateTraitPills(stateRegion.traits))}
      ${field("固定资源", cappedResourceList(stateRegion.capped_resources))}
      ${field("可发现资源", discoverableResourceList(stateRegion.discoverable_resources))}
      ${field("农业建筑", buildingList(stateRegion.arable_resources))}
      ${field("耕地", stateRegion.arable_land === null ? "" : String(stateRegion.arable_land))}
    </dl>
    <h3>相关公司</h3>
    <dl class="field-grid">
      ${field("总部倾向", companyAssociationLinks(relatedCompanies.filter((item) => item.kind === "headquarters")))}
      ${field("条件引用", companyAssociationLinks(relatedCompanies.filter((item) => item.kind === "special")))}
    </dl>
    <h3>地区特质效果</h3>
    ${stateTraitEffectList(stateRegion.traits)}
    <h3>名称变体</h3>
    ${dynamicStateNameList(stateRegion)}
  `;
}

function renderStrategicRegionDetail(region) {
  const regionKind = isSeaStrategicRegion(region) ? "海域" : "战略区域";
  els.detail.innerHTML = `
    <div class="detail-title">
      ${detailBackButton("region")}
      <div class="detail-title-main">
        <span class="country-color large" style="${colorStyle(region.map_color?.hex)}" aria-hidden="true"></span>
        <h2>${escapeHtml(strategicRegionName(region))}</h2>
      </div>
      <span class="tag">${escapeHtml(region.key)}</span>
      ${victorianCenturyBadge(region)}
    </div>
    <h3>基础</h3>
    <dl class="field-grid">
      ${field("类型", tagPill(regionKind, isSeaStrategicRegion(region) ? "tag-sea" : "tag-region"))}
      ${field("颜色", colorValue(region.map_color?.hex, region.map_color?.rgb))}
      ${field("州地区", stateRegionLinks(region.states))}
      ${field("本土文化", cultureLinks(region.homeland_cultures))}
      ${field("开局国家", countryLinks((region.starting_owners || []).map((country) => country.tag), (region.starting_owners || []).map((country) => country.name_zh)))}
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
      <span class="tag">${escapeHtml(region.key)}</span>
      ${victorianCenturyBadge(region)}
    </div>
    <h3>基础</h3>
    <dl class="field-grid">
      ${field("类型", tagPill("地理区域", "tag-region"))}
      ${field("分组", tagPill(geographicRegionGroupLabels.get(region.geographic_region_group) || region.geographic_region_group_zh || region.geographic_region_group || "暂置", "tag-muted"))}
      ${field("战略区域", strategicRegionLinks(strategicRefs))}
      ${field("州地区", stateRegionLinks(stateRefs))}
      ${field("州地区数量", escapeHtml(String(stateRefs.length)))}
      ${field("开局国家", countryLinks(startingOwners.map((country) => country.tag), startingOwners.map((country) => country.name_zh)))}
      ${field("本土文化", cultureLinks(homelandCultures))}
    </dl>
    <h3>来源</h3>
    <dl class="field-grid">
      ${field("文件", escapeHtml(region.source_file || ""))}
    </dl>
  `;
}
