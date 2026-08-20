const NAME_POOL_FIELDS = [
  ["male_common_first_names", "board.namePool.maleCommonFirst"],
  ["female_common_first_names", "board.namePool.femaleCommonFirst"],
  ["male_noble_first_names", "board.namePool.maleNobleFirst"],
  ["female_noble_first_names", "board.namePool.femaleNobleFirst"],
  ["male_regal_first_names", "board.namePool.maleRegalFirst"],
  ["female_regal_first_names", "board.namePool.femaleRegalFirst"],
  ["common_last_names", "board.namePool.commonLast"],
  ["noble_last_names", "board.namePool.nobleLast"],
  ["regal_last_names", "board.namePool.regalLast"],
];

function namePoolCultureName(pool) {
  if (!pool) return "";
  return localeRuntime.current === "en"
    ? (pool.name_en || pool.name_zh || pool.key)
    : (pool.name_zh || pool.name_en || pool.key);
}

function namePoolSearchBlob(pool) {
  return [pool.key, pool.name_zh, pool.name_en, pool.religion_key, pool.heritage_key, pool.language_key]
    .filter(Boolean).join(" ").toLocaleLowerCase();
}

function renderNamePoolBoard() {
  const filtered = namePools.filter((pool) => !state.search || namePoolSearchBlob(pool).includes(state.search)).sort((left, right) => {
    if (state.sort === "name") return localizedCompare(namePoolCultureName(left), namePoolCultureName(right)) || left.key.localeCompare(right.key);
    if (state.sort === "count") return Number(right.name_entry_count || 0) - Number(left.name_entry_count || 0) || left.key.localeCompare(right.key);
    return left.key.localeCompare(right.key);
  });
  if (state.selectedNamePool && !byNamePool.has(state.selectedNamePool)) state.selectedNamePool = "";
  els.resultCount.textContent = t("board.namePool.resultCount", { count: localizedNumber(filtered.length) });
  els.activeHint.textContent = state.search ? t("search.activeQuery", { query: state.search }) : "";
  els.countryList.className = "country-list name-pool-list";
  els.countryList.innerHTML = filtered.length ? filtered.map(namePoolListRow).join("") : `<p class="empty">${escapeHtml(t("search.noResults"))}</p>`;
  bindNamePoolListEvents();
  els.detail.innerHTML = isDetailPageRoute() ? renderNamePoolDetail(byNamePool.get(state.selectedNamePool)) : "";
}

function namePoolListRow(pool) {
  const culture = byCulture.get(pool.key);
  return `<button class="country-row name-pool-row" type="button" data-name-pool-key="${escapeHtml(pool.key)}" aria-current="${state.selectedNamePool === pool.key}">
    <span class="country-heading"><span class="name">${escapeHtml(namePoolCultureName(pool))}</span></span>
    <span class="minor country-meta">${escapeHtml(pool.key)} · ${escapeHtml(t("board.namePool.entryCount", { count: localizedNumber(pool.name_entry_count || 0) }))}</span>
    <span class="minor country-meta">${escapeHtml(culture ? [pool.heritage_key, pool.language_key].filter(Boolean).join(" · ") : t("board.namePool.sourceUnknown"))}</span>
  </button>`;
}

function bindNamePoolListEvents() {
  els.countryList.querySelectorAll("[data-name-pool-key]").forEach((button) => {
    button.addEventListener("click", () => {
      replaceHash(`/name-pool/${encodeURIComponent(button.dataset.namePoolKey)}`);
      void applyHash().then(render);
    });
  });
}

function renderNamePoolDetail(pool) {
  if (!pool) return `<p class="empty">${escapeHtml(t("search.noResults"))}</p>`;
  const culture = byCulture.get(pool.key);
  const sections = NAME_POOL_FIELDS.map(([key, labelKey]) => {
    const group = pool.name_pools?.[key] || { count: 0, entries: [] };
    const entries = (group.entries || []).map((entry) => `<span class="name-pool-entry"><span>${escapeHtml(localeRuntime.current === "en" ? (entry.name_en || entry.name_zh || entry.key) : (entry.name_zh || entry.name_en || entry.key))}</span><code>${escapeHtml(entry.key)}</code></span>`).join("");
    return `<section class="name-pool-group"><div class="name-pool-group-head"><h3>${escapeHtml(t(labelKey))}</h3><span class="tag">${localizedNumber(group.count || 0)}</span></div>${entries ? `<div class="name-pool-entries">${entries}</div>` : `<p class="empty">${escapeHtml(t("ui.none"))}</p>`}</section>`;
  }).join("");
  return `<article class="name-pool-detail">
    <div class="detail-title"><button class="detail-back-button" type="button" data-detail-back="name-pool" aria-label="${escapeHtml(t("ui.back"))}" title="${escapeHtml(t("ui.back"))}"><img class="lucide-icon" src="assets/lucide/icons/arrow-left.svg" alt="" aria-hidden="true"></button><div class="detail-title-main"><h2>${escapeHtml(namePoolCultureName(pool))}</h2><p class="minor">${escapeHtml(pool.key)}</p></div></div>
    <dl class="field-grid">
      ${field(t("board.namePool.field.culture"), culture ? `<a class="pill" href="#/culture/${encodeURIComponent(culture.key)}">${escapeHtml(entityText(culture))}</a>` : escapeHtml(pool.key))}
      ${field(t("board.namePool.field.religion"), escapeHtml(pool.religion_key || t("ui.none")))}
      ${field(t("board.namePool.field.heritage"), escapeHtml(pool.heritage_key || t("ui.none")))}
      ${field(t("board.namePool.field.language"), escapeHtml(pool.language_key || t("ui.none")))}
      ${field(t("board.namePool.field.total"), escapeHtml(localizedNumber(pool.name_entry_count || 0)))}
    </dl>
    ${sections}
    <p class="minor name-pool-source">${escapeHtml(pool.source_file || t("ui.none"))}</p>
  </article>`;
}
