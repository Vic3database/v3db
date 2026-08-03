function economyBoardAvailable(kind) {
  return Boolean(dataIndex?.chunks?.[kind] || (kind === "building" ? buildings.length : goods.length));
}

function economyDisplayName(item) {
  return item?.name_zh || item?.name_fallback_zh || item?.key || "";
}

function economyAsset(category, key) {
  return `assets/${category}/${encodeURIComponent(key)}.webp`;
}

function economyMatches(item, query) {
  const needle = String(query || "").trim().toLocaleLowerCase("zh-Hans-CN");
  if (!needle) return true;
  return [economyDisplayName(item), item?.description_zh, item?.key, item?.building_group?.name_zh, item?.category]
    .filter(Boolean)
    .join("\n")
    .toLocaleLowerCase("zh-Hans-CN")
    .includes(needle);
}

function renderBuildingBoard() {
  const query = state.economySearch;
  const grouped = new Map();
  for (const building of buildings.filter((item) => economyMatches(item, query))) {
    const group = building.building_group || { key: "other", name_zh: "其他", category_key: "other", order: 999 };
    if (!grouped.has(group.key)) grouped.set(group.key, { ...group, buildings: [] });
    grouped.get(group.key).buildings.push(building);
  }
  const groups = [...grouped.values()].sort((left, right) => (
    Number(left.order || 999) - Number(right.order || 999)
    || economyDisplayName(left).localeCompare(economyDisplayName(right), "zh-Hans-CN")
  ));
  const count = groups.reduce((total, group) => total + group.buildings.length, 0);
  renderEconomyShell({
    kind: "building",
    label: "建筑",
    count,
    groups,
    card: (building) => buildingCardHtml(building),
  });
  renderBuildingDetail(buildingRecordByKey.get(state.selectedBuilding) || null);
}

function renderGoodsBoard() {
  const query = state.economySearch;
  const grouped = new Map();
  for (const good of goods.filter((item) => economyMatches(item, query))) {
    const key = good.category || "other";
    if (!grouped.has(key)) grouped.set(key, { key, name_zh: goodCategoryName(key), buildings: [] });
    grouped.get(key).buildings.push(good);
  }
  const groups = [...grouped.values()].sort((left, right) => economyDisplayName(left).localeCompare(economyDisplayName(right), "zh-Hans-CN"));
  const count = groups.reduce((total, group) => total + group.buildings.length, 0);
  renderEconomyShell({
    kind: "goods",
    label: "商品",
    count,
    groups,
    card: (good) => goodCardHtml(good),
  });
  renderGoodsDetail(goodByKey.get(state.selectedGood) || null);
}

function renderEconomyShell({ kind, label, count, groups, card }) {
  els.countryList.innerHTML = `<section class="economy-shell" aria-label="${label}总览">
    <header class="economy-toolbar">
      <form class="economy-search" data-economy-search-form>
        <label for="economySearchInput">搜索${label}</label>
        <div class="economy-search-controls">
          <input id="economySearchInput" type="search" autocomplete="off" value="${escapeHtml(state.economySearch)}" placeholder="名称或类别" data-economy-search>
          <button type="submit">搜索</button>
        </div>
      </form>
      <strong class="economy-count">${count} 项${label}</strong>
    </header>
    <div class="economy-groups">${groups.map((group) => `
      <section class="economy-group economy-group--${escapeHtml(group.key)}">
        <h2>${escapeHtml(economyDisplayName(group))}<small>${group.buildings.length}</small></h2>
        <div class="economy-wall-grid">${group.buildings.map(card).join("")}</div>
      </section>
    `).join("") || `<p class="economy-empty">没有匹配的${label}。</p>`}</div>
  </section>`;
  els.resultCount.textContent = "";
  els.activeHint.textContent = "";
  bindEconomyBoardEvents(kind);
}

