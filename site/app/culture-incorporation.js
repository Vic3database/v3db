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

function incorporationCalculatorSelectedCultureObjects() {
  return [...(state.incorporationCalculatorCultures || [])]
    .map((key) => byCulture.get(key) || { key })
    .filter(Boolean);
}

function incorporationCalculatorCandidateLabel(candidate) {
  return entityText(byCulture.get(candidate.key) || { key: candidate.key }) || candidate.key;
}

function incorporationCalculatorResultTitle(stateRegion, relation) {
  const homeland = relation.culture ? entityText(relation.culture) || relation.culture.key : t("map.cultureIncorporation.match", "匹配文化");
  return `${entityText(stateRegion) || stateRegion.key} · ${countryIncorporationLabel(relation.years)} · ${homeland}`;
}

function incorporationCalculatorInitialize(tag) {
  const country = byTag.get(tag);
  if (!country || state.incorporationCalculatorCountryTag === tag) return;
  state.incorporationCalculatorCountryTag = tag;
  state.incorporationCalculatorCultures = new Set(country.primaryCultures || []);
  state.incorporationCalculatorCandidateCultures = new Map(incorporationCalculatorCandidates(country).map((item) => [item.key, item]));
  state.incorporationCalculatorSearch = "";
}

function incorporationCalculatorToggleCulture(key) {
  if (!key || !byCulture.has(key)) return;
  if (state.incorporationCalculatorCultures.has(key)) state.incorporationCalculatorCultures.delete(key);
  else state.incorporationCalculatorCultures.add(key);
  render();
}

function incorporationCalculatorClear() {
  state.incorporationCalculatorCultures.clear();
  render();
}

function clearCultureIncorporationCalculatorState() {
  state.incorporationCalculatorCountryTag = "";
  state.incorporationCalculatorCultures.clear();
  state.incorporationCalculatorCandidateCultures.clear();
  state.incorporationCalculatorSearch = "";
}

function renderCultureIncorporationCalculator() {
  const country = byTag.get(state.incorporationCalculatorCountryTag);
  const candidates = [...(state.incorporationCalculatorCandidateCultures?.values() || [])]
    .filter((candidate) => !state.incorporationCalculatorSearch || incorporationCalculatorCandidateLabel(candidate).toLocaleLowerCase().includes(state.incorporationCalculatorSearch.toLocaleLowerCase()) || candidate.key.includes(state.incorporationCalculatorSearch.toLocaleLowerCase()))
    .sort((left, right) => localizedCompare(incorporationCalculatorCandidateLabel(left), incorporationCalculatorCandidateLabel(right)));
  const selected = incorporationCalculatorSelectedCultureObjects();
  const selectedHtml = selected.length
    ? selected.map((culture) => `<button type="button" class="culture-incorporation-selected-tag" data-incorporation-selected-culture="${escapeHtml(culture.key)}">${escapeHtml(entityText(culture) || culture.key)} ×</button>`).join("")
    : `<span class="empty">${escapeHtml(t("board.culture.incorporation.empty", "请选择文化"))}</span>`;
  const candidateHtml = candidates.map((candidate) => `<button type="button" class="culture-incorporation-candidate" data-incorporation-candidate="${escapeHtml(candidate.key)}" aria-pressed="${String(state.incorporationCalculatorCultures.has(candidate.key))}">${escapeHtml(incorporationCalculatorCandidateLabel(candidate))}</button>`).join("");
  els.countryList.className = "culture-incorporation-calculator-list";
  els.countryList.innerHTML = `
    <section class="culture-incorporation-calculator" data-culture-incorporation-calculator>
      <header class="culture-incorporation-calculator-header">
        <h2>${escapeHtml(t("board.culture.incorporation.title", "整合时长计算器"))}</h2>
        <p>${escapeHtml(country ? `${entityText(country)}（${country.tag}）` : t("board.culture.incorporation.noCountry", "未选择国家"))}</p>
      </header>
      <section class="culture-incorporation-calculator-section"><h3>${escapeHtml(t("board.culture.incorporation.selected", "已选文化"))}</h3><div class="culture-incorporation-selected" data-incorporation-selected>${selectedHtml}</div><button type="button" class="culture-incorporation-clear" data-incorporation-clear>${escapeHtml(t("board.culture.incorporation.clear", "清空文化"))}</button></section>
      <section class="culture-incorporation-calculator-section"><h3>${escapeHtml(t("board.culture.incorporation.candidates", "可能涉及的文化"))}</h3><input class="culture-incorporation-search" data-incorporation-search type="search" value="${escapeHtml(state.incorporationCalculatorSearch)}" placeholder="${escapeHtml(t("board.culture.incorporation.search", "搜索文化"))}"><div class="culture-incorporation-candidates" data-incorporation-candidates>${candidateHtml || `<span class="empty">${escapeHtml(t("ui.none", "无"))}</span>`}</div></section>
      <section class="culture-incorporation-calculator-section"><h3>${escapeHtml(t("board.culture.incorporation.results", "整合结果"))}</h3><div data-incorporation-results>${renderCultureIncorporationResults(selected)}</div></section>
    </section>`;
  bindCultureIncorporationCalculatorEvents();
}

function renderCultureIncorporationResults(selected) {
  if (!selected.length) return `<p class="empty">${escapeHtml(t("board.culture.incorporation.empty", "请选择文化"))}</p>`;
  return `<div class="culture-incorporation-results">${landStateRegions.map((stateRegion) => {
    const relation = countryIncorporationForStateRegion(stateRegion, null, selected);
    return `<div class="culture-incorporation-result-row"><span>${escapeHtml(entityText(stateRegion) || stateRegion.key)}</span><strong>${escapeHtml(countryIncorporationLabel(relation.years))}</strong><small>${escapeHtml(relation.culture ? entityText(relation.culture) || relation.culture.key : "")}</small></div>`;
  }).join("")}</div>`;
}

function bindCultureIncorporationCalculatorEvents() {
  els.countryList.querySelectorAll("[data-incorporation-candidate]").forEach((button) => button.addEventListener("click", () => incorporationCalculatorToggleCulture(button.dataset.incorporationCandidate)));
  els.countryList.querySelectorAll("[data-incorporation-selected-culture]").forEach((button) => button.addEventListener("click", () => incorporationCalculatorToggleCulture(button.dataset.incorporationSelectedCulture)));
  els.countryList.querySelector("[data-incorporation-clear]")?.addEventListener("click", incorporationCalculatorClear);
  els.countryList.querySelector("[data-incorporation-search]")?.addEventListener("input", (event) => { state.incorporationCalculatorSearch = event.target.value; renderCultureIncorporationCalculator(); });
}
