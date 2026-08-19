let companyComposerCore = window.COMPANY_COMPOSER_CORE || null;

function companyComposerT(key, fallback, args = {}) {
  const template = translateMessage(key, fallback);
  return String(template).replace(/\{(\w+)\}/g, (_, name) => renderTextSpec(args[name]));
}

function companyComposerAvailable() {
  return companies.length > 0 && (Boolean(standaloneSiteConfig) || loadedDataVersion === "1.13.11");
}

function companyComposerState() {
  const selectedCompanyKeys = [];
  const seen = new Set();
  for (const key of state.companyComposer.selectedCompanyKeys || []) {
    if (!key || seen.has(key) || !byCompany.has(key)) continue;
    seen.add(key);
    selectedCompanyKeys.push(key);
  }
  const selectedExtensions = {};
  for (const key of selectedCompanyKeys) {
    const selected = state.companyComposer.selectedExtensions?.[key];
    const company = byCompany.get(key);
    if (selected && (company.extension_building_types || []).some((item) => item.key === selected)) selectedExtensions[key] = selected;
  }
  state.companyComposer.selectedCompanyKeys = selectedCompanyKeys;
  state.companyComposer.selectedExtensions = selectedExtensions;
  return { selectedCompanyKeys, selectedExtensions };
}

function companyComposerBuildingGroups() {
  return companySolverBuildingGroups.map((group) => ({
    key: group.key,
    buildingKeys: group.items.map((item) => item.buildingKey),
  }));
}

function companyComposerSummary() {
  if (!companyComposerCore?.composeCompanyBuildings) return null;
  const selected = companyComposerState();
  return companyComposerCore.composeCompanyBuildings({
    companies,
    selectedCompanyKeys: selected.selectedCompanyKeys,
    selectedExtensions: selected.selectedExtensions,
    buildingGroups: companyComposerBuildingGroups(),
  });
}

function companyComposerUseCore() {
  if (companyComposerCore?.composeCompanyBuildings) return true;
  companyComposerCore = window.COMPANY_COMPOSER_CORE || null;
  return Boolean(companyComposerCore?.composeCompanyBuildings);
}

function companyComposerCompanyLabel(company) {
  return entityText(company, "name", company?.key || companyComposerT("entity.company", "公司"));
}

function companyComposerBuildingLabel(key) {
  return entityText(buildingRecordByKey.get(key) || { key, loc: { name: `building:${key}.name` } }, "name", key);
}

function companyComposerCompanyIcon(company) {
  return companyIconHtml(company);
}

function companyComposerBuildingIcon(key) {
  return buildingIconHtml(key) || `<span class="company-composer-missing-icon">${escapeHtml(companyComposerBuildingLabel(key))}</span>`;
}

function companyComposerLinkedBuilding(key, summary) {
  const label = companyComposerBuildingLabel(key);
  const sourceKeys = summary?.buildingSources?.[key] || [];
  const sources = sourceKeys.map((companyKey) => byCompany.get(companyKey)).filter(Boolean);
  const sourceLabels = sources.map(companyComposerCompanyLabel);
  const title = sourceKeys.length > 1 && sourceLabels.length > 0
    ? `${label}；${companyComposerT("board.company.composer.coveredBy", "覆盖公司：{companies}", { companies: sourceLabels.join("、") })}`
    : label;
  const overlap = sourceKeys.length > 1 ? `<span class="company-composer-building-overlap" aria-hidden="true">×${sourceKeys.length}</span>` : "";
  return `<a class="company-composer-building-link" data-company-composer-building-coverage="${escapeHtml(key)}" href="#/building/${encodeURIComponent(key)}" title="${escapeHtml(title)}">${companyComposerBuildingIcon(key)}${overlap}</a>`;
}

function companyComposerLinkedCompany(company) {
  const label = companyComposerCompanyLabel(company);
  return `<a class="company-composer-company-link" href="#/company/${encodeURIComponent(company.key)}">${companyComposerCompanyIcon(company)}<span>${escapeHtml(label)}</span></a>`;
}

function companyComposerLinkedGood(item) {
  const label = entityText(item, "name", item.key);
  const baseKey = prestigeGoodByKey.get(item.key)?.base_good_key;
  const href = baseKey ? ` href="#/goods/${encodeURIComponent(baseKey)}"` : "";
  return `<a class="company-composer-good-link"${href} title="${escapeHtml(label)}">${goodsIconHtml(item, "company-composer-good-icon")}<span>${escapeHtml(label)}</span></a>`;
}

function companyComposerRestrictionText(items, route, fallbackField = "name") {
  return (items || []).map((item) => {
    const key = route === "country" ? (item.tag || item.key) : item.key;
    if (!key) return "";
    const label = route === "country"
      ? entityText(byTag.get(key) || item, fallbackField, key)
      : entityText(item, fallbackField, key);
    return `<span class="company-composer-restriction-tag" title="${escapeHtml(label)}">${escapeHtml(label)}</span>`;
  }).filter(Boolean).join("、");
}

