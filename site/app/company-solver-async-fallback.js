(function () {
  function stableName(company) { return String(company.name || company.key).toLocaleLowerCase(); }
  function solutionKey(solution) { return solution.companyKeys.join("|"); }
  function summarizeCompanyUsage(solutions) {
    const counts = new Map();
    for (const solution of solutions || []) {
      for (const companyKey of new Set(solution.companyKeys || [])) counts.set(companyKey, (counts.get(companyKey) || 0) + 1);
    }
    return [...counts.entries()].map(([companyKey, count]) => ({ companyKey, count })).sort((left, right) => right.count - left.count || left.companyKey.localeCompare(right.companyKey));
  }
  function popcount(value) { let count = 0; for (let bits = value; bits; bits >>= 1n) count += Number(bits & 1n); return count; }
  function pause() { return new Promise((resolve) => setTimeout(resolve, 0)); }

  window.COMPANY_SOLVER_CORE.solveCompanyCombinationsAsync = async function (model, options = {}) {
    const maxResults = Number.isFinite(options.maxResults) && options.maxResults > 0 ? options.maxResults : Infinity;
    const companyCount = Number.isInteger(options.companyCount) && options.companyCount > 0 ? options.companyCount : null;
    const requiredPrestigeGroups = (options.requiredPrestigeGroups || []).map((group) => new Set(group || [])).filter((group) => group.size);
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : () => {};
    const results = new Map();
    const selected = new Map();
    const companyPrestigeKeys = model.companies.map((company) => new Set((company.possible_prestige_goods || []).map((item) => item.key || item)));
    let visited = 0;

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
      const rows = [...selected.entries()].map(([companyIndex, stateIndex]) => ({
        companyIndex,
        company: model.companies[companyIndex],
        state: model.states[companyIndex][stateIndex],
      })).sort((left, right) => stableName(left.company).localeCompare(stableName(right.company), undefined, { sensitivity: "base" }) || left.company.key.localeCompare(right.company.key));
      if ((model.targetMask ^ coveredMask) !== 0n) return null;
      if (companyCount !== null && rows.length !== companyCount) return null;
      for (const row of rows) {
        let without = 0n;
        for (const other of rows) if (other !== row) without |= other.state.coverageMask;
        if ((without & model.targetMask) === model.targetMask && prestigeGroupsSatisfied(selectedPrestigeKeys(row.companyIndex))) return null;
      }
      if (!prestigeGroupsSatisfied(selectedPrestigeKeys())) return null;
      return {
        companyKeys: rows.map((row) => row.company.key),
        companyNames: rows.map((row) => row.company.name || row.company.key),
        selectedExtensions: rows.map((row) => row.state.selected[0] || null),
        selectedExtensionKeys: rows.map((row) => row.state.selectedKeys),
        extraCoverageKeys: [...new Set(rows.flatMap((row) => row.state.fixedExtraKeys))].sort(),
        coveredMask,
      };
    };

    const visitCandidates = async (candidates, coveredMask) => {
      candidates.sort((left, right) => {
        const leftState = model.states[left.companyIndex][left.stateIndex];
        const rightState = model.states[right.companyIndex][right.stateIndex];
        const leftGain = popcount(leftState.coverageMask & model.targetMask & ~coveredMask);
        const rightGain = popcount(rightState.coverageMask & model.targetMask & ~coveredMask);
        return rightGain - leftGain || stableName(model.companies[left.companyIndex]).localeCompare(stableName(model.companies[right.companyIndex]), undefined, { sensitivity: "base" });
      });
      for (const candidate of candidates) {
        selected.set(candidate.companyIndex, candidate.stateIndex);
        await visit(coveredMask | model.states[candidate.companyIndex][candidate.stateIndex].coverageMask);
        selected.delete(candidate.companyIndex);
      }
    };

    const visit = async (coveredMask) => {
      visited += 1;
      if (visited % 1024 === 0) {
        onProgress({ visited, solutions: results.size });
        await pause();
      }
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
            model.states[companyIndex].forEach((state, stateIndex) => candidates.push({ companyIndex, stateIndex }));
          }
          if (!candidates.length) return;
          if (!bestPrestigeCandidates || candidates.length < bestPrestigeCandidates.length) bestPrestigeCandidates = candidates;
        }
        await visitCandidates(bestPrestigeCandidates, coveredMask);
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
      await visitCandidates(bestCandidates, coveredMask);
    };

    await visit(0n);
    const solutions = [...results.values()].sort((left, right) => left.companyKeys.length - right.companyKeys.length || right.extraCoverageKeys.length - left.extraCoverageKeys.length || left.companyNames.join("\u0000").localeCompare(right.companyNames.join("\u0000"), undefined, { sensitivity: "base" }));
    onProgress({ visited, solutions: solutions.length, complete: true });
    return { total: solutions.length, solutions, visited, companyUsage: summarizeCompanyUsage(solutions) };
  };
}());
