const achievementGroups = [
  ["easy_group", "简单"],
  ["medium_group", "中等"],
  ["hard_group", "困难"],
  ["very_hard_group", "极难"],
];

function achievementBoardAvailable() {
  return Boolean(dataIndex?.chunks?.achievement || achievements.length);
}

function achievementMatches(achievement, query) {
  const haystack = [
    achievement.name_zh,
    achievement.name_en,
    achievement.description_zh,
    ...(achievement.details || []).map((detail) => detail.text_zh),
  ].join("\n").toLocaleLowerCase("zh-Hans-CN");
  return !query || haystack.includes(query.toLocaleLowerCase("zh-Hans-CN"));
}

function renderAchievementBoard() {
  const query = state.achievementSearch.trim();
  const selected = achievementByKey.get(state.selectedAchievement) || null;
  const groups = achievementGroups.map(([key, label]) => {
    const all = achievements.filter((achievement) => achievement.group_key === key);
    return { key, label, all, visible: all.filter((achievement) => achievementMatches(achievement, query)) };
  }).filter((group) => group.visible.length);
  const count = groups.reduce((total, group) => total + group.visible.length, 0);

  els.countryList.innerHTML = `<section class="achievement-shell" aria-label="成就总览">
    <header class="achievement-toolbar">
      <label class="achievement-search"><span>搜索成就</span><input type="search" autocomplete="off" value="${escapeHtml(state.achievementSearch)}" placeholder="名称、英文名、说明或条件" data-achievement-search></label>
      <strong class="achievement-count">${count} 项成就</strong>
    </header>
    <div class="achievement-groups">${groups.map((group) => achievementGroupHtml(group)).join("") || "<p class=\"achievement-empty\">没有匹配的成就。</p>"}</div>
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
    <h2>${group.label}<small>${group.visible.length} / ${group.all.length}</small></h2>
    <div class="achievement-wall-grid">${group.visible.map((achievement) => achievementCardHtml(achievement, group.key)).join("")}</div>
  </section>`;
}

function achievementCardHtml(achievement, groupKey) {
  const selected = achievement.key === state.selectedAchievement;
  return `<button class="achievement-card achievement-card--${groupKey}" type="button" data-achievement-key="${escapeHtml(achievement.key)}" aria-pressed="${selected}">
    <img src="assets/achievements/${escapeHtml(achievement.key)}.webp" alt="" aria-hidden="true">
    <span>${escapeHtml(achievement.name_zh)}</span>
  </button>`;
}

function bindAchievementBoardEvents() {
  const search = els.countryList.querySelector("[data-achievement-search]");
  search?.addEventListener("input", () => {
    state.achievementSearch = search.value;
    if (!state.achievementSearch) state.achievementWallScrollTop = 0;
    renderAchievementBoard();
    els.countryList.querySelector("[data-achievement-search]")?.focus();
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

function renderAchievementDetail(achievement) {
  if (!achievement) {
    els.detail.innerHTML = "";
    return;
  }
  const [, difficultyName] = achievementGroups.find(([key]) => key === achievement.group_key) || ["", achievement.group_name_zh];
  const possible = achievement.script?.possible === null
    ? "<p class=\"achievement-script-empty\">原版未定义前置筛选条件</p>"
    : `<pre>${escapeHtml(achievement.script?.possible || "")}</pre>`;
  els.detail.innerHTML = `<article class="achievement-detail">
    <header class="achievement-detail-head">
      <img src="assets/achievements/${escapeHtml(achievement.key)}.webp" alt="">
      <div><p class="achievement-detail-difficulty">${escapeHtml(difficultyName)}</p><h2>${escapeHtml(achievement.name_zh)}</h2><p class="achievement-detail-english">${escapeHtml(achievement.name_en)}</p></div>
      <button type="button" data-achievement-back aria-label="关闭成就详情">×</button>
    </header>
    <section><h3>官方说明</h3><p>${escapeHtml(achievement.description_zh)}</p></section>
    <section><h3>达成条件</h3><ul>${(achievement.details || []).map((detail) => `<li>${escapeHtml(detail.text_zh)}</li>`).join("") || "<li>原版未提供中文条件说明。</li>"}</ul></section>
    <details open><summary>前置筛选条件</summary>${possible}</details>
    <details open><summary>达成脚本</summary><pre>${escapeHtml(achievement.script?.happened || "")}</pre></details>
  </article>`;
  els.detail.querySelector("[data-achievement-back]")?.addEventListener("click", () => {
    state.selectedAchievement = "";
    replaceHash("/achievement");
    render();
  });
}
