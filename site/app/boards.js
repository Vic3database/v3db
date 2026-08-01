const HOME_NEWS_PAGE_SIZE = 10;
const NEWS_PAGE_SIZE = 25;
const newsCategoryLabels = {
  all: "news.category.all",
  diary: "news.category.diary",
  patch: "news.category.patch",
  other: "news.category.other",
};

function visibleNewsItems(category = state.newsCategory) {
  return newsItems
    .filter((item) => category === "all" || item.category === category)
    .slice()
    .sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id));
}

function newsItemHtml(item, className = "news-item") {
  return `
    <a class="${className}" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
      <time datetime="${escapeHtml(item.date)}">${escapeHtml(item.date)}</time>
      <span class="news-item-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.label)}</small></span>
    </a>
  `;
}

function newsCategoryTabsHtml(className = "news-tabs") {
  return `
    <div class="${className}" role="group" aria-label="${escapeHtml(t("news.categories"))}">
      ${Object.entries(newsCategoryLabels).map(([key, label]) => `
        <button class="${className.slice(0, -1)}" type="button" data-news-category="${key}" aria-pressed="${state.newsCategory === key}">${t(label)}</button>
      `).join("")}
    </div>
  `;
}

function bindNewsCategoryControls(container, { renderTarget, resetPage = true } = {}) {
  container.querySelectorAll("[data-news-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.newsCategory = button.dataset.newsCategory || "all";
      if (resetPage) state.newsPage = 1;
      renderTarget();
    });
  });
}

function renderHomeNewsHtml() {
  const items = visibleNewsItems().slice(0, HOME_NEWS_PAGE_SIZE);
  return `
    <section class="home-side-panel home-news-panel">
      <div class="home-side-heading"><h2>${t("nav.news")}</h2><span>${t("news.latestCount", { count: localizedNumber(HOME_NEWS_PAGE_SIZE) })}</span></div>
      ${newsCategoryTabsHtml("home-news-tabs")}
      <div class="home-news-list">
        ${items.length ? items.map((item) => newsItemHtml(item, "home-news-item")).join("") : `<p class="empty">${t("news.empty")}</p>`}
      </div>
      <button class="home-news-more" type="button" data-news-more>${t("news.more")} →</button>
    </section>
  `;
}

function bindHomeNewsControls() {
  bindNewsCategoryControls(els.detail, { renderTarget: renderHomeBoard });
  els.detail.querySelector("[data-news-more]")?.addEventListener("click", () => {
    state.newsPage = 1;
    location.hash = "/news";
  });
}

function renderNewsBoard() {
  mapRuntime.filteredCountryTags = new Set();
  const items = visibleNewsItems();
  const pageCount = Math.max(1, Math.ceil(items.length / NEWS_PAGE_SIZE));
  state.newsPage = Math.min(Math.max(1, state.newsPage), pageCount);
  const start = (state.newsPage - 1) * NEWS_PAGE_SIZE;
  const pageItems = items.slice(start, start + NEWS_PAGE_SIZE);
  els.resultCount.textContent = t("nav.news");
  els.activeHint.textContent = t("news.categoryCount", { category: t(newsCategoryLabels[state.newsCategory]), count: localizedNumber(items.length) });
  els.countryList.className = "country-list news-board";
  els.detail.innerHTML = "";
  els.countryList.innerHTML = `
    <section class="news-board-panel" aria-label="${escapeHtml(t("nav.news"))}">
      <div class="news-board-heading">
        <div><h2>${t("nav.news")}</h2><p>${t("news.description")}</p></div>
        <span>${t("news.page", { page: localizedNumber(state.newsPage), count: localizedNumber(pageCount) })}</span>
      </div>
      ${newsCategoryTabsHtml("news-board-tabs")}
      <div class="news-board-list">
        ${pageItems.length ? pageItems.map((item) => newsItemHtml(item, "news-board-item")).join("") : `<p class="empty">${t("news.empty")}</p>`}
      </div>
      <div class="news-pagination" aria-label="${escapeHtml(t("news.pagination"))}">
        <button type="button" data-news-page="previous"${state.newsPage === 1 ? " disabled" : ""}>${t("news.previous")}</button>
        <span>${t("news.page", { page: localizedNumber(state.newsPage), count: localizedNumber(pageCount) })}</span>
        <button type="button" data-news-page="next"${state.newsPage === pageCount ? " disabled" : ""}>${t("news.next")}</button>
      </div>
    </section>
  `;
  bindNewsCategoryControls(els.countryList, { renderTarget: renderNewsBoard });
  els.countryList.querySelectorAll("[data-news-page]").forEach((button) => {
    button.addEventListener("click", () => {
      state.newsPage += button.dataset.newsPage === "next" ? 1 : -1;
      renderNewsBoard();
    });
  });
  renderMap([]);
}

function announcementItemHtml(item) {
  const body = escapeHtml(item.body).replaceAll("\n", "<br>");
  return `
    <article class="home-announcement-item">
      <time datetime="${escapeHtml(item.date)}">${escapeHtml(item.date)}</time>
      <strong>${escapeHtml(item.title)}</strong>
      <p>${body}</p>
    </article>
  `;
}

function renderHomeBoard() {
  const isStandaloneSite = Boolean(standaloneSiteConfig);
  mapRuntime.filteredCountryTags = new Set();
  els.resultCount.textContent = "";
  els.activeHint.textContent = "";
  els.countryList.className = "country-list home-board";
  const entries = [
    { category: "diplomacy", label: "nav.country", view: "country", icon: "assets/home/waving_flag.png" },
    { category: "diplomacy", label: "home.entry.powerBloc", pending: true, icon: "assets/home/sovereign_empire.png" },
    { category: "diplomacy", label: "home.entry.diplomacy", pending: true, icon: "assets/home/international_diplomacy.png" },
    { category: "politics", label: "nav.law", view: "law", icon: "assets/home/law_enforcement.png" },
    { category: "politics", label: "nav.ideology", view: "ideology", icon: "assets/home/democracy.png" },
    { category: "politics", label: "home.entry.journal", pending: true, icon: "assets/home/event_default.png" },
    { category: "society", label: "nav.culture", view: "culture", icon: "assets/home/nationalism.png" },
    { category: "society", label: "nav.technology", view: "technology", icon: "assets/home/academia.png" },
    { category: "society", label: "home.entry.character", pending: true, icon: "assets/home/event_portrait.png" },
    { category: "economy", label: "nav.region", view: "region", icon: "assets/home/state.png" },
    { category: "economy", label: "home.entry.building", pending: true, icon: "assets/home/manufacturies.png" },
    { category: "economy", label: "home.entry.goods", pending: true, icon: "assets/home/grand_strategy_games_prestige.png" },
    { category: "economy", label: "nav.company", view: "company", icon: "assets/home/companies.png" },
    { category: "military", label: "home.entry.army", pending: true, icon: "assets/home/line_infantry.png" },
    { category: "military", label: "home.entry.navy", pending: true, icon: "assets/home/dreadnought.png" },
    { category: "other", label: "nav.achievement", pending: true, icon: "assets/home/icon_achievements_enabled.png" },
    { category: "other", label: "home.entry.resources", pending: true, icon: "assets/home/romanticism.png" },
    { category: "other", label: "nav.changelog", text: "home.versionDiff", view: "changelog", icon: "assets/home/mass_communication.png" },
  ];
  const visibleEntries = isStandaloneSite ? entries.filter((entry) => entry.view !== "changelog") : entries;
  const categories = ["diplomacy", "politics", "economy", "military", "society", "other"];
  els.countryList.innerHTML = `
    <div class="home-category-list">
      ${categories.map((category) => {
        const categoryEntries = visibleEntries.filter((entry) => entry.category === category);
        return `
          <section class="home-category-card" data-category="${escapeHtml(category)}" aria-label="${escapeHtml(t(`home.category.${category}`))}">
            <div class="home-category-heading"><h2>${escapeHtml(t(`home.category.${category}`))}</h2></div>
            <div class="home-entry-grid">
              ${categoryEntries.map((entry) => entry.view ? `
                <button class="home-entry" type="button" data-home-view="${escapeHtml(entry.view)}">
                  <img class="home-entry-icon" src="${escapeHtml(entry.icon)}" alt="" aria-hidden="true">
                  <span class="home-entry-copy"><strong>${escapeHtml(t(entry.label))}</strong>${entry.text ? `<small>${escapeHtml(t(entry.text))}</small>` : ""}</span>
                </button>
              ` : `
                <article class="home-entry home-entry-pending" aria-label="${escapeHtml(t("home.pendingAria", { label: t(entry.label) }))}">
                  <img class="home-entry-icon" src="${escapeHtml(entry.icon)}" alt="" aria-hidden="true">
                  <span class="home-entry-copy"><strong>${escapeHtml(t(entry.label))}</strong><small>${escapeHtml(t("home.pending"))}</small></span>
                </article>
              `).join("")}
            </div>
          </section>
        `;
      }).join("")}
    </div>
  `;
  els.countryList.querySelectorAll("[data-home-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (button.dataset.homeView === "changelog") {
        location.hash = "/changelog";
        return;
      }
      await setView(button.dataset.homeView);
      render();
    });
  });
  els.detail.innerHTML = isStandaloneSite ? "" : `
    <section class="home-side-panel home-announcement">
      <div class="home-side-heading"><h2>${t("home.announcements")}</h2><span>${t("home.onSite")}</span></div>
      ${announcementItems.length
        ? `<div class="home-announcement-list">${announcementItems.map(announcementItemHtml).join("")}</div>`
        : `<p class="home-announcement-empty">${t("home.noAnnouncements")}</p>`}
    </section>
    ${renderHomeNewsHtml()}
  `;
  if (!isStandaloneSite) bindHomeNewsControls();
  renderMap([]);
}

