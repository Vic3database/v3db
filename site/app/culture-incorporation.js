function incorporationCalculatorCandidates(country) {
  const candidates = new Map();
  const add = (cultureKey, source) => {
    if (!cultureKey) return;
    const current = candidates.get(cultureKey) || { key: cultureKey, sources: [] };
    current.sources.push(source);
    candidates.set(cultureKey, current);
  };
  for (const key of country?.primaryCultures || []) add(key, { kind: "primary" });
  for (const path of [...(country?.primaryCultureExpansionPaths || []), ...(country?.primaryCultureConditionalPaths || [])]) {
    add(path.culture, { kind: "path", content_id: path.content_id, source_file: path.source_file, source_line: path.source_line });
  }
  for (const group of country?.primaryCultureOptionGroups || []) {
    for (const option of group.options || []) {
      for (const key of option.added_primary_cultures || []) add(key, { kind: "option", group_id: group.id, option_id: option.id, source_file: group.source_file || "" });
    }
  }
  return [...candidates.values()];
}

function incorporationCalculatorAllCultures() {
  return cultures.map((culture) => ({ key: culture.key, sources: [{ kind: "culture-board" }] }));
}

function incorporationCalculatorCandidateLabel(candidate) {
  return entityText(byCulture.get(candidate.key) || { key: candidate.key }) || candidate.key;
}

function incorporationCalculatorResultTitle(stateRegion, relation) {
  const homeland = relation.culture ? entityText(relation.culture) || relation.culture.key : t("map.cultureIncorporation.match", "匹配文化");
  return `${entityText(stateRegion) || stateRegion.key} · ${countryIncorporationLabel(relation.years)} · ${homeland}`;
}

function incorporationCalculatorInitializeFromCountry(tag) {
  const country = byTag.get(tag);
  if (!country) return;
  state.incorporationCalculatorCultures = new Set(country.primaryCultures || []);
  state.incorporationCalculatorAppliedCultures.clear();
  state.incorporationCalculatorCandidateCultures = new Map(incorporationCalculatorCandidates(country).map((item) => [item.key, item]));
  state.incorporationCalculatorSearch = "";
}

function incorporationCalculatorToggleCulture(key) {
  if (!key || !byCulture.has(key)) return;
  if (state.incorporationCalculatorCultures.has(key)) state.incorporationCalculatorCultures.delete(key);
  else state.incorporationCalculatorCultures.add(key);
  renderCultureIncorporationCalculator();
}

function incorporationCalculatorClear() {
  state.incorporationCalculatorCultures.clear();
  renderCultureIncorporationCalculator();
}

function incorporationCalculatorToggleSetFilter(field, key) {
  if (!key || !state[field]) return;
  if (state[field].has(key)) state[field].delete(key);
  else state[field].add(key);
  state.incorporationCalculatorFiltersOpen = true;
  renderCultureIncorporationCalculator();
}

function incorporationCalculatorSetTradition(key) {
  state.incorporationCalculatorFilterTradition = state.incorporationCalculatorFilterTradition === key ? "" : key;
  state.incorporationCalculatorFiltersOpen = true;
  renderCultureIncorporationCalculator();
}

function incorporationCalculatorToggleHomelandEffect(id) {
  if (!id) return;
  if (state.incorporationCalculatorHomelandEffects.has(id)) state.incorporationCalculatorHomelandEffects.delete(id);
  else state.incorporationCalculatorHomelandEffects.add(id);
  renderCultureIncorporationCalculator();
}

function incorporationCalculatorClearFilters() {
  state.incorporationCalculatorFilterHeritageGroups.clear();
  state.incorporationCalculatorFilterHeritages.clear();
  state.incorporationCalculatorFilterLanguageGroups.clear();
  state.incorporationCalculatorFilterLanguages.clear();
  state.incorporationCalculatorFilterTradition = "";
  state.incorporationCalculatorFiltersOpen = false;
}

