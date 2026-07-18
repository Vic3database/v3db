function bindEvents() {
  document.querySelectorAll("[data-nav-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      await setView(button.dataset.navView);
      render();
    });
  });
  els.settingsNavButton?.addEventListener("click", () => {
    openInfoDialog("settings");
  });
  els.aboutNavButton?.addEventListener("click", () => {
    openInfoDialog("about");
  });
  els.globalSearchButton?.addEventListener("click", openGlobalSearchDialog);
  els.globalSearchCloseButton?.addEventListener("click", closeGlobalSearchDialog);
  els.globalSearchDialog?.addEventListener("click", (event) => {
    if (event.target === els.globalSearchDialog) closeGlobalSearchDialog();
  });
  els.infoDialogCloseButton?.addEventListener("click", closeInfoDialog);
  els.infoDialog?.addEventListener("click", (event) => {
    if (event.target === els.infoDialog) closeInfoDialog();
  });
  els.globalSearchDialogInput?.addEventListener("input", () => {
    state.globalSearch = els.globalSearchDialogInput.value.trim().toLowerCase();
    state.globalSearchActiveIndex = 0;
    renderGlobalSearchDialogResults();
  });
  els.globalSearchLegacyToggle?.addEventListener("change", () => {
    state.globalSearchIncludeLegacy = els.globalSearchLegacyToggle.checked;
    renderGlobalSearchDialogResults();
  });
  document.addEventListener("keydown", handleGlobalSearchDialogKeydown);
  document.addEventListener("keydown", handleInfoDialogKeydown);
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-detail-back]");
    if (!button) return;
    await setView(button.dataset.detailBack || "country");
    render();
  });
  els.countryViewButton?.addEventListener("click", async () => {
    await setView("country");
    render();
  });
  els.cultureViewButton?.addEventListener("click", async () => {
    await setView("culture");
    render();
  });
  els.regionViewButton?.addEventListener("click", async () => {
    await setView("region");
    render();
  });
  els.companyViewButton?.addEventListener("click", async () => {
    await setView("company");
    render();
  });
  els.ideologyViewButton?.addEventListener("click", async () => {
    await setView("ideology");
    render();
  });
  els.lawViewButton?.addEventListener("click", async () => {
    await setView("law");
    render();
  });
  els.viewSelect?.addEventListener("change", async () => {
    await setView(els.viewSelect.value);
    render();
  });
  els.versionSelect?.addEventListener("change", async () => {
    hideTransientOverlays();
    els.versionSelect.disabled = true;
    try {
      await loadVersion(els.versionSelect.value);
      renderFilterOptions();
      await applyHash();
      render();
    } finally {
      els.versionSelect.disabled = false;
    }
  });
  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value.trim().toLowerCase();
    state.globalSearchColorRestoreTag = "";
    render();
  });

  bindTokenSet("[data-filter]", state.flags, "filter");
  bindTokenSet("[data-tier]", state.tiers, "tier");
  bindTokenSet("[data-type]", state.types, "type");
  els.filteredCountryMapToggle?.addEventListener("click", () => {
    state.dimUnfilteredCountries = !state.dimUnfilteredCountries;
    render();
  });
  bindContainerTokenSet(els.strategicRegionFilters, state.strategicRegions, "strategicRegion");
  els.geographicRegionFilters?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-geographic-region-filter]");
    if (!button || !els.geographicRegionFilters.contains(button)) return;
    const value = button.dataset.geographicRegionFilter;
    state.selectedGeographicRegion = state.selectedGeographicRegion === value ? "" : value;
    render();
  });
  bindResourceFilterTokens();
  bindTokenChoice(els.industryCharterFilters, "industryCharter", () => {
    state.includeIndustryCharter = !state.includeIndustryCharter;
    renderCompanyFilterOptions();
    render();
  });
  bindContainerTokenSet(els.companyKindFilters, state.companyKinds, "companyKind");
  bindContainerTokenSet(els.companyPrestigeFilters, state.companyPrestigeGoods, "companyPrestige");
  bindContainerTokenSet(els.companyDlcFilters, state.companyDlcs, "companyDlc");
  bindContainerTokenSet(els.ideologyTypeFilters, state.ideologyTypes, "ideologyType");
  bindContainerTokenSet(els.ideologyGroupFilters, state.ideologyGroups, "ideologyGroup");
  bindContainerTokenSet(els.ideologyOccurrenceFilters, state.ideologyOccurrences, "ideologyOccurrence");
  bindContainerTokenSet(els.ideologyLawGroupFilters, state.ideologyLawGroups, "ideologyLawGroup");
  bindLawGroupFilterTokens();
  els.commonLawIdeologyFilter?.addEventListener("change", () => {
    state.commonLawIdeologyOnly = els.commonLawIdeologyFilter.checked;
    render();
  });
  bindContainerTokenSet(els.heritageGroupFilters, state.heritageGroups, "heritageGroup", () => {
    renderDependentFilterOptions();
  });
  bindContainerTokenSet(els.heritageGroupFilters, state.heritages, "heritage");
  bindContainerTokenSet(els.languageGroupFilters, state.languageGroups, "languageGroup", () => {
    renderDependentFilterOptions();
  });
  bindContainerTokenSet(els.languageGroupFilters, state.languages, "language");
  bindTokenChoice(els.traditionFilters, "tradition", (value) => {
    state.tradition = state.tradition === value ? "" : value;
    syncTokenGroup(els.traditionFilters, state.tradition);
    render();
  });

  els.sortSelect.addEventListener("change", () => {
    state.sort = els.sortSelect.value;
    render();
  });
  els.mapModeSelect.addEventListener("change", () => {
    state.mapMode = els.mapModeSelect.value;
    state.mapSubject = "";
    render();
  });
  els.mapSubjectSelect.addEventListener("change", () => {
    state.mapSubject = els.mapSubjectSelect.value;
    render();
  });
  els.mapFitWidthButton?.addEventListener("click", () => {
    fitMapToWidth();
  });
  els.leftPanelToggle?.addEventListener("click", () => {
    document.body.classList.toggle("filters-collapsed");
    updatePanelToggleState();
  });
  els.bottomPanelToggle?.addEventListener("click", () => {
    cycleResultsPanelMode();
  });
  bindMapEvents();
  bindConceptEvents();
  els.resetButton.addEventListener("click", () => {
    hideTransientOverlays();
    state.search = "";
    state.globalSearch = "";
    state.flags.clear();
    state.tiers.clear();
    state.types.clear();
    state.strategicRegions.clear();
    state.heritageGroups.clear();
    state.heritages.clear();
    state.languageGroups.clear();
    state.languages.clear();
    state.resourceFilters.clear();
    state.companyKinds.clear();
    state.includeIndustryCharter = false;
    state.companyPrestigeGoods.clear();
    state.companyDlcs.clear();
    state.ideologyTypes.clear();
    state.ideologyGroups.clear();
    state.ideologyOccurrences.clear();
    state.ideologyLawGroups.clear();
    state.lawGroups.clear();
    state.commonLawIdeologyOnly = false;
    state.dimUnfilteredCountries = false;
    state.tradition = "";
    state.mapSubject = "";
    state.selectedGlobalResult = "";
    els.searchInput.value = "";
    if (els.commonLawIdeologyFilter) els.commonLawIdeologyFilter.checked = false;
    if (els.globalSearchDialogInput) els.globalSearchDialogInput.value = "";
    document.querySelectorAll("[data-filter-token]").forEach((button) => setTokenPressed(button, false));
    setTokenPressed(els.filteredCountryMapToggle, false);
    renderDependentFilterOptions();
    render();
  });
  window.addEventListener("hashchange", async () => {
    hideTransientOverlays();
    state.globalSearch = "";
    state.selectedGlobalResult = "";
    if (els.globalSearchDialogInput) els.globalSearchDialogInput.value = "";
    await applyHash();
    render();
  });
}