function renderSettingsDialogContent() {
  return `
    <section class="settings-placeholder settings-panel">
      <p>${t("settings.description")}</p>
      <label class="settings-toggle">
        <input id="whiteDecentralizedSetting" type="checkbox"${state.whiteDecentralized ? " checked" : ""}>
        <span>${t("settings.whiteDecentralized")}</span>
      </label>
      <label class="settings-toggle">
        <input id="subjectOverlordColorsSetting" type="checkbox"${state.subjectOverlordColors ? " checked" : ""}>
        <span>${t("settings.subjectOverlordColors")}</span>
      </label>
      <label class="settings-toggle">
        <input id="omitIndigenousSetting" type="checkbox"${state.omitIndigenousLanguagesCultures ? " checked" : ""}>
        <span>${t("settings.omitIndigenous")}</span>
      </label>
      <label class="settings-toggle">
        <input id="omitDecentralizedTagsSetting" type="checkbox"${state.omitDecentralizedTags ? " checked" : ""}>
        <span>${t("settings.omitDecentralizedTags")}</span>
      </label>
    </section>
  `;
}

function renderAboutDialogContent() {
  const version = data.meta?.victoria3_version || t("ui.unknown");
  const isStandaloneSite = Boolean(standaloneSiteConfig);
  const siteName = isStandaloneSite ? "Victorian Century" : "Vicdata";
  const sourceText = t(isStandaloneSite ? "about.sourceVc" : "about.sourceMain");
  return `
    <div class="about-dialog-grid">
      <section class="settings-placeholder about-intro">
        <h3>${escapeHtml(siteTitle)}</h3>
        <p>${escapeHtml(t("about.intro", { site: siteName, version }))}</p>
        <p>${escapeHtml(t("about.usage"))}</p>
      </section>
      <section class="about-stat-grid" aria-label="${escapeHtml(t("about.dataScope"))}">
        ${aboutStat(t("about.currentVersion"), version)}
        ${aboutStat(t("nav.country"), localizedNumber(dataCount("countries", countries)))}
        ${aboutStat(t("nav.region"), localizedNumber(landStateRegions.length))}
        ${aboutStat(t("nav.culture"), localizedNumber(dataCount("cultures", cultures)))}
        ${aboutStat(t("nav.company"), localizedNumber(dataCount("companies", companies)))}
        ${aboutStat(t("nav.ideology"), localizedNumber(dataCount("ideologies", ideologies)))}
      </section>
      <section class="settings-placeholder about-note">
        <h3>${t("about.dataAndDisclaimer")}</h3>
        <p>${escapeHtml(sourceText)}</p>
      </section>
    </div>
    <section class="settings-placeholder developer-card" aria-label="${escapeHtml(t("about.developerProfile"))}">
      <img class="developer-avatar" src="assets/about/developer.jpg" alt="${escapeHtml(t("about.developerAvatar"))}">
      <div class="developer-copy">
        <h3>${t("about.developer")}</h3>
        <p>${t("about.developerBio")}</p>
        <p>${t("about.developerWork")}</p>
        <a class="support-link" href="https://afdian.com/a/shimotsukiyukimi" target="_blank" rel="noopener noreferrer">BUY ME A TEA</a>
        <a class="feedback-link" href="${feedbackMailto}">${t("about.feedback", { email: feedbackEmail })}</a>
      </div>
    </section>
  `;
}

