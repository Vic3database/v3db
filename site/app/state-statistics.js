function stateStatisticsResourceLabel(item) {
  const source = buildingByKey.get(item?.key) || item;
  return entityText(source, "name", item?.key || "") || item?.key || "";
}

function stateStatisticsResourceIconHtml(item) {
  const label = stateStatisticsResourceLabel(item);
  const icon = buildingIconHtml(item?.key);
  return icon
    ? icon.replace('<img class="resource-icon"', `<img class="resource-icon state-statistics-resource-icon" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"`)
    : `<span class="state-statistics-resource-fallback" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">?</span>`;
}

function stateStatisticsResourceAmount(item, field = "amount") {
  const value = Number(item?.[field]);
  return Number.isFinite(value) ? value : 0;
}

function summarizeStateRegions(stateRegionRows) {
  const summary = {
    stateCount: 0,
    population: 0,
    arableLand: 0,
    cappedResources: new Map(),
    discoverableResources: new Map(),
    arableResources: new Map(),
    startingOwners: new Map(),
  };
  for (const stateRegion of stateRegionRows || []) {
    if (!stateRegion?.key) continue;
    summary.stateCount += 1;
    summary.population += Number(stateRegion.starting_population) || 0;
    summary.arableLand += Number(stateRegion.arable_land) || 0;
    for (const item of stateRegion.capped_resources || []) {
      if (!item?.key) continue;
      const current = summary.cappedResources.get(item.key) || { ...item, amount: 0, regions: [] };
      current.amount += stateStatisticsResourceAmount(item);
      current.regions.push(stateRegion.key);
      summary.cappedResources.set(item.key, current);
    }
    for (const item of stateRegion.discoverable_resources || []) {
      if (!item?.key) continue;
      const current = summary.discoverableResources.get(item.key) || { ...item, undiscovered_amount: 0, regions: [] };
      current.undiscovered_amount += stateStatisticsResourceAmount(item, "undiscovered_amount");
      current.regions.push(stateRegion.key);
      summary.discoverableResources.set(item.key, current);
    }
    for (const item of stateRegion.arable_resources || []) {
      if (!item?.key) continue;
      const current = summary.arableResources.get(item.key) || { ...item, regions: [] };
      current.regions.push(stateRegion.key);
      summary.arableResources.set(item.key, current);
    }
    for (const owner of stateRegion.starting_owners || []) {
      if (!owner?.tag) continue;
      const ownerSummary = summary.startingOwners.get(owner.tag) || {
        tag: owner.tag,
        population: 0,
        arableLand: 0,
        regions: [],
        cappedResources: new Map(),
        discoverableResources: new Map(),
      };
      ownerSummary.population += Number(stateRegion.starting_population) || 0;
      ownerSummary.arableLand += Number(stateRegion.arable_land) || 0;
      ownerSummary.regions.push(stateRegion.key);
      for (const item of stateRegion.capped_resources || []) {
        if (!item?.key) continue;
        const resource = ownerSummary.cappedResources.get(item.key) || { ...item, amount: 0 };
        resource.amount += stateStatisticsResourceAmount(item);
        ownerSummary.cappedResources.set(item.key, resource);
      }
      for (const item of stateRegion.discoverable_resources || []) {
        if (!item?.key) continue;
        const resource = ownerSummary.discoverableResources.get(item.key) || { ...item, undiscovered_amount: 0 };
        resource.undiscovered_amount += stateStatisticsResourceAmount(item, "undiscovered_amount");
        ownerSummary.discoverableResources.set(item.key, resource);
      }
      summary.startingOwners.set(owner.tag, ownerSummary);
    }
  }
  return summary;
}

function stateStatisticsCalculatorSearchText(stateRegion) {
  const label = entityText(stateRegion) || stateRegion.key;
  return `${label} ${stateRegion.key}`.toLocaleLowerCase();
}

function stateStatisticsCalculatorInitializeFromCountry(tag) {
  const country = byTag.get(tag);
  if (!country) return;
  state.stateStatisticsCalculatorSelected = new Set(country.startingStates || []);
  state.stateStatisticsCalculatorApplied = new Set();
  state.stateStatisticsCalculatorDirty = true;
  state.stateStatisticsCalculatorSearch = "";
}

function stateStatisticsCalculatorToggle(key) {
  if (!key || !byStateRegion.has(key)) return;
  if (state.stateStatisticsCalculatorSelected.has(key)) state.stateStatisticsCalculatorSelected.delete(key);
  else state.stateStatisticsCalculatorSelected.add(key);
  state.stateStatisticsCalculatorDirty = true;
  renderStateStatisticsCalculator();
  renderMapControls();
  if (mapRuntime.ready) {
    ensureMapLayer();
    paintMapCanvas();
  }
}

function stateStatisticsCalculatorStart() {
  state.stateStatisticsCalculatorApplied = new Set(state.stateStatisticsCalculatorSelected);
  state.stateStatisticsCalculatorDirty = false;
  renderStateStatisticsCalculator();
  renderMapControls();
  if (mapRuntime.ready) {
    ensureMapLayer();
    paintMapCanvas();
  }
}

