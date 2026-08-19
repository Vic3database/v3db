const COMPANY_SOLVER_PAGE_SIZE = 20;
const COMPANY_SOLVER_MAX_COMPANIES = 7;
let companySolverWorker = null;

function solverT(key, fallback, args) {
  const template = translateMessage(key, fallback);
  return String(template).replace(/\{(\w+)\}/g, (_, name) => renderTextSpec((args || {})[name]));
}

function companySolverAvailable() {
  return companies.length > 0 && (Boolean(standaloneSiteConfig) || loadedDataVersion === "1.13.11");
}

async function setCompanySolverView() {
  if (!companySolverAvailable()) return;
  changeBoard("company", "companySolver");
  state.selectedCompany = "";
  replaceHash("/company/solver");
  await ensureDataChunksForRoute();
  render();
}

function companySolverResetResults(status) {
  state.companySolver.status = status || "idle";
  state.companySolver.page = 1;
  state.companySolver.pageCount = 0;
  state.companySolver.total = 0;
  state.companySolver.solutions = [];
  state.companySolver.allSolutions = [];
  state.companySolver.companyUsage = [];
  state.companySolver.progress = { visited: 0, solutions: 0, found: 0 };
  state.companySolver.selectedSolution = null;
  state.companySolver.error = "";
}

function companySolverCancel() {
  if (!companySolverWorker) return;
  companySolverWorker.terminate();
  companySolverWorker = null;
}

function companySolverInvalidate() {
  companySolverCancel();
  state.companySolver.requestId += 1;
  companySolverResetResults("dirty");
}

function ensureCompanySolverWorker() {
  if (companySolverWorker) return companySolverWorker;
  let worker;
  try {
    worker = new Worker("app/company-solver-worker.js?v=20260819-company-prestige-search1", { type: "module" });
  } catch (error) {
    return null;
  }
  companySolverWorker = worker;
  worker.addEventListener("message", (event) => {
    if (worker !== companySolverWorker) return;
    const message = event.data || {};
    if (message.requestId !== state.companySolver.requestId) return;
    if (message.type === "progress") {
      state.companySolver.status = "running";
      state.companySolver.progress = message;
      renderCompanySolverBoard();
    } else if (message.type === "complete") {
      if (!message.total && state.companySolver.autoCompanyCount && state.companySolver.companyCount < Math.min(COMPANY_SOLVER_MAX_COMPANIES, solverCompaniesForRequest().length)) {
        state.companySolver.companyCount += 1;
        runCompanySolverRequest(state.companySolver.requestId);
        return;
      }
      state.companySolver.status = "complete";
      state.companySolver.total = message.total;
      state.companySolver.pageCount = message.pageCount;
      state.companySolver.companyUsage = message.companyUsage || [];
      renderCompanySolverBoard();
    } else if (message.type === "page") {
      state.companySolver.page = message.page;
      state.companySolver.solutions = message.solutions || [];
      renderCompanySolverBoard();
      if (state.companySolver.selectedSolution) renderCompanySolverDetail();
    } else if (message.type === "error") {
      const failedRequestId = state.companySolver.requestId;
      companySolverWorker = null;
      worker.terminate();
      if (state.companySolver.status === "running") {
        runCompanySolverFallback(failedRequestId);
        return;
      }
      state.companySolver.status = "error";
      state.companySolver.error = message.message || t("board.company.solverError", "求解失败");
      renderCompanySolverBoard();
    }
  });
  worker.addEventListener("error", (event) => {
    if (worker !== companySolverWorker) return;
    const failedRequestId = state.companySolver.requestId;
    companySolverWorker = null;
    worker.terminate();
    if (state.companySolver.status === "running") {
      runCompanySolverFallback(failedRequestId);
      return;
    }
    state.companySolver.status = "error";
    state.companySolver.error = (event.message ? "Worker: " + event.message + "；" : "") + t("board.company.solverError", "求解失败");
    renderCompanySolverBoard();
  });
  return worker;
}

