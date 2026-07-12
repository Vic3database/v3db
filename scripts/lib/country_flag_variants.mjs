import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const TEXTURE_EXTENSIONS = /\.(dds|tga|png)$/i;

export function parseCountryFlagVariants(options = {}) {
  const tag = String(options.tag || "").trim().toUpperCase();
  if (!tag) throw new Error("parseCountryFlagVariants requires a country tag");

  const gamePath = path.resolve(options.gamePath || "D:\\SteamLibrary\\steamapps\\common\\Victoria 3");
  const assetRoot = path.resolve(options.assetRoot || path.join(process.cwd(), "game", "gfx", "coat_of_arms"));
  const assetIndex = buildAssetIndex(assetRoot);
  const sourceIndex = buildCountryFlagSourceIndex(gamePath);
  const flagDefinitionIndex = buildFlagDefinitionIndex(gamePath);
  const selection = selectCountryFlagDefinitions(tag, sourceIndex, flagDefinitionIndex);
  const variants = selection.definitions.map((definition) => extractVariant(definition, sourceIndex, assetIndex, { tag }));
  const sourceFiles = new Set(selection.definitions.map((definition) => definition.file));
  for (const variant of variants) {
    for (const file of collectLayerSourceFiles(variant.layers)) {
      sourceFiles.add(file);
    }
  }

  variants.sort(sortVariants(tag));

  return {
    tag,
    gamePath,
    assetRoot,
    sourceRoots: sourceIndex.sourceRoots,
    flagDefinitionFiles: selection.flagDefinitions.length ? flagDefinitionIndex.sourceFiles : [],
    flagDefinitions: selection.flagDefinitions,
    sourceFiles: [...sourceFiles].sort(),
    variants,
    specialTextIcons: findSpecialTextIcons(tag, assetIndex),
  };
}

export function writeCountryFlagSample(options = {}) {
  const result = parseCountryFlagVariants(options);
  const outFile = path.resolve(options.outFile || path.join(process.cwd(), "output_next", "flags", `${result.tag}.json`));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return { outFile, result };
}

export function discoverCountryFlagTags(options = {}) {
  const gamePath = path.resolve(options.gamePath || "D:\\SteamLibrary\\steamapps\\common\\Victoria 3");
  const sourceIndex = buildCountryFlagSourceIndex(gamePath);
  const flagDefinitionIndex = buildFlagDefinitionIndex(gamePath);
  return [...new Set([...sourceIndex.tags, ...flagDefinitionIndex.tags])].sort();
}

export function writeCountryFlagBatch(options = {}) {
  const gamePath = path.resolve(options.gamePath || "D:\\SteamLibrary\\steamapps\\common\\Victoria 3");
  const assetRoot = path.resolve(options.assetRoot || path.join(process.cwd(), "game", "gfx", "coat_of_arms"));
  const outDir = path.resolve(options.outDir || path.join(process.cwd(), "output_next", "flags", "countries"));
  const tagLimit = options.tags ? normalizeTags(options.tags) : null;
  const sourceIndex = buildCountryFlagSourceIndex(gamePath);
  const flagDefinitionIndex = buildFlagDefinitionIndex(gamePath);
  const allTags = [...new Set([...sourceIndex.tags, ...flagDefinitionIndex.tags])].sort();
  const tags = (tagLimit || allTags)
    .filter((tag) => selectCountryFlagDefinitions(tag, sourceIndex, flagDefinitionIndex).definitions.length > 0)
    .sort();
  const assetIndex = buildAssetIndex(assetRoot);
  const manifestTags = [];

  fs.mkdirSync(outDir, { recursive: true });
  for (const tag of tags) {
    const selection = selectCountryFlagDefinitions(tag, sourceIndex, flagDefinitionIndex);
    const variants = selection.definitions
      .map((definition) => extractVariant(definition, sourceIndex, assetIndex, { tag }))
      .sort(sortVariants(tag));
    const sourceFiles = new Set(selection.definitions.map((definition) => definition.file));
    for (const variant of variants) {
      for (const file of collectLayerSourceFiles(variant.layers)) {
        sourceFiles.add(file);
      }
    }
    const specialTextIcons = findSpecialTextIcons(tag, assetIndex);
    const result = {
      tag,
      gamePath,
      assetRoot,
      sourceRoots: sourceIndex.sourceRoots,
      flagDefinitionFiles: selection.flagDefinitions.length ? flagDefinitionIndex.sourceFiles : [],
      flagDefinitions: selection.flagDefinitions,
      sourceFiles: [...sourceFiles].sort(),
      variants,
      specialTextIcons,
    };
    const outFile = path.join(outDir, `${safeFileStem(tag)}.json`);
    fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    manifestTags.push(summarizeTag(result, outFile, outDir));
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    gamePath,
    assetRoot,
    outDir,
    totalTags: manifestTags.length,
    totalVariants: manifestTags.reduce((sum, entry) => sum + entry.variants, 0),
    missingAssetReferences: manifestTags.reduce((sum, entry) => sum + entry.missingAssetReferences, 0),
    tags: manifestTags,
  };
  const manifestFile = path.join(outDir, "manifest.json");
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { outDir, manifestFile, manifest };
}

