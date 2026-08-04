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
    const group = building.board_group || { key: "other", name_zh: "其他", order: 999, cluster_order: 999, item_order: 999 };
    if (!grouped.has(group.key)) grouped.set(group.key, { ...group, buildings: [] });
    grouped.get(group.key).buildings.push(building);
  }
  const groups = [...grouped.values()].sort((left, right) => (
    Number(left.order || 999) - Number(right.order || 999)
    || economyDisplayName(left).localeCompare(economyDisplayName(right), "zh-Hans-CN")
  ));
  for (const group of groups) {
    group.buildings.sort((left, right) => (
      Number(left.board_group?.cluster_order || 999) - Number(right.board_group?.cluster_order || 999)
      || Number(left.board_group?.item_order || 999) - Number(right.board_group?.item_order || 999)
      || economyDisplayName(left).localeCompare(economyDisplayName(right), "zh-Hans-CN")
    ));
  }
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
      <section class="economy-group economy-group--${escapeHtml(group.key)}" data-board-group="${escapeHtml(group.key)}">
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
  const selectedMethods = selectedProductionMethodsForGroups(methodGroups);
  els.detail.innerHTML = `<article class="economy-detail">
    ${economyDetailHead(building, "buildings", "building")}
    <section><h3>${escapeHtml(building.building_group?.name_zh || "建筑")}</h3><p>${building.resource_map_available ? "农业或资源建筑，可查看资源分布。" : ""}</p></section>
    ${building.unlocking_technologies?.length ? `<section><h3>解锁科技</h3><p>${referenceNames(building.unlocking_technologies)}</p></section>` : ""}
    ${building.resource_map_available ? `<button class="economy-resource-map" type="button" data-resource-map-building="${escapeHtml(building.key)}">打开资源地图</button>` : ""}
    <section class="production-method-section">
      <h3>生产方式</h3>
      ${methodGroups.map((group) => productionMethodGroupHtml(group, selectedMethods.get(group.key)?.key || "")).join("") || "<p>该建筑没有可选生产方式。</p>"}
    </section>
    ${productionCombinationSummaryHtml(selectedMethods)}
    ${renderSelectedProductionMethodDetail(selectedMethods)}
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
  const selected = methods.find((method) => method.key === selectedKey) || methods[0] || null;
  const open = state.openProductionMethodGroup === group.key;
  const alternatives = methods.filter((method) => method.key !== selected?.key);
  return `<section class="production-method-group">
    <h4>${escapeHtml(economyDisplayName(group))}</h4>
    <div class="production-method-options">
      ${selected ? `<button class="production-method-current" type="button" data-production-method-picker="${escapeHtml(group.key)}" data-production-method-key="${escapeHtml(selected.key)}" aria-expanded="${String(open)}" aria-label="${escapeHtml(`${economyDisplayName(group)}：${economyDisplayName(selected)}`)}" title="${escapeHtml(economyDisplayName(selected))}">${productionMethodIconHtml(selected)}</button>` : ""}
      ${open && alternatives.length ? `<div class="production-method-picker" role="group" aria-label="${escapeHtml(`${economyDisplayName(group)}的其他选项`)}">${alternatives.map((method) => `
        <button type="button" data-production-method-key="${escapeHtml(method.key)}" data-production-method-group="${escapeHtml(group.key)}" aria-label="${escapeHtml(economyDisplayName(method))}" title="${escapeHtml(economyDisplayName(method))}">
          ${productionMethodIconHtml(method)}
        </button>
      `).join("")}</div>` : ""}
    </div>
  </section>`;
}

function productionMethodIconHtml(method) {
  return method.icon
    ? `<img src="${economyAsset("production-methods", method.key)}" alt="" aria-hidden="true">`
    : "<span class=\"production-method-no-icon\" aria-hidden=\"true\"></span>";
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
  return `<details class="selected-production-method-detail"><summary>生产方式详情</summary><div class="selected-production-method-detail-content">${methods.map((method) => `
    <article>
      <h4>${escapeHtml(economyDisplayName(method))}</h4>
      ${method.description_zh ? `<p><strong>具体内容：</strong>${escapeHtml(method.description_zh)}</p>` : ""}
      ${method.unlocking_technologies?.length ? `<p><strong>前置科技：</strong>${referenceNames(method.unlocking_technologies)}</p>` : ""}
      ${method.availability_conditions?.length ? `<p><strong>可用条件：</strong>${method.availability_conditions.map((condition) => escapeHtml(condition.summary_zh || condition.raw)).join("；")}</p>` : ""}
      <h5>具体内容与修正</h5>
      ${method.effects?.length ? `<ul>${method.effects.map((effect) => `<li>${escapeHtml(productionEffectText(effect))}</li>`).join("")}</ul>` : "<p>没有数值修正。</p>"}
    </article>
  `).join("")}</div></details>`;
}

function productionCombinationSummaryHtml(selected) {
  const methods = [...selected.values()].filter(Boolean);
  const { totals, conditional } = combinedProductionEffects(methods);
  const effects = [...totals.values()];
  const employees = effects.filter((effect) => /^building_employment_.+_add$/.test(effect.key));
  const inputs = effects.filter((effect) => /^goods_input_[a-z0-9_]+_add$/.test(effect.key));
  const outputs = effects.filter((effect) => /^goods_output_[a-z0-9_]+_add$/.test(effect.key));
  const classified = new Set([...employees, ...inputs, ...outputs]);
  const modifiers = effects.filter((effect) => !classified.has(effect));
  if (conditional.length) modifiers.push(...conditional);
  const rows = [
    ["劳动力：", levelOneEmploymentText(employees), ""],
    ["投入商品：", levelOneGoodsText(inputs, "goods_input_"), ""],
    ["产出商品：", levelOneGoodsText(outputs, "goods_output_"), ""],
    ["标准产值：", annualProfitPerWorker(employees, inputs, outputs), "data-production-standard-output"],
    ["修正：", productionEffectListHtml(modifiers), ""],
  ];
  return `<section class="production-combination-summary" data-production-summary><h3>当前生产方式组合 <small>1级建筑</small></h3><dl>${rows.map(([label, value, attribute]) => `
    <div><dt>${label}</dt><dd${attribute ? ` ${attribute}` : ""}>${attribute || !String(value).startsWith("<") ? escapeHtml(value) : value}</dd></div>
  `).join("")}</dl></section>`;
}

function levelOneEmploymentText(effects) {
  const rows = effects
    .map((effect) => ({
      name: effect.name_zh?.replace(/\/级$/, "") || effect.key.match(/^building_employment_(.+)_add$/)?.[1] || effect.key,
      value: Number(effect.value || 0),
    }))
    .filter((row) => row.value > 0);
  return rows.length ? rows.map((row) => `${formatProductionNumber(row.value)}${row.name}`).join("，") : "无";
}

function levelOneGoodsText(effects, prefix) {
  const rows = effects
    .map((effect) => {
      const goodKey = effect.key.match(new RegExp(`^${prefix}([a-z0-9_]+)_add$`))?.[1] || "";
      return { name: economyDisplayName(goodByKey.get(goodKey)) || goodKey, value: Number(effect.value || 0) };
    })
    .filter((row) => row.value > 0);
  return rows.length ? rows.map((row) => `${formatProductionNumber(row.value)}${row.name}`).join("，") : "无";
}

function annualProfitPerWorker(employees, inputs, outputs) {
  const workforce = employees.reduce((total, effect) => total + Number(effect.value || 0), 0);
  if (workforce <= 0) return "无法计算（劳动力为0）";
  const inputValue = goodsBaseValue(inputs, "goods_input_");
  const outputValue = goodsBaseValue(outputs, "goods_output_");
  if (inputValue === null || outputValue === null) return "无法计算（缺少商品基础价格）";
  return `£${formatProductionNumber(((outputValue - inputValue) / workforce) * 52, 2)}/人/年`;
}

function goodsBaseValue(effects, prefix) {
  let total = 0;
  for (const effect of effects) {
    const goodKey = effect.key.match(new RegExp(`^${prefix}([a-z0-9_]+)_add$`))?.[1] || "";
    const price = Number(goodByKey.get(goodKey)?.price);
    if (!Number.isFinite(price)) return null;
    total += Number(effect.value || 0) * price;
  }
  return total;
}

function formatProductionNumber(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits, useGrouping: false }).format(Math.round(Number(value || 0) * 100) / 100);
}

function combinedProductionEffects(methods) {
  const totals = new Map();
  const conditional = [];
  for (const effect of methods.flatMap((method) => method.effects || [])) {
    if (effect.condition) {
      conditional.push(effect);
      continue;
    }
    const key = [effect.scope, effect.scaling, effect.key].join("|");
    const prior = totals.get(key) || { ...effect, value: 0, combined: true };
    prior.value += Number(effect.value || 0);
    totals.set(key, prior);
  }
  return { totals, conditional };
}

function productionEffectListHtml(effects) {
  if (!effects.length) return "无";
  return `<ul>${effects.map((effect) => `<li>${escapeHtml(productionEffectText(effect))}</li>`).join("")}</ul>`;
}

function productionScalingText(scaling) {
  return scaling === "workforce_scaled" ? "按劳动力" : scaling === "level_scaled" ? "按等级" : "固定";
}

function productionEffectText(effect) {
  const scale = effect.scaling ? productionScalingText(effect.scaling) : "";
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

function bindBuildingDetailEvents(building, groups) {
  els.detail.querySelectorAll("[data-production-method-picker]").forEach((button) => {
    button.addEventListener("click", () => {
      const groupKey = button.dataset.productionMethodPicker;
      state.openProductionMethodGroup = state.openProductionMethodGroup === groupKey ? "" : groupKey;
      renderBuildingDetail(building);
    });
  });
  els.detail.querySelectorAll("[data-production-method-key]").forEach((button) => {
    if (button.dataset.productionMethodPicker) return;
    button.addEventListener("click", () => {
      state.selectedProductionMethods.set(button.dataset.productionMethodGroup, button.dataset.productionMethodKey);
      state.openProductionMethodGroup = "";
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
    ${good.description_zh ? `<p>${escapeHtml(good.description_zh)}</p>` : ""}
    ${goodDefinitionHtml(good)}
    ${goodBuildingRelationsHtml("生产建筑", good.producing_buildings, "producer")}
    ${goodBuildingRelationsHtml("消费建筑", good.consuming_buildings, "consumer")}
    ${goodPopNeedsHtml(good.pop_needs)}
    ${goodPopulationRelationsHtml(good)}
    ${goodPrestigeVariantsHtml(variants)}
    <details class="goods-source-details"><summary>原始资料</summary><dl class="goods-facts"><div><dt>内部标识</dt><dd>${escapeHtml(good.key)}</dd></div><div><dt>来源文件</dt><dd>${escapeHtml(good.source_file || "无")}</dd></div></dl></details>
  </article>`;
  els.detail.querySelectorAll("[data-good-building]").forEach((button) => {
    button.addEventListener("click", () => openEconomyDetail("building", button.dataset.goodBuilding));
  });
  els.detail.querySelectorAll("[data-good-culture]").forEach((button) => {
    button.addEventListener("click", async () => {
      replaceHash(`/culture/${encodeURIComponent(button.dataset.goodCulture)}`);
      await applyHash();
      render();
    });
  });
  els.detail.querySelectorAll("[data-prestige-company]").forEach((button) => {
    button.addEventListener("click", async () => {
      replaceHash(`/company/${encodeURIComponent(button.dataset.prestigeCompany)}`);
      await applyHash();
      render();
    });
  });
  bindEconomyDetailBack("goods");
}

