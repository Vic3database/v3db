const CONTENT_DYNAMIC_ENTITY_LABELS = Object.freeze({
  Character: "相关人物",
  Company: "相关公司",
  Country: "相关国家",
  Culture: "相关文化",
  GeographicRegion: "相关地理区域",
  Goods: "相关商品",
  InterestGroup: "相关利益集团",
  Law: "相关法律",
  Party: "相关政党",
  PoliticalLobby: "相关游说团",
  PoliticalMovement: "相关政治运动",
  State: "相关地区",
  StrategicRegion: "相关战略区域",
});

const CONTENT_DYNAMIC_NAMED_LABELS = Object.freeze({
  geographic_region_angola: "安哥拉地区",
  geographic_region_iberia_old: "伊比利亚旧王冠地区",
  geographic_region_mozambique: "莫桑比克地区",
  coal_scope: "煤炭",
  iron_scope: "铁",
  sulfur_scope: "硫磺",
  lead_scope: "铅",
  oil_scope: "石油",
  rubber_scope: "橡胶",
  silk_scope: "丝绸",
  coffee_scope: "咖啡",
});

const CONTENT_DYNAMIC_ENGLISH_LABELS = Object.freeze({
  当前国家: "current country",
  统治者头衔: "ruler title",
  宗主国统治者头衔: "overlord ruler title",
  继承人头衔: "heir title",
  统治者姓名: "ruler name",
  统治者名: "ruler first name",
  统治者姓氏: "ruler family name",
  继承人姓名: "heir name",
  继承人名: "heir first name",
  继承人姓氏: "heir family name",
  统治者: "ruler",
  相关人物: "relevant character",
  相关人物头衔: "relevant character title",
  相关人物姓名: "relevant character name",
  相关人物名字: "relevant character first name",
  相关人物姓氏: "relevant character family name",
  当前政体: "current government",
  首都城市: "capital city",
  相关城市: "relevant city",
  相关地区: "relevant state",
  当前法律: "current law",
  相关法律: "relevant law",
  相关利益集团: "relevant interest group",
  相关政党: "relevant party",
  相关游说团: "relevant lobby",
  相关政治运动: "relevant political movement",
  相关公司: "relevant company",
  相关文化: "relevant culture",
  相关国家: "relevant country",
  相关战略区域: "relevant strategic region",
  相关地理区域: "relevant geographic region",
  相关商品: "relevant good",
  动态称谓: "dynamic title",
  动态内容: "dynamic content",
  安哥拉地区: "Angola region",
  伊比利亚旧王冠地区: "old Iberian crown region",
  莫桑比克地区: "Mozambique region",
  煤炭: "coal",
  铁: "iron",
  硫磺: "sulfur",
  铅: "lead",
  石油: "oil",
  橡胶: "rubber",
  丝绸: "silk",
  咖啡: "coffee",
});

function localizedContentDynamicLabel(label) {
  return typeof localeRuntime !== "undefined" && localeRuntime.current !== "zh-Hans"
    ? CONTENT_DYNAMIC_ENGLISH_LABELS[label] || "dynamic content"
    : label;
}