function aboutStat(label, value) {
  return `
    <article class="about-stat">
      <span class="about-stat-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderChangelogBoard() {
  const defaultPair = changelogPairs()[0]?.id || "";
  if (!state.changelogPair && defaultPair) state.changelogPair = defaultPair;
  mapRuntime.filteredCountryTags = new Set();
  els.resultCount.textContent = t("nav.changelog");
  els.activeHint.textContent = changelogData.targetVersion && changelogData.baseVersion
    ? `${changelogData.baseVersion} -> ${changelogData.targetVersion}`
    : t("changelog.versionChanges");
  els.countryList.className = "country-list changelog-board";
  els.detail.innerHTML = "";
  renderMap([]);
  if (state.changelogLoading) {
    els.countryList.innerHTML = `<p class="empty">${t("changelog.loading")}</p>`;
    return;
  }
  if (state.changelogError) {
    els.countryList.innerHTML = `<p class="empty">${escapeHtml(state.changelogError)}</p>`;
    return;
  }
  if (changelogLoadedPair !== state.changelogPair) {
    els.countryList.innerHTML = `<p class="empty">${t("changelog.empty")}</p>`;
    ensureChangelogLoaded();
    return;
  }
  const visible = filteredChangelogChanges();
  const duplicateState = duplicateStateByDiff(visible);
  const diffCount = visible.reduce((sum, change) => sum + (change.diffs || []).length, 0);
  const repeatedCount = [...duplicateState.values()].filter((item) => item.repeated).length;
  const repeatedText = repeatedCount ? `，${repeatedCount} 个为同类后续表现` : "";
  els.countryList.innerHTML = `
    <section class="changelog-panel embedded-changelog-panel" aria-label="更新日志">
      <div class="changelog-heading">
        <div>
          <h2>${escapeHtml(changelogData.targetVersion || "")} 相对 ${escapeHtml(changelogData.baseVersion || "")}</h2>
          <p class="changelog-note">完整记录 ${escapeHtml(String(changelogData.changes.length))} 条对象变化。</p>
        </div>
        <label class="changelog-search">
          <span>版本段</span>
          <select id="changelogPairSelect" aria-label="更新日志版本段">
            ${changelogPairs().map((pair) => `<option value="${escapeHtml(pair.id)}"${pair.id === state.changelogPair ? " selected" : ""}>${escapeHtml(pair.label)}</option>`).join("")}
          </select>
        </label>
        <label class="changelog-search">
          <span>搜索</span>
          <input id="changelogSearch" type="search" autocomplete="off" value="${escapeHtml(state.changelogSearch)}" placeholder="条目、字段、源文件">
        </label>
      </div>
      <div id="changelogBoardFilters" class="changelog-filters" aria-label="板块筛选">
        ${renderChangelogFiltersHtml()}
      </div>
      <div class="changelog-stats">显示 ${escapeHtml(String(visible.length))} 条对象变化，${escapeHtml(String(diffCount))} 个字段差异${escapeHtml(repeatedText)}。</div>
      <div class="changelog-list">
        ${visible.length ? visible.map((change) => changeHtml(change, duplicateState)).join("") : `<p class="empty">没有匹配的变化。</p>`}
      </div>
    </section>
  `;
  bindChangelogControls();
}

function ensureChangelogLoaded() {
  const pair = changelogPairs().find((item) => item.id === state.changelogPair) || changelogPairs()[0];
  if (!pair || state.changelogLoading || changelogLoadedPair === pair.id) return;
  loadChangelogPair(pair.id).catch((error) => {
    state.changelogLoading = false;
    state.changelogError = error?.message || String(error);
    render();
  });
}

async function loadChangelogPair(pairId) {
  const pair = changelogPairs().find((item) => item.id === pairId) || changelogPairs()[0];
  if (!pair) return;
  const requestPairId = pair.id;
  state.changelogLoading = true;
  state.changelogError = "";
  state.changelogPair = requestPairId;
  state.changelogBoard = "all";
  state.changelogSearch = "";
  changelogLoadedPair = "";
  changelogData = { baseVersion: "", targetVersion: "", boards: [], changes: [] };
  changelogBoardOrder = ["all"];
  renderChangelogBoard();
  const loaded = await loadScriptValue(pair.data, "VIC3_CHANGELOG_DATA");
  if (state.changelogPair !== requestPairId) return;
  changelogData = loaded || { baseVersion: "", targetVersion: "", boards: [], changes: [] };
  changelogBoardOrder = ["all", ...(changelogData.boards || []).map((board) => board.key)];
  changelogLoadedPair = requestPairId;
  state.changelogLoading = false;
  render();
}

function changelogPairs() {
  return (versionConfig?.changelogs || []).map((pair) => ({
    ...pair,
    id: pair.id || `${pair.base_version}_to_${pair.target_version}`,
  }));
}

function bindChangelogControls() {
  const pairSelect = els.countryList.querySelector("#changelogPairSelect");
  const searchInput = els.countryList.querySelector("#changelogSearch");
  const filters = els.countryList.querySelector("#changelogBoardFilters");
  pairSelect?.addEventListener("change", () => {
    loadChangelogPair(pairSelect.value).catch((error) => {
      state.changelogLoading = false;
      state.changelogError = error?.message || String(error);
      render();
    });
  });
  searchInput?.addEventListener("input", () => {
    state.changelogSearch = searchInput.value.trim().toLowerCase();
    renderChangelogBoard();
  });
  filters?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-board-filter]");
    if (!button || !filters.contains(button)) return;
    state.changelogBoard = button.dataset.boardFilter || "all";
    renderChangelogBoard();
  });
}

function renderChangelogFiltersHtml() {
  const counts = changelogBoardCounts();
  return changelogBoardOrder.map((boardKey) => {
    const label = boardKey === "all"
      ? "全部"
      : (changelogData.boards || []).find((board) => board.key === boardKey)?.label || boardKey;
    const count = boardKey === "all" ? (changelogData.changes || []).length : counts.get(boardKey) || 0;
    return `<button class="filter-token" type="button" data-board-filter="${escapeHtml(boardKey)}" aria-pressed="${state.changelogBoard === boardKey}">${escapeHtml(label)} ${escapeHtml(String(count))}</button>`;
  }).join("");
}

function filteredChangelogChanges() {
  const search = state.changelogSearch;
  return (changelogData.changes || []).filter((change) => {
    if (state.changelogBoard !== "all" && change.board !== state.changelogBoard) return false;
    if (!search) return true;
    return changelogSearchBlob(change).includes(search);
  });
}

function changelogBoardCounts() {
  const counts = new Map();
  for (const change of changelogData.changes || []) {
    counts.set(change.board, (counts.get(change.board) || 0) + 1);
  }
  return counts;
}

function duplicateStateByDiff(changes) {
  const seen = new Map();
  const states = new Map();
  for (const change of changes || []) {
    (change.diffs || []).forEach((diff, index) => {
      const key = diff.duplicateKey || `${change.id}:${index}`;
      const current = (seen.get(key) || 0) + 1;
      const total = Number(diff.duplicateCount) || 1;
      seen.set(key, current);
      states.set(diffStateKey(change, index), {
        current,
        total,
        repeated: total > 1 && current > 1,
      });
    });
  }
  return states;
}

function diffStateKey(change, index) {
  return `${change.id}:${index}`;
}

function changeHtml(change, duplicateState) {
  const source = change.sourceFile ? `<div class="change-source">${escapeHtml(change.sourceFile)}</div>` : "";
  return `
    <article class="change-card">
      <div class="change-card-head">
        <div>
          <div class="change-label">${escapeHtml(change.boardLabel)}</div>
          <h3>${escapeHtml(change.title)}</h3>
          ${source}
        </div>
        <div class="change-actions">
          <a class="topbar-link" href="${escapeHtml(change.baseUrl)}">查看 ${escapeHtml(changelogData.baseVersion)}</a>
          <a class="topbar-link" href="${escapeHtml(change.targetUrl)}">查看 ${escapeHtml(changelogData.targetVersion)}</a>
        </div>
      </div>
      <div class="change-diffs">
        ${(change.diffs || []).map((diff, index) => diffHtml(change, diff, index, duplicateState)).join("")}
      </div>
    </article>
  `;
}

function diffHtml(change, diff, index, duplicateState) {
  const kindLabel = diff.kind === "raw" ? "源代码" : "抽取字段";
  const currentState = duplicateState.get(diffStateKey(change, index)) || { current: 1, total: 1, repeated: false };
  const duplicateClass = currentState.repeated ? " is-duplicate" : "";
  const duplicateLabel = currentState.total > 1
    ? `<span class="change-duplicate-badge">同类 ${currentState.current}/${currentState.total}</span>`
    : "";
  return `
    <details class="change-diff${duplicateClass}">
      <summary>
        <span>${escapeHtml(diff.label)}</span>
        <span class="change-summary-actions">
          ${duplicateLabel}
          <span class="change-open-label">查看对应内容的源代码变化</span>
          <span class="change-kind">${escapeHtml(kindLabel)}</span>
        </span>
      </summary>
      <div class="source-compare" aria-label="源代码变化 ${index + 1}">
        <section>
          <h4>${escapeHtml(changelogData.baseVersion)}</h4>
          <pre><code>${escapeHtml(diff.oldText)}</code></pre>
        </section>
        <section>
          <h4>${escapeHtml(changelogData.targetVersion)}</h4>
          <pre><code>${escapeHtml(diff.newText)}</code></pre>
        </section>
      </div>
    </details>
  `;
}

function changelogSearchBlob(change) {
  return [
    change.boardLabel,
    change.key,
    change.title,
    change.sourceFile,
    ...(change.diffs || []).flatMap((diff) => [diff.path, diff.label, diff.oldText, diff.newText]),
  ].join("\n").toLowerCase();
}

function bindSettingsControls(container = els.countryList) {
  const white = container?.querySelector("#whiteDecentralizedSetting");
  const subjectOverlordColors = container?.querySelector("#subjectOverlordColorsSetting");
  const omitIndigenous = container?.querySelector("#omitIndigenousSetting");
  const omitDecentralized = container?.querySelector("#omitDecentralizedTagsSetting");
  white?.addEventListener("change", () => {
    state.whiteDecentralized = white.checked;
    persistDisplaySetting("vicdata-white-decentralized", state.whiteDecentralized);
    render();
    renderInfoDialog();
  });
  subjectOverlordColors?.addEventListener("change", () => {
    state.subjectOverlordColors = subjectOverlordColors.checked;
    persistDisplaySetting("vicdata-subject-overlord-colors", state.subjectOverlordColors);
    render();
    renderInfoDialog();
  });
  omitIndigenous?.addEventListener("change", () => {
    state.omitIndigenousLanguagesCultures = omitIndigenous.checked;
    persistDisplaySetting("vicdata-omit-indigenous", state.omitIndigenousLanguagesCultures);
    renderFilterOptions();
    render();
    renderInfoDialog();
  });
  omitDecentralized?.addEventListener("change", () => {
    state.omitDecentralizedTags = omitDecentralized.checked;
    persistDisplaySetting("vicdata-omit-decentralized-tags", state.omitDecentralizedTags);
    render();
    renderInfoDialog();
  });
}

function renderCountryBoard() {
  const filtered = countries.filter(matchesCountryFilters).sort(sortCountries);
  mapRuntime.filteredCountryTags = new Set(filtered.map((country) => country.tag));
  mapRuntime.countrySearchMatchedTags = state.search
    ? new Set(filtered.map((country) => country.tag))
    : new Set();
  if (state.selectedTag && !byTag.has(state.selectedTag)) state.selectedTag = "";
  if (!isDetailPageRoute() && state.selectedTag && !filtered.some((country) => country.tag === state.selectedTag)) state.selectedTag = "";
  const selectedCountry = byTag.get(state.selectedTag);
  els.resultCount.textContent = `${filtered.length} 个国家`;
  els.activeHint.textContent = buildActiveHint(filtered.length);
  renderCountryList(filtered);
  renderMap(countryMapStateRegions(selectedCountry));
  focusCountryOnMap(selectedCountry);
  renderMobileCountryControls();
  if (state.countryMobileRestoreScrollPending) {
    state.countryMobileRestoreScrollPending = false;
    if (window.matchMedia("(max-aspect-ratio: 3 / 2)").matches) {
      requestAnimationFrame(() => {
        window.scrollTo(0, state.countryMobileListScrollTop);
      });
    }
  }
}

function renderCultureBoard() {
  const filtered = cultures.filter(matchesCultureFilters).sort(sortCultures);
  if (state.selectedCulture && !byCulture.has(state.selectedCulture)) state.selectedCulture = "";
  if (!isDetailPageRoute() && state.selectedCulture && !filtered.some((culture) => culture.key === state.selectedCulture)) state.selectedCulture = "";
  els.resultCount.textContent = `${filtered.length} 个文化`;
  els.activeHint.textContent = buildActiveHint(filtered.length);
  renderCultureList(filtered);
  renderMap(stateRegions);
  focusCultureOnMap(byCulture.get(state.selectedCulture));
  renderMobileCultureControls();
  if (state.cultureMobileRestoreScrollPending) {
    state.cultureMobileRestoreScrollPending = false;
    if (window.matchMedia("(max-aspect-ratio: 3 / 2)").matches) {
      requestAnimationFrame(() => {
        window.scrollTo(0, state.cultureMobileListScrollTop);
      });
    }
  }
}

function renderRegionBoard() {
  const {
    filteredStrategicRegions,
    filteredSeaRegions,
    filteredStateRegions,
    filteredGeographicRegions,
    filteredSeaStateRegions,
  } = regionBoardMapInputs();
  if (state.selectedStateRegion && !byStateRegion.has(state.selectedStateRegion)) state.selectedStateRegion = "";
  if (state.mapSelectedStateRegion && !byStateRegion.has(state.mapSelectedStateRegion)) state.mapSelectedStateRegion = "";
  if (!isDetailPageRoute() && state.selectedStateRegion && !filteredStateRegions.some((stateRegion) => stateRegion.key === state.selectedStateRegion) && state.selectedStateRegion !== state.mapSelectedStateRegion) state.selectedStateRegion = "";
  if (state.selectedStrategicRegion && ![...filteredStrategicRegions, ...filteredSeaRegions].some((region) => region.key === state.selectedStrategicRegion)) {
    state.selectedStrategicRegion = "";
  }
  if (state.selectedGeographicRegion && !filteredGeographicRegions.some((region) => region.key === state.selectedGeographicRegion)) {
    state.selectedGeographicRegion = "";
  }
  if (!["stateRegion", "strategicRegion", "geographicRegion"].includes(state.detailKind)) {
    state.detailKind = regionListModeDetailKind();
  }
  const selectedStateRegion = byStateRegion.get(state.selectedStateRegion);
  els.resultCount.textContent = t("board.region.resultCount", { count: localizedNumber(filteredStateRegions.length) });
  els.activeHint.textContent = buildActiveHint(filteredStateRegions.length);
  renderRegionList(filteredStrategicRegions, filteredStateRegions, filteredSeaRegions, filteredGeographicRegions);
  renderMap(regionMapStateRegions(filteredStateRegions, filteredSeaStateRegions, filteredGeographicRegions));
  focusStateRegionOnMap(selectedStateRegion);
}

function regionBoardMapInputs() {
  const filteredStrategicRegions = landStrategicRegions.filter(matchesStrategicRegionFilters).sort(sortStrategicRegionRef);
  const filteredSeaRegions = seaStrategicRegions.filter(matchesStrategicRegionFilters).sort(sortStrategicRegionRef);
  const filteredStateRegions = landStateRegions.filter(matchesStateRegionFilters).sort(sortStateRegions);
  const filteredGeographicRegions = geographicRegions.filter(matchesGeographicRegionFilters).sort(sortGeographicRegions);
  const filteredSeaStateRegions = uniqueByKey(filteredSeaRegions
    .flatMap((region) => region.states || [])
    .map((stateRef) => byStateRegion.get(stateRef.key))
    .filter(Boolean));
  return {
    filteredStrategicRegions,
    filteredSeaRegions,
    filteredStateRegions,
    filteredGeographicRegions,
    filteredSeaStateRegions,
  };
}

function renderRegionMapForCurrentFilters() {
  const inputs = regionBoardMapInputs();
  renderMap(regionMapStateRegions(
    inputs.filteredStateRegions,
    inputs.filteredSeaStateRegions,
    inputs.filteredGeographicRegions,
  ));
}

function renderCompanyBoard() {
  const filtered = companies.filter(matchesCompanyFilters).sort(sortCompanies);
  if (state.selectedCompany && !byCompany.has(state.selectedCompany)) state.selectedCompany = "";
  if (!isDetailPageRoute() && state.selectedCompany && !filtered.some((company) => company.key === state.selectedCompany)) state.selectedCompany = "";
  const selectedCompany = byCompany.get(state.selectedCompany);
  mapRuntime.companyMapCompanies = selectedCompany ? [selectedCompany] : filtered;
  els.resultCount.textContent = t("board.company.resultCount", { count: localizedNumber(filtered.length) });
  els.activeHint.textContent = buildActiveHint(filtered.length);
  renderCompanyList(filtered);
  if (isDetailPageRoute() && companyDetailLocationMapEnabled(selectedCompany) && companyLocationStateRegionKeys(selectedCompany).length) {
    renderMap(companyMapStateRegions(mapRuntime.companyMapCompanies));
    focusCompanyOnMap(selectedCompany);
  }
}

function renderIdeologyBoard() {
  const filtered = ideologies.filter(matchesIdeologyFilters).sort(sortIdeologies);
  if (state.selectedIdeology && !ideologyByKey.has(state.selectedIdeology)) state.selectedIdeology = "";
  if (!isDetailPageRoute() && state.selectedIdeology && !filtered.some((ideology) => ideology.key === state.selectedIdeology)) state.selectedIdeology = "";
  els.resultCount.textContent = `${filtered.length} 个意识形态`;
  els.activeHint.textContent = buildActiveHint(filtered.length);
  renderIdeologyList(filtered);
}

function renderLawBoard() {
  const filtered = laws.filter(matchesLawFilters).sort(sortLaws);
  if (state.selectedLaw && !lawByKey.has(state.selectedLaw)) state.selectedLaw = "";
  if (!isDetailPageRoute() && state.selectedLaw && !filtered.some((law) => law.key === state.selectedLaw)) state.selectedLaw = "";
  els.resultCount.textContent = `${filtered.length} 条法律`;
  els.activeHint.textContent = buildActiveHint(filtered.length);
  renderLawList(filtered);
}

const technologyGridPositions = {
  production: {
    united_fruit_banana_tech: { column: 8, row: 1 },
    sericulture: { column: 10, row: 1 },
    enclosure: { column: 14, row: 1 },
    manufacturies: { column: 21, row: 1 },
    shaft_mining: { column: 17, row: 2 },
    distillation: { column: 22, row: 2 },
    cotton_gin: { column: 24, row: 2 },
    prospecting: { column: 14, row: 3 },
    steelworking: { column: 16, row: 3 },
    lathe: { column: 24, row: 3 },
    intensive_agriculture: { column: 10, row: 4 },
    bessemer_process: { column: 16, row: 4 },
    atmospheric_engine: { column: 18, row: 4 },
    mechanical_tools: { column: 20, row: 4 },
    fractional_distillation: { column: 22, row: 4 },
    crystal_glass: { column: 24, row: 4 },
    canneries: { column: 26, row: 4 },
    nitroglycerin: { column: 10, row: 5 },
    watertube_boiler: { column: 17, row: 5 },
    railways: { column: 19, row: 5 },
    baking_powder: { column: 21, row: 5 },
    mechanized_workshops: { column: 23, row: 5 },
    chemical_bleaching: { column: 25, row: 5 },
    improved_fertilizer: { column: 4, row: 6 },
    steam_donkey: { column: 6, row: 6 },
    dynamite: { column: 8, row: 6 },
    open_hearth_process: { column: 10, row: 6 },
    reinforced_concrete: { column: 13, row: 6 },
    rotary_valve_engine: { column: 15, row: 6 },
    steel_railway_cars: { column: 17, row: 6 },
    shift_work: { column: 19, row: 6 },
    vacuum_canning: { column: 21, row: 6 },
    rubber_mastication: { column: 23, row: 6 },
    threshing_machine: { column: 5, row: 7 },
    pumpjacks: { column: 7, row: 7 },
    electrical_generation: { column: 17, row: 7 },
    aniline: { column: 23, row: 7 },
    vulcanization: { column: 25, row: 7 },
    nitrogen_fixation: { column: 1, row: 8 },
    mechanized_farming: { column: 3, row: 8 },
    electric_arc_process: { column: 5, row: 8 },
    plastics: { column: 7, row: 8 },
    pneumatic_tools: { column: 9, row: 8 },
    steam_turbine: { column: 11, row: 8 },
    electrical_capacitors: { column: 13, row: 8 },
    combustion_engine: { column: 15, row: 8 },
    telephone: { column: 17, row: 8 },
    conveyors: { column: 20, row: 8 },
    art_silk: { column: 23, row: 8 },
    automatic_bottle_blowers: { column: 25, row: 8 },
    electric_railway: { column: 16, row: 9 },
    radio: { column: 18, row: 9 },
    pasteurization: { column: 20, row: 9 },
    arc_welding: { column: 7, row: 10 },
    oil_turbine: { column: 11, row: 10 },
    compression_ignition: { column: 15, row: 10 },
    flash_freezing: { column: 20, row: 10 },
    dough_rollers: { column: 22, row: 10 },
  },
  military: {
    navigation: { column: 20, row: 1 },
    admiralty: { column: 19, row: 2 },
    drydocks: { column: 21, row: 2 },
    paddle_steamer: { column: 20, row: 3 },
    power_of_the_purse: { column: 17, row: 5 },
    screw_frigate: { column: 20, row: 5 },
    hydraulic_cranes: { column: 22, row: 5 },
    self_propelled_torpedoes: { column: 16, row: 7 },
    ironclad_tech: { column: 19, row: 7 },
    gantry_cranes: { column: 22, row: 7 },
    monitor_tech: { column: 15, row: 8 },
    jeune_ecole: { column: 17, row: 8 },
    floating_harbor: { column: 23, row: 8 },
    submarine: { column: 16, row: 9 },
    landing_craft: { column: 18, row: 9 },
    sea_lane_strategies: { column: 20, row: 9 },
    pre_dreadnought_tech: { column: 22, row: 9 },
    concrete_dockyards: { column: 24, row: 9 },
    dreadnought_tech: { column: 19, row: 10 },
    destroyer: { column: 15, row: 11 },
    carrier_tech: { column: 17, row: 11 },
    battleship_tech: { column: 19, row: 11 },
    battlefleet_tactics: { column: 20, row: 12 },
    standing_army: { column: 7, row: 1 },
    mandatory_service: { column: 5, row: 2 },
    military_drill: { column: 7, row: 2 },
    gunsmithing: { column: 9, row: 2 },
    line_infantry: { column: 6, row: 3 },
    artillery: { column: 8, row: 3 },
    army_reserves: { column: 5, row: 4 },
    napoleonic_warfare: { column: 7, row: 4 },
    general_staff: { column: 4, row: 5 },
    logistics: { column: 6, row: 5 },
    field_works: { column: 8, row: 5 },
    shell_gun: { column: 10, row: 5 },
    percussion_cap: { column: 12, row: 5 },
    triage: { column: 6, row: 6 },
    rifling: { column: 12, row: 6 },
    enlistment_offices: { column: 3, row: 7 },
    modern_nursing: { column: 6, row: 7 },
    electric_telegraph: { column: 9, row: 7 },
    breech_loading_artillery: { column: 11, row: 7 },
    repeaters: { column: 13, row: 7 },
    military_statistics: { column: 5, row: 8 },
    handcranked_machine_gun: { column: 11, row: 8 },
    war_propaganda: { column: 2, row: 9 },
    trench_works: { column: 5, row: 9 },
    wargaming: { column: 7, row: 9 },
    military_aviation: { column: 11, row: 9 },
    bolt_action_rifles: { column: 13, row: 9 },
    defense_in_depth: { column: 7, row: 10 },
    automatic_machine_guns: { column: 11, row: 10 },
    nco_training: { column: 2, row: 11 },
    stormtroopers: { column: 4, row: 11 },
    flamethrowers: { column: 7, row: 11 },
    concrete_fortifications: { column: 9, row: 11 },
    chemical_warfare: { column: 11, row: 11 },
    mobile_armor: { column: 6, row: 12 },
  },
  society: {
    urbanization: { column: 7, row: 1 },
    rationalism: { column: 22, row: 1 },
    urban_planning: { column: 6, row: 2 },
    tech_bureaucracy: { column: 8, row: 2 },
    democracy: { column: 21, row: 2 },
    academia: { column: 23, row: 2 },
    law_enforcement: { column: 7, row: 3 },
    international_trade: { column: 9, row: 3 },
    centralization: { column: 11, row: 3 },
    international_relations: { column: 13, row: 3 },
    mass_communication: { column: 22, row: 3 },
    medical_degrees: { column: 24, row: 3 },
    romanticism: { column: 26, row: 3 },
    empiricism: { column: 28, row: 3 },
    stock_exchange: { column: 8, row: 4 },
    currency_standards: { column: 10, row: 4 },
    colonization: { column: 15, row: 4 },
    banking: { column: 10, row: 5 },
    modern_sewerage: { column: 3, row: 6 },
    corporate_charters: { column: 5, row: 6 },
    postal_savings: { column: 8, row: 6 },
    central_banking: { column: 11, row: 6 },
    central_archives: { column: 13, row: 6 },
    nationalism: { column: 16, row: 6 },
    egalitarianism: { column: 18, row: 6 },
    pharmaceuticals: { column: 23, row: 6 },
    realism: { column: 25, row: 6 },
    dialectics: { column: 27, row: 6 },
    psychiatry: { column: 29, row: 6 },
    joint_stock_companies: { column: 8, row: 7 },
    organized_sports: { column: 15, row: 7 },
    quinine: { column: 20, row: 7 },
    labor_movement: { column: 22, row: 7 },
    steel_frame_buildings: { column: 3, row: 8 },
    mutual_funds: { column: 9, row: 8 },
    identification_documents: { column: 11, row: 8 },
    "pan-nationalism": { column: 13, row: 8 },
    human_rights: { column: 15, row: 8 },
    civilizing_mission: { column: 17, row: 8 },
    anarchism: { column: 19, row: 8 },
    corporatism: { column: 21, row: 8 },
    camera: { column: 23, row: 8 },
    socialism: { column: 25, row: 8 },
    philosophical_pragmatism: { column: 29, row: 8 },
    investment_banks: { column: 8, row: 9 },
    feminism: { column: 15, row: 9 },
    elevator: { column: 1, row: 10 },
    zeppelins: { column: 3, row: 10 },
    corporate_management: { column: 6, row: 10 },
    international_exchange_standards: { column: 9, row: 10 },
    central_planning: { column: 11, row: 10 },
    multilateral_alliances: { column: 13, row: 10 },
    malaria_prevention: { column: 17, row: 10 },
    political_agitation: { column: 21, row: 10 },
    film: { column: 23, row: 10 },
    psychoanalysis: { column: 29, row: 10 },
    paved_roads: { column: 1, row: 11 },
    macroeconomics: { column: 7, row: 11 },
    modern_financial_instruments: { column: 9, row: 11 },
    mass_surveillance: { column: 11, row: 11 },
    antibiotics: { column: 17, row: 11 },
    mass_propaganda: { column: 22, row: 11 },
    behaviorism: { column: 26, row: 11 },
    analytical_philosophy: { column: 29, row: 11 },
  },
};

function technologyGraphLayout() {
  const eras = technologyEras.map((era) => era.key);
  const technologyGraphCategory = state.technologyCategory;
  const technologyPositions = technologyGridPositions[technologyGraphCategory] || {};
  const technologyGridColumns = Math.max(1, ...Object.values(technologyPositions).map((position) => position.column));
  let technologyGridRows = Math.max(1, ...Object.values(technologyPositions).map((position) => position.row));
  const technologyGridCellWidth = 83;
  const technologyGridCellHeight = 138;
  const technologyGridLeft = 76;
  const technologyGridTop = 38;
  const eraBaseRows = [0, 2, 4, 6, 8];
  const occupiedPositions = new Set(Object.values(technologyPositions).map((position) => `${position.column}:${position.row}`));
  const nextAvailablePosition = (eraIndex) => {
    for (let row = eraBaseRows[eraIndex] + 1; ; row += 1) {
      for (let column = 1; column <= technologyGridColumns; column += 1) {
        const key = `${column}:${row}`;
        if (occupiedPositions.has(key)) continue;
        occupiedPositions.add(key);
        technologyGridRows = Math.max(technologyGridRows, row);
        return { column, row };
      }
    }
  };
  const nodes = new Map();
  eras.forEach((era, eraIndex) => {
    const eraTechnologies = technologies.filter((item) => item.category === technologyGraphCategory && item.era === era)
      .sort((a, b) => localizedCompare(entityText(a), entityText(b)));
    eraTechnologies.forEach((technology) => {
      const position = technologyPositions?.[technology.key] || nextAvailablePosition(eraIndex);
      const { column, row } = position;
      nodes.set(technology.key, {
        technology,
        x: technologyGridLeft + (column - 1) * technologyGridCellWidth - 50,
        y: technologyGridTop + (row - 1) * technologyGridCellHeight - 40,
      });
    });
  });
  return { nodes, width: technologyGridLeft * 2 + technologyGridColumns * technologyGridCellWidth, height: technologyGridTop + 76 + technologyGridRows * technologyGridCellHeight, technologyGridColumns, technologyGridRows, technologyGridCellWidth, technologyGridCellHeight, technologyGridLeft, technologyGridTop, eraBaseRows, technologyGraphCategory };
}

function technologyGraphEdges(layout) {
  return [...layout.nodes.values()].flatMap((to) => to.technology.prerequisites.map((key) => {
    const from = layout.nodes.get(key);
    return from ? { from, to } : null;
  }).filter(Boolean));
}

function technologyEdgePath(from, to) {
  const cardWidth = 144;
  const cardHeight = 88;
  const fromCenterX = from.x + cardWidth / 2;
  const fromCenterY = from.y + cardHeight / 2;
  const toCenterX = to.x + cardWidth / 2;
  const toCenterY = to.y + cardHeight / 2;
  const downward = toCenterY >= fromCenterY;
  const startY = downward ? from.y + cardHeight : from.y;
  const endY = downward ? to.y : to.y + cardHeight;
  const stubLength = 16;
  const startStubY = startY + (downward ? stubLength : -stubLength);
  const endStubY = endY + (downward ? -stubLength : stubLength);
  const diagonalX = toCenterX - fromCenterX;
  const diagonalY = endStubY - startStubY;
  const diagonalLength = Math.hypot(diagonalX, diagonalY) || 1;
  const curveLength = Math.min(12, diagonalLength / 3);
  const unitX = diagonalX / diagonalLength;
  const unitY = diagonalY / diagonalLength;
  const startCurveX = fromCenterX;
  const startCurveY = startStubY - (downward ? curveLength : -curveLength);
  const startDiagonalX = fromCenterX + unitX * curveLength;
  const startDiagonalY = startStubY + unitY * curveLength;
  const endDiagonalX = toCenterX - unitX * curveLength;
  const endDiagonalY = endStubY - unitY * curveLength;
  const endCurveX = toCenterX;
  const endCurveY = endStubY + (downward ? curveLength : -curveLength);
  return `M${fromCenterX} ${startY} V${startCurveY} Q${startCurveX} ${startStubY} ${startDiagonalX} ${startDiagonalY} L${endDiagonalX} ${endDiagonalY} Q${endCurveX} ${endStubY} ${toCenterX} ${endCurveY} V${endY}`;
}

function technologyNodeHtml(node) {
  const selected = node.technology.key === state.selectedTechnology;
  const iconFile = node.technology.icon.split("/").pop().replace(/\.dds$/i, ".webp");
  return `<button class="technology-node" type="button" data-technology-key="${escapeHtml(node.technology.key)}" aria-pressed="${selected}" style="left:${node.x}px;top:${node.y}px"><img src="assets/technologies/${escapeHtml(iconFile)}" alt="" aria-hidden="true"><span>${escapeHtml(entityText(node.technology))}</span>${victorianCenturyBadge(node.technology)}</button>`;
}

function renderTechnologyBoard() {
  const layout = technologyGraphLayout();
  const selected = technologyByKey.get(state.selectedTechnology) || null;
  const normalizedSearch = state.technologySearch.trim();
  const visibleNodes = [...layout.nodes.values()].filter((node) => !normalizedSearch || matchesLocalizedQuery(node.technology, normalizedSearch));
  const visibleNodeKeys = new Set(visibleNodes.map((node) => node.technology.key));
  const edges = technologyGraphEdges(layout).filter(({ from, to }) => visibleNodeKeys.has(from.technology.key) && visibleNodeKeys.has(to.technology.key));
  els.countryList.className = "country-list technology-board";
  els.resultCount.textContent = "";
  els.activeHint.textContent = "";
  const categoryLabels = Object.fromEntries(["production", "military", "society"].map((key) => [key, t(`enum.technology.${key}`, key)]));
  els.countryList.innerHTML = `<section class="technology-shell"><div class="technology-controls"><select data-technology-category-select aria-label="${escapeHtml(t("board.technology.category", "科技类别"))}">${Object.entries(categoryLabels).map(([key,label]) => `<option value="${key}" ${layout.technologyGraphCategory === key ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select><input type="search" data-technology-search aria-label="${escapeHtml(t("board.technology.search", "搜索科技"))}" placeholder="${escapeHtml(t("board.technology.search", "搜索科技"))}" value="${escapeHtml(state.technologySearch)}"><button class="map-tool-button" type="button" data-technology-reset aria-label="${escapeHtml(t("board.technology.resetView", "重置视图"))}" title="${escapeHtml(t("board.technology.resetView", "重置视图"))}"><img class="lucide-icon" src="assets/lucide/icons/refresh-ccw.svg" alt="" aria-hidden="true"></button></div><div class="technology-graph-viewport"><div class="technology-graph-canvas technology-grid-${layout.technologyGridColumns}x${layout.technologyGridRows}" style="width:${layout.width}px;height:${layout.height}px;transform:translate(${state.technologyViewport.x}px,${state.technologyViewport.y}px) scale(${state.technologyViewport.scale})"><svg class="technology-graph-edges" width="${layout.width}" height="${layout.height}" aria-hidden="true">${edges.map(({ from, to }) => { const highlighted = selected && (from.technology.key === selected.key || to.technology.key === selected.key); const stroke = highlighted ? "#c8a45b" : "#b7a883"; const strokeWidth = highlighted ? 5 : 3; const path = technologyEdgePath(from, to); return `<path d="${path}" fill="none" class="${highlighted ? "is-highlighted" : ""}" style="fill:none !important;stroke:${stroke} !important;stroke-width:${strokeWidth} !important"/>`; }).join("")}</svg>${visibleNodes.map(technologyNodeHtml).join("")}</div></div><div class="technology-mobile-list">${technologyEras.map((era) => `<details open><summary>${escapeHtml(entityText(era, "label", t(`enum.technologyEra.${era.key}`, era.key)))}</summary>${visibleNodes.filter((node) => node.technology.era === era.key).map(technologyNodeHtml).join("")}</details>`).join("")}</div><div class="technology-local-graph">${selected ? t("board.technology.localRelation", { name: entityText(selected), prerequisites: localizedNumber(selected.prerequisites.length), unlocks: localizedNumber(selected.unlocks.length) }) : t("board.technology.selectForRelations", "选择科技查看局部关系")}</div></section>`;
  els.detail.innerHTML = renderTechnologyDetail(selected);
  els.countryList.querySelectorAll("[data-technology-key]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => event.stopPropagation());
    button.addEventListener("click", () => { location.hash = `/technology/${encodeURIComponent(button.dataset.technologyKey)}`; });
  });
  els.countryList.querySelector("[data-technology-category-select]")?.addEventListener("change", (event) => { state.technologyCategory = event.target.value; state.technologySearch = ""; state.selectedTechnology = ""; state.technologyViewport = { x: 0, y: 0, scale: 1 }; render(); });
  els.countryList.querySelector("[data-technology-search]")?.addEventListener("input", (event) => { state.technologySearch = event.target.value; renderTechnologyBoard(); });
  els.countryList.querySelector("[data-technology-reset]")?.addEventListener("click", () => { state.technologyViewport = { x: 0, y: 0, scale: 1 }; render(); });
  const viewport = els.countryList.querySelector(".technology-graph-viewport");
  let drag = null;
  viewport?.addEventListener("pointerdown", (event) => { if (event.target.closest(".technology-node")) return; drag = { x: event.clientX, y: event.clientY, startX: state.technologyViewport.x, startY: state.technologyViewport.y }; viewport.setPointerCapture(event.pointerId); });
  viewport?.addEventListener("pointermove", (event) => { if (!drag) return; state.technologyViewport.x = drag.startX + event.clientX - drag.x; state.technologyViewport.y = drag.startY + event.clientY - drag.y; const canvas = viewport.querySelector(".technology-graph-canvas"); if (canvas) canvas.style.transform = `translate(${state.technologyViewport.x}px,${state.technologyViewport.y}px) scale(${state.technologyViewport.scale})`; });
  viewport?.addEventListener("pointerup", () => { drag = null; });
  viewport?.addEventListener("wheel", (event) => { event.preventDefault(); state.technologyViewport.scale = Math.max(.7, Math.min(1.8, state.technologyViewport.scale * (event.deltaY < 0 ? 1.1 : .9))); const canvas = viewport.querySelector(".technology-graph-canvas"); if (canvas) canvas.style.transform = `translate(${state.technologyViewport.x}px,${state.technologyViewport.y}px) scale(${state.technologyViewport.scale})`; }, { passive: false });
}

function renderTechnologyDetail(technology) {
  if (!technology) return "";
  const relation = (items, label) => `<section><h3>${escapeHtml(label)}</h3><div class="technology-relation-tags">${items.length ? items.map((item) => `<button class="pill tag-technology" type="button" data-technology-target="${escapeHtml(item.key)}">${escapeHtml(entityText(item))}</button>`).join("") : t("ui.none", "无")}</div></section>`;
  const refs = technology.references || { laws: [], companies: [] };
  const linkItems = (items, route) => items.length ? items.map((item) => `<a class="pill" href="#/${route}/${encodeURIComponent(item.key)}">${escapeHtml(entityText(item))}</a>`).join("") : t("ui.none", "无");
  queueMicrotask(() => {
    document.querySelectorAll("[data-technology-target]").forEach((button) => button.addEventListener("click", () => { location.hash = `/technology/${encodeURIComponent(button.dataset.technologyTarget)}`; }));
    document.querySelector("[data-technology-back]")?.addEventListener("click", () => { location.hash = "/technology"; });
  });
  const eraLabel = t(`enum.technologyEra.${technology.era}`, technology.era);
  const meta = t("board.technology.meta", { category: t(`enum.technology.${technology.category}`, technology.category), era: eraLabel, cost: localizedNumber(technology.era_cost) });
  const description = entityText(technology, "description", t("ui.noDescription", "无说明"));
  return `<section class="technology-detail"><div class="detail-title"><button class="detail-back-button" type="button" data-technology-back aria-label="${escapeHtml(t("board.technology.back", "返回科技树"))}" title="${escapeHtml(t("board.technology.back", "返回科技树"))}"><img class="lucide-icon" src="assets/lucide/icons/arrow-left.svg" alt="" aria-hidden="true"></button><div class="detail-title-main"><h2>${escapeHtml(entityText(technology))}</h2></div>${victorianCenturyBadge(technology)}</div><p>${escapeHtml(meta)}</p><p>${escapeHtml(description)}</p>${relation(technology.prerequisites.map((key) => technologyByKey.get(key)).filter(Boolean), t("board.technology.prerequisites", "前置科技"))}${relation(technology.unlocks, t("board.technology.unlocks", "后续科技"))}<section><h3>${t("board.technology.modifiers", "修正效果")}</h3>${technology.modifiers.length ? technology.modifiers.map((item) => `<p>${escapeHtml(renderTextSpec({ message: item.loc?.summary, fallback: item.key }))}</p>`).join("") : t("ui.none", "无")}</section><section><h3>${t("board.technology.relatedLaws", "关联法律")}</h3>${linkItems(refs.laws, "law")}</section><section><h3>${t("board.technology.relatedCompanies", "关联公司")}</h3>${linkItems(refs.companies, "company")}</section></section>`;
}

function renderDetailForState() {
  const activeDetailRouteKey = detailRouteKey();
  if (state.detailKind === "law" && lawByKey.has(state.selectedLaw)) {
    renderLawDetail(lawByKey.get(state.selectedLaw));
    return;
  }
  if (state.detailKind === "ideology" && ideologyByKey.has(state.selectedIdeology)) {
    renderIdeologyDetail(ideologyByKey.get(state.selectedIdeology));
    return;
  }
  if (state.detailKind === "company" && byCompany.has(state.selectedCompany) && activeDetailRouteKey) {
    renderCompanyDetail(byCompany.get(state.selectedCompany));
    return;
  }
  if (state.detailKind === "culture" && byCulture.has(state.selectedCulture)) {
    renderCultureDetail(byCulture.get(state.selectedCulture));
    return;
  }
  if (state.detailKind === "stateRegion" && byStateRegion.has(state.selectedStateRegion)) {
    renderStateRegionDetail(byStateRegion.get(state.selectedStateRegion));
    return;
  }
  if (state.detailKind === "strategicRegion" && byStrategicRegion.has(state.selectedStrategicRegion)) {
    renderStrategicRegionDetail(byStrategicRegion.get(state.selectedStrategicRegion));
    return;
  }
  if (state.detailKind === "geographicRegion" && byGeographicRegion.has(state.selectedGeographicRegion)) {
    renderGeographicRegionDetail(byGeographicRegion.get(state.selectedGeographicRegion));
    return;
  }
  renderCountryDetailPage(byTag.get(state.selectedTag));
}

function renderGlobalSearchBoard() {
  const results = globalSearchResults(state.globalSearch);
  if (!state.selectedGlobalResult || !results.some((item) => item.id === state.selectedGlobalResult)) {
    state.selectedGlobalResult = results[0]?.id || "";
  }
  els.resultCount.textContent = tc("results.count", results.length, { count: localizedNumber(results.length) });
  els.activeHint.textContent = state.globalSearch ? t("search.activeQuery", { query: state.globalSearch }) : "";
  renderGlobalSearchList(results);
  renderGlobalSearchDetail(results.find((item) => item.id === state.selectedGlobalResult) || null);
}

function renderGlobalSearchList(results) {
  els.countryList.className = "country-list global-search-list";
  if (!results.length) {
    els.countryList.innerHTML = `<p class="empty">${t("search.noResults")}</p>`;
    return;
  }
  const groups = [];
  for (const result of results) {
    let group = groups.find((item) => item.label === result.typeLabel);
    if (!group) {
      group = { label: result.typeLabel, items: [] };
      groups.push(group);
    }
    group.items.push(result);
  }
  els.countryList.innerHTML = groups.map((group) => `
    <div class="list-section-title">${escapeHtml(group.label)}</div>
    ${group.items.map((result) => `
      <button class="country-row global-result-row" type="button" data-global-result="${escapeHtml(result.id)}" aria-current="${result.id === state.selectedGlobalResult}">
        <span class="country-heading">
          ${result.kind === "country" ? countryFlagIconHtml(result.raw, "country-flag-inline") : result.color ? `<span class="country-color" style="${colorStyle(result.color)}" aria-hidden="true"></span>` : ""}
          <span class="tag">${escapeHtml(result.key)}</span>
          <span class="name">${escapeHtml(result.displayTitle || result.title)}</span>
        </span>
        <span class="minor country-meta">${escapeHtml(result.subtitle || result.searchHint || "")}</span>
      </button>
    `).join("")}
  `).join("");
  els.countryList.querySelectorAll("[data-global-result]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.selectedGlobalResult = button.dataset.globalResult;
      render();
    });
  });
}