function buildingCardHtml(building) {
  const selected = building.key === state.selectedBuilding;
  return `<button class="economy-card" type="button" data-building-key="${escapeHtml(building.key)}" aria-pressed="${selected}">
    <img src="${economyAsset("buildings", building.key)}" alt="" aria-hidden="true" loading="lazy" decoding="async">
    <span>${escapeHtml(economyDisplayName(building))}</span>
  </button>`;
}

function goodCardHtml(good) {
  const selected = good.key === state.selectedGood;
  return `<button class="economy-card" type="button" data-good-key="${escapeHtml(good.key)}" aria-pressed="${selected}">
    <img src="${economyAsset("goods", good.key)}" alt="" aria-hidden="true" loading="lazy" decoding="async">
    <span>${escapeHtml(economyDisplayName(good))}</span>
  </button>`;
}

function bindEconomyBoardEvents(kind) {
  const search = els.countryList.querySelector("[data-economy-search]");
  els.countryList.querySelector("[data-economy-search-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.economySearch = search?.value || "";
    kind === "building" ? renderBuildingBoard() : renderGoodsBoard();
  });
  els.countryList.querySelectorAll("[data-building-key]").forEach((card) => {
    card.addEventListener("click", () => openEconomyDetail("building", card.dataset.buildingKey));
  });
  els.countryList.querySelectorAll("[data-good-key]").forEach((card) => {
    card.addEventListener("click", () => openEconomyDetail("goods", card.dataset.goodKey));
  });
}

async function openEconomyDetail(kind, key) {
  replaceHash(`/${kind}/${encodeURIComponent(key)}`);
  await applyHash();
  render();
}

function renderBuildingDetail(building) {
  if (!building) {
    els.detail.innerHTML = "";
    return;
  }
  const methodGroups = building.production_method_group_keys
    .map((key) => productionMethodGroupByKey.get(key))
    .filter(Boolean);
  const combinations = productionMethodCombinations(methodGroups);
  const selectedMethods = selectedProductionMethodsForGroups(methodGroups);
  els.detail.innerHTML = `<article class="economy-detail">
    ${economyDetailHead(building, "buildings", "building")}
    <section><h3>${escapeHtml(building.building_group?.name_zh || "建筑")}</h3><p>${building.resource_map_available ? "农业或资源建筑，可查看资源分布。" : ""}</p></section>
    ${building.unlocking_technologies?.length ? `<section><h3>解锁科技</h3><p>${referenceNames(building.unlocking_technologies)}</p></section>` : ""}
    ${building.resource_map_available ? `<button class="economy-resource-map" type="button" data-resource-map-building="${escapeHtml(building.key)}">打开资源地图</button>` : ""}
    <section class="production-method-section">
      <h3>生产方式 <small>${combinations.length} 种组合</small></h3>
      ${methodGroups.map((group) => productionMethodGroupHtml(group, selectedMethods.get(group.key)?.key || "")).join("") || "<p>该建筑没有可选生产方式。</p>"}
    </section>
    ${renderSelectedProductionMethodDetail(selectedMethods)}
    <details><summary>所有可能组合（${combinations.length}）</summary><ol class="production-combination-list">${combinations.map(productionCombinationHtml).join("")}</ol></details>
  </article>`;
  bindBuildingDetailEvents(building, methodGroups);
}

function economyDetailHead(item, category, kind) {
  return `<header class="economy-detail-head">
    <img src="${economyAsset(category, item.key)}" alt="">
    <div><h2>${escapeHtml(economyDisplayName(item))}</h2><p>${escapeHtml(item.key)}</p></div>
    <button type="button" data-economy-back="${kind}" aria-label="关闭详情">×</button>
  </header>`;
}

