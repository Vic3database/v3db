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
    tagPill(countryTypeTagLabel(country), "tag-type"),
    tagPill(country.tierZh, "tag-tier"),
    groupedTraitPills(country.primaryCultureHeritageGroups, country.primaryCultureHeritages, "tag-heritage-group", "tag-heritage"),
    groupedTraitPills(country.primaryCultureLanguageGroups, country.primaryCultureLanguages, "tag-language-group", "tag-language"),
    refPills(country.primaryCultureTraditions, "tag-tradition"),
    refPills(country.locationStrategicRegions, "tag-region"),
  ].filter(Boolean).join("");
}

function statusPills(country) {
  const pills = [];
  if (country.existsAtStart === "是") pills.push(tagPill("开局", "good"));
  if (country.isReleasable === "是") pills.push(tagPill("释放", "tag-release"));
  if (country.isMajorFormable === "是") pills.push(tagPill("重大统一", "warn"));
  else if (country.isMinorFormable === "是") pills.push(tagPill("次要统一", "warn"));
  if (country.isSpecial === "是") pills.push(tagPill("特殊", "special"));
  if (country.isDualHeritage === "是") pills.push(tagPill("双传承", "tag-dual"));
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
    items.push(conceptPill({
      label: group.name_zh || group.key,
      className: groupClass,
      title: group.key,
      kind: "cultureTraitGroup",
      key: group.key,
    }));
    for (const trait of traitsByGroup.get(group.key) || []) {
      items.push(conceptPill({
        label: trait.name_zh || trait.key,
        className: traitClass,
        title: trait.key,
        kind: "cultureTrait",
        key: trait.key,
      }));
    }
    traitsByGroup.delete(group.key);
  }
  for (const traits of traitsByGroup.values()) {
    for (const trait of traits) {
      items.push(conceptPill({
        label: trait.name_zh || trait.key,
        className: traitClass,
        title: trait.key,
        kind: "cultureTrait",
        key: trait.key,
      }));
    }
  }
  for (const trait of remaining) {
    items.push(conceptPill({
      label: trait.name_zh || trait.key,
      className: traitClass,
      title: trait.key,
      kind: "cultureTrait",
      key: trait.key,
    }));
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
  return [
    victorianCenturyBadge(region),
    limitedRefPills(region.starting_owners, "tag-type", 8),
    limitedRefPills(region.homeland_cultures, "tag-heritage", 10),
  ].filter(Boolean).join("");
}

function geographicRegionTagPills(region) {
  return [
    victorianCenturyBadge(region),
    limitedRefPills(geographicRegionStrategicRegions(region), "tag-region", 6),
    tagPill(`${geographicRegionStateRegions(region).length} 个州地区`, "tag-muted"),
  ].filter(Boolean).join("");
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
  html = "",
}) {
  if (!label && !html) return "";
  const classText = className ? ` ${className}` : "";
  const conceptKey = key || label || "";
  const tooltip = title || conceptKey;
  const attrs = [
    `class="pill concept-pill${classText}"`,
    !hideNativeTitle && tooltip && tooltip !== label ? `title="${escapeHtml(tooltip)}"` : "",
    kind ? `data-concept-kind="${escapeHtml(kind)}"` : "",
    conceptKey ? `data-concept-key="${escapeHtml(conceptKey)}"` : "",
    label ? `data-concept-label="${escapeHtml(label)}"` : "",
    search || label || conceptKey ? `data-concept-search="${escapeHtml(search || label || conceptKey)}"` : "",
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

function refConceptPill(item, className = "") {
  if (!item) return "";
  const key = item.tag || item.key || "";
  const kind = kindFromRef(item) || inferConceptKind(key);
  const label = kind === "country"
    ? countryRefLabel(item)
    : kind === "strategicRegion"
    ? strategicRegionName(byStrategicRegion.get(key) || item)
    : kind === "geographicRegion"
      ? geographicRegionDisplayName(byGeographicRegion.get(key) || item)
    : item.name_zh || item.key || item.tag || "";
  return conceptPill({
    label,
    className,
    title: key,
    kind,
    key,
    href: conceptHref(kind, key),
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
  if (String(key).startsWith("building_")) return "building";
  if (String(key).startsWith("goods_") || String(key).startsWith("prestige_good_")) return "goods";
  return "";
}

function tagPill(label, className = "", title = "") {
  if (!label) return "";
  const titleText = title && title !== label ? ` title="${escapeHtml(title)}"` : "";
  const classText = className ? ` ${className}` : "";
  return `<span class="pill tag-pill${classText}"${titleText}>${escapeHtml(label)}</span>`;
}

function victorianCenturyBadge(item) {
  if (!isVictorianCenturyEntry(item)) return "";
  return tagPill("VC新增/调整", "tag-vc", "Victorian Century 新增或调整的条目");
}

function isVictorianCenturyEntry(item) {
  return ownSourcePaths(item).some((path) => normalizeSourcePath(path).includes(VICTORIAN_CENTURY_SOURCE_MARKER));
}

function ownSourcePaths(item) {
  const source = item?.source || {};
  return [
    item?.source_file,
    item?.sourceFile,
    item?.definitionFile,
    item?.definition_file,
    source.file,
    source.source_file,
    source.definition_file,
    source.definitionFile,
  ].filter(Boolean);
}

function normalizeSourcePath(path) {
  return String(path || "").replaceAll("\\", "/").toLowerCase();
}

function countryTypeTagLabel(country) {
  return countryTypeTagLabels[country.countryType] || country.countryTypeZh || country.countryType || "";
}

function field(label, value) {
  const html = value || `<span class="empty">无</span>`;
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
      label: countryRefLabel({ tag, name_zh: names?.[index] }),
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
    const name = stateRegion?.name_zh || key;
    const suffix = isSplitStartingStateForCountry(stateRegion, country.tag) ? "(分属)" : "";
    return { key, name_zh: `${name}${suffix}`, id: `state_region:${key}` };
  });
  return stateRegionLinks(items);
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
    const label = company.name_zh || company.key;
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
    || (a.company.name_zh || a.company.key).localeCompare(b.company.name_zh || b.company.key, "zh-Hans-CN")
    || a.company.key.localeCompare(b.company.key)
  ));
}

function sourceSuffix(source) {
  return source ? ` <span class="minor">来源：${escapeHtml(source)}</span>` : "";
}