export function writeCountryFlagVariantPngs(options = {}) {
  const inputJson = path.resolve(options.inputJson || "");
  if (!inputJson) throw new Error("writeCountryFlagVariantPngs requires inputJson");
  const outDir = path.resolve(options.outDir || inputJson.replace(/\.json$/i, ""));
  const gamePath = path.resolve(options.gamePath || "D:\\SteamLibrary\\steamapps\\common\\Victoria 3");
  const flagWidth = Number(options.flagWidth || 240);
  const flagHeight = Number(options.flagHeight || 144);
  const script = powershellPreviewScriptPath();
  execFileSync("powershell", [
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    script,
    "-InputJson",
    inputJson,
    "-GamePath",
    gamePath,
    "-OutDir",
    outDir,
    "-Mode",
    "variants",
    "-FlagWidth",
    String(flagWidth),
    "-FlagHeight",
    String(flagHeight),
  ], { stdio: "ignore" });
  const files = fs.existsSync(outDir)
    ? listFiles(outDir, ".png").map((file) => path.resolve(file)).sort()
    : [];
  return {
    outDir,
    files,
  };
}

export function writeCountryFlagPreviewContactSheet(options = {}) {
  const inputJson = path.resolve(options.inputJson || "");
  if (!inputJson) throw new Error("writeCountryFlagPreviewContactSheet requires inputJson");
  const outFile = path.resolve(options.outFile || inputJson.replace(/\.json$/i, "_preview.png"));
  const gamePath = path.resolve(options.gamePath || "D:\\SteamLibrary\\steamapps\\common\\Victoria 3");
  const columns = Number(options.columns || 4);
  const flagWidth = Number(options.flagWidth || 240);
  const flagHeight = Number(options.flagHeight || 144);
  const maxVariants = Number(options.maxVariants || 0);
  const script = powershellPreviewScriptPath();
  execFileSync("powershell", [
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    script,
    "-InputJson",
    inputJson,
    "-GamePath",
    gamePath,
    "-OutFile",
    outFile,
    "-Columns",
    String(columns),
    "-FlagWidth",
    String(flagWidth),
    "-FlagHeight",
    String(flagHeight),
    "-MaxVariants",
    String(maxVariants),
  ], { stdio: "ignore" });
  const dimensions = readPngDimensions(outFile);
  return { outFile, ...dimensions };
}

export function loadCoaNamedColors(gamePath = "D:\\SteamLibrary\\steamapps\\common\\Victoria 3") {
  const namedColorRoot = path.join(path.resolve(gamePath), "game", "common", "named_colors");
  const colors = new Map();
  for (const file of listFiles(namedColorRoot, ".txt")) {
    for (const color of parseNamedColorFile(file)) {
      colors.set(color.name, color);
    }
  }
  return colors;
}

function powershellPreviewScriptPath() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "build_country_flag_preview.ps1");
}