function productionMethodGroupHtml(group, selectedKey) {
  const methods = group.production_method_keys.map((key) => productionMethodByKey.get(key)).filter(Boolean);
  return `<section class="production-method-group">
    <h4>${escapeHtml(economyDisplayName(group))}</h4>
    <div class="production-method-options">${methods.map((method) => `
      <button type="button" data-production-method-key="${escapeHtml(method.key)}" data-production-method-group="${escapeHtml(group.key)}" aria-pressed="${String(method.key === selectedKey)}" title="${escapeHtml(economyDisplayName(method))}">
        ${method.icon ? `<img src="${economyAsset("production-methods", method.key)}" alt="">` : "<span class=\"production-method-no-icon\">无图标</span>"}
        <span>${escapeHtml(economyDisplayName(method))}</span>
      </button>
    `).join("")}</div>
  </section>`;
}

function selectedProductionMethodsForGroups(groups) {
  const selected = new Map();
  for (const group of groups) {
    const methods = group.production_method_keys.map((key) => productionMethodByKey.get(key)).filter(Boolean);
    const key = state.selectedProductionMethods.get(group.key);
    selected.set(group.key, methods.find((method) => method.key === key) || methods[0] || null);
  }
  return selected;
}

function renderSelectedProductionMethodDetail(selected) {
  const methods = [...selected.values()].filter(Boolean);
  if (!methods.length) return "";
  return `<section class="selected-production-method-detail"><h3>当前选择</h3>${methods.map((method) => `
    <article>
      <h4>${escapeHtml(economyDisplayName(method))}</h4>
      ${method.description_zh ? `<p><strong>具体内容：</strong>${escapeHtml(method.description_zh)}</p>` : ""}
      ${method.unlocking_technologies?.length ? `<p><strong>前置科技：</strong>${referenceNames(method.unlocking_technologies)}</p>` : ""}
      ${method.availability_conditions?.length ? `<p><strong>可用条件：</strong>${method.availability_conditions.map((condition) => escapeHtml(condition.summary_zh || condition.raw)).join("；")}</p>` : ""}
      <h5>具体内容与修正</h5>
      ${method.effects?.length ? `<ul>${method.effects.map((effect) => `<li>${escapeHtml(productionEffectText(effect))}</li>`).join("")}</ul>` : "<p>没有数值修正。</p>"}
    </article>
  `).join("")}</section>`;
}

function productionEffectText(effect) {
  const scale = effect.scaling === "workforce_scaled" ? "按劳动力" : effect.scaling === "level_scaled" ? "按等级" : "";
  const condition = effect.condition?.summary_zh ? `；条件：${effect.condition.summary_zh}` : "";
  const value = effect.combined ? combinedProductionValue(effect) : (effect.value_zh || `${effect.value > 0 ? "+" : ""}${effect.value}`);
  return `${effect.scope}：${effect.name_zh || effect.key} ${value}${scale ? `（${scale}）` : ""}${condition}`;
}

function combinedProductionValue(effect) {
  if (String(effect.value_zh || "").includes("%")) {
    const percent = Math.round(Number(effect.value || 0) * 10000) / 100;
    return `${percent > 0 ? "+" : ""}${percent}%`;
  }
  return `${effect.value > 0 ? "+" : ""}${effect.value}`;
}

function productionMethodCombinations(groups) {
  return groups.reduce((rows, group) => {
    const methods = group.production_method_keys.map((key) => productionMethodByKey.get(key)).filter(Boolean);
    return methods.length ? rows.flatMap((row) => methods.map((method) => [...row, method])) : rows;
  }, [[]]);
}

function productionCombinationHtml(methods) {
  const totals = new Map();
  const conditional = [];
  for (const effect of methods.flatMap((method) => method.effects || [])) {
    const label = productionEffectText(effect);
    if (effect.condition) {
      conditional.push(label);
      continue;
    }
    const key = [effect.scope, effect.scaling, effect.key].join("|");
    const prior = totals.get(key) || { ...effect, value: 0, combined: true };
    prior.value += Number(effect.value || 0);
    totals.set(key, prior);
  }
  const totalText = [...totals.values()].map((effect) => productionEffectText(effect)).join("；");
  const conditionalText = conditional.length ? `；条件修正：${conditional.join("；")}` : "";
  return `<li><strong>${escapeHtml(methods.map(economyDisplayName).join(" × "))}</strong>${totalText ? `<span>${escapeHtml(totalText)}${escapeHtml(conditionalText)}</span>` : ""}</li>`;
}