function contentDynamicExpressionLabel(expression) {
  const source = String(expression || "");
  const named = source.match(/(?:GetGeographicRegion|sGoods)\('([^']+)'\)/)?.[1];
  if (named && CONTENT_DYNAMIC_NAMED_LABELS[named]) return CONTENT_DYNAMIC_NAMED_LABELS[named];
  if (/ROOT\.GetCountry\.GetName(?:NoFlag|NoFormatting)?\b/.test(source) || /GetPlayer\.Get(?:Name|TooltipTag)\b/.test(source)) return "当前国家";
  if (/ROOT\.GetCountry\.GetAdjective(?:NoFlag|NoFormatting)?\b/.test(source)) return "当前国家";
  if (/GetTopOverlord\.GetRuler\.GetPrimaryRoleTitle\b/.test(source)) return "宗主国统治者头衔";
  if (/GetRuler\.GetPrimaryRoleTitle\b/.test(source)) return "统治者头衔";
  if (/GetHeir\.GetPrimaryRoleTitle\b/.test(source)) return "继承人头衔";
  if (/GetRuler\.GetFullName\b/.test(source)) return "统治者姓名";
  if (/GetRuler\.GetFirstName\b/.test(source)) return "统治者名";
  if (/GetRuler\.GetLastName(?:NoFormatting)?\b/.test(source)) return "统治者姓氏";
  if (/GetHeir\.GetFullName\b/.test(source)) return "继承人姓名";
  if (/GetHeir\.GetFirstName\b/.test(source)) return "继承人名";
  if (/GetHeir\.GetLastName(?:NoFormatting)?\b/.test(source)) return "继承人姓氏";
  if (/GetRuler\.Get(?:HerHis|HerHim|SheHe|HerselfHimself)\b/.test(source)) return "统治者";
  if (/\.GetPrimaryRoleTitle\b/.test(source) && /(?:sCharacter|Character)/.test(source)) return "相关人物头衔";
  if (/\.GetFullName\b/.test(source) && /(?:sCharacter|Character)/.test(source)) return "相关人物姓名";
  if (/\.GetFirstName\b/.test(source) && /(?:sCharacter|Character)/.test(source)) return "相关人物名字";
  if (/\.GetLastName(?:NoFormatting)?\b/.test(source) && /(?:sCharacter|Character)/.test(source)) return "相关人物姓氏";
  if (/\.Get(?:HerHis|HerHim|SheHe|HerselfHimself)\b/.test(source)) return "相关人物";
  if (/GetGovernment\.GetName\b/.test(source)) return "当前政体";
  if (/GetCapital\.GetCityHubName\b/.test(source)) return "首都城市";
  if (/\.GetCityHubName\b/.test(source)) return "相关城市";
  if (/\.GetStateRegion\.GetName\b/.test(source)) return "相关地区";
  if (/sLaw\('current_law_scope'\)/.test(source)) return "当前法律";
  if (/GetLawType\('([^']+)'\)\.GetName/.test(source)) return "相关法律";
  if (/(?:gsInterestGroup|GetInterestGroupVariant)\b/.test(source)) return "相关利益集团";
  if (/sParty\b/.test(source)) return "相关政党";
  if (/sPoliticalLobby\b/.test(source)) return "相关游说团";
  if (/sPoliticalMovement\b/.test(source)) return "相关政治运动";
  if (/sCompany\b/.test(source)) return "相关公司";
  if (/sCulture\b/.test(source)) return "相关文化";
  if (/sCountry\b/.test(source)) return "相关国家";
  if (/sState\b/.test(source)) return "相关地区";
  if (/sStrategicRegion\b/.test(source)) return "相关战略区域";
  if (/sGoods\b/.test(source)) return "相关商品";
  for (const [entity, label] of Object.entries(CONTENT_DYNAMIC_ENTITY_LABELS)) {
    if (new RegExp(`(?:s${entity}|Get${entity})\\b`).test(source)) return label;
  }
  if (/\.GetCustom\b/.test(source)) return "动态称谓";
  return "动态内容";
}

function readableContentText(value) {
  return String(value || "").replace(/\[([^\]\r\n]*(?:Get[A-Z]|SCOPE|ROOT)[^\]\r\n]*)\]/g, (_, expression) => `（${localizedContentDynamicLabel(contentDynamicExpressionLabel(expression))}）`);
}

function readableContentHtml(value) {
  const source = String(value || "");
  let html = "";
  let cursor = 0;
  for (const match of source.matchAll(/\[([^\]\r\n]*(?:Get[A-Z]|SCOPE|ROOT)[^\]\r\n]*)\]/g)) {
    html += escapeHtml(source.slice(cursor, match.index));
    html += `<span class="dynamic-content-token" title="${escapeHtml(match[0])}">（${escapeHtml(localizedContentDynamicLabel(contentDynamicExpressionLabel(match[1])))}）</span>`;
    cursor = match.index + match[0].length;
  }
  return html + escapeHtml(source.slice(cursor));
}