function readPngDimensions(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length < 24 || bytes.toString("ascii", 1, 4) !== "PNG") {
    return { width: 0, height: 0 };
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

function normalizeTags(tags) {
  if (typeof tags === "string") {
    return tags.split(/[,;\s]+/).map((tag) => tag.trim().toUpperCase()).filter(Boolean).sort();
  }
  return [...tags].map((tag) => String(tag).trim().toUpperCase()).filter(Boolean).sort();
}

function summarizeTag(result, outFile, outDir) {
  const missingAssetReferences = result.variants
    .flatMap((variant) => variant.textures)
    .filter((texture) => texture.asset?.status === "missing")
    .length;
  const foundAssetReferences = result.variants
    .flatMap((variant) => variant.textures)
    .filter((texture) => texture.asset?.status === "found")
    .length;
  return {
    tag: result.tag,
    file: path.relative(outDir, outFile).replaceAll("\\", "/"),
    variants: result.variants.length,
    sourceFiles: result.sourceFiles.length,
    textureReferences: result.variants.flatMap((variant) => variant.textures).length,
    foundAssetReferences,
    missingAssetReferences,
    specialTextIcons: result.specialTextIcons.length,
  };
}

function safeFileStem(value) {
  const stem = String(value || "")
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/[\s.]+$/g, "")
    || "_";
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem) ? `_${stem}` : stem;
}

function parseNamedColorFile(file) {
  const parsed = parseClausewitzFile(file);
  const colorBlock = parsed.entries.find((entry) => entry.key === "colors")?.value;
  if (colorBlock?.type !== "object") return [];
  const colors = [];
  for (const entry of colorBlock.entries) {
    const color = parseColorValue(entry.value);
    if (!color) continue;
    colors.push({
      name: entry.key,
      sourceFile: file,
      line: entry.line,
      ...color,
    });
  }
  return colors;
}

function buildCountryFlagSourceIndex(gamePath) {
  const sourceRoots = countryCoatOfArmsRoots(gamePath);
  const definitionsByTag = new Map();
  const definitionsByKey = new Map();
  const sourceFiles = new Set();
  for (const sourceRoot of sourceRoots) {
    for (const file of listFiles(sourceRoot, ".txt")) {
      const parsed = parseClausewitzFile(file);
      const fileVariables = collectVariables(parsed.entries, new Map());
      for (const entry of parsed.entries) {
        if (isVariableKey(entry.key)) continue;
        const tag = countryTagFromVariantKey(entry.key);
        if (!tag && !entry.key.startsWith("sub_")) continue;
        const definition = { file, entry, variables: new Map(fileVariables) };
        definitionsByKey.set(entry.key, definition);
        if (!tag) continue;
        sourceFiles.add(file);
        if (!definitionsByTag.has(tag)) definitionsByTag.set(tag, []);
        definitionsByTag.get(tag).push(definition);
      }
    }
  }
  return {
    sourceRoots,
    sourceFiles: [...sourceFiles].sort(),
    definitionsByTag,
    definitionsByKey,
    tags: [...definitionsByTag.keys()].sort(),
  };
}

function buildFlagDefinitionIndex(gamePath) {
  const root = path.join(gamePath, "game", "common", "flag_definitions");
  const definitionsByTag = new Map();
  const sourceFiles = [];
  if (!fs.existsSync(root)) {
    return { sourceFiles, definitionsByTag, tags: [] };
  }
  for (const file of listFiles(root, ".txt")) {
    sourceFiles.push(file);
    const parsed = parseClausewitzFile(file);
    const fileVariables = collectVariables(parsed.entries, new Map());
    for (const entry of parsed.entries) {
      const tag = countryTagFromVariantKey(entry.key);
      if (!tag || entry.key !== tag) continue;
      const definitions = [];
      const object = entry.value?.type === "object" ? entry.value : { entries: [] };
      for (const child of object.entries) {
        if (child.key !== "flag_definition") continue;
        const flagObject = child.value?.type === "object" ? child.value : { entries: [] };
        const coaEntry = flagObject.entries.find((item) => item.key === "coa");
        if (!coaEntry) continue;
        const coaValues = atomValues(coaEntry.value);
        const coaKey = coaValues[coaValues.length - 1] || "";
        if (!coaKey) continue;
        const priorityEntry = flagObject.entries.find((item) => item.key === "priority");
        definitions.push({
          tag,
          key: coaKey,
          file,
          line: child.line,
          priority: priorityEntry ? Number(resolveAtomText(priorityEntry.value, fileVariables)) : 0,
        });
      }
      definitionsByTag.set(tag, dedupeFlagDefinitions(definitions));
    }
  }
  return {
    sourceFiles: sourceFiles.sort(),
    definitionsByTag,
    tags: [...definitionsByTag.keys()].sort(),
  };
}