function runCompanySolver() {
  if (!companySolverAvailable() || !state.companySolver.selectedBuildings.size) return;
  companySolverCancel();
  state.companySolver.requestId += 1;
  const requestId = state.companySolver.requestId;
  state.companySolver.usageOpen = false;
  companySolverResetResults("running");
  state.companySolver.companyCount = Math.max(1, Number(state.companySolver.companyCount) || 1);
  runCompanySolverRequest(requestId);
}

function runCompanySolverRequest(requestId) {
  const worker = ensureCompanySolverWorker();
  if (!worker) {
    render();
    runCompanySolverFallback(requestId);
    return;
  }
  worker.postMessage({
    type: "run",
    requestId,
    targetKeys: [...state.companySolver.selectedBuildings],
    companies: solverCompaniesForRequest().map((company) => ({ ...company, name: entityText(company, "name", company.key) })),
    companyCount: state.companySolver.companyCount,
    requiredPrestigeGroups: solverPrestigeGoodGroups(),
  });
  render();
}

async function runCompanySolverFallback(requestId) {
  if (!window.COMPANY_SOLVER_CORE?.solveCompanyCombinationsAsync) {
    state.companySolver.status = "error";
    state.companySolver.error = solverT("board.company.solverError", "求解失败");
    renderCompanySolverBoard();
    return;
  }
  try {
    const model = window.COMPANY_SOLVER_CORE.createCompanySolverModel(solverCompaniesForRequest().map((company) => ({ ...company, name: entityText(company, "name", company.key) })), [...state.companySolver.selectedBuildings]);
    const result = await window.COMPANY_SOLVER_CORE.solveCompanyCombinationsAsync(model, {
      companyCount: state.companySolver.companyCount,
      requiredPrestigeGroups: solverPrestigeGoodGroups(),
      onProgress: (progress) => {
        if (requestId !== state.companySolver.requestId) return;
        state.companySolver.status = "running";
        state.companySolver.progress = progress;
        if (progress.visited % 8192 === 0) renderCompanySolverBoard();
      },
    });
    if (requestId !== state.companySolver.requestId) return;
    if (!result.total && state.companySolver.autoCompanyCount && state.companySolver.companyCount < Math.min(COMPANY_SOLVER_MAX_COMPANIES, solverCompaniesForRequest().length)) {
      state.companySolver.companyCount += 1;
      runCompanySolverRequest(requestId);
      return;
    }
    state.companySolver.status = "complete";
    state.companySolver.total = result.total;
    state.companySolver.pageCount = Math.max(1, Math.ceil(result.total / COMPANY_SOLVER_PAGE_SIZE));
    state.companySolver.allSolutions = result.solutions;
    state.companySolver.companyUsage = result.companyUsage || [];
    state.companySolver.solutions = result.solutions.slice(0, COMPANY_SOLVER_PAGE_SIZE);
    renderCompanySolverBoard();
  } catch (error) {
    state.companySolver.status = "error";
    state.companySolver.error = error instanceof Error ? error.message : String(error);
    renderCompanySolverBoard();
  }
}

function requestCompanySolverPage(page) {
  if (state.companySolver.status !== "complete") return;
  const targetPage = Math.max(1, Math.min(state.companySolver.pageCount || 1, Number(page) || 1));
  if (!companySolverWorker) {
    state.companySolver.page = targetPage;
    const start = (targetPage - 1) * COMPANY_SOLVER_PAGE_SIZE;
    state.companySolver.solutions = state.companySolver.allSolutions.slice(start, start + COMPANY_SOLVER_PAGE_SIZE);
    renderCompanySolverBoard();
    return;
  }
  companySolverWorker.postMessage({ type: "page", requestId: state.companySolver.requestId, page: targetPage });
}

function renderCompanySolverPagination(solver) {
  if (solver.status !== "complete") return "";
  return '<div class="company-solver-pagination"><button type="button" data-company-solver-page="prev" ' + (solver.page <= 1 ? "disabled" : "") + '>‹</button><span>' + escapeHtml(solverT("board.company.solverPage", "第 {page} / {pages} 页", { page: solver.page, pages: solver.pageCount })) + '</span><button type="button" data-company-solver-page="next" ' + (solver.page >= solver.pageCount ? "disabled" : "") + '>›</button></div>';
}