function initTheme() {
  setTheme("votp", false);
}

function initDisplaySettings() {
  const getStored = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      if (value === null) return fallback;
      return value === "true";
    } catch {
      return fallback;
    }
  };
  state.whiteDecentralized = getStored("vicdata-white-decentralized", state.whiteDecentralized);
  state.subjectOverlordColors = getStored("vicdata-subject-overlord-colors", state.subjectOverlordColors);
  state.omitIndigenousLanguagesCultures = getStored("vicdata-omit-indigenous", state.omitIndigenousLanguagesCultures);
  state.omitDecentralizedTags = getStored("vicdata-omit-decentralized-tags", state.omitDecentralizedTags);
}

function persistDisplaySetting(key, value) {
  try {
    localStorage.setItem(key, String(Boolean(value)));
  } catch {
    // 浏览器禁用本地存储时仅保留本次页面状态。
  }
}

function setTheme(theme, persist = true) {
  state.theme = "votp";
  document.body.dataset.theme = state.theme;
  if (persist && theme === "votp") {
    try {
      localStorage.setItem("vicdata-theme", state.theme);
    } catch {
      // 浏览器禁用本地存储时只保留本次页面状态。
    }
  }
}

function bindTokenSet(selector, set, datasetKey, afterChange) {
  document.querySelectorAll(selector).forEach((button) => {
    button.addEventListener("click", async () => {
      const pressed = button.getAttribute("aria-pressed") === "true";
      setTokenPressed(button, !pressed);
      toggleSet(set, button.dataset[datasetKey], !pressed);
      if (afterChange) afterChange();
      render();
    });
  });
}