function incorporationCalculatorStart() {
  state.incorporationCalculatorAppliedCultures = new Set(state.incorporationCalculatorCultures);
  state.incorporationCalculatorAppliedHomelandEffects = new Set(state.incorporationCalculatorHomelandEffects);
  render();
}

function clearCultureIncorporationCalculatorState() {
  state.incorporationCalculatorCultures.clear();
  state.incorporationCalculatorAppliedCultures.clear();
  state.incorporationCalculatorCandidateCultures.clear();
  state.incorporationCalculatorHomelandEffects.clear();
  state.incorporationCalculatorAppliedHomelandEffects.clear();
  incorporationCalculatorClearFilters();
  state.incorporationCalculatorSearch = "";
}

function incorporationCalculatorFilterMatches(culture) {
  const heritage = culture?.heritage || {};
  const language = culture?.language || {};
  if (state.incorporationCalculatorFilterHeritageGroups.size && !state.incorporationCalculatorFilterHeritageGroups.has(heritage.group_key)) return false;
  if (state.incorporationCalculatorFilterHeritages.size && !state.incorporationCalculatorFilterHeritages.has(heritage.key)) return false;
  if (state.incorporationCalculatorFilterLanguageGroups.size && !state.incorporationCalculatorFilterLanguageGroups.has(language.group_key)) return false;
  if (state.incorporationCalculatorFilterLanguages.size && !state.incorporationCalculatorFilterLanguages.has(language.key)) return false;
  if (state.incorporationCalculatorFilterTradition && !(culture.traditions || []).some((item) => item.key === state.incorporationCalculatorFilterTradition)) return false;
  return true;
}

function incorporationCalculatorFilterActive() {
  return state.incorporationCalculatorFilterHeritageGroups.size
    || state.incorporationCalculatorFilterHeritages.size
    || state.incorporationCalculatorFilterLanguageGroups.size
    || state.incorporationCalculatorFilterLanguages.size
    || Boolean(state.incorporationCalculatorFilterTradition);
}

function incorporationCalculatorFilterOptions(selector) {
  const values = new Map();
  for (const culture of cultures) {
    const value = selector(culture);
    if (value?.key && !values.has(value.key)) values.set(value.key, value);
  }
  return [...values.values()].sort((left, right) => localizedCompare(entityText(left) || left.key, entityText(right) || right.key));
}

function incorporationCalculatorFilteredCultures(candidateKeys) {
  const search = String(state.incorporationCalculatorSearch || "").trim().toLocaleLowerCase();
  if (!incorporationCalculatorFilterActive() && !search) return [];
  return cultures
    .filter(incorporationCalculatorFilterMatches)
    .filter((culture) => !search || incorporationCalculatorCandidateLabel({ key: culture.key }).toLocaleLowerCase().includes(search) || culture.key.toLocaleLowerCase().includes(search))
    .filter((culture) => !candidateKeys.has(culture.key) && !state.incorporationCalculatorCultures.has(culture.key))
    .sort((left, right) => localizedCompare(entityText(left) || left.key, entityText(right) || right.key));
}

function incorporationCalculatorFilteredCulturesForDisplay(candidateKeys) {
  const filtered = incorporationCalculatorFilteredCultures(candidateKeys);
  if (filtered.length) return filtered;
  if (String(state.incorporationCalculatorSearch || "").trim()) return [];
  return cultures
    .filter(incorporationCalculatorFilterMatches)
    .filter((culture) => !state.incorporationCalculatorCultures.has(culture.key))
    .sort((left, right) => localizedCompare(entityText(left) || left.key, entityText(right) || right.key));
}

function incorporationCalculatorFixedHomelandEffects() {
  return cultureHomelandEffects.filter((effect) => !effect.dynamic_scope && effect.actions?.some((action) => action.state_regions.length));
}

function incorporationCalculatorDynamicHomelandEffects() {
  return cultureHomelandEffects.filter((effect) => effect.dynamic_scope);
}

function incorporationCalculatorEffectTitle(effect) {
  const source = effect.localization_key ? t(effect.localization_key, "") : "";
  return source || effect.content_id;
}

