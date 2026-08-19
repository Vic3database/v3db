export const contentLocalizationOverrides = {
  events: {
    "acw_events.9": {
      zhHans: { title: "星杠旗（美利坚联盟国国旗）／给我的自由" },
    },
    "lobby_core.1": {
      en: { title: "Political Lobby Test Event" },
      zhHans: { title: "政治游说团测试事件" },
    },
  },
  decisions: {
    ai_unique_buff_modifier_get_again_decision: {
      en: { desc: "Reapplies the AI enhancement modifier for the country's rank when the player has approved the enhancement but the corresponding modifier has not yet been applied." },
      zhHans: { desc: "在玩家已批准人工智能强化但对应修正尚未应用时，重新为人工智能国家添加与其国家等级相符的强化修正。" },
    },
  },
};

export function applyContentLocalizationOverrides(dataset) {
  for (const [kind, rows] of Object.entries(dataset)) {
    const overrides = contentLocalizationOverrides[kind] || {};
    for (const row of rows) {
      const override = overrides[row.id];
      if (!override) continue;
      row.locales = row.locales || {};
      for (const [locale, values] of Object.entries(override)) row.locales[locale] = { ...(row.locales[locale] || {}), ...values };
      row.localization_source = "vicdata-manual";
    }
  }
  return dataset;
}