function bindContainerTokenSet(container, set, datasetKey, afterChange) {
  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter-token]");
    if (!button || !container.contains(button)) return;
    const value = button.dataset[datasetKey];
    if (!value) return;
    const pressed = button.getAttribute("aria-pressed") === "true";
    setTokenPressed(button, !pressed);
    toggleSet(set, value, !pressed);
    if (afterChange) afterChange();
    render();
  });
}

function bindResourceFilterTokens() {
  els.resourceFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter-token]");
    if (!button || !els.resourceFilters.contains(button)) return;
    const value = button.dataset.resourceFilter;
    if (!value) return;
    const pressed = button.getAttribute("aria-pressed") === "true";
    if (state.view === "region") {
      state.resourceFilters.clear();
      if (!pressed) state.resourceFilters.add(value);
      state.mapSubject = "";
      render();
      return;
    }
    setTokenPressed(button, !pressed);
    toggleSet(state.resourceFilters, value, !pressed);
    render();
  });
}

function bindTokenChoice(container, datasetKey, onChange) {
  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter-token]");
    if (!button || !container.contains(button)) return;
    onChange(button.dataset[datasetKey]);
  });
}

function bindConceptEvents() {
  document.addEventListener("contextmenu", (event) => {
    const target = event.target.closest("[data-concept-key]");
    if (!target) return;
    event.preventDefault();
    searchConcept(target);
    hideConceptTooltip();
  });
  document.addEventListener("pointerover", (event) => {
    const target = event.target.closest("[data-concept-key]");
    if (!target) return;
    scheduleConceptTooltip(target, event);
  });
  document.addEventListener("pointermove", (event) => {
    if (pendingConceptTooltipTarget) {
      scheduleConceptTooltip(pendingConceptTooltipTarget, event);
    }
    if (!els.conceptTooltip || els.conceptTooltip.hidden) return;
    moveConceptTooltip(event);
  });
  document.addEventListener("pointerout", (event) => {
    const target = event.target.closest("[data-concept-key]");
    if (!target) return;
    if (event.relatedTarget && target.contains(event.relatedTarget)) return;
    hideConceptTooltip();
  });
  document.addEventListener("mouseover", (event) => {
    const target = event.target.closest("[data-concept-key]");
    if (!target) return;
    scheduleConceptTooltip(target, event);
  });
  document.addEventListener("mousemove", (event) => {
    if (pendingConceptTooltipTarget) {
      scheduleConceptTooltip(pendingConceptTooltipTarget, event);
    }
    if (!els.conceptTooltip || els.conceptTooltip.hidden) return;
    moveConceptTooltip(event);
  });
  document.addEventListener("mouseout", (event) => {
    const target = event.target.closest("[data-concept-key]");
    if (!target) return;
    if (event.relatedTarget && target.contains(event.relatedTarget)) return;
    hideConceptTooltip();
  });
  document.addEventListener("focusin", (event) => {
    const target = event.target.closest("[data-concept-key]");
    if (!target) return;
    const rect = target.getBoundingClientRect();
    showConceptTooltip(target, { clientX: rect.right, clientY: rect.top });
  });
  document.addEventListener("focusout", (event) => {
    const target = event.target.closest("[data-concept-key]");
    if (!target) return;
    hideConceptTooltip();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideConceptTooltip();
  });
}

function scheduleConceptTooltip(target, event) {
  if (!els.conceptTooltip) return;
  if (document.body.classList.contains("results-collapsed")) {
    hideConceptTooltip();
    return;
  }
  clearConceptTooltipTimer();
  pendingConceptTooltipTarget = target;
  pendingConceptTooltipPoint = conceptTooltipPoint(event);
  conceptTooltipTimer = window.setTimeout(() => {
    const delayedTarget = pendingConceptTooltipTarget;
    const delayedPoint = pendingConceptTooltipPoint;
    clearConceptTooltipTimer();
    if (!delayedTarget?.isConnected || !delayedPoint) return;
    showConceptTooltip(delayedTarget, delayedPoint);
  }, CONCEPT_TOOLTIP_DELAY_MS);
}

function conceptTooltipPoint(event) {
  return { clientX: event.clientX, clientY: event.clientY };
}

function clearConceptTooltipTimer() {
  if (conceptTooltipTimer) {
    window.clearTimeout(conceptTooltipTimer);
    conceptTooltipTimer = 0;
  }
  pendingConceptTooltipTarget = null;
  pendingConceptTooltipPoint = null;
}

function showConceptTooltip(target, event) {
  if (!els.conceptTooltip) return;
  if (document.body.classList.contains("results-collapsed")) {
    hideConceptTooltip();
    return;
  }
  const isIdeology = target.dataset.conceptKind === "ideology";
  els.conceptTooltip.classList.toggle("ideology-tooltip", isIdeology);
  els.conceptTooltip.innerHTML = isIdeology ? ideologyTooltipRows(target) : conceptTooltipRows(target);
  els.conceptTooltip.hidden = false;
  moveConceptTooltip(event);
}

