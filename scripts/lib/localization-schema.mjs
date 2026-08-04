import crypto from "node:crypto";

export const SUPPORTED_LOCALES = Object.freeze(["zh-Hans", "en"]);

const localizedFieldAliases = new Map([
  ["name", "name"],
  ["desc", "description"],
  ["description", "description"],
  ["type", "type"],
  ["group_name", "groupName"],
  ["source_name", "sourceName"],
  ["label", "label"],
  ["summary", "summary"],
  ["value", "value"],
  ["adjective", "adjective"],
  ["tier", "tier"],
  ["country_type", "countryType"],
  ["category", "category"],
  ["company_kind", "companyKind"],
  ["prestige_goods_kind", "prestigeGoodsKind"],
  ["dlc_name", "dlcName"],
  ["modifier_summary", "modifierSummary"],
  ["condition_summary", "conditionSummary"],
  ["era_label", "eraLabel"],
  ["text", "text"],
  ["note", "note"],
]);

export function textTemplate(template, args = {}) {
  return { template, args };
}

export function localizationObjectId(value, parentId, index) {
  if (value?.id) return String(value.id);
  if (value?.key) return `${parentId || "item"}:${value.key}`;
  if (value?.tag) return `${parentId || "country"}:${value.tag}`;
  return `${parentId || "item"}:${index}`;
}

export function sha256Text(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function localizationId(objectId, field) {
  return `${objectId}.${field}`;
}

export function splitLocalizedTrees(projections) {
  const locales = Object.keys(projections || {});
  if (!locales.length) throw new Error("at least one localization projection is required");
  const primaryLocale = locales.includes("zh-Hans") ? "zh-Hans" : locales[0];
  const catalogs = Object.fromEntries(locales.map((locale) => [locale, {}]));
  const missing = Object.fromEntries(locales.map((locale) => [locale, []]));
  const values = Object.fromEntries(locales.map((locale) => [locale, projections[locale]]));
  const structure = splitValue(values, "$", "", 0, { catalogs, missing, primaryLocale, locales });
  return { structure, catalogs, missing };
}

export function collectLocalizationRefs(value, refs = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectLocalizationRefs(item, refs));
    return refs;
  }
  if (!value || typeof value !== "object") return refs;
  if (typeof value.message === "string") refs.add(value.message);
  if (typeof value.template === "string") {
    Object.values(value.args || {}).forEach((item) => collectLocalizationRefs(item, refs));
  }
  if (value.loc && typeof value.loc === "object") {
    Object.values(value.loc).forEach((item) => {
      if (typeof item === "string") refs.add(item);
    });
  }
  Object.entries(value).forEach(([key, item]) => {
    if (key !== "loc" && key !== "args") collectLocalizationRefs(item, refs);
  });
  return refs;
}

function splitValue(values, jsonPath, parentId, index, context) {
  const primary = values[context.primaryLocale];
  if (Array.isArray(primary)) return splitArray(values, jsonPath, parentId, context);
  if (primary && typeof primary === "object") return splitObject(values, jsonPath, parentId, index, context);
  for (const locale of context.locales) {
    if (!sameStructuralScalar(primary, values[locale])) {
      throw structuralMismatch(locale, jsonPath, primary, values[locale]);
    }
  }
  return primary;
}

function splitArray(values, jsonPath, parentId, context) {
  const primary = values[context.primaryLocale];
  for (const locale of context.locales) {
    if (!Array.isArray(values[locale])) throw structuralMismatch(locale, jsonPath, primary, values[locale]);
  }

  const keyed = primary.every(isStableObject)
    && context.locales.every((locale) => values[locale].every(isStableObject));
  if (!keyed) {
    return primary.map((item, index) => splitValue(
      Object.fromEntries(context.locales.map((locale) => [locale, values[locale][index]])),
      `${jsonPath}[${index}]`,
      parentId,
      index,
      context,
    ));
  }

  const maps = Object.fromEntries(context.locales.map((locale) => [
    locale,
    new Map(values[locale].map((item, index) => [localizationObjectId(item, parentId, index), item])),
  ]));
  const primaryIds = [...maps[context.primaryLocale].keys()];
  for (const locale of context.locales) {
    const ids = maps[locale];
    if (ids.size !== primaryIds.length || primaryIds.some((id) => !ids.has(id))) {
      throw new Error(`${locale} structure mismatch at ${jsonPath}: stable array identifiers differ`);
    }
  }
  return primaryIds.map((id, index) => splitValue(
    Object.fromEntries(context.locales.map((locale) => [locale, maps[locale].get(id)])),
    `${jsonPath}[${index}]`,
    parentId,
    index,
    context,
  ));
}

function splitObject(values, jsonPath, parentId, index, context) {
  const primary = values[context.primaryLocale];
  for (const locale of context.locales) {
    const candidate = values[locale];
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw structuralMismatch(locale, jsonPath, primary, candidate);
    }
  }
  const objectId = localizationObjectId(primary, parentId, index);
  const localizedByField = new Map();
  const rawKeys = new Set();
  for (const locale of context.locales) {
    for (const key of Object.keys(values[locale])) {
      const field = normalizedLocalizedField(key);
      if (field) {
        if (!localizedByField.has(field)) localizedByField.set(field, new Map());
        localizedByField.get(field).set(locale, key);
      } else {
        rawKeys.add(key);
      }
    }
  }

  const result = {};
  for (const key of [...rawKeys].sort()) {
    const childValues = Object.fromEntries(context.locales.map((locale) => [locale, values[locale][key]]));
    if (context.locales.some((locale) => !Object.hasOwn(values[locale], key))) {
      throw new Error(`${context.locales.find((locale) => !Object.hasOwn(values[locale], key))} structure mismatch at ${jsonPath}.${key}: key is missing`);
    }
    result[key] = splitValue(childValues, `${jsonPath}.${key}`, objectId, 0, context);
  }
  const loc = {};
  for (const [field, keys] of localizedByField) {
    const id = localizationId(objectId, field);
    loc[field] = id;
    for (const locale of context.locales) {
      const sourceKey = keys.get(locale) || keys.get(context.primaryLocale);
      const value = sourceKey ? values[locale][sourceKey] : "";
      context.catalogs[locale][id] = typeof value === "string" ? value : "";
      if (!context.catalogs[locale][id]) context.missing[locale].push(id);
    }
  }
  if (Object.keys(loc).length) result.loc = loc;
  return result;
}

function normalizedLocalizedField(key) {
  const dotted = key.match(/^([A-Za-z_]+)\.(?:zh-Hans|zh|en)$/);
  const suffixed = key.match(/^([A-Za-z_]+)_(?:zh|en)$/);
  const base = dotted?.[1] || suffixed?.[1];
  return base ? localizedFieldAliases.get(base) || camelCase(base) : "";
}

function camelCase(value) {
  return value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function isStableObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && (value.id || value.key || value.tag));
}

function sameStructuralScalar(left, right) {
  return Object.is(left, right);
}

function structuralMismatch(locale, jsonPath, expected, actual) {
  return new Error(`${locale} structure mismatch at ${jsonPath}: ${JSON.stringify(expected)} !== ${JSON.stringify(actual)}`);
}