function clearStateStatisticsCalculatorState() {
  state.stateStatisticsCalculatorSelected.clear();
  state.stateStatisticsCalculatorApplied.clear();
  state.stateStatisticsCalculatorSearch = "";
  state.stateStatisticsCalculatorDirty = false;
}

function stateStatisticsCalculatorRows() {
  const query = String(state.stateStatisticsCalculatorSearch || "").trim().toLocaleLowerCase();
  return landStateRegions
    .filter((row) => !query || stateStatisticsCalculatorSearchText(row).includes(query))
    .sort(sortStateRegions);
}

function stateStatisticsResourceRows(map, amountField, label) {
  return [...map.values()]
    .sort((left, right) => localizedCompare(stateStatisticsResourceLabel(left), stateStatisticsResourceLabel(right)))
    .map((item) => `<div class="state-statistics-resource-row"><span>${stateStatisticsResourceIconHtml(item)}</span><strong>${localizedNumber(item[amountField])}</strong></div>`)
    .join("") || `<span class="empty">${escapeHtml(t("ui.none", "无"))}</span>`;
}

function stateStatisticsRegionNames(keys) {
  return keys.map((key) => entityText(byStateRegion.get(key) || { key }) || key).join(t("ui.listSeparator", "、"));
}

function renderStateStatisticsCalculator() {
  const selected = [...state.stateStatisticsCalculatorSelected]
    .map((key) => byStateRegion.get(key))
    .filter(Boolean)
    .sort(sortStateRegions);
  const applied = [...state.stateStatisticsCalculatorApplied]
    .map((key) => byStateRegion.get(key))
    .filter(Boolean)
    .sort(sortStateRegions);
  const rows = stateStatisticsCalculatorRows();
  const summary = summarizeStateRegions(applied);
  const selectedHtml = selected.length
    ? selected.map((row) => `<button type="button" class="state-statistics-selected-tag" data-state-statistics-selected="${escapeHtml(row.key)}">${escapeHtml(entityText(row) || row.key)} ×</button>`).join("")
    : `<span class="empty">${escapeHtml(t("board.stateStatistics.empty", "请选择地域"))}</span>`;
  const rowHtml = rows.slice(0, 220).map((row) => `<button type="button" class="state-statistics-region-row" data-state-statistics-region="${escapeHtml(row.key)}" aria-pressed="${String(state.stateStatisticsCalculatorSelected.has(row.key))}"><span>${escapeHtml(entityText(row) || row.key)}</span><small>${escapeHtml(row.key)}</small></button>`).join("");
  const resourceRows = stateStatisticsResourceRows(summary.cappedResources, "amount", "amount");
  const discoverableRows = [...summary.discoverableResources.values()].sort((left, right) => localizedCompare(stateStatisticsResourceLabel(left), stateStatisticsResourceLabel(right))).map((item) => `<div class="state-statistics-resource-row state-statistics-discoverable-row"><span>${stateStatisticsResourceIconHtml(item)}<small>${escapeHtml(stateStatisticsRegionNames(item.regions))}</small></span><strong>${localizedNumber(item.undiscovered_amount)}</strong></div>`).join("") || `<span class="empty">${escapeHtml(t("ui.none", "无"))}</span>`;
  const arableRows = [...summary.arableResources.values()].sort((left, right) => localizedCompare(stateStatisticsResourceLabel(left), stateStatisticsResourceLabel(right))).map((item) => `<div class="state-statistics-resource-row"><span>${stateStatisticsResourceIconHtml(item)}</span><strong>${localizedNumber(item.regions.length)}</strong></div>`).join("") || `<span class="empty">${escapeHtml(t("ui.none", "无"))}</span>`;
  const ownerGroups = [...summary.startingOwners.values()]
    .sort((left, right) => localizedCompare(entityText(byTag.get(left.tag) || { tag: left.tag }) || left.tag, entityText(byTag.get(right.tag) || { tag: right.tag }) || right.tag))
    .map((owner) => `<details class="state-statistics-owner-group" data-state-statistics-owner-group><summary>${escapeHtml(entityText(byTag.get(owner.tag) || { tag: owner.tag }) || owner.tag)} <small>${escapeHtml(t("board.stateStatistics.ownerRegionCount", { count: owner.regions.length }))}</small></summary><div class="state-statistics-overview"><div><span>${escapeHtml(t("board.stateStatistics.population", "开局人口"))}</span><strong>${localizedNumber(owner.population)}</strong></div><div><span>${escapeHtml(t("board.stateStatistics.arableLand", "可耕地"))}</span><strong>${localizedNumber(owner.arableLand)}</strong></div></div><p class="state-statistics-owner-regions">${escapeHtml(stateStatisticsRegionNames(owner.regions))}</p><div class="state-statistics-resource-list">${stateStatisticsResourceRows(owner.cappedResources, "amount", "amount")}</div></details>`)
    .join("") || `<span class="empty">${escapeHtml(t("ui.none", "无"))}</span>`;
  const root = els.stateStatisticsPanel || els.countryList;
  if (!root) return;
  root.className = "state-statistics-calculator-list";
  root.innerHTML = `<section class="state-statistics-calculator" data-state-statistics-calculator>
    <header class="detail-title state-statistics-calculator-title"><button type="button" class="detail-back-button" data-state-statistics-back aria-label="${escapeHtml(t("board.stateStatistics.back", "返回地域板块"))}"><img class="lucide-icon" src="assets/lucide/icons/arrow-left.svg" alt="" aria-hidden="true"></button><div class="detail-title-main"><h2>${escapeHtml(t("board.stateStatistics.title", "地域资源与人口统计"))}</h2></div></header>
    <p class="state-statistics-description">${escapeHtml(t("board.stateStatistics.description", "选择地域后点击“开始统计”，汇总 1836 年开局人口、耕地、资源上限和可发现资源。"))}</p>
    <p class="state-statistics-guide">${escapeHtml(t("board.stateStatistics.guide", "单击地图或列表选择地域；修改选择后需要再次点击开始统计。"))}</p>
    <button type="button" class="culture-incorporation-start" data-state-statistics-start>${escapeHtml(t("board.stateStatistics.start", "开始统计"))}</button>
    ${state.stateStatisticsCalculatorDirty ? `<p class="state-statistics-dirty">${escapeHtml(t("board.stateStatistics.dirty", "选择已改变，请重新统计。"))}</p>` : ""}
    <section class="state-statistics-section"><h3>${escapeHtml(t("board.stateStatistics.selected", "已选地域"))}</h3><div class="state-statistics-selected">${selectedHtml}</div><button type="button" class="culture-incorporation-clear" data-state-statistics-clear>${escapeHtml(t("board.stateStatistics.clear", "清空地域"))}</button></section>
    <section class="state-statistics-section"><h3>${escapeHtml(t("board.stateStatistics.search", "搜索地域"))}</h3><input class="culture-incorporation-search" data-state-statistics-search type="search" value="${escapeHtml(state.stateStatisticsCalculatorSearch)}" placeholder="${escapeHtml(t("board.stateStatistics.searchPlaceholder", "名称或地域 ID"))}"><div class="state-statistics-region-list">${rowHtml || `<span class="empty">${escapeHtml(t("board.stateStatistics.noResults", "没有匹配地域"))}</span>`}</div></section>
    <section class="state-statistics-section" data-state-statistics-result><h3>${escapeHtml(t("board.stateStatistics.result", "统计结果"))}</h3><div class="state-statistics-overview"><div><span>${escapeHtml(t("board.stateStatistics.stateCount", "地域数量"))}</span><strong>${localizedNumber(summary.stateCount)}</strong></div><div><span>${escapeHtml(t("board.stateStatistics.population", "开局人口"))}</span><strong>${localizedNumber(summary.population)}</strong></div><div><span>${escapeHtml(t("board.stateStatistics.arableLand", "可耕地"))}</span><strong>${localizedNumber(summary.arableLand)}</strong></div></div><h4>${escapeHtml(t("board.stateStatistics.cappedResources", "资源上限"))}</h4><div class="state-statistics-resource-list">${resourceRows}</div><h4>${escapeHtml(t("board.stateStatistics.arableResources", "农业资源类型"))}</h4><div class="state-statistics-resource-list">${arableRows}</div><h4>${escapeHtml(t("board.stateStatistics.discoverableResources", "可发现资源"))}</h4><div class="state-statistics-resource-list">${discoverableRows}</div><h4>${escapeHtml(t("board.stateStatistics.startingOwners", "开局归属国家"))}</h4><div class="state-statistics-owner-groups">${ownerGroups}</div></section>
  </section>`;
  root.querySelectorAll("[data-state-statistics-region]").forEach((button) => button.addEventListener("click", () => stateStatisticsCalculatorToggle(button.dataset.stateStatisticsRegion)));
  root.querySelectorAll("[data-state-statistics-selected]").forEach((button) => button.addEventListener("click", () => stateStatisticsCalculatorToggle(button.dataset.stateStatisticsSelected)));
  root.querySelector("[data-state-statistics-start]")?.addEventListener("click", stateStatisticsCalculatorStart);
  root.querySelector("[data-state-statistics-clear]")?.addEventListener("click", () => { state.stateStatisticsCalculatorSelected.clear(); state.stateStatisticsCalculatorDirty = true; renderStateStatisticsCalculator(); renderMapControls(); });
  root.querySelector("[data-state-statistics-search]")?.addEventListener("input", (event) => { state.stateStatisticsCalculatorSearch = event.target.value; renderStateStatisticsCalculator(); });
  root.querySelector("[data-state-statistics-back]")?.addEventListener("click", async () => { clearStateStatisticsCalculatorState(); replaceHash("/region"); await applyHash(); render(); });
}