function incorporationCalculatorCultureLabels(keys) {
  return (keys || []).map((key) => entityText(byCulture.get(key) || { key }) || key).join(t("ui.listSeparator"));
}

function incorporationCalculatorEffectSummary(effect) {
  const actions = effect.actions || [];
  const added = [...new Set(actions.flatMap((action) => action.added_cultures || []))];
  const removed = [...new Set(actions.flatMap((action) => action.removed_cultures || []))];
  const states = [...new Set(actions.flatMap((action) => action.state_regions || []))];
  const parts = [];
  if (added.length) parts.push(t("board.culture.incorporation.addedHomeland", { cultures: incorporationCalculatorCultureLabels(added) }));
  if (removed.length) parts.push(t("board.culture.incorporation.removedHomeland", { cultures: incorporationCalculatorCultureLabels(removed) }));
  if (states.length) parts.push(t("board.culture.incorporation.fixedRegions", { count: localizedNumber(states.length) }));
  return parts.join("；");
}

function renderCultureIncorporationCalculator() {
  const root = els.cultureIncorporationPanel || els.countryList;
  if (els.cultureIncorporationPanel) els.cultureIncorporationPanel.hidden = false;
  const candidates = [...(state.incorporationCalculatorCandidateCultures?.values() || [])]
    .sort((left, right) => localizedCompare(incorporationCalculatorCandidateLabel(left), incorporationCalculatorCandidateLabel(right)));
  const selected = [...(state.incorporationCalculatorCultures || [])].map((key) => byCulture.get(key) || { key }).filter(Boolean);
  const candidateKeys = new Set(candidates.map((candidate) => candidate.key));
  const filteredCultures = incorporationCalculatorFilteredCulturesForDisplay(candidateKeys);
  const heritageGroups = incorporationCalculatorFilterOptions((culture) => culture.heritage?.group_key ? { key: culture.heritage.group_key, loc: { name: culture.heritage.loc?.groupName } } : null);
  const heritages = incorporationCalculatorFilterOptions((culture) => culture.heritage);
  const languageGroups = incorporationCalculatorFilterOptions((culture) => culture.language?.group_key ? { key: culture.language.group_key, loc: { name: culture.language.loc?.groupName } } : null);
  const languages = incorporationCalculatorFilterOptions((culture) => culture.language);
  const traditions = incorporationCalculatorFilterOptions((culture) => culture.traditions?.[0] || null);
  const fixedEffects = incorporationCalculatorFixedHomelandEffects();
  const dynamicEffects = incorporationCalculatorDynamicHomelandEffects();
  const selectedHtml = selected.length
    ? selected.map((culture) => `<button type="button" class="culture-incorporation-selected-tag" data-incorporation-selected-culture="${escapeHtml(culture.key)}">${escapeHtml(entityText(culture) || culture.key)} ×</button>`).join("")
    : `<span class="empty">${escapeHtml(t("board.culture.incorporation.empty", "请选择文化"))}</span>`;
  const candidateHtml = candidates.map((candidate) => `<button type="button" class="culture-incorporation-candidate" data-incorporation-candidate="${escapeHtml(candidate.key)}" aria-pressed="${String(state.incorporationCalculatorCultures.has(candidate.key))}">${escapeHtml(incorporationCalculatorCandidateLabel(candidate))}</button>`).join("");
  const renderFilter = (items, attribute, selected) => items.map((item) => `<button type="button" class="culture-incorporation-filter" ${attribute}="${escapeHtml(item.key)}" aria-pressed="${String(selected.has?.(item.key) || selected === item.key)}">${escapeHtml(entityText(item) || item.key)}</button>`).join("");
  const filteredHtml = filteredCultures.length
    ? filteredCultures.map((culture) => `<button type="button" class="culture-incorporation-candidate" data-incorporation-filter-culture="${escapeHtml(culture.key)}">${escapeHtml(entityText(culture) || culture.key)}</button>`).join("")
    : `<span class="empty">${escapeHtml(t("board.culture.incorporation.noFilter", "选择筛选条件后显示文化"))}</span>`;
  const fixedEffectHtml = fixedEffects.map((effect) => `<label class="culture-incorporation-effect"><input type="checkbox" data-incorporation-homeland-effect="${escapeHtml(effect.id)}" ${state.incorporationCalculatorHomelandEffects.has(effect.id) ? "checked" : ""}><span><strong>${escapeHtml(incorporationCalculatorEffectTitle(effect))}</strong><small>${escapeHtml(incorporationCalculatorEffectSummary(effect))}</small></span></label>`).join("");
  const dynamicEffectHtml = dynamicEffects.map((effect) => `<article class="culture-incorporation-dynamic-effect" data-incorporation-dynamic-effect><strong>${escapeHtml(incorporationCalculatorEffectTitle(effect))}</strong><small>${escapeHtml(t("board.culture.incorporation.dynamicEffectNote", "范围取决于控制、整合或当前本土，未纳入计算。"))}</small></article>`).join("");
  root.className = "culture-incorporation-calculator-list";
  root.innerHTML = `
    <section class="culture-incorporation-calculator" data-culture-incorporation-calculator>
      <header class="culture-incorporation-calculator-header">
        <h2>${escapeHtml(t("board.culture.incorporation.title", "整合时长计算器"))}</h2>
        <p>${escapeHtml(t("board.culture.incorporation.description", "选择文化后启动地图计算"))}</p>
      </header>
      <button type="button" class="culture-incorporation-start" data-incorporation-start>${escapeHtml(t("board.culture.incorporation.start", "开始计算"))}</button>
      <section class="culture-incorporation-calculator-section"><h3>${escapeHtml(t("board.culture.incorporation.selected", "已选文化"))}</h3><div class="culture-incorporation-selected" data-incorporation-selected>${selectedHtml}</div><button type="button" class="culture-incorporation-clear" data-incorporation-clear>${escapeHtml(t("board.culture.incorporation.clear", "清空文化"))}</button></section>
      <section class="culture-incorporation-calculator-section"><h3>${escapeHtml(t("board.culture.incorporation.candidates", "可能涉及的文化"))}</h3><div class="culture-incorporation-candidates" data-incorporation-candidates>${candidateHtml || `<span class="empty">${escapeHtml(t("ui.none", "无"))}</span>`}</div></section>
      <section class="culture-incorporation-calculator-section"><h3>${escapeHtml(t("board.culture.incorporation.otherCultures", "添加其他文化"))}</h3><input class="culture-incorporation-search" data-incorporation-search type="search" value="${escapeHtml(state.incorporationCalculatorSearch)}" placeholder="${escapeHtml(t("board.culture.incorporation.search", "搜索文化"))}"><details class="culture-incorporation-filter-panel" data-incorporation-filter-panel${state.incorporationCalculatorFiltersOpen ? " open" : ""}><summary>${escapeHtml(t("board.culture.incorporation.filterMethods", "筛选方式"))}</summary><div class="culture-incorporation-filter-groups"><div><small>${escapeHtml(t("board.culture.incorporation.filterHeritage", "传承"))}</small><div class="culture-incorporation-candidates">${renderFilter(heritageGroups, "data-incorporation-filter-heritage-group", state.incorporationCalculatorFilterHeritageGroups)}${renderFilter(heritages, "data-incorporation-filter-heritage", state.incorporationCalculatorFilterHeritages)}</div></div><div><small>${escapeHtml(t("board.culture.incorporation.filterLanguage", "语言"))}</small><div class="culture-incorporation-candidates">${renderFilter(languageGroups, "data-incorporation-filter-language-group", state.incorporationCalculatorFilterLanguageGroups)}${renderFilter(languages, "data-incorporation-filter-language", state.incorporationCalculatorFilterLanguages)}</div></div><div><small>${escapeHtml(t("board.culture.incorporation.filterTradition", "传统"))}</small><div class="culture-incorporation-candidates">${renderFilter(traditions, "data-incorporation-filter-tradition", state.incorporationCalculatorFilterTradition)}</div></div></div></details><div class="culture-incorporation-filter-results-divider" data-incorporation-filter-results-divider></div><h4 class="culture-incorporation-filter-results-title" data-incorporation-filter-results-title>${escapeHtml(t("board.culture.incorporation.filterResults", "筛选结果"))}</h4><div class="culture-incorporation-candidates" data-incorporation-filter-results>${filteredHtml}</div></section>
      <section class="culture-incorporation-calculator-section"><h3>${escapeHtml(t("board.culture.incorporation.homelandEffects", "文化本土变化"))}</h3><div class="culture-incorporation-effects">${fixedEffectHtml || `<span class="empty">${escapeHtml(t("ui.none", "无"))}</span>`}</div></section>
      <section class="culture-incorporation-calculator-section"><h3>${escapeHtml(t("board.culture.incorporation.dynamicEffects", "动态范围效果"))}</h3><div class="culture-incorporation-effects">${dynamicEffectHtml || `<span class="empty">${escapeHtml(t("ui.none", "无"))}</span>`}</div></section>
    </section>`;
  bindCultureIncorporationCalculatorEvents();
}