function goodDefinitionHtml(good) {
  const rows = [
    ["标准价格", `£${formatProductionNumber(good.price)}`, "data-good-standard-price"],
    ["商品类别", goodCategoryName(good.category), ""],
    ["可以贸易", yesNo(good.tradeable), ""],
    ["本地商品", yesNo(good.is_local), ""],
    ["固定价格", yesNo(good.fixed_price), ""],
    ["声望系数", formatProductionNumber(good.prestige_factor), ""],
    ["每次贸易数量", formatProductionNumber(good.traded_quantity), ""],
    ["运输成本系数", formatProductionNumber(good.convoy_cost_multiplier), ""],
    ["形成痴迷的概率权重", formatProductionNumber(good.obsession_chance), ""],
    ["消费税权威花费", Number.isFinite(good.consumption_tax_cost) ? `${formatProductionNumber(good.consumption_tax_cost)}权威` : "不可征收消费税", ""],
    ["人口消费增加基础设施", yesNo(good.pop_consumption_can_add_infrastructure), ""],
  ];
  return `<section class="goods-facts-section"><h3>基础属性</h3><dl class="goods-facts">${rows.map(([label, value, attribute]) => `<div><dt>${label}</dt><dd${attribute ? ` ${attribute}` : ""}>${escapeHtml(value)}</dd></div>`).join("")}</dl></section>`;
}