function dedupeFlagDefinitions(definitions) {
  const seen = new Set();
  const result = [];
  for (const definition of definitions) {
    if (seen.has(definition.key)) continue;
    seen.add(definition.key);
    result.push(definition);
  }
  return result;
}

function selectCountryFlagDefinitions(tag, sourceIndex, flagDefinitionIndex) {
  const flagDefinitions = flagDefinitionIndex.definitionsByTag.get(tag) || [];
  if (flagDefinitions.length) {
    const definitions = flagDefinitions
      .map((flagDefinition) => sourceIndex.definitionsByKey.get(flagDefinition.key))
      .filter(Boolean);
    return { flagDefinitions, definitions };
  }
  return {
    flagDefinitions: [],
    definitions: sourceIndex.definitionsByTag.get(tag) || [],
  };
}

function countryTagFromVariantKey(key) {
  const match = String(key || "").match(/^([A-Z0-9]{3})(?:$|_)/);
  return match ? match[1] : "";
}

function countryCoatOfArmsRoots(gamePath) {
  const candidates = [
    path.join(gamePath, "game", "common", "coat_of_arms", "coat_of_arms"),
    ...listDlcCoatOfArmsRoots(path.join(gamePath, "game", "dlc")),
  ];
  return candidates.filter((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isDirectory());
}

function listDlcCoatOfArmsRoots(dlcRoot) {
  if (!fs.existsSync(dlcRoot)) return [];
  const roots = [];
  for (const file of listFiles(dlcRoot, ".txt")) {
    const normalized = file.replaceAll("\\", "/");
    if (!normalized.includes("/common/coat_of_arms/coat_of_arms/")) continue;
    roots.push(path.dirname(file));
  }
  return [...new Set(roots)].sort();
}

function listFiles(root, extension) {
  if (!fs.existsSync(root)) return [];
  const result = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (!extension || entry.name.toLowerCase().endsWith(extension.toLowerCase())) {
        result.push(fullPath);
      }
    }
  }
  return result.sort();
}

function buildAssetIndex(assetRoot) {
  const byPngName = new Map();
  if (!fs.existsSync(assetRoot)) return { assetRoot, byPngName };
  for (const file of listFiles(assetRoot, ".png")) {
    const name = path.basename(file).toLowerCase();
    const relativePath = path.relative(assetRoot, file).replaceAll("\\", "/");
    const record = { path: file, relativePath };
    if (!byPngName.has(name)) byPngName.set(name, []);
    byPngName.get(name).push(record);
  }
  return { assetRoot, byPngName };
}

function findAssetForTexture(texture, assetIndex) {
  if (texture === "pattern_solid.tga") {
    return { status: "builtin", note: "solid color pattern" };
  }
  const fileName = `${path.basename(texture, path.extname(texture))}.png`.toLowerCase();
  const matches = assetIndex.byPngName.get(fileName) || [];
  if (!matches.length) {
    return { status: "missing", expectedFileName: fileName };
  }
  const preferred = matches.find((match) => preferredAssetMatch(texture, match.relativePath)) || matches[0];
  return { status: "found", ...preferred };
}