function renderCompanySolverUsage(solver) {
  if (solver.status !== "complete" || !solver.total || !solver.companyUsage?.length) return "";
  const rows = solver.companyUsage.map(({ companyKey, count }) => {
    const company = byCompany.get(companyKey);
    if (!company) return "";
    const percent = Math.round((count / solver.total) * 10000) / 100;
    return '<div class="company-solver-usage-item"><span class="company-solver-usage-company">' + solverCompanyIcon(company) + '<span>' + escapeHtml(solverCompanyLabel(company)) + '</span></span><span class="company-solver-usage-count">' + escapeHtml(localizedNumber(count)) + ' / ' + escapeHtml(localizedNumber(solver.total)) + '（' + escapeHtml(localizedNumber(percent)) + '%）</span></div>';
  }).join("");
  return rows
    ? '<details class="company-solver-usage" data-company-solver-usage' + (solver.usageOpen ? " open" : "") + '><summary>' + escapeHtml(solverT("board.company.solverUsageTitle", "公司使用率")) + '</summary><div class="company-solver-usage-list">' + rows + '</div></details>'
    : "";
}

function renderCompanySolverPrestigeFilters() {
  const selected = state.companySolver.selectedPrestigeGoods;
  const availableKeys = new Set(solverAvailablePrestigeGoods().map((item) => item.key));
  const referencedKeys = new Set(companies.flatMap((company) => (company.possible_prestige_goods || []).map((item) => item.key || item)).filter(Boolean));
  const categoryOrder = ["staple", "industrial", "luxury", "military", "pop", "local", "other"];
  const goodOrder = new Map(goods.map((good, index) => [good.key, index]));
  const byCategory = new Map();
  for (const item of prestigeGoods) {
    if (!referencedKeys.has(item.key)) continue;
    const baseGood = goodByKey.get(item.base_good_key);
    const category = baseGood?.category || "other";
    if (!byCategory.has(category)) byCategory.set(category, new Map());
    const byBaseGood = byCategory.get(category);
    if (!byBaseGood.has(item.base_good_key)) byBaseGood.set(item.base_good_key, []);
    byBaseGood.get(item.base_good_key).push(item);
  }
  const orderedCategories = [...byCategory.entries()].sort(([left], [right]) => {
    const leftIndex = categoryOrder.indexOf(left);
    const rightIndex = categoryOrder.indexOf(right);
    return (leftIndex < 0 ? categoryOrder.length : leftIndex) - (rightIndex < 0 ? categoryOrder.length : rightIndex) || left.localeCompare(right);
  });
  const categories = orderedCategories.map(([category, byBaseGood]) => {
    const groups = [...byBaseGood.entries()].sort(([left], [right]) => {
      return (goodOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (goodOrder.get(right) ?? Number.MAX_SAFE_INTEGER) || left.localeCompare(right);
    }).map(([baseKey, items]) => '<div class="company-solver-prestige-group" data-company-solver-prestige-group="' + escapeHtml(baseKey) + '"><div class="company-solver-prestige-options">' + items.slice().sort((left, right) => entityText(left, "name", left.key).localeCompare(entityText(right, "name", right.key)) || left.key.localeCompare(right.key)).map((item) => {
      const enabled = availableKeys.has(item.key);
      const label = entityText(item, "name", item.key);
      return '<label class="company-solver-prestige-option' + (enabled ? "" : " is-disabled") + '" title="' + escapeHtml(label) + '"><input type="checkbox" data-company-solver-prestige="' + escapeHtml(item.key) + '" aria-label="' + escapeHtml(label) + '"' + (selected.has(item.key) ? " checked" : "") + (enabled ? "" : " disabled") + '>' + goodsIconHtml(item, "company-solver-prestige-filter-icon") + '</label>';
    }).join("") + '</div></div>').join("");
    const categoryLabel = translateMessage("enum.goodCategory." + category, category);
    return '<section class="company-solver-prestige-category" data-company-solver-prestige-category="' + escapeHtml(category) + '"><h3>' + escapeHtml(categoryLabel) + '</h3><div class="company-solver-prestige-category-groups">' + groups + '</div></section>';
  }).join("");
  return '<details class="company-solver-prestige-filter" data-company-solver-prestige-filter' + (state.companySolver.prestigeFilterOpen ? " open" : "") + '><summary>' + escapeHtml(solverT("board.company.solverPrestigeFilter", "名贵商品")) + (selected.size ? " · " + selected.size : "") + '</summary><div class="company-solver-prestige-groups">' + categories + '</div></details>';
}

function solverBuildingRecord(key) {
  return buildingRecordByKey.get(key) || { key: key, loc: { name: "building:" + key + ".name" } };
}

function solverBuildingLabel(key) {
  return entityText(solverBuildingRecord(key), "name", key);
}

function solverCompanyLabel(company) {
  return entityText(company, "name", company?.key || solverT("entity.company", "公司"));
}

function solverCompanyHasCultureCountryRestriction(company) {
  return (company.referenced_cultures || []).length > 0 || (company.referenced_countries || []).length > 0;
}

function solverCompaniesForRequest() {
  return companies.filter((company) => {
    if (state.companySolver.unrestrictedOnly && solverCompanyHasCultureCountryRestriction(company)) return false;
    if (state.companySolver.excludeConstructionCompany && company.key === "company_construction_power_bloc") return false;
    return true;
  });
}

function solverPrestigeGoodGroups() {
  const availableKeys = new Set(solverAvailablePrestigeGoods().map((item) => item.key));
  const groups = new Map();
  for (const item of prestigeGoods) {
    if (!state.companySolver.selectedPrestigeGoods.has(item.key) || !availableKeys.has(item.key)) continue;
    if (!groups.has(item.base_good_key)) groups.set(item.base_good_key, []);
    groups.get(item.base_good_key).push(item.key);
  }
  return [...groups.values()];
}

function solverAvailablePrestigeGoods() {
  const selected = state.companySolver.selectedBuildings;
  const availableBaseGoods = new Set(goods.filter((good) => (good.producing_buildings || []).some((building) => selected.has(building.key))).map((good) => good.key));
  return prestigeGoods.filter((item) => availableBaseGoods.has(item.base_good_key));
}

function solverCompanyIcon(company) {
  return '<span class="company-solver-icon" title="' + escapeHtml(solverCompanyLabel(company)) + '">' + companyIconHtml(company) + "</span>";
}

function solverBuildingIcon(key, className) {
  const name = className || "company-solver-building-icon";
  return '<span class="' + name + '" title="' + escapeHtml(solverBuildingLabel(key)) + '">' + (buildingIconHtml(key) || escapeHtml(solverBuildingLabel(key))) + "</span>";
}

function solverPrestigeGoods(companiesForSolution) {
  const seen = new Set();
  return companiesForSolution.flatMap((company) => company.possible_prestige_goods || []).filter((item) => {
    if (!item?.key || seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

function solverPrestigeGoodsHtml(companiesForSolution, linked) {
  const items = solverPrestigeGoods(companiesForSolution);
  if (!items.length) return '<span class="company-solver-empty">' + escapeHtml(solverT("ui.none", "无")) + "</span>";
  return items.map((item) => {
    const label = entityText(item, "name", item.key);
    const content = goodsIconHtml(item, "company-solver-prestige-icon") + "<span>" + escapeHtml(label) + "</span>";
    const baseKey = prestigeGoodByKey.get(item.key)?.base_good_key;
    if (linked && baseKey) return '<a class="company-solver-prestige-item" href="#/goods/' + encodeURIComponent(baseKey) + '">' + content + "</a>";
    return '<span class="company-solver-prestige-item" title="' + escapeHtml(label) + '">' + content + "</span>";
  }).join("");
}

function solverRestrictions(companiesForSolution) {
  const cultures = new Map();
  const countries = new Map();
  for (const company of companiesForSolution) {
    for (const item of company.referenced_cultures || []) cultures.set(item.key, item);
    for (const item of company.referenced_countries || []) countries.set(item.key || item.tag, item);
  }
  return { cultures: [...cultures.values()], countries: [...countries.values()] };
}

function solverCompanyExtensionGroups(company) {
  const declaredGroups = Array.isArray(company.choice_groups)
    ? company.choice_groups
    : Array.isArray(company.choiceGroups)
      ? company.choiceGroups
      : [{ options: company.extension_building_types || [] }];
  return declaredGroups.map((group) => (group.options || []).map((item) => typeof item === "string" ? item : item?.key || item?.id?.replace(/^building:/, "")).filter(Boolean)).filter((keys) => keys.length);
}

function solverRestrictionText(companiesForSolution) {
  const restrictions = solverRestrictions(companiesForSolution);
  return [...restrictions.cultures.map((item) => entityText(item)), ...restrictions.countries.map((item) => entityText(item, "name", item.tag || item.key))].filter(Boolean).join("、");
}

function solverRestrictionHtml(companiesForSolution, linked) {
  const restrictions = solverRestrictions(companiesForSolution);
  const cultureHtml = restrictions.cultures.map((item) => linked ? '<a href="#/culture/' + encodeURIComponent(item.key) + '">' + escapeHtml(entityText(item)) + "</a>" : "<span>" + escapeHtml(entityText(item)) + "</span>");
  const countryHtml = restrictions.countries.map((item) => {
    const key = item.tag || item.key;
    return linked ? '<a href="#/country/' + encodeURIComponent(key) + '">' + escapeHtml(entityText(item, "name", key)) + "</a>" : "<span>" + escapeHtml(entityText(item, "name", key)) + "</span>";
  });
  return cultureHtml.concat(countryHtml).join("、");
}

function solverSolutionBuildingGroups(solution) {
  const targets = new Set(state.companySolver.selectedBuildings);
  const solutionCompanies = solution.companyKeys.map((key) => byCompany.get(key)).filter(Boolean);
  const fixed = new Set(solutionCompanies.flatMap((company) => (company.building_types || []).map((item) => item.key)));
  const extra = [...fixed].filter((key) => !targets.has(key));
  const optionalGroups = solutionCompanies.flatMap((company, index) => {
    const selected = new Set(solution.selectedExtensionKeys[index] || []);
    return solverCompanyExtensionGroups(company).map((keys) => keys.filter((key) => !selected.has(key) && !targets.has(key))).filter((keys) => keys.length);
  });
  return { targets: [...targets], extra, optionalGroups };
}

function solverBuildingLine(keys, optional, linked) {
  const content = keys.map((key) => {
    const icon = solverBuildingIcon(key);
    return linked
      ? '<a class="company-solver-building-link" href="#/building/' + encodeURIComponent(key) + '">' + icon + "</a>"
      : icon;
  }).join("");
  if (!content) return "";
    return optional ? '<span class="company-solver-optional-group">' + content + "</span>" : content;
}

function renderCompanySolverCard(solution, ordinal) {
  const groups = solverSolutionBuildingGroups(solution);
  const solutionCompanies = solution.companyKeys.map((key) => byCompany.get(key)).filter(Boolean);
  const restrictions = solverRestrictionText(solutionCompanies);
  return '<article class="company-solver-card" data-company-solver-card="' + ordinal + '">' +
    '<header class="company-solver-card-head"><strong>' + escapeHtml(solverT("board.company.solverPlan", "方案 {number}", { number: ordinal })) + '</strong><button type="button" class="row-detail-button company-solver-open" data-company-solver-open="' + ordinal + '" aria-label="' + escapeHtml(solverT("board.company.solverOpen", "查看组合详情")) + '"><img class="lucide-icon" src="assets/lucide/icons/arrow-right.svg" alt="" aria-hidden="true"></button></header>' +
    '<div class="company-solver-card-companies">' + solutionCompanies.map(solverCompanyIcon).join("") + '<span class="company-solver-card-prestige">' + solverPrestigeGoodsHtml(solutionCompanies, false) + "</span></div>" +
    '<div class="company-solver-card-buildings"><span class="company-solver-selected-buildings">' + solverBuildingLine(groups.targets, false, false) + '</span><span class="company-solver-extra-buildings">' + solverBuildingLine(groups.extra, false, false) + '</span><span class="company-solver-optional-buildings">' + groups.optionalGroups.map((keys) => solverBuildingLine(keys, true, false)).join("") + "</span></div>" +
    (restrictions ? '<div class="company-solver-card-restrictions">' + escapeHtml(t("board.company.solverRestrictions", "硬性限制")) + "：" + escapeHtml(restrictions) + "</div>" : "") +
    "</article>";
}

function renderCompanySolverBoard() {
  if (els.companySolverEntry) els.companySolverEntry.hidden = true;
  if (els.companySolverDetailPane) els.companySolverDetailPane.hidden = false;
  if (!companySolverAvailable()) {
    els.resultCount.textContent = "";
    els.activeHint.textContent = t("board.company.solverUnavailable", "产业组合求解器仅支持原版 1.13.11");
    els.countryList.innerHTML = '<p class="empty">' + escapeHtml(t("board.company.solverUnavailable", "产业组合求解器仅支持原版 1.13.11")) + "</p>";
    return;
  }
  const solver = state.companySolver;
  const selected = solver.selectedBuildings;
  const groups = companySolverBuildingGroups.map((group) => '<div class="company-solver-building-group" data-company-solver-group="' + escapeHtml(group.key) + '"><div class="company-solver-building-grid">' + group.items.map(({ buildingKey }) => {
    const pressed = selected.has(buildingKey);
    const label = solverBuildingLabel(buildingKey);
    return '<button type="button" class="company-solver-building' + (pressed ? " is-selected" : "") + '" title="' + escapeHtml(label) + '" aria-label="' + escapeHtml(label) + '" data-company-solver-building="' + escapeHtml(buildingKey) + '" aria-pressed="' + String(pressed) + '">' + solverBuildingIcon(buildingKey) + "</button>";
  }).join("") + "</div></div>").join("");
  const resultText = solver.status === "complete"
    ? solverT("board.company.solverResultCount", "共 {count} 个方案", { count: localizedNumber(solver.total) })
    : solver.status === "running" ? solverT("board.company.solverComputing", "正在计算…（已检查 {visited} 个状态，找到 {found} 个方案）", { visited: localizedNumber(solver.progress?.visited || 0), found: localizedNumber(solver.progress?.solutions ?? solver.progress?.found ?? 0) })
      : solver.status === "error" ? (solver.error || solverT("board.company.solverError", "求解失败"))
        : solverT("board.company.solverSelectPrompt", "选择建筑后执行");
  const pagination = renderCompanySolverPagination(solver);
  const usage = renderCompanySolverUsage(solver);
  els.resultCount.textContent = resultText;
  els.activeHint.textContent = selected.size ? [...selected].map(solverBuildingLabel).join("、") : "";
  els.countryList.className = "company-solver-results";
  const companyCount = '<label class="company-solver-company-count"><span>' + escapeHtml(solverT("board.company.solverCompanyCount", "公司数")) + '</span><select data-company-solver-company-count>' + Array.from({ length: COMPANY_SOLVER_MAX_COMPANIES }, (_, index) => index + 1).map((count) => '<option value="' + count + '"' + (solver.companyCount === count ? " selected" : "") + '>' + count + '</option>').join("") + '</select></label>';
  const restrictionToggle = '<label class="company-solver-restriction-toggle"><input type="checkbox" data-company-solver-unrestricted-only' + (solver.unrestrictedOnly ? " checked" : "") + '><span>' + escapeHtml(solverT("board.company.solverUnrestrictedOnly", "不限制文化或国家")) + '</span></label>';
  const constructionToggle = '<label class="company-solver-restriction-toggle"><input type="checkbox" data-company-solver-exclude-construction' + (solver.excludeConstructionCompany ? " checked" : "") + '><span>' + escapeHtml(solverT("board.company.solverExcludeConstruction", "不使用统一建设联合体")) + '</span></label>';
  els.countryList.innerHTML = '<section class="company-solver-shell"><div class="company-solver-toolbar"><div><h2>' + escapeHtml(solverT("board.company.solverTitle", "产业组合求解器")) + '</h2><p>' + escapeHtml(solverT("board.company.solverDescription", "选择希望覆盖的建筑，查找公司组合。")) + '</p></div><div class="company-solver-actions">' + companyCount + restrictionToggle + constructionToggle + '<button type="button" class="company-solver-run" data-company-solver-run ' + (selected.size ? "" : "disabled") + '>' + escapeHtml(solverT("board.company.solverRun", "执行")) + '</button></div></div><div class="company-solver-building-groups">' + groups + '</div>' + renderCompanySolverPrestigeFilters() + '<div class="company-solver-results-head"><span>' + escapeHtml(resultText) + "</span>" + pagination + '</div>' + usage + '<div class="company-solver-layout"><div class="company-solver-card-list">' + solver.solutions.map((solution, index) => renderCompanySolverCard(solution, (solver.page - 1) * COMPANY_SOLVER_PAGE_SIZE + index + 1)).join("") + (solver.status === "complete" && !solver.solutions.length ? '<p class="empty">' + escapeHtml(solverT("board.company.solverNoResult", "没有可覆盖全部建筑的组合。")) + "</p>" : "") + (pagination ? '<div class="company-solver-pagination-bottom">' + pagination + '</div>' : "") + '</div></div></section>';
  const prestigeFilter = els.countryList.querySelector("[data-company-solver-prestige-filter]");
  if (prestigeFilter) prestigeFilter.addEventListener("toggle", () => {
    state.companySolver.prestigeFilterOpen = prestigeFilter.open;
  });
  const usageDetails = els.countryList.querySelector("[data-company-solver-usage]");
  if (usageDetails) usageDetails.addEventListener("toggle", () => {
    state.companySolver.usageOpen = usageDetails.open;
  });
}

function renderCompanySolverDetail() {
  const solution = state.companySolver.selectedSolution;
  if (!solution) {
    const empty = '<section class="company-solver-detail-empty"><h2>' + escapeHtml(solverT("board.company.solverDetailTitle", "组合详情")) + '</h2><p>' + escapeHtml(solverT("board.company.solverDetailPrompt", "点击方案卡片右上角箭头查看公司详情。")) + "</p></section>";
    els.detail.innerHTML = empty;
    if (els.companySolverDetailPane) els.companySolverDetailPane.innerHTML = empty;
    return;
  }
  const solutionCompanies = solution.companyKeys.map((key) => byCompany.get(key)).filter(Boolean);
  const companyDetails = solutionCompanies.map((company, companyIndex) => {
    const fixedKeys = (company.building_types || []).map((item) => item.key).filter(Boolean);
    const extensionKeys = (company.extension_building_types || []).map((item) => item.key).filter(Boolean);
    const selected = solution.selectedExtensionKeys[companyIndex] || [];
    const alternatives = extensionKeys.filter((key) => !selected.includes(key));
    const detailBuildingLinks = (keys) => keys.length ? keys.map((key) => '<a href="#/building/' + encodeURIComponent(key) + '">' + solverBuildingIcon(key) + "</a>").join("") : escapeHtml(solverT("ui.none", "无"));
    return '<article class="company-solver-company-detail"><div class="company-solver-company-detail-title"><a href="#/company/' + encodeURIComponent(company.key) + '">' + solverCompanyIcon(company) + "<strong>" + escapeHtml(solverCompanyLabel(company)) + "</strong></a></div><dl class=\"field-grid\"><dt>" + escapeHtml(solverT("board.company.solverFixedBuildings", "固定建筑")) + "</dt><dd>" + detailBuildingLinks(fixedKeys) + "</dd><dt>" + escapeHtml(solverT("board.company.solverSelectedExtension", "当前扩展")) + "</dt><dd>" + detailBuildingLinks(selected) + "</dd><dt>" + escapeHtml(solverT("board.company.solverAlternativeExtensions", "可替代扩展")) + "</dt><dd>" + detailBuildingLinks(alternatives) + "</dd><dt>" + escapeHtml(solverT("board.company.prestigeGoods", "名贵商品")) + "</dt><dd>" + solverPrestigeGoodsHtml([company], true) + "</dd><dt>" + escapeHtml(solverT("board.company.prosperityEffect", "繁荣效果")) + "</dt><dd>" + modifierPills(company.prosperity_modifiers) + "</dd></dl><h3>" + escapeHtml(solverT("board.company.scriptConditions", "成立条件")) + "</h3>" + rawDetails(solverT("board.company.potentialCondition", "潜在条件"), company.potential_raw) + rawDetails(solverT("board.company.attainableCondition", "可见条件"), company.attainable_raw) + rawDetails(solverT("board.company.possibleCondition", "成立条件"), company.possible_raw) + '<p class="company-solver-detail-restrictions">' + solverRestrictionHtml([company], true) + "</p></article>";
  }).join("");
  const detailHtml = '<section class="company-solver-detail"><div class="detail-title"><div class="detail-title-main"><h2>' + escapeHtml(solverT("board.company.solverPlan", "方案 {number}", { number: solution.ordinal || 1 })) + "</h2></div></div><p>" + escapeHtml(solverT("board.company.solverDetailSummary", "公司 {companies} 家；覆盖建筑 {buildings} 项", { companies: solutionCompanies.length, buildings: state.companySolver.selectedBuildings.size })) + "</p>" + companyDetails + "</section>";
  els.detail.innerHTML = detailHtml;
  if (els.companySolverDetailPane) els.companySolverDetailPane.innerHTML = detailHtml;
}

function bindCompanySolverInteractions() {
  if (window.__companySolverInteractionsBound) return;
  window.__companySolverInteractionsBound = true;
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-company-solver-entry]")) {
      setCompanySolverView();
      return;
    }
    const building = event.target.closest("[data-company-solver-building]");
    if (building) {
      if (state.detailKind !== "companySolver") return;
      const key = building.dataset.companySolverBuilding;
      if (state.companySolver.selectedBuildings.has(key)) state.companySolver.selectedBuildings.delete(key);
      else state.companySolver.selectedBuildings.add(key);
      const availablePrestigeKeys = new Set(solverAvailablePrestigeGoods().map((item) => item.key));
      for (const prestigeKey of state.companySolver.selectedPrestigeGoods) {
        if (!availablePrestigeKeys.has(prestigeKey)) state.companySolver.selectedPrestigeGoods.delete(prestigeKey);
      }
      companySolverInvalidate();
      state.companySolver.companyCount = 1;
      state.companySolver.autoCompanyCount = true;
      render();
      return;
    }
    if (event.target.closest("[data-company-solver-run]")) {
      runCompanySolver();
      return;
    }
    const page = event.target.closest("[data-company-solver-page]");
    if (page) {
      requestCompanySolverPage(state.companySolver.page + (page.dataset.companySolverPage === "next" ? 1 : -1));
      return;
    }
    const open = event.target.closest("[data-company-solver-open]");
    if (open) {
      const ordinal = Number(open.dataset.companySolverOpen);
      const index = ordinal - 1 - ((state.companySolver.page - 1) * COMPANY_SOLVER_PAGE_SIZE);
      const solution = state.companySolver.solutions[index];
      if (!solution) return;
      solution.ordinal = ordinal;
      state.companySolver.selectedSolution = solution;
      renderCompanySolverDetail();
    }
  });
  document.addEventListener("change", (event) => {
    const companyCount = event.target.closest("[data-company-solver-company-count]");
    if (companyCount) {
      state.companySolver.companyCount = Math.max(1, Math.min(COMPANY_SOLVER_MAX_COMPANIES, Number(companyCount.value) || 1));
      state.companySolver.autoCompanyCount = false;
      companySolverInvalidate();
      render();
      return;
    }
    const restrictionToggle = event.target.closest("[data-company-solver-unrestricted-only]");
    if (restrictionToggle) {
      state.companySolver.unrestrictedOnly = Boolean(restrictionToggle.checked);
      companySolverInvalidate();
      render();
      return;
    }
    const constructionToggle = event.target.closest("[data-company-solver-exclude-construction]");
    if (constructionToggle) {
      state.companySolver.excludeConstructionCompany = Boolean(constructionToggle.checked);
      companySolverInvalidate();
      render();
      return;
    }
    const prestigeToggle = event.target.closest("[data-company-solver-prestige]");
    if (prestigeToggle) {
      const key = prestigeToggle.dataset.companySolverPrestige;
      if (prestigeToggle.checked) {
        state.companySolver.selectedPrestigeGoods.add(key);
      } else {
        state.companySolver.selectedPrestigeGoods.delete(key);
      }
      companySolverInvalidate();
      render();
    }
  });
}

bindCompanySolverInteractions();