function companyComposerFixedBuildingKeys(summary) {
  const ordered = [];
  const seen = new Set();
  for (const key of summary.buildingGroups.flatMap((group) => group.buildingKeys).concat(summary.unclassifiedBuildingKeys || [])) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    ordered.push(key);
  }
  return ordered;
}

function companyComposerProsperityHtml(groups) {
  if (!groups.length) return `<p class="empty">${escapeHtml(companyComposerT("ui.none", "无"))}</p>`;
  return groups.map((group) => {
    const categoryLabel = entityText(group.category, "name", group.key);
    const modifiers = group.modifiers.map((modifier) => `<span class="company-composer-prosperity-item" title="${escapeHtml(modifier.key)}">${escapeHtml(modifierSummaryLabel(modifier))}</span>`).join("");
    return `<section class="company-composer-prosperity-group"><h4>${escapeHtml(categoryLabel)}</h4><div>${modifiers}</div></section>`;
  }).join("");
}

function renderCompanyComposerDetail(summary) {
  if (!summary || !summary.selectedCompanies.length) {
    els.detail.innerHTML = `<section class="company-composer-detail-empty"><h2>${escapeHtml(companyComposerT("board.company.composer.summary", "组合建筑"))}</h2><p>${escapeHtml(companyComposerT("board.company.composer.empty", "选择公司后查看合并建筑和效果。"))}</p></section>`;
    return;
  }
  const fixedBuildingKeys = companyComposerFixedBuildingKeys(summary);
  const fixedBuildings = fixedBuildingKeys.map((key) => companyComposerLinkedBuilding(key, summary)).join("");
  const extensionRows = summary.extensionRows.map((row) => {
    const company = byCompany.get(row.companyKey);
    const options = row.optionKeys.map((key) => {
      const label = companyComposerBuildingLabel(key);
      const pressed = row.selectedExtensionKey === key;
      return `<button type="button" class="company-composer-extension-option${pressed ? " is-selected" : ""}" data-company-composer-extension-company="${escapeHtml(row.companyKey)}" data-company-composer-extension="${escapeHtml(key)}" aria-pressed="${String(pressed)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${companyComposerBuildingIcon(key)}</button>`;
    }).join("");
    return `<div class="company-composer-extension-row"><span>${escapeHtml(companyComposerCompanyLabel(company))}</span><div>${options}</div></div>`;
  }).join("");
  const prestigeGoods = summary.prestigeGoods.length
    ? `<section class="company-composer-summary-section"><h3>${escapeHtml(companyComposerT("board.company.prestigeGoods", "名贵商品"))}</h3><div class="company-composer-good-list">${summary.prestigeGoods.map(companyComposerLinkedGood).join("")}</div></section>` : "";
  const cultureText = companyComposerRestrictionText(summary.cultures, "culture");
  const countryText = companyComposerRestrictionText(summary.countries, "country");
  const restrictions = cultureText || countryText
    ? `<section class="company-composer-summary-section"><h3>${escapeHtml(companyComposerT("board.company.composer.restrictions", "Culture or country restrictions"))}</h3>${cultureText ? `<p><strong>${escapeHtml(companyComposerT("board.culture.title", "Culture"))}</strong>: <span class="company-composer-restriction-list">${cultureText}</span></p>` : ""}${countryText ? `<p><strong>${escapeHtml(companyComposerT("board.country.title", "Country"))}</strong>: <span class="company-composer-restriction-list">${countryText}</span></p>` : ""}</section>`
    : "";
  const extensionSection = extensionRows ? `<section class="company-composer-summary-section"><h3>${escapeHtml(companyComposerT("board.company.composer.optionalExtensions", "可选扩展"))}</h3>${extensionRows}</section>` : "";
  els.detail.innerHTML = `<section class="company-composer-summary"><div class="detail-title"><div class="detail-title-main"><h2>${escapeHtml(companyComposerT("board.company.composer.summary", "组合建筑"))}</h2></div></div><section class="company-composer-summary-section"><h3>${escapeHtml(companyComposerT("board.company.composer.fixedBuildings", "固定建筑"))}</h3><div class="company-composer-fixed-buildings">${fixedBuildings || `<p class="empty">${escapeHtml(companyComposerT("ui.none", "无"))}</p>`}</div></section>${extensionSection}${prestigeGoods}${restrictions}<section class="company-composer-summary-section"><h3>${escapeHtml(companyComposerT("board.company.composer.prosperity", "繁荣效果"))}</h3>${companyComposerProsperityHtml(summary.prosperityGroups)}</section></section>`;
}