function bindCultureIncorporationCalculatorEvents() {
  const root = els.cultureIncorporationPanel || els.countryList;
  root.querySelectorAll("[data-incorporation-candidate]").forEach((button) => button.addEventListener("click", () => incorporationCalculatorToggleCulture(button.dataset.incorporationCandidate)));
  root.querySelectorAll("[data-incorporation-filter-culture]").forEach((button) => button.addEventListener("click", () => incorporationCalculatorToggleCulture(button.dataset.incorporationFilterCulture)));
  root.querySelectorAll("[data-incorporation-filter-heritage-group]").forEach((button) => button.addEventListener("click", () => incorporationCalculatorToggleSetFilter("incorporationCalculatorFilterHeritageGroups", button.dataset.incorporationFilterHeritageGroup)));
  root.querySelectorAll("[data-incorporation-filter-heritage]").forEach((button) => button.addEventListener("click", () => incorporationCalculatorToggleSetFilter("incorporationCalculatorFilterHeritages", button.dataset.incorporationFilterHeritage)));
  root.querySelectorAll("[data-incorporation-filter-language-group]").forEach((button) => button.addEventListener("click", () => incorporationCalculatorToggleSetFilter("incorporationCalculatorFilterLanguageGroups", button.dataset.incorporationFilterLanguageGroup)));
  root.querySelectorAll("[data-incorporation-filter-language]").forEach((button) => button.addEventListener("click", () => incorporationCalculatorToggleSetFilter("incorporationCalculatorFilterLanguages", button.dataset.incorporationFilterLanguage)));
  root.querySelectorAll("[data-incorporation-filter-tradition]").forEach((button) => button.addEventListener("click", () => incorporationCalculatorSetTradition(button.dataset.incorporationFilterTradition)));
  root.querySelectorAll("[data-incorporation-homeland-effect]").forEach((input) => input.addEventListener("change", () => incorporationCalculatorToggleHomelandEffect(input.dataset.incorporationHomelandEffect)));
  root.querySelectorAll("[data-incorporation-selected-culture]").forEach((button) => button.addEventListener("click", () => incorporationCalculatorToggleCulture(button.dataset.incorporationSelectedCulture)));
  root.querySelector("[data-incorporation-clear]")?.addEventListener("click", incorporationCalculatorClear);
  root.querySelector("[data-incorporation-start]")?.addEventListener("click", incorporationCalculatorStart);
  root.querySelector("[data-incorporation-search]")?.addEventListener("input", (event) => { state.incorporationCalculatorSearch = event.target.value; renderCultureIncorporationCalculator(); });
  root.querySelector("[data-incorporation-filter-panel]")?.addEventListener("toggle", (event) => { state.incorporationCalculatorFiltersOpen = event.target.open; });
}
