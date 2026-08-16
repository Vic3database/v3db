export const EVENT_TAGS = [
  "legislation",
  "journal",
  "character",
  "politics",
  "war-diplomacy",
  "economy-production",
  "technology",
  "society-culture",
  "disaster-disease",
  "country-territory",
  "election",
];

const signals = {
  legislation: /\b(?:activate_law|add_enactment_modifier|currently_enacting_law|is_enacting_law|has_law(?:_or_variant)?|law_type:|law_stance|enact_law|remove_law|set_law)\b/i,
  journal: /\b(?:journal_entry|has_journal_entry|start_journal_entry|complete_journal_entry|fail_journal_entry|progress_journal_entry|set_journal_entry|remove_journal_entry|je_[a-z0-9_]+)\b/i,
  character: /\b(?:kill_character|create_character|character_template|ruler|leader|heir|succession|character:|scope:[a-z0-9_]*character|add_character_modifier|character_modifier|character_popularity|set_ideology|add_ideology|remove_ideology|set_character|age_character)\b/i,
  politics: /\b(?:interest_group|political_movement|ideology|radicals?|loyalists?|approval|legitimacy|government|agitator|revolution|protest|radicalism)\b/i,
  "war-diplomacy": /\b(?:war|battle|mobiliz|army|navy|front|diplomatic|relation|truce|alliance|infamy|war_goal|conquer|annex|secede|treaty|peace|combat)\b/i,
  "economy-production": /\b(?:building|production|goods?|market|trade_route|investment|budget|tax|treasury|wage|construction|resource|infrastructure|throughput|profit|price)\b/i,
  technology: /\b(?:technology|technolog(?:y|ies)|research|innovation|unlock_tech|tech_)\b/i,
  "society-culture": /\b(?:culture|religion|literacy|education|healthcare|health|population|pop_|migration|discrimination|assimilation|language|heritage|slavery|women|child|strata|standard_of_living)\b/i,
  "disaster-disease": /\b(?:disaster|devastation|mortality|plague|cholera|famine|earthquake|volcano|flood|fire|disease|epidemic|harvest|crop_failure|tunguska)\b/i,
  "country-territory": /\b(?:country|state|state_region|strategic_region|geographic_region|capital|ownership|secession|form_country|release_country|transfer_state|incorporat|province|colony|subject)\b/i,
  election: /\b(?:election|electorate|voting|ballot|campaign|candidate|political_party|party_list|vote|in_election_campaign)\b/i,
};

export function classifyEventTags(source) {
  const scripts = [source.trigger_raw, source.immediate_raw, ...(source.options || []).map((option) => option.raw || option.script || "")]
    .filter(Boolean)
    .join("\n");
  return EVENT_TAGS.filter((tag) => signals[tag].test(scripts));
}
