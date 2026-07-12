import fs from "node:fs";
import path from "node:path";

const TEXTURE_EXTENSIONS = /\.(dds|tga|png)$/i;

export class StableWeightedPicker {
  constructor(seed) {
    this.seed = String(seed || "");
  }

  pick(key, candidates) {
    const normalized = candidates
      .map((candidate) => ({
        value: candidate.value,
        weight: Number(candidate.weight || 0),
        source: candidate.source || "",
      }))
      .filter((candidate) => candidate.value && candidate.weight > 0);
    const totalWeight = normalized.reduce((sum, candidate) => sum + candidate.weight, 0);
    if (!totalWeight) throw new Error(`No weighted candidates for ${key}`);
    const raw = stableHash(`${this.seed}:${key}`);
    const roll = raw % totalWeight;
    let cumulativeWeight = 0;
    let selected = normalized[normalized.length - 1];
    const candidatesWithCumulative = normalized.map((candidate) => {
      cumulativeWeight += candidate.weight;
      if (roll < cumulativeWeight && selected === normalized[normalized.length - 1]) {
        selected = candidate;
      }
      return { ...candidate, cumulativeWeight };
    });
    return {
      key,
      seed: this.seed,
      hash: raw,
      roll,
      totalWeight,
      selected: selected.value,
      candidates: candidatesWithCumulative,
    };
  }
}

export function generateCoaTemplateCountryFlag(options = {}) {
  const tag = String(options.tag || "").trim().toUpperCase();
  if (!tag) throw new Error("generateCoaTemplateCountryFlag requires a tag");
  if (tag !== "ANK") throw new Error("First phase only supports ANK");

  const gamePath = path.resolve(options.gamePath || "D:\\SteamLibrary\\steamapps\\common\\Victoria 3");
  const assetRoot = path.resolve(options.assetRoot || path.join(process.cwd(), "game", "gfx", "coat_of_arms"));
  const parsedGame = loadGameInputs(gamePath);
  const assetIndex = buildAssetIndex(assetRoot);
  const country = parsedGame.countries.get(tag);
  if (!country) throw new Error(`Country definition not found for ${tag}`);

  const context = buildCountryContext(tag, country, parsedGame);
  const triggerSummary = evaluateSupportedTriggers(context);
  const picker = new StableWeightedPicker(tag);
  const choices = [];

  const templateCandidates = buildTemplateCandidates(parsedGame.templateLists.get("all"), triggerSummary);
  const templateChoice = picker.pick("template:8", templateCandidates);
  choices.push({ ...templateChoice, key: "template" });
  const templateName = templateChoice.selected;
  const template = parsedGame.templates.get(templateName);
  if (!template) throw new Error(`Template definition not found: ${templateName}`);

  const rendered = renderTemplateVariant({
    tag,
    templateName,
    template,
    parsedGame,
    assetIndex,
    picker,
    choices,
    triggerSummary,
  });

  const sourceFiles = [
    country.sourceFile,
    ...context.cultures.map((culture) => parsedGame.cultures.get(culture)?.sourceFile).filter(Boolean),
    ...context.heritages.map((heritage) => parsedGame.traits.get(heritage)?.sourceFile).filter(Boolean),
    parsedGame.templateListFiles.coaTemplates,
    parsedGame.templateListFiles.colorLists,
    parsedGame.templateListFiles.coloredEmblemLists,
    parsedGame.templateFiles.random,
  ];

  return {
    tag,
    source: "generated:coa-template",
    gamePath,
    assetRoot,
    sourceFiles: [...new Set(sourceFiles)].sort(),
    context,
    triggerSummary,
    templateName,
    generationTrace: {
      seed: tag,
      choices,
    },
    variants: [rendered],
  };
}

export function writeGeneratedCoaTemplateFlag(options = {}) {
  const result = generateCoaTemplateCountryFlag(options);
  const outFile = path.resolve(options.outFile || path.join(process.cwd(), "output_next", "flags", "generated", `${result.tag}.json`));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return { outFile, result };
}