function ideologyTooltipRows(target) {
  const key = target.dataset.conceptKey || "";
  const ideology = ideologyByKey.get(key);
  if (!ideology) return conceptTooltipRows(target);
  return `
    <div class="ideology-tooltip-head">
      <div class="ideology-tooltip-identity">
        ${ideologyIconHtml(ideology, "ideology-tooltip-icon")}
        <div>
          <div class="ideology-tooltip-title">${escapeHtml(ideology.name_zh || ideology.key)}</div>
          <div class="ideology-tooltip-id">${escapeHtml(ideology.key)}</div>
        </div>
      </div>
      <div class="ideology-tooltip-type">${escapeHtml(ideologyTypeLabels.get(ideologyTypeKey(ideology)) || "")}</div>
    </div>
    ${ideologyTooltipAttitudeGroups(ideology)}
    ${ideology.desc_zh ? `<p class="ideology-tooltip-desc">${escapeHtml(cleanIdeologyDescription(ideology.desc_zh))}</p>` : ""}
  `;
}

function ideologyTooltipAttitudeGroups(ideology) {
  return groupLawStances(ideology?.law_stances || []).map((group) => {
    const items = [...group.items].sort((left, right) => {
      const leftLaw = lawByKey.get(left.law_key) || left;
      const rightLaw = lawByKey.get(right.law_key) || right;
      return sortLaws(leftLaw, rightLaw);
    });
    return `
      <section class="ideology-tooltip-attitude-group">
        <h4>对${escapeHtml(group.name)}的态度</h4>
        ${ideologyTooltipAttitudeLines(items)}
      </section>
    `;
  }).join("");
}

function ideologyTooltipAttitudeLines(stances) {
  const grouped = new Map();
  for (const stance of stances || []) {
    const key = stance.stance || "neutral";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(stance);
  }
  return lawStanceDisplayOrder.filter((stance) => grouped.has(stance)).map((stance) => {
    const names = grouped.get(stance).map((item) => {
      const law = lawByKey.get(item.law_key) || item;
      return lawDisplayName(law);
    }).filter(Boolean).join("、");
    return `<div class="ideology-tooltip-attitude-line ${lawStanceClassName(stance)}"><span>${escapeHtml(lawStanceSentencePrefix(stance))}</span> ${escapeHtml(names)}</div>`;
  }).join("");
}

function conceptTooltipRows(target) {
  const label = target.dataset.conceptLabel || target.textContent?.trim() || "";
  const key = target.dataset.conceptKey || "";
  const kind = target.dataset.conceptKind || "";
  const kindText = conceptKindLabel(kind);
  const context = conceptTooltipContextLine(kind, key);
  return [
    `<strong>${escapeHtml(label || key)}</strong>`,
    `<span>${escapeHtml([kindText, key].filter(Boolean).join(" · "))}</span>`,
    context ? `<span>${escapeHtml(context)}</span>` : "",
    `<small>${escapeHtml(conceptTooltipActionText(target))}</small>`,
  ].filter(Boolean).join("");
}

function conceptTooltipContextLine(kind, key) {
  if (!key) return "";
  if (kind === "country") {
    const country = byTag.get(key);
    return [countryTypeTagLabel(country || {}), country?.tierZh].filter(Boolean).join(" · ");
  }
  if (kind === "culture") {
    const culture = byCulture.get(key);
    return [culture?.heritage?.name_zh, culture?.language?.name_zh].filter(Boolean).join(" · ");
  }
  if (kind === "stateRegion") {
    const stateRegion = byStateRegion.get(key);
    return [refNames(stateRegion?.strategic_regions), resourceSummaryText(stateRegion)].filter(Boolean).join(" · ");
  }
  if (kind === "strategicRegion") {
    const region = byStrategicRegion.get(key);
    const count = (region?.states || []).length;
    return count ? `${count} 个州地区` : "";
  }
  if (kind === "geographicRegion") {
    const region = byGeographicRegion.get(key);
    const count = geographicRegionStateRegions(region).length;
    return count ? `${count} 个州地区` : "";
  }
  if (kind === "company") {
    const company = byCompany.get(key);
    return [companyKindText(company || {}), company?.category_zh || company?.category].filter(Boolean).join(" · ");
  }
  if (kind === "ideology") {
    const ideology = ideologyByKey.get(key);
    return [
      ideologyTypeLabels.get(ideologyTypeKey(ideology || {})),
      refNames(ideologyInterestGroupRefs(ideology || {})),
      conceptTooltipIdeologyLawStance(ideology),
    ].filter(Boolean).join(" · ");
  }
  if (kind === "building") return "建筑";
  if (kind === "goods") return "商品";
  if (kind === "cultureTrait" || kind === "cultureTraitGroup") return "文化特质";
  if (kind === "interestGroup") return "利益集团";
  if (kind === "interestGroupTrait") return "利益集团特质";
  if (kind === "law") return "法律";
  return "";
}