function preferredAssetMatch(texture, relativePath) {
  const base = path.basename(texture).toLowerCase();
  if (base.startsWith("te_")) return relativePath.startsWith("textured_emblems/");
  if (base.startsWith("ce_")) return relativePath.startsWith("colored_emblems/");
  if (base.startsWith("pattern_")) return relativePath.startsWith("patterns/");
  return true;
}

function findSpecialTextIcons(tag, assetIndex) {
  const prefix = `${tag.toLowerCase()}_`;
  const results = [];
  for (const records of assetIndex.byPngName.values()) {
    for (const record of records) {
      if (!record.relativePath.startsWith("special_coa_texticons/")) continue;
      if (!path.basename(record.relativePath).toLowerCase().startsWith(prefix)) continue;
      results.push({ ...record, status: "found" });
    }
  }
  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function parseClausewitzFile(file) {
  const source = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const tokens = tokenize(source);
  let index = 0;
  const entries = [];
  while (index < tokens.length) {
    const assignment = parseAssignment();
    if (assignment) {
      entries.push(assignment);
    } else {
      index += 1;
    }
  }
  return { entries };

  function parseAssignment() {
    const keyToken = tokens[index];
    const eqToken = tokens[index + 1];
    if (!keyToken || keyToken.type !== "atom" || !eqToken || eqToken.type !== "equals") return null;
    index += 2;
    const value = parseValue();
    return {
      type: "assignment",
      key: keyToken.value,
      value,
      line: keyToken.line,
      endLine: value?.endLine || value?.line || keyToken.line,
    };
  }

  function parseValue() {
    const token = tokens[index];
    if (!token) return { type: "atom", value: "", line: 0, endLine: 0 };
    if (token.type === "open") return parseObject();
    if (token.type === "atom" && tokens[index + 1]?.type === "open") {
      index += 1;
      const args = parseObject();
      return { type: "function", name: token.value, args, line: token.line, endLine: args.endLine };
    }
    index += 1;
    return { type: "atom", value: token.value, line: token.line, endLine: token.line, quoted: token.quoted };
  }

  function parseObject() {
    const open = tokens[index];
    index += 1;
    const entries = [];
    const values = [];
    let endLine = open.line;
    while (index < tokens.length) {
      const token = tokens[index];
      if (token.type === "close") {
        endLine = token.line;
        index += 1;
        break;
      }
      const assignment = parseAssignment();
      if (assignment) {
        entries.push(assignment);
        continue;
      }
      const value = parseValue();
      if (value) values.push(value);
    }
    return { type: "object", entries, values, line: open.line, endLine };
  }
}

function tokenize(source) {
  const tokens = [];
  let index = 0;
  let line = 1;
  while (index < source.length) {
    const char = source[index];
    if (char === "\r") {
      index += 1;
      continue;
    }
    if (char === "\n") {
      line += 1;
      index += 1;
      continue;
    }
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "#") {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (char === "@" && source[index + 1] === "[") {
      const tokenLine = line;
      let value = "@[";
      index += 2;
      while (index < source.length) {
        const current = source[index];
        value += current;
        if (current === "\n") line += 1;
        index += 1;
        if (current === "]") break;
      }
      tokens.push({ type: "atom", value, line: tokenLine, quoted: false });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "open", value: char, line });
      index += 1;
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "close", value: char, line });
      index += 1;
      continue;
    }
    if (char === "=") {
      tokens.push({ type: "equals", value: char, line });
      index += 1;
      continue;
    }
    if (char === "\"") {
      const tokenLine = line;
      let value = "";
      index += 1;
      while (index < source.length) {
        const current = source[index];
        if (current === "\n") line += 1;
        if (current === "\"") {
          index += 1;
          break;
        }
        if (current === "\\" && source[index + 1]) {
          value += source[index + 1];
          index += 2;
          continue;
        }
        value += current;
        index += 1;
      }
      tokens.push({ type: "atom", value, line: tokenLine, quoted: true });
      continue;
    }
    const tokenLine = line;
    let value = "";
    while (index < source.length) {
      const current = source[index];
      if (/\s/.test(current) || current === "{" || current === "}" || current === "=" || current === "#") break;
      value += current;
      index += 1;
    }
    if (value) {
      tokens.push({ type: "atom", value, line: tokenLine, quoted: false });
    } else {
      index += 1;
    }
  }
  return tokens;
}

