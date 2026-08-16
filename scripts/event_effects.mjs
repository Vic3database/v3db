const modifierReferencePattern = /\b(?:add_modifier|add_enactment_modifier)\s*=\s*(?:\{([\s\S]*?)\}|([a-zA-Z0-9_.-]+))/g;
const localizationEntryPattern = /^\s*([a-zA-Z0-9_.-]+):\s*(?:0\s*)?"((?:\\.|[^"\\])*)"\s*(?:#.*)?$/gm;

export function extractModifierNames(script) {
  const names = [];
  for (const match of String(script || "").matchAll(modifierReferencePattern)) {
    const body = match[1] || "";
    const name = body.match(/\bname\s*=\s*([a-zA-Z0-9_.-]+)/)?.[1] || match[2] || "";
    if (name) names.push(name);
  }
  return [...new Set(names)];
}

export function parseModifierDefinitions(source) {
  const result = new Map();
  const text = String(source || "");
  const header = /(^|\n)\s*([a-zA-Z0-9_.-]+)\s*=\s*\{/g;
  for (const match of text.matchAll(header)) {
    const start = match.index + match[0].length;
    let depth = 1;
    let end = start;
    for (; end < text.length && depth; end += 1) {
      if (text[end] === "{") depth += 1;
      else if (text[end] === "}") depth -= 1;
    }
    const body = text.slice(start, end - 1);
    const effects = [];
    for (const line of body.split(/\r?\n/)) {
      const effect = line.match(/^\s*([a-zA-Z0-9_.-]+)\s*=\s*([^#\s]+)/);
      if (effect && effect[1] !== "icon") effects.push({ key: effect[1], value_raw: effect[2] });
    }
    result.set(match[2], effects);
  }
  return result;
}

export function parseGameLocalization(source) {
  const messages = new Map();
  for (const match of String(source || "").replace(/^\uFEFF/, "").matchAll(localizationEntryPattern)) {
    messages.set(match[1], match[2].replaceAll('\\"', '"').replaceAll("\\n", "\n"));
  }
  return messages;
}

export function resolveGameLocalizationText(value, messages, resolving = new Set()) {
  const resolveReference = (key) => {
    if (!messages.has(key) || resolving.has(key)) return "";
    const next = new Set(resolving);
    next.add(key);
    return resolveGameLocalizationText(messages.get(key), messages, next);
  };
  return String(value || "")
    .replace(/\$([a-zA-Z0-9_.-]+)\$/g, (_, key) => resolveReference(key))
    .replace(/\[Concept\(\s*'([a-zA-Z0-9_.-]+)'\s*(?:,\s*'([^']*)')?\s*\)\]/g, (_, key, label) => label || resolveReference(key))
    .replace(/\[([a-zA-Z0-9_.-]+)(?:\|[^\]]*)?\]/g, (_, key) => resolveReference(key))
    .replace(/@[a-zA-Z0-9_-]+!/g, "")
    .replace(/#[a-zA-Z0-9_-]+|#!/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
