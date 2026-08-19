import { createCompanySolverModel, solveCompanyCombinations } from "./company-solver-core.mjs?v=20260819-company-prestige-search1";

const PAGE_SIZE = 20;
let activeRequestId = 0;
let activeSolutions = [];

self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === "cancel") {
    activeRequestId = Math.max(activeRequestId, Number(message.requestId) || 0);
    activeSolutions = [];
    return;
  }
  if (message.type === "page") {
    if (Number(message.requestId) !== activeRequestId) return;
    const page = Math.max(1, Number(message.page) || 1);
    const start = (page - 1) * PAGE_SIZE;
    self.postMessage({ type: "page", requestId: activeRequestId, page, solutions: activeSolutions.slice(start, start + PAGE_SIZE) });
    return;
  }
  if (message.type !== "run") return;
  const requestId = Number(message.requestId) || 0;
  activeRequestId = requestId;
  activeSolutions = [];
  try {
    const model = createCompanySolverModel(message.companies || [], message.targetKeys || []);
    const result = solveCompanyCombinations(model, {
      maxResults: Number.isFinite(message.maxResults) ? message.maxResults : Infinity,
      companyCount: Number.isInteger(message.companyCount) ? message.companyCount : null,
      requiredPrestigeGroups: message.requiredPrestigeGroups || [],
      onProgress: (progress) => {
        if (requestId !== activeRequestId) return;
        self.postMessage({ type: "progress", requestId, visited: progress.visited, solutions: progress.solutions, found: progress.solutions });
      },
    });
    if (requestId !== activeRequestId) return;
    activeSolutions = result.solutions;
    self.postMessage({ type: "complete", requestId, companyCount: message.companyCount || null, total: result.total, companyUsage: result.companyUsage || [], pageCount: Math.max(1, Math.ceil(result.total / PAGE_SIZE)), visited: result.visited });
    self.postMessage({ type: "page", requestId, page: 1, solutions: activeSolutions.slice(0, PAGE_SIZE) });
  } catch (error) {
    if (requestId !== activeRequestId) return;
    self.postMessage({ type: "error", requestId, message: error instanceof Error ? error.message : String(error) });
  }
};
