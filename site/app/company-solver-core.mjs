function refKey(value) {
  if (typeof value === "string") return value;
  return value?.key || value?.id?.replace(/^building:/, "") || "";
}

function combinations(values, limit) {
  if (limit >= values.length) return [values.slice()];
  const output = [];
  const visit = (start, picked) => {
    if (picked.length === limit) {
      output.push(picked.slice());
      return;
    }
    for (let index = start; index < values.length; index += 1) {
      picked.push(values[index]);
      visit(index + 1, picked);
      picked.pop();
    }
  };
  visit(0, []);
  return output;
}

function normalizeGroup(company) {
  if (Array.isArray(company.choice_groups)) return company.choice_groups;
  if (Array.isArray(company.choiceGroups)) return company.choiceGroups;
  const options = company.extension_building_types || company.extensionBuildingTypes || [];
  return options.length ? [{ min: 0, max: 1, options }] : [];
}

function normalizeCompany(company) {
  const fixed = (company.building_types || company.buildingTypes || []).map(refKey).filter(Boolean);
  const groups = normalizeGroup(company).map((group) => ({
    min: Number.isFinite(group.min) ? group.min : 0,
    max: Number.isFinite(group.max) ? group.max : 1,
    options: (group.options || []).map(refKey).filter(Boolean),
  })).filter((group) => group.options.length);
  const extensionKeys = [...new Set(groups.flatMap((group) => group.options))];
  const optionStates = [[]];
  for (const group of groups) {
    const next = [];
    const max = Math.max(0, Math.min(group.max, group.options.length));
    const min = Math.max(0, Math.min(group.min, max));
    const choices = [];
    for (let count = min; count <= max; count += 1) {
      if (count === 0) choices.push([]);
      else choices.push(...combinations(group.options, count));
    }
    for (const existing of optionStates) {
      for (const choice of choices) next.push(existing.concat(choice));
    }
    optionStates.splice(0, optionStates.length, ...next);
  }
  return {
    ...company,
    key: company.key || company.id || "",
    name: company.name || company.loc?.name || company.key || company.id || "",
    fixedKeys: [...new Set(fixed)],
    extensionKeys,
    optionStates: optionStates.map((keys) => [...new Set(keys)]),
  };
}

function stableCompanyName(company) {
  return String(company.name || company.key).toLocaleLowerCase();
}

function solutionKey(solution) {
  return solution.companyKeys.join("|");
}

function compareSolutions(left, right) {
  if (left.companyKeys.length !== right.companyKeys.length) return left.companyKeys.length - right.companyKeys.length;
  if (right.extraCoverageKeys.length !== left.extraCoverageKeys.length) return right.extraCoverageKeys.length - left.extraCoverageKeys.length;
  return left.companyNames.join("\u0000").localeCompare(right.companyNames.join("\u0000"), undefined, { sensitivity: "base" });
}