function conceptTooltipIdeologyLawStance(ideology) {
  const law = state.detailKind === "law" ? lawByKey.get(state.selectedLaw) : null;
  const stanceLaw = law ? lawByKey.get(lawStanceSourceKey(law)) || law : null;
  const stance = stanceLaw && (ideology?.law_stances || []).find((item) => item.law_key === stanceLaw.key);
  return stance ? `对${lawDisplayName(law)}：${lawStanceLabel(stance.stance)}` : "";
}

function conceptTooltipActionText(target) {
  return target.matches("a[href]") ? "打开详情，右键搜索" : "右键搜索";
}

function moveConceptTooltip(event) {
  if (!els.conceptTooltip) return;
  const margin = 14;
  const rect = els.conceptTooltip.getBoundingClientRect();
  const x = Math.min(event.clientX + margin, window.innerWidth - rect.width - margin);
  const y = Math.min(event.clientY + margin, window.innerHeight - rect.height - margin);
  els.conceptTooltip.style.left = `${Math.max(margin, x)}px`;
  els.conceptTooltip.style.top = `${Math.max(margin, y)}px`;
}

function hideConceptTooltip() {
  clearConceptTooltipTimer();
  if (!els.conceptTooltip) return;
  els.conceptTooltip.hidden = true;
  els.conceptTooltip.classList.remove("ideology-tooltip");
}

function searchConcept(target) {
  const text = target.dataset.conceptSearch || target.dataset.conceptLabel || target.dataset.conceptKey || "";
  state.globalSearch = "";
  state.selectedGlobalResult = "";
  state.search = text.trim().toLowerCase();
  els.searchInput.value = text.trim();
  if (els.globalSearchDialogInput) els.globalSearchDialogInput.value = "";
  render();
}

function conceptKindLabel(kind) {
  return {
    country: "国家",
    culture: "文化",
    stateRegion: "州地区",
    strategicRegion: "战略区域",
    geographicRegion: "地理区域",
    company: "公司",
    interestGroup: "利益集团",
    interestGroupTrait: "利益集团特质",
    ideology: "意识形态",
    law: "法律",
    building: "建筑",
    cultureTrait: "文化特质",
    cultureTraitGroup: "文化特质组",
    stateTrait: "地区特质",
    goods: "商品",
    religion: "宗教",
    trait: "角色特质",
  }[kind] || "概念";
}

async function openGlobalSearchDialog() {
  if (state.infoDialog) {
    state.infoDialog = "";
    syncInfoDialogVisibility();
  }
  await ensureDataChunks(Object.keys(dataIndex?.chunks || {}));
  state.globalSearchDialogOpen = true;
  state.globalSearchActiveIndex = 0;
  if (!els.globalSearchDialog) return;
  els.globalSearchDialog.hidden = false;
  document.body.classList.add("global-search-dialog-open");
  if (els.globalSearchDialogInput) els.globalSearchDialogInput.value = state.globalSearch || "";
  if (els.globalSearchLegacyToggle) els.globalSearchLegacyToggle.checked = state.globalSearchIncludeLegacy;
  renderGlobalSearchDialogResults();
  requestAnimationFrame(() => els.globalSearchDialogInput?.focus());
}

function closeGlobalSearchDialog() {
  state.globalSearchDialogOpen = false;
  if (els.globalSearchDialog) els.globalSearchDialog.hidden = true;
  document.body.classList.remove("global-search-dialog-open");
  els.globalSearchButton?.focus();
}

function openInfoDialog(kind) {
  if (state.globalSearchDialogOpen) closeGlobalSearchDialog();
  state.infoDialog = kind === "settings" ? "settings" : "about";
  syncInfoDialogVisibility();
  requestAnimationFrame(() => els.infoDialogCloseButton?.focus());
}

function closeInfoDialog() {
  const previous = state.infoDialog;
  state.infoDialog = "";
  if (els.infoDialog) els.infoDialog.hidden = true;
  if (els.infoDialogTitle) els.infoDialogTitle.textContent = "";
  if (els.infoDialogBody) els.infoDialogBody.innerHTML = "";
  document.body.classList.remove("info-dialog-open");
  if (previous === "settings") els.settingsNavButton?.focus();
  else els.aboutNavButton?.focus();
}

function renderInfoDialog() {
  if (!els.infoDialogTitle || !els.infoDialogBody || !state.infoDialog) return;
  if (state.infoDialog === "settings") {
    els.infoDialogTitle.textContent = "设置";
    els.infoDialogBody.innerHTML = renderSettingsDialogContent();
    bindSettingsControls(els.infoDialogBody);
    return;
  }
  els.infoDialogTitle.textContent = "关于";
  els.infoDialogBody.innerHTML = renderAboutDialogContent();
}

