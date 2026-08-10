const achievementGroups = ["easy_group", "medium_group", "hard_group", "very_hard_group"];

function achievementBoardAvailable() {
  return Boolean(dataIndex?.chunks?.achievement || achievements.length);
}

function achievementEnglishName(achievement) {
  const entry = window.VIC3_SEARCH_INDEX?.entries?.find((item) => item.id === achievement.id);
  return entry?.names?.en || localeRuntime.dataMessages?.en?.[achievement.loc?.name] || achievement.key;
}

function achievementMatches(achievement, query) {
  const haystack = [
    ...searchNames(achievement.id),
    entityText(achievement, "description", ""),
    entityText(achievement, "groupName", achievement.group_key),
    ...(achievement.details || []).flatMap((detail) => [detail.key, renderTextSpec({ message: detail.loc?.text, fallback: "" })]),
    ...(achievement.related_countries || []).flatMap((country) => [country.tag, ...searchNames(`country:${country.tag}`), entityText(country)]),
  ].join("\n").toLocaleLowerCase();
  return !query || haystack.includes(query.toLocaleLowerCase());
}

function renderAchievementBoard() {
  const query = state.achievementSearch.trim();
  const selected = achievementByKey.get(state.selectedAchievement) || null;
  const groups = achievementGroups.map((key) => {
    const all = achievements.filter((achievement) => achievement.group_key === key);
    return { key, label: t(`enum.achievementGroup.${key}`, key), all, visible: all.filter((achievement) => achievementMatches(achievement, query)) };
  }).filter((group) => group.visible.length);
  const count = groups.reduce((total, group) => total + group.visible.length, 0);

  els.countryList.innerHTML = `<section class="achievement-shell" aria-label="${escapeHtml(t("board.achievement.overview", "成就总览"))}">
    <header class="achievement-toolbar">
      <form class="achievement-search" data-achievement-search-form>
        <label for="achievementSearchInput">${t("board.achievement.search", "搜索成就")}</label>
        <div class="achievement-search-controls">
          <input id="achievementSearchInput" type="search" autocomplete="off" value="${escapeHtml(state.achievementSearch)}" placeholder="${escapeHtml(t("board.achievement.searchPlaceholder", "名称、说明或条件"))}" data-achievement-search>
          <button type="submit" data-achievement-search-submit>${t("board.achievement.searchSubmit", "搜索")}</button>
        </div>
      </form>
      <strong class="achievement-count">${t("board.achievement.count", { count: localizedNumber(count) })}</strong>
    </header>
    <div class="achievement-groups">${groups.map((group) => achievementGroupHtml(group)).join("") || `<p class="achievement-empty">${t("board.achievement.empty", "没有匹配的成就。")}</p>`}</div>
  </section>`;
  els.resultCount.textContent = "";
  els.activeHint.textContent = "";
  bindAchievementBoardEvents();
  renderAchievementDetail(selected);
  if (!selected && state.achievementWallScrollTop) {
    requestAnimationFrame(() => { els.countryList.closest(".results").scrollTop = state.achievementWallScrollTop; });
  }
}

function achievementGroupHtml(group) {
  return `<section class="achievement-group achievement-group--${group.key}">
    <h2>${escapeHtml(group.label)}<small>${localizedNumber(group.visible.length)} / ${localizedNumber(group.all.length)}</small></h2>
    <div class="achievement-wall-grid">${group.visible.map((achievement) => achievementCardHtml(achievement, group.key)).join("")}</div>
  </section>`;
}

function achievementCardHtml(achievement, groupKey) {
  const selected = achievement.key === state.selectedAchievement;
  return `<button class="achievement-card achievement-card--${groupKey}" type="button" data-achievement-key="${escapeHtml(achievement.key)}" aria-pressed="${selected}">
    <img src="assets/achievements/${escapeHtml(achievement.key)}.webp" alt="" aria-hidden="true" loading="lazy" decoding="async">
    <span>${escapeHtml(entityText(achievement))}</span>
  </button>`;
}

