const DIRECTIVES = new Set([
  "INJECT",
  "TRY_INJECT",
  "REPLACE",
  "REPLACE_OR_CREATE",
  "CREATE",
]);
const MODIFIER_ROOTS = new Set([
  "building_modifiers",
  "state_modifiers",
  "country_modifiers",
]);
const REPEATED_BRANCHES = new Set(["if", "else_if", "else"]);

export function parseDefinitionDirective(rawKey) {
  const key = String(rawKey || "");
  const match = key.match(/^([A-Z_]+):(.*)$/);
  if (!match || !DIRECTIVES.has(match[1])) return { directive: "DEFINE", key };
  return { directive: match[1], key: match[2] };
}

export function applyDefinitionAssignment(definitions, assignment, sourceFile, options = {}) {
  const { directive, key } = parseDefinitionDirective(assignment?.key);
  const existing = definitions.get(key);
  const modStage = Boolean(options.modStage);

  if (directive === "TRY_INJECT" && !existing) return;
  if (directive === "INJECT" && !existing) {
    throw new Error(`INJECT target ${key} is missing in ${sourceFile}`);
  }
  if (directive === "REPLACE" && !existing) {
    throw new Error(`REPLACE target ${key} is missing in ${sourceFile}`);
  }
  if (directive === "CREATE" && existing) {
    throw new Error(`CREATE target ${key} already exists in ${sourceFile}`);
  }

  if (directive === "INJECT" || directive === "TRY_INJECT") {
    existing.node = mergeClausewitzNodes(existing.node, assignment.value);
    existing.source_file = sourceFile;
    existing.source_files = unique([...existing.source_files, sourceFile]);
    if (modStage) {
      existing.patch_directives = unique([...existing.patch_directives, directive]);
    }
    return;
  }

  const sourceFiles = existing
    ? unique([...existing.source_files, sourceFile])
    : [sourceFile];
  const patchDirectives = modStage
    ? unique([...(existing?.patch_directives || []), directive])
    : [];
  definitions.set(key, {
    key,
    node: cloneValue(assignment.value),
    source_file: sourceFile,
    source_files: sourceFiles,
    patch_directives: patchDirectives,
  });
}

export function mergeClausewitzNodes(base, patch, path = []) {
  if (!isNode(base) || !isNode(patch)) return cloneValue(patch);
  const result = cloneValue(base);
  result.items = unique([
    ...(result.items || []),
    ...((patch && patch.items) || []).map(cloneValue),
  ]);

  for (const next of patch.assignments || []) {
    if (REPEATED_BRANCHES.has(next.key)) {
      result.assignments.push(cloneValue(next));
      continue;
    }
    const current = [...result.assignments]
      .reverse()
      .find((item) => item.key === next.key);
    if (!current) {
      result.assignments.push(cloneValue(next));
      continue;
    }

    const nextPath = [...path, next.key];
    if (isNode(current.value) && isNode(next.value)) {
      current.value = mergeClausewitzNodes(current.value, next.value, nextPath);
    } else if (isAdditiveModifier(nextPath, current.value, next.value)) {
      current.value = String(Number(current.value) + Number(next.value));
    } else {
      current.value = cloneValue(next.value);
    }
  }
  return result;
}

function isAdditiveModifier(path, left, right) {
  return path.some((key) => MODIFIER_ROOTS.has(key))
    && Number.isFinite(Number(left))
    && Number.isFinite(Number(right));
}

function isNode(value) {
  return Boolean(
    value
    && typeof value === "object"
    && Array.isArray(value.assignments)
    && Array.isArray(value.items),
  );
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
  );
}

function unique(values) {
  return [...new Set(values)];
}
