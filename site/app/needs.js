const NEEDS_DISPLAY_ORDER = [
  "popneed_intoxicants",
  "popneed_heating",
  "popneed_basic_food",
  "popneed_simple_clothing",
  "popneed_crude_items",
  "popneed_stimulants",
  "popneed_standard_clothing",
  "popneed_household_items",
  "popneed_services",
  "popneed_free_movement",
  "popneed_luxury_drinks",
  "popneed_luxury_items",
  "popneed_communication",
  "popneed_luxury_food",
  "popneed_leisure",
];

const NEEDS_SOL_TIERS = [
  { key: "destitute", start: 1, end: 4 },
  { key: "struggling", start: 5, end: 9 },
  { key: "impoverished", start: 10, end: 14 },
  { key: "middling", start: 15, end: 19 },
  { key: "secure", start: 20, end: 24 },
  { key: "prosperous", start: 25, end: 29 },
  { key: "affluent", start: 30, end: 39 },
  { key: "wealthy", start: 40, end: 49 },
  { key: "lavish", start: 50, end: 59 },
  { key: "opulent", start: 60, end: 99 },
];

const NEEDS_WEALTH_PROJECT_WIDTH = 260;
const NEEDS_WEALTH_COLUMN_WIDTH = 64;

function goodsPanelSwitchHtml(active) {
  return `<nav class="goods-panel-switch" aria-label="${escapeHtml(t("board.needs.goodsPanelAria"))}">
    <button type="button" data-goods-panel="list" aria-pressed="${String(active === "list")}">${escapeHtml(t("board.needs.goodsList"))}</button>
    <button type="button" data-goods-panel="needs" aria-pressed="${String(active === "needs")}">${escapeHtml(t("board.needs.populationNeeds"))}</button>
  </nav>`;
}

function bindGoodsPanelSwitch() {
  els.countryList.querySelectorAll("[data-goods-panel]").forEach((button) => {
    button.addEventListener("click", async () => {
      const panel = button.dataset.goodsPanel;
      const route = panel === "needs" ? "/goods/needs/substitutes" : "/goods";
      if ((panel === "needs") === (state.goodsPanel === "needs")) return;
      replaceHash(route);
      await applyHash();
      render();
    });
  });
}

function renderNeedsBoard() {
  els.detail.innerHTML = "";
  els.resultCount.textContent = "";
  els.activeHint.textContent = "";
  if (state.needsLoadError || !needsData?.current) {
    els.countryList.innerHTML = `<section class="needs-shell">
      ${goodsPanelSwitchHtml("needs")}
      <p class="needs-load-error">${escapeHtml(state.needsLoadError || t("board.needs.loadError"))}</p>
    </section>`;
    bindGoodsPanelSwitch();
    return;
  }

  const current = normalizeNeedsDataset(needsData.current);
  const baseline = needsData.baseline ? normalizeNeedsDataset(needsData.baseline) : null;
  const compareAvailable = Boolean(baseline);
  const compareEnabled = compareAvailable && state.needsCompareBaseline;
  const content = state.needsTable === "wealth"
    ? needsWealthTableHtml(current, baseline, compareEnabled)
    : needsSubstitutesTableHtml(current, baseline, compareEnabled);

  els.countryList.innerHTML = `<section class="needs-shell${compareEnabled ? " needs-compare-enabled" : ""}">
    ${goodsPanelSwitchHtml("needs")}
    <header class="needs-toolbar">
      <nav class="needs-table-switch" aria-label="${escapeHtml(t("board.needs.tableAria"))}">
        <button type="button" data-needs-table="substitutes" aria-pressed="${String(state.needsTable === "substitutes")}">${escapeHtml(t("board.needs.substitutes"))}</button>
        <button type="button" data-needs-table="wealth" aria-pressed="${String(state.needsTable === "wealth")}">${escapeHtml(t("board.needs.wealthTable"))}</button>
      </nav>
      ${compareAvailable ? `<button class="needs-compare-button" type="button" data-needs-compare aria-pressed="${String(compareEnabled)}">${escapeHtml(t("board.needs.compareOriginal"))}</button>` : ""}
    </header>
    ${compareEnabled ? `<p class="needs-comparison-note"><span class="needs-delta-increase">${escapeHtml(t("board.needs.increaseLegend"))}</span><span class="needs-delta-decrease">${escapeHtml(t("board.needs.decreaseLegend"))}</span><span class="needs-delta-added">${escapeHtml(t("board.needs.addedLegend"))}</span></p>` : ""}
    ${content}
    <footer class="needs-summary">${escapeHtml(t("board.needs.summary", {
      needs: current.needs.length,
      relations: current.needs.reduce((sum, need) => sum + need.entries.length, 0),
      levels: current.packages.length,
    }))}</footer>
  </section>`;

  bindGoodsPanelSwitch();
  bindNeedsBoardEvents();
  if (state.needsTable === "wealth") bindNeedsWealthLineLayers();
}