function renderGlobalSearchDialogResults() {
  if (!els.globalSearchDialogResults) return;
  const results = globalSearchResults(state.globalSearch);
  if (!state.globalSearch) {
    els.globalSearchDialogResults.innerHTML = `<p class="empty">${t("search.enterQuery")}</p>`;
    return;
  }
  if (!results.length) {
    els.globalSearchDialogResults.innerHTML = `<p class="empty">${t("search.noResults")}</p>`;
    return;
  }
  const groups = [];
  for (const result of results) {
    let group = groups.find((item) => item.label === result.typeLabel);
    if (!group) {
      group = { label: result.typeLabel, items: [] };
      groups.push(group);
    }
    group.items.push(result);
  }
  let itemIndex = 0;
  els.globalSearchDialogResults.innerHTML = groups.map((group) => `
    <div class="list-section-title">${escapeHtml(group.label)}</div>
    ${group.items.map((result) => {
      const active = itemIndex === state.globalSearchActiveIndex;
      const html = `
        <button class="country-row global-result-row" type="button" data-global-dialog-result="${escapeHtml(result.id)}" data-result-kind="${escapeHtml(result.kind)}" data-result-key="${escapeHtml(result.navigationKey || result.key)}" aria-selected="${active}">
          ${renderEntityBadge(result.kind, result.raw || result, result.displayTitle || result.title)}
          <span class="country-heading">
            <span class="tag">${escapeHtml(result.key)}</span>
            <span class="name">${escapeHtml(result.displayTitle || result.title)}</span>
          </span>
          <span class="minor country-meta">${escapeHtml(result.subtitle || result.searchHint || "")}</span>
        </button>
      `;
      itemIndex += 1;
      return html;
    }).join("")}
  `).join("");
  els.globalSearchDialogResults.querySelectorAll("[data-global-dialog-result]").forEach((button, index) => {
    button.addEventListener("click", async () => {
      state.globalSearchActiveIndex = index;
      await navigateGlobalSearchResult(button.dataset.resultKind, button.dataset.resultKey);
      closeGlobalSearchDialog();
    });
  });
  updateGlobalSearchActiveDescendant();
}

