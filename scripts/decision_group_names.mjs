import path from "node:path";

const zhHans = {
  "00_decisions": "通用决议",
  "01_russia_decisions": "俄罗斯",
  ai_unique_decisions: "人工智能专用",
  antarctica_expedition_decision: "南极探险",
  austria_decisions: "奥地利",
  austro_hungarian_decisions: "奥匈帝国",
  british_raj_decisions: "英属印度",
  bulgaria_decisions: "保加利亚",
  canada_australia: "加拿大与澳大利亚",
  canal_decisions: "运河建设",
  central_africa_expedition_decision: "中非探险",
  congo_expedition_decision: "刚果探险",
  crimean_war_decisions: "克里米亚战争",
  france_ashes: "法国王政复辟",
  france_savoy: "法国与萨伏依",
  goa_macao_decisions: "果阿与澳门",
  goods_ban_decisions: "商品禁运",
  grand_exhibition_decision: "万国博览会",
  greece_decisions: "希腊",
  india_decisions: "印度",
  ip4_portugal_decisions: "葡萄牙",
  japan_decisions: "日本",
  japan_shinto: "日本神道教",
  joi_flavor_decisions: "Victorian Century 风味内容",
  joi_gbr_decisions: "大英帝国",
  korea_decisions: "朝鲜",
  manifest_destiny: "昭昭天命",
  montenegro_decision: "黑山",
  niger_river_expedition_decision: "尼日尔河探险",
  pink_map_decision: "玫瑰色地图",
  princely_state_decision: "印度土邦",
  revoke_fernando_po_lease_decision: "费尔南多波租借地",
  romania_decision: "罗马尼亚",
  rome_decision: "罗马",
  skyscraper_decision: "摩天大楼",
  spanish_flu_decisions: "西班牙流感",
  tibet_expedition_decision: "西藏探险",
  west_america_expidition_decision: "北美西部探险",
};

export function decisionGroupName(sourceFile, locale = "zh-Hans") {
  const stem = path.posix.basename(String(sourceFile || ""), ".txt");
  if (locale === "zh-Hans" && zhHans[stem]) return zhHans[stem];
  return stem.replace(/^\d+_/, "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