function syncInfoDialogVisibility() {
  if (!els.infoDialog) return;
  els.infoDialog.querySelector(".info-dialog")?.classList.toggle("info-dialog-about", state.infoDialog === "about");
  if (!state.infoDialog) {
    els.infoDialog.hidden = true;
    document.body.classList.remove("info-dialog-open");
    return;
  }
  renderInfoDialog();
  els.infoDialog.hidden = false;
  document.body.classList.add("info-dialog-open");
}

function handleGlobalSearchDialogKeydown(event) {
  if (!state.globalSearchDialogOpen) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeGlobalSearchDialog();
    return;
  }
  const items = [...(els.globalSearchDialogResults?.querySelectorAll("[data-global-dialog-result]") || [])];
  if (!items.length) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.globalSearchActiveIndex = Math.min(items.length - 1, state.globalSearchActiveIndex + 1);
    updateGlobalSearchActiveDescendant();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    state.globalSearchActiveIndex = Math.max(0, state.globalSearchActiveIndex - 1);
    updateGlobalSearchActiveDescendant();
  } else if (event.key === "Enter") {
    event.preventDefault();
    items[state.globalSearchActiveIndex]?.click();
  }
}

function handleInfoDialogKeydown(event) {
  if (!state.infoDialog) return;
  if (event.key !== "Escape") return;
  event.preventDefault();
  closeInfoDialog();
}

async function applyHash() {
  await ensureDataChunksForRoute();
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  state.infoDialog = "";
  if (!parts.length || parts[0] === "home") {
    state.view = "home";
    state.detailKind = "home";
    return;
  }
  if (parts[0] === "settings") {
    state.infoDialog = "settings";
    return;
  }
  if (parts[0] === "news") {
    state.view = "news";
    state.detailKind = "news";
    if (!Number.isInteger(state.newsPage) || state.newsPage < 1) state.newsPage = 1;
    return;
  }
  if (parts[0] === "changelog") {
    state.view = "changelog";
    state.detailKind = "changelog";
    return;
  }
  if (parts[0] === "about") {
    state.infoDialog = "about";
    return;
  }
  if (parts[0] === "country" && !parts[1]) {
    state.view = "country";
    state.detailKind = "country";
    return;
  }
  if (parts[0] === "country" && parts[1] && byTag.has(parts[1].toUpperCase())) {
    state.view = "country";
    state.selectedTag = parts[1].toUpperCase();
    state.detailKind = "country";
    return;
  }
  if (parts[0] === "culture" && !parts[1]) {
    state.view = "culture";
    state.detailKind = "culture";
    return;
  }
  if (parts[0] === "culture" && parts[1] && byCulture.has(decodeURIComponent(parts[1]))) {
    state.view = "culture";
    state.selectedCulture = decodeURIComponent(parts[1]);
    state.detailKind = "culture";
    return;
  }
  if (parts[0] === "region") {
    state.view = "region";
    state.detailKind = "stateRegion";
    return;
  }
  if (parts[0] === "state-region" && parts[1] && byStateRegion.has(decodeURIComponent(parts[1]))) {
    state.view = "region";
    state.selectedStateRegion = decodeURIComponent(parts[1]);
    state.detailKind = "stateRegion";
    return;
  }
  if (parts[0] === "strategic-region" && parts[1] && byStrategicRegion.has(decodeURIComponent(parts[1]))) {
    state.view = "region";
    state.regionListMode = "strategic";
    state.selectedStrategicRegion = decodeURIComponent(parts[1]);
    state.detailKind = "strategicRegion";
    return;
  }
  if (parts[0] === "geographic-region" && parts[1] && byGeographicRegion.has(decodeURIComponent(parts[1]))) {
    state.view = "region";
    state.regionListMode = "geographic";
    state.selectedGeographicRegion = decodeURIComponent(parts[1]);
    state.detailKind = "geographicRegion";
    return;
  }
  if (parts[0] === "company" && !parts[1]) {
    state.view = "company";
    state.detailKind = "company";
    return;
  }
  if (parts[0] === "company" && parts[1] && byCompany.has(decodeURIComponent(parts[1]))) {
    state.view = "company";
    state.selectedCompany = decodeURIComponent(parts[1]);
    state.detailKind = "company";
    return;
  }
  if (parts[0] === "ideology" && !parts[1]) {
    state.view = "ideology";
    state.detailKind = "ideology";
    return;
  }
  if (parts[0] === "ideology" && parts[1] && ideologyByKey.has(decodeURIComponent(parts[1]))) {
    state.view = "ideology";
    state.selectedIdeology = decodeURIComponent(parts[1]);
    state.detailKind = "ideology";
    return;
  }
  if (parts[0] === "law" && !parts[1]) {
    state.view = "law";
    state.detailKind = "law";
    return;
  }
  if (parts[0] === "law" && parts[1] && lawByKey.has(decodeURIComponent(parts[1]))) {
    state.view = "law";
    state.selectedLaw = decodeURIComponent(parts[1]);
    state.detailKind = "law";
    return;
  }
  if (parts[0] === "technology" && !parts[1]) {
    state.view = "technology";
    state.selectedTechnology = "";
    state.detailKind = "technology";
    return;
  }
  if (parts[0] === "technology" && parts[1] && technologyByKey.has(decodeURIComponent(parts[1]))) {
    state.view = "technology";
    state.selectedTechnology = decodeURIComponent(parts[1]);
    state.technologyCategory = technologyByKey.get(state.selectedTechnology).category;
    state.detailKind = "technology";
    return;
  }
  if (parts[0] === "religion" && parts[1]) {
    state.search = decodeURIComponent(parts[1]).toLowerCase();
    els.searchInput.value = state.search;
  }
}