function updateGlobalSearchActiveDescendant() {
  const items = [...(els.globalSearchDialogResults?.querySelectorAll("[data-global-dialog-result]") || [])];
  items.forEach((item, index) => {
    item.setAttribute("aria-selected", String(index === state.globalSearchActiveIndex));
    if (index === state.globalSearchActiveIndex) item.scrollIntoView({ block: "nearest" });
  });
}

async function navigateGlobalSearchResult(kind, key) {
  if (!kind || !key) return;
  if (kind !== "country") state.globalSearchColorRestoreTag = "";
  if (kind === "interestGroupFlavor") {
    const [countryTag, groupKey] = key.split(":");
    if (!countryTag || !groupKey) return;
    replaceHash(`/country/${encodeURIComponent(countryTag)}`);
    await applyHash();
    render();
    focusInterestGroupFlavorResult(countryTag, groupKey);
    return;
  }
  if (kind === "country") {
    state.globalSearchColorRestoreTag = key.toUpperCase();
    replaceHash(`/country/${encodeURIComponent(key)}`);
  }
  else if (kind === "culture") replaceHash(`/culture/${encodeURIComponent(key)}`);
  else if (kind === "stateRegion") replaceHash(`/state-region/${encodeURIComponent(key)}`);
  else if (kind === "strategicRegion") replaceHash(`/strategic-region/${encodeURIComponent(key)}`);
  else if (kind === "geographicRegion") replaceHash(`/geographic-region/${encodeURIComponent(key)}`);
  else if (kind === "company") replaceHash(`/company/${encodeURIComponent(key)}`);
  else if (kind === "ideology") replaceHash(`/ideology/${encodeURIComponent(key)}`);
  else if (kind === "law") replaceHash(`/law/${encodeURIComponent(key)}`);
  else if (kind === "technology") replaceHash(`/technology/${encodeURIComponent(key)}`);
  else if (kind === "achievement") replaceHash(`/achievement/${encodeURIComponent(key)}`);
  else return;
  await applyHash();
  render();
}

