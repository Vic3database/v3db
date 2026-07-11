let changelogData = window.VIC3_CHANGELOG_DATA || {
  baseVersion: "",
  targetVersion: "",
  boards: [],
  changes: [],
};

const changelogConfig = window.VIC3_VERSION_CONFIG || null;

const changelogState = {
  board: "all",
  search: "",
  pair: "",
};

const changelogEls = {
  title: document.querySelector("#changelogTitle"),
  meta: document.querySelector("#changelogMeta"),
  pair: document.querySelector("#changelogPairSelect"),
  search: document.querySelector("#changelogSearch"),
  filters: document.querySelector("#changelogBoardFilters"),
  stats: document.querySelector("#changelogStats"),
  list: document.querySelector("#changelogList"),
};

let boardOrder = ["all", ...changelogData.boards.map((board) => board.key)];

initChangelog();

async function initChangelog() {
  bindChangelogEvents();
  renderChangelogPairs();
  await loadInitialChangelog();
}

function bindChangelogEvents() {
  changelogEls.search?.addEventListener("input", () => {
    changelogState.search = changelogEls.search.value.trim().toLowerCase();
    renderChangelogList();
  });

  changelogEls.pair?.addEventListener("change", async () => {
    await loadChangelogPair(changelogEls.pair.value, { replaceUrl: true });
  });

  changelogEls.filters?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-board-filter]");
    if (!button || !changelogEls.filters.contains(button)) return;
    changelogState.board = button.dataset.boardFilter || "all";
    renderChangelogFilters();
    renderChangelogList();
  });
}

async function loadInitialChangelog() {
  const pair = selectedPairFromLocation() || changelogPairs()[0]?.id || "";
  if (pair) {
    await loadChangelogPair(pair, { replaceUrl: false });
    return;
  }
  renderChangelog();
}

function selectedPairFromLocation() {
  const params = new URLSearchParams(window.location.search);
  return params.get("pair") || "";
}

function renderChangelogPairs() {
  if (!changelogEls.pair) return;
  const pairs = changelogPairs();
  changelogEls.pair.innerHTML = pairs.map((pair) => (
    `<option value="${escapeAttribute(pair.id)}">${escapeHtml(pair.label)}</option>`
  )).join("");
}

function changelogPairs() {
  return (changelogConfig?.changelogs || []).map((pair) => ({
    ...pair,
    id: pair.id || `${pair.base_version}_to_${pair.target_version}`,
  }));
}

async function loadChangelogPair(pairId, options = {}) {
  const pair = changelogPairs().find((item) => item.id === pairId) || changelogPairs()[0];
  if (!pair) {
    renderChangelog();
    return;
  }
  changelogState.pair = pair.id;
  changelogState.board = "all";
  changelogState.search = "";
  if (changelogEls.search) changelogEls.search.value = "";
  if (changelogEls.pair) changelogEls.pair.value = pair.id;
  changelogData = await loadScriptValue(pair.data, "VIC3_CHANGELOG_DATA");
  boardOrder = ["all", ...changelogData.boards.map((board) => board.key)];
  if (options.replaceUrl) {
    const params = new URLSearchParams(window.location.search);
    params.set("pair", pair.id);
    history.replaceState(null, "", `?${params.toString()}`);
  }
  renderChangelog();
}

function loadScriptValue(src, globalName) {
  return new Promise((resolve, reject) => {
    window[globalName] = undefined;
    const script = document.createElement("script");
    script.src = `${src}${src.includes("?") ? "&" : "?"}v=${Date.now()}`;
    script.async = true;
    script.onload = () => {
      const value = window[globalName];
      script.remove();
      resolve(value || { baseVersion: "", targetVersion: "", boards: [], changes: [] });
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(`无法加载 ${src}`));
    };
    document.head.appendChild(script);
  });
}

function renderChangelog() {
  if (changelogEls.title) {
    changelogEls.title.textContent = `${changelogData.targetVersion} 相对 ${changelogData.baseVersion}`;
  }
  if (changelogEls.meta) {
    changelogEls.meta.textContent = `完整记录 ${changelogData.changes.length} 条对象变化。`;
  }
  renderChangelogFilters();
  renderChangelogList();
}

function renderChangelogFilters() {
  if (!changelogEls.filters) return;
  const counts = boardCounts();
  changelogEls.filters.innerHTML = boardOrder.map((boardKey) => {
    const label = boardKey === "all"
      ? "全部"
      : changelogData.boards.find((board) => board.key === boardKey)?.label || boardKey;
    const count = boardKey === "all" ? changelogData.changes.length : counts.get(boardKey) || 0;
    const pressed = changelogState.board === boardKey;
    return `<button class="filter-token" type="button" data-board-filter="${escapeHtml(boardKey)}" aria-pressed="${pressed}">${escapeHtml(label)} ${count}</button>`;
  }).join("");
}

function renderChangelogList() {
  if (!changelogEls.list || !changelogEls.stats) return;
  const visible = filteredChanges();
  const duplicateState = duplicateStateByDiff(visible);
  const diffCount = visible.reduce((sum, change) => sum + change.diffs.length, 0);
  const repeatedCount = [...duplicateState.values()].filter((state) => state.repeated).length;
  const repeatedText = repeatedCount ? `，${repeatedCount} 个为同类后续表现` : "";
  changelogEls.stats.textContent = `显示 ${visible.length} 条对象变化，${diffCount} 个字段差异${repeatedText}。`;
  if (!visible.length) {
    changelogEls.list.innerHTML = `<p class="empty">没有匹配的变化。</p>`;
    return;
  }
  changelogEls.list.innerHTML = visible.map((change) => changeHtml(change, duplicateState)).join("");
}

function filteredChanges() {
  const search = changelogState.search;
  return changelogData.changes.filter((change) => {
    if (changelogState.board !== "all" && change.board !== changelogState.board) return false;
    if (!search) return true;
    return changeSearchBlob(change).includes(search);
  });
}

function boardCounts() {
  const counts = new Map();
  for (const change of changelogData.changes) {
    counts.set(change.board, (counts.get(change.board) || 0) + 1);
  }
  return counts;
}

function duplicateStateByDiff(changes) {
  const seen = new Map();
  const states = new Map();
  for (const change of changes) {
    change.diffs.forEach((diff, index) => {
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
          <a class="topbar-link" href="${escapeAttribute(change.baseUrl)}">查看 ${escapeHtml(changelogData.baseVersion)}</a>
          <a class="topbar-link" href="${escapeAttribute(change.targetUrl)}">查看 ${escapeHtml(changelogData.targetVersion)}</a>
        </div>
      </div>
      <div class="change-diffs">
        ${change.diffs.map((diff, index) => diffHtml(change, diff, index, duplicateState)).join("")}
      </div>
    </article>
  `;
}

function diffHtml(change, diff, index, duplicateState) {
  const kindLabel = diff.kind === "raw" ? "源代码" : "抽取字段";
  const state = duplicateState.get(diffStateKey(change, index)) || { current: 1, total: 1, repeated: false };
  const duplicateClass = state.repeated ? " is-duplicate" : "";
  const duplicateLabel = state.total > 1
    ? `<span class="change-duplicate-badge">同类 ${state.current}/${state.total}</span>`
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
      <div class="source-compare" aria-label="源码变化 ${index + 1}">
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

function changeSearchBlob(change) {
  return [
    change.boardLabel,
    change.key,
    change.title,
    change.sourceFile,
    ...change.diffs.flatMap((diff) => [diff.path, diff.label, diff.oldText, diff.newText]),
  ].join("\n").toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