async function setView(view) {
  hideTransientOverlays();
  state.view = view;
  state.detailKind = view === "region" ? "stateRegion" : view;
  if (view === "region") state.regionListMode = "state";
  replaceHash(`/${view}`);
  await ensureDataChunksForRoute();
  renderStrategicRegionFilterOptions();
  renderSortOptions();
}

function regionListModeDetailKind() {
  return "stateRegion";
}

function replaceHash(hashPath) {
  const prefix = window.location.search || "";
  history.replaceState(null, "", `${prefix}#${hashPath}`);
}

function hideTransientOverlays() {
  hideMapTooltip();
  hideConceptTooltip();
}

function updatePageChrome() {
  const label = viewLabels[state.view] || "国家";
  const title = `${label} - ${siteTitle}`;
  setOptionalText(els.pageTitle, title);
  document.title = title;
  if (els.viewSelect) {
    els.viewSelect.value = state.view;
  }
}

function cycleResultsPanelMode() {
  const order = ["side", "collapsed"];
  const index = order.indexOf(state.resultsPanelMode);
  state.resultsPanelMode = order[(index + 1) % order.length];
  updateResultsPanelMode();
  if (state.resultsPanelMode === "collapsed") hideConceptTooltip();
  if (mapRuntime.ready) paintMapCanvas();
}

function updateResultsPanelMode() {
  const mode = state.resultsPanelMode || "side";
  document.body.dataset.resultsPanel = mode;
  document.body.classList.toggle("results-collapsed", mode === "collapsed");
  updatePanelToggleState();
}

function updatePanelToggleState() {
  if (els.leftPanelToggle) {
    const collapsed = document.body.classList.contains("filters-collapsed");
    els.leftPanelToggle.setAttribute("aria-pressed", String(collapsed));
    els.leftPanelToggle.setAttribute("aria-label", collapsed ? "展开筛选" : "折叠筛选");
    els.leftPanelToggle.title = collapsed ? "展开筛选" : "折叠筛选";
  }
  if (els.bottomPanelToggle) {
    const collapsed = (state.resultsPanelMode || "side") === "collapsed";
    els.bottomPanelToggle.setAttribute("aria-pressed", String(collapsed));
    els.bottomPanelToggle.setAttribute("aria-label", collapsed ? "展开列表" : "折叠列表");
    els.bottomPanelToggle.title = collapsed ? "展开列表" : "折叠列表";
  }
}