function bindNeedsBoardEvents() {
  els.countryList.querySelectorAll("[data-needs-table]").forEach((button) => {
    button.addEventListener("click", async () => {
      const table = button.dataset.needsTable;
      if (table === state.needsTable) return;
      replaceHash(`/goods/needs/${table}`);
      await applyHash();
      render();
    });
  });
  els.countryList.querySelector("[data-needs-compare]")?.addEventListener("click", () => {
    state.needsCompareBaseline = !state.needsCompareBaseline;
    renderNeedsBoard();
  });
}

function normalizeNeedsDataset(dataset) {
  const needsByKey = new Map((dataset.needs || []).map((need) => [need.key, need]));
  const packages = [...(dataset.packages || [])].sort((left, right) => left.level - right.level);
  const orderedNeeds = NEEDS_DISPLAY_ORDER.map((key) => needsByKey.get(key)).filter(Boolean);
  for (const need of dataset.needs || []) {
    if (!orderedNeeds.includes(need)) orderedNeeds.push(need);
  }
  return {
    needs: orderedNeeds.map((need) => ({ ...need, range: needsRange(need.key, packages) })),
    packages,
  };
}

function needsRange(needKey, packages) {
  const levels = packages.filter((row) => Number.isFinite(row.values?.[needKey])).map((row) => row.level);
  return levels.length ? [Math.min(...levels), Math.max(...levels)] : [1, 99];
}

function needsSolTierForLevel(level) {
  return NEEDS_SOL_TIERS.find((tier) => tier.start <= level && level <= tier.end) || NEEDS_SOL_TIERS[NEEDS_SOL_TIERS.length - 1];
}

function needsSubstitutesTableHtml(current, baseline, compareEnabled) {
  const baselineByKey = new Map((baseline?.needs || []).map((need) => [need.key, need]));
  return `<section class="needs-table-panel" data-needs-panel="substitutes">
    <p class="needs-table-note">${escapeHtml(t("board.needs.substitutesNote"))}</p>
    <div class="needs-substitutes-wrap">
      <div class="needs-substitutes-axis" role="table" aria-label="${escapeHtml(t("board.needs.substitutes"))}">
        ${current.needs.map((need) => needSubstitutesRowHtml(need, baselineByKey.get(need.key), compareEnabled)).join("")}
      </div>
    </div>
  </section>`;
}

function needSubstitutesRowHtml(need, baselineNeed, compareEnabled) {
  const [start, end] = need.range;
  const left = ((start - 1) / 99) * 100;
  const width = ((end - start + 1) / 99) * 100;
  const rowHeight = need.entries.length > 5 ? 112 : need.entries.length > 3 ? 88 : 64;
  const baselineEntries = new Map((baselineNeed?.entries || []).map((entry) => [entry.goods_key, entry]));
  const goods = need.entries.map((entry) => needSubstituteGoodHtml(
    need,
    entry,
    baselineNeed,
    baselineEntries.get(entry.goods_key),
    compareEnabled,
  )).join("");
  return `<div class="needs-substitutes-row" role="row" style="--needs-row-height:${rowHeight}px">
    <div class="needs-substitute-label" role="rowheader"><strong>${escapeHtml(entityText(need))}</strong></div>
    <div class="needs-substitute-axis" role="cell" aria-label="${escapeHtml(t("board.needs.wealthRangeAria", { name: entityText(need), start, end }))}">
      <div class="needs-substitute-active" style="left:${left}%;width:${width}%">
        ${start === 1 ? "" : `<span class="needs-range-boundary needs-range-boundary-start">${start}</span>`}
        <div class="needs-substitute-goods">${goods}</div>
        ${end === 99 ? "" : `<span class="needs-range-boundary needs-range-boundary-end">${end}</span>`}
      </div>
    </div>
  </div>`;
}

function needSubstituteGoodHtml(need, entry, baselineNeed, baselineEntry, compareEnabled) {
  const good = goodByKey.get(entry.goods_key);
  const name = economyDisplayName(good) || entry.goods_key;
  const isDefault = need.default_good_key === entry.goods_key;
  const added = compareEnabled && !baselineEntry;
  const parts = [];
  if (isDefault) parts.push(escapeHtml(t("board.needs.default")));
  if (Number.isFinite(entry.weight)) {
    parts.push(`${escapeHtml(t("board.needs.weight", { value: needsPercent(entry.weight) }))}${needsInlineDelta(entry.weight, baselineEntry?.weight, "percent", compareEnabled)}`);
  }
  if (Number.isFinite(entry.min_supply_share) && Number.isFinite(entry.max_supply_share)) {
    parts.push(`${needsPercent(entry.min_supply_share)}${needsInlineDelta(entry.min_supply_share, baselineEntry?.min_supply_share, "percent", compareEnabled)}-${needsPercent(entry.max_supply_share)}${needsInlineDelta(entry.max_supply_share, baselineEntry?.max_supply_share, "percent", compareEnabled)}`);
  }
  const fallbackAdded = compareEnabled && !baselineNeed;
  return `<span class="needs-substitute-good" data-good-key="${escapeHtml(entry.goods_key)}" title="${escapeHtml(name)}">
    <img src="${economyAsset("goods", entry.goods_key)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async">
    <span>(${parts.join(localeRuntime.current === "zh-Hans" ? "，" : ", ")})</span>
    ${added || fallbackAdded ? `<small class="needs-delta needs-delta-added">(${escapeHtml(t("board.needs.added"))})</small>` : ""}
  </span>`;
}