function renderGlobalSearchDetail(result) {
  if (!result) {
    els.detail.innerHTML = `<p class="empty">${t("search.noResults")}</p>`;
    return;
  }
  if (result.kind === "country") return renderCountryDetail(byTag.get(result.key));
  if (result.kind === "culture") return renderCultureDetail(byCulture.get(result.key));
  if (result.kind === "stateRegion") return renderStateRegionDetail(byStateRegion.get(result.key));
  if (result.kind === "strategicRegion") return renderStrategicRegionDetail(byStrategicRegion.get(result.key));
  if (result.kind === "geographicRegion") return renderGeographicRegionDetail(byGeographicRegion.get(result.key));
  if (result.kind === "company") return renderCompanyDetail(byCompany.get(result.key));
  if (result.kind === "ideology") return renderIdeologyDetail(ideologyByKey.get(result.key));
  if (result.kind === "law") return renderLawDetail(lawByKey.get(result.key));
  if (result.kind === "cultureTrait" || result.kind === "cultureTraitGroup") return renderCultureTraitDetail(result);
  if (result.kind === "interestGroup") return renderInterestGroupDetail(result);
  if (result.kind === "interestGroupTrait") return renderInterestGroupTraitDetail(result);
  if (result.kind === "interestGroupFlavor") return renderCountryDetail(byTag.get(result.countryTag));
  els.detail.innerHTML = `
    <div class="detail-title">
      <div class="detail-title-main"><h2>${escapeHtml(result.title)}</h2></div>
      <span class="tag">${escapeHtml(result.typeLabel)}</span>
    </div>
    <dl class="field-grid">
      ${field("编号", escapeHtml(result.key))}
      ${field("类型", escapeHtml(result.typeLabel))}
    </dl>
  `;
}

