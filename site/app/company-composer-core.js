(() => {
  function composeCompanyBuildings({ companies = [], selectedCompanyKeys = [], selectedExtensions = {}, buildingGroups = [] } = {}) {
    const companyByKey = new Map((companies || []).filter((company) => company?.key).map((company) => [company.key, company]));
    const selectedCompanies = uniqueExistingCompanies(selectedCompanyKeys, companyByKey);
    const normalizedExtensions = normalizeSelectedExtensions(selectedCompanies, selectedExtensions);
    const buildingSummary = summarizeBuildings(selectedCompanies, normalizedExtensions, buildingGroups);
    return {
      selectedCompanies,
      buildingGroups: buildingSummary.groups,
      unclassifiedBuildingKeys: buildingSummary.unclassifiedBuildingKeys,
      extensionRows: extensionRows(selectedCompanies, normalizedExtensions),
      prestigeGoods: uniqueReferencedItems(selectedCompanies, "possible_prestige_goods"),
      cultures: uniqueReferencedItems(selectedCompanies, "referenced_cultures"),
      countries: uniqueReferencedItems(selectedCompanies, "referenced_countries"),
      prosperityGroups: aggregateProsperityModifiers(selectedCompanies),
    };
  }

  function uniqueExistingCompanies(selectedCompanyKeys, companyByKey) {
    const seen = new Set();
    const result = [];
    for (const key of selectedCompanyKeys || []) {
      if (!key || seen.has(key) || !companyByKey.has(key)) continue;
      seen.add(key);
      result.push(companyByKey.get(key));
    }
    return result;
  }

  function normalizeSelectedExtensions(companies, selectedExtensions) {
    const result = {};
    for (const company of companies) {
      const selectedKey = selectedExtensions?.[company.key];
      const optionKeys = new Set((company.extension_building_types || []).map((item) => item?.key).filter(Boolean));
      if (selectedKey && optionKeys.has(selectedKey)) result[company.key] = selectedKey;
    }
    return result;
  }

  function summarizeBuildings(companies, selectedExtensions, buildingGroups) {
    const selectedKeys = new Set();
    for (const company of companies) {
      for (const item of company.building_types || []) if (item?.key) selectedKeys.add(item.key);
      if (selectedExtensions[company.key]) selectedKeys.add(selectedExtensions[company.key]);
    }
    const classifiedKeys = new Set();
    const groups = [];
    for (const group of buildingGroups || []) {
      const buildingKeys = (group.buildingKeys || []).filter((key) => selectedKeys.has(key));
      for (const key of buildingKeys) classifiedKeys.add(key);
      if (buildingKeys.length) groups.push({ key: group.key, buildingKeys });
    }
    return {
      groups,
      unclassifiedBuildingKeys: [...selectedKeys].filter((key) => !classifiedKeys.has(key)),
    };
  }

  function extensionRows(companies, selectedExtensions) {
    return companies.flatMap((company) => {
      const optionKeys = (company.extension_building_types || []).map((item) => item?.key).filter(Boolean);
      return optionKeys.length ? [{
        companyKey: company.key,
        optionKeys,
        selectedExtensionKey: selectedExtensions[company.key] || "",
      }] : [];
    });
  }

  function uniqueReferencedItems(companies, field) {
    const seen = new Set();
    const result = [];
    for (const company of companies) {
      for (const item of company[field] || []) {
        if (!item?.key || seen.has(item.key)) continue;
        seen.add(item.key);
        result.push(item);
      }
    }
    return result;
  }

  function aggregateProsperityModifiers(companies) {
    const groups = new Map();
    for (const company of companies) {
      for (const modifier of company.prosperity_modifiers || []) {
        if (!modifier?.key) continue;
        const categoryKey = modifier.category?.key || "other";
        if (!groups.has(categoryKey)) groups.set(categoryKey, { key: categoryKey, category: modifier.category || { key: categoryKey }, numeric: new Map(), nonNumeric: [] });
        const group = groups.get(categoryKey);
        const numericValue = typeof modifier.value === "number" && Number.isFinite(modifier.value) ? modifier.value : null;
        if (numericValue === null) {
          group.nonNumeric.push({ ...modifier, sourceCompanyKey: company.key });
          continue;
        }
        if (!group.numeric.has(modifier.key)) group.numeric.set(modifier.key, { ...modifier, value: 0 });
        const aggregate = group.numeric.get(modifier.key);
        aggregate.value = roundModifierValue(aggregate.value + numericValue);
        aggregate.value_raw = String(aggregate.value);
      }
    }
    return [...groups.values()].map((group) => ({
      key: group.key,
      category: group.category,
      modifiers: [...group.numeric.values(), ...group.nonNumeric],
    }));
  }

  function roundModifierValue(value) {
    return Math.round((value + Number.EPSILON) * 1e12) / 1e12;
  }

  window.COMPANY_COMPOSER_CORE = { composeCompanyBuildings };
})();
