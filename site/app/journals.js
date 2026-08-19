function journalBoardAvailable() {
  return Boolean(dataIndex?.chunks?.content || journalEntries.length);
}

function journalId(row) { return row?.id || row?.script_key || ""; }
function journalText(row, field, fallback = "") {
  const locale = localeRuntime.current === "zh-Hans" ? "zhHans" : localeRuntime.current;
  return row?.locales?.[locale]?.[field] || row?.locales?.en?.[field] || fallback;
}
function journalSourceLabel(source) { return t(`board.content.source.${source}`, source); }
function journalGroup(row) { return row?.group || "ungrouped"; }
function journalGroupName(group) {
  const row = journalEntryGroups.find((item) => item.id === group);
  return journalText(row, "name", group);
}
function journalChangeBadge(row) {
  return row.vc_change_kind === "added" ? `<span class="event-marker vc-change-added">${escapeHtml(t("board.vcChange.added"))}</span>`
    : row.vc_change_kind === "adjusted" ? `<span class="event-marker vc-change-adjusted">${escapeHtml(t("board.vcChange.adjusted"))}</span>` : "";
}
function journalSources(row) {
  return `<span class="content-source-list">${(row.sources || []).map((source) => `<span class="content-source content-source-${escapeHtml(source)}">${escapeHtml(journalSourceLabel(source))}</span>`).join("")}</span>`;
}
function journalSearchText(row) {
  return [journalId(row), journalGroup(row), journalGroupName(journalGroup(row)), journalText(row, "name"), journalText(row, "reason"), row.raw, row.is_shown_when_inactive_raw, row.possible_raw, row.complete_raw, row.fail_raw].filter(Boolean).join(" ").toLowerCase();
}
function journalVisible(row) {
  return (!state.search || journalSearchText(row).includes(state.search))
    && (!state.journalSourceKinds.size || [...state.journalSourceKinds].some((source) => (row.sources || []).includes(source)))
    && (!state.journalChangeKinds.size || state.journalChangeKinds.has(row.vc_change_kind || "none"));
}
function journalSort(left, right) {
  return journalGroupName(journalGroup(left)).localeCompare(journalGroupName(journalGroup(right)), undefined, { numeric: true }) || journalId(left).localeCompare(journalId(right), undefined, { numeric: true });
}
function journalCardHtml(row) {
  const id = journalId(row);
  return `<button class="content-card journal-card" type="button" data-journal-id="${escapeHtml(id)}" data-journal-group="${escapeHtml(journalGroup(row))}" aria-pressed="${String(state.selectedJournal === id)}"><span class="content-card-copy"><strong>${readableContentHtml(journalText(row, "name", id))}</strong><small><code>${escapeHtml(id)}</code> · ${readableContentHtml(journalGroupName(journalGroup(row)))}</small>${journalChangeBadge(row)}${journalSources(row)}</span></button>`;
}
function journalSectionHtml(group, rows) {
  return `<section class="event-group journal-group" id="journal-group-${escapeHtml(group)}"><h3 class="event-group-title"><span>${escapeHtml(journalGroupName(group))}</span><code>${escapeHtml(group)}</code><small>${localizedNumber(rows.length)}</small></h3>${rows.map(journalCardHtml).join("")}</section>`;
}
function journalConditionSection(label, raw) {
  return raw ? `<section><h3>${escapeHtml(t(label))}</h3><pre>${escapeHtml(raw)}</pre></section>` : "";
}
function journalDetailHtml(row) {
  const id = journalId(row);
  const effects = [["board.journal.completeEffect", row.on_complete_raw], ["board.journal.failEffect", row.on_fail_raw], ["board.journal.timeoutEffect", row.on_timeout_raw]].filter(([, raw]) => raw);
  return `<article class="content-detail journal-detail"><header><p>${escapeHtml(t("board.journal.kind"))}</p><h2>${readableContentHtml(journalText(row, "name", id))}</h2><code>${escapeHtml(id)}</code></header><div class="content-meta"><span>${readableContentHtml(journalGroupName(journalGroup(row)))}</span>${journalChangeBadge(row)}${journalSources(row)}</div>${relatedCountriesHtml(row)}${journalText(row, "reason") ? `<section><h3>${escapeHtml(t("board.journal.reason"))}</h3><p>${readableContentHtml(journalText(row, "reason"))}</p></section>` : ""}${journalConditionSection("board.journal.shownWhenInactive", row.is_shown_when_inactive_raw)}${journalConditionSection("board.journal.possible", row.possible_raw)}${journalConditionSection("board.journal.complete", row.complete_raw)}${journalConditionSection("board.journal.fail", row.fail_raw)}${effects.length ? `<section><h3>${escapeHtml(t("board.journal.effects"))}</h3>${effects.map(([label, raw]) => journalConditionSection(label, raw)).join("")}</section>` : ""}${row.triggered_event_ids?.length ? `<section><h3>${escapeHtml(t("board.journal.triggeredEvents"))}</h3><div class="event-event-ids">${row.triggered_event_ids.map((eventId) => `<code>${escapeHtml(eventId)}</code>`).join("")}</div></section>` : ""}<section><h3>${escapeHtml(t("board.content.source"))}</h3><code>${escapeHtml(row.source_file || "")}:${escapeHtml(row.source_line || "")}</code></section><section><h3>${escapeHtml(t("board.content.raw"))}</h3><details open><summary>${escapeHtml(t("board.content.script"))}</summary><pre>${escapeHtml(row.raw || "")}</pre></details></section><button type="button" data-journal-back>${escapeHtml(t("board.content.back"))}</button></article>`;
}
function renderJournalFilterOptions() {
  if (!els.journalSourceFilters || !els.journalChangeFilters) return;
  els.journalSourceFilters.innerHTML = ["vanilla", "vc"].map((source) => `<button class="filter-token" type="button" data-journal-source-filter="${source}" aria-pressed="${state.journalSourceKinds.has(source)}">${escapeHtml(journalSourceLabel(source))}</button>`).join("");
  els.journalChangeFilters.innerHTML = [["added", "board.vcChange.added"], ["adjusted", "board.vcChange.adjusted"]].map(([kind, label]) => `<button class="filter-token" type="button" data-journal-change-filter="${kind}" aria-pressed="${state.journalChangeKinds.has(kind)}">${escapeHtml(t(label))}</button>`).join("");
  if (els.journalFilters.dataset.bound === "true") return;
  els.journalFilters.dataset.bound = "true";
  els.journalSourceFilters.addEventListener("click", (event) => { const button = event.target.closest("[data-journal-source-filter]"); if (!button) return; const source = button.dataset.journalSourceFilter; state.journalSourceKinds.has(source) ? state.journalSourceKinds.delete(source) : state.journalSourceKinds.add(source); render(); });
  els.journalChangeFilters.addEventListener("click", (event) => { const button = event.target.closest("[data-journal-change-filter]"); if (!button) return; const kind = button.dataset.journalChangeFilter; state.journalChangeKinds.has(kind) ? state.journalChangeKinds.delete(kind) : state.journalChangeKinds.add(kind); render(); });
  els.journalSearchInput?.addEventListener("input", () => { state.search = els.journalSearchInput.value.trim().toLowerCase(); render(); });
  els.journalResetButton?.addEventListener("click", () => { state.search = ""; state.journalSourceKinds.clear(); state.journalChangeKinds.clear(); state.selectedJournal = ""; replaceHash("/journal"); render(); });
}
function renderJournalBoard() {
  const visible = journalEntries.filter(journalVisible).sort(journalSort);
  const groups = [...new Set(visible.map(journalGroup))].map((group) => [group, visible.filter((row) => journalGroup(row) === group)]);
  const selected = journalEntries.find((row) => journalId(row) === state.selectedJournal) || null;
  renderJournalFilterOptions();
  if (els.journalSearchInput && els.journalSearchInput.value !== state.search) els.journalSearchInput.value = state.search;
  els.resultCount.textContent = t("board.journal.resultCount", { count: localizedNumber(visible.length) });
  els.activeHint.textContent = "";
  els.journalGroupNav.innerHTML = groups.map(([group, rows]) => `<button type="button" class="event-group-nav-item" data-journal-group-target="${escapeHtml(group)}"><span>${escapeHtml(journalGroupName(group))}</span><code>${escapeHtml(group)}</code><small>${localizedNumber(rows.length)}</small></button>`).join("") || `<p class="event-group-nav-empty">${escapeHtml(t("board.journal.empty"))}</p>`;
  els.journalGroupNav.querySelectorAll("[data-journal-group-target]").forEach((button) => button.addEventListener("click", () => document.querySelector(`#journal-group-${CSS.escape(button.dataset.journalGroupTarget)}`)?.scrollIntoView({ behavior: "smooth", block: "start" })));
  els.countryList.className = "country-list event-list content-list";
  els.countryList.innerHTML = groups.map(([group, rows]) => journalSectionHtml(group, rows)).join("") || `<p class="event-empty">${escapeHtml(t("board.journal.empty"))}</p>`;
  els.countryList.querySelectorAll("[data-journal-id]").forEach((card) => card.addEventListener("click", () => { state.selectedJournal = card.dataset.journalId; replaceHash(`/journal/${encodeURIComponent(state.selectedJournal)}`); render(); }));
  els.detail.innerHTML = selected ? journalDetailHtml(selected) : `<section class="event-detail-empty"><h2>${escapeHtml(t("board.journal.selectTitle"))}</h2><p>${escapeHtml(t("board.journal.selectDescription"))}</p></section>`;
  els.detail.querySelector("[data-journal-back]")?.addEventListener("click", () => { state.selectedJournal = ""; replaceHash("/journal"); render(); });
}
