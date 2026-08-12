function matchesRefSet(selectedSet, refs) {
  if (selectedSet.size === 0) return true;
  const keys = new Set((refs || []).map((item) => item.key));
  for (const key of selectedSet) {
    if (keys.has(key)) return true;
  }
  return false;
}

function countryTagPills(country) {
  return [
    victorianCenturyBadge(country),
    statusPills(country),
    tagPill(countryTypeTagLabel(country), "tag-type", "", `country-type:${countryTypeTagLabel(country)}`),
    tagPill(countryTierLabel(country.tier), "tag-tier", "", `country-tier:${country.tier || ""}`),
    groupedTraitPills(country.primaryCultureHeritageGroups, country.primaryCultureHeritages, "tag-heritage-group", "tag-heritage"),
    groupedTraitPills(country.primaryCultureLanguageGroups, country.primaryCultureLanguages, "tag-language-group", "tag-language"),
    refPills(country.primaryCultureTraditions, "tag-tradition"),
    refPills(country.locationStrategicRegions, "tag-region"),
  ].filter(Boolean).join("");
}

function statusPills(country) {
  const pills = [];
  if (country.existsAtStart === "是") pills.push(tagPill(t("board.country.status.startsInPlay"), "good", "", "country-status:start"));
  if (country.isReleasable === "是") pills.push(tagPill(t("board.country.status.releasable"), "tag-release", "", "country-status:releasable"));
  if (country.isMajorFormable === "是") pills.push(tagPill(t("board.country.status.majorFormable"), "warn", "", "country-formation:major"));
  else if (country.isMinorFormable === "是") pills.push(tagPill(t("board.country.status.minorFormable"), "warn", "", "country-formation:minor"));
  if (country.isSpecial === "是") pills.push(tagPill(t("board.country.status.special"), "special", "", "country-status:special"));
  if (country.isDualHeritage === "是") pills.push(tagPill(t("board.country.status.dualHeritage"), "tag-dual", "", "country-status:dual-heritage"));
  return pills.join("");
}

function groupedTraitPills(groups, traits, groupClass, traitClass) {
  const items = [];
  const traitsByGroup = new Map();
  const remaining = [];
  for (const trait of traits || []) {
    if (trait?.group_key) {
      if (!traitsByGroup.has(trait.group_key)) traitsByGroup.set(trait.group_key, []);
      traitsByGroup.get(trait.group_key).push(trait);
    } else if (trait?.key) {
      remaining.push(trait);
    }
  }
  const orderedGroups = [...(groups || [])].sort(groupClass.includes("heritage") ? sortHeritageGroupRef : sortRefByName);
  for (const group of orderedGroups) {
    if (!group?.key) continue;
    const label = entityText(group);
    const metadata = conceptTooltipMetadata(label, groupClass, "cultureTraitGroup", group.key);
    items.push(conceptPill({
      label,
      className: groupClass,
      title: group.key,
      kind: "cultureTraitGroup",
      key: group.key,
      category: metadata.category,
      description: metadata.description,
    }));
    items.push(victorianCenturyBadge(group));
    for (const trait of traitsByGroup.get(group.key) || []) {
      const label = entityText(trait);
      const metadata = conceptTooltipMetadata(label, traitClass, "cultureTrait", trait.key);
      items.push(conceptPill({
        label,
        className: traitClass,
        title: trait.key,
        kind: "cultureTrait",
        key: trait.key,
        category: metadata.category,
        description: metadata.description,
      }));
      items.push(victorianCenturyBadge(trait));
    }
    traitsByGroup.delete(group.key);
  }
  for (const traits of traitsByGroup.values()) {
    for (const trait of traits) {
      const label = entityText(trait);
      const metadata = conceptTooltipMetadata(label, traitClass, "cultureTrait", trait.key);
      items.push(conceptPill({
        label,
        className: traitClass,
        title: trait.key,
        kind: "cultureTrait",
        key: trait.key,
        category: metadata.category,
        description: metadata.description,
      }));
      items.push(victorianCenturyBadge(trait));
    }
  }
  for (const trait of remaining) {
    const label = entityText(trait);
    const metadata = conceptTooltipMetadata(label, traitClass, "cultureTrait", trait.key);
    items.push(conceptPill({
      label,
      className: traitClass,
      title: trait.key,
      kind: "cultureTrait",
      key: trait.key,
      category: metadata.category,
      description: metadata.description,
    }));
    items.push(victorianCenturyBadge(trait));
  }
  return items.join("");
}

function refPills(items, className) {
  return (items || []).map((item) => refConceptPill(item, className)).join("");
}

function limitedRefPills(items, className, limit = 10) {
  const refs = items || [];
  const visible = refs.slice(0, limit).map((item) => refConceptPill(item, className)).join("");
  const more = refs.length > limit ? tagPill(`另有 ${refs.length - limit} 项`, "tag-more") : "";
  return `${visible}${more}`;
}

function strategicRegionTagPills(region) {
  const regionName = strategicRegionName(region);
  return [
    victorianCenturyBadge(region),
    relationshipRefPills(region.starting_owners, "tag-type", "strategic-region-starting-owner", (label) => `“${regionName}”在1836年开局时由${label}拥有。`, 8),
    relationshipRefPills(region.homeland_cultures, "tag-heritage", "strategic-region-homeland-culture", (label) => `“${label}”在“${regionName}”拥有本土地域。`, 10),
  ].filter(Boolean).join("");
}

function geographicRegionTagPills(region) {
  const regionName = geographicRegionDisplayName(region);
  return [
    victorianCenturyBadge(region),
    relationshipRefPills(geographicRegionStrategicRegions(region), "tag-region", "geographic-region-strategic-region", () => `“${regionName}”包含该战略区域。`, 6),
    tagPill(`${geographicRegionStateRegions(region).length} 个地域`, "tag-muted", "", "geographic-region-state-region-count"),
  ].filter(Boolean).join("");
}

function tagTooltipMetadata(label, className, sourceKey, semanticKey) {
  const classKeys = String(className || "").split(/\s+/).filter(Boolean);
  const semanticPrefix = String(semanticKey || "").split(":")[0];
  const definitionKey = [semanticKey, semanticPrefix, sourceKey, ...classKeys]
    .find((key) => key && TAG_TOOLTIP_DEFINITIONS[key]);
  const definition = TAG_TOOLTIP_DEFINITIONS[definitionKey] || {};
  const defaults = TAG_TOOLTIP_DEFAULTS.tag || {};
  const key = semanticKey || sourceKey || label || "";
  const category = definition.categoryKey ? t(definition.categoryKey) : defaults.categoryKey ? t(defaults.categoryKey) : definition.category || defaults.category || "";
  const descriptionTemplate = definition.descriptionKey ? t(definition.descriptionKey) : defaults.descriptionKey ? t(defaults.descriptionKey) : definition.description || defaults.description;
  const description = formatTooltipDescription(descriptionTemplate, { label, key, category });
  return { key, category, description };
}

function conceptTooltipMetadata(label, className, kind, key) {
  const classKeys = String(className || "").split(/\s+/).filter(Boolean);
  const definitionKey = [key, kind, ...classKeys].find((candidate) => candidate && TAG_TOOLTIP_DEFINITIONS[candidate]);
  const definition = TAG_TOOLTIP_DEFINITIONS[definitionKey] || {};
  const defaults = TAG_TOOLTIP_DEFAULTS[kind] || {};
  if (!definition.category && !definition.categoryKey && !definition.description && !definition.descriptionKey && !defaults.category && !defaults.categoryKey && !defaults.description && !defaults.descriptionKey) return {};
  const category = definition.categoryKey ? t(definition.categoryKey) : defaults.categoryKey ? t(defaults.categoryKey) : definition.category || defaults.category || "";
  const descriptionTemplate = definition.descriptionKey ? t(definition.descriptionKey) : defaults.descriptionKey ? t(defaults.descriptionKey) : definition.description || defaults.description || "";
  const description = formatTooltipDescription(descriptionTemplate, { label, key, category });
  return { category, description };
}

function conceptDataAttributes({
  kind = "",
  key = "",
  label = "",
  search = "",
  category = "",
  description = "",
  secondaryDescription = "",
}) {
  const conceptKey = key || label || "";
  const conceptSearch = search || label || conceptKey;
  return [
    kind ? `data-concept-kind="${escapeHtml(kind)}"` : "",
    conceptKey ? `data-concept-key="${escapeHtml(conceptKey)}"` : "",
    label ? `data-concept-label="${escapeHtml(label)}"` : "",
    conceptSearch ? `data-concept-search="${escapeHtml(conceptSearch)}"` : "",
    category ? `data-concept-category="${escapeHtml(category)}"` : "",
    description ? `data-concept-description="${escapeHtml(description)}"` : "",
    secondaryDescription ? `data-concept-secondary-description="${escapeHtml(secondaryDescription)}"` : "",
  ].filter(Boolean).join(" ");
}

function conceptTag(label, kind = "", key = "", search = "") {
  if (!label) return "";
  const conceptKey = key || label;
  const metadata = conceptTooltipMetadata(label, "", kind, conceptKey);
  const attrs = conceptDataAttributes({
    kind,
    key: conceptKey,
    label,
    search: search || label,
    category: metadata.category,
    description: metadata.description,
  });
  return `<span class="tag concept-tag" ${attrs}>${escapeHtml(label)}</span>`;
}

function conceptPill({
  label,
  className = "",
  title = "",
  hideNativeTitle = false,
  kind = "",
  key = "",
  href = "",
  search = "",
  category = "",
  description = "",
  secondaryDescription = "",
  html = "",
}) {
  if (!label && !html) return "";
  const classText = className ? ` ${className}` : "";
  const conceptKey = key || title || label || "";
  const attrs = [
    `class="pill concept-pill${classText}"`,
    conceptDataAttributes({
      kind,
      key: conceptKey,
      label,
      search,
      category,
      description,
      secondaryDescription,
    }),
  ].filter(Boolean).join(" ");
  const content = html || escapeHtml(label);
  if (href) return `<a ${attrs} href="${escapeHtml(href)}">${content}</a>`;
  return `<span ${attrs}>${content}</span>`;
}

function conceptHref(kind, key) {
  if (!key) return "";
  if (kind === "country") return `#/country/${encodeURIComponent(key)}`;
  if (kind === "culture") return `#/culture/${encodeURIComponent(key)}`;
  if (kind === "stateRegion") return `#/state-region/${encodeURIComponent(key)}`;
  if (kind === "strategicRegion") return `#/strategic-region/${encodeURIComponent(key)}`;
  if (kind === "geographicRegion") return `#/geographic-region/${encodeURIComponent(key)}`;
  if (kind === "company") return `#/company/${encodeURIComponent(key)}`;
  if (kind === "ideology") return `#/ideology/${encodeURIComponent(key)}`;
  if (kind === "law") return `#/law/${encodeURIComponent(key)}`;
  if (kind === "technology") return `#/technology/${encodeURIComponent(key)}`;
  if (kind === "religion") return `#/religion/${encodeURIComponent(key)}`;
  return "";
}

function kindFromRef(item) {
  if (item?.tag) return "country";
  if (item?.id?.startsWith("country:")) return "country";
  if (item?.id?.startsWith("culture:")) return "culture";
  if (item?.id?.startsWith("state_region:")) return "stateRegion";
  if (item?.id?.startsWith("strategic_region:")) return "strategicRegion";
  if (item?.id?.startsWith("geographic_region:")) return "geographicRegion";
  if (item?.id?.startsWith("interest_group:")) return "interestGroup";
  if (item?.id?.startsWith("interest_group_trait:")) return "interestGroupTrait";
  if (item?.id?.startsWith("ideology:")) return "ideology";
  if (item?.id?.startsWith("law:")) return "law";
  if (item?.id?.startsWith("culture_trait_group:")) return "cultureTraitGroup";
  if (item?.id?.startsWith("culture_trait:")) return "cultureTrait";
  if (item?.id?.startsWith("building:")) return "building";
  if (item?.id?.startsWith("goods:") || item?.id?.startsWith("prestige_good:")) return "goods";
  if (item?.id?.startsWith("state_trait:")) return "stateTrait";
  return "";
}

function relationshipRefPills(items, className, semanticKey, description, limit = 10) {
  const refs = items || [];
  const relation = { semanticKey, description };
  const visible = refs.slice(0, limit).map((item) => refConceptPill(item, className, relation)).join("");
  const more = refs.length > limit ? tagPill(`另有 ${refs.length - limit} 项`, "tag-more") : "";
  return `${visible}${more}`;
}

function refConceptPill(item, className = "", relation = null) {
  if (!item) return "";
  const key = item.tag || item.key || "";
  const kind = kindFromRef(item) || inferConceptKind(key);
  const label = kind === "country"
    ? countryRefLabel(item)
    : kind === "strategicRegion"
    ? strategicRegionName(byStrategicRegion.get(key) || item)
    : kind === "geographicRegion"
      ? geographicRegionDisplayName(byGeographicRegion.get(key) || item)
    : entityText(item);
  const metadata = conceptTooltipMetadata(label, className, kind, key);
  const relationMetadata = relation?.semanticKey
    ? tagTooltipMetadata(label, className, "", relation.semanticKey)
    : null;
  const relationDescription = typeof relation?.description === "function"
    ? relation.description(label, item)
    : "";
  return conceptPill({
    label,
    className,
    title: key,
    kind,
    key,
    href: conceptHref(kind, key),
    category: relationMetadata?.category || metadata.category,
    description: relationDescription || relationMetadata?.description || metadata.description,
  });
}

function inferConceptKind(key) {
  if (!key) return "";
  if (byTag.has(key)) return "country";
  if (byCulture.has(key)) return "culture";
  if (byStateRegion.has(key)) return "stateRegion";
  if (byStrategicRegion.has(key)) return "strategicRegion";
  if (byGeographicRegion.has(key)) return "geographicRegion";
  if (byInterestGroup.has(key)) return "interestGroup";
  if (interestGroupTraitByKey.has(key)) return "interestGroupTrait";
  if (ideologyByKey.has(key)) return "ideology";
  if (cultureTraitByKey.has(key)) return "cultureTrait";
  if (stateTraitByKey.has(key)) return "stateTrait";
  if (buildingByKey.has(key)) return "building";
  if (goodsByKey.has(key)) return "goods";
  if (technologyByKey.has(key)) return "technology";
  if (String(key).startsWith("building_")) return "building";
  if (String(key).startsWith("goods_") || String(key).startsWith("prestige_good_")) return "goods";
  return "";
}

function tagPill(label, className = "", title = "", semanticKey = "", html = "") {
  if (!label) return "";
  const metadata = tagTooltipMetadata(label, className, title, semanticKey);
  return conceptPill({
    label,
    className: `tag-pill${className ? ` ${className}` : ""}`,
    title,
    hideNativeTitle: true,
    kind: "tag",
    key: metadata.key,
    category: metadata.category,
    description: metadata.description,
    html,
  });
}

function victorianCenturyBadge(item) {
  if (!isVictorianCenturyEntry(item)) return "";
  const isAdded = item.vc_change_kind === "added";
  const title = t(isAdded ? "vc.badge.addedTitle" : "vc.badge.adjustedTitle");
  return tagPill(t(isAdded ? "vc.badge.added" : "vc.badge.adjusted"), `tag-vc ${isAdded ? "tag-vc-added" : "tag-vc-adjusted"}`, title);
}

function isVictorianCenturyEntry(item) {
  return hasVictorianCenturyChange(item);
}

