export function deriveCultureHomelandEffects(contentCollections = {}) {
  const effects = [];
  for (const [contentKind, records] of Object.entries(contentCollections)) {
    for (const record of records || []) {
      const raw = String(record?.raw || "");
      if (!/\b(?:add|remove)_homeland\s*=/.test(raw)) continue;
      const actions = homelandActionsFromRaw(raw);
      if (!actions.length) continue;
      effects.push({
        id: `${contentKind}:${record.id}`,
        content_id: record.id,
        content_kind: contentKind,
        localization_key: record.title_key || record.name_key || record.id,
        source_file: record.source_file || "",
        source_line: Number(record.source_line) || 0,
        dynamic_scope: actions.some((action) => action.dynamic_scope),
        eligible_when: effectConditionText(record),
        actions,
      });
    }
  }
  return effects.sort((left, right) => left.id.localeCompare(right.id));
}

function homelandActionsFromRaw(raw) {
  const source = String(raw || "");
  const matches = [...source.matchAll(/s:(STATE_[A-Z0-9_]+)\s*=\s*\{([\s\S]*?)\n\s*\}/g)];
  const actions = matches.flatMap((match) => homelandActionsFromStateBlock(match[1], match[2]));
  const directStates = [...new Set([...source.matchAll(/state_region\s*=\s*s:(STATE_[A-Z0-9_]+)/g)].map((match) => match[1]))];
  const dynamicRaw = source.replace(/s:STATE_[A-Z0-9_]+\s*=\s*\{[\s\S]*?\n\s*\}/g, "");
  if (/\b(?:add|remove)_homeland\s*=/.test(dynamicRaw)) {
    actions.push({
      state_regions: directStates.sort((left, right) => left.localeCompare(right)),
      added_cultures: uniqueCultureKeys(dynamicRaw, "add"),
      removed_cultures: uniqueCultureKeys(dynamicRaw, "remove"),
      dynamic_scope: !directStates.length,
    });
  }
  return actions.filter((action) => action.added_cultures.length || action.removed_cultures.length);
}

function homelandActionsFromStateBlock(stateRegion, raw) {
  const added = uniqueCultureKeys(raw, "add");
  const removed = uniqueCultureKeys(raw, "remove");
  if (!added.length && !removed.length) return [];
  return [{ state_regions: [stateRegion], added_cultures: added, removed_cultures: removed, dynamic_scope: false }];
}

function uniqueCultureKeys(raw, kind) {
  const expression = new RegExp(`${kind}_homeland\\s*=\\s*cu:([a-z0-9_]+)`, "g");
  return [...new Set([...String(raw || "").matchAll(expression)].map((match) => match[1]))].sort((left, right) => left.localeCompare(right));
}

function effectConditionText(record) {
  return String(record?.on_complete_raw || record?.when_taken_raw || record?.trigger_raw || "")
    .replace(/\s+/g, " ")
    .slice(0, 800);
}