function isCountryVariantKey(key, tag) {
  return key === tag || key.startsWith(`${tag}_`);
}

function extractVariant(definition, sourceIndex, assetIndex, parentContext = null) {
  const { entry, file } = definition;
  const object = entry.value?.type === "object" ? entry.value : { entries: [], values: [], line: entry.line, endLine: entry.endLine };
  const variables = collectVariables(object.entries, definition.variables || new Map());
  const layers = [];
  const colors = {};
  let pattern = "";

  for (const entry of object.entries) {
    if (isVariableKey(entry.key)) {
      continue;
    }
    if (entry.key === "pattern") {
      pattern = resolveAtomText(entry.value, variables);
      continue;
    }
    if (/^color\d+$/.test(entry.key)) {
      colors[entry.key] = resolveAtomText(entry.value, variables);
      continue;
    }
    if (entry.key === "colored_emblem" || entry.key === "textured_emblem") {
      layers.push(extractLayer(entry, layers.length, assetIndex, variables));
      continue;
    }
    if (entry.key === "sub") {
      const subLayer = extractSubLayer(entry, layers.length, sourceIndex, assetIndex, variables);
      if (subLayer) layers.push(subLayer);
    }
  }

  const textures = collectTextures(pattern, layers, assetIndex, findEntryLine(object, "pattern"));
  const key = parentContext?.key || entry.key;
  const exportKey = parentContext?.tag ? exportKeyForVariant(parentContext.tag, key) : key;

  return {
    key,
    exportKey,
    sourceFile: file,
    startLine: entry.line,
    endLine: entry.endLine,
    pattern,
    colors,
    layers,
    textures,
  };
}

function extractLayer(entry, index, assetIndex, variables) {
  const object = entry.value?.type === "object" ? entry.value : { entries: [] };
  const localVariables = collectVariables(object.entries, variables);
  const layer = {
    index,
    kind: entry.key,
    line: entry.line,
    texture: "",
    colors: {},
    instances: [],
    mask: [],
  };

  for (const child of object.entries) {
    if (isVariableKey(child.key)) {
      continue;
    }
    if (child.key === "texture") {
      layer.texture = resolveAtomText(child.value, localVariables);
      layer.asset = findAssetForTexture(layer.texture, assetIndex);
    } else if (/^color\d+$/.test(child.key)) {
      layer.colors[child.key] = resolveAtomText(child.value, localVariables);
    } else if (child.key === "instance") {
      layer.instances.push(extractInstance(child.value, localVariables));
    } else if (child.key === "mask") {
      layer.mask = atomValues(child.value).map((value) => resolveNumberOrText(value, localVariables));
    }
  }

  return layer;
}

function extractSubLayer(entry, index, sourceIndex, assetIndex, variables) {
  const object = entry.value?.type === "object" ? entry.value : { entries: [] };
  const localVariables = collectVariables(object.entries, variables);
  const parent = resolveAtomText(object.entries.find((child) => child.key === "parent")?.value, localVariables);
  if (!parent) return null;
  const definition = sourceIndex.definitionsByKey.get(parent);
  const subVariant = definition ? extractVariant(definition, sourceIndex, assetIndex, { key: parent }) : null;
  const layer = {
    index,
    kind: "sub",
    line: entry.line,
    parent,
    sourceFile: definition?.file || "",
    startLine: definition?.entry.line || 0,
    endLine: definition?.entry.endLine || 0,
    pattern: subVariant?.pattern || "",
    colors: { ...(subVariant?.colors || {}) },
    instances: [],
    layers: subVariant?.layers || [],
    textures: subVariant?.textures || [],
    missing: !definition,
  };
  for (const child of object.entries) {
    if (/^color\d+$/.test(child.key)) {
      layer.colors[child.key] = resolveAtomText(child.value, localVariables);
    } else if (child.key === "instance") {
      layer.instances.push(extractInstance(child.value, localVariables));
    }
  }
  return layer;
}