function bindAchievementBoardEvents() {
  const search = els.countryList.querySelector("[data-achievement-search]");
  const searchForm = els.countryList.querySelector("[data-achievement-search-form]");
  searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitAchievementSearch(search);
  });
  search?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!event.isComposing) submitAchievementSearch(search);
  });
  els.countryList.querySelectorAll("[data-achievement-key]").forEach((card) => {
    card.addEventListener("click", () => {
      state.achievementWallScrollTop = els.countryList.closest(".results").scrollTop;
      replaceHash(`/achievement/${encodeURIComponent(card.dataset.achievementKey)}`);
      state.selectedAchievement = card.dataset.achievementKey;
      render();
    });
  });
}

function submitAchievementSearch(search) {
  const nextQuery = search?.value ?? "";
  if (nextQuery === state.achievementSearch) return;
  state.achievementSearch = nextQuery;
  if (!state.achievementSearch) state.achievementWallScrollTop = 0;
  renderAchievementBoard();
  const refreshedSearch = els.countryList.querySelector("[data-achievement-search]");
  refreshedSearch?.focus();
  refreshedSearch?.setSelectionRange(refreshedSearch.value.length, refreshedSearch.value.length);
}

function renderAchievementDetail(achievement) {
  if (!achievement) {
    els.detail.innerHTML = "";
    return;
  }
  const difficultyName = entityText(achievement, "groupName", t(`enum.achievementGroup.${achievement.group_key}`, achievement.group_key));
  const possible = achievement.script?.possible === null
    ? `<p class="achievement-script-empty">${t("board.achievement.noPossibleScript", "原版未定义前置筛选条件。")}</p>`
    : `<pre>${escapeHtml(achievement.script?.possible || "")}</pre>`;
  const relatedCountries = achievement.related_countries || [];
  const relatedCountriesHtml = relatedCountries.length
    ? `<section class="achievement-related-countries"><h3>${t("board.achievement.relatedCountries", "关联国家")}</h3><div>${relatedCountries.map((country) => `<span data-achievement-country="${escapeHtml(country.tag)}">${conceptPill({ kind: "country", key: country.tag, label: entityText(country), href: conceptHref("country", country.tag) })}</span>`).join("")}</div></section>`
    : "";
  els.detail.innerHTML = `<article class="achievement-detail">
    <header class="achievement-detail-head">
      <img src="assets/achievements/${escapeHtml(achievement.key)}.webp" alt="">
      <div><p class="achievement-detail-difficulty">${escapeHtml(difficultyName)}</p><h2>${escapeHtml(entityText(achievement))}</h2><p class="achievement-detail-english">${escapeHtml(achievementEnglishName(achievement))}</p></div>
      <button type="button" data-achievement-back aria-label="${escapeHtml(t("board.achievement.closeDetail", "关闭成就详情"))}">×</button>
    </header>
    <section><h3>${t("board.achievement.officialDescription", "官方说明")}</h3><p>${escapeHtml(entityText(achievement, "description", t("ui.noDescription", "无说明")))}</p></section>
    <section><h3>${t("board.achievement.conditions", "达成条件")}</h3><ul>${(achievement.details || []).map((detail) => `<li>${escapeHtml(renderTextSpec({ message: detail.loc?.text, fallback: detail.key }))}</li>`).join("") || `<li>${t("board.achievement.noConditionDescription", "原版未提供条件说明。")}</li>`}</ul></section>
    ${relatedCountriesHtml}
    <details open><summary>${t("board.achievement.possibleScript", "前置筛选条件")}</summary>${possible}</details>
    <details open><summary>${t("board.achievement.happenedScript", "达成脚本")}</summary><pre>${escapeHtml(achievement.script?.happened || "")}</pre></details>
  </article>`;
  els.detail.querySelectorAll("[data-achievement-country]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      const tag = button.dataset.achievementCountry;
      replaceHash(`/country/${encodeURIComponent(tag)}`);
      await applyHash();
      render();
    });
  });
  els.detail.querySelector("[data-achievement-back]")?.addEventListener("click", () => {
    state.selectedAchievement = "";
    replaceHash("/achievement");
    render();
  });
}