function yesNo(value) {
  return value ? "是" : "否";
}

function goodBuildingRelationsHtml(title, buildings, relation) {
  return `<section><h3>${title}</h3>${(buildings || []).length ? `<div class="economy-related-grid">${buildings.map((building) => `
    <button type="button" data-good-building="${escapeHtml(building.key)}" data-good-building-relation="${relation}"><img src="${economyAsset("buildings", building.key)}" alt=""><span>${escapeHtml(economyDisplayName(building))}</span></button>
  `).join("")}</div>` : `<p class="goods-empty">无</p>`}</section>`;
}

function goodPopNeedsHtml(needs) {
  return `<section><h3>满足人口需求</h3>${(needs || []).length ? `<div class="goods-needs">${needs.map((need) => `
    <article data-good-need="${escapeHtml(need.key)}">
      <h4>${escapeHtml(economyDisplayName(need))}${need.is_default ? " <small>默认商品</small>" : ""}</h4>
      <dl>${[
        ["权重", optionalGoodsNumber(need.weight)],
        ["最低供应占比", optionalGoodsShare(need.min_supply_share)],
        ["最高供应占比", optionalGoodsShare(need.max_supply_share)],
        ["财富等级", wealthLevelRanges(need.wealth_levels)],
        ["痴迷需求下限", optionalGoodsNumber(need.obsession_demand_min)],
        ["痴迷需求倍率", optionalGoodsNumber(need.obsession_demand_mult)],
        ["名贵商品需求增量", optionalGoodsShare(need.prestige_goods_demand_increase)],
      ].map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>
    </article>
  `).join("")}</div>` : `<p class="goods-empty">无</p>`}</section>`;
}

