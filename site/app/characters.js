const CHARACTER_SOURCE_OPTIONS = [
  ["starting", "board.character.filter.starting"],
  ["with-dna", "board.character.filter.withDna"],
  ["without-dna", "board.character.filter.withoutDna"],
];
const CHARACTER_GENDER_OPTIONS = [
  ["female", "enum.gender.female"],
  ["male", "enum.gender.male"],
];
const CHARACTER_PAGE_SIZE = 100;
let characterBoardEventsBound = false;

function resetCharacterPage() {
  state.characterPage = 1;
}

function historicalCharacterName(character) {
  if (!character) return "";
  return localeRuntime.current === "en"
    ? (character.name_en || character.name_zh || character.key)
    : (character.name_zh || character.name_en || character.key);
}

function characterCultureKey(character) {
  const key = String(character?.culture_key || "");
  return key.startsWith("cu:") ? key.slice(3) : key === "primary_culture" ? "" : key;
}

function historicalCharacterCulture(character) {
  return byCulture.get(characterCultureKey(character)) || null;
}

function characterReferenceLabel(key, index, fallback = "") {
  const item = index?.get(key);
  return item ? entityText(item) : (fallback || String(key || "").replace(/^(?:ig_|ideology_|rel:|religion:)/, "").replaceAll("_", " "));
}

function historicalCharacterTraitLabel(key) {
  const normalized = String(key || "");
  const messageId = `character_trait:${normalized}.name`;
  const message = translateMessage(messageId, "");
  return message && message !== messageId
    ? message
    : normalized.replace(/^trait_/, "").replaceAll("_", " ");
}

function historicalCharacterImageTypeLabel(type) {
  const normalized = String(type || "");
  return translateMessage(`board.character.imageType.${normalized}`, normalized);
}