function globalSearchResults(query) {
  const needle = normalizeSearchText(query);
  if (!needle) return [];
  const results = (window.VIC3_SEARCH_INDEX?.entries || []).flatMap((entry) => {
    const names = Object.values(entry.names || {}).filter(Boolean);
    const haystack = normalizeSearchText([entry.key, ...names].join(" "));
    if (!haystack.includes(needle)) return [];
    const title = entry.names?.[localeRuntime.current] || entry.names?.en || entry.key;
    const aliases = [...new Set(names.filter((name) => name !== title))];
    const normalizedTitle = normalizeSearchText(title);
    const normalizedKey = normalizeSearchText(entry.key);
    const score = normalizedTitle === needle
      ? 0
      : normalizedKey === needle
        ? 1
        : normalizedTitle.startsWith(needle)
          ? 2
          : haystack.indexOf(needle) + 10;
    const kind = searchResultKind(entry.kind);
    const result = {
      ...entry,
      kind,
      typeLabel: t(`entity.${kind}`),
      title,
      aliases,
      raw: searchResultEntity(kind, entry.key),
      score,
    };
    return [{ ...result, displayTitle: globalSearchDisplayTitle(result, needle) }];
  });
  const order = new Map(["country", "culture", "stateRegion", "geographicRegion", "cultureTrait", "cultureTraitGroup", "strategicRegion", "company", "ideology", "law", "technology", "achievement", "interestGroup", "interestGroupTrait", "interestGroupFlavor"].map((kind, index) => [kind, index]));
  return results
    .sort((a, b) => a.score - b.score || orderValue(order, a.kind) - orderValue(order, b.kind) || localizedCompare(a.title, b.title))
    .slice(0, 120);
}