function bindBuildingDetailEvents(building, groups) {
  els.detail.querySelectorAll("[data-production-method-key]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedProductionMethods.set(button.dataset.productionMethodGroup, button.dataset.productionMethodKey);
      renderBuildingDetail(building);
    });
  });
  els.detail.querySelector("[data-resource-map-building]")?.addEventListener("click", async () => {
    await openResourceMap(building.key);
  });
  bindEconomyDetailBack("building");
}

async function openResourceMap(buildingKey) {
  if (!resourceFilterByKey.has(buildingKey)) addEconomyResourceFilter(buildingKey);
  state.resourceFilters = new Set([buildingKey]);
  state.regionMapView = "default";
  replaceHash(`/region/resource/${encodeURIComponent(buildingKey)}`);
  await applyHash();
  render();
}

function addEconomyResourceFilter(buildingKey) {
  const building = buildingRecordByKey.get(buildingKey);
  if (!building?.resource_map_available || resourceFilterByKey.has(buildingKey)) return;
  const agriculture = building.resource_map_kind === "arable";
  const group = resourceFilterGroups.find((item) => item.key === (agriculture ? "agriculture" : "resources"));
  if (!group) return;
  group.filters.push({
    key: buildingKey,
    label: economyDisplayName(building),
    ...(agriculture ? { arableResources: [buildingKey] } : { resources: [buildingKey] }),
  });
  resourceFilterByKey.set(buildingKey, group.filters[group.filters.length - 1]);
}

function syncEconomyResourceFilters() {
  for (const building of buildings) {
    if (building?.resource_map_available) addEconomyResourceFilter(building.key);
  }
}

function renderGoodsDetail(good) {
  if (!good) {
    els.detail.innerHTML = "";
    return;
  }
  const variants = (good.prestige_good_keys || []).map((key) => prestigeGoodByKey.get(key)).filter(Boolean);
  els.detail.innerHTML = `<article class="economy-detail">
    ${economyDetailHead(good, "goods", "goods")}
    <section><h3>${escapeHtml(goodCategoryName(good.category))}</h3>${good.description_zh ? `<p>${escapeHtml(good.description_zh)}</p>` : ""}</section>
    <section><h3>可生产建筑</h3><div class="economy-related-grid">${(good.producing_buildings || []).map((building) => `
      <button type="button" data-good-building="${escapeHtml(building.key)}"><img src="${economyAsset("buildings", building.key)}" alt=""><span>${escapeHtml(economyDisplayName(building))}</span></button>
    `).join("") || "<p>没有建筑生产此商品。</p>"}</div></section>
    ${variants.length ? `<section><h3>名贵商品</h3><div class="economy-related-grid">${variants.map((variant) => `
      <div><img src="${economyAsset("prestige-goods", variant.key)}" alt=""><span>${escapeHtml(economyDisplayName(variant))}</span></div>
    `).join("")}</div></section>` : ""}
  </article>`;
  els.detail.querySelectorAll("[data-good-building]").forEach((button) => {
    button.addEventListener("click", () => openEconomyDetail("building", button.dataset.goodBuilding));
  });
  bindEconomyDetailBack("goods");
}

function bindEconomyDetailBack(kind) {
  els.detail.querySelector("[data-economy-back]")?.addEventListener("click", async () => {
    replaceHash(`/${kind}`);
    await applyHash();
    render();
  });
}

function referenceNames(references) {
  return (references || []).map((reference) => reference.name_zh || reference.key).filter(Boolean).map(escapeHtml).join("、") || "无";
}

function goodCategoryName(key) {
  return ({ staple: "基础商品", industrial: "工业商品", luxury: "奢侈品", military: "军用商品", pop: "人口需求", local: "本地商品" })[key] || key || "其他";
}