function renderTemplateVariant({ tag, templateName, template, parsedGame, assetIndex, picker, choices, triggerSummary }) {
  const colors = {};
  const layers = [];

  for (const entry of template.entries) {
    if (entry.key === "pattern") continue;
    if (/^color\d+$/.test(entry.key)) {
      colors[entry.key] = resolveTemplateAtom(entry.value, {
        listType: "color",
        parsedGame,
        picker,
        choices,
        triggerSummary,
        choiceKey: entry.key,
      });
    }
  }

  const patternEntry = template.entries.find((entry) => entry.key === "pattern");
  const pattern = resolveTemplateAtom(patternEntry?.value, {
    listType: "pattern",
    parsedGame,
    picker,
    choices,
    triggerSummary,
    choiceKey: "pattern",
  });

  for (const entry of template.entries) {
    if (entry.key !== "colored_emblem" && entry.key !== "textured_emblem") continue;
    layers.push(renderLayer(entry, layers.length, {
      parsedGame,
      assetIndex,
      picker,
      choices,
      triggerSummary,
    }));
  }

  const textures = collectTextures(pattern, layers, assetIndex, template.line);
  return {
    key: tag,
    exportKey: tag,
    sourceFile: template.sourceFile,
    startLine: template.line,
    endLine: template.endLine,
    templateGenerated: true,
    templateName,
    triggerSummary,
    generationTrace: {
      seed: tag,
      choices,
    },
    pattern,
    colors,
    layers,
    textures,
  };
}

function renderLayer(entry, index, context) {
  const object = entry.value?.type === "object" ? entry.value : { entries: [] };
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
    if (child.key === "texture") {
      layer.texture = resolveTemplateAtom(child.value, {
        ...context,
        listType: entry.key === "textured_emblem" ? "texturedEmblem" : "coloredEmblem",
        choiceKey: `${entry.key}:${index}:texture`,
      });
      layer.asset = findAssetForTexture(layer.texture, context.assetIndex);
    } else if (/^color\d+$/.test(child.key)) {
      layer.colors[child.key] = atomText(child.value);
    } else if (child.key === "instance") {
      layer.instances.push(extractInstance(child.value));
    } else if (child.key === "mask") {
      layer.mask = atomValues(child.value).map(numberOrText);
    }
  }
  return layer;
}

function resolveTemplateAtom(value, context) {
  if (!value) return "";
  if (value.type === "function" && value.name === "list") {
    const listName = atomValues(value.args)[0];
    const list = listByName(listName, context);
    const candidates = buildListCandidates(list, context.triggerSummary);
    const choice = context.picker.pick(context.choiceKey, candidates);
    context.choices.push({ ...choice, key: context.choiceKey, list: listName });
    return choice.selected;
  }
  return atomText(value);
}

function listByName(listName, context) {
  if (context.listType === "color") return context.parsedGame.colorLists.get(listName);
  if (context.listType === "coloredEmblem") return context.parsedGame.coloredEmblemLists.get(listName);
  if (context.listType === "texturedEmblem") return context.parsedGame.texturedEmblemLists.get(listName);
  if (context.listType === "pattern") return context.parsedGame.patternLists.get(listName);
  return null;
}

function buildTemplateCandidates(templateList, triggerSummary) {
  return buildListCandidates(templateList, triggerSummary);
}

function buildListCandidates(list, triggerSummary) {
  if (!list) throw new Error("Template list not found");
  const candidates = [];
  for (const entry of list.entries) {
    if (isWeightKey(entry.key)) {
      candidates.push({
        weight: Number(entry.key),
        value: atomText(entry.value),
        source: "base",
      });
      continue;
    }
    if (entry.key !== "special_selection") continue;
    const special = specialSelectionCandidates(entry, triggerSummary);
    candidates.push(...special);
  }
  return candidates;
}

function specialSelectionCandidates(entry, triggerSummary) {
  const object = entry.value?.type === "object" ? entry.value : { entries: [] };
  const trigger = object.entries.find((child) => child.key === "trigger");
  const evaluation = evaluateTriggerBlock(trigger?.value, triggerSummary);
  if (!evaluation.passed) return [];
  return object.entries
    .filter((child) => isWeightKey(child.key))
    .map((child) => ({
      weight: Number(child.key),
      value: atomText(child.value),
      source: "special_selection",
      trigger: evaluation.matchedTriggers,
    }));
}

