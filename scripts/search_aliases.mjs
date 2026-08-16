const officialAliasRefs = {
  country: (item) => item.dynamicNameVariants || [],
  region: (item) => item.dynamic_name_variants || [],
  company: (item) => item.dynamic_company_type_names || [],
};

export function searchAliasFields(kind, item, messagesByLocale, baseNames) {
  const fields = {};
  const refs = officialAliasRefs[kind]?.(item) || [];
  const aliases = Object.fromEntries(Object.keys(messagesByLocale || {}).map((locale) => [
    locale,
    unique(refs
      .map((ref) => messagesByLocale?.[locale]?.[ref?.loc?.name] || "")
      .filter((value) => value && value !== baseNames?.[locale])),
  ]).filter(([, values]) => values.length));
  if (Object.keys(aliases).length) fields.aliases = aliases;

  const internalAliases = kind === "building"
    ? unique((item.aliases || []).map((value) => String(value || "").trim()).filter(Boolean))
    : [];
  if (internalAliases.length) fields.internalAliases = internalAliases;
  return fields;
}

function unique(values) {
  return [...new Set(values)];
}