function listText(values) {
  const items = (values || []).map((item) => {
    const label = typeof item === "string" ? item : item?.name_zh || item?.key || "";
    const title = typeof item === "string" ? "" : item?.key && item.key !== label ? ` title="${escapeHtml(item.key)}"` : "";
    return label ? `<span class="pill"${title}>${escapeHtml(label)}</span>` : "";
  }).filter(Boolean);
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function traitPill(trait) {
  if (!trait?.key) return "";
  return conceptPill({
    label: trait.name_zh || trait.key,
    kind: "cultureTrait",
    key: trait.key,
    title: trait.key,
  });
}

function traitGroupPill(group) {
  if (!group?.key) return "";
  return conceptPill({
    label: group.name_zh || group.key,
    kind: "cultureTraitGroup",
    key: group.key,
    title: group.key,
  });
}

function traitList(traits) {
  const items = (traits || []).map(traitPill).filter(Boolean);
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function traitGroupList(groups) {
  const items = (groups || []).map(traitGroupPill).filter(Boolean);
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function goodsList(goods) {
  const items = (goods || []).map((item) => conceptPill({
    label: item.name_zh || item.key,
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

function discoverableResourceList(resources) {
  const items = (resources || []).map((item) => {
    const amount = item.undiscovered_amount ?? item.discovered_amount ?? item.amount ?? "";
    return resourcePill(item, amount);
  });
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function buildingList(buildings, className = "tag-arable") {
  const items = (buildings || []).map((item) => buildingPill(item, className));
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function resourcePill(item, amount = "") {
  const name = item?.name_zh || item?.key || "";
  const suffix = amount !== "" && amount !== null ? ` · ${escapeHtml(amount)}` : "";
  return conceptPill({
    label: `${name}${amount !== "" && amount !== null ? ` ${amount}` : ""}`,
    className: "resource-pill image-pill",
    title: item?.key || "",
    kind: "building",
    key: item?.key || "",
    html: `${buildingIconHtml(item?.key, name)}<span>${escapeHtml(name)}${suffix}</span>`,
  });
}

function buildingPill(item, className = "") {
  const name = item?.name_zh || item?.key || "";
  const classText = className ? ` ${className}` : "";
  const extensionBadge = className.includes("extension-building-pill") ? `<span class="building-kind-badge">扩展</span>` : "";
  return conceptPill({
    label: name,
    className: `resource-pill image-pill${classText}`,
    title: item?.key || "",
    kind: "building",
    key: item?.key || "",
    html: `${buildingIconHtml(item?.key, name)}${extensionBadge}<span>${escapeHtml(name)}</span>`,
  });
}

function stateTraitPills(traits) {
  const items = (traits || []).map((trait) => (
    tagPill(trait.name_zh || trait.key, trait.has_mapi ? "tag-mapi" : "tag-tradition", trait.key)
  ));
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function stateTraitEffectList(traits) {
  if (!(traits || []).length) {
    return `<p class="empty compact">无地区特质。</p>`;
  }
  return `<div class="rule-list">${traits.map((trait) => `
    <article class="rule-item">
      <div class="trait-card-layout">
        ${traitIconHtml(trait, "state")}
        <div class="trait-card-content">
          <div class="rule-head">
            <strong>${escapeHtml(trait.name_zh || trait.key)}</strong>
            <span class="minor">${escapeHtml(trait.key)}</span>
          </div>
          <dl class="mini-grid">
            ${field("类型", traitCategoryPills(trait.categories))}
            ${field("效果", modifierPills(trait.modifiers))}
            ${field("殖民科技", escapeHtml((trait.required_techs_for_colonization || []).join("、")))}
            ${field("失效科技", escapeHtml((trait.disabling_technologies || []).join("、")))}
          </dl>
        </div>
      </div>
    </article>
  `).join("")}</div>`;
}

function traitCategoryPills(categories) {
  const items = (categories || []).map((category) => tagPill(category.name_zh || category.key, category.key === "mapi" ? "tag-mapi" : "tag-tradition", category.key));
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function modifierPills(modifiers) {
  const items = (modifiers || []).map((modifier) => {
    const title = [modifier.key, modifier.desc_zh].filter(Boolean).join("；");
    return tagPill(modifierSummaryLabel(modifier), modifier.key === "state_market_access_price_impact" ? "tag-mapi" : "tag-effect", title);
  });
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function modifierSummaryLabel(modifier) {
  if (modifier?.key === "state_market_access_price_impact") {
    return `市场接入度的价格影响(MAPI)${modifier?.value_zh ? ` ${modifier.value_zh}` : ""}`;
  }
  return modifier?.summary_zh || modifier?.key || "";
}

function interestGroupFlavorList(groups) {
  const items = (groups || []).filter(Boolean);
  if (!items.length) {
    return `<p class="empty compact">松散政权没有常规利益集团风味数据。</p>`;
  }
  return `<div class="interest-group-list">${items.map(interestGroupFlavorCard).join("")}</div>`;
}

function interestGroupFlavorCard(group) {
  const displayName = interestGroupDisplayName(group);
  const flavoredNameTag = group.display_name?.is_flavored ? tagPill("改名", "tag-ig-changed", group.display_name.key) : "";
  const changedTraits = !sameKeySet(group.base_traits, group.active_traits);
  const changedIdeologies = (group.added_ideologies || []).length || (group.removed_ideologies || []).length;
  return `
    <article id="interest-group-flavor-target-${escapeHtml(group.key)}" class="rule-item interest-group-card interest-group-flavor-target" tabindex="-1" style="${interestGroupStyle(group)}">
      <div class="rule-head interest-group-head">
        <span class="interest-group-title">
          <span class="interest-group-color" aria-hidden="true"></span>
          <strong>${escapeHtml(displayName)}</strong>
          ${!group.display_name?.is_flavored ? `<span class="pill tag-pill tag-muted">基础</span>` : ""}
        </span>
        <span class="minor">${escapeHtml(group.key)}</span>
      </div>
      <dl class="mini-grid interest-group-grid">
        ${flavoredNameTag ? field("风味名", flavoredNameTag) : ""}
        ${field("特质", interestGroupTraitDetailsHtml(group.active_traits, changedTraits))}
        ${field("意识形态", activeIdeologyPills(group))}
        ${changedIdeologies ? field("新增", ideologyPills(group.added_ideologies, "tag-ig-added")) : ""}
        ${changedIdeologies ? field("移除", ideologyPills(group.removed_ideologies, "tag-ig-removed")) : ""}
        ${field("个人意识形态", ideologyPills(group.character_ideologies, "tag-tradition"))}
        ${field("规则", interestGroupRuleSummary(group.applied_rules))}
      </dl>
      ${interestGroupRuleDetails(group.applied_rules)}
    </article>
  `;
}

function interestGroupDisplayName(group) {
  const name = group.display_name?.name_zh || group.name_zh || group.key;
  const baseName = group.name_zh || byInterestGroup.get(group.key)?.name_zh || group.key;
  if (group.display_name?.is_flavored && baseName && baseName !== name) {
    return `${name}（${baseName}）`;
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
    const title = [trait.key, approval, trait.modifier_summary_zh, trait.desc_zh].filter(Boolean).join("；");
    const orderedClass = index < 3 ? `tag-ig-trait-${index + 1}` : "tag-effect";
    const classes = [
      normalizedOptions.className || orderedClass,
      normalizedOptions.base ? "tag-base-adopted" : "",
      normalizedOptions.changed ? "tag-changed-outline" : "",
    ].filter(Boolean).join(" ");
    return conceptPill({
      label: trait.name_zh || trait.key,
      className: classes,
      title,
      kind: "interestGroupTrait",
      key: trait.key,
      search: trait.name_zh || trait.key,
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
  const summary = trait.modifier_summary_zh || "";
  const desc = cleanDescriptionText(trait.desc_zh || "");
  const className = changed ? " interest-group-trait-card-changed" : "";
  return `
    <article class="interest-group-trait-card${className}" data-concept-kind="interestGroupTrait" data-concept-key="${escapeHtml(trait.key || "")}" data-concept-label="${escapeHtml(trait.name_zh || trait.key || "")}" data-concept-search="${escapeHtml(trait.name_zh || trait.key || "")}">
      <div class="trait-card-layout">
        ${traitIconHtml(trait, "interest-group")}
        <div class="trait-card-content">
          <div class="interest-group-trait-head">
            <strong>${escapeHtml(trait.name_zh || trait.key || "")}</strong>
            ${approval ? `<span>${escapeHtml(approval)}</span>` : ""}
          </div>
          ${summary ? `<p>${escapeHtml(summary)}</p>` : ""}
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
  const alt = escapeHtml(trait?.name_zh || trait?.key || "特质");
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
    return `<div class="ideology-pill-group"><span class="ideology-pill-group-label">${escapeHtml(type.label)}：</span><span class="link-list">${items.join("")}</span></div>`;
  }).join("");
}

function ideologyPill(ideology, className = "tag-ideology") {
  if (!ideology?.key) return "";
  const source = ideologyByKey.get(ideology.key) || ideology;
  // 类型标题“运动：”替代了名称后的“(运动)”后缀。
  const label = ideology.name_zh || ideology.key;
  return conceptPill({
    label,
    className: `${className} ideology-tooltip-trigger`.trim(),
    title: ideologyLawStanceTooltip(source),
    hideNativeTitle: true,
    kind: "ideology",
    key: ideology.key,
    search: ideology.name_zh || ideology.key,
    href: conceptHref("ideology", ideology.key),
  });
}

function ideologyRefPill(key, className = "tag-ideology") {
  const ideology = ideologyByKey.get(key) || { key, name_zh: key };
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
    seen.set(stance.law_group_key, stance.law_group_name_zh || stance.law_group_key);
  }
  return [...seen.entries()]
    .sort((a, b) => orderValue(ideologyLawGroupOrderMap, a[0]) - orderValue(ideologyLawGroupOrderMap, b[0]) || a[1].localeCompare(b[1], "zh-Hans-CN"))
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
  return String(value || "").replace(/!+$/, "").trim();
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
  return [...keys].map((key) => ({ key, name_zh: ideologyOccurrenceOptions.find((item) => item.key === key)?.label || key }));
}

function ideologyLawGroupRefs(ideology) {
  const map = new Map();
  for (const stance of ideology?.law_stances || []) {
    if (!stance.law_group_key || map.has(stance.law_group_key)) continue;
    map.set(stance.law_group_key, {
      key: stance.law_group_key,
      name_zh: stance.law_group_name_zh || stance.law_group_key,
    });
  }
  return [...map.values()].sort(sortIdeologyLawGroup);
}

function lawStanceGroupsHtml(ideology) {
  const groups = groupLawStances(ideology?.law_stances || []);
  if (!groups.length) return `<p class="empty compact">没有法律态度数据。</p>`;
  return `<div class="vic3-law-groups">${groups.map((group) => `
    <section class="vic3-law-group">
      <h3>对${escapeHtml(group.name)}的态度</h3>
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
        name: stance.law_group_name_zh || key || "未分组",
        items: [],
      });
    }
    groups.get(key).items.push(stance);
  }
  return [...groups.values()].sort((a, b) => sortIdeologyLawGroup(a, b));
}

function lawStanceChip(stance) {
  const name = stance.law_name_zh || stance.law_key || "";
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
        (a.law_name_zh || a.law_key || "").localeCompare(b.law_name_zh || b.law_key || "", "zh-Hans-CN")
      ));
      const names = items.map((item) => item.law_name_zh || item.law_key).filter(Boolean).join("、");
      return `
        <div class="vic3-law-line ${lawStanceClassName(stance)}">
          <span>${escapeHtml(lawStanceSentencePrefix(stance))} </span>${escapeHtml(names)}
        </div>
      `;
    }).join("");
}

function lawStanceSentencePrefix(stance) {
  return {
    strongly_disapprove: "坚决反对",
    disapprove: "反对",
    neutral: "不在意",
    approve: "支持",
    strongly_approve: "坚决支持",
  }[stance] || lawStanceLabel(stance);
}

function ideologyUnlockTagsHtml(ideology) {
  const tags = [
    ...(ideology.unlock_technologies || []).map((item) => conceptPill({
      label: `科技：${item.name_zh || item.key}`,
      className: "tag-technology",
      title: item.key,
      key: item.key,
      search: item.name_zh || item.key,
    })),
    ...(ideology.unlock_journal_entries || []).map((item) => conceptPill({
      label: `日志：${item.name_zh || item.key}`,
      className: "tag-journal",
      title: item.key,
      key: item.key,
      search: item.name_zh || item.key,
    })),
  ].filter(Boolean);
  if (!tags.length) return "";
  return `
    <div class="ideology-unlock-tags" aria-label="解锁来源">
      ${tags.join("")}
    </div>
  `;
}

function ideologyRuleSourceLabel(ideology) {
  const sources = uniqueUnlockSourceRows(ideology.unlock_sources || []);
  if (!sources.length) return "";
  return `
    <section class="vic3-special-usage ideology-source-usage">
      <h3>来源</h3>
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
    const key = [source.kind, source.source_key, source.source_file, source.condition_summary_zh].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(source);
  }
  return result;
}

function ideologySourceKindLabel(kind) {
  return {
    interest_group_flavor: "风味规则",
    political_movement: "政治运动",
    event_or_journal: "事件/日志",
  }[kind] || "来源";
}

function ideologySourceText(source) {
  const parts = [
    source.source_name_zh && source.source_name_zh !== source.source_key ? `${source.source_name_zh}（${source.source_key}）` : source.source_key,
    ideologyUnlockRefsText(source.technologies, "科技"),
    ideologyUnlockRefsText(source.journal_entries, "日志"),
    source.condition_summary_zh && source.condition_summary_zh !== "脚本条件" ? source.condition_summary_zh : "",
    fileBaseName(source.source_file),
  ].filter(Boolean);
  return escapeHtml(parts.join("；"));
}

function ideologyUnlockRefsText(items, label) {
  if (!(items || []).length) return "";
  return `${label}：${(items || []).map((item) => item.name_zh || item.key).join("、")}`;
}

function ideologyReplacementUsageHtml(related) {
  const rows = (related?.flavorUsage || [])
    .map((rule) => field(ideologyFlavorUsageLabel(rule), ideologyFlavorUsageValue(rule)))
    .filter(Boolean);
  if (!rows.length) return "";
  return `
    <section class="vic3-special-usage ideology-replacement-usage">
      <h3>出现和替换</h3>
      <dl class="field-grid">${rows.join("")}</dl>
    </section>
  `;
}

function ideologyFlavorUsageLabel(rule) {
  if (rule.kind === "added") return "风味·新增";
  if (rule.kind === "removed") return "风味·移除";
  if (rule.kind === "replaces") {
    return "风味·替换";
  }
  if (rule.kind === "replaced_by") {
    return "风味：替换为";
  }
  return "风味";
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
      <h3>风味定义</h3>
      <p>${escapeHtml(ideology.flavor_definition_note_zh || "风味意识形态定义；当前脚本未分配给任何利益集团。")}</p>
      <dl class="field-grid">
        ${field("状态", tagPill("未分配", "tag-muted"))}
        ${field("文件", escapeHtml(fileBaseName(ideology.source_file)))}
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
    weightRequirementHtml("国家要求", requirements.country),
    weightRequirementHtml("领袖要求", requirements.interest_group_leader),
    weightRequirementHtml("非领袖要求", requirements.non_interest_group_leader),
    weightListHtml("领袖权重", leaderWeight),
    weightListHtml("非领袖权重", nonLeaderWeight),
  ].filter(Boolean).join("");
  return `
    <details class="collapsible-detail-section ideology-weight-section">
      <summary><span>角色权重</span><small>要求与权重修正</small></summary>
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
      <p>${escapeHtml(requirement.summary_zh || "脚本条件")}</p>
      ${conditionRefPills(requirement)}
      ${rawDetails("条件脚本", requirement.raw)}
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
    ? `乘数 ${formatWeightValue(entry.value)}`
    : entry.condition_summary_zh
      ? `${entry.kind === "base" ? "基础" : "加值"} ${formatSignedWeight(entry.value)}`
      : `基础 ${formatWeightValue(entry.value)}`;
  const refs = conditionRefPills(entry);
  return `
    <article class="ideology-weight-entry">
      <div class="ideology-weight-entry-head">
        <strong>${escapeHtml(label)}</strong>
        ${entry.desc ? `<span>${escapeHtml(weightDescLabel(entry.desc))}</span>` : ""}
      </div>
      ${entry.condition_summary_zh ? `<p>${escapeHtml(entry.condition_summary_zh)}</p>` : ""}
      ${refs}
      ${rawDetails("条件脚本", entry.condition_raw)}
    </article>
  `;
}

function conditionRefPills(condition) {
  const parts = [
    refItemsPills(condition.interest_groups, "interestGroup", "tag-ig-changed"),
    refItemsPills(condition.laws, "law", "tag-law"),
    refItemsPills(condition.technologies, "", "tag-technology"),
    refItemsPills(condition.journal_entries, "", "tag-journal"),
    refItemsPills(condition.traits, "trait", "tag-tradition"),
  ].filter(Boolean);
  return parts.length ? `<div class="ideology-weight-refs">${parts.join("")}</div>` : "";
}

function refItemsPills(items, kind, className) {
  const pills = (items || []).map((item) => conceptPill({
    label: item.name_zh || item.key,
    className,
    title: item.key,
    kind,
    key: item.key,
    href: conceptHref(kind, item.key),
  })).filter(Boolean);
  return pills.length ? `<span class="link-list">${pills.join("")}</span>` : "";
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
  if (desc === "base_value") return "基础值";
  return desc || "";
}

function lawStanceLabel(stance) {
  return lawStanceLabels[stance] || stance || "";
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
    })).sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN")),
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
            ideologyName: removedIdeology.name_zh || removedIdeology.key,
            country,
          });
        }
        if (removedIdeology.key === key) {
          addIdeologyFlavorUsage(out, {
            kind: "replaced_by",
            ideologyKey: addedIdeology.key,
            ideologyName: addedIdeology.name_zh || addedIdeology.key,
            currentKey: removedIdeology.key,
            currentName: removedIdeology.name_zh || removedIdeology.key,
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
    label: group.name_zh || group.key,
    className,
    title: group.key,
    kind: "interestGroup",
    key: group.key,
    search: group.name_zh || group.key,
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
  const more = (items || []).length > limit ? tagPill(`另有 ${(items || []).length - limit} 个国家`, "tag-more") : "";
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
    ...(rule.names || []).map((item) => item.name_zh || item.key),
    ...(rule.traits || []).map((item) => item.name_zh || item.key),
    ...(rule.added_ideologies || []).map((item) => item.name_zh || item.key),
  ]).filter(Boolean));
  if (!names.length) return tagPill("基础默认", "tag-muted");
  return tagPill(`${rules.length} 条匹配规则`, "tag-special", names.join("；"));
}

function interestGroupRuleDetails(rules) {
  if (!(rules || []).length) return "";
  return `
    <details class="script-details interest-group-rule-details">
      <summary>匹配规则</summary>
      <div class="interest-group-rule-list">
        ${rules.map((rule) => `
          <section class="interest-group-rule">
            <div class="minor">${escapeHtml(rule.condition_summary_zh || "默认")}</div>
            <dl class="mini-grid">
              ${field("名称", interestGroupEffectRefPills(rule.names, "interestGroup", "tag-ig-changed"))}
              ${field("特质", interestGroupEffectRefPills(rule.traits, "interestGroupTrait", "tag-changed-outline"))}
              ${field("新增", interestGroupEffectRefPills(rule.added_ideologies, "ideology", "tag-ig-added"))}
              ${field("移除", interestGroupEffectRefPills(rule.removed_ideologies, "ideology", "tag-ig-removed"))}
            </dl>
            ${rawDetails("条件脚本", rule.condition_raw)}
          </section>
        `).join("")}
      </div>
    </details>
  `;
}

function interestGroupEffectRefPills(items, kind, className) {
  const pills = (items || []).map((item) => conceptPill({
    label: item.name_zh || item.key,
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
  if (trait?.min_approval) parts.push(`最低支持：${trait.min_approval}`);
  if (trait?.max_approval) parts.push(`最高支持：${trait.max_approval}`);
  return parts.join("；");
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
    refPills(stateRegion.traits, "tag-tradition"),
  ].filter(Boolean).join("");
}

function stateRegionMapiPill(stateRegion) {
  const values = unique((stateRegion.traits || [])
    .filter((trait) => trait.has_mapi)
    .map((trait) => trait.mapi_value_zh)
    .filter(Boolean));
  if (!values.length) return "";
  return tagPill(`MAPI ${values.join("/")}`, "tag-mapi", "MAPI");
}

function companyKindText(company) {
  return company.company_kind_zh || companyKindLabels.get(companyKindKey(company)) || "通用公司";
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
  return company?.dlc_name_en || company?.dlc_name_zh || companyDlcLabels.get(companyDlcKey(company)) || companyDlcKey(company);
}

function companyPrestigeLabel(company) {
  const label = company?.prestige_goods_kind_zh || companyPrestigeLabels.get(prestigeGoodsKindKey(company)) || "";
  return label.replace(/^仅(?=通用名贵商品|特殊名贵商品)/, "");
}

function companyTagPills(company) {
  return [
    victorianCenturyBadge(company),
    limitedRefPills(company.referenced_strategic_regions, "tag-region", 4),
    limitedRefPills(company.referenced_geographic_regions, "tag-region", 3),
    tagPill(company.category_zh || company.category, "tag-tier", company.category),
    companyKindKey(company) === "easter_egg" ? tagPill(companyKindText(company), "tag-special") : "",
  ].filter(Boolean).join("");
}

function companyMetaLine(company) {
  return [
    company.preferred_headquarters?.length ? `总部倾向：${refNames(company.preferred_headquarters, " / ")}` : "",
    company.referenced_cultures?.length ? `限定文化：${refNames(company.referenced_cultures, " / ")}` : "",
  ].filter(Boolean).join("；");
}

function companyDlcIconPill(company) {
  if (companyDlcKey(company) === "base") return "";
  const option = companyDlcOptions.find((item) => item.key === companyDlcKey(company));
  if (!option) return tagPill(companyDlcLabel(company), "tag-dlc");
  return `<span class="pill tag-pill tag-dlc company-dlc-pill" title="${escapeHtml(companyDlcLabel(company))}">${dlcIconHtml(option)}</span>`;
}

function companyPrestigeGoodsPills(company) {
  if (!(company.possible_prestige_goods || []).length) return "";
  return limitedHtmlItems((company.possible_prestige_goods || []).map((item) => companyPrestigeGoodPill(item)), 3);
}

function companyPrestigeGoodPill(item) {
  if (!item) return "";
  const key = item.key || "";
  const label = item.name_zh || key;
  return conceptPill({
    label,
    className: "tag-good prestige-good-pill",
    title: key,
    kind: "goods",
    key,
    html: `${goodsIconHtml(item, "prestige-good-icon")}<span>${escapeHtml(label)}</span>`,
  });
}

function goodsIconHtml(item, className = "prestige-good-icon") {
  const label = item?.name_zh || item?.key || "";
  const path = prestigeGoodIconPath(item?.key || "");
  if (!path) return "";
  return `<img class="${escapeHtml(className)}" src="${path}" alt="" title="${escapeHtml(label)}">`;
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
  const name = item?.name_zh || item?.key || "";
  if (!name) return "";
  const classText = className ? ` ${className}` : "";
  return conceptPill({
    label: name,
    className: `resource-pill image-pill company-building-pill${classText}`,
    title: item?.key || "",
    kind: "building",
    key: item?.key || "",
    html: buildingIconHtml(item?.key, name),
  });
}

function resourceSummaryPills(stateRegion) {
  const resourcePills = [
    ...(stateRegion.capped_resources || []).map((item) => resourcePill(item, item.amount)),
    ...(stateRegion.discoverable_resources || []).map((item) => {
      const amount = item.undiscovered_amount ?? item.discovered_amount ?? item.amount ?? "";
      return resourcePill(item, amount);
    }),
  ];
  return limitedHtmlItems(resourcePills, 6);
}

function agricultureSummaryPills(stateRegion) {
  const arableResources = (stateRegion.arable_resources || []).map((item) => buildingPill(item, "tag-arable"));
  return limitedHtmlItems(arableResources, 8);
}

function stateRegionBuildingStrip(stateRegion) {
  const resources = [
    ...(stateRegion.capped_resources || []).map((item) => buildingChip(item, item.amount, "resource-chip")),
    ...(stateRegion.discoverable_resources || []).map((item) => {
      const amount = item.undiscovered_amount ?? item.discovered_amount ?? item.amount ?? "";
      return buildingChip(item, amount, "resource-chip discoverable-chip");
    }),
  ];
  const agriculture = (stateRegion.arable_resources || []).map((item) => buildingChip(item, "", "resource-chip arable-chip"));
  const items = [...resources, ...agriculture].filter(Boolean);
  return items.length ? items.join("") : "";
}

function buildingChip(item, amount = "", className = "") {
  const name = item?.name_zh || item?.key || "";
  const count = amount !== "" && amount !== null ? `<span class="building-chip-count">${escapeHtml(amount)}</span>` : "";
  const titleParts = [name, item?.key && item.key !== name ? item.key : "", amount !== "" && amount !== null ? String(amount) : ""].filter(Boolean);
  const title = titleParts.length ? ` title="${escapeHtml(titleParts.join(" · "))}"` : "";
  const classText = className ? ` ${className}` : "";
  return `<span class="building-chip${classText}"${title} data-concept-kind="building" data-concept-key="${escapeHtml(item?.key || name)}" data-concept-label="${escapeHtml(name)}" data-concept-search="${escapeHtml(name)}">${buildingIconHtml(item?.key, name)}${count}</span>`;
}

function limitedHtmlItems(items, limit) {
  const filtered = (items || []).filter(Boolean);
  if (filtered.length <= limit) return filtered.join("");
  return `${filtered.slice(0, limit).join("")}${tagPill(`另有 ${filtered.length - limit} 项`, "tag-more")}`;
}

function sameTraditionCultures(traditions, groups) {
  const blocks = (traditions || []).map((tradition) => {
    const related = groups?.[tradition.key] || [];
    if (!related.length) return "";
    return `
      <div class="inline-block">
        <span class="minor">${escapeHtml(tradition.name_zh)}</span>
        ${cultureLinks(related)}
      </div>
    `;
  }).filter(Boolean);
  return blocks.length ? blocks.join("") : "";
}

function dynamicNameList(country) {
  if (!(country.dynamicNameVariants || []).length) {
    return `<p class="empty compact">无专属国名变体。</p>`;
  }
  return `<div class="rule-list">${country.dynamicNameVariants.map((variant) => `
    <article class="rule-item">
      <div class="rule-head">
        <strong>${escapeHtml(variant.name_zh || variant.name_key)}</strong>
        <span class="minor">${escapeHtml(variant.name_key)}</span>
      </div>
      <dl class="mini-grid">
        ${field("形容词", escapeHtml(variant.adjective_zh || variant.adjective_key || ""))}
        ${field("优先级", escapeHtml(variant.priority || "0"))}
        ${field("革命名", escapeHtml(variant.is_revolutionary))}
        ${field("引用", refsText(variant))}
      </dl>
      ${rawDetails("条件脚本", variant.trigger_raw)}
    </article>
  `).join("")}</div>`;
}

function dynamicStateNameList(stateRegion) {
  const variants = visibleDynamicStateNameVariants(stateRegion);
  if (!variants.length) {
    return `<p class="empty compact">无地区名称变体。</p>`;
  }
  return `<div class="rule-list">${variants.map((variant) => `
    <article class="rule-item">
      <div class="rule-head">
        <strong>${escapeHtml(variant.name_zh || variant.name_key)}</strong>
        <span class="minor">${escapeHtml(variant.name_key)}</span>
      </div>
      <dl class="mini-grid">
        ${field("采用名称", escapeHtml(variant.name_zh || variant.name_key || ""))}
        ${field("来源", escapeHtml(fileBaseName(variant.source_file)))}
      </dl>
      ${rawDetails("采用条件", variant.trigger_raw)}
    </article>
  `).join("")}</div>`;
}

function dynamicMapColorList(country) {
  if (!(country.dynamicMapColorRules || []).length) {
    return `<p class="empty compact">无专属特殊地图色。</p>`;
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
        ${field("颜色", colorValue(rule.color_hex, splitNumbers(rule.color_rgb)))}
        ${field("引用", refsText(rule))}
      </dl>
      ${rawDetails("条件脚本", rule.possible_raw)}
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
              <span class="tag">${escapeHtml(variant.exportKey || variant.key)}</span>
            </div>
            <dl class="mini-grid country-flag-variant-meta">
              ${field("优先级", escapeHtml(String(variant.priority ?? 0)))}
              ${field("触发", escapeHtml(variant.triggerSummary || "默认候选"))}
              ${field("附属旗角", escapeHtml(variant.subjectCanton || ""))}
              ${field("领主旗角", escapeHtml(flagYesNo(variant.allowOverlordCanton)))}
            </dl>
            ${rawDetails("触发条件", variant.triggerRaw)}
          </div>
        </article>
      `).join("")}
    </div>
  `;
  return collapsibleDetailSection("国旗变体", body, `${variants.length} 种`);
}

function countryFlagVariantAlt(country, variant) {
  const name = country?.name || country?.tag || "国家";
  return `${name} ${variant.key || variant.exportKey || "国旗"}`;
}

function flagYesNo(value) {
  if (value === "yes") return "是";
  if (value === "no") return "否";
  return "";
}

function refsText(rule) {
  const parts = [];
  if (rule.referenced_tags) parts.push(`国家：${rule.referenced_tags}`);
  if (rule.referenced_cultures) parts.push(`文化：${rule.referenced_cultures}`);
  if (rule.referenced_laws) parts.push(`法律：${rule.referenced_laws}`);
  if (rule.referenced_journal_entries) parts.push(`日志：${rule.referenced_journal_entries}`);
  if (rule.referenced_variables) parts.push(`变量：${rule.referenced_variables}`);
  return parts.length ? escapeHtml(parts.join("；")) : "";
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
  const alt = escapeHtml(law?.name_zh || law?.key || "法律");
  return `<img class="${escapeHtml(className)}" src="assets/laws/${encodeURIComponent(baseName)}.png" alt="${alt}" onerror="this.hidden=true">`;
}

function lawPill(law) {
  if (!law?.key) return "";
  return conceptPill({
    label: law.name_zh || law.key,
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
  const pills = (keys || []).map((key) => lawPill(lawByKey.get(key) || { key, name_zh: key })).filter(Boolean);
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

function buildingIconHtml(key, label = "") {
  const fileName = buildingIconFileByKey[key];
  if (!fileName) return "";
  const path = `assets/buildings/${encodeURIComponent(fileName)}`;
  return `<img class="resource-icon" src="${path}" alt="" title="${escapeHtml(label || key)}">`;
}

function companyIconHtml(company) {
  const label = company?.name_zh || company?.key || "公司";
  const title = [label, company?.icon].filter(Boolean).join("；");
  const path = companyIconPath(company?.icon);
  if (!path) return `<span class="company-icon-placeholder" title="${escapeHtml(title)}">司</span>`;
  return `<img class="company-logo" src="${path}" alt="" title="${escapeHtml(title)}">`;
}

function companyIconPath(icon) {
  const baseName = fileBaseName(icon).replace(/\.dds$/i, ".png");
  if (!baseName || baseName === fileBaseName(icon)) return "";
  return `assets/companies/${encodeURIComponent(baseName)}`;
}

function countryFlagIconHtml(country, className = "country-flag-inline") {
  const image = countryDefaultFlagImage(country);
  if (!image) return "";
  const label = country?.name || country?.name_zh || country?.tag || "country";
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
  const label = ideology?.name_zh || ideology?.key || "意识形态";
  const title = [label, ideology?.key].filter(Boolean).join("；");
  const path = ideologyIconPath(ideology?.icon);
  if (!path) return `<span class="${escapeHtml(className)} ideology-icon-placeholder" title="${escapeHtml(title)}"></span>`;
  return `<img class="${escapeHtml(className)}" src="${path}" alt="" title="${escapeHtml(title)}" onerror="this.onerror=null;this.src='assets/ideologies/no_ideology.png';">`;
}

function ideologyIconPath(icon) {
  const baseName = fileBaseName(icon).replace(/\.dds$/i, ".png");
  if (!baseName || baseName === fileBaseName(icon)) return "";
  return `assets/ideologies/${encodeURIComponent(baseName)}`;
}

function interestGroupIconHtml(group, className = "interest-group-icon") {
  const label = group?.name_zh || group?.key || "利益集团";
  const path = interestGroupIconPath(group?.texture);
  if (!path) return `<span class="${escapeHtml(className)} interest-group-icon-placeholder" title="${escapeHtml(label)}"></span>`;
  return `<img class="${escapeHtml(className)}" src="${path}" alt="" title="${escapeHtml(label)}">`;
}

function interestGroupIconPath(texture) {
  const baseName = fileBaseName(texture).replace(/\.dds$/i, ".png");
  if (!baseName || baseName === fileBaseName(texture)) return "";
  return `assets/interest-groups/${encodeURIComponent(baseName)}`;
}

function dlcIconHtml(option) {
  if (!option?.icon) return "";
  const title = option.title || option.label || option.key;
  return `<img class="dlc-icon" src="assets/dlc/${encodeURIComponent(option.icon)}" alt="" title="${escapeHtml(title)}">`;
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
  return `${escapeHtml(country.name)}${suffix}`;
}

function stateRegionNameText(stateRegion) {
  const variants = stateRegionVariantNames(stateRegion);
  const suffix = variants.length
    ? `<span class="name-variants">（${escapeHtml(variants.join("/"))}）</span>`
    : "";
  return `${escapeHtml(stateRegion.name_zh || stateRegion.key)}${suffix}`;
}

function countryVariantNames(country) {
  const names = [];
  const seen = new Set([country.name]);
  for (const variant of country.dynamicNameVariants || []) {
    const name = variant.name_zh || variant.name_key || "";
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

function stateRegionVariantNames(stateRegion) {
  return visibleDynamicStateNameVariants(stateRegion).map((variant) => variant.name_zh || variant.name_key);
}

function visibleDynamicStateNameVariants(stateRegion) {
  const seen = new Set([stateRegion.name_zh || stateRegion.key]);
  const visible = [];
  for (const variant of stateRegion.dynamic_name_variants || []) {
    const name = variant.name_zh || "";
    if (!name || name === variant.name_key || seen.has(name)) continue;
    seen.add(name);
    visible.push(variant);
  }
  return visible;
}

function countryCapitalText(country) {
  const capital = country.capitalZh || country.capital || "无";
  const stateRegion = byStateRegion.get(country.capital);
  const strategicRegionNames = (stateRegion?.strategic_regions || [])
    .map((region) => `${strategicRegionName(byStrategicRegion.get(region.key) || region)}战略区域`);
  const suffix = strategicRegionNames.length ? `（${strategicRegionNames.join("、")}）` : "";
  return `首都：${escapeHtml(capital)}${escapeHtml(suffix)}`;
}

function stateRegionSummaryText(stateRegion) {
  return `开局归属：${countryRefNames(stateRegion.starting_owners)}`;
}

function refNames(items, separator = "、") {
  const names = (items || []).map(refName).filter(Boolean);
  return names.length ? names.join(separator) : "无";
}

function refName(item) {
  if (!item) return "";
  if (item.tag) return countryRefLabel(item);
  if (item.key && byStrategicRegion.has(item.key)) return strategicRegionName(byStrategicRegion.get(item.key));
  if (item.key && byStateRegion.has(item.key)) return byStateRegion.get(item.key)?.name_zh || item.key;
  return item.name_zh || item.key || item.tag || "";
}

function countryNameWithTag(tag) {
  return countryRefLabel({ tag });
}

function countryRefNames(items, separator = "、") {
  const names = (items || []).map(countryRefLabel).filter(Boolean);
  return names.length ? names.join(separator) : "无";
}

function countryRefLabel(item) {
  if (!item) return "";
  const tag = item.tag || item.key || "";
  if (!tag) return "";
  const country = byTag.get(tag);
  const name = item.name_zh || item.name || country?.name || country?.name_zh || tag;
  return `${name}(${tag})`;
}

function strategicRegionName(region) {
  const rawName = region?.name_zh || region?.key || "";
  if (!isWrappedLocalizationKey(rawName)) return rawName;
  const stateKey = rawName.slice(1, -1);
  const stateRegion = byStateRegion.get(stateKey);
  return stateRegion?.name_zh || stateKey || rawName;
}

function isSeaStrategicRegion(region) {
  return String(region?.source_file || "").includes("water_strategic_regions")
    || isWrappedLocalizationKey(region?.name_zh);
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
    const amount = discoverable.undiscovered_amount ?? discoverable.discovered_amount ?? discoverable.amount ?? 0;
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
    return { rank: 5, label: `${selectedCulture.name_zh || selectedCulture.key}本土` };
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
    return { rank: 4, label: `同语言：${culture.name_zh}` };
  }
  if (selectedCulture.language_group?.key && selectedCulture.language_group.key === culture.language_group?.key) {
    return { rank: 3, label: `同语言组：${culture.name_zh}` };
  }
  if (selectedCulture.heritage?.key && selectedCulture.heritage.key === culture.heritage?.key) {
    return { rank: 2, label: `同传承：${culture.name_zh}` };
  }
  if (selectedCulture.heritage_group?.key && selectedCulture.heritage_group.key === culture.heritage_group?.key) {
    return { rank: 1, label: `同传承组：${culture.name_zh}` };
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
    .map((key) => resourceFilterByKey.get(key)?.label)
    .filter(Boolean);
  if (!labels.length) return "战略区域";
  return labels.length > 3 ? `${labels.slice(0, 3).join("、")}等 ${labels.length} 项` : labels.join("、");
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
    labels.push(`传统：${tradition?.name_zh || state.tradition}`);
  }
  if (!labels.length) return "未选择文化特质";
  return labels.length > 3 ? `${labels.slice(0, 3).join("、")}等 ${labels.length} 项` : labels.join("、");
}

function selectedTraitFilterLabels(values, prefix) {
  return [...values].map((key) => {
    const trait = cultureTraitByKey.get(key);
    return `${prefix}：${trait?.name_zh || key}`;
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
  if (state.view === "culture") return "文化、特质、宗教、本土战略区域、州地区";
  if (state.view === "region") return "州地区、战略区域、海域、资源、地区特质、国家、文化";
  if (state.view === "company") return "公司、建筑、名贵商品、总部、战略区域、条件";
  if (state.view === "ideology") return "板块内搜索：意识形态、利益集团、法律组、法律";
  if (state.view === "law") return "法律、法律组、修正、条件";
  return "国家、Tag、文化、宗教、州地区";
}

function unitColorText(country) {
  const values = [
    country.primaryUnitColor && `一色 ${country.primaryUnitColor}`,
    country.secondaryUnitColor && `二色 ${country.secondaryUnitColor}`,
    country.tertiaryUnitColor && `三色 ${country.tertiaryUnitColor}`,
  ].filter(Boolean);
  return values.length ? escapeHtml(values.join("；")) : "";
}

function splitNumbers(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/\s+/).map(Number).filter(Number.isFinite);
}

function countrySearchBlob(country) {
  return [
    country.tag,
    country.name,
    country.capital,
    country.capitalZh,
    country.countryType,
    country.countryTypeZh,
    countryTypeTagLabel(country),
    country.tier,
    country.tierZh,
    country.isDualHeritage === "是" ? "双传承" : "",
    country.religion,
    country.religionZh,
    ...country.primaryCultures,
    ...country.primaryCulturesZh,
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
    ...country.canFormNames,
    country.specialMechanic,
    ...(country.specialTags || []),
    country.colorHex,
    ...(country.dynamicNameVariants || []).flatMap((variant) => [
      variant.name_key,
      variant.name_zh,
      variant.adjective_key,
      variant.adjective_zh,
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
    culture.name_zh,
    culture.religion?.key,
    culture.religion?.name_zh,
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
    stateRegion.key,
    stateRegion.name_zh,
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
    region.key,
    region.name_zh,
    strategicRegionName(region),
    region.capital_province,
    ...refSearchParts(region.states),
    ...refSearchParts(region.homeland_cultures),
    ...refSearchParts(region.starting_owners),
  ].join(" ").toLowerCase();
}

function geographicRegionSearchBlob(region) {
  return [
    region.key,
    region.name_zh,
    region.display_name_zh,
    ...refSearchParts(geographicRegionStrategicRegions(region)),
    ...refSearchParts(geographicRegionStateRegions(region)),
  ].join(" ").toLowerCase();
}

function geographicRegionDisplayName(region) {
  return region?.display_name_zh || region?.name_zh || region?.key || "";
}

function companySearchBlob(company) {
  return [
    company.key,
    company.name_zh,
    company.desc_zh,
    company.category,
    company.category_zh,
    companyKindText(company),
    companyPrestigeLabel(company),
    companyDlcLabel(company),
    company.dlc_name_en,
    company.source_file,
    company.prosperity_modifier_summary_zh,
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
    ideology.key,
    ideology.name_zh,
    cleanIdeologyDescription(ideology.desc_zh),
    ideologyTypeLabels.get(typeKey),
    ideologyTypeShortLabels.get(typeKey),
    fileBaseName(ideology.source_file),
    ...refSearchParts(ideology.unlock_technologies),
    ...refSearchParts(ideology.unlock_journal_entries),
    ...(ideology.unlock_sources || []).flatMap((source) => [
      source.source_key,
      source.source_name_zh,
      fileBaseName(source.source_file),
      source.condition_summary_zh,
    ]),
    ideology.flavor_definition_status,
    ideology.flavor_definition_note_zh,
    ...ideologyWeightSearchParts(ideology),
    ...refSearchParts(ideologyInterestGroupRefs(ideology)),
    ...refSearchParts(ideologyOccurrenceRefs(ideology)),
    ...lawStanceSearchParts(ideology.law_stances),
  ].join(" ").toLowerCase();
}

function lawSearchBlob(law) {
  const group = lawGroupByKey.get(law.group_key);
  return [
    law.key,
    law.name_zh,
    law.group_key,
    law.group_name_zh,
    law.progressiveness,
    law.modifier_summary_zh,
    law.parent,
    ...(law.disallowing_laws || []),
    ...(law.modifiers || []).flatMap((modifier) => [modifier.key, modifier.name_zh, modifier.desc_zh, modifier.summary_zh]),
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
    entry.condition_summary_zh,
    ...conditionSearchParts(entry),
  ]);
}

function conditionSearchParts(condition) {
  if (!condition) return [];
  return [
    condition.summary_zh,
    condition.condition_summary_zh,
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
    stance?.law_group_name_zh,
    stance?.law_key,
    stance?.law_name_zh,
    stance?.stance,
    lawStanceLabel(stance?.stance),
  ]).filter(Boolean);
}

function refSearchParts(items) {
  return (items || []).flatMap((item) => [
    item?.key,
    item?.tag,
    item?.name_zh,
    item?.group_key,
    item?.group_name_zh,
  ]).filter(Boolean);
}

function resourceSearchParts(items) {
  return (items || []).flatMap((item) => [
    item?.key,
    item?.name_zh,
    item?.amount,
    item?.discovered_amount,
    item?.undiscovered_amount,
  ]).filter(Boolean);
}

function stateTraitSearchParts(traits) {
  return (traits || []).flatMap((trait) => [
    trait?.category_zh,
    trait?.modifier_summary_zh,
    trait?.has_mapi ? "MAPI" : "",
    ...(trait?.categories || []).flatMap((category) => [category.key, category.name_zh]),
    ...(trait?.modifiers || []).flatMap((modifier) => [
      modifier.key,
      modifier.name_zh,
      modifier.desc_zh,
      modifier.value_zh,
      modifier.summary_zh,
    ]),
  ]).filter(Boolean);
}

function dynamicStateNameSearchParts(variants) {
  return (variants || []).flatMap((variant) => [
    variant.name_key,
    variant.name_zh,
    variant.trigger_raw,
  ]).filter(Boolean);
}

function resourceOptionToken(filter) {
  const iconKey = (filter.resources || filter.arableResources || filter.companyBuildings || [])[0] || "";
  const checked = state.resourceFilters.has(filter.key);
  return `
    <button class="filter-token filter-token-with-icon resource-filter-token" type="button" data-filter-token data-resource-filter="${escapeHtml(filter.key)}" aria-label="${escapeHtml(filter.label)}" title="${escapeHtml(filter.label)}" aria-pressed="${checked ? "true" : "false"}">
      ${buildingIconHtml(iconKey, filter.label)}
    </button>
  `;
}

function companyDlcOptionToken(option, checked = false) {
  const title = `${option.label} / ${option.title || option.key}`;
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
  if (state.search) parts.push(`搜索：${state.search}`);
  if (state.globalSearch) parts.push(`全局：${state.globalSearch}`);
  if (state.view === "country" && state.flags.size) parts.push(`状态 ${state.flags.size}`);
  if (state.view === "country" && state.tiers.size) parts.push(`位阶 ${state.tiers.size}`);
  if (state.view === "country" && state.types.size) parts.push(`类型 ${state.types.size}`);
  if (state.view !== "ideology" && state.strategicRegions.size) {
    parts.push(`${state.view === "culture" ? "本土战略区域" : state.view === "company" ? "相关战略区域" : "所在战略区域"} ${state.strategicRegions.size}`);
  }
  if (["country", "culture"].includes(state.view) && state.heritageGroups.size) parts.push(`传承组 ${state.heritageGroups.size}`);
  if (["country", "culture"].includes(state.view) && state.heritages.size) parts.push(`传承 ${state.heritages.size}`);
  if (["country", "culture"].includes(state.view) && state.languageGroups.size) parts.push(`语言组 ${state.languageGroups.size}`);
  if (["country", "culture"].includes(state.view) && state.languages.size) parts.push(`语言 ${state.languages.size}`);
  if ((state.view === "region" || state.view === "company") && state.resourceFilters.size) {
    parts.push(`${state.view === "company" ? "建筑" : "资源"} ${state.resourceFilters.size}`);
  }
  if (state.view === "company" && state.companyKinds.size) parts.push(`公司类型 ${state.companyKinds.size}`);
  if (state.view === "company" && state.includeIndustryCharter) parts.push("包含产业特许");
  if (state.view === "company" && state.companyPrestigeGoods.size) parts.push(`名贵商品 ${state.companyPrestigeGoods.size}`);
  if (state.view === "company" && state.companyDlcs.size) parts.push(`资料片 ${state.companyDlcs.size}`);
  if (state.view === "ideology" && state.ideologyTypes.size) parts.push(`类型 ${state.ideologyTypes.size}`);
  if (state.view === "ideology" && state.ideologyGroups.size) parts.push(`利益集团 ${state.ideologyGroups.size}`);
  if (state.view === "ideology" && state.ideologyOccurrences.size) parts.push(`出现方式 ${state.ideologyOccurrences.size}`);
  if (state.view === "ideology" && state.ideologyLawGroups.size) parts.push(`法律组 ${state.ideologyLawGroups.size}`);
  if (state.view === "law" && state.lawGroups.size) parts.push(`法律组 ${state.lawGroups.size}`);
  if (["country", "culture"].includes(state.view) && state.tradition) parts.push(`传统 ${getTraitName(state.tradition)}`);
  return parts.join("；");
}

function getTraitName(key) {
  return cultureTraitByKey.get(key)?.name_zh || key;
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
  return (a.name_zh || a.key || a.tag).localeCompare(b.name_zh || b.key || b.tag, "zh-Hans-CN") || (a.key || a.tag).localeCompare(b.key || b.tag);
}

function sortStrategicRegionRef(a, b) {
  return orderValue(strategicRegionOrderByKey, a.key) - orderValue(strategicRegionOrderByKey, b.key)
    || strategicRegionName(a).localeCompare(strategicRegionName(b), "zh-Hans-CN")
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