function evaluateTriggerBlock(value, triggerSummary) {
  if (!value) return { passed: true, matchedTriggers: [] };
  const text = blockText(value);
  const unsupported = [];
  for (const match of text.matchAll(/\b([A-Za-z0-9_:?]+)\s*=/g)) {
    const key = match[1];
    if (["trigger", "exists", "scope:target", "OR", "AND", "NOT"].includes(key)) continue;
    if (key.startsWith("coa_def_") && !(key in triggerSummary.supportedTriggers)) unsupported.push(key);
    if (!key.startsWith("coa_def_") && !["any_primary_culture", "religion", "has_discrimination_trait", "has_discrimination_trait_group"].includes(key)) {
      unsupported.push(key);
    }
  }
  if (unsupported.length) return { passed: false, matchedTriggers: [], unsupported };
  if (/coa_def_african_trigger\s*=\s*yes/.test(text) && !triggerSummary.supportedTriggers.coa_def_african_trigger) return { passed: false, matchedTriggers: [] };
  if (/coa_def_african_trigger\s*=\s*no/.test(text) && triggerSummary.supportedTriggers.coa_def_african_trigger) return { passed: false, matchedTriggers: [] };
  if (/coa_def_west_african_trigger\s*=\s*yes/.test(text) && !triggerSummary.supportedTriggers.coa_def_west_african_trigger) return { passed: false, matchedTriggers: [] };
  if (/coa_def_west_african_trigger\s*=\s*no/.test(text) && triggerSummary.supportedTriggers.coa_def_west_african_trigger) return { passed: false, matchedTriggers: [] };
  if (/coa_def_cross_trigger\s*=\s*yes/.test(text) && !triggerSummary.supportedTriggers.coa_def_cross_trigger) return { passed: false, matchedTriggers: [] };
  if (/coa_def_cross_trigger\s*=\s*no/.test(text) && triggerSummary.supportedTriggers.coa_def_cross_trigger) return { passed: false, matchedTriggers: [] };
  if (/coa_def_crescent_trigger\s*=\s*yes/.test(text) && !triggerSummary.supportedTriggers.coa_def_crescent_trigger) return { passed: false, matchedTriggers: [] };
  if (/coa_def_crescent_trigger\s*=\s*no/.test(text) && triggerSummary.supportedTriggers.coa_def_crescent_trigger) return { passed: false, matchedTriggers: [] };
  for (const match of text.matchAll(/has_discrimination_trait_group\s*=\s*([A-Za-z0-9_]+)/g)) {
    if (!triggerSummary.heritageGroups.includes(match[1]) && !triggerSummary.religionTraits.includes(match[1])) {
      return { passed: false, matchedTriggers: [] };
    }
  }
  for (const match of text.matchAll(/has_discrimination_trait\s*=\s*([A-Za-z0-9_]+)/g)) {
    const trait = match[1];
    if (!triggerSummary.heritages.includes(trait) && !triggerSummary.religionTraits.includes(trait)) {
      return { passed: false, matchedTriggers: [] };
    }
  }
  return {
    passed: true,
    matchedTriggers: triggerSummary.hitTriggers.filter((trigger) => text.includes(trigger)),
  };
}

function evaluateSupportedTriggers(context) {
  const hasAfricanHeritage = context.heritageGroups.includes("heritage_group_african");
  const hasWestAfricanHeritage = context.heritages.includes("heritage_guinean");
  const religionTraits = context.religionTraits || [];
  const supportedTriggers = {
    coa_def_african_trigger: hasAfricanHeritage,
    coa_def_west_african_trigger: hasAfricanHeritage && hasWestAfricanHeritage,
    coa_def_cross_trigger: religionTraits.includes("heritage_christian"),
    coa_def_crescent_trigger: religionTraits.includes("heritage_islamic"),
  };
  return {
    supportedTriggers,
    hitTriggers: Object.entries(supportedTriggers).filter(([, passed]) => passed).map(([key]) => key),
    missedTriggers: Object.entries(supportedTriggers).filter(([, passed]) => !passed).map(([key]) => key),
    unsupportedTriggers: [],
    heritages: context.heritages,
    heritageGroups: context.heritageGroups,
    religionTraits: context.religionTraits,
  };
}

function buildCountryContext(tag, country, parsedGame) {
  const cultures = country.cultures;
  const cultureRecords = cultures.map((culture) => parsedGame.cultures.get(culture)).filter(Boolean);
  const heritages = [...new Set(cultureRecords.map((culture) => culture.heritage).filter(Boolean))];
  const heritageGroups = [...new Set(heritages.map((heritage) => parsedGame.traits.get(heritage)?.traitGroup).filter(Boolean))];
  const religions = [...new Set(cultureRecords.map((culture) => culture.religion).filter(Boolean))];
  const religionTraits = [...new Set(religions.map((religion) => parsedGame.traits.get(religion)?.traitGroup).filter(Boolean))];
  return {
    tag,
    color: country.color,
    countryType: country.countryType,
    tier: country.tier,
    capital: country.capital,
    cultures,
    religions,
    heritages,
    heritageGroups,
    religionTraits,
  };
}