function countryTypeTagLabel(country) {
  return t(`enum.countryType.${country?.countryType}`) || countryTypeTagLabels[country?.countryType] || country?.countryType || "";
}

function field(label, value) {
  const html = value || `<span class="empty">${escapeHtml(t("ui.none"))}</span>`;
  return `<dt>${escapeHtml(label)}</dt><dd>${html}</dd>`;
}

function linkedTerms(keys, names, kind) {
  const links = (keys || []).map((key, index) => {
    if (!key) return "";
    const name = names?.[index] || key;
    const conceptKind = kind === "state-region" ? "stateRegion" : kind;
    return conceptPill({
      label: name,
      kind: conceptKind,
      key,
      title: key,
      href: conceptHref(conceptKind, key) || `#/${kind}/${encodeURIComponent(key)}`,
    });
  }).filter(Boolean);
  return links.length ? `<span class="link-list">${links.join("")}</span>` : "";
}

function countryLinks(tags, names) {
  const links = (tags || []).map((tag, index) => {
    if (!tag) return "";
    return conceptPill({
      label: countryRefLabel(byTag.get(tag) || { tag }),
      kind: "country",
      key: tag,
      title: tag,
      href: conceptHref("country", tag),
    });
  }).filter(Boolean);
  return links.length ? `<span class="link-list">${links.join("")}</span>` : "";
}

function cultureLinks(items) {
  const links = (items || []).map((item) => {
    if (!item?.key) return "";
    return refConceptPill(item);
  }).filter(Boolean);
  return links.length ? `<span class="link-list">${links.join("")}</span>` : "";
}

function stateRegionLinks(items) {
  const links = (items || []).map((item) => {
    if (!item?.key) return "";
    return refConceptPill(item);
  }).filter(Boolean);
  return links.length ? `<span class="link-list">${links.join("")}</span>` : "";
}

