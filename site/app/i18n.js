const localeConfig = window.VICDATA_LOCALE_CONFIG || { storageKey: "vicdata-language", supported: [], fallback: "en" };
const supportedLocaleIds = new Set((localeConfig.supported || []).map((item) => item.id));
const localeRuntime = window.localeRuntime || {
  requested: "",
  current: "zh-Hans",
  messages: {},
  englishMessages: {},
  dataMessages: {},
  loadedChunks: new Set(),
  requestId: 0,
  collator: new Intl.Collator("zh-Hans-CN"),
  numberFormat: new Intl.NumberFormat("zh-Hans-CN"),
  pluralRules: new Intl.PluralRules("zh-Hans-CN"),
};
window.localeRuntime = localeRuntime;
const missingMessageWarnings = new Set();

function selectInitialLocale({ search = location.search, stored = localStorage.getItem(localeConfig.storageKey), languages = navigator.languages } = {}) {
  const requested = new URLSearchParams(search || "").get("lang");
  if (supportedLocaleIds.has(requested)) return requested;
  if (supportedLocaleIds.has(stored)) return stored;
  return (languages || []).some((value) => /^zh(?:-|$)/i.test(value)) ? "zh-Hans" : "en";
}

function localeLabel(locale) {
  return localeConfig.supported.find((item) => item.id === locale)?.label || locale;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${src}${src.includes("?") ? "&" : "?"}v=20260810-global-search-interest-group-flavors1`;
    script.async = true;
    script.onload = () => { script.remove(); resolve(); };
    script.onerror = () => { script.remove(); reject(new Error(`Unable to load ${src}`)); };
    document.head.appendChild(script);
  });
}

async function loadUiLocale(locale) {
  const entry = localeConfig.supported.find((item) => item.id === locale);
  if (!entry) throw new Error(`Unsupported locale ${locale}`);
  if (!window.VICDATA_UI_LOCALES?.[locale]) await loadScript(entry.ui);
  return window.VICDATA_UI_LOCALES?.[locale]?.messages || {};
}

function mergeLocaleMessages(target, messages, locale) {
  for (const [key, value] of Object.entries(messages || {})) {
    if (Object.hasOwn(target, key) && target[key] !== value) throw new Error(`Conflicting ${locale} message ${key}`);
    target[key] = value;
  }
  return target;
}

function warnMissingOnce(key) {
  if (missingMessageWarnings.has(key)) return;
  missingMessageWarnings.add(key);
  console.warn(`Missing localization message: ${key}`);
}

function translateMessage(messageId, fallbackKey) {
  if (!messageId) return fallbackKey;
  const value = localeRuntime.messages?.[messageId]
    ?? localeRuntime.dataMessages?.[localeRuntime.current]?.[messageId]
    ?? localeRuntime.englishMessages?.[messageId]
    ?? localeRuntime.dataMessages?.en?.[messageId];
  if (value) return value;
  warnMissingOnce(`${localeRuntime.current}:${messageId}`);
  return fallbackKey === undefined ? messageId : fallbackKey;
}

function renderTextSpec(spec) {
  if (spec == null) return "";
  if (typeof spec === "string" || typeof spec === "number") return String(spec);
  if (spec.message) return translateMessage(spec.message, Object.hasOwn(spec, "fallback") ? spec.fallback : spec.message);
  if (spec.template) return t(spec.template, spec.args || {});
  return "";
}

function t(key, args = {}) {
  const template = translateMessage(key, key);
  return String(template).replace(/\{(\w+)\}/g, (_, name) => renderTextSpec(args[name]));
}

function tc(key, count, args = {}) {
  const category = localeRuntime.pluralRules.select(Number(count));
  return t(`${key}.${category}`, { ...args, count });
}

function entityText(entity, field = "name", fallbackKey = entity?.key || entity?.tag || "") {
  const message = field === "name" && entity?.loc?.displayName
    ? entity.loc.displayName
    : entity?.loc?.[field];
  return translateMessage(message, fallbackKey);
}

function stableEntityKey(entity) {
  return String(entity?.id || entity?.key || entity?.tag || "");
}

function localizedCompare(left, right) {
  return localeRuntime.collator.compare(String(left || ""), String(right || ""));
}

function localizedNumber(value) {
  return localeRuntime.numberFormat.format(Number(value || 0));
}

function searchNames(id) {
  const entry = window.VIC3_SEARCH_INDEX?.entries?.find((item) => item.id === id);
  return entry ? [entry.key, ...Object.values(entry.names || {})] : [id];
}

function matchesLocalizedQuery(entity, query) {
  const text = String(query || "").trim().toLocaleLowerCase();
  return !text || searchNames(entity?.id || stableEntityKey(entity)).some((value) => String(value).toLocaleLowerCase().includes(text));
}

function setDocumentLocale(locale) {
  document.documentElement.lang = locale;
}

function updateLocaleUrl(locale) {
  const url = new URL(location.href);
  url.searchParams.set("lang", locale);
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function closeLanguageMenu() {
  if (!els.languageMenu) return;
  els.languageMenu.hidden = true;
  els.languageMenuButton?.setAttribute("aria-expanded", "false");
}

async function initializeLocale() {
  localeRuntime.requested = selectInitialLocale();
  localeRuntime.current = "zh-Hans";
  localeRuntime.messages = await loadUiLocale("zh-Hans");
  localeRuntime.englishMessages = await loadUiLocale("en");
  configureLocaleFormats("zh-Hans");
  setDocumentLocale("zh-Hans");
}

async function activateInitialLocaleAfterDataIndex() {
  const locale = supportedLocaleIds.has(localeRuntime.requested) ? localeRuntime.requested : "zh-Hans";
  const messages = await loadUiLocale(locale);
  const nextDataMessages = { ...(localeRuntime.dataMessages[locale] || {}) };
  const nextCacheKeys = await ensureLocaleChunks(dataChunksForCurrentRoute(), locale, nextDataMessages);
  localeRuntime.current = locale;
  localeRuntime.messages = messages;
  localeRuntime.dataMessages[locale] = nextDataMessages;
  nextCacheKeys.forEach((key) => localeRuntime.loadedChunks.add(key));
  configureLocaleFormats(locale);
  setDocumentLocale(locale);
  updateLocaleUrl(locale);
}

async function switchLocale(locale) {
  if (!supportedLocaleIds.has(locale)) {
    closeLanguageMenu();
    return;
  }
  if (locale === localeRuntime.current) {
    localeRuntime.requestId += 1;
    closeLanguageMenu();
    return;
  }
  const requestId = ++localeRuntime.requestId;
  const previousLocale = localeRuntime.current;
  const previousMessages = localeRuntime.messages;
  let previousViewState = null;
  try {
    const messages = await loadUiLocale(locale);
    const nextDataMessages = { ...(localeRuntime.dataMessages[locale] || {}) };
    const nextCacheKeys = await ensureLocaleChunks(dataChunksForCurrentRoute(), locale, nextDataMessages);
    if (requestId !== localeRuntime.requestId) return;
    previousViewState = captureLocaleViewState();
    localeRuntime.current = locale;
    localeRuntime.messages = messages;
    localeRuntime.dataMessages[locale] = nextDataMessages;
    nextCacheKeys.forEach((key) => localeRuntime.loadedChunks.add(key));
    configureLocaleFormats(locale);
    setDocumentLocale(locale);
    localStorage.setItem(localeConfig.storageKey, locale);
    updateLocaleUrl(locale);
    syncStaticUiText();
    applyLoadedDataset(data, mapData, { preserveState: true });
    renderFilterOptions?.();
    render?.();
    restoreLocaleViewState(previousViewState, requestId);
  } catch (error) {
    if (requestId === localeRuntime.requestId) {
      localeRuntime.current = previousLocale;
      localeRuntime.messages = previousMessages;
      console.warn(t("ui.localeLoadFailed", { locale: localeLabel(locale) }), error);
    }
  } finally {
    closeLanguageMenu();
  }
}

function captureLocaleViewState() {
  return {
    filtersScrollTop: document.querySelector(".filters")?.scrollTop || 0,
    resultsScrollTop: document.querySelector(".results")?.scrollTop || 0,
    detailScrollTop: els.detail?.scrollTop || 0,
    detailScrollNode: els.detail?.firstElementChild || null,
    pageScrollTop: window.scrollY || 0,
  };
}

function restoreLocaleViewState(viewState, requestId) {
  const restore = () => {
    if (requestId !== localeRuntime.requestId) return;
    const filters = document.querySelector(".filters");
    const results = document.querySelector(".results");
    if (filters) filters.scrollTop = viewState.filtersScrollTop;
    if (results) results.scrollTop = viewState.resultsScrollTop;
    const detail = els.detail;
    if (detail) {
      detail.scrollTop = viewState.detailScrollTop;
      detail.firstElementChild?.scrollTo?.({ top: viewState.detailScrollTop, behavior: "instant" });
    }
    window.scrollTo(0, viewState.pageScrollTop);
  };
  restore();
  requestAnimationFrame(restore);
}

function configureLocaleFormats(locale) {
  const collator = localeConfig.supported.find((item) => item.id === locale)?.collator || "en";
  localeRuntime.collator = new Intl.Collator(collator);
  localeRuntime.numberFormat = new Intl.NumberFormat(collator);
  localeRuntime.pluralRules = new Intl.PluralRules(collator);
}

function syncStaticUiText() {
  document.querySelectorAll("[data-i18n]").forEach((node) => setOptionalText(node, t(node.dataset.i18n)));
  document.querySelectorAll("[data-i18n-title]").forEach((node) => node.title = t(node.dataset.i18nTitle));
  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel)));
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder)));
}