function render() {
  hideTransientOverlays();
  document.body.dataset.view = state.view;
  if (els.homeWelcome) els.homeWelcome.hidden = state.view !== "home";
  if (els.homeLinks) els.homeLinks.hidden = state.view !== "home";
  document.body.classList.toggle("detail-page", isDetailPageRoute());
  document.body.classList.toggle("global-search-active", Boolean(state.globalSearch));
  updatePageChrome();
  syncInfoDialogVisibility();
  updateResultsPanelMode();
  els.countryViewButton?.setAttribute("aria-pressed", String(state.view === "country"));
  els.cultureViewButton?.setAttribute("aria-pressed", String(state.view === "culture"));
  els.regionViewButton?.setAttribute("aria-pressed", String(state.view === "region"));
  els.companyViewButton?.setAttribute("aria-pressed", String(state.view === "company"));
  els.ideologyViewButton?.setAttribute("aria-pressed", String(state.view === "ideology"));
  els.lawViewButton?.setAttribute("aria-pressed", String(state.view === "law"));
  document.querySelectorAll("[data-nav-view]").forEach((button) => {
    button.setAttribute("aria-current", String(button.dataset.navView === state.view));
  });
  setTokenPressed(els.filteredCountryMapToggle, state.dimUnfilteredCountries);
  els.strategicRegionFilterTitle.textContent = state.view === "culture" ? "本土战略区域" : state.view === "company" ? "相关战略区域" : "所在战略区域";
  els.resourceFilterTitle.textContent = state.view === "company" ? "相关建筑" : "资源";
  els.searchInput.placeholder = searchPlaceholder();
  renderSortOptions();
  renderStrategicRegionFilterOptions();
  renderGeographicRegionFilterOptions();
  renderResourceFilterOptions();
  renderCompanyFilterOptions();
  renderIdeologyFilterOptions();
  renderLawFilterOptions();
  syncFilterSectionOpenStates();
  renderMapControls();

  if (state.view === "home") {
    renderHomeBoard();
  } else if (state.view === "news") {
    renderNewsBoard();
  } else if (state.view === "changelog") {
    renderChangelogBoard();
  } else if (state.view === "culture") {
    renderCultureBoard();
  } else if (state.view === "region") {
    renderRegionBoard();
  } else if (state.view === "company") {
    renderCompanyBoard();
  } else if (state.view === "ideology") {
    renderIdeologyBoard();
  } else if (state.view === "law") {
    renderLawBoard();
  } else if (state.view === "technology") {
    renderTechnologyBoard();
  } else {
    renderCountryBoard();
  }
  const boardManagesDetail = state.view === "home" || state.view === "technology" || state.view === "news";
  if (!boardManagesDetail && state.view !== "changelog" && isDetailPageRoute()) {
    renderDetailForState();
  } else if (!boardManagesDetail) {
    els.detail.innerHTML = "";
  }
}

function isDetailPageRoute() {
  return Boolean(detailRouteKey());
}

function detailRouteKey() {
  const [route, key] = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (!route || !key) return "";
  return ["country", "culture", "state-region", "strategic-region", "geographic-region", "company", "ideology", "law", "technology"].includes(route) ? key : "";
}

function syncFilterSectionOpenStates() {
  const hasPressedToken = (container) => Boolean(container?.querySelector('[data-filter-token][aria-pressed="true"]'));
  const setSection = (selector, open) => {
    document.querySelectorAll(selector).forEach((section) => {
      if (open) section.open = true;
    });
  };

  if (!hasInitializedFilterSections) initializeDefaultFilterSectionOpenStates();
  setSection(".filter-section:has(#resourceFilters)", state.resourceFilters.size > 0 || state.includeIndustryCharter);
  setSection(".filter-section:has(#countryTypeFilters)", state.view === "country" || state.types.size > 0 || state.flags.size > 0);
  setSection(".filter-section:has(#tierFilters)", state.view === "country" || state.tiers.size > 0);
  setSection(".filter-section:has(#strategicRegionFilters)", state.view === "country" || state.strategicRegions.size > 0);
  setSection(".filter-section:has(#geographicRegionFilters)", state.view === "company" && Boolean(state.selectedGeographicRegion));
  setSection(".filter-section:has(#companyKindFilters)", state.companyKinds.size > 0);
  setSection(".filter-section:has(#companyPrestigeFilters)", state.companyPrestigeGoods.size > 0);
  setSection(".filter-section:has(#companyDlcFilters)", state.companyDlcs.size > 0);
  setSection(".filter-section:has(#ideologyTypeFilters)", state.ideologyTypes.size > 0);
  setSection(".filter-section:has(#ideologyGroupFilters)", state.ideologyGroups.size > 0);
  setSection(".filter-section:has(#ideologyOccurrenceFilters)", state.ideologyOccurrences.size > 0);
  setSection(".filter-section:has(#ideologyLawGroupFilters)", state.ideologyLawGroups.size > 0);
  setSection(".filter-section:has(#lawGroupFilters)", ["law", "ideology"].includes(state.view) || state.lawGroups.size > 0 || state.commonLawIdeologyOnly);
  setSection(".filter-section:has(#heritageGroupFilters)", state.heritageGroups.size > 0 || state.heritages.size > 0);
  setSection(".filter-section:has(#languageGroupFilters)", state.languageGroups.size > 0 || state.languages.size > 0);
  setSection(".filter-section:has(#traditionFilters)", Boolean(state.tradition));
  document.querySelectorAll(".filter-section").forEach((section) => {
    if (!section.open && hasPressedToken(section)) section.open = true;
  });
  hasInitializedFilterSections = true;
}

function initializeDefaultFilterSectionOpenStates() {
  const defaultOpenFilterIds = new Set([
    "resourceFilters",
    "companyKindFilters",
    "companyPrestigeFilters",
    "companyDlcFilters",
    "strategicRegionFilters",
  ]);
  document.querySelectorAll(".filter-section").forEach((section) => {
    section.open = [...defaultOpenFilterIds].some((filterId) => section.querySelector(`#${filterId}`));
  });
}