function searchResultKind(kind) {
  return kind === "region" ? "stateRegion" : kind;
}

function searchResultEntity(kind, key) {
  if (kind === "country") return byTag.get(key);
  if (kind === "culture") return byCulture.get(key);
  if (kind === "stateRegion") return byStateRegion.get(key);
  if (kind === "strategicRegion") return byStrategicRegion.get(key);
  if (kind === "geographicRegion") return byGeographicRegion.get(key);
  if (kind === "company") return byCompany.get(key);
  if (kind === "ideology") return ideologyByKey.get(key);
  if (kind === "law") return lawByKey.get(key);
  if (kind === "technology") return technologyByKey.get(key);
  if (kind === "achievement") return achievementByKey.get(key);
  if (kind === "cultureTrait") return cultureTraitByKey.get(key);
  if (kind === "interestGroup") return interestGroups.find((item) => item.key === key);
  if (kind === "interestGroupTrait") return interestGroupTraitByKey.get(key);
  return null;
}

function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase();
}

function renderCultureTraitDetail(result) {
  const trait = result.kind === "cultureTrait" ? cultureTraitByKey.get(result.key) : null;
  const group = result.kind === "cultureTraitGroup" ? cultureTraitGroupByKey.get(result.key) : null;
  const relatedCultures = cultures.filter((culture) => {
    if (trait) {
      return [culture.heritage, culture.language, ...(culture.traditions || [])].some((item) => item?.key === trait.key);
    }
    if (group) {
      return [culture.heritage_group, culture.language_group].some((item) => item?.key === group.key);
    }
    return false;
  }).sort(sortCultures);
  const title = trait?.name_zh || group?.name_zh || result.title;
  els.detail.innerHTML = `
    <div class="detail-title">
      <div class="detail-title-main"><h2>${escapeHtml(title)}</h2></div>
      <span class="tag">${escapeHtml(result.typeLabel)}</span>
    </div>
    <dl class="field-grid">
      ${field("编号", escapeHtml(result.key))}
      ${field("类型", escapeHtml(result.typeLabel))}
      ${field("所属组", escapeHtml(trait?.group_name_zh || group?.type_zh || ""))}
      ${field("相关文化", cultureLinks(relatedCultures.map((culture) => ({ key: culture.key, name_zh: culture.name_zh || culture.key }))))}
    </dl>
  `;
}

function renderInterestGroupDetail(result) {
  const group = byInterestGroup.get(result.key);
  if (!group) {
    els.detail.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  els.detail.innerHTML = `
    <div class="detail-title">
      <div class="detail-title-main">
        ${interestGroupIconHtml(group)}
        <h2>${escapeHtml(group.name_zh || group.key)}</h2>
      </div>
      <span class="tag">${escapeHtml(group.key)}</span>
    </div>
    <dl class="field-grid">
      ${field("标准色", colorValue(group.color?.hex, group.color?.rgb))}
      ${field("意识形态", ideologyPills(group.ideologies, "tag-ideology"))}
      ${field("角色意识形态", ideologyPills(group.character_ideologies, "tag-tradition"))}
      ${field("基础特质", interestGroupTraitDetailsHtml(group.base_traits, false))}
    </dl>
  `;
}

function renderInterestGroupTraitDetail(result) {
  const trait = interestGroupTraitByKey.get(result.key);
  if (!trait) {
    els.detail.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  els.detail.innerHTML = `
    <div class="detail-title">
      <div class="detail-title-main"><h2>${escapeHtml(trait.name_zh || trait.key)}</h2></div>
      <span class="tag">${escapeHtml(trait.key)}</span>
    </div>
    ${interestGroupTraitDetailCard(trait)}
  `;
}
