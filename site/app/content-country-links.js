function relatedCountriesHtml(row) {
  const tags = [...new Set(row?.country_scope || [])].filter((tag) => byTag.has(tag));
  if (!tags.length) return "";
  return `<section class="content-related-countries">
    <h3>${escapeHtml(t("board.content.relatedCountries"))}</h3>
    <div class="content-related-country-list">${tags.map(relatedCountryLinkHtml).join("")}</div>
  </section>`;
}

function relatedCountryLinkHtml(tag) {
  const country = byTag.get(tag);
  if (!country) return "";
  return `<a class="content-related-country" data-related-country="${escapeHtml(tag)}" href="#/country/${encodeURIComponent(tag)}">
    ${countryFlagIconHtml(country, "content-related-country-flag")}
    <span>${escapeHtml(entityText(country) || tag)}</span>
    <code>${escapeHtml(tag)}</code>
  </a>`;
}

function countryFlavorContentHtml(tag) {
  const bucket = contentByCountry?.[tag];
  if (!bucket) return "";
  const sections = [
    countryContentSectionHtml("journal", bucket.journals, journalEntries, journalId, (row) => journalText(row, "name", journalId(row)), (row) => journalGroupName(journalGroup(row))),
    countryContentSectionHtml("event", bucket.events, events, (row) => row.key || row.id, (row) => eventText(row, "title", row.key || row.id), (row) => eventGroupTitle(row)),
    countryContentSectionHtml("decision", bucket.decisions, decisions, decisionId, (row) => decisionText(row, "name", decisionId(row)), (row) => decisionGroupLabel(row)),
  ];
  const total = (bucket.journals?.length || 0) + (bucket.events?.length || 0) + (bucket.decisions?.length || 0);
  if (!total) return "";
  return `<section class="country-flavor-content">
    <h3>${escapeHtml(t("board.country.flavorContent"))}</h3>
    <div class="country-flavor-content-counts">${contentCountPill("journals", bucket.journals)}${contentCountPill("events", bucket.events)}${contentCountPill("decisions", bucket.decisions)}</div>
    <div class="country-flavor-content-sections">${sections.join("")}</div>
  </section>`;
}

function contentCountPill(kind, ids) {
  return `<span class="country-content-count">${escapeHtml(t(`board.country.flavorContent.${kind}`))}<strong>${localizedNumber(ids?.length || 0)}</strong></span>`;
}

function countryContentSectionHtml(kind, ids, rows, idOf, titleOf, groupOf, open = false) {
  const wanted = new Set(ids || []);
  const visible = rows.filter((row) => wanted.has(idOf(row))).sort((left, right) => {
    const groupOrder = String(groupOf(left) || "").localeCompare(String(groupOf(right) || ""), undefined, { numeric: true, sensitivity: "base" });
    return groupOrder || String(idOf(left)).localeCompare(String(idOf(right)), undefined, { numeric: true, sensitivity: "base" });
  });
  return `<details class="country-content-section" data-country-content-kind="${escapeHtml(kind)}"${open ? " open" : ""}>
    <summary><span>${escapeHtml(t(`board.country.flavorContent.${kind}s`))}</span><strong>${localizedNumber(visible.length)}</strong></summary>
    <div class="country-content-list">${visible.map((row) => countryContentLinkHtml(kind, row, idOf, titleOf, groupOf)).join("") || `<p class="empty">${escapeHtml(t("board.country.flavorContent.empty"))}</p>`}</div>
  </details>`;
}

function countryContentLinkHtml(kind, row, idOf, titleOf, groupOf) {
  const id = idOf(row);
  return `<a class="country-content-link" data-country-content-link data-country-content-id="${escapeHtml(id)}" href="#/${escapeHtml(kind)}/${encodeURIComponent(id)}">
    <strong>${readableContentHtml(titleOf(row) || id)}</strong>
    <span class="country-content-link-meta"><code>${escapeHtml(id)}</code><span>${readableContentHtml(groupOf(row) || "")}</span>${countryContentChangeBadge(row)}</span>
  </a>`;
}

function countryContentChangeBadge(row) {
  if (row?.vc_change_kind === "added") return `<span class="event-marker vc-change-added">${escapeHtml(t("board.vcChange.added"))}</span>`;
  if (row?.vc_change_kind === "adjusted") return `<span class="event-marker vc-change-adjusted">${escapeHtml(t("board.vcChange.adjusted"))}</span>`;
  return "";
}