function optionalGoodsNumber(value) {
  return Number.isFinite(value) ? formatProductionNumber(value) : "未单独设置";
}

function optionalGoodsShare(value) {
  return Number.isFinite(value) ? `${formatProductionNumber(value * 100)}%` : "未单独设置";
}

function wealthLevelRanges(levels) {
  const values = [...new Set((levels || []).map(Number).filter(Number.isFinite))].sort((left, right) => left - right);
  if (!values.length) return "无";
  const ranges = [];
  let start = values[0];
  let end = start;
  for (const value of values.slice(1)) {
    if (value === end + 1) {
      end = value;
      continue;
    }
    ranges.push(start === end ? `${start}` : `${start}–${end}`);
    start = value;
    end = value;
  }
  ranges.push(start === end ? `${start}` : `${start}–${end}`);
  return ranges.join("、");
}

function goodPopulationRelationsHtml(good) {
  const cultures = (title, rows, relation) => `<section><h3>${title}</h3>${rows.length ? `<div class="goods-relation-tags">${rows.map((item) => `<button type="button" data-good-culture="${escapeHtml(item.key)}" data-good-culture-relation="${relation}">${escapeHtml(economyDisplayName(item))}</button>`).join("")}</div>` : `<p class="goods-empty">无</p>`}</section>`;
  const religions = good.taboo_religions || [];
  return `<div class="goods-population-relations">
    ${cultures("痴迷该商品的文化", good.obsessed_cultures || [], "obsession")}
    ${cultures("禁忌该商品的文化", good.taboo_cultures || [], "taboo")}
    <section><h3>禁忌该商品的宗教</h3>${religions.length ? `<div class="goods-relation-tags">${religions.map((item) => `<span data-good-taboo-religion="${escapeHtml(item.key)}">${conceptPill({ label: economyDisplayName(item), className: "tag-religion", kind: "religion", key: item.key })}</span>`).join("")}</div>` : `<p class="goods-empty">无</p>`}</section>
  </div>`;
}

function goodPrestigeVariantsHtml(variants) {
  return `<section><h3>名贵商品</h3>${variants.length ? `<div class="goods-prestige-list">${variants.map((variant) => `
    <article class="goods-prestige-card" data-prestige-good="${escapeHtml(variant.key)}">
      <header><img src="${economyAsset("prestige-goods", variant.key)}" alt=""><div><h4>${escapeHtml(economyDisplayName(variant))}</h4><p>${escapeHtml(variant.key)}</p></div></header>
      <h5>可生产公司</h5>
      ${(variant.companies || []).length ? `<div class="goods-company-list">${variant.companies.map((company) => `<button type="button" data-prestige-company="${escapeHtml(company.key)}">${companyIconHtml(company)}<span>${escapeHtml(economyDisplayName(company))}</span></button>`).join("")}</div>` : `<p class="goods-empty">无</p>`}
    </article>
  `).join("")}</div>` : `<p class="goods-empty">无</p>`}</section>`;
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
