const HOME_NEWS_PAGE_SIZE = 10;
const NEWS_PAGE_SIZE = 25;
const newsCategoryLabels = {
  all: "全部",
  diary: "开发日志",
  patch: "版本更新",
  other: "其他",
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
    <div class="${className}" role="group" aria-label="游戏资讯分类">
      ${Object.entries(newsCategoryLabels).map(([key, label]) => `
        <button class="${className.slice(0, -1)}" type="button" data-news-category="${key}" aria-pressed="${state.newsCategory === key}">${label}</button>
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
      <div class="home-side-heading"><h2>游戏资讯</h2><span>最新 ${HOME_NEWS_PAGE_SIZE} 条</span></div>
      ${newsCategoryTabsHtml("home-news-tabs")}
      <div class="home-news-list">
        ${items.length ? items.map((item) => newsItemHtml(item, "home-news-item")).join("") : `<p class="empty">暂无资讯。</p>`}
      </div>
      <button class="home-news-more" type="button" data-news-more>查看更多 →</button>
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
  els.resultCount.textContent = "游戏资讯";
  els.activeHint.textContent = `${newsCategoryLabels[state.newsCategory]} · ${items.length} 条`;
  els.countryList.className = "country-list news-board";
  els.detail.innerHTML = "";
  els.countryList.innerHTML = `
    <section class="news-board-panel" aria-label="游戏资讯">
      <div class="news-board-heading">
        <div><h2>游戏资讯</h2><p>开发日志、版本更新与官方视频。</p></div>
        <span>第 ${state.newsPage} / ${pageCount} 页</span>
      </div>
      ${newsCategoryTabsHtml("news-board-tabs")}
      <div class="news-board-list">
        ${pageItems.length ? pageItems.map((item) => newsItemHtml(item, "news-board-item")).join("") : `<p class="empty">暂无资讯。</p>`}
      </div>
      <div class="news-pagination" aria-label="资讯分页">
        <button type="button" data-news-page="previous"${state.newsPage === 1 ? " disabled" : ""}>上一页</button>
        <span>第 ${state.newsPage} / ${pageCount} 页</span>
        <button type="button" data-news-page="next"${state.newsPage === pageCount ? " disabled" : ""}>下一页</button>
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

function renderHomeBoard() {
  mapRuntime.filteredCountryTags = new Set();
  els.resultCount.textContent = "";
  els.activeHint.textContent = "";
  els.countryList.className = "country-list home-board";
  const entries = [
    { category: "外交", label: "国家", text: `${dataCount("countries", countries)} 个国家`, view: "country", icon: "assets/home/waving_flag.png" },
    { category: "外交", label: "国家集团", text: "筹备中", icon: "assets/home/sovereign_empire.png" },
    { category: "外交", label: "外交条约与博弈", text: "筹备中", icon: "assets/home/international_diplomacy.png" },
    { category: "内政", label: "法律", text: `${laws.length} 条法律`, view: "law", icon: "assets/home/law_enforcement.png" },
    { category: "内政", label: "意识形态", text: `${dataCount("ideologies", ideologies)} 个意识形态`, view: "ideology", icon: "assets/home/democracy.png" },
    { category: "内政", label: "日志、事件与决议", text: "筹备中", icon: "assets/home/event_default.png" },
    { category: "社会", label: "文化", text: `${dataCount("cultures", cultures)} 个文化`, view: "culture", icon: "assets/home/nationalism.png" },
    { category: "社会", label: "科技", text: `${dataCount("technologies", technologies)} 项科技`, view: "technology", icon: "assets/home/academia.png" },
    { category: "社会", label: "角色", text: "筹备中", icon: "assets/home/event_portrait.png" },
    { category: "经济", label: "地区", text: `${landStateRegions.length} 个州地区`, view: "region", icon: "assets/home/state.png" },
    { category: "经济", label: "建筑", text: "筹备中", icon: "assets/home/manufacturies.png" },
    { category: "经济", label: "商品", text: "筹备中", icon: "assets/home/grand_strategy_games_prestige.png" },
    { category: "经济", label: "公司", text: `${dataCount("companies", companies)} 个公司`, view: "company", icon: "assets/home/companies.png" },
    { category: "军事", label: "陆军", text: "筹备中", icon: "assets/home/line_infantry.png" },
    { category: "军事", label: "海军", text: "筹备中", icon: "assets/home/dreadnought.png" },
    { category: "其他", label: "成就", text: "筹备中", icon: "assets/home/icon_achievements_enabled.png" },
    { category: "其他", label: "游戏资源展示", text: "筹备中", icon: "assets/home/romanticism.png" },
    { category: "其他", label: "更新日志", text: "版本差异", view: "changelog", icon: "assets/home/mass_communication.png" },
  ];
  const categoryRows = [["外交", "内政"], ["经济", "军事"], ["社会", "其他"]];
  const homeUpdatedAt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date()).replace(/\//g, "-");
  els.countryList.innerHTML = `
    <div class="home-category-list">
      ${categoryRows.map(([leftCategory, rightCategory]) => {
        const rowEntries = [...entries.filter((entry) => entry.category === leftCategory), ...entries.filter((entry) => entry.category === rightCategory)];
        return `
          <section class="home-category-row" aria-label="${escapeHtml(leftCategory)}和${escapeHtml(rightCategory)}">
            <div class="home-category-heading"><h2>${escapeHtml(leftCategory)}</h2><span>${escapeHtml(String(entries.filter((entry) => entry.category === leftCategory).length))} 项</span></div>
            <div class="home-category-heading"><h2>${escapeHtml(rightCategory)}</h2><span>${escapeHtml(String(entries.filter((entry) => entry.category === rightCategory).length))} 项</span></div>
            <div class="home-entry-grid">
              ${rowEntries.map((entry) => entry.view ? `
                <button class="home-entry" type="button" data-home-view="${escapeHtml(entry.view)}">
                  <img class="home-entry-icon" src="${escapeHtml(entry.icon)}" alt="" aria-hidden="true">
                  <span class="home-entry-copy"><strong>${escapeHtml(entry.label)}</strong><small>${escapeHtml(entry.text)}</small></span>
                </button>
              ` : `
                <article class="home-entry home-entry-pending" aria-label="${escapeHtml(entry.label)}，筹备中">
                  <img class="home-entry-icon" src="${escapeHtml(entry.icon)}" alt="" aria-hidden="true">
                  <span class="home-entry-copy"><strong>${escapeHtml(entry.label)}</strong><small>${escapeHtml(entry.text)}</small></span>
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
  els.detail.innerHTML = `
    <section class="home-side-panel home-announcement">
      <div class="home-side-heading"><h2>公告</h2><span>站内</span></div>
      <article class="home-announcement-item">
        <time>2026-07-13</time>
        <strong>主页资料入口正在调整</strong>
        <p>已建成板块可直接进入，后续板块会在资料准备完成后开放。</p>
      </article>
      <article class="home-announcement-item">
        <time>当前数据版本</time>
        <strong>Victoria 3 ${escapeHtml(data.meta?.victoria3_version || "未知")}</strong>
        <p>页面中的资料、筛选条件和地图内容以当前选择的版本为准。</p>
      </article>
      <p class="home-updated-at">最近更新：${escapeHtml(homeUpdatedAt)}</p>
    </section>
    ${renderHomeNewsHtml()}
  `;
  bindHomeNewsControls();
  renderMap([]);
}

function renderSettingsDialogContent() {
  return `
    <section class="settings-placeholder settings-panel">
      <p>这些选项会影响筛选栏、地图和国家列表的默认显示。</p>
      <label class="settings-toggle">
        <input id="whiteDecentralizedSetting" type="checkbox"${state.whiteDecentralized ? " checked" : ""}>
        <span>松散政权显示为白地</span>
      </label>
      <label class="settings-toggle">
        <input id="subjectOverlordColorsSetting" type="checkbox"${state.subjectOverlordColors ? " checked" : ""}>
        <span>低级附属国显示为宗主国的颜色</span>
      </label>
      <label class="settings-toggle">
        <input id="omitIndigenousSetting" type="checkbox"${state.omitIndigenousLanguagesCultures ? " checked" : ""}>
        <span>省略原住民语言、文化</span>
      </label>
      <label class="settings-toggle">
        <input id="omitDecentralizedTagsSetting" type="checkbox"${state.omitDecentralizedTags ? " checked" : ""}>
        <span>过滤松散政权 tag</span>
      </label>
    </section>
  `;
}

function renderAboutDialogContent() {
  const version = data.meta?.victoria3_version || "未知";
  return `
    <div class="about-dialog-grid">
      <section class="settings-placeholder about-intro">
        <h3>${escapeHtml(siteTitle)}</h3>
        <p>Vicdata 是一个面向《维多利亚 3》的资料查询网站。当前公开站点保留 ${escapeHtml(version)} 数据，提供国家、地区、文化、公司和意识形态等条目的浏览、筛选、搜索和地图查看。</p>
        <p>网站把游戏数据整理成静态页面，适合用来查国家标签、地区资源、公司条件、文化关系和意识形态对法律的态度。地图用于辅助查看开局归属、地区范围、文化本土和公司关联，不模拟游戏运行时的全部判断。</p>
      </section>
      <section class="about-stat-grid" aria-label="站点数据范围">
        ${aboutStat("当前版本", version)}
        ${aboutStat("国家", `${dataCount("countries", countries)} 个`)}
        ${aboutStat("州地区", `${landStateRegions.length} 个`)}
        ${aboutStat("文化", `${dataCount("cultures", cultures)} 个`)}
        ${aboutStat("公司", `${dataCount("companies", companies)} 个`)}
        ${aboutStat("意识形态", `${dataCount("ideologies", ideologies)} 个`)}
      </section>
      <section class="settings-placeholder about-note">
        <h3>数据与声明</h3>
        <p>站点数据来自本地《维多利亚 3》安装目录的解析和转换。项目不是 Paradox Interactive 或《维多利亚 3》的官方项目，游戏数据、图片、名称和商标仍属于原权利方。</p>
      </section>
    </div>
    <section class="settings-placeholder developer-card" aria-label="开发者简介">
      <img class="developer-avatar" src="assets/about/developer.jpg" alt="开发者头像">
      <div class="developer-copy">
        <h3>开发者</h3>
        <p>这个网站由霜月制作和维护。开发者长期整理《维多利亚 3》的数据、图标和地图资料，把分散在脚本、图片和本地数据库里的内容做成可以检索、可以对照的网页。</p>
        <p>站点的主要工作包括解析游戏文件、生成资料库、整理公开发布资源、调整中文界面，以及持续检查国家、地区、公司和意识形态页面的显示结果。</p>
        <a class="support-link" href="https://afdian.com/a/shimotsukiyukimi" target="_blank" rel="noopener noreferrer">BUY ME A TEA</a>
        <a class="feedback-link" href="${feedbackMailto}">发送希望添加的功能到 ${feedbackEmail}</a>
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
  els.resultCount.textContent = "更新日志";
  els.activeHint.textContent = changelogData.targetVersion && changelogData.baseVersion
    ? `${changelogData.baseVersion} -> ${changelogData.targetVersion}`
    : "版本变化";
  els.countryList.className = "country-list changelog-board";
  els.detail.innerHTML = "";
  renderMap([]);
  if (state.changelogLoading) {
    els.countryList.innerHTML = `<p class="empty">正在加载更新日志。</p>`;
    return;
  }
  if (state.changelogError) {
    els.countryList.innerHTML = `<p class="empty">${escapeHtml(state.changelogError)}</p>`;
    return;
  }
  if (changelogLoadedPair !== state.changelogPair) {
    els.countryList.innerHTML = `<p class="empty">没有可显示的更新日志。</p>`;
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
}

function renderCultureBoard() {
  const filtered = cultures.filter(matchesCultureFilters).sort(sortCultures);
  if (state.selectedCulture && !byCulture.has(state.selectedCulture)) state.selectedCulture = "";
  if (!isDetailPageRoute() && state.selectedCulture && !filtered.some((culture) => culture.key === state.selectedCulture)) state.selectedCulture = "";
  els.resultCount.textContent = `${filtered.length} 个文化`;
  els.activeHint.textContent = buildActiveHint(filtered.length);
  renderCultureList(filtered);
  renderMap(stateRegions);
}

function renderRegionBoard() {
  const filteredStrategicRegions = landStrategicRegions.filter(matchesStrategicRegionFilters).sort(sortStrategicRegionRef);
  const filteredSeaRegions = seaStrategicRegions.filter(matchesStrategicRegionFilters).sort(sortStrategicRegionRef);
  const filteredStateRegions = landStateRegions.filter(matchesStateRegionFilters).sort(sortStateRegions);
  const filteredGeographicRegions = geographicRegions.filter(matchesGeographicRegionFilters).sort(sortGeographicRegions);
  const filteredSeaStateRegions = uniqueByKey(filteredSeaRegions
    .flatMap((region) => region.states || [])
    .map((stateRef) => byStateRegion.get(stateRef.key))
    .filter(Boolean));
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
  els.resultCount.textContent = `州地区 ${filteredStateRegions.length} 个`;
  els.activeHint.textContent = buildActiveHint(filteredStateRegions.length);
  renderRegionList(filteredStrategicRegions, filteredStateRegions, filteredSeaRegions, filteredGeographicRegions);
  renderMap(regionMapStateRegions(filteredStateRegions, filteredSeaStateRegions, filteredGeographicRegions));
  focusStateRegionOnMap(selectedStateRegion);
}

function renderCompanyBoard() {
  const filtered = companies.filter(matchesCompanyFilters).sort(sortCompanies);
  if (state.selectedCompany && !byCompany.has(state.selectedCompany)) state.selectedCompany = "";
  if (!isDetailPageRoute() && state.selectedCompany && !filtered.some((company) => company.key === state.selectedCompany)) state.selectedCompany = "";
  const selectedCompany = byCompany.get(state.selectedCompany);
  mapRuntime.companyMapCompanies = selectedCompany ? [selectedCompany] : filtered;
  els.resultCount.textContent = `${filtered.length} 个公司`;
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
  const technologyGridRows = Math.max(1, ...Object.values(technologyPositions).map((position) => position.row));
  const technologyGridCellWidth = 83;
  const technologyGridCellHeight = 138;
  const technologyGridLeft = 76;
  const technologyGridTop = 38;
  const eraBaseRows = [0, 2, 4, 6, 8];
  const nodes = new Map();
  eras.forEach((era, eraIndex) => {
    const eraTechnologies = technologies.filter((item) => item.category === technologyGraphCategory && item.era === era)
      .sort((a, b) => a.name_zh.localeCompare(b.name_zh, "zh-Hans-CN"));
    eraTechnologies.forEach((technology, index) => {
      const position = technologyPositions?.[technology.key];
      if (!position) return;
      const column = position?.column || (index % technologyGridColumns) + 1;
      const row = position?.row || Math.min(technologyGridRows, eraBaseRows[eraIndex] + Math.floor(index / technologyGridColumns) + 1);
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
  return `<button class="technology-node" type="button" data-technology-key="${escapeHtml(node.technology.key)}" aria-pressed="${selected}" style="left:${node.x}px;top:${node.y}px"><img src="assets/technologies/${escapeHtml(iconFile)}" alt="" aria-hidden="true"><span>${escapeHtml(node.technology.name_zh)}</span></button>`;
}

function renderTechnologyBoard() {
  const layout = technologyGraphLayout();
  const selected = technologyByKey.get(state.selectedTechnology) || null;
  const normalizedSearch = state.technologySearch.trim().toLocaleLowerCase("zh-Hans-CN");
  const visibleNodes = [...layout.nodes.values()].filter((node) => !normalizedSearch || `${node.technology.name_zh} ${node.technology.key}`.toLocaleLowerCase("zh-Hans-CN").includes(normalizedSearch));
  const visibleNodeKeys = new Set(visibleNodes.map((node) => node.technology.key));
  const edges = technologyGraphEdges(layout).filter(({ from, to }) => visibleNodeKeys.has(from.technology.key) && visibleNodeKeys.has(to.technology.key));
  els.countryList.className = "country-list technology-board";
  els.resultCount.textContent = "";
  els.activeHint.textContent = "";
  const categoryLabels = { production: "生产", military: "军事", society: "社会" };
  els.countryList.innerHTML = `<section class="technology-shell"><div class="technology-controls"><select data-technology-category-select aria-label="科技类别">${Object.entries(categoryLabels).map(([key,label]) => `<option value="${key}" ${layout.technologyGraphCategory === key ? "selected" : ""}>${label}</option>`).join("")}</select><input type="search" data-technology-search aria-label="搜索科技" placeholder="搜索科技" value="${escapeHtml(state.technologySearch)}"><button class="map-tool-button" type="button" data-technology-reset aria-label="重置视图" title="重置视图"><img class="lucide-icon" src="assets/lucide/icons/refresh-ccw.svg" alt="" aria-hidden="true"></button></div><div class="technology-graph-viewport"><div class="technology-graph-canvas technology-grid-${layout.technologyGridColumns}x${layout.technologyGridRows}" style="width:${layout.width}px;height:${layout.height}px;transform:translate(${state.technologyViewport.x}px,${state.technologyViewport.y}px) scale(${state.technologyViewport.scale})"><svg class="technology-graph-edges" width="${layout.width}" height="${layout.height}" aria-hidden="true">${edges.map(({ from, to }) => { const highlighted = selected && (from.technology.key === selected.key || to.technology.key === selected.key); const stroke = highlighted ? "#c8a45b" : "#b7a883"; const strokeWidth = highlighted ? 5 : 3; const path = technologyEdgePath(from, to); return `<path d="${path}" fill="none" class="${highlighted ? "is-highlighted" : ""}" style="fill:none !important;stroke:${stroke} !important;stroke-width:${strokeWidth} !important"/>`; }).join("")}</svg>${visibleNodes.map(technologyNodeHtml).join("")}</div></div><div class="technology-mobile-list">${technologyEras.map((era) => `<details open><summary>${era.label_zh}</summary>${visibleNodes.filter((node) => node.technology.era === era.key).map(technologyNodeHtml).join("")}</details>`).join("")}</div><div class="technology-local-graph">${selected ? `已选：${escapeHtml(selected.name_zh)}　前置 ${selected.prerequisites.length}　后续 ${selected.unlocks.length}` : "选择科技查看局部关系"}</div></section>`;
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
  const relation = (items, label) => `<section><h3>${label}</h3><div class="technology-relation-tags">${items.length ? items.map((item) => `<button class="pill tag-technology" type="button" data-technology-target="${escapeHtml(item.key)}">${escapeHtml(item.name_zh)}</button>`).join("") : "无"}</div></section>`;
  const refs = technology.references || { laws: [], companies: [] };
  const linkItems = (items, route) => items.length ? items.map((item) => `<a class="pill" href="#/${route}/${encodeURIComponent(item.key)}">${escapeHtml(item.name_zh)}</a>`).join("") : "无";
  queueMicrotask(() => {
    document.querySelectorAll("[data-technology-target]").forEach((button) => button.addEventListener("click", () => { location.hash = `/technology/${encodeURIComponent(button.dataset.technologyTarget)}`; }));
    document.querySelector("[data-technology-back]")?.addEventListener("click", () => { location.hash = "/technology"; });
  });
  return `<section class="technology-detail"><div class="detail-title"><button class="detail-back-button" type="button" data-technology-back aria-label="返回科技树" title="返回科技树"><img class="lucide-icon" src="assets/lucide/icons/arrow-left.svg" alt="" aria-hidden="true"></button><div class="detail-title-main"><h2>${escapeHtml(technology.name_zh)}</h2></div></div><p>${escapeHtml(technology.category_zh)} · ${escapeHtml(technology.era_label_zh)} · ${escapeHtml(String(technology.era_cost))} 创新力</p><p>${escapeHtml(technology.desc_zh || "无说明")}</p>${relation(technology.prerequisites.map((key) => technologyByKey.get(key)).filter(Boolean), "前置科技")}${relation(technology.unlocks, "后续科技")}<section><h3>修正效果</h3>${technology.modifiers.length ? technology.modifiers.map((item) => `<p>${escapeHtml(item.summary_zh)}</p>`).join("") : "无"}</section><section><h3>关联法律</h3>${linkItems(refs.laws, "law")}</section><section><h3>关联公司</h3>${linkItems(refs.companies, "company")}</section></section>`;
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
  els.resultCount.textContent = `${results.length} 个全局结果`;
  els.activeHint.textContent = state.globalSearch ? `搜索：${state.globalSearch}` : "";
  renderGlobalSearchList(results);
  renderGlobalSearchDetail(results.find((item) => item.id === state.selectedGlobalResult) || null);
}

function renderGlobalSearchList(results) {
  els.countryList.className = "country-list global-search-list";
  if (!results.length) {
    els.countryList.innerHTML = `<p class="empty">没有匹配结果。</p>`;
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
    els.globalSearchDialogResults.innerHTML = `<p class="empty">输入文本后显示相关资料。</p>`;
    return;
  }
  if (!results.length) {
    els.globalSearchDialogResults.innerHTML = `<p class="empty">没有匹配结果。</p>`;
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
  else return;
  await applyHash();
  render();
}

function renderGlobalSearchDetail(result) {
  if (!result) {
    els.detail.innerHTML = `<p class="empty">没有匹配结果。</p>`;
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
  const results = [];
  const add = (result) => {
    const haystack = normalizeSearchText([result.title, result.key, result.aliases, result.subtitle, result.searchText].flat().filter(Boolean).join(" "));
    if (!haystack.includes(needle)) return;
    const title = normalizeSearchText(result.title || "");
    const key = normalizeSearchText(result.key || "");
    const score = title === needle ? 0 : key === needle ? 1 : title.startsWith(needle) ? 2 : haystack.indexOf(needle) + 10;
    results.push({ ...result, displayTitle: globalSearchDisplayTitle(result, needle), score });
  };
  countries.forEach((country) => add({
    id: `country:${country.tag}`,
    kind: "country",
    typeLabel: "国家",
    key: country.tag,
    title: country.name,
    subtitle: [countryTypeTagLabel(country), country.tierZh].filter(Boolean).join("，"),
    color: country.colorHex,
    raw: country,
    searchText: countrySearchBlob(country),
  }));
  cultures.forEach((culture) => add({
    id: `culture:${culture.key}`,
    kind: "culture",
    typeLabel: "文化",
    key: culture.key,
    title: culture.name_zh || culture.key,
    subtitle: [culture.heritage?.name_zh, culture.language?.name_zh].filter(Boolean).join("，"),
    raw: culture,
    searchText: cultureSearchBlob(culture),
  }));
  landStateRegions.forEach((stateRegion) => add({
    id: `stateRegion:${stateRegion.key}`,
    kind: "stateRegion",
    typeLabel: "地区",
    key: stateRegion.key,
    title: stateRegion.name_zh || stateRegion.key,
    aliases: stateRegionVariantNames(stateRegion),
    subtitle: refNames(stateRegion.strategic_regions),
    color: byStrategicRegion.get(stateRegion.strategic_regions?.[0]?.key)?.map_color?.hex || "",
    raw: stateRegion,
    searchText: stateRegionSearchBlob(stateRegion),
  }));
  landStrategicRegions.forEach((region) => add({
    id: `strategicRegion:${region.key}`,
    kind: "strategicRegion",
    typeLabel: "战略区域",
    key: region.key,
    title: strategicRegionName(region),
    subtitle: `州地区 ${(region.states || []).length} 个`,
    color: region.map_color?.hex || "",
    raw: region,
    searchText: strategicRegionSearchBlob(region),
  }));
  groupedGeographicRegions.forEach((region) => add({
    id: `geographicRegion:${region.key}`,
    kind: "geographicRegion",
    typeLabel: "地理区域",
    key: region.key,
    title: geographicRegionDisplayName(region),
    subtitle: `州地区 ${geographicRegionStateRegions(region).length} 个`,
    raw: region,
    searchText: geographicRegionSearchBlob(region),
  }));
  companies.forEach((company) => add({
    id: `company:${company.key}`,
    kind: "company",
    typeLabel: "公司",
    key: company.key,
    title: company.name_zh || company.key,
    subtitle: companyKindText(company),
    raw: company,
    searchText: companySearchBlob(company),
  }));
  ideologies.forEach((ideology) => add({
    id: `ideology:${ideology.key}`,
    kind: "ideology",
    typeLabel: "意识形态",
    key: ideology.key,
    title: ideology.name_zh || ideology.key,
    subtitle: ideologyTypeLabels.get(ideologyTypeKey(ideology)) || "",
    raw: ideology,
    searchText: ideologySearchBlob(ideology),
  }));
  laws.forEach((law) => add({
    id: `law:${law.key}`,
    kind: "law",
    typeLabel: "法律",
    key: law.key,
    title: law.name_zh || law.key,
    subtitle: law.group_name_zh || law.group_key || "",
    raw: law,
    searchText: lawSearchBlob(law),
  }));
  technologies.forEach((technology) => add({
    id: `technology:${technology.key}`,
    kind: "technology",
    typeLabel: "科技",
    key: technology.key,
    title: technology.name_zh || technology.key,
    subtitle: [technology.category_zh, technology.era_label_zh].filter(Boolean).join("，"),
    raw: technology,
    searchText: [technology.name_zh, technology.key, technology.desc_zh, technology.category_zh, technology.era_label_zh].filter(Boolean).join(" "),
  }));
  cultureTraits.forEach((trait) => add({
    id: `cultureTrait:${trait.key}`,
    kind: "cultureTrait",
    typeLabel: trait.type_zh || "文化特质",
    key: trait.key,
    title: trait.name_zh || trait.key,
    subtitle: trait.group_name_zh || trait.type_zh || "",
    searchText: [trait.name_zh, trait.key, trait.group_name_zh, trait.type_zh].filter(Boolean).join(" "),
  }));
  cultureTraitGroups.forEach((group) => add({
    id: `cultureTraitGroup:${group.key}`,
    kind: "cultureTraitGroup",
    typeLabel: group.type === "language" ? "语族" : group.type_zh ? `${group.type_zh}组` : "文化特质组",
    key: group.key,
    title: group.name_zh || group.key,
    subtitle: group.type_zh || "",
    searchText: [group.name_zh, group.key, group.type_zh].filter(Boolean).join(" "),
  }));
  interestGroups.forEach((group) => add({
    id: `interestGroup:${group.key}`,
    kind: "interestGroup",
    typeLabel: "利益集团",
    key: group.key,
    title: group.name_zh || group.key,
    subtitle: group.desc_zh || "",
    color: group.color?.hex || "",
    searchText: [group.name_zh, group.key, group.desc_zh].filter(Boolean).join(" "),
  }));
  interestGroupTraits.forEach((trait) => add({
    id: `interestGroupTrait:${trait.key}`,
    kind: "interestGroupTrait",
    typeLabel: "利益集团特质",
    key: trait.key,
    title: trait.name_zh || trait.key,
    subtitle: trait.modifier_summary_zh || "",
    searchText: [trait.name_zh, trait.key, trait.desc_zh, trait.modifier_summary_zh].filter(Boolean).join(" "),
  }));
  interestGroupFlavorSearchResults().forEach(add);
  const order = new Map(["国家", "文化", "地区", "地理区域", "语言", "语族", "传承", "传承组", "传统", "战略区域", "公司", "意识形态", "法律", "科技", "利益集团", "利益集团特质", "利益集团风味"].map((label, index) => [label, index]));
  return results
    .sort((a, b) => a.score - b.score || orderValue(order, a.typeLabel) - orderValue(order, b.typeLabel) || a.title.localeCompare(b.title, "zh-Hans-CN"))
    .slice(0, 120);
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