function countryStartingStateRegionLinks(country) {
  const items = (country?.startingStates || []).map((key) => {
    const stateRegion = byStateRegion.get(key);
    const label = `${entityText(stateRegion) || key}${isSplitStartingStateForCountry(stateRegion, country.tag) ? t("board.country.splitStartingState") : ""}`;
    return conceptPill({ label, kind: "stateRegion", key, title: key, href: conceptHref("stateRegion", key) });
  });
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function isSplitStartingStateForCountry(stateRegion, tag) {
  if (!stateRegion || !tag) return false;
  const owners = stateRegion.starting_province_owners || [];
  return owners.length > 1 && owners.some((owner) => owner.tag === tag);
}

function strategicRegionLinks(items) {
  const links = (items || []).map((item) => {
    if (!item?.key) return "";
    const region = byStrategicRegion.get(item.key) || item;
    return refConceptPill({ ...region, id: region.id || `strategic_region:${item.key}` });
  }).filter(Boolean);
  return links.length ? `<span class="link-list">${links.join("")}</span>` : "";
}

function geographicRegionLinks(items) {
  const links = (items || []).map((item) => {
    if (!item?.key) return "";
    const region = byGeographicRegion.get(item.key) || item;
    return refConceptPill({ ...region, id: region.id || `geographic_region:${item.key}` });
  }).filter(Boolean);
  return links.length ? `<span class="link-list">${links.join("")}</span>` : "";
}

function companyAssociationLinks(items) {
  const links = (items || []).map((item) => {
    const company = item.company;
    if (!company?.key) return "";
    const label = entityText(company) || company.key;
    return conceptPill({
      label,
      className: `resource-pill company-link-pill ${item.kind === "special" ? "extension-building-pill" : ""}`,
      title: company.key,
      kind: "company",
      key: company.key,
      href: conceptHref("company", company.key),
      html: `${companyIconHtml(company)}<span>${escapeHtml(label)}</span>`,
    });
  }).filter(Boolean);
  return links.length ? `<span class="link-list company-association-list">${links.join("")}</span>` : "";
}

function companiesForStateRegion(stateRegion) {
  const stateKey = stateRegion?.key || "";
  if (!stateKey) return [];
  return companies.map((company) => {
    const isHeadquarters = (company.preferred_headquarters || []).some((item) => item.key === stateKey);
    const isReferenced = (company.referenced_state_regions || []).some((item) => item.key === stateKey);
    if (!isHeadquarters && !isReferenced) return null;
    return {
      company,
      kind: isHeadquarters ? "headquarters" : "special",
    };
  }).filter(Boolean).sort((a, b) => (
    Number(b.kind === "headquarters") - Number(a.kind === "headquarters")
    || localizedCompare(entityText(a.company), entityText(b.company))
    || a.company.key.localeCompare(b.company.key)
  ));
}

function sourceSuffix(source) {
  if (!source) return "";
  const sourceKey = {
    国家定义: "countryDefinition",
    历史开局: "startingHistory",
    首个主流文化: "primaryCulture",
  }[source];
  const label = sourceKey ? t(`board.country.religionSource.${sourceKey}`) : source;
  return ` <span class="minor">${escapeHtml(t("ui.source", { source: label }))}</span>`;
}

function listText(values) {
  const items = (values || []).map((item) => {
    const label = typeof item === "string" ? item : entityText(item);
    const title = typeof item === "string" ? "" : item?.key && item.key !== label ? ` title="${escapeHtml(item.key)}"` : "";
    return label ? `<span class="pill"${title}>${escapeHtml(label)}</span>` : "";
  }).filter(Boolean);
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function traitPill(trait) {
  if (!trait?.key) return "";
  const label = entityText(trait);
  const metadata = conceptTooltipMetadata(label, "", "cultureTrait", trait.key);
  return conceptPill({
    label,
    kind: "cultureTrait",
    key: trait.key,
    title: trait.key,
    category: metadata.category,
    description: metadata.description,
  });
}

function traitGroupPill(group) {
  if (!group?.key) return "";
  const label = entityText(group);
  const metadata = conceptTooltipMetadata(label, "", "cultureTraitGroup", group.key);
  return conceptPill({
    label,
    kind: "cultureTraitGroup",
    key: group.key,
    title: group.key,
    category: metadata.category,
    description: metadata.description,
  });
}

function traitList(traits) {
  const items = (traits || []).map((trait) => `${traitPill(trait)}${victorianCenturyBadge(trait)}`).filter(Boolean);
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function traitGroupList(groups) {
  const items = (groups || []).map((group) => `${traitGroupPill(group)}${victorianCenturyBadge(group)}`).filter(Boolean);
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function goodsList(goods) {
  const items = (goods || []).map((item) => conceptPill({
    label: entityText(item),
    kind: "goods",
    key: item.key,
    title: item.key,
  }));
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function cappedResourceList(resources) {
  const items = (resources || []).map((item) => resourcePill(item, item.amount));
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function discoverableResourceAmount(item, fallback = "") {
  const amount = numericResourceAmount(item?.amount);
  if (amount !== null) return amount;
  const discovered = numericResourceAmount(item?.discovered_amount);
  const undiscovered = numericResourceAmount(item?.undiscovered_amount);
  if (discovered !== null && undiscovered !== null) return discovered + undiscovered;
  if (discovered !== null) return discovered;
  if (undiscovered !== null) return undiscovered;
  return fallback;
}

function numericResourceAmount(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function discoverableResourceList(resources) {
  const items = (resources || []).map((item) => {
    const amount = discoverableResourceAmount(item);
    return resourcePill(item, amount);
  });
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function buildingList(buildings, className = "tag-arable") {
  const items = (buildings || []).map((item) => buildingPill(item, className));
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function resourcePill(item, amount = "") {
  const name = entityText(item) || item?.key || "";
  const suffix = amount !== "" && amount !== null ? ` · ${escapeHtml(amount)}` : "";
  const metadata = buildingTooltipMetadata(item);
  return conceptPill({
    label: `${name}${amount !== "" && amount !== null ? ` ${amount}` : ""}`,
    className: "resource-pill image-pill",
    title: item?.key || "",
    kind: "building",
    key: item?.key || "",
    category: metadata.category,
    description: metadata.description,
    html: `${buildingIconHtml(item?.key, name)}<span>${escapeHtml(name)}${suffix}</span>`,
  });
}

function buildingPill(item, className = "") {
  const name = entityText(item) || item?.key || "";
  const classText = className ? ` ${className}` : "";
  const extensionBadge = className.includes("extension-building-pill") ? `<span class="building-kind-badge">${t("board.company.expansionBadge", "扩展")}</span>` : "";
  const metadata = buildingTooltipMetadata(item);
  return conceptPill({
    label: name,
    className: `resource-pill image-pill${classText}`,
    title: item?.key || "",
    kind: "building",
    key: item?.key || "",
    category: metadata.category,
    description: metadata.description,
    html: `${buildingIconHtml(item?.key, name)}${extensionBadge}<span>${escapeHtml(name)}</span>`,
  });
}

function buildingTooltipMetadata(item) {
  const label = entityText(item) || item?.key || "";
  return conceptTooltipMetadata(label, "", "building", item?.key || label);
}

function stateTraitPills(traits, stateRegion = null, { showVictorianCenturyBadge = true } = {}) {
  const items = (traits || []).map((trait) => `${stateTraitPill(trait, stateRegion)}${showVictorianCenturyBadge ? victorianCenturyBadge(trait) : ""}`);
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function stateTraitPill(trait, stateRegion = null) {
  const label = entityText(trait) || trait?.key || "";
  const metadata = conceptTooltipMetadata(label, "", "stateTrait", trait?.key || label);
  const description = stateTraitTooltipDescription(trait);
  const secondaryDescription = stateTraitTooltipSecondaryDescription(trait, stateRegion);
  return conceptPill({
    label,
    className: trait?.has_mapi ? "tag-mapi" : "tag-tradition",
    title: trait?.key || "",
    kind: "stateTrait",
    key: trait?.key || "",
    category: metadata.category,
    description,
    secondaryDescription,
  });
}

function stateTraitTooltipDescription(trait) {
  const summary = (trait?.modifiers || []).map(modifierSummaryLabel).filter(Boolean);
  const parts = [];
  if (summary.length) parts.push(summary.join("\n"));
  if ((trait?.required_techs_for_colonization || []).length) parts.push(`${t("board.region.colonizationTechnologies", "殖民所需科技")}：${technologyRefNames(trait.required_techs_for_colonization)}`);
  if ((trait?.disabling_technologies || []).length) parts.push(`${t("board.region.disablingTechnologies", "失效科技")}：${technologyRefNames(trait.disabling_technologies)}`);
  return parts.join("\n");
}

function stateTraitTooltipSecondaryDescription(trait, stateRegion = null) {
  const isGeneric = /(?:^|[\\/])00_generic_traits\.txt$/i.test(String(trait?.source_file || ""));
  const otherRegions = (stateTraitRegionsByKey.get(trait?.key || "") || [])
    .filter((region) => region.key && region.key !== stateRegion?.key)
    .map((region) => entityText(region) || region.key);
  return !isGeneric && otherRegions.length ? `${t("board.region.otherTraitRegions", "拥有该特质的地区")}：\n${otherRegions.join("、")}` : "";
}

function stateTraitEffectList(traits) {
  if (!(traits || []).length) {
    return `<p class="empty compact">${t("board.region.noTraits", "无地区特质。")}</p>`;
  }
  return `<div class="rule-list">${traits.map((trait) => `
    <article class="rule-item">
      <div class="trait-card-layout">
        ${traitIconHtml(trait, "state")}
        <div class="trait-card-content">
          <div class="rule-head">
            <strong>${escapeHtml(entityText(trait) || trait.key)}${victorianCenturyBadge(trait)}</strong>
            <span class="minor">${escapeHtml(trait.key)}</span>
          </div>
          <dl class="mini-grid">
            ${field(t("board.region.type", "类型"), traitCategoryPills(trait.categories))}
            ${field(t("board.region.effect", "效果"), modifierPills(trait.modifiers))}
            ${field(t("board.region.colonizationTechnologies", "殖民科技"), technologyPills(trait.required_techs_for_colonization))}
            ${field(t("board.region.disablingTechnologies", "失效科技"), technologyPills(trait.disabling_technologies))}
          </dl>
        </div>
      </div>
    </article>
  `).join("")}</div>`;
}

function traitCategoryPills(categories) {
  const items = (categories || []).map((category) => tagPill(
    entityText(category) || category.key,
    category.key === "mapi" ? "tag-mapi" : "tag-tradition",
    category.key,
    category.key === "mapi" ? "mapi-category" : "state-trait-category",
  ));
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function modifierPills(modifiers) {
  const items = (modifiers || []).map((modifier) => {
    const isMapi = modifier.key === "state_market_access_price_impact";
    return `<span class="pill tag-pill ${isMapi ? "tag-mapi" : "tag-effect"}">${escapeHtml(modifierSummaryLabel(modifier))}</span>`;
  });
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function technologyPills(items, className = "tag-technology") {
  const refs = (items || []).map((item) => {
    const key = typeof item === "string" ? item : item?.key;
    const technology = technologyByKey.get(key);
    return technology || (typeof item === "string" ? { key } : item);
  }).filter((item) => item.key);
  return refItemsPills(refs, "technology", className);
}

function technologyRefNames(items) {
  return (items || []).map((item) => {
    const key = typeof item === "string" ? item : item?.key;
    return entityText(technologyByKey.get(key) || (typeof item === "string" ? { key } : item));
  }).filter(Boolean).join("、");
}

function modifierSummaryLabel(modifier) {
  const label = modifierNameLabel(modifier);
  const value = modifierValueLabel(modifier);
  return [label, value].filter(Boolean).join(" ");
}

function modifierNameLabel(modifier) {
  const label = cleanGameLocalizationText(entityText(modifier))
    || humanizeGameLocalizationKey(modifier?.key || "", false);
  return label ? `${label.charAt(0).toLocaleUpperCase()}${label.slice(1)}` : "";
}

function modifierValueLabel(modifier) {
  const rawValue = modifier?.value;
  const numericValue = rawValue === null || rawValue === undefined || rawValue === "" ? NaN : Number(rawValue);
  if (!Number.isFinite(numericValue)) {
    return modifier?.value_raw === "yes" ? "" : cleanGameLocalizationText(modifier?.value_raw || "");
  }
  const percentage = isPercentageModifierKey(modifier?.key || "");
  const displayedValue = percentage ? numericValue * 100 : numericValue;
  const sign = displayedValue > 0 ? "+" : "";
  return `${sign}${localizedNumber(displayedValue)}${percentage ? "%" : ""}`;
}

function isPercentageModifierKey(key) {
  return key === "state_market_access_price_impact"
    || key.endsWith("_mult")
    || key.includes("_throughput_add")
    || key.includes("_efficiency_add")
    || key.includes("_speed_add")
    || key.includes("_rate_add");
}

function interestGroupFlavorList(groups) {
  const items = (groups || []).filter(Boolean);
  if (!items.length) {
    return `<p class="empty compact">${t("board.ideology.noInterestGroupFlavor", "松散政权没有常规利益集团风味数据。")}</p>`;
  }
  return `<div class="interest-group-list">${items.map(interestGroupFlavorCard).join("")}</div>`;
}

function interestGroupFlavorCard(group) {
  const displayName = interestGroupDisplayName(group);
  const flavoredNameTag = group.display_name?.is_flavored ? tagPill(t("board.ideology.renamed", "改名"), "tag-ig-changed", group.display_name.key) : "";
  const changedTraits = !sameKeySet(group.base_traits, group.active_traits);
  const changedIdeologies = (group.added_ideologies || []).length || (group.removed_ideologies || []).length;
  return `
    <article id="interest-group-flavor-target-${escapeHtml(group.key)}" class="rule-item interest-group-card interest-group-flavor-target" tabindex="-1" style="${interestGroupStyle(group)}">
      <div class="rule-head interest-group-head">
        <span class="interest-group-title">
          <span class="interest-group-color" aria-hidden="true"></span>
          <strong>${escapeHtml(displayName)}</strong>
          ${!group.display_name?.is_flavored ? tagPill(t("board.ideology.base", "基础"), "tag-muted") : ""}
        </span>
        <span class="minor">${escapeHtml(group.key)}</span>
      </div>
      <dl class="mini-grid interest-group-grid">
        ${flavoredNameTag ? field(t("board.ideology.flavorName", "风味名"), flavoredNameTag) : ""}
        ${field(t("board.ideology.traits", "特质"), interestGroupTraitDetailsHtml(group.active_traits, changedTraits))}
        ${field(t("board.ideology.title", "意识形态"), activeIdeologyPills(group))}
        ${changedIdeologies ? field(t("board.ideology.added", "新增"), ideologyPills(group.added_ideologies, "tag-ig-added")) : ""}
        ${changedIdeologies ? field(t("board.ideology.removed", "移除"), ideologyPills(group.removed_ideologies, "tag-ig-removed")) : ""}
        ${field(t("board.ideology.characterIdeologies", "个人意识形态"), ideologyPills(group.character_ideologies, "tag-tradition"))}
        ${field(t("board.ideology.rules", "规则"), interestGroupRuleSummary(group.applied_rules))}
      </dl>
      ${interestGroupRuleDetails(group.applied_rules)}
    </article>
  `;
}

function interestGroupDisplayName(group) {
  const name = entityText(group.display_name || group);
  const baseName = entityText(byInterestGroup.get(group.key) || group);
  if (group.display_name?.is_flavored && baseName && baseName !== name) {
    return t("board.ideology.flavoredGroupName", { name, base: baseName });
  }
  return name;
}

function interestGroupNamePill(group) {
  const key = group.display_name?.key || group.key;
  const label = interestGroupDisplayName(group);
  return conceptPill({
    label,
    className: group.display_name?.is_flavored ? "tag-ig-changed" : "tag-muted",
    title: key,
    kind: "interestGroup",
    key: group.key,
    search: label,
  });
}

function interestGroupTraitPills(traits, options = {}) {
  const normalizedOptions = typeof options === "string" ? { className: options } : options;
  const items = (traits || []).map((trait, index) => {
    const approval = interestGroupTraitApprovalText(trait);
    const title = [trait.key, approval, entityText(trait, "modifierSummary", ""), entityText(trait, "description", "")].filter(Boolean).join(t("ui.semicolon", "；"));
    const orderedClass = index < 3 ? `tag-ig-trait-${index + 1}` : "tag-effect";
    const classes = [
      normalizedOptions.className || orderedClass,
      normalizedOptions.base ? "tag-base-adopted" : "",
      normalizedOptions.changed ? "tag-changed-outline" : "",
    ].filter(Boolean).join(" ");
    return conceptPill({
      label: entityText(trait),
      className: classes,
      title,
      kind: "interestGroupTrait",
      key: trait.key,
      search: searchNames(trait.id || `interest_group_trait:${trait.key}`).join(" "),
    });
  }).filter(Boolean);
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function interestGroupTraitDetailsHtml(traits, changed = false) {
  const items = (traits || []).map((trait) => interestGroupTraitDetailCard(trait, changed)).filter(Boolean);
  return items.length ? `<div class="interest-group-trait-list">${items.join("")}</div>` : "";
}

function interestGroupTraitDetailCard(trait, changed = false) {
  if (!trait) return "";
  const approval = interestGroupTraitApprovalText(trait);
  const summary = entityText(trait, "modifierSummary", "");
  const desc = cleanDescriptionText(entityText(trait, "description", ""));
  const name = entityText(trait);
  const className = changed ? " interest-group-trait-card-changed" : "";
  return `
    <article class="interest-group-trait-card${className}" data-concept-kind="interestGroupTrait" data-concept-key="${escapeHtml(trait.key || "")}" data-concept-label="${escapeHtml(name)}" data-concept-search="${escapeHtml(searchNames(trait.id || `interest_group_trait:${trait.key}`).join(" "))}">
      <div class="trait-card-layout">
        ${traitIconHtml(trait, "interest-group")}
        <div class="trait-card-content">
          <div class="interest-group-trait-head">
            <strong>${escapeHtml(name)}</strong>
            ${approval ? `<span>${escapeHtml(approval)}</span>` : ""}
          </div>
          ${summary ? `<p>${summary.split(/；|;/).map((line) => escapeHtml(line.trim())).filter(Boolean).join("<br>")}</p>` : ""}
          ${desc ? `<p class="minor">${escapeHtml(desc)}</p>` : ""}
        </div>
      </div>
    </article>
  `;
}

function traitIconHtml(trait, kind) {
  const iconPath = String(trait?.icon || "");
  const fileName = iconPath
    ? iconPath.split(/[\\/]/).at(-1).replace(/\.dds$/i, ".png")
    : String(trait?.key || "").replace(/^ig_trait_/, "").replace(/^state_trait_/, "") + ".png";
  if (!fileName || fileName === ".png") return "";
  const folder = kind === "interest-group" ? "interest-group-traits" : "state-traits";
  const alt = escapeHtml(entityText(trait, "name", t("board.ideology.trait", "特质")));
  return `<img class="trait-icon" src="assets/${folder}/${escapeHtml(fileName)}" alt="${alt}" onerror="this.hidden=true">`;
}

function activeIdeologyPills(group) {
  const addedKeys = new Set((group.added_ideologies || []).map((item) => item.key));
  return ideologyPillGroups(group.active_ideologies, (ideology) => (
    addedKeys.has(ideology.key) ? "tag-ig-added" : "tag-muted"
  ));
}

function focusInterestGroupFlavorResult(countryTag, groupKey) {
  requestAnimationFrame(() => {
    const target = document.querySelector(`#interest-group-flavor-target-${CSS.escape(groupKey)}`);
    if (!target || state.selectedTag !== countryTag) return;
    const section = target.closest("details");
    if (section) section.open = true;
    target.scrollIntoView({ block: "center" });
    target.classList.add("interest-group-flavor-focus");
    target.focus({ preventScroll: true });
    window.setTimeout(() => target.classList.remove("interest-group-flavor-focus"), 1800);
  });
}

function ideologyPills(ideologyRefs, className = "tag-ideology") {
  return ideologyPillGroups(ideologyRefs, className);
}

function ideologyPillGroups(ideologyRefs, className = "tag-ideology") {
  const groups = ideologyTypeOptions.map((type) => ({
    ...type,
    items: [...(ideologyRefs || [])]
      .filter((ideology) => ideologyTypeKey(ideologyByKey.get(ideology?.key) || ideology) === type.key)
      .sort(sortRefByName),
  })).filter((type) => type.items.length > 0);
  return groups.map((type) => {
    const items = type.items.map((ideology) => {
      const resolvedClassName = typeof className === "function" ? className(ideology) : className;
      return ideologyPill(ideology, resolvedClassName);
    }).filter(Boolean);
    return `<div class="ideology-pill-group"><span class="ideology-pill-group-label">${escapeHtml(ideologyTypeLabel(type.key))}${t("ui.colon", "：")}</span><span class="link-list">${items.join("")}</span></div>`;
  }).join("");
}

function ideologyPill(ideology, className = "tag-ideology") {
  if (!ideology?.key) return "";
  const source = ideologyByKey.get(ideology.key) || ideology;
  // 类型标题“运动：”替代了名称后的“(运动)”后缀。
  const label = entityText(source);
  return conceptPill({
    label,
    className: `${className} ideology-tooltip-trigger`.trim(),
    title: ideologyLawStanceTooltip(source),
    hideNativeTitle: true,
    kind: "ideology",
    key: ideology.key,
    search: searchNames(source.id || `ideology:${source.key}`).join(" "),
    href: conceptHref("ideology", ideology.key),
  });
}

function ideologyRefPill(key, className = "tag-ideology") {
  const ideology = ideologyByKey.get(key) || { key };
  return ideologyPill(ideology, className);
}

function ideologyLawGroupTooltip(ideology) {
  const groups = ideologyLawGroupNames(ideology);
  return [ideology?.key, groups.length ? `相关法律组：${groups.join("、")}` : ""].filter(Boolean).join("；");
}

function ideologyLawStanceTooltip(ideology) {
  const law = state.detailKind === "law" ? lawByKey.get(state.selectedLaw) : null;
  const stanceLaw = law ? lawByKey.get(lawStanceSourceKey(law)) || law : null;
  const stance = stanceLaw && (ideology?.law_stances || []).find((item) => item.law_key === stanceLaw.key);
  const stanceText = stance ? `对${lawDisplayName(law)}：${lawStanceLabel(stance.stance)}` : "";
  return [ideologyLawGroupTooltip(ideology), stanceText].filter(Boolean).join("；");
}

function ideologyLawGroupNames(ideology) {
  const seen = new Map();
  for (const stance of ideology?.law_stances || []) {
    if (!stance.law_group_key || seen.has(stance.law_group_key)) continue;
    seen.set(stance.law_group_key, entityText(lawGroupByKey.get(stance.law_group_key) || stance, lawGroupByKey.has(stance.law_group_key) ? "name" : "lawGroupName", stance.law_group_key));
  }
  return [...seen.entries()]
    .sort((a, b) => orderValue(ideologyLawGroupOrderMap, a[0]) - orderValue(ideologyLawGroupOrderMap, b[0]) || localizedCompare(a[1], b[1]))
    .map(([, name]) => name);
}

function ideologyTypeKey(ideology) {
  const source = fileBaseName(ideology?.source_file);
  if (source === "03_ig_ideologies_movement.txt") return "movement";
  if (source.includes("character")) return "character";
  return "interestGroup";
}

function lawStanceCount(ideology) {
  return (ideology?.law_stances || []).length;
}

function cleanIdeologyDescription(value) {
  return cleanDescriptionText(value);
}

function cleanDescriptionText(value) {
  return cleanGameLocalizationText(value);
}

function cleanGameLocalizationText(value) {
  return String(value || "")
    .replace(/\\_/g, "_")
    .replace(/\[Concept\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)\]/gi, (_, conceptKey, displayKey) => (
      gameLocalizationReferenceLabel(displayKey.replace(/^\$|\$$/g, "") || conceptKey)
    ))
    .replace(/\[Nbsp\]/gi, " ")
    .replace(/\[(concept_[A-Za-z0-9_]+)\]/gi, (_, key) => gameLocalizationReferenceLabel(key))
    .replace(/\$([A-Za-z0-9_:.]+)(?:\|[^$]+)?\$/g, (_, key) => gameLocalizationReferenceLabel(key))
    .replace(/@[A-Za-z0-9_]+!/g, "")
    .replace(/#!/g, "")
    .replace(/#[A-Za-z0-9_]+\s*/g, "")
    .replace(/#$/g, "")
    .replace(/!(?=[\p{L},.;:，。；：])/gu, "")
    .replace(/!+$/, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function gameLocalizationReferenceLabel(key) {
  const normalizedKey = String(key || "").replace(/^\$|\$$/g, "");
  const entity = buildingByKey.get(normalizedKey)
    || goodsByKey.get(normalizedKey)
    || byInterestGroup.get(normalizedKey)
    || ideologyByKey.get(normalizedKey)
    || lawByKey.get(normalizedKey)
    || technologyByKey.get(normalizedKey);
  if (entity) return entityText(entity);
  if (normalizedKey.startsWith("concept_")) return humanizeGameLocalizationKey(normalizedKey.slice("concept_".length), false);
  if (normalizedKey.startsWith("ship_group_")) return humanizeGameLocalizationKey(normalizedKey.slice("ship_group_".length), true);
  if (normalizedKey.startsWith("ig_variant_")) return humanizeGameLocalizationKey(normalizedKey.slice("ig_variant_".length), true);
  return humanizeGameLocalizationKey(normalizedKey, true);
}

function humanizeGameLocalizationKey(key, titleCase) {
  const words = String(key || "").replace(/[_:.]+/g, " ").trim();
  if (!titleCase) return words.toLocaleLowerCase();
  return words.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());
}

function ideologyInterestGroupRefs(ideology) {
  const related = relatedIdeologyUsage(ideology);
  const map = new Map();
  for (const group of [...related.baseInterestGroups, ...related.characterInterestGroups]) {
    if (group?.key) map.set(group.key, group);
  }
  for (const country of countries || []) {
    for (const group of country.interestGroups || []) {
      if (!group?.key) continue;
      const hasIdeology = [
        ...(group.active_ideologies || []),
        ...(group.added_ideologies || []),
        ...(group.removed_ideologies || []),
      ].some((item) => item.key === ideology?.key);
      if (hasIdeology) map.set(group.key, byInterestGroup.get(group.key) || group);
    }
  }
  return [...map.values()].filter((group) => group?.key);
}

function ideologyOccurrenceRefs(ideology) {
  const keys = new Set();
  const related = relatedIdeologyUsage(ideology);
  const file = fileBaseName(ideology?.source_file).toLowerCase();
  if (related.baseInterestGroups.length || related.characterInterestGroups.length) keys.add("default");
  if ((related.flavorUsage || []).length || file.includes("flavor") || file.includes("event")) keys.add("flavor");
  if (file.includes("tech") || file.includes("technology") || (ideology.unlock_technologies || []).length) keys.add("technology");
  if (file.includes("journal") || (ideology.unlock_journal_entries || []).length) keys.add("journal");
  return [...keys].map((key) => ({ key, loc: { name: `enum.ideologyOccurrence.${key}` } }));
}

function ideologyLawGroupRefs(ideology) {
  const map = new Map();
  for (const stance of ideology?.law_stances || []) {
    if (!stance.law_group_key || map.has(stance.law_group_key)) continue;
    map.set(stance.law_group_key, {
      key: stance.law_group_key,
      id: `law_group:${stance.law_group_key}`,
      loc: { name: stance.loc?.lawGroupName },
    });
  }
  return [...map.values()].sort(sortIdeologyLawGroup);
}

function lawStanceGroupsHtml(ideology) {
  const groups = groupLawStances(ideology?.law_stances || []);
  if (!groups.length) return `<p class="empty compact">${t("board.ideology.noLawStances", "没有法律态度数据。")}</p>`;
  return `<div class="vic3-law-groups">${groups.map((group) => `
    <section class="vic3-law-group">
      <h3>${escapeHtml(t("board.ideology.stanceToward", { group: group.name }))}</h3>
      <div class="vic3-law-lines">
        ${lawAttitudeLinesHtml(group.items)}
      </div>
    </section>
  `).join("")}</div>`;
}

function groupLawStances(stances) {
  const groups = new Map();
  for (const stance of stances || []) {
    const key = stance.law_group_key || "";
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: entityText(lawGroupByKey.get(key) || stance, lawGroupByKey.has(key) ? "name" : "lawGroupName", key || t("enum.lawGroupCategory.uncategorized", "未分组")),
        items: [],
      });
    }
    groups.get(key).items.push(stance);
  }
  return [...groups.values()].sort((a, b) => sortIdeologyLawGroup(a, b));
}

function lawStanceChip(stance) {
  const name = entityText(lawByKey.get(stance.law_key) || stance, lawByKey.has(stance.law_key) ? "name" : "lawName", stance.law_key);
  const stanceLabel = lawStanceLabel(stance.stance);
  const className = `law-pill ${lawStanceClassName(stance.stance)}`;
  return conceptPill({
    label: `${name} ${stanceLabel}`,
    className,
    title: [stance.law_key, stance.stance].filter(Boolean).join("；"),
    kind: "law",
    key: stance.law_key,
    search: name,
    html: `<span class="law-name">${escapeHtml(name)}</span><span class="law-stance-label">${escapeHtml(stanceLabel)}</span>`,
  });
}

function lawAttitudeLinesHtml(stances) {
  const grouped = new Map();
  for (const stance of stances || []) {
    const key = stance.stance || "neutral";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(stance);
  }
  return lawStanceDisplayOrder
    .filter((stance) => grouped.has(stance))
    .map((stance) => {
      const items = grouped.get(stance).sort((a, b) => (
        localizedCompare(entityText(lawByKey.get(a.law_key) || a, lawByKey.has(a.law_key) ? "name" : "lawName", a.law_key), entityText(lawByKey.get(b.law_key) || b, lawByKey.has(b.law_key) ? "name" : "lawName", b.law_key))
      ));
      const names = items.map((item) => entityText(lawByKey.get(item.law_key) || item, lawByKey.has(item.law_key) ? "name" : "lawName", item.law_key)).filter(Boolean).join(t("ui.listSeparator", "、"));
      return `
        <div class="vic3-law-line ${lawStanceClassName(stance)}">
          <span>${escapeHtml(lawStanceSentencePrefix(stance))} </span>${escapeHtml(names)}
        </div>
      `;
    }).join("");
}

function lawStanceSentencePrefix(stance) {
  return t(`enum.lawStance.${stance}`, stance || "");
}

function ideologyUnlockTagsHtml(ideology) {
  const tags = [
    ...(ideology.unlock_technologies || []).map((item) => technologyPill(item, "tag-technology")),
    ...(ideology.unlock_journal_entries || []).map((item) => conceptPill({
      label: t("board.ideology.journalEntryValue", { name: entityText(item) }),
      className: "tag-journal",
      title: item.key,
      key: item.key,
      search: searchNames(item.id || item.key).join(" "),
    })),
  ].filter(Boolean);
  if (!tags.length) return "";
  return `
    <div class="ideology-unlock-tags" aria-label="${escapeHtml(t("board.ideology.unlockSources", "解锁来源"))}">
      ${tags.join("")}
    </div>
  `;
}

function ideologyRuleSourceLabel(ideology) {
  const sources = uniqueUnlockSourceRows(ideology.unlock_sources || []);
  if (!sources.length) return "";
  return `
    <section class="vic3-special-usage ideology-source-usage">
      <h3>${t("board.ideology.source", "来源")}</h3>
      <dl class="field-grid">
        ${sources.slice(0, 12).map((source) => field(ideologySourceKindLabel(source.kind), ideologySourceText(source))).join("")}
      </dl>
    </section>
  `;
}

function uniqueUnlockSourceRows(sources) {
  const seen = new Set();
  const result = [];
  for (const source of sources || []) {
    const key = [source.kind, source.source_key, source.source_file, source.loc?.conditionSummary].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(source);
  }
  return result;
}

function ideologySourceKindLabel(kind) {
  return t(`enum.ideologySourceKind.${kind}`, t("board.ideology.source", "来源"));
}

function ideologyTypeLabel(key) {
  return t(`enum.ideologyType.${key}`, key || t("board.ideology.title", "意识形态"));
}

function ideologyOccurrenceLabel(key) {
  return t(`enum.ideologyOccurrence.${key}`, key || "");
}

function ideologyLawFilterGroupLabel(key) {
  return t(`enum.ideologyLawFilterGroup.${key}`, key || "");
}

function ideologySourceText(source) {
  const sourceName = entityText(source, "sourceName", source.source_key);
  const conditionSummary = renderTextSpec({ message: source.loc?.conditionSummary, fallback: "" });
  const parts = [
    sourceName !== source.source_key ? t("board.ideology.sourceNameWithKey", { name: sourceName, key: source.source_key }) : source.source_key,
    ideologyUnlockRefsText(source.technologies, t("board.ideology.technology", "科技")),
    ideologyUnlockRefsText(source.journal_entries, t("board.ideology.journalEntry", "日志条目")),
    conditionSummary && conditionSummary !== t("board.law.scriptCondition", "脚本条件") ? conditionSummary : "",
    fileBaseName(source.source_file),
  ].filter(Boolean);
  return escapeHtml(parts.join("；"));
}

function ideologyUnlockRefsText(items, label) {
  if (!(items || []).length) return "";
  return t("board.ideology.namedRefs", { label, values: (items || []).map((item) => entityText(item)).join(t("ui.listSeparator", "、")) });
}

function ideologyReplacementUsageHtml(related) {
  const rows = (related?.flavorUsage || [])
    .map((rule) => field(ideologyFlavorUsageLabel(rule), ideologyFlavorUsageValue(rule)))
    .filter(Boolean);
  if (!rows.length) return "";
  return `
    <section class="vic3-special-usage ideology-replacement-usage">
      <h3>${t("board.ideology.occurrenceAndReplacement", "出现和替换")}</h3>
      <dl class="field-grid">${rows.join("")}</dl>
    </section>
  `;
}

function ideologyFlavorUsageLabel(rule) {
  return t(`enum.ideologyFlavorUsage.${rule.kind}`, t("board.ideology.flavor", "风味"));
}

function ideologyFlavorUsageValue(rule) {
  const refs = [];
  if (rule.kind === "replaces" && rule.ideologyKey) refs.push(ideologyRefPill(rule.ideologyKey, "tag-ig-removed"));
  if (rule.kind === "replaced_by" && rule.ideologyKey) refs.push(ideologyRefPill(rule.ideologyKey, "tag-ig-added"));
  const countryHtml = fullCountryLinks(rule.countries);
  const ideologyHtml = refs.length ? `<span class="link-list">${refs.join("")}</span>` : "";
  return [ideologyHtml, countryHtml].filter(Boolean).join("");
}

function ideologyFlavorDefinitionHtml(ideology) {
  if (ideology?.flavor_definition_status !== "unassigned") return "";
  return `
    <section class="vic3-special-usage ideology-flavor-definition">
      <h3>${t("board.ideology.flavorDefinition", "风味定义")}</h3>
      <p>${escapeHtml(renderTextSpec({ message: ideology.loc?.flavorDefinitionNote, fallback: t("board.ideology.unassignedFlavorNote", "风味意识形态定义；当前脚本未分配给任何利益集团。") }))}</p>
      <dl class="field-grid">
        ${field(t("board.ideology.status", "状态"), tagPill(t("board.ideology.unassigned", "未分配"), "tag-muted"))}
        ${field(t("board.ideology.file", "文件"), escapeHtml(fileBaseName(ideology.source_file)))}
      </dl>
    </section>
  `;
}

function ideologyWeightSectionHtml(ideology) {
  const requirements = ideology.character_requirements || {};
  const leaderWeight = ideology.interest_group_leader_weight;
  const nonLeaderWeight = ideology.non_interest_group_leader_weight;
  if (!requirements.country && !requirements.interest_group_leader && !requirements.non_interest_group_leader && !leaderWeight && !nonLeaderWeight) return "";
  const sections = [
    weightRequirementHtml(t("board.ideology.countryRequirement", "国家要求"), requirements.country),
    weightRequirementHtml(t("board.ideology.leaderRequirement", "领袖要求"), requirements.interest_group_leader),
    weightRequirementHtml(t("board.ideology.nonLeaderRequirement", "非领袖要求"), requirements.non_interest_group_leader),
    weightListHtml(t("board.ideology.leaderWeight", "领袖权重"), leaderWeight),
    weightListHtml(t("board.ideology.nonLeaderWeight", "非领袖权重"), nonLeaderWeight),
  ].filter(Boolean).join("");
  return `
    <details class="collapsible-detail-section ideology-weight-section">
      <summary><span>${t("board.ideology.characterWeight", "角色权重")}</span><small>${t("board.ideology.requirementsAndModifiers", "要求与权重修正")}</small></summary>
      <div class="collapsible-detail-body ideology-weight-body">
        ${sections}
      </div>
    </details>
  `;
}

function weightRequirementHtml(label, requirement) {
  if (!requirement) return "";
  return `
    <section class="ideology-weight-group">
      <h3>${escapeHtml(label)}</h3>
      <p>${escapeHtml(renderTextSpec({ message: requirement.loc?.summary, fallback: t("board.law.scriptCondition", "脚本条件") }))}</p>
      ${conditionRefPills(requirement)}
      ${rawDetails(t("board.law.conditionScript", "条件脚本"), requirement.raw)}
    </section>
  `;
}

function weightListHtml(label, weight) {
  const entries = weight?.entries || [];
  if (!entries.length) return "";
  return `
    <section class="ideology-weight-group">
      <h3>${escapeHtml(label)}</h3>
      <div class="ideology-weight-list">
        ${entries.map(weightEntryHtml).join("")}
      </div>
    </section>
  `;
}

function weightEntryHtml(entry) {
  const label = entry.kind === "multiply"
    ? t("board.ideology.weightMultiplier", { value: formatWeightValue(entry.value) })
    : entry.loc?.conditionSummary
      ? t(entry.kind === "base" ? "board.ideology.weightBase" : "board.ideology.weightAdd", { value: formatSignedWeight(entry.value) })
      : t("board.ideology.weightBase", { value: formatWeightValue(entry.value) });
  const conditionSummary = renderTextSpec({ message: entry.loc?.conditionSummary, fallback: "" });
  const refs = conditionRefPills(entry);
  return `
    <article class="ideology-weight-entry">
      <div class="ideology-weight-entry-head">
        <strong>${escapeHtml(label)}</strong>
        ${entry.desc ? `<span>${escapeHtml(weightDescLabel(entry.desc))}</span>` : ""}
      </div>
      ${conditionSummary ? `<p>${escapeHtml(conditionSummary)}</p>` : ""}
      ${refs}
      ${rawDetails(t("board.law.conditionScript", "条件脚本"), entry.condition_raw)}
    </article>
  `;
}

function conditionRefPills(condition) {
  const parts = [
    refItemsPills(condition.interest_groups, "interestGroup", "tag-ig-changed"),
    refItemsPills(condition.laws, "law", "tag-law"),
    refItemsPills(condition.technologies, "technology", "tag-technology"),
    refItemsPills(condition.journal_entries, "", "tag-journal"),
    refItemsPills(condition.traits, "trait", "tag-tradition"),
  ].filter(Boolean);
  return parts.length ? `<div class="ideology-weight-refs">${parts.join("")}</div>` : "";
}

function refItemsPills(items, kind, className) {
  const pills = (items || []).map((item) => {
    if (kind === "technology") return technologyPill(item, className);
    const label = entityText(item);
    const metadata = conceptTooltipMetadata(label, className, kind, item.key);
    return conceptPill({
      label,
      className,
      title: item.key,
      kind,
      key: item.key,
      href: conceptHref(kind, item.key),
      category: metadata.category,
      description: metadata.description,
    });
  }).filter(Boolean);
  return pills.length ? `<span class="link-list">${pills.join("")}</span>` : "";
}

function technologyPill(item, className = "tag-technology") {
  const key = typeof item === "string" ? item : item?.key || "";
  if (!key) return "";
  const technology = technologyByKey.get(key);
  const label = entityText(technology || (typeof item === "string" ? { key } : item));
  const metadata = conceptTooltipMetadata(label, "", "technology", key);
  return conceptPill({
    label,
    className,
    title: key,
    kind: "technology",
    key,
    href: conceptHref("technology", key),
    search: label,
    category: metadata.category,
    description: metadata.description,
  });
}

function formatSignedWeight(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value || "");
  return number > 0 ? `+${number}` : String(number);
}

function formatWeightValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : String(value || "");
}

function weightDescLabel(desc) {
  if (desc === "base_value") return t("board.ideology.baseValue", "基础值");
  return desc || "";
}

function lawStanceLabel(stance) {
  return t(`enum.lawStance.${stance}`, stance || "");
}

function lawStanceClassName(stance) {
  return {
    strongly_approve: "stance-strongly-approve",
    approve: "stance-approve",
    neutral: "stance-neutral",
    disapprove: "stance-disapprove",
    strongly_disapprove: "stance-strongly-disapprove",
  }[stance] || "stance-neutral";
}

function relatedIdeologyUsage(ideology) {
  const key = ideology?.key || "";
  const baseInterestGroups = [];
  const characterInterestGroups = [];
  const activeCountries = new Map();
  const addedCountries = new Map();
  const removedCountries = new Map();
  const flavorUsage = new Map();
  if (!key) {
    return { baseInterestGroups, characterInterestGroups, activeCountries: [], addedCountries: [], removedCountries: [], flavorUsage: [] };
  }
  if (ideologyUsageCache.has(key)) return ideologyUsageCache.get(key);
  for (const group of interestGroups || []) {
    if ((group.ideologies || []).some((item) => item.key === key)) baseInterestGroups.push(group);
    if ((group.character_ideologies || []).some((item) => item.key === key)) characterInterestGroups.push(group);
  }
  for (const country of countries || []) {
    for (const group of country.interestGroups || []) {
      if ((group.active_ideologies || []).some((item) => item.key === key)) activeCountries.set(country.tag, country);
      if ((group.added_ideologies || []).some((item) => item.key === key)) addedCountries.set(country.tag, country);
      if ((group.removed_ideologies || []).some((item) => item.key === key)) removedCountries.set(country.tag, country);
      classifyFlavorIdeologyUsage(key, group, country, flavorUsage);
    }
  }
  const result = {
    baseInterestGroups: baseInterestGroups.sort(sortRefByName),
    characterInterestGroups: characterInterestGroups.sort(sortRefByName),
    activeCountries: [...activeCountries.values()].sort(sortCountriesByTag),
    addedCountries: [...addedCountries.values()].sort(sortCountriesByTag),
    removedCountries: [...removedCountries.values()].sort(sortCountriesByTag),
    flavorUsage: [...flavorUsage.values()].map((rule) => ({
      ...rule,
      countries: [...rule.countries.values()].sort(sortCountriesByTag),
    })).sort((a, b) => localizedCompare(ideologyFlavorUsageLabel(a), ideologyFlavorUsageLabel(b))),
  };
  ideologyUsageCache.set(key, result);
  return result;
}

function classifyFlavorIdeologyUsage(key, group, country, out) {
  for (const rule of group.applied_rules || []) {
    const added = rule.added_ideologies || [];
    const removed = rule.removed_ideologies || [];
    if (!added.length && !removed.length) continue;
    const pairedAddedKeys = new Set();
    const pairedRemovedKeys = new Set();
    for (const addedIdeology of added) {
      for (const removedIdeology of removed) {
        if (!sharedIdeologyLawGroupKeys(addedIdeology.key, removedIdeology.key).length) continue;
        pairedAddedKeys.add(addedIdeology.key);
        pairedRemovedKeys.add(removedIdeology.key);
        if (addedIdeology.key === key) {
          addIdeologyFlavorUsage(out, {
            kind: "replaces",
            ideologyKey: removedIdeology.key,
            ideologyName: entityText(removedIdeology),
            country,
          });
        }
        if (removedIdeology.key === key) {
          addIdeologyFlavorUsage(out, {
            kind: "replaced_by",
            ideologyKey: addedIdeology.key,
            ideologyName: entityText(addedIdeology),
            currentKey: removedIdeology.key,
            currentName: entityText(removedIdeology),
            country,
          });
        }
      }
    }
    for (const addedIdeology of added) {
      if (addedIdeology.key === key && !pairedAddedKeys.has(addedIdeology.key)) {
        addIdeologyFlavorUsage(out, {
          kind: "added",
          country,
        });
      }
    }
    for (const removedIdeology of removed) {
      if (removedIdeology.key === key && !pairedRemovedKeys.has(removedIdeology.key)) {
        addIdeologyFlavorUsage(out, {
          kind: "removed",
          country,
        });
      }
    }
  }
}

function sharedIdeologyLawGroupKeys(leftKey, rightKey) {
  const left = new Set(((ideologyByKey.get(leftKey)?.law_stances) || []).map((stance) => stance.law_group_key).filter(Boolean));
  const right = new Set(((ideologyByKey.get(rightKey)?.law_stances) || []).map((stance) => stance.law_group_key).filter(Boolean));
  return [...left].filter((key) => right.has(key));
}

function addIdeologyFlavorUsage(out, rule) {
  const label = [rule.kind, rule.ideologyKey || "", rule.currentKey || ""].join(":");
  if (!out.has(label)) {
    out.set(label, {
      label,
      kind: rule.kind,
      ideologyKey: rule.ideologyKey,
      ideologyName: rule.ideologyName,
      currentKey: rule.currentKey,
      currentName: rule.currentName,
      countries: new Map(),
    });
  }
  if (rule.country?.tag) out.get(label).countries.set(rule.country.tag, rule.country);
}

function interestGroupRefPills(groups, className = "") {
  const pills = (groups || []).map((group) => conceptPill({
    label: entityText(group),
    className,
    title: group.key,
    kind: "interestGroup",
    key: group.key,
    search: searchNames(group.id || `interest_group:${group.key}`).join(" "),
  })).filter(Boolean);
  return pills.length ? `<span class="link-list">${pills.join("")}</span>` : "";
}

function limitedCountryLinks(items, limit = 36) {
  const countriesToShow = (items || []).slice(0, limit);
  const links = countriesToShow.map((country) => conceptPill({
    label: countryRefLabel(country),
    kind: "country",
    key: country.tag,
    title: country.tag,
    href: conceptHref("country", country.tag),
  })).join("");
  const more = (items || []).length > limit ? tagPill(t("ui.moreCountries", { count: localizedNumber((items || []).length - limit) }), "tag-more") : "";
  return links || more ? `<span class="link-list">${links}${more}</span>` : "";
}

function fullCountryLinks(items) {
  const links = (items || []).map((country) => conceptPill({
    label: countryRefLabel(country),
    kind: "country",
    key: country.tag,
    title: country.tag,
    href: conceptHref("country", country.tag),
  })).join("");
  return links ? `<span class="link-list full-link-list">${links}</span>` : "";
}

function interestGroupRuleSummary(rules) {
  const names = unique((rules || []).flatMap((rule) => [
    ...(rule.names || []).map((item) => entityText(item)),
    ...(rule.traits || []).map((item) => entityText(item)),
    ...(rule.added_ideologies || []).map((item) => entityText(item)),
  ]).filter(Boolean));
  if (!names.length) return tagPill(t("board.ideology.baseDefault", "基础默认"), "tag-muted");
  return tagPill(t("board.ideology.ruleCount", { count: localizedNumber(rules.length) }), "tag-special", names.join(t("ui.semicolon", "；")));
}

function interestGroupRuleDetails(rules) {
  if (!(rules || []).length) return "";
  return `
    <details class="script-details interest-group-rule-details">
      <summary>${t("board.ideology.matchingRules", "匹配规则")}</summary>
      <div class="interest-group-rule-list">
        ${rules.map((rule) => `
          <section class="interest-group-rule">
            <div class="minor">${interestGroupLineBreaks(rule.condition_summary_zh || renderTextSpec({ message: rule.loc?.conditionSummary, fallback: t("board.ideology.default", "默认") }))}</div>
            <dl class="mini-grid">
              ${field(t("board.ideology.name", "名称"), interestGroupEffectRefPills(rule.names, "interestGroup", "tag-ig-changed"))}
              ${field(t("board.ideology.traits", "特质"), interestGroupEffectRefPills(rule.traits, "interestGroupTrait", "tag-changed-outline"))}
              ${field(t("board.ideology.added", "新增"), interestGroupEffectRefPills(rule.added_ideologies, "ideology", "tag-ig-added"))}
              ${field(t("board.ideology.removed", "移除"), interestGroupEffectRefPills(rule.removed_ideologies, "ideology", "tag-ig-removed"))}
            </dl>
            ${rawDetails(t("board.law.conditionScript", "条件脚本"), rule.condition_raw)}
          </section>
        `).join("")}
      </div>
    </details>
  `;
}

function interestGroupLineBreaks(value) {
  return String(value || "").split(/；|;/).map((line) => escapeHtml(line.trim())).filter(Boolean).join("<br>");
}

function interestGroupEffectRefPills(items, kind, className) {
  const pills = (items || []).map((item) => conceptPill({
    label: entityText(item),
    className,
    title: item.key,
    kind,
    key: item.key,
    href: conceptHref(kind, item.key),
  })).filter(Boolean);
  return pills.length ? `<span class="link-list">${pills.join("")}</span>` : "";
}

function interestGroupTraitApprovalText(trait) {
  const parts = [];
  if (trait?.min_approval) parts.push(t("board.ideology.minimumApproval", { value: interestGroupApprovalLabel(trait.min_approval) }));
  if (trait?.max_approval) parts.push(t("board.ideology.maximumApproval", { value: interestGroupApprovalLabel(trait.max_approval) }));
  return parts.join("；");
}

function interestGroupApprovalLabel(value) {
  return t(`interestGroup.approval.${value}`, value || "");
}

function sameKeySet(left, right) {
  const leftKeys = (left || []).map((item) => item.key).filter(Boolean).sort();
  const rightKeys = (right || []).map((item) => item.key).filter(Boolean).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index]);
}

function interestGroupStyle(group) {
  const hex = byInterestGroup.get(group?.key)?.color?.hex || group?.color?.hex || "";
  return hex ? `--interest-group-color:${escapeHtml(hex)}` : "";
}

function stateRegionTagPills(stateRegion) {
  return [
    victorianCenturyBadge(stateRegion),
    refPills(stateRegion.strategic_regions, "tag-region"),
    stateRegionMapiPill(stateRegion),
    stateTraitPills(stateRegion.traits, stateRegion, { showVictorianCenturyBadge: false }),
  ].filter(Boolean).join("");
}

function stateRegionMapiPill(stateRegion) {
  if (!(stateRegion.traits || []).some((trait) => trait.has_mapi)) return "";
  return tagPill("MAPI", "tag-mapi", "MAPI", "mapi-summary");
}

function companyKindText(company) {
  return t(`enum.companyKind.${companyKindKey(company)}`) || companyKindKey(company);
}

function companyKindKey(company) {
  if (company?.company_kind) return company.company_kind;
  if (company?.key === "company_paradox") return "easter_egg";
  return company?.flavored_company ? "historical" : "generic";
}

function prestigeGoodsKindKey(company) {
  if (company?.prestige_goods_kind) return company.prestige_goods_kind;
  const goods = company?.possible_prestige_goods || [];
  const hasGeneric = goods.some((item) => String(item?.key || "").startsWith("prestige_good_generic_"));
  const hasSpecial = goods.some((item) => item?.key && !String(item.key).startsWith("prestige_good_generic_"));
  if (!goods.length) return "none";
  if (hasGeneric && hasSpecial) return "mixed";
  if (hasGeneric) return "generic_only";
  return "special_only";
}

function companyDlcKey(company) {
  return company?.dlc_key || "base";
}

function companyDlcLabel(company) {
  return entityText(company, "dlcName") || t(`enum.companyDlc.${companyDlcKey(company)}`) || companyDlcKey(company);
}

function companyPrestigeLabel(company) {
  return t(`enum.prestigeGoodsKind.${prestigeGoodsKindKey(company)}`) || "";
}

function companyTagPills(company) {
  const categoryLabel = companyCategoryLabel(company);
  return [
    victorianCenturyBadge(company),
    limitedRefPills(company.referenced_strategic_regions, "tag-region", 4),
    limitedRefPills(company.referenced_geographic_regions, "tag-region", 3),
    categoryLabel ? tagPill(categoryLabel, "tag-company-ownership", company.category, `company-ownership-category:${company.category}`) : "",
    companyKindKey(company) === "easter_egg" ? tagPill(companyKindText(company), "tag-special") : "",
  ].filter(Boolean).join("");
}

function companyCategoryLabel(company) {
  if (!company?.category) return "";
  return entityText(company, "category", company.category) || company.category;
}

function companyMetaLine(company) {
  return [
    company.preferred_headquarters?.length ? `${t("board.company.headquarters", "总部倾向")}：${refNames(company.preferred_headquarters, " / ")}` : "",
    company.referenced_cultures?.length ? `${t("board.company.relatedCultures", "限定文化")}：${refNames(company.referenced_cultures, " / ")}` : "",
  ].filter(Boolean).join(t("ui.semicolon", "；"));
}

function companyDlcIconPill(company) {
  if (companyDlcKey(company) === "base") return "";
  const option = companyDlcOptions.find((item) => item.key === companyDlcKey(company));
  const label = companyDlcLabel(company);
  const key = companyDlcKey(company);
  return tagPill(
    label,
    "tag-dlc company-dlc-pill",
    key,
    `company-dlc:${key}`,
    option ? dlcIconHtml(option) : "",
  );
}

function companyPrestigeGoodsPills(company) {
  if (!(company.possible_prestige_goods || []).length) return "";
  return limitedHtmlItems((company.possible_prestige_goods || []).map((item) => companyPrestigeGoodPill(item)), 3);
}

function companyPrestigeGoodPill(item) {
  if (!item) return "";
  const key = item.key || "";
  const label = entityText(item) || key;
  return conceptPill({
    label,
    className: "tag-good prestige-good-pill",
    title: key,
    kind: "goods",
    key,
    category: t("board.company.prestigeGoods", "名贵商品"),
    description: t("board.company.prestigeGoodsDescription", { name: label }),
    html: `${goodsIconHtml(item, "prestige-good-icon")}<span>${escapeHtml(label)}</span>`,
  });
}

function goodsIconHtml(item, className = "prestige-good-icon") {
  const path = prestigeGoodIconPath(item?.key || "");
  if (!path) return "";
  return `<img class="${escapeHtml(className)}" src="${path}" alt="">`;
}

function prestigeGoodIconPath(key) {
  if (!key) return "";
  const override = prestigeGoodIconOverrides.get(key);
  const base = String(key).replace(/^prestige_good_/, "");
  const fileName = override || `${base}_prestige.png`;
  return `assets/prestige-goods/${encodeURIComponent(fileName)}`;
}

function companyBuildingStrip(company) {
  const main = (company.building_types || []).map((item) => companyBuildingPill(item));
  const extension = (company.extension_building_types || []).map((item) => companyBuildingPill(item, "extension-building-pill"));
  if (!main.length && !extension.length) return "";
  const separator = main.length && extension.length ? `<span class="company-building-separator" aria-hidden="true"></span>` : "";
  return `${main.join("")}${separator}${extension.join("")}`;
}

function companyBuildingPill(item, className = "") {
  const name = entityText(item) || item?.key || "";
  if (!name) return "";
  const classText = className ? ` ${className}` : "";
  const metadata = buildingTooltipMetadata(item);
  return conceptPill({
    label: name,
    className: `resource-pill image-pill company-building-pill${classText}`,
    title: item?.key || "",
    kind: "building",
    key: item?.key || "",
    category: metadata.category,
    description: metadata.description,
    html: buildingIconHtml(item?.key, name),
  });
}

function resourceSummaryPills(stateRegion) {
  const resourcePills = [
    ...(stateRegion.capped_resources || []).map((item) => resourcePill(item, item.amount)),
    ...(stateRegion.discoverable_resources || []).map((item) => {
      const amount = discoverableResourceAmount(item);
      return resourcePill(item, amount);
    }),
  ];
  return limitedHtmlItems(resourcePills, 6);
}

function stateRegionTooltipResourceHtml(stateRegion) {
  const resources = [
    ...(stateRegion?.capped_resources || []).map((item) => stateRegionTooltipResourceChip(item, item.amount)),
    ...(stateRegion?.discoverable_resources || []).map((item) => {
      const amount = discoverableResourceAmount(item);
      return stateRegionTooltipResourceChip(item, amount);
    }),
    ...(stateRegion?.arable_resources || []).map((item) => stateRegionTooltipResourceChip(item)),
  ].filter(Boolean);
  return resources.length ? `<span class="tooltip-resource-summary">${resources.join("")}</span>` : "";
}

function stateRegionTooltipResourceChip(item, amount = "") {
  const label = entityText(item) || item?.key || "";
  if (!label) return "";
  const icon = buildingIconHtml(item?.key);
  const count = amount !== "" && amount !== null ? `<span class="tooltip-resource-count">${escapeHtml(amount)}</span>` : "";
  const fallback = icon ? "" : `<span class="tooltip-resource-fallback">${escapeHtml(label)}</span>`;
  return `<span class="tooltip-resource-chip" aria-label="${escapeHtml(label)}">${icon}${fallback}${count}</span>`;
}

function agricultureSummaryPills(stateRegion) {
  const arableResources = (stateRegion.arable_resources || []).map((item) => buildingPill(item, "tag-arable"));
  return arableResources.join("");
}

function stateRegionBuildingStrip(stateRegion) {
  const resources = [
    ...(stateRegion.capped_resources || []).map((item) => buildingChip(item, item.amount, "resource-chip")),
    ...(stateRegion.discoverable_resources || []).map((item) => {
      const amount = discoverableResourceAmount(item);
      return buildingChip(item, amount, "resource-chip discoverable-chip");
    }),
  ];
  const agriculture = (stateRegion.arable_resources || []).map((item) => buildingChip(item, "", "resource-chip arable-chip"));
  const items = [...resources, ...agriculture].filter(Boolean);
  return items.length ? items.join("") : "";
}

function buildingChip(item, amount = "", className = "") {
  const name = entityText(item) || item?.key || "";
  const count = amount !== "" && amount !== null ? `<span class="building-chip-count">${escapeHtml(amount)}</span>` : "";
  const classText = className ? ` ${className}` : "";
  const defaults = TAG_TOOLTIP_DEFAULTS.building || {};
  const attrs = conceptDataAttributes({
    kind: "building",
    key: item?.key || name,
    label: name,
    search: name,
    category: defaults.category || "",
    description: formatTooltipDescription(defaults.description, { label: name, key: item?.key || name, category: defaults.category || "" }),
  });
  return `<span class="building-chip${classText}" ${attrs}>${buildingIconHtml(item?.key, name)}${count}</span>`;
}

function limitedHtmlItems(items, limit) {
  const filtered = (items || []).filter(Boolean);
  if (filtered.length <= limit) return filtered.join("");
  return `${filtered.slice(0, limit).join("")}${tagPill(t("ui.moreItems", { count: localizedNumber(filtered.length - limit) }), "tag-more")}`;
}

function sameTraditionCultures(traditions, groups) {
  const blocks = (traditions || []).map((tradition) => {
    const related = groups?.[tradition.key] || [];
    if (!related.length) return "";
    return `
      <div class="inline-block">
        <span class="minor">${escapeHtml(entityText(tradition))}</span>
        ${cultureLinks(related)}
      </div>
    `;
  }).filter(Boolean);
  return blocks.length ? blocks.join("") : "";
}

function dynamicNameList(country) {
  if (!(country.dynamicNameVariants || []).length) {
    return `<p class="empty compact">${escapeHtml(t("board.country.dynamic.noNames"))}</p>`;
  }
  return `<div class="rule-list">${country.dynamicNameVariants.map((variant) => `
    <article class="rule-item">
      <div class="rule-head">
        <strong>${escapeHtml(entityText(variant) || variant.name_key)}</strong>
        <span class="minor">${escapeHtml(variant.name_key)}</span>
      </div>
      <dl class="mini-grid">
        ${field(t("board.country.dynamic.adjective"), escapeHtml(entityText(variant, "adjective", "") || variant.adjective_key || ""))}
        ${field(t("board.country.dynamic.priority"), escapeHtml(variant.priority || "0"))}
        ${field(t("board.country.dynamic.revolutionary"), localizedBoolean(variant.is_revolutionary))}
        ${field(t("board.country.dynamic.references"), refsText(variant))}
      </dl>
      ${rawDetails(t("board.country.dynamic.conditionScript"), variant.trigger_raw)}
    </article>
  `).join("")}</div>`;
}

function dynamicStateNameList(stateRegion) {
  const variants = visibleDynamicStateNameVariants(stateRegion);
  if (!variants.length) {
    return `<p class="empty compact">${t("board.region.noNameVariants", "无地区名称变体。")}</p>`;
  }
  return `<div class="rule-list">${variants.map((variant) => `
    <article class="rule-item">
      <div class="rule-head">
        <strong>${escapeHtml(entityText(variant) || variant.name_key)}</strong>
        <span class="minor">${escapeHtml(variant.name_key)}</span>
      </div>
      <dl class="mini-grid">
        ${field(t("board.region.appliedName", "采用名称"), escapeHtml(entityText(variant) || variant.name_key || ""))}
        ${field(t("board.region.source", "来源"), escapeHtml(fileBaseName(variant.source_file)))}
      </dl>
      ${rawDetails(t("board.region.appliedCondition", "采用条件"), variant.trigger_raw)}
    </article>
  `).join("")}</div>`;
}

function dynamicMapColorList(country) {
  if (!(country.dynamicMapColorRules || []).length) {
    return `<p class="empty compact">${escapeHtml(t("board.country.dynamic.noMapColors"))}</p>`;
  }
  return `<div class="rule-list">${country.dynamicMapColorRules.map((rule) => `
    <article class="rule-item color-rule">
      <div class="rule-head">
        <span class="color-name">
          <span class="country-color" style="${colorStyle(rule.color_hex)}" aria-hidden="true"></span>
          <strong>${escapeHtml(rule.key)}</strong>
        </span>
        <span class="minor">${escapeHtml(rule.color_key)} ${escapeHtml(rule.color_hex)}</span>
      </div>
      <dl class="mini-grid">
        ${field(t("board.country.dynamic.color"), colorValue(rule.color_hex, splitNumbers(rule.color_rgb)))}
        ${field(t("board.country.dynamic.references"), refsText(rule))}
      </dl>
      ${rawDetails(t("board.country.dynamic.conditionScript"), rule.possible_raw)}
    </article>
  `).join("")}</div>`;
}

function countryFlagVariantSection(country) {
  const flagInfo = countryFlagData[country?.tag];
  const variants = flagInfo?.variants || [];
  if (!variants.length) return "";
  const body = `
    <div class="country-flag-variant-grid">
      ${variants.map((variant) => `
        <article class="country-flag-variant-card">
          <img class="country-flag-variant-image" src="${escapeHtml(variant.image)}" alt="${escapeHtml(countryFlagVariantAlt(country, variant))}">
          <div class="country-flag-variant-body">
            <div class="rule-head country-flag-variant-head">
              <strong>${escapeHtml(variant.key)}</strong>
              ${conceptTag(variant.exportKey || variant.key, "tag", `country-flag-variant:${variant.exportKey || variant.key}`)}
            </div>
            <dl class="mini-grid country-flag-variant-meta">
              ${field(t("board.country.dynamic.priority"), escapeHtml(String(variant.priority ?? 0)))}
              ${field(t("board.country.flags.trigger"), escapeHtml(localizedFlagTriggerSummary(variant.triggerSummary)))}
              ${field(t("board.country.flags.subjectCanton"), escapeHtml(variant.subjectCanton || ""))}
              ${field(t("board.country.flags.overlordCanton"), localizedBoolean(variant.allowOverlordCanton))}
            </dl>
            ${rawDetails(t("board.country.flags.triggerCondition"), variant.triggerRaw)}
          </div>
        </article>
      `).join("")}
    </div>
  `;
  return collapsibleDetailSection(t("board.country.flags.title"), body, t("board.country.flags.count", { count: localizedNumber(variants.length) }));
}

function countryFlagVariantAlt(country, variant) {
  const name = entityText(country) || country?.tag || t("board.country.flags.countryAlt");
  return `${name} ${variant.key || variant.exportKey || t("board.country.flags.flagAlt")}`;
}

function localizedFlagTriggerSummary(value) {
  const messageKey = {
    默认候选: "defaultCandidate",
    控制印度的一部分地区: "controlsPartOfIndia",
    使用英国旗帜: "usesBritishFlag",
    君主制: "monarchy",
    共和制: "republic",
    委员会共和制: "councilRepublic",
    神权制: "theocracy",
  }[value];
  return messageKey ? t(`board.country.flags.${messageKey}`) : value || t("board.country.flags.defaultCandidate");
}

function localizedBoolean(value) {
  if (value === true || value === "yes" || value === "是") return escapeHtml(t("ui.yes"));
  if (value === false || value === "no" || value === "否") return escapeHtml(t("ui.no"));
  return value == null ? "" : escapeHtml(String(value));
}

function refsText(rule) {
  const parts = [];
  if (rule.referenced_tags) parts.push(`${t("board.country.reference.country")}${t("ui.colon")}${rule.referenced_tags}`);
  if (rule.referenced_cultures) parts.push(`${t("board.country.reference.culture")}${t("ui.colon")}${rule.referenced_cultures}`);
  if (rule.referenced_laws) parts.push(`${t("board.country.reference.law")}${t("ui.colon")}${rule.referenced_laws}`);
  if (rule.referenced_journal_entries) parts.push(`${t("board.country.reference.journalEntry")}${t("ui.colon")}${rule.referenced_journal_entries}`);
  if (rule.referenced_variables) parts.push(`${t("board.country.reference.variable")}${t("ui.colon")}${rule.referenced_variables}`);
  return parts.length ? escapeHtml(parts.join(t("ui.clauseSeparator"))) : "";
}

function rawDetails(label, value) {
  if (!value) return "";
  return `
    <details class="script-details">
      <summary>${escapeHtml(label)}</summary>
      <pre>${escapeHtml(value)}</pre>
    </details>
  `;
}

function lawIconHtml(law, className = "law-icon") {
  const baseName = fileBaseName(law?.icon).replace(/\.dds$/i, "");
  if (!baseName) return "";
  const alt = escapeHtml(entityText(law, "name", t("board.law.title", "法律")));
  const path = `assets/laws/${encodeURIComponent(baseName)}.png`;
  return webpPreferredImageHtml({ className, path, alt, fallback: "this.hidden=true" });
}

function technologyIconHtml(technology, className = "technology-icon") {
  const fileName = fileBaseName(technology?.icon).replace(/\.dds$/i, ".webp");
  if (!fileName || fileName === fileBaseName(technology?.icon)) return "";
  const title = entityText(technology, "name", technology?.key || t("entity.technology", "科技"));
  return `<img class="${escapeHtml(className)}" src="assets/technologies/${encodeURIComponent(fileName)}" alt="" title="${escapeHtml(title)}" onerror="this.hidden=true">`;
}

function achievementIconHtml(achievement, className = "achievement-icon") {
  const key = achievement?.key || "";
  if (!key) return "";
  const title = entityText(achievement, "name", key);
  return `<img class="${escapeHtml(className)}" src="assets/achievements/${encodeURIComponent(key)}.webp" alt="" title="${escapeHtml(title)}" onerror="this.hidden=true">`;
}

function economyEntityIconHtml(entity, category, className = "economy-icon") {
  const key = entity?.key || "";
  const iconPath = entity?.icon?.site_path || "";
  if (!iconPath) return "";
  const fileName = fileBaseName(iconPath || entity?.icon?.source || "");
  const path = iconPath;
  if (fileName && !fileName.toLowerCase().endsWith(".webp")) return "";
  const title = entityText(entity, "name", key);
  return `<img class="${escapeHtml(className)}" src="${escapeHtml(path)}" alt="" title="${escapeHtml(title)}" onerror="this.hidden=true">`;
}

function lawPill(law) {
  if (!law?.key) return "";
  return conceptPill({
    label: entityText(law),
    className: "tag-law",
    title: law.key,
    kind: "law",
    key: law.key,
    href: conceptHref("law", law.key),
  });
}

function sortIdeologyRefsByType(left, right) {
  return orderValue(ideologyTypeOrder, ideologyTypeKey(ideologyByKey.get(left?.key) || left))
    - orderValue(ideologyTypeOrder, ideologyTypeKey(ideologyByKey.get(right?.key) || right))
    || sortRefByName(left, right);
}

function lawPills(keys) {
  const pills = (keys || []).map((key) => lawPill(lawByKey.get(key) || { key })).filter(Boolean);
  return pills.length ? `<span class="link-list">${pills.join("")}</span>` : "";
}

function collapsibleDetailSection(title, html, meta = "") {
  const body = String(html || "").trim();
  if (!body) return "";
  return `
    <details class="collapsible-detail-section">
      <summary>
        <span>${escapeHtml(title)}</span>
        ${meta ? `<small>${escapeHtml(meta)}</small>` : ""}
      </summary>
      <div class="collapsible-detail-body">${body}</div>
    </details>
  `;
}

function buildingIconHtml(key) {
  const fileName = buildingIconFileByKey[key];
  if (!fileName) return "";
  const path = `assets/buildings/${encodeURIComponent(fileName)}`;
  return `<img class="resource-icon" src="${path}" alt="">`;
}

function companyIconHtml(company) {
  const label = entityText(company) || company?.key || t("entity.company", "公司");
  const title = [label, company?.icon].filter(Boolean).join("；");
  const path = companyIconPath(company?.icon);
  if (!path) return `<span class="company-icon-placeholder" title="${escapeHtml(title)}">司</span>`;
  return webpPreferredImageHtml({ className: "company-logo", path, alt: "", title });
}

function companyIconPath(icon) {
  const sourceName = fileBaseName(icon);
  const baseName = sourceName.replace(/\.dds$/i, ".png");
  if (!baseName || !/\.(?:dds|png)$/i.test(sourceName)) return "";
  return `assets/companies/${encodeURIComponent(baseName)}`;
}

function countryFlagIconHtml(country, className = "country-flag-inline") {
  const image = countryDefaultFlagImage(country);
  if (!image) return "";
  const label = entityText(country) || country?.tag || "country";
  const tag = country?.tag || "";
  const title = [label, tag].filter(Boolean).join(" ");
  return `<img class="${escapeHtml(className)}" src="${escapeHtml(image)}" alt="" title="${escapeHtml(title)}">`;
}

function countryDefaultFlagImage(country) {
  const tag = country?.tag || country?.key || "";
  if (!tag) return "";
  const variants = countryFlagData[tag]?.variants || [];
  return variants.find((variant) => variant.key === tag)?.image || variants[0]?.image || "";
}

function ideologyIconHtml(ideology, className = "ideology-icon") {
  const label = entityText(ideology, "name", t("board.ideology.title", "意识形态"));
  const title = [label, ideology?.key].filter(Boolean).join("；");
  const path = ideologyIconPath(ideology?.icon);
  if (!path) return `<span class="${escapeHtml(className)} ideology-icon-placeholder" title="${escapeHtml(title)}"></span>`;
  return webpPreferredImageHtml({ className, path, alt: "", title, fallback: "this.onerror=null;this.src='assets/ideologies/no_ideology.png'" });
}

function webpPreferredImageHtml({ className, path, alt, title = "", fallback = "" }) {
  const escapedClass = escapeHtml(className);
  const escapedPath = escapeHtml(path);
  const escapedAlt = escapeHtml(alt);
  const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
  const fallbackAttribute = fallback ? ` onerror="${escapeHtml(fallback)}"` : "";
  if (!standaloneWebpAssetPaths.has(path)) {
    return `<img class="${escapedClass}" src="${escapedPath}" alt="${escapedAlt}"${titleAttribute}${fallbackAttribute}>`;
  }
  const webpPath = escapeHtml(path.replace(/\.png$/i, ".webp"));
  return `<picture><source srcset="${webpPath}" type="image/webp"><img class="${escapedClass}" src="${escapedPath}" alt="${escapedAlt}"${titleAttribute}${fallbackAttribute}></picture>`;
}

function ideologyIconPath(icon) {
  const baseName = fileBaseName(icon).replace(/\.dds$/i, ".png");
  if (!baseName || baseName === fileBaseName(icon)) return "";
  return `assets/ideologies/${encodeURIComponent(baseName)}`;
}

function interestGroupIconHtml(group, className = "interest-group-icon") {
  const label = entityText(group, "name", t("board.ideology.interestGroup", "利益集团"));
  const path = interestGroupIconPath(group?.texture);
  if (!path) return `<span class="${escapeHtml(className)} interest-group-icon-placeholder" title="${escapeHtml(label)}"></span>`;
  return `<img class="${escapeHtml(className)}" src="${path}" alt="" title="${escapeHtml(label)}">`;
}

function interestGroupIconPath(texture) {
  const baseName = fileBaseName(texture).replace(/\.dds$/i, ".webp");
  if (!baseName || baseName === fileBaseName(texture)) return "";
  return `assets/interest-groups/${encodeURIComponent(baseName)}`;
}

function dlcIconHtml(option) {
  if (!option?.icon) return "";
  return `<img class="dlc-icon" src="assets/dlc/${encodeURIComponent(option.icon)}" alt="">`;
}

function fileBaseName(file) {
  return String(file || "").split(/[\\/]/).pop() || "";
}

function colorValue(hex, rgb) {
  if (!hex) return "";
  const hexText = String(hex).toUpperCase();
  const rgbText = Array.isArray(rgb) && rgb.length ? `RGB ${rgb.join(", ")}` : "";
  return `
    <span class="color-value">
      <span class="country-color" style="${colorStyle(hex)}" aria-hidden="true"></span>
      <span>${escapeHtml(hexText)}</span>
      <span class="minor">${escapeHtml(rgbText)}</span>
    </span>
  `;
}

function colorStyle(hex) {
  return hex ? `background:${escapeHtml(hex)}` : "";
}

function countryBorderStyle(hex) {
  return hex ? `--country-color:${escapeHtml(hex)}` : "";
}

function countryNameText(country) {
  const variants = countryVariantNames(country);
  const suffix = variants.length
    ? `<span class="name-variants">（${escapeHtml(variants.join("/"))}）</span>`
    : "";
  return `${escapeHtml(entityText(country) || country.name || country.tag || "")}${suffix}`;
}

function stateRegionNameText(stateRegion) {
  const variants = stateRegionVariantNames(stateRegion);
  const suffix = variants.length
    ? `<span class="name-variants">（${escapeHtml(variants.join("/"))}）</span>`
    : "";
  return `${escapeHtml(entityText(stateRegion) || stateRegion.key)}${suffix}`;
}

function countryVariantNames(country) {
  const names = [];
  const seen = new Set([entityText(country) || country.name || country.tag || ""]);
  for (const variant of country.dynamicNameVariants || []) {
    const name = entityText(variant) || variant.name_key || "";
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

function stateRegionVariantNames(stateRegion) {
  return visibleDynamicStateNameVariants(stateRegion).map((variant) => entityText(variant) || variant.name_key);
}

function conditionDetails(label, condition) {
  if (!condition) return "";
  const summary = renderTextSpec({
    message: condition.loc?.summary || condition.loc?.conditionSummary,
    fallback: t("board.law.scriptCondition", "脚本条件"),
  });
  return `${summary ? `<p><strong>${escapeHtml(label)}：</strong>${escapeHtml(summary)}</p>` : ""}${rawDetails(label, condition.raw || condition.condition_raw)}`;
}

function visibleDynamicStateNameVariants(stateRegion) {
  const seen = new Set([entityText(stateRegion) || stateRegion.key]);
  const visible = [];
  for (const variant of stateRegion.dynamic_name_variants || []) {
    const name = entityText(variant, "name", "");
    if (!name || name === variant.name_key || seen.has(name)) continue;
    seen.add(name);
    visible.push(variant);
  }
  return visible;
}

function countryCapitalText(country) {
  const capital = entityText(byStateRegion.get(country.capital), "name", country.capital) || country.capital || t("ui.none");
  const stateRegion = byStateRegion.get(country.capital);
  const strategicRegionNames = (stateRegion?.strategic_regions || [])
    .map((region) => t("board.country.strategicRegionSummary", { name: strategicRegionName(byStrategicRegion.get(region.key) || region) }));
  const suffix = strategicRegionNames.length ? t("ui.parenthetical", { value: strategicRegionNames.join(t("ui.listSeparator")) }) : "";
  return escapeHtml(t("board.country.capitalSummary", { capital, suffix }));
}

function stateRegionSummaryText(stateRegion) {
  return t("board.region.startingOwnersSummary", { owners: countryRefNames(stateRegion.starting_owners) });
}

function refNames(items, separator = t("ui.listSeparator")) {
  const names = (items || []).map(refName).filter(Boolean);
  return names.length ? names.join(separator) : t("ui.none");
}

function refName(item) {
  if (!item) return "";
  if (item.tag) return countryRefLabel(item);
  if (item.key && byStrategicRegion.has(item.key)) return strategicRegionName(byStrategicRegion.get(item.key));
  if (item.key && byStateRegion.has(item.key)) return entityText(byStateRegion.get(item.key)) || item.key;
  return entityText(item);
}

function countryNameWithTag(tag) {
  return countryRefLabel({ tag });
}

function countryRefNames(items, separator = t("ui.listSeparator")) {
  const names = (items || []).map(countryRefLabel).filter(Boolean);
  return names.length ? names.join(separator) : t("ui.none");
}

function countryRefLabel(item) {
  if (!item) return "";
  const tag = item.tag || item.key || "";
  if (!tag) return "";
  const country = byTag.get(tag);
  const name = entityText(item) || entityText(country) || tag;
  return `${name}(${tag})`;
}

function strategicRegionName(region) {
  const rawName = entityText(region) || region?.key || "";
  if (!isWrappedLocalizationKey(rawName)) return rawName;
  const stateKey = rawName.slice(1, -1);
  const stateRegion = byStateRegion.get(stateKey);
  return entityText(stateRegion) || stateKey || rawName;
}

function isSeaStrategicRegion(region) {
  return String(region?.source_file || "").includes("water_strategic_regions")
    || isWrappedLocalizationKey(entityText(region));
}

function isSeaStateRegion(stateRegion) {
  return seaStateRegionKeys.has(stateRegion?.key);
}

function isWrappedLocalizationKey(value) {
  return typeof value === "string" && value.length > 2 && value.startsWith("$") && value.endsWith("$");
}

function stateRegionBorderStyle(stateRegion) {
  const regionKey = stateRegion.strategic_regions?.[0]?.key;
  const hex = byStrategicRegion.get(regionKey)?.map_color?.hex || "";
  return countryBorderStyle(hex);
}

function firstStrategicRegionOrder(stateRegion) {
  const values = (stateRegion.strategic_regions || []).map((region) => orderValue(strategicRegionOrderByKey, region.key));
  return values.length ? Math.min(...values) : Number.MAX_SAFE_INTEGER;
}

function stateRegionResourceCount(stateRegion) {
  return (stateRegion.arable_resources || []).length
    + (stateRegion.capped_resources || []).length
    + (stateRegion.discoverable_resources || []).length;
}

function buildStateKeyByProvinceColor() {
  const map = new Map();
  for (const stateRegion of stateRegions) {
    for (const color of stateRegion.province_colors || []) {
      map.set(normalizeProvinceColorKey(color), stateRegion.key);
    }
  }
  return map;
}

function stateRegionResourceValue(stateRegion, resourceKey) {
  const capped = (stateRegion.capped_resources || []).find((item) => item.key === resourceKey);
  if (capped) {
    return {
      value: Number(capped.amount || 0),
      detail: String(capped.amount || 0),
    };
  }
  const discoverable = (stateRegion.discoverable_resources || []).find((item) => item.key === resourceKey);
  if (discoverable) {
    const amount = discoverableResourceAmount(discoverable, 0);
    return {
      value: Number(amount || 0),
      detail: String(amount || 0),
    };
  }
  const arable = (stateRegion.arable_resources || []).find((item) => item.key === resourceKey);
  if (arable) {
    const arableLand = Number(stateRegion.arable_land || 0);
    return {
      value: arableLand || 1,
      detail: arableLand ? `耕地 ${arableLand}` : "可建",
    };
  }
  return {
    value: 0,
    detail: "",
  };
}

function cultureRelationForStateRegion(stateRegion, selectedCulture) {
  if (!selectedCulture) return { rank: 0, label: "未选择文化" };
  if (isSeaStateRegion(stateRegion)) return { rank: 0, label: "海域" };
  const homelands = stateRegion.homeland_cultures || [];
  if (homelands.some((cultureRef) => cultureRef.key === selectedCulture.key)) {
    return { rank: 5, label: t("map.cultureRelation.homeland", { culture: entityText(selectedCulture) }) };
  }
  let best = { rank: 0, label: "无关系" };
  for (const cultureRef of homelands) {
    const culture = byCulture.get(cultureRef.key);
    if (!culture) continue;
    const relation = cultureRelation(selectedCulture, culture);
    if (relation.rank > best.rank) best = relation;
  }
  return best;
}

function cultureRelation(selectedCulture, culture) {
  if (selectedCulture.language?.key && selectedCulture.language.key === culture.language?.key) {
    return { rank: 4, label: t("map.cultureRelation.sameLanguage", { culture: entityText(culture) }) };
  }
  if (selectedCulture.language_group?.key && selectedCulture.language_group.key === culture.language_group?.key) {
    return { rank: 3, label: t("map.cultureRelation.sameLanguageGroup", { culture: entityText(culture) }) };
  }
  if (selectedCulture.heritage?.key && selectedCulture.heritage.key === culture.heritage?.key) {
    return { rank: 2, label: t("map.cultureRelation.sameHeritage", { culture: entityText(culture) }) };
  }
  if (selectedCulture.heritage_group?.key && selectedCulture.heritage_group.key === culture.heritage_group?.key) {
    return { rank: 1, label: t("map.cultureRelation.sameHeritageGroup", { culture: entityText(culture) }) };
  }
  return { rank: 0, label: "无关系" };
}

function cultureRelationColor(rank, isSea) {
  if (isSea) return MAP_SEA_COLOR;
  if (rank === 5) return "#1f5f8b";
  if (rank === 4) return "#238a7d";
  if (rank === 3) return "#77b9a8";
  if (rank === 2) return "#8a5a9e";
  if (rank === 1) return "#cab6dc";
  return "#eee9df";
}

function mapModeLabel(mode) {
  if (mode === "country") return "开局归属";
  if (mode === "strategicRegion") return "战略区域";
  if (mode === "terrain") return t("map.terrainView", "地形视图");
  if (mode === "company") return "公司关联";
  if (mode === "cultureFilter") return "文化筛选";
  if (mode === "resourceSelection") return "资源潜力";
  if (mode === "culture") return "文化关系";
  if (mode === "trait") return "地区特质";
  return "资源潜力";
}

function mapSubjectLabel() {
  const option = mapSubjectOptions(state.mapMode).find((item) => item.value === state.mapSubject);
  return option?.label || state.mapSubject || "";
}

function automaticMapSubjectLabel(mode) {
  if (mode === "country") return "开局归属";
  if (mode === "company") return "当前公司列表";
  if (mode === "cultureFilter") return cultureFilterMapLabel();
  if (mode === "resourceSelection") return selectedResourceMapLabel();
  return mapModeLabel(mode);
}

function selectedResourceMapLabel() {
  const labels = [...state.resourceFilters]
    .map((key) => resourceFilterLabel(resourceFilterByKey.get(key)))
    .filter(Boolean);
  if (!labels.length) return t("filter.strategicRegions");
  return labels.length > 3
    ? `${labels.slice(0, 3).join(t("ui.listSeparator"))}${t("ui.listSeparator")}${t("ui.moreItems", { count: labels.length - 3 })}`
    : labels.join(t("ui.listSeparator"));
}

function cultureFilterMapLabel() {
  const labels = [
    ...selectedTraitFilterLabels(state.heritageGroups, "传承组"),
    ...selectedTraitFilterLabels(state.heritages, "传承"),
    ...selectedTraitFilterLabels(state.languageGroups, "语言组"),
    ...selectedTraitFilterLabels(state.languages, "语言"),
  ];
  if (state.tradition) {
    const tradition = cultureTraitByKey.get(state.tradition);
    labels.push(t("map.cultureRelation.tradition", { tradition: entityText(tradition) || state.tradition }));
  }
  if (!labels.length) return "未选择文化特质";
  return labels.length > 3 ? `${labels.slice(0, 3).join("、")}等 ${labels.length} 项` : labels.join("、");
}

function selectedTraitFilterLabels(values, prefix) {
  return [...values].map((key) => {
    const trait = cultureTraitByKey.get(key);
    return `${prefix}：${entityText(trait) || key}`;
  });
}

function formatMapLabelValue(value) {
  return Number.isFinite(Number(value)) ? String(Number(value)) : String(value || "");
}

function normalizeProvinceColorKey(value) {
  const match = String(value || "").trim().match(/^x?([0-9a-fA-F]{6})$/);
  return match ? `x${match[1].toUpperCase()}` : "";
}

function rgbToProvinceColor(r, g, b) {
  return `x${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function interpolateColor(fromHex, toHex, amount) {
  const from = hexToRgb(fromHex);
  const to = hexToRgb(toHex);
  const ratio = clampNumber(amount, 0, 1);
  const rgb = from.map((value, index) => Math.round(value + (to[index] - value) * ratio));
  return rgbToHexString(rgb);
}

function hexToRgb(hex) {
  const value = String(hex || "#000000").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return [0, 0, 0];
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHexString(rgb) {
  return `#${rgb.map((value) => clampNumber(value, 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function searchPlaceholder() {
  if (state.view === "culture") return t("board.culture.searchPlaceholder");
  if (state.view === "character") return t("board.character.searchPlaceholder");
  if (state.view === "name-pool") return t("board.namePool.searchPlaceholder");
  if (state.view === "region") return t("board.region.searchPlaceholder");
  if (state.view === "company") return t("board.company.searchPlaceholder");
  if (state.view === "ideology") return t("board.ideology.searchPlaceholder");
  if (state.view === "law") return t("board.law.searchPlaceholder");
  return t("board.country.searchPlaceholder");
}

function unitColorText(country) {
  const values = [
    country.primaryUnitColor && t("board.country.unitColor.primary", { value: country.primaryUnitColor }),
    country.secondaryUnitColor && t("board.country.unitColor.secondary", { value: country.secondaryUnitColor }),
    country.tertiaryUnitColor && t("board.country.unitColor.tertiary", { value: country.tertiaryUnitColor }),
  ].filter(Boolean);
  return values.length ? escapeHtml(values.join(t("ui.listSeparator"))) : "";
}

function splitNumbers(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/\s+/).map(Number).filter(Number.isFinite);
}

function countrySearchBlob(country) {
  return [
    country.tag,
    country.capital,
    country.countryType,
    countryTypeTagLabel(country),
    country.tier,
    country.isDualHeritage === "是" ? "双传承" : "",
    country.religion,
    ...country.primaryCultures,
    ...refSearchParts(country.primaryCultureHeritageGroups),
    ...refSearchParts(country.primaryCultureHeritages),
    ...refSearchParts(country.primaryCultureLanguageGroups),
    ...refSearchParts(country.primaryCultureLanguages),
    ...refSearchParts(country.primaryCultureTraditions),
    ...refSearchParts(country.primaryCultureHomelandStrategicRegions),
    ...refSearchParts(country.primaryCultureHomelandStateRegions),
    ...refSearchParts(country.locationStrategicRegions),
    ...refSearchParts(country.locationStateRegions),
    ...refSearchParts(country.formationStrategicRegions),
    ...refSearchParts(country.formationStateRegions),
    ...country.startingStates,
    ...country.formationStates,
    ...country.releaseStates,
    ...country.canFormTags,
    country.specialMechanic,
    ...(country.specialTags || []),
    country.colorHex,
    ...(country.dynamicNameVariants || []).flatMap((variant) => [
      variant.name_key,
      variant.adjective_key,
      entityText(variant),
      entityText(variant, "adjective", ""),
      variant.referenced_tags,
      variant.referenced_cultures,
      variant.referenced_laws,
      variant.referenced_journal_entries,
      variant.referenced_variables,
    ]),
  ].join(" ").toLowerCase();
}

function cultureSearchBlob(culture) {
  return [
    culture.key,
    culture.religion?.key,
    ...refSearchParts([culture.heritage_group, culture.heritage, culture.language_group, culture.language]),
    ...refSearchParts(culture.traditions),
    ...refSearchParts(culture.homeland_strategic_regions),
    ...refSearchParts(culture.homeland_state_regions),
    ...refSearchParts(culture.related_countries),
    ...refSearchParts(culture.obsessions),
    ...refSearchParts(culture.taboos),
  ].join(" ").toLowerCase();
}

function stateRegionSearchBlob(stateRegion) {
  return [
    ...searchNames(stateRegion.id || `state_region:${stateRegion.key}`),
    entityText(stateRegion),
    stateRegion.numeric_id,
    stateRegion.subsistence_building,
    ...refSearchParts(stateRegion.strategic_regions),
    ...refSearchParts(stateRegion.starting_owners),
    ...refSearchParts(stateRegion.homeland_cultures),
    ...refSearchParts(stateRegion.traits),
    ...stateTraitSearchParts(stateRegion.traits),
    ...dynamicStateNameSearchParts(stateRegion.dynamic_name_variants),
    ...refSearchParts(stateRegion.arable_resources),
    ...resourceSearchParts(stateRegion.capped_resources),
    ...resourceSearchParts(stateRegion.discoverable_resources),
  ].join(" ").toLowerCase();
}

function strategicRegionSearchBlob(region) {
  return [
    ...searchNames(region.id || `strategic_region:${region.key}`),
    strategicRegionName(region),
    region.capital_province,
    ...refSearchParts(region.states),
    ...refSearchParts(region.homeland_cultures),
    ...refSearchParts(region.starting_owners),
  ].join(" ").toLowerCase();
}

function geographicRegionSearchBlob(region) {
  return [
    ...searchNames(region.id || `geographic_region:${region.key}`),
    geographicRegionDisplayName(region),
    ...refSearchParts(geographicRegionStrategicRegions(region)),
    ...refSearchParts(geographicRegionStateRegions(region)),
  ].join(" ").toLowerCase();
}

function geographicRegionDisplayName(region) {
  return entityText(region) || region?.key || "";
}

function companySearchBlob(company) {
  return [
    ...searchNames(company.id || `company:${company.key}`),
    entityText(company),
    entityText(company, "description"),
    company.category,
    companyKindText(company),
    companyPrestigeLabel(company),
    companyDlcLabel(company),
    company.source_file,
    ...refSearchParts(company.preferred_headquarters),
    ...refSearchParts(company.referenced_state_regions),
    ...refSearchParts(company.referenced_strategic_regions),
    ...refSearchParts(company.referenced_geographic_regions),
    ...refSearchParts(company.referenced_cultures),
    ...refSearchParts(company.referenced_countries),
    ...refSearchParts(company.building_types),
    ...refSearchParts(company.extension_building_types),
    ...refSearchParts(company.referenced_buildings),
    ...refSearchParts(company.possible_prestige_goods),
    ...refSearchParts(company.required_technologies),
    ...refSearchParts(company.ai_will_do_technologies),
    company.potential_raw,
    company.attainable_raw,
    company.possible_raw,
    company.prestige_goods_trigger_raw,
    company.ai_will_do_raw,
  ].join(" ").toLowerCase();
}

function ideologySearchBlob(ideology) {
  const typeKey = ideologyTypeKey(ideology);
  return [
    ...searchNames(ideology.id || `ideology:${ideology.key}`),
    entityText(ideology),
    cleanIdeologyDescription(entityText(ideology, "description", "")),
    ideologyTypeLabel(typeKey),
    fileBaseName(ideology.source_file),
    ...refSearchParts(ideology.unlock_technologies),
    ...refSearchParts(ideology.unlock_journal_entries),
    ...(ideology.unlock_sources || []).flatMap((source) => [
      source.source_key,
      entityText(source, "sourceName", source.source_key),
      fileBaseName(source.source_file),
      renderTextSpec({ message: source.loc?.conditionSummary, fallback: "" }),
    ]),
    ideology.flavor_definition_status,
    renderTextSpec({ message: ideology.loc?.flavorDefinitionNote, fallback: "" }),
    ...ideologyWeightSearchParts(ideology),
    ...refSearchParts(ideologyInterestGroupRefs(ideology)),
    ...refSearchParts(ideologyOccurrenceRefs(ideology)),
    ...lawStanceSearchParts(ideology.law_stances),
  ].join(" ").toLowerCase();
}

function lawSearchBlob(law) {
  const group = lawGroupByKey.get(law.group_key);
  return [
    ...searchNames(law.id || `law:${law.key}`),
    entityText(law),
    law.group_key,
    entityText(group || law, group ? "name" : "groupName", law.group_key),
    law.progressiveness,
    entityText(law, "modifierSummary", ""),
    law.parent,
    ...(law.disallowing_laws || []),
    ...(law.modifiers || []).flatMap((modifier) => [modifier.key, entityText(modifier), entityText(modifier, "description", ""), renderTextSpec({ message: modifier.loc?.summary, fallback: "" })]),
    ...conditionSearchParts(law.can_enact),
    ...conditionSearchParts(law.is_visible),
    ...conditionSearchParts(group?.enable),
    ...conditionSearchParts(group?.change_allowed_trigger),
  ].filter(Boolean).join(" ").toLowerCase();
}

function ideologyWeightSearchParts(ideology) {
  return [
    ...conditionSearchParts(ideology.character_requirements?.country),
    ...conditionSearchParts(ideology.character_requirements?.interest_group_leader),
    ...conditionSearchParts(ideology.character_requirements?.non_interest_group_leader),
    ...weightSearchParts(ideology.interest_group_leader_weight),
    ...weightSearchParts(ideology.non_interest_group_leader_weight),
  ];
}

function weightSearchParts(weight) {
  return (weight?.entries || []).flatMap((entry) => [
    entry.kind,
    entry.value,
    entry.desc,
    renderTextSpec({ message: entry.loc?.conditionSummary, fallback: "" }),
    ...conditionSearchParts(entry),
  ]);
}

function conditionSearchParts(condition) {
  if (!condition) return [];
  return [
    renderTextSpec({ message: condition.loc?.summary, fallback: "" }),
    renderTextSpec({ message: condition.loc?.conditionSummary, fallback: "" }),
    ...refSearchParts(condition.interest_groups),
    ...refSearchParts(condition.laws),
    ...refSearchParts(condition.technologies),
    ...refSearchParts(condition.journal_entries),
    ...refSearchParts(condition.traits),
    ...(condition.variables || []),
  ];
}

function lawStanceSearchParts(stances) {
  return (stances || []).flatMap((stance) => [
    stance?.law_group_key,
    entityText(lawGroupByKey.get(stance?.law_group_key) || stance, lawGroupByKey.has(stance?.law_group_key) ? "name" : "lawGroupName", stance?.law_group_key),
    stance?.law_key,
    entityText(lawByKey.get(stance?.law_key) || stance, lawByKey.has(stance?.law_key) ? "name" : "lawName", stance?.law_key),
    stance?.stance,
    lawStanceLabel(stance?.stance),
  ]).filter(Boolean);
}

function refSearchParts(items) {
  return (items || []).flatMap((item) => [
    ...searchNames(item?.id || item?.key || item?.tag || ""),
    item?.key,
    item?.tag,
    entityText(item),
    item?.group_key,
    entityText(item, "groupName", ""),
  ]).filter(Boolean);
}

function resourceSearchParts(items) {
  return (items || []).flatMap((item) => [
    item?.key,
    entityText(item),
    item?.amount,
    item?.discovered_amount,
    item?.undiscovered_amount,
  ]).filter(Boolean);
}

function stateTraitSearchParts(traits) {
  return (traits || []).flatMap((trait) => [
    entityText(trait, "category", ""),
    entityText(trait, "modifierSummary", ""),
    trait?.has_mapi ? "MAPI" : "",
    ...(trait?.categories || []).flatMap((category) => [category.key, entityText(category)]),
    ...(trait?.modifiers || []).flatMap((modifier) => [
      modifier.key,
      entityText(modifier),
      entityText(modifier, "description", ""),
      entityText(modifier, "valueDisplay", ""),
      entityText(modifier, "summary", ""),
    ]),
  ]).filter(Boolean);
}

function dynamicStateNameSearchParts(variants) {
  return (variants || []).flatMap((variant) => [
    variant.name_key,
    entityText(variant),
    variant.trigger_raw,
  ]).filter(Boolean);
}

function resourceOptionToken(filter) {
  const label = filter.labelKey ? t(filter.labelKey) : resourceFilterLabel(filter);
  const checked = state.resourceFilters.has(filter.key);
  const icon = resourceFilterIconHtml(filter, label);
  return `
    <button class="filter-token filter-token-with-icon resource-filter-token" type="button" data-filter-token data-resource-filter="${escapeHtml(filter.key)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" aria-pressed="${checked ? "true" : "false"}">
      ${icon || escapeHtml(label)}
    </button>
  `;
}

function resourceFilterIconHtml(filter, label) {
  if (filter?.icon) return `<img class="resource-icon resource-filter-pop-icon" src="assets/${escapeHtml(filter.icon)}" alt="">`;
  const iconKey = (filter?.resources || filter?.arableResources || filter?.companyBuildings || [])[0] || "";
  return buildingIconHtml(iconKey, label);
}

function resourceFilterLabel(filter) {
  if (filter?.labelKey) return t(filter.labelKey);
  const resourceKey = (filter?.resources || filter?.arableResources || filter?.companyBuildings || [])[0] || filter?.key || "";
  return entityText(buildingByKey.get(resourceKey), "name", resourceKey) || resourceKey;
}

function companyDlcOptionToken(option, checked = false) {
  const title = `${t(`enum.companyDlc.${option.key}`)} / ${option.title || option.key}`;
  return `
    <button class="filter-token filter-token-with-icon dlc-filter-token" type="button" data-filter-token data-company-dlc="${escapeHtml(option.key)}" aria-label="${escapeHtml(title)}" title="${escapeHtml(title)}" aria-pressed="${checked ? "true" : "false"}">
      ${dlcIconHtml(option)}
    </button>
  `;
}

function optionToken(kind, value, label, checked = false, extraClass = "") {
  const classText = extraClass ? ` ${extraClass}` : "";
  return `<button class="filter-token${classText}" type="button" data-filter-token data-${kind}="${escapeHtml(value)}" aria-pressed="${checked ? "true" : "false"}">${escapeHtml(label)}</button>`;
}

function buildActiveHint(count) {
  const parts = [];
  const addCount = (labelKey, value) => value && parts.push(t("filter.active.count", { label: t(labelKey), count: localizedNumber(value) }));
  if (state.search) parts.push(t("filter.active.search", { value: state.search }));
  if (state.globalSearch) parts.push(t("filter.active.global", { value: state.globalSearch }));
  if (state.view === "country") addCount("filter.active.status", state.flags.size);
  if (state.view === "country") addCount("filter.active.tier", state.tiers.size);
  if (state.view === "country") addCount("filter.active.type", state.types.size);
  if (state.view !== "ideology" && state.strategicRegions.size) {
    addCount(state.view === "culture" ? "filter.homelandStrategicRegions" : state.view === "company" ? "filter.relatedStrategicRegions" : "filter.strategicRegions", state.strategicRegions.size);
  }
  if (["country", "culture"].includes(state.view)) addCount("filter.active.heritageGroup", state.heritageGroups.size);
  if (["country", "culture"].includes(state.view)) addCount("filter.active.heritage", state.heritages.size);
  if (["country", "culture"].includes(state.view)) addCount("filter.active.languageGroup", state.languageGroups.size);
  if (["country", "culture"].includes(state.view)) addCount("filter.active.language", state.languages.size);
  if ((state.view === "region" || state.view === "company") && state.resourceFilters.size) {
    addCount(state.view === "company" ? "filter.active.buildings" : "filter.resources", state.resourceFilters.size);
  }
  if (state.view === "region" && state.stateTraitFilters.size) {
    const count = state.stateTraitFilters.has("all") ? t("filter.active.all") : localizedNumber(state.stateTraitFilters.size);
    parts.push(t("filter.active.stateTraits", { count }));
  }
  if (state.view === "company") addCount("filter.active.companyType", state.companyKinds.size);
  if (state.view === "company" && state.includeIndustryCharter) parts.push(t("filter.active.industryCharter"));
  if (state.view === "company") addCount("filter.active.prestigeGoods", state.companyPrestigeGoods.size);
  if (state.view === "company") addCount("filter.active.dlc", state.companyDlcs.size);
  if (state.view === "ideology") addCount("filter.active.type", state.ideologyTypes.size);
  if (state.view === "ideology") addCount("filter.active.interestGroup", state.ideologyGroups.size);
  if (state.view === "ideology") addCount("filter.active.occurrence", state.ideologyOccurrences.size);
  if (state.view === "ideology") addCount("filter.active.lawGroup", state.ideologyLawGroups.size);
  if (state.view === "law") addCount("filter.active.lawGroup", state.lawGroups.size);
  if (["country", "culture"].includes(state.view) && state.tradition) parts.push(t("filter.active.tradition", { value: getTraitName(state.tradition) }));
  return parts.join(t("ui.listSeparator"));
}

function getTraitName(key) {
  return entityText(cultureTraitByKey.get(key)) || key;
}

function toggleSet(set, value, checked) {
  if (!value) return;
  if (checked) set.add(value);
  else set.delete(value);
}

function setTokenPressed(button, pressed) {
  if (!button) return;
  button.setAttribute("aria-pressed", String(pressed));
}

function syncTokenGroup(container, selectedValue) {
  if (!container) return;
  container.querySelectorAll("[data-filter-token]").forEach((button) => {
    const tokenValue = Object.entries(button.dataset)
      .find(([key]) => key !== "filterToken")?.[1] || "";
    setTokenPressed(button, tokenValue === selectedValue);
  });
}

function syncSetWithOptions(set, options) {
  const allowed = new Set((options || []).map((item) => item.key));
  for (const key of [...set]) {
    if (!allowed.has(key)) {
      set.delete(key);
    }
  }
}

function compactRefs(items) {
  return (items || []).filter((item) => item?.key);
}

function unique(values) {
  return [...new Set(values)];
}

function uniqueByKey(items) {
  const byKey = new Map();
  for (const item of items || []) {
    if (item?.key && !byKey.has(item.key)) byKey.set(item.key, item);
  }
  return [...byKey.values()];
}

function sortRefByName(a, b) {
  return localizedCompare(entityText(a), entityText(b)) || (a.key || a.tag).localeCompare(b.key || b.tag);
}

function sortStrategicRegionRef(a, b) {
  return orderValue(strategicRegionOrderByKey, a.key) - orderValue(strategicRegionOrderByKey, b.key)
    || localizedCompare(strategicRegionName(a), strategicRegionName(b))
    || a.key.localeCompare(b.key);
}

function sortHeritageGroupRef(a, b) {
  return orderValue(heritageGroupOrderByKey, a.key) - orderValue(heritageGroupOrderByKey, b.key) || sortRefByName(a, b);
}

function sortLanguageGroupRef(a, b) {
  return languageGroupSortBucket(a) - languageGroupSortBucket(b) || sortRefByName(a, b);
}

function languageGroupSortBucket(ref) {
  const key = ref?.key || "";
  if (/sinitic|japonic|koreanic|tibeto|hmongic|daic/.test(key)) return 10;
  if (/indo_aryan|dravidian|iranic/.test(key)) return 20;
  if (/semitic|turkic|berber|armenian/.test(key)) return 30;
  if (/germanic|romance|slavic|baltic|celtic|hellenic|uralic|albanic|vasconic/.test(key)) return 40;
  if (/austronesian|austroasiatic/.test(key)) return 50;
  if (/bantu|nilotic|kushitic|mande|kwa|volta|chadic|saharan|songhai|senegambian|kru|gur|furan|khoisan|kordofanian|ubangian|central_sudanic|benue_congo|senufic|mal/.test(key)) return 60;
  if (/algic|arawakan|aymaran|caddoan|cariban|chibchan|chonan|eskaleut|hokan|iroquoian|mayan|misumalpan|muskogean|na_dene|oto_manguean|penutian|quechuan|salishan|siouan|tarascan|tupian|uto_aztecan|pama_nyungan/.test(key)) return 90;
  return 70;
}

function orderValue(orderMap, key) {
  return orderMap.has(key) ? orderMap.get(key) : Number.MAX_SAFE_INTEGER;
}

function orderValueByList(orderList, key) {
  const index = orderList.indexOf(key);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}