function extractInstance(value, variables) {
  const object = value?.type === "object" ? value : { entries: [] };
  const result = {};
  for (const entry of object.entries) {
    if (entry.key === "scale" || entry.key === "position" || entry.key === "rotation") {
      result[entry.key] = atomValues(entry.value).map((item) => resolveNumberOrText(item, variables));
    } else if (entry.key === "offset") {
      result.offset = atomValues(entry.value).map((item) => resolveNumberOrText(item, variables));
    } else {
      result[entry.key] = resolveAtomText(entry.value, variables);
    }
  }
  return result;
}

function collectTextures(pattern, layers, assetIndex, patternLine = 0) {
  const textures = [];
  if (pattern) {
    textures.push({
      role: "pattern",
      name: pattern,
      asset: findAssetForTexture(pattern, assetIndex),
      line: patternLine,
    });
  }
  for (const layer of layers) {
    if (layer.texture) {
      textures.push({
        role: layer.kind,
        name: layer.texture,
        asset: findAssetForTexture(layer.texture, assetIndex),
        line: layer.line,
      });
    }
    if (layer.kind === "sub") {
      for (const texture of layer.textures || []) {
        textures.push({
          ...texture,
          role: `sub:${texture.role}`,
          parent: layer.parent,
        });
      }
    }
  }
  return textures;
}

function collectLayerSourceFiles(layers) {
  const files = [];
  for (const layer of layers || []) {
    if (layer.sourceFile) files.push(layer.sourceFile);
    files.push(...collectLayerSourceFiles(layer.layers));
  }
  return files;
}

function findEntryLine(object, key) {
  return object.entries.find((entry) => entry.key === key)?.line || object.line || 0;
}

function atomText(value) {
  if (!value) return "";
  if (value.type === "atom") return value.value;
  if (value.type === "function") return [value.name, ...atomValues(value.args)].join(" ");
  return atomValues(value).join(" ");
}

function atomValues(value) {
  if (!value) return [];
  if (value.type === "atom") return [value.value];
  if (value.type === "object") return value.values.map((item) => atomText(item));
  if (value.type === "function") return atomValues(value.args);
  return [];
}

function numberOrText(value) {
  const number = Number(value);
  return Number.isFinite(number) && String(value).trim() !== "" ? number : value;
}

function isVariableKey(key) {
  return String(key || "").startsWith("@");
}

function variableName(key) {
  return String(key || "").replace(/^@/, "");
}

function collectVariables(entries, parentVariables = new Map()) {
  const variables = new Map(parentVariables);
  for (const entry of entries || []) {
    if (!isVariableKey(entry.key)) continue;
    const name = variableName(entry.key);
    const value = resolveNumberOrText(atomText(entry.value), variables);
    variables.set(name, value);
  }
  return variables;
}

function resolveAtomText(value, variables = new Map()) {
  const text = atomText(value);
  const resolved = resolveNumberOrText(text, variables);
  return typeof resolved === "number" ? String(resolved) : String(resolved || "");
}

function resolveNumberOrText(value, variables = new Map()) {
  if (typeof value === "number") return value;
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.startsWith("@[")) {
    const result = evaluateExpression(text.slice(2, -1), variables);
    return Number.isFinite(result) ? result : text;
  }
  if (text.startsWith("@")) {
    const name = variableName(text);
    if (variables.has(name)) return variables.get(name);
    return text;
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : text;
}

function evaluateExpression(expression, variables = new Map()) {
  const replaced = String(expression)
    .replace(/@?([A-Za-z_][A-Za-z0-9_]*)/g, (match, name) => {
      if (!variables.has(name)) return match;
      const value = variables.get(name);
      return typeof value === "number" && Number.isFinite(value) ? String(value) : match;
    })
    .replace(/\s+/g, "");
  if (!/^[0-9+\-*/().]+$/.test(replaced)) return Number.NaN;
  return parseArithmeticExpression(replaced);
}