function loadGameInputs(gamePath) {
  const countryRoot = path.join(gamePath, "game", "common", "country_definitions");
  const culturesRoot = path.join(gamePath, "game", "common", "cultures");
  const traitsRoot = path.join(gamePath, "game", "common", "discrimination_traits");
  const templateRoot = path.join(gamePath, "game", "common", "coat_of_arms", "template_lists");
  const randomTemplateFile = path.join(gamePath, "game", "common", "coat_of_arms", "coat_of_arms", "03_random.txt");
  const coaTemplatesFile = path.join(templateRoot, "coa_templates.txt");
  const colorListsFile = path.join(templateRoot, "color_lists.txt");
  const patternListsFile = path.join(templateRoot, "pattern_lists.txt");
  const coloredEmblemListsFile = path.join(templateRoot, "colored_emblem_lists.txt");
  const texturedEmblemListsFile = path.join(templateRoot, "textured_emblem_lists.txt");

  return {
    countries: loadCountryDefinitions(countryRoot),
    cultures: loadCultures(culturesRoot),
    traits: loadDiscriminationTraits(traitsRoot),
    templateLists: parseTopLevelLists(coaTemplatesFile, "coat_of_arms_template_lists"),
    colorLists: parseTopLevelLists(colorListsFile, "color_lists"),
    patternLists: parseTopLevelLists(patternListsFile, "pattern_texture_lists"),
    coloredEmblemLists: parseTopLevelLists(coloredEmblemListsFile, "colored_emblem_texture_lists"),
    texturedEmblemLists: parseTopLevelLists(texturedEmblemListsFile, "textured_emblem_texture_lists"),
    templates: parseTopLevelLists(randomTemplateFile, "template"),
    templateListFiles: {
      coaTemplates: coaTemplatesFile,
      colorLists: colorListsFile,
      patternLists: patternListsFile,
      coloredEmblemLists: coloredEmblemListsFile,
      texturedEmblemLists: texturedEmblemListsFile,
    },
    templateFiles: {
      random: randomTemplateFile,
    },
  };
}

function loadCountryDefinitions(root) {
  const countries = new Map();
  for (const file of listFiles(root, ".txt")) {
    const parsed = parseClausewitzFile(file);
    for (const entry of parsed.entries) {
      if (!/^[A-Z0-9]{3}$/.test(entry.key)) continue;
      const object = entry.value?.type === "object" ? entry.value : { entries: [] };
      countries.set(entry.key, {
        tag: entry.key,
        sourceFile: file,
        line: entry.line,
        color: atomValues(findEntry(object, "color")?.value).map(Number).filter(Number.isFinite),
        countryType: atomText(findEntry(object, "country_type")?.value),
        tier: atomText(findEntry(object, "tier")?.value),
        cultures: atomValues(findEntry(object, "cultures")?.value),
        capital: atomText(findEntry(object, "capital")?.value),
      });
    }
  }
  return countries;
}

function loadCultures(root) {
  const cultures = new Map();
  for (const file of listFiles(root, ".txt")) {
    const parsed = parseClausewitzFile(file);
    for (const entry of parsed.entries) {
      const object = entry.value?.type === "object" ? entry.value : { entries: [] };
      const heritage = atomText(findEntry(object, "heritage")?.value);
      const religion = atomText(findEntry(object, "religion")?.value);
      if (!heritage && !religion) continue;
      cultures.set(entry.key, {
        key: entry.key,
        sourceFile: file,
        line: entry.line,
        heritage,
        religion,
        language: atomText(findEntry(object, "language")?.value),
      });
    }
  }
  return cultures;
}

function loadDiscriminationTraits(root) {
  const traits = new Map();
  for (const file of listFiles(root, ".txt")) {
    const parsed = parseClausewitzFile(file);
    for (const entry of parsed.entries) {
      const object = entry.value?.type === "object" ? entry.value : { entries: [] };
      const traitGroup = atomText(findEntry(object, "trait_group")?.value);
      if (!traitGroup) continue;
      traits.set(entry.key, {
        key: entry.key,
        sourceFile: file,
        line: entry.line,
        type: atomText(findEntry(object, "type")?.value),
        traitGroup,
      });
    }
  }
  return traits;
}