export function summarizeCompanyUsage(solutions) {
  const counts = new Map();
  for (const solution of solutions || []) {
    for (const companyKey of new Set(solution.companyKeys || [])) counts.set(companyKey, (counts.get(companyKey) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([companyKey, count]) => ({ companyKey, count }))
    .sort((left, right) => right.count - left.count || left.companyKey.localeCompare(right.companyKey));
}

export function createCompanySolverModel(companies, targetKeys) {
  const normalizedTargets = [...new Set((targetKeys || []).map(refKey).filter(Boolean))];
  if (normalizedTargets.length > 62) throw new Error("Company solver supports at most 62 target buildings");
  const targetIndex = new Map(normalizedTargets.map((key, index) => [key, index]));
  const targetMask = normalizedTargets.reduce((mask, _key, index) => mask | (1n << BigInt(index)), 0n);
  const normalizedRows = (companies || []).map(normalizeCompany).filter((company) => company.key).map((company) => {
    const stateByTargetMask = new Map();
    for (const rawSelectedKeys of company.optionStates) {
      const selectedKeys = rawSelectedKeys.filter((key) => targetIndex.has(key));
      const coverageKeys = [...new Set(company.fixedKeys.concat(selectedKeys))];
      const coverageMask = coverageKeys.reduce((mask, key) => {
        const index = targetIndex.get(key);
        return index === undefined ? mask : mask | (1n << BigInt(index));
      }, 0n);
      const fixedExtraKeys = company.fixedKeys.filter((key) => !targetIndex.has(key));
      const state = { selected: selectedKeys.map((key) => ({ key })), selectedKeys, coverageKeys, coverageMask, fixedExtraKeys };
      const previous = stateByTargetMask.get(coverageMask.toString());
      if (!previous || state.selectedKeys.length < previous.selectedKeys.length || (state.selectedKeys.length === previous.selectedKeys.length && state.selectedKeys.join("|") < previous.selectedKeys.join("|"))) {
        stateByTargetMask.set(coverageMask.toString(), state);
      }
    }
    const companyStates = [...stateByTargetMask.values()].filter((state) => state.coverageMask !== 0n);
    return { company, states: companyStates };
  }).filter((row) => row.states.length);
  const normalizedCompanies = normalizedRows.map((row) => row.company);
  const states = normalizedRows.map((row) => row.states);
  const candidatesByTarget = normalizedTargets.map((_key, targetIndexValue) => {
    const bit = 1n << BigInt(targetIndexValue);
    const candidates = [];
    states.forEach((companyStates, companyIndex) => {
      companyStates.forEach((state, stateIndex) => {
        if (state.coverageMask & bit) candidates.push({ companyIndex, stateIndex });
      });
    });
    return candidates;
  });
  return { companies: normalizedCompanies, states, targetKeys: normalizedTargets, targetIndex, targetMask, candidatesByTarget };
}

export function solveCompanyCombinations(model, options = {}) {
  const maxResults = Number.isFinite(options.maxResults) && options.maxResults > 0 ? options.maxResults : Infinity;
  const companyCount = Number.isInteger(options.companyCount) && options.companyCount > 0 ? options.companyCount : null;
  const requiredPrestigeGroups = (options.requiredPrestigeGroups || []).map((group) => new Set(group || [])).filter((group) => group.size);
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : () => {};
  const results = new Map();
  const selected = new Map();
  let visited = 0;

  const companyPrestigeKeys = model.companies.map((company) => new Set((company.possible_prestige_goods || []).map((item) => item.key || item)));
  const selectedPrestigeKeys = (excludedCompanyIndex = -1) => {
    const keys = new Set();
    for (const companyIndex of selected.keys()) {
      if (companyIndex === excludedCompanyIndex) continue;
      for (const key of companyPrestigeKeys[companyIndex]) keys.add(key);
    }
    return keys;
  };
  const prestigeGroupsSatisfied = (keys) => requiredPrestigeGroups.every((group) => [...group].some((key) => keys.has(key)));
  const unsatisfiedPrestigeGroups = () => {
    const keys = selectedPrestigeKeys();
    return requiredPrestigeGroups.filter((group) => ![...group].some((key) => keys.has(key)));
  };

  const buildSolution = (coveredMask) => {
    const selectedRows = [...selected.entries()].map(([companyIndex, stateIndex]) => ({
      companyIndex,
      company: model.companies[companyIndex],
      state: model.states[companyIndex][stateIndex],
    })).sort((left, right) => stableCompanyName(left.company).localeCompare(stableCompanyName(right.company), undefined, { sensitivity: "base" }) || left.company.key.localeCompare(right.company.key));
    if (companyCount !== null && selectedRows.length !== companyCount) return null;
    const remaining = model.targetMask ^ coveredMask;
    if (remaining !== 0n) return null;
    for (const row of selectedRows) {
      let without = 0n;
      for (const other of selectedRows) if (other !== row) without |= other.state.coverageMask;
      if ((without & model.targetMask) === model.targetMask && prestigeGroupsSatisfied(selectedPrestigeKeys(row.companyIndex))) return null;
    }
    if (!prestigeGroupsSatisfied(selectedPrestigeKeys())) return null;
    const extraCoverageKeys = [...new Set(selectedRows.flatMap((row) => row.state.fixedExtraKeys))].sort();
    const solution = {
      companyKeys: selectedRows.map((row) => row.company.key),
      companyNames: selectedRows.map((row) => row.company.name || row.company.key),
      selectedExtensions: selectedRows.map((row) => row.state.selected[0] || null),
      selectedExtensionKeys: selectedRows.map((row) => row.state.selectedKeys),
      extraCoverageKeys,
      coveredMask,
    };
    return solution;
  };

  const visit = (coveredMask) => {
    visited += 1;
    if (visited % 1024 === 0) onProgress({ visited, solutions: results.size });
    const missingPrestigeGroups = unsatisfiedPrestigeGroups();
    if (coveredMask === model.targetMask && !missingPrestigeGroups.length) {
      const solution = buildSolution(coveredMask);
      if (solution) {
        const key = solutionKey(solution);
        if (!results.has(key) && results.size < maxResults) results.set(key, solution);
      }
      return;
    }
    if (companyCount !== null && selected.size >= companyCount) return;

    let availableCoverage = coveredMask;
    for (let companyIndex = 0; companyIndex < model.states.length; companyIndex += 1) {
      if (selected.has(companyIndex)) continue;
      for (const state of model.states[companyIndex]) availableCoverage |= state.coverageMask;
    }
    if ((availableCoverage & model.targetMask) !== model.targetMask) return;

    if (missingPrestigeGroups.length) {
      let bestPrestigeCandidates = null;
      for (const group of missingPrestigeGroups) {
        const candidates = [];
        for (let companyIndex = 0; companyIndex < model.companies.length; companyIndex += 1) {
          if (selected.has(companyIndex) || ![...group].some((key) => companyPrestigeKeys[companyIndex].has(key))) continue;
          model.states[companyIndex].forEach((state, stateIndex) => {
            if (state.coverageMask !== 0n) candidates.push({ companyIndex, stateIndex });
          });
        }
        if (!candidates.length) return;
        if (!bestPrestigeCandidates || candidates.length < bestPrestigeCandidates.length) bestPrestigeCandidates = candidates;
      }
      visitCandidates(bestPrestigeCandidates, coveredMask);
      return;
    }

    let targetIndex = -1;
    let bestCandidates = null;
    for (let index = 0; index < model.targetKeys.length; index += 1) {
      const bit = 1n << BigInt(index);
      if (coveredMask & bit) continue;
      const candidates = model.candidatesByTarget[index].filter((candidate) => !selected.has(candidate.companyIndex));
      if (!candidates.length) return;
      if (!bestCandidates || candidates.length < bestCandidates.length) {
        targetIndex = index;
        bestCandidates = candidates;
      }
    }
    if (targetIndex < 0 || !bestCandidates) return;
    visitCandidates(bestCandidates, coveredMask);
  };

  const visitCandidates = (candidates, coveredMask) => {
    candidates.sort((left, right) => {
      const leftState = model.states[left.companyIndex][left.stateIndex];
      const rightState = model.states[right.companyIndex][right.stateIndex];
      const leftGain = popcount(leftState.coverageMask & model.targetMask & ~coveredMask);
      const rightGain = popcount(rightState.coverageMask & model.targetMask & ~coveredMask);
      return rightGain - leftGain || stableCompanyName(model.companies[left.companyIndex]).localeCompare(stableCompanyName(model.companies[right.companyIndex]), undefined, { sensitivity: "base" });
    });
    for (const candidate of candidates) {
      selected.set(candidate.companyIndex, candidate.stateIndex);
      visit(coveredMask | model.states[candidate.companyIndex][candidate.stateIndex].coverageMask);
      selected.delete(candidate.companyIndex);
    }
  };

  visit(0n);
  const solutions = [...results.values()].sort(compareSolutions);
  onProgress({ visited, solutions: solutions.length, complete: true });
  return { total: solutions.length, solutions, visited, companyUsage: summarizeCompanyUsage(solutions) };
}

function popcount(value) {
  let count = 0;
  for (let bits = value; bits; bits >>= 1n) count += Number(bits & 1n);
  return count;
}