function renderHistoricalCharacterImage(record, character) {
  const image = record?.image;
  if (!image?.thumbnail_url || !image?.file_page) return "";
  const metadata = [
    [t("board.character.image.type"), historicalCharacterImageTypeLabel(image.type), ""],
    image.artist ? [t("board.character.image.artist"), image.artist, ""] : null,
    image.date ? [t("board.character.image.date"), image.date, ""] : null,
    image.license ? [t("board.character.image.license"), image.license, image.license_url] : null,
  ].filter(Boolean).map(([label, value, href]) => `<span><b>${escapeHtml(label)}</b>${href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(value)}</a>` : escapeHtml(value)}</span>`).join("");
  const alt = t("board.character.image.alt", { name: historicalCharacterName(character) });
  return `<figure class="character-historical-image">
    <a class="character-historical-image-frame" href="${escapeHtml(image.file_page)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(image.thumbnail_url)}" alt="${escapeHtml(alt)}" loading="eager" decoding="async"></a>
    <figcaption>
      <a class="character-historical-image-source" href="${escapeHtml(image.file_page)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(image.file_title || "")}">${escapeHtml(t("board.character.image.source"))}</a>
      <span class="character-historical-image-meta">${metadata}</span>
    </figcaption>
  </figure>`;
}

function historicalCharacterSearchBlob(character) {
  const culture = historicalCharacterCulture(character);
  return [
    character.key,
    character.name_zh,
    character.name_en,
    character.first_name_key,
    character.last_name_key,
    character.character_role,
    character.character_role_name_zh,
    character.character_role_name_en,
    ...(character.role_flags || []),
    character.birth_date,
    character.religion_key,
    character.interest_group_key,
    character.ideology_key,
    character.home_region_key,
    ...(character.traits || []),
    culture?.key,
    culture?.name_zh,
    culture?.name_en,
  ].filter(Boolean).join(" ").toLocaleLowerCase();
}

function matchesHistoricalCharacterFilters(character) {
  if (state.characterSources.size > 0) {
    const sourceMatch = (state.characterSources.has("starting") && character.in_starting_history)
      || (state.characterSources.has("with-dna") && character.has_dna)
      || (state.characterSources.has("without-dna") && !character.has_dna);
    if (!sourceMatch) return false;
  }
  if (state.characterGenders.size > 0) {
    const gender = character.female ? "female" : "male";
    if (!state.characterGenders.has(gender)) return false;
  }
  return !state.search || historicalCharacterSearchBlob(character).includes(state.search);
}

function renderCharacterFilterOptions() {
  if (!els.characterSourceFilters || !els.characterGenderFilters) return;
  els.characterSourceFilters.innerHTML = CHARACTER_SOURCE_OPTIONS.map(([key, message]) => (
    `<button class="filter-token" type="button" data-character-source="${key}" aria-pressed="${state.characterSources.has(key)}">${escapeHtml(t(message))}</button>`
  )).join("");
  els.characterGenderFilters.innerHTML = CHARACTER_GENDER_OPTIONS.map(([key, message]) => (
    `<button class="filter-token" type="button" data-character-gender="${key}" aria-pressed="${state.characterGenders.has(key)}">${escapeHtml(t(message))}</button>`
  )).join("");
}

function bindCharacterBoardEvents() {
  if (characterBoardEventsBound) return;
  characterBoardEventsBound = true;
  els.characterSourceFilters?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-character-source]");
    if (!button) return;
    toggleSetValue(state.characterSources, button.dataset.characterSource);
    resetCharacterPage();
    render();
  });
  els.characterGenderFilters?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-character-gender]");
    if (!button) return;
    toggleSetValue(state.characterGenders, button.dataset.characterGender);
    resetCharacterPage();
    render();
  });
  els.countryList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-character-page]");
    if (!button || !els.countryList.contains(button) || button.disabled) return;
    const totalPages = Math.ceil(historicalCharacterListLength() / CHARACTER_PAGE_SIZE);
    const requested = button.dataset.characterPage === "previous"
      ? state.characterPage - 1
      : button.dataset.characterPage === "next"
        ? state.characterPage + 1
        : Number(button.dataset.characterPage);
    state.characterPage = Math.max(1, Math.min(totalPages || 1, requested));
    render();
  });
}

function toggleSetValue(set, value) {
  if (set.has(value)) set.delete(value);
  else set.add(value);
}

function historicalCharacterListLength() {
  return historicalCharacters.filter(matchesHistoricalCharacterFilters).length;
}

function characterPagination(total, page) {
  const pageCount = Math.ceil(total / CHARACTER_PAGE_SIZE);
  if (pageCount <= 1) return "";
  const start = (page - 1) * CHARACTER_PAGE_SIZE + 1;
  const end = Math.min(page * CHARACTER_PAGE_SIZE, total);
  const pageButtons = Array.from({ length: pageCount }, (_, index) => {
    const pageNumber = index + 1;
    return `<button class="character-pagination-page" type="button" data-character-page="${pageNumber}" aria-current="${pageNumber === page ? "page" : "false"}">${pageNumber}</button>`;
  }).join("");
  return `<nav class="character-pagination" aria-label="${escapeHtml(t("board.character.pagination.label"))}">
    <button class="character-pagination-control" type="button" data-character-page="previous" aria-label="${escapeHtml(t("board.character.pagination.previous"))}"${page <= 1 ? " disabled" : ""}>${escapeHtml(t("board.character.pagination.previous"))}</button>
    <span class="character-pagination-pages">${pageButtons}</span>
    <button class="character-pagination-control" type="button" data-character-page="next" aria-label="${escapeHtml(t("board.character.pagination.next"))}"${page >= pageCount ? " disabled" : ""}>${escapeHtml(t("board.character.pagination.next"))}</button>
    <span class="character-pagination-summary">${escapeHtml(t("board.character.pagination.summary", { start: localizedNumber(start), end: localizedNumber(end), count: localizedNumber(total), page: localizedNumber(page), pages: localizedNumber(pageCount) }))}</span>
  </nav>`;
}

function renderCharacterBoard() {
  renderCharacterFilterOptions();
  const filtered = historicalCharacters
    .filter(matchesHistoricalCharacterFilters)
    .sort((left, right) => {
      if (state.sort === "name") return localizedCompare(historicalCharacterName(left), historicalCharacterName(right)) || left.key.localeCompare(right.key);
      if (state.sort === "birth") return String(left.birth_date || "9999").localeCompare(String(right.birth_date || "9999")) || left.key.localeCompare(right.key);
      return left.key.localeCompare(right.key);
    });
  if (state.selectedCharacter && !byHistoricalCharacter.has(state.selectedCharacter)) state.selectedCharacter = "";
  const pageCount = Math.ceil(filtered.length / CHARACTER_PAGE_SIZE);
  state.characterPage = Math.max(1, Math.min(pageCount || 1, Number(state.characterPage) || 1));
  const page = state.characterPage;
  const visible = filtered.slice((page - 1) * CHARACTER_PAGE_SIZE, page * CHARACTER_PAGE_SIZE);
  const pagination = characterPagination(filtered.length, page);
  els.resultCount.textContent = t("board.character.resultCount", { count: localizedNumber(filtered.length) });
  els.activeHint.textContent = state.search ? t("search.activeQuery", { query: state.search }) : "";
  els.countryList.className = "country-list character-list";
  els.countryList.innerHTML = visible.length
    ? `${pagination}${visible.map((character) => characterListRow(character)).join("")}${pagination}`
    : `<p class="empty">${escapeHtml(t("search.noResults"))}</p>`;
  bindCharacterListEvents();
  els.detail.innerHTML = isDetailPageRoute() ? renderHistoricalCharacterDetail(byHistoricalCharacter.get(state.selectedCharacter)) : "";
}

function characterListRow(character) {
  const culture = historicalCharacterCulture(character);
  const interestGroup = byInterestGroup.get(character.interest_group_key);
  const ideology = ideologyByKey.get(character.ideology_key);
  const historicalImage = byHistoricalCharacterImage.get(character.key);
  const badges = [
    historicalImage ? tagPill(t("board.character.hasHistoricalImage"), "tag-historical-image") : "",
    character.in_starting_history ? tagPill(t("board.character.starting"), "tag-special") : "",
    character.has_dna ? tagPill(t("board.character.dna"), "tag-technology") : tagPill(t("board.character.noDna"), "tag-muted"),
  ].filter(Boolean).join("");
  const identities = [
    interestGroup ? characterIdentityBadge("interest-group", interestGroup, interestGroupIconHtml(interestGroup, "character-row-icon interest-group-icon")) : "",
    ideology ? characterIdentityBadge("ideology", ideology, ideologyIconHtml(ideology, "character-row-icon ideology-icon")) : "",
  ].filter(Boolean).join("");
  return `<button class="country-row character-row" type="button" data-character-key="${escapeHtml(character.key)}" aria-current="${state.selectedCharacter === character.key}">
    <span class="character-row-title"><span class="character-row-name-group"><span class="name">${escapeHtml(historicalCharacterName(character))}</span>${identities ? `<span class="character-row-identities">${identities}</span>` : ""}</span><code class="character-row-key" title="${escapeHtml(character.key)}">${escapeHtml(character.key)}</code></span>
    <span class="minor country-meta">${escapeHtml(culture ? entityText(culture) : t("board.character.unknownCulture"))} · ${escapeHtml(character.birth_date || t("ui.none"))}</span>
    <span class="character-row-badges">${badges}</span>
  </button>`;
}

function characterIdentityBadge(kind, entity, icon) {
  const label = entityText(entity);
  const heading = kind === "interest-group" ? t("board.character.defaultInterestGroup", "默认利益集团") : t("board.character.startingIdeology", "初始意识形态");
  return `<span class="character-row-identity character-row-identity-${kind}" title="${escapeHtml(`${heading}：${label}`)}" aria-label="${escapeHtml(`${heading}：${label}`)}">${icon}</span>`;
}

function bindCharacterListEvents() {
  els.countryList.querySelectorAll("[data-character-key]").forEach((button) => {
    button.addEventListener("click", () => {
      replaceHash(`/character/${encodeURIComponent(button.dataset.characterKey)}`);
      void applyHash().then(render);
    });
  });
}

function renderHistoricalCharacterDetail(character) {
  if (!character) return `<p class="empty">${escapeHtml(t("search.noResults"))}</p>`;
  const culture = historicalCharacterCulture(character);
  const role = localeRuntime.current === "en"
    ? (character.character_role_name_en || character.character_role || t("ui.none"))
    : (character.character_role_name_zh || character.character_role_name_en || character.character_role || t("ui.none"));
  const interestGroup = byInterestGroup.get(character.interest_group_key);
  const ideology = ideologyByKey.get(character.ideology_key);
  const traits = (character.traits || []).map((key) => tagPill(historicalCharacterTraitLabel(key), "tag-trait", key, key)).join("");
  const sourceFiles = (character.starting_history_files || []).map((file) => `<code>${escapeHtml(file)}</code>`).join("<br>");
  const dnaStatus = character.has_dna ? t("board.character.dna") : t("board.character.noDna");
  return `<article class="character-detail">
    <div class="detail-title"><button class="detail-back-button" type="button" data-detail-back="character" aria-label="${escapeHtml(t("ui.back"))}" title="${escapeHtml(t("ui.back"))}"><img class="lucide-icon" src="assets/lucide/icons/arrow-left.svg" alt="" aria-hidden="true"></button><div class="detail-title-main"><h2>${escapeHtml(historicalCharacterName(character))}</h2><p class="minor">${escapeHtml(character.key)}</p></div></div>
    ${renderHistoricalCharacterImage(byHistoricalCharacterImage.get(character.key), character)}
    <dl class="field-grid">
      ${field(t("board.character.field.gender"), escapeHtml(character.female ? t("enum.gender.female") : t("enum.gender.male")))}
      ${field(t("board.character.field.birth"), escapeHtml(character.birth_date || t("ui.none")))}
      ${field(t("board.character.field.role"), escapeHtml(role))}
      ${field(t("board.character.field.culture"), culture ? `<a class="pill" href="#/culture/${encodeURIComponent(culture.key)}">${escapeHtml(entityText(culture))}</a>` : escapeHtml(t("board.character.unknownCulture")))}
      ${field(t("board.character.field.religion"), escapeHtml(characterReferenceLabel(character.religion_key, null, t("ui.none"))))}
      ${field(t("board.character.field.interestGroup"), interestGroup ? `<a class="pill" href="#/interest-group/${encodeURIComponent(interestGroup.key)}">${escapeHtml(entityText(interestGroup))}</a>` : escapeHtml(character.interest_group_key || t("ui.none")))}
      ${field(t("board.character.field.ideology"), ideology ? `<a class="pill" href="#/ideology/${encodeURIComponent(ideology.key)}">${escapeHtml(entityText(ideology))}</a>` : escapeHtml(character.ideology_key || t("ui.none")))}
      ${field(t("board.character.field.dna"), escapeHtml(dnaStatus))}
      ${field(t("board.character.field.startingHistory"), escapeHtml(character.in_starting_history ? t("board.character.starting") : t("board.character.notStarting")))}
      ${field(t("board.character.field.source"), escapeHtml(character.source_file || t("ui.none")))}
    </dl>
    <section><h3>${escapeHtml(t("board.character.field.traits"))}</h3><div class="character-traits">${traits || `<span class="empty">${escapeHtml(t("ui.none"))}</span>`}</div></section>
    <section><h3>${escapeHtml(t("board.character.field.roleFlags"))}</h3><p>${escapeHtml((character.role_flags || []).join("、") || t("ui.none"))}</p></section>
    <section><h3>${escapeHtml(t("board.character.field.startingFiles"))}</h3><p>${sourceFiles || t("ui.none")}</p></section>
  </article>`;
}