function needsWealthTableHtml(current, baseline, compareEnabled) {
  const baselineByKey = new Map((baseline?.needs || []).map((need) => [need.key, need]));
  const baselinePackages = new Map((baseline?.packages || []).map((row) => [row.level, row]));
  const tableWidth = NEEDS_WEALTH_PROJECT_WIDTH + current.packages.length * NEEDS_WEALTH_COLUMN_WIDTH;
  const grayLineLevels = current.packages.slice(1).map((row) => row.level).filter((level) => !NEEDS_SOL_TIERS.some((tier) => tier.start === level));
  const tierStarts = NEEDS_SOL_TIERS.slice(1).map((tier) => tier.start);
  return `<section class="needs-table-panel" data-needs-panel="wealth">
    <p class="needs-table-note">${escapeHtml(t("board.needs.wealthNote"))}</p>
    <div class="needs-wealth-wrap">
      <div class="needs-wealth-table-stage" style="width:${tableWidth}px">
        <div class="needs-wealth-line-layer" aria-hidden="true">${grayLineLevels.map((level) => `<span data-level="${level}" style="left:${NEEDS_WEALTH_PROJECT_WIDTH + (level - 1) * NEEDS_WEALTH_COLUMN_WIDTH}px"></span>`).join("")}</div>
        <div class="needs-tier-line-layer" aria-hidden="true">${tierStarts.map((level) => `<span class="needs-tier-divider" data-level="${level}" style="left:${NEEDS_WEALTH_PROJECT_WIDTH + (level - 1) * NEEDS_WEALTH_COLUMN_WIDTH}px"></span>`).join("")}</div>
        <table class="needs-wealth-table" aria-label="${escapeHtml(t("board.needs.wealthTable"))}">
          <colgroup><col style="width:${NEEDS_WEALTH_PROJECT_WIDTH}px">${current.packages.map(() => `<col style="width:${NEEDS_WEALTH_COLUMN_WIDTH}px">`).join("")}</colgroup>
          <thead>
            <tr class="needs-wealth-level-row">
              <th class="needs-wealth-project-cell" scope="col">${escapeHtml(t("board.needs.projectWealth"))}</th>
              ${current.packages.map((row) => `<th class="needs-wealth-head-level needs-sol-${needsSolTierForLevel(row.level).key}" data-level="${row.level}" scope="col">${row.level}</th>`).join("")}
            </tr>
            <tr class="needs-wealth-tier-row">
              <th class="needs-wealth-project-cell" scope="row">${escapeHtml(t("board.needs.solTier"))}</th>
              ${NEEDS_SOL_TIERS.map((tier) => `<th class="needs-wealth-tier needs-sol-${tier.key}" colspan="${tier.end - tier.start + 1}"><strong>${escapeHtml(t(`board.needs.sol.${tier.key}`))}</strong><small>${tier.start}-${tier.end}</small></th>`).join("")}
            </tr>
            <tr class="needs-wealth-political-row">
              <th class="needs-wealth-project-cell" scope="row">${escapeHtml(t("board.needs.politicalStrength"))}</th>
              ${current.packages.map((row) => `<th class="needs-sol-${needsSolTierForLevel(row.level).key}">${escapeHtml(needsNumber(row.political_strength))}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${current.needs.map((need) => needsWealthRowHtml(need, current.packages, baselineByKey.get(need.key), baselinePackages, compareEnabled)).join("")}
            ${needsWealthTotalRowHtml(current.packages, baselinePackages, compareEnabled)}
          </tbody>
        </table>
      </div>
    </div>
  </section>`;
}

function needsWealthRowHtml(need, packages, baselineNeed, baselinePackages, compareEnabled) {
  const [start, end] = need.range;
  const goods = need.entries.map((entry) => {
    const good = goodByKey.get(entry.goods_key);
    const name = economyDisplayName(good) || entry.goods_key;
    return `<img src="${economyAsset("goods", entry.goods_key)}" alt="${escapeHtml(name)}" title="${escapeHtml(name)}" loading="lazy" decoding="async">`;
  }).join("");
  return `<tr class="needs-wealth-need-row${need.entries.length > 6 ? " needs-wealth-many-goods" : ""}" data-need-key="${escapeHtml(need.key)}">
    <th class="needs-wealth-project-cell" scope="row">
      <span class="needs-wealth-project-copy"><strong>${escapeHtml(entityText(need))}</strong><small>${escapeHtml(t("board.needs.wealthRange", { start, end }))}</small></span>
      <span class="needs-wealth-project-goods">${goods}</span>
    </th>
    ${packages.map((row) => {
      const value = row.values?.[need.key];
      const baselineValue = baselinePackages.get(row.level)?.values?.[need.key];
      return `<td class="${Number.isFinite(value) ? `needs-sol-${needsSolTierForLevel(row.level).key}` : "needs-wealth-empty"}">${Number.isFinite(value) ? `${needsLargeNumberHtml(value)}${needsCellDelta(value, baselineValue, compareEnabled)}` : ""}</td>`;
    }).join("")}
  </tr>`;
}

function needsWealthTotalRowHtml(packages, baselinePackages, compareEnabled) {
  return `<tr class="needs-wealth-total-row">
    <th class="needs-wealth-project-cell" scope="row">${escapeHtml(t("board.needs.total"))}</th>
    ${packages.map((row) => `<td class="needs-sol-${needsSolTierForLevel(row.level).key}">${needsLargeNumberHtml(row.total)}${needsCellDelta(row.total, baselinePackages.get(row.level)?.total, compareEnabled)}</td>`).join("")}
  </tr>`;
}

function needsPercent(value) {
  return `${localizedNumber(Number(value) * 100)}%`;
}

function needsNumber(value) {
  return localeRuntime.numberFormat.format(Number(value));
}

function needsInlineDelta(current, original, kind, enabled) {
  if (!enabled || !Number.isFinite(current) || !Number.isFinite(original) || current === original) return "";
  const delta = current - original;
  const formatted = kind === "percent" ? `${localizedNumber(Math.abs(delta) * 100)}%` : localizedNumber(Math.abs(delta));
  return `<small class="needs-delta ${delta > 0 ? "needs-delta-increase" : "needs-delta-decrease"}">(${delta > 0 ? "+" : "-"}${formatted})</small>`;
}

function needsCellDelta(current, original, enabled) {
  if (!enabled || !Number.isFinite(current) || !Number.isFinite(original) || current === original) return "";
  const delta = current - original;
  return `<small class="needs-cell-delta ${delta > 0 ? "needs-delta-increase" : "needs-delta-decrease"}">(${delta > 0 ? "+" : "-"}${localizedNumber(Math.abs(delta))})</small>`;
}

function needsLargeNumberHtml(value) {
  const formatted = needsNumber(value);
  if (value <= 10000) return escapeHtml(formatted);
  let splitIndex = -1;
  if (value >= 1000000) {
    splitIndex = Math.max(formatted.lastIndexOf(","), formatted.lastIndexOf("，"), formatted.lastIndexOf(" "));
  } else {
    let digitsSeen = 0;
    for (let index = 0; index < formatted.length; index += 1) {
      if (/\d/.test(formatted[index])) digitsSeen += 1;
      if (digitsSeen === 2) {
        splitIndex = index + 1;
        break;
      }
    }
  }
  if (splitIndex <= 0 || splitIndex >= formatted.length) return escapeHtml(formatted);
  return `<span class="needs-number-major">${escapeHtml(formatted.slice(0, splitIndex))}</span><span class="needs-number-minor">${escapeHtml(formatted.slice(splitIndex))}</span>`;
}

function bindNeedsWealthLineLayers() {
  const table = els.countryList.querySelector(".needs-wealth-table");
  const stage = els.countryList.querySelector(".needs-wealth-table-stage");
  if (!table || !stage) return;
  const sync = () => {
    stage.style.setProperty("--needs-wealth-table-height", `${table.offsetHeight}px`);
    stage.style.setProperty("--needs-wealth-table-width", `${table.offsetWidth}px`);
    alignNeedsWealthDividers(stage, table);
  };
  sync();
  requestAnimationFrame(sync);
  if (typeof ResizeObserver === "function") new ResizeObserver(sync).observe(table);
}

function alignNeedsWealthDividers(stage, table) {
  const stageLeft = stage.getBoundingClientRect().left;
  stage.querySelectorAll(".needs-wealth-line-layer > span[data-level], .needs-tier-divider[data-level]").forEach((line) => {
    const headCell = table.querySelector(`.needs-wealth-head-level[data-level="${line.dataset.level}"]`);
    if (!headCell) return;
    line.style.left = `${headCell.getBoundingClientRect().left - stageLeft}px`;
  });
}