function parseArithmeticExpression(source) {
  let index = 0;
  const value = parseAddSub();
  return index === source.length ? value : Number.NaN;

  function parseAddSub() {
    let value = parseMulDiv();
    while (index < source.length) {
      const operator = source[index];
      if (operator !== "+" && operator !== "-") break;
      index += 1;
      const right = parseMulDiv();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  function parseMulDiv() {
    let value = parseUnary();
    while (index < source.length) {
      const operator = source[index];
      if (operator !== "*" && operator !== "/") break;
      index += 1;
      const right = parseUnary();
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }

  function parseUnary() {
    if (source[index] === "+") {
      index += 1;
      return parseUnary();
    }
    if (source[index] === "-") {
      index += 1;
      return -parseUnary();
    }
    return parsePrimary();
  }

  function parsePrimary() {
    if (source[index] === "(") {
      index += 1;
      const value = parseAddSub();
      if (source[index] !== ")") return Number.NaN;
      index += 1;
      return value;
    }
    const match = source.slice(index).match(/^\d+(?:\.\d+)?|\.\d+/);
    if (!match) return Number.NaN;
    index += match[0].length;
    return Number(match[0]);
  }
}

function parseColorValue(value) {
  if (!value) return null;
  if (value.type === "function") {
    return colorFromModel(value.name, atomValues(value.args).map(Number).filter(Number.isFinite));
  }
  if (value.type === "object") {
    return colorFromModel("rgb255", atomValues(value).map(Number).filter(Number.isFinite));
  }
  return null;
}

function colorFromModel(model, values) {
  if (values.length < 3) return null;
  const warnings = [];
  let rgb;
  if (model === "rgb") {
    rgb = values.slice(0, 3).map((value) => value <= 1 ? Math.round(value * 255) : Math.round(value));
  } else if (model === "hsv" || model === "hsv360") {
    if (values[0] < 0 || values[0] > 360 || values[1] < 0 || values[1] > 100 || values[2] < 0 || values[2] > 100) {
      warnings.push("hsv360 component outside expected range");
    }
    const h = values[0];
    const s = values[1] > 1 ? values[1] / 100 : values[1];
    const v = values[2] > 1 ? values[2] / 100 : values[2];
    rgb = hsvToRgb(h, s, v);
  } else {
    const direct = values.slice(0, 3);
    rgb = direct.every((value) => value <= 1)
      ? direct.map((value) => Math.round(value * 255))
      : direct.map((value) => Math.round(value));
  }
  rgb = rgb.map((value) => clamp(value, 0, 255));
  return {
    model,
    raw: values.slice(0, 3).join(" "),
    rgb,
    hex: rgbToHex(rgb),
    warnings,
  };
}

function hsvToRgb(h, s, v) {
  const hue = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = v - c;
  let rgbPrime;
  if (hue < 60) rgbPrime = [c, x, 0];
  else if (hue < 120) rgbPrime = [x, c, 0];
  else if (hue < 180) rgbPrime = [0, c, x];
  else if (hue < 240) rgbPrime = [0, x, c];
  else if (hue < 300) rgbPrime = [x, 0, c];
  else rgbPrime = [c, 0, x];
  return rgbPrime.map((value) => Math.round((value + m) * 255));
}

function rgbToHex(rgb) {
  return `#${rgb.map((value) => clamp(value, 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sortVariants(tag) {
  return (a, b) => variantRank(a.key, tag) - variantRank(b.key, tag) || a.key.localeCompare(b.key);
}

function exportKeyForVariant(tag, key) {
  if (key === tag || key.startsWith(`${tag}_`)) return key;
  return `${tag}_${key}`;
}

function variantRank(key, tag) {
  if (key === tag) return 0;
  if (key.includes("monarchy") && !key.includes("absolutist")) return 10;
  if (key.includes("absolutist")) return 20;
  if (key.includes("republic")) return 30;
  if (key.includes("communist")) return 40;
  if (key.includes("corporate")) return 50;
  if (key.includes("anarchist")) return 60;
  if (key.includes("theocracy")) return 70;
  return 100;
}