function parseTopLevelLists(file, rootKey) {
  const parsed = parseClausewitzFile(file);
  const root = parsed.entries.find((entry) => entry.key === rootKey);
  const object = root?.value?.type === "object" ? root.value : { entries: [] };
  const lists = new Map();
  for (const entry of object.entries) {
    if (entry.value?.type !== "object") continue;
    lists.set(entry.key, {
      key: entry.key,
      sourceFile: file,
      line: entry.line,
      endLine: entry.endLine,
      entries: entry.value.entries,
    });
  }
  return lists;
}

function parseClausewitzFile(file) {
  const source = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const tokens = tokenize(source);
  let index = 0;
  const entries = [];
  while (index < tokens.length) {
    const assignment = parseAssignment();
    if (assignment) entries.push(assignment);
    else index += 1;
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
    if (token.type === "atom" && token.value === "list" && tokens[index + 1]?.type === "atom") {
      const arg = tokens[index + 1];
      index += 2;
      return {
        type: "function",
        name: "list",
        args: {
          type: "object",
          entries: [],
          values: [{ type: "atom", value: arg.value, line: arg.line, endLine: arg.line, quoted: arg.quoted }],
          line: token.line,
          endLine: arg.line,
        },
        line: token.line,
        endLine: arg.line,
      };
    }
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
    if (char === "@") {
      const tokenLine = line;
      let value = "@";
      index += 1;
      if (source[index] === "[") {
        value += "[";
        index += 1;
        while (index < source.length) {
          const current = source[index];
          value += current;
          if (current === "\n") line += 1;
          index += 1;
          if (current === "]") break;
        }
      } else {
        while (index < source.length && /[A-Za-z0-9_\-]/.test(source[index])) {
          value += source[index];
          index += 1;
        }
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
    if (value) tokens.push({ type: "atom", value, line: tokenLine, quoted: false });
    else index += 1;
  }
  return tokens;
}

function findEntry(object, key) {
  return object.entries?.find((entry) => entry.key === key);
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

function blockText(value) {
  if (!value) return "";
  if (value.type === "atom") return value.value;
  if (value.type === "function") return `${value.name} { ${blockText(value.args)} }`;
  const entries = value.entries?.map((entry) => `${entry.key} = ${blockText(entry.value)}`) || [];
  const values = value.values?.map((item) => blockText(item)) || [];
  return [...entries, ...values].join(" ");
}

function extractInstance(value) {
  const object = value?.type === "object" ? value : { entries: [] };
  const result = {};
  for (const entry of object.entries) {
    if (entry.key === "scale" || entry.key === "position" || entry.key === "rotation") {
      result[entry.key] = atomValues(entry.value).map(numberOrText);
    } else if (entry.key === "offset") {
      result.offset = atomValues(entry.value).map(numberOrText);
    } else {
      result[entry.key] = atomText(entry.value);
    }
  }
  return result;
}

function collectTextures(pattern, layers, assetIndex, line) {
  const textures = [];
  if (pattern) {
    textures.push({
      role: "pattern",
      name: pattern,
      asset: findAssetForTexture(pattern, assetIndex),
      line,
    });
  }
  for (const layer of layers) {
    if (!layer.texture) continue;
    textures.push({
      role: layer.kind,
      name: layer.texture,
      asset: layer.asset || findAssetForTexture(layer.texture, assetIndex),
      line: layer.line,
    });
  }
  return textures;
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
  if (texture === "pattern_solid.tga") return { status: "builtin", note: "solid color pattern" };
  const fileName = `${path.basename(texture, path.extname(texture))}.png`.toLowerCase();
  const matches = assetIndex.byPngName.get(fileName) || [];
  if (!matches.length) return { status: "missing", expectedFileName: fileName };
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

function listFiles(root, extension) {
  if (!fs.existsSync(root)) return [];
  const result = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      else if (!extension || entry.name.toLowerCase().endsWith(extension.toLowerCase())) result.push(fullPath);
    }
  }
  return result.sort();
}

function isWeightKey(key) {
  return /^\d+(?:\.\d+)?$/.test(String(key || ""));
}

function numberOrText(value) {
  const text = String(value || "").trim();
  const number = Number(text);
  return Number.isFinite(number) && text !== "" ? number : text;
}

function stableHash(source) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