function renderCompanyComposerBoard() {
  if (els.companySolverEntry) els.companySolverEntry.hidden = true;
  if (els.companyComposerEntry) els.companyComposerEntry.hidden = true;
  if (els.companySolverDetailPane) els.companySolverDetailPane.hidden = true;
  if (!companyComposerAvailable() || !companyComposerUseCore()) {
    els.resultCount.textContent = "";
    els.activeHint.textContent = companyComposerT("board.company.composer.unavailable", "公司建筑组合器仅支持原版 1.13.11。");
    els.countryList.className = "country-list company-composer-results";
    els.countryList.innerHTML = `<p class="empty">${escapeHtml(companyComposerT("board.company.composer.unavailable", "公司建筑组合器仅支持原版 1.13.11。"))}</p>`;
    els.detail.innerHTML = "";
    return;
  }
  const selected = companyComposerState();
  const selectedSet = new Set(selected.selectedCompanyKeys);
  const filtered = companies.filter(matchesCompanyComposerFilters).sort(sortCompanies);
  const selectedCompanies = selected.selectedCompanyKeys.map((key) => byCompany.get(key)).filter(Boolean);
  els.resultCount.textContent = companyComposerT("board.company.composer.resultCount", "{count} 家公司；已选 {selected} 家", { count: localizedNumber(filtered.length), selected: localizedNumber(selectedCompanies.length) });
  els.activeHint.textContent = "";
  els.countryList.className = "country-list company-composer-results";
  const card = (company, isSelected) => `<button type="button" class="company-composer-card${isSelected ? " is-selected" : ""}" data-company-composer-company="${escapeHtml(company.key)}" aria-pressed="${String(isSelected)}" aria-label="${escapeHtml(companyComposerCompanyLabel(company))}" title="${escapeHtml(companyComposerCompanyLabel(company))}">${companyComposerCompanyIcon(company)}<span>${escapeHtml(companyComposerCompanyLabel(company))}</span></button>`;
  const selectedHtml = selectedCompanies.length ? `<section class="company-composer-selected"><h2>${escapeHtml(companyComposerT("board.company.composer.selectedCompanies", "已选公司"))}</h2><div class="company-composer-wall">${selectedCompanies.map((company) => card(company, true)).join("")}</div></section>` : "";
  const availableHtml = filtered.filter((company) => !selectedSet.has(company.key)).map((company) => card(company, false)).join("");
  els.countryList.innerHTML = `<section class="company-composer-shell">${selectedHtml}<section class="company-composer-wall-section"><h2>${escapeHtml(companyComposerT("board.company.companies", "公司"))}</h2><div class="company-composer-wall">${availableHtml || `<p class="empty">${escapeHtml(companyComposerT("board.company.empty", "没有匹配结果。"))}</p>`}</div></section></section>`;
  renderCompanyComposerDetail(companyComposerSummary());
}

function companyComposerToggleCompany(key) {
  if (state.detailKind !== "companyComposer" || !byCompany.has(key)) return;
  const index = state.companyComposer.selectedCompanyKeys.indexOf(key);
  if (index >= 0) {
    state.companyComposer.selectedCompanyKeys.splice(index, 1);
    delete state.companyComposer.selectedExtensions[key];
  } else {
    state.companyComposer.selectedCompanyKeys.push(key);
  }
  render();
}

function companyComposerToggleExtension(companyKey, buildingKey) {
  if (state.detailKind !== "companyComposer") return;
  const company = byCompany.get(companyKey);
  if (!company || !(company.extension_building_types || []).some((item) => item.key === buildingKey)) return;
  if (state.companyComposer.selectedExtensions[companyKey] === buildingKey) delete state.companyComposer.selectedExtensions[companyKey];
  else state.companyComposer.selectedExtensions[companyKey] = buildingKey;
  render();
}

async function setCompanyComposerView() {
  if (!companyComposerAvailable()) return;
  changeBoard("company", "companyComposer");
  state.selectedCompany = "";
  replaceHash("/company/composer");
  await ensureDataChunksForRoute();
  render();
}

function bindCompanyComposerInteractions() {
  if (window.__companyComposerInteractionsBound) return;
  window.__companyComposerInteractionsBound = true;
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-company-composer-entry]")) {
      setCompanyComposerView();
      return;
    }
    const company = event.target.closest("[data-company-composer-company]");
    if (company) {
      companyComposerToggleCompany(company.dataset.companyComposerCompany);
      return;
    }
    const extension = event.target.closest("[data-company-composer-extension]");
    if (extension) companyComposerToggleExtension(extension.dataset.companyComposerExtensionCompany, extension.dataset.companyComposerExtension);
  });
}

window.__companyComposerDebug = () => {
  const summary = companyComposerSummary();
  return summary ? {
    selectedCompanyKeys: summary.selectedCompanies.map((company) => company.key),
    selectedExtensions: { ...state.companyComposer.selectedExtensions },
    buildingGroups: summary.buildingGroups,
    unclassifiedBuildingKeys: summary.unclassifiedBuildingKeys,
    prosperityGroups: summary.prosperityGroups,
  } : null;
};

bindCompanyComposerInteractions();
