export function withBaseGameLocalization(catalog, baseCatalog, keys, locale) {
  const scoped = new Map(catalog || []);
  for (const key of keys || []) {
    if (!baseCatalog?.has(key)) {
      throw new Error(`base-game localization is missing: ${locale} ${key}`);
    }
    scoped.set(key, baseCatalog.get(key));
  }
  return scoped;
}
