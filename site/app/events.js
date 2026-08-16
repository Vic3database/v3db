function eventBoardAvailable() {
  return Boolean(dataIndex?.chunks?.event || events.length);
}

function eventTypeName(type) {
  if (type === "country_event") return t("board.event.countryEvent");
  if (type === "state_event") return t("board.event.stateEvent");
  return !type || type === "(empty)" ? t("board.event.otherEvent") : type;
}

function eventFlavorKind(event) {
  return event?.event_kind === "generic" ? "generic" : "flavor";
}

function eventFlavorKindName(kind) {
  return kind === "flavor" ? t("board.event.flavorEvent") : t("board.event.genericEvent");
}

function eventCountryScopeHtml(event) {
  const countriesInScope = (event.country_scope || []).map((tag) => countryRefLabel({ tag })).filter(Boolean);
  return countriesInScope.length
    ? `<section class="event-country-scope"><h3>${escapeHtml(t("board.event.countryScope"))}</h3><div class="event-country-scope-list">${countriesInScope.map((name) => `<span>${escapeHtml(name)}</span>`).join("")}</div></section>`
    : "";
}

const EVENT_TAG_KEYS = ["legislation", "journal", "character", "politics", "war-diplomacy", "economy-production", "technology", "society-culture", "disaster-disease", "country-territory", "election"];
function eventTagName(tag) { return t(`board.event.tag.${tag}`, tag); }
function eventTagHtml(tag) { return `<span class="event-marker event-tag event-tag-${escapeHtml(tag)}">${escapeHtml(eventTagName(tag))}</span>`; }

function eventIconUrl(event) {
  const icon = String(event?.icon || "").replaceAll("\\", "/").replace(/^gfx\/interface\/icons\//, "").replace(/\.dds$/i, ".webp");
  return icon ? `assets/event-icons/${icon}` : "";
}

function eventText(event, field, fallback = "") {
  return event?.loc?.[field] ? t(event.loc[field], fallback) : fallback;
}

function eventOptionText(event, option, index) {
  const key = event.loc?.options?.[option.name_key || `option_${index + 1}`];
  return key ? t(key, option.name_key || t("board.event.unnamedOption")) : (option.name_key || t("board.event.unnamedOption"));
}

function eventModifierLabel(effect) {
  const fallback = t("board.event.unnamedModifier");
  return effect?.loc ? translateMessage(effect.loc, fallback) : fallback;
}

function eventModifierValue(key, valueRaw) {
  const value = Number(valueRaw);
  if (!Number.isFinite(value)) return valueRaw || "";
  const percentage = key.endsWith("_mult") || key.endsWith("_success_add") || key.endsWith("_attraction_mult") || key.endsWith("_pol_str_mult");
  const displayed = percentage ? value * 100 : value;
  return `${displayed > 0 ? "+" : ""}${localizedNumber(displayed)}${percentage ? "%" : ""}`;
}

function eventModifierEffectsHtml(option) {
  const modifiers = (option.modifiers || []).filter((modifier) => modifier.name);
  if (!modifiers.length) return "";
  return `<div class="event-option-effects"><span class="event-option-effects-label">${escapeHtml(t("board.event.modifierEffects"))}</span>${modifiers.map((modifier) => `<div class="event-modifier">${(modifier.effects || []).length ? `<span>${modifier.effects.map((effect) => `${escapeHtml(eventModifierLabel(effect))} ${escapeHtml(eventModifierValue(effect.key, effect.value_raw))}`).join("；")}</span>` : `<span>${escapeHtml(t("board.event.missingModifierEffects"))}</span>`}</div>`).join("")}</div>`;
}

function eventOptionDetailHtml(event, option, index) {
  const label = eventOptionText(event, option, index);
  return `<article class="event-option-card"><header><span class="event-option-number">${index + 1}</span><strong>${escapeHtml(label)}</strong>${option.default_option ? `<span class="event-option-default">${escapeHtml(t("board.event.defaultOption"))}</span>` : ""}</header>${eventModifierEffectsHtml(option)}<details class="event-option-script"><summary>查看原始脚本</summary><pre>${escapeHtml(option.script || t("board.event.noScript"))}</pre></details></article>`;
}

function eventSearchText(event) {
  return [event.key, event.script_key, event.event_type, eventTypeName(event.event_type), eventText(event, "title", event.title_key || event.key), eventText(event, "desc", event.desc_key || ""), eventText(event, "flavor", event.flavor_key || ""), event.source_file, event.script?.trigger, event.script?.immediate, ...(event.options || []).flatMap((option, index) => [option.name_key, eventOptionText(event, option, index), option.script])].filter(Boolean).join(" ").toLowerCase();
}

function eventVisible(event) {
  return (!state.eventTypes.size || state.eventTypes.has(event.event_type || "(empty)"))
    && (!state.eventFlavorKinds.size || state.eventFlavorKinds.has(eventFlavorKind(event)))
    && (!state.eventTags.size || [...state.eventTags].every((tag) => (event.tags || []).includes(tag)))
    && (!state.search || eventSearchText(event).includes(state.search));
}

function sortEvents(left, right) {
  return eventGroupName(left).localeCompare(eventGroupName(right), undefined, { numeric: true })
    || left.key.localeCompare(right.key, undefined, { numeric: true });
}

function eventGroupName(event) {
  return event.namespace || String(event.key || event.id || "").split(".")[0] || t("board.event.ungrouped");
}

function eventGroupTitle(eventOrGroup) {
  const group = typeof eventOrGroup === "string" ? eventOrGroup : eventGroupName(eventOrGroup);
  return t(`event-group:${group}`, group);
}
/* const names = {
    "1848": "1848年革命",
    acceptance_events: "禁忌之恋事件",
    africa_colonial_events: "非洲殖民事件",
    agitator_legal_events: "煽动者与法律事件",
    agitators_election_events: "煽动者选举事件",
    agitators_law_events: "煽动者法律事件",
    algeria_events: "阿尔及利亚事件",
    coup_pulse_events: "政变进程事件",
    coup_aftermath_events: "政变后续事件",
    dreyfus: "德雷福斯事件",
    exiles_events: "流亡者事件",
    exiles_more_events: "流亡者后续事件",
    garibaldi_events: "加里波第事件",
    government_petition_events: "政府请愿事件",
    government_collapse: "政府崩溃事件",
    historical_agitators: "历史煽动者事件",
    land_ownership_law_events: "土地所有权法律事件",
    luddite_law_events: "卢德派法律事件",
    natural_borders: "自然疆界事件",
    rhine_confederation: "莱茵邦联事件",
    paris_commune: "巴黎公社事件",
    paris_commune_pulse_events: "巴黎公社进程事件",
    revolution_pulse1_events: "革命进程一事件",
    revolution_pulse_events: "革命进程事件",
    revolution_pulse2_events: "革命进程二事件",
    silkworm_diseases: "蚕病事件",
    slave_revolt_events: "奴隶起义事件",
    yeet_agitator_events: "驱逐煽动者事件",
    alaska: "阿拉斯加事件",
    amazon: "亚马孙事件",
    fsa_events: "自由州事件",
    acw_events: "美国内战事件",
    acw_followup_events: "美国内战后续事件",
    acw_je_events: "美国内战日志事件",
    wild_west: "狂野西部事件",
    assassination_events: "暗杀事件",
    emu_war: "鸸鹋战争事件",
    autocracy: "专制主义事件",
    austria_events: "奥地利事件",
    hungary_events: "匈牙利事件",
    kaiserforum: "皇帝论坛事件",
    austrian_fascism: "奥地利法西斯主义事件",
    austria_trialism: "奥地利三元制事件",
    austria_federation: "奥地利联邦事件",
    austria_germany: "奥地利与德国事件",
    balkan_wars: "巴尔干战争事件",
    bavarocracy_events: "巴伐利亚王国事件",
    eastern_crisis: "东方危机事件",
    eastern_question_austria: "奥地利东方问题事件",
    eastern_question_russia: "俄罗斯东方问题事件",
    grunderzeit: "奠基时代事件",
    hungry_forties: "饥饿的四十年代事件",
    metternich: "梅特涅事件",
    montenegrin_raiding: "黑山袭击事件",
    mon_state_formation: "黑山建国事件",
    national_awakening: "民族觉醒事件",
    ottoman_monarchs: "奥斯曼君主事件",
    serbia: "塞尔维亚事件",
    serbian_throne: "塞尔维亚王位事件",
    subjecthood_events: "臣属关系事件",
    the_grand_collapse: "大崩溃事件",
    yugoslavia: "南斯拉夫事件",
    belle_epoque_events: "美好年代事件",
    bic_breakup: "英属印度解体事件",
    boxer_rebellion_events: "义和团运动事件",
    acre_dispute: "阿克里纠纷事件",
    amazonas: "亚马孙地区事件",
    brazil_navy: "巴西海军事件",
    brazilian_minors: "巴西小国事件",
    brazilian_slavery: "巴西奴隶制事件",
    caudillo: "考迪罗事件",
    coffee_with_milk: "咖啡与牛奶事件",
    cristo_redentor: "救世基督像事件",
    culture_brazil: "巴西文化事件",
    culture_south_america: "南美洲文化事件",
    gran_colombia: "大哥伦比亚事件",
    andean_federation: "安第斯联邦事件",
    la_plata: "拉普拉塔事件",
    bp1_misc: "巴西事件",
    paraguay: "巴拉圭事件",
    japan_religion: "日本宗教事件",
    japan_events: "日本事件",
    japan_politics: "日本政治事件",
    hokkaido_events: "北海道事件",
    korea: "朝鲜事件",
    korea_colonization: "朝鲜殖民事件",
    china: "中国事件",
    india_events: "印度事件",
    india_nationalism_events: "印度民族主义事件",
    russian_central_asia: "俄罗斯中亚事件",
    caucasuswar: "高加索战争事件",
    caucasuswar_end: "高加索战争结束事件",
    kazakhstan_events: "哈萨克斯坦事件",
    portugal_single_fire_events: "葡萄牙单发事件",
    portuguese_colonialism: "葡萄牙殖民主义事件",
    spanish_events: "西班牙事件",
    vernacular_events: "方言事件",
    law_events: "法律事件",
    generic_laws: "通用法律事件",
    election_generic: "通用选举事件",
    election_conservative_events: "保守派选举事件",
    election_liberal_events: "自由派选举事件",
    election_moderate_events: "温和派选举事件",
    election_neutral: "中立派选举事件",
    movement_events: "政治运动事件",
    natural_disaster_events: "自然灾害事件",
    trade_route_events: "贸易路线事件",
    technology_events: "科技事件",
    production_tech_events: "生产技术事件",
    society_tech_events: "社会技术事件",
    military_tech_events: "军事技术事件",
    naval_tech_events: "海军技术事件",
    war_crimes: "战争罪行事件",
    plague: "瘟疫事件",
    famine_events: "饥荒事件",
    cholera: "霍乱事件",
    strike: "罢工事件",
    suffragist_events: "妇女参政事件",
    wedding: "婚礼事件",
    victoria: "维多利亚事件",
    peoples_springtime: "人民之春事件",
    federation_of_india: "印度联邦事件",
    fsa_events: "美利坚自由邦事件",
    gg_core: "大博弈核心事件",
    gg_afghanistan: "大博弈：阿富汗事件",
    gg_korea: "大博弈：朝鲜事件",
    BRZ_populism: "巴西民粹主义事件",
    BRZ_vargas: "瓦加斯时期事件",
    CHI_missionaries: "中国传教活动事件",
    ip4_coup: "伊比利亚政变事件",
    heavenly: "太平天国事件",
    raj: "英属印度事件",
    east_indies: "东印度群岛事件",
    dei_breakup: "荷属东印度解体事件",
    alk_breakup: "阿拉斯加解体事件",
    eic_breakup: "东印度公司解体事件",
    can_aus: "加拿大—澳大利亚事件",
    ep2_meiji: "明治维新事件",
    ep2_meiji_pulse: "明治维新进程事件",
    ep2_sakoku: "锁国事件",
    europeans_forced_to_end_great_game: "大博弈终结事件",
  };
  if (names[group]) return names[group];
  const tokenNames = {
    acw: "美国内战", africa: "非洲", agitator: "煽动者", anarchism: "无政府主义", anarchy: "无政府状态", asia: "亚洲", austria: "奥地利", brazil: "巴西", britain: "英国", bulgaria: "保加利亚", caucasus: "高加索", central: "中部", china: "中国", colonial: "殖民", colonization: "殖民", communist: "共产主义", communism: "共产主义", conflict: "冲突", conservative: "保守派", crisis: "危机", culture: "文化", diplomatic: "外交", discrimination: "歧视", eastern: "东方", economy: "经济", election: "选举", expedition: "远征", famine: "饥荒", fascism: "法西斯主义", federation: "联邦", french: "法国", german: "德国", germany: "德国", government: "政府", great: "大", greece: "希腊", greek: "希腊", healthcare: "医疗", historical: "历史", homeland: "故土", hungary: "匈牙利", india: "印度", indochina: "印度支那", industrial: "工业", italy: "意大利", italian: "意大利", japan: "日本", korea: "朝鲜", law: "法律", liberal: "自由派", migration: "移民", military: "军事", monarchy: "君主制", movement: "运动", natural: "自然", naval: "海军", negotiation: "谈判", oil: "石油", opium: "鸦片", ottoman: "奥斯曼", persia: "波斯", philippines: "菲律宾", plague: "瘟疫", political: "政治", portugal: "葡萄牙", portuguese: "葡萄牙", production: "生产", psychology: "心理学", rebellion: "起义", republic: "共和国", revolution: "革命", russia: "俄罗斯", russian: "俄罗斯", serbia: "塞尔维亚", serbian: "塞尔维亚", society: "社会", spain: "西班牙", spanish: "西班牙", state: "国家", strike: "罢工", subject: "臣属", suffragist: "妇女参政", technology: "科技", trade: "贸易", treaty: "条约", war: "战争", welfare: "福利", women: "女性", yugoslavia: "南斯拉夫", events: "", event: "", pulse: "进程", followup: "后续", aftermath: "后续", breakup: "解体", generic: "通用", contextual: "情境", neutral: "中立", other: "其他", leaders: "领袖", leader: "领袖", petitions: "请愿", petition: "请愿", revolutions: "革命", revolution: "革命", suppression: "镇压", laws: "法律", law: "法律", rights: "权利", railways: "铁路", railway: "铁路", urbanization: "城市化", aviation: "航空", trains: "铁路", camera: "摄影", film: "电影", nuclear: "核", crisis: "危机", pulse1: "进程一", pulse2: "进程二", end: "结束", single: "单一", fire: "火灾", colonialism: "殖民主义", monarchy: "君主制", religion: "宗教", politics: "政治", nationalism: "民族主义", independence: "独立", formation: "建国", events: "", misc: "杂项", core: "核心", proposal: "提案", lobbies: "游说", lobby: "游说", funding: "资助", fund: "资助", state: "国家", children: "儿童", citizenship: "公民身份", conscription: "征召", education: "教育", speech: "言论", slavery: "奴隶制", tax: "税收", welfare: "福利", unable: "无法", enact: "制定", imposition: "强制", economy: "经济", generic: "通用", internal: "内部", security: "安全", isolation: "孤立", labor: "劳工", labour: "劳工", association: "协会", migration: "移民", monarchy: "君主制", single: "单一", party: "政党", state: "国家", theocracy: "神权制", technocracy: "技术官僚制", corporate: "企业", council: "委员会", distribution: "分配", power: "权力", free: "自由", healthcare: "医疗", rights: "权利", slavery: "奴隶制", atheism: "无神论", tax: "税收", law: "法律", technology: "科技", society: "社会", production: "生产", naval: "海军", military: "军事", war: "战争", crimes: "罪行", crime: "犯罪", plague: "瘟疫", cholera: "霍乱", disaster: "灾害", disaster: "灾害", neighbor: "邻国", nihilism: "虚无主义", obligation: "义务", prohibition: "禁酒", prostitution: "卖淫", resignation: "辞职", wedding: "婚礼", vampire: "吸血鬼", panic: "恐慌", skyscraper: "摩天楼", titanic: "泰坦尼克", tunguska: "通古斯", oscar: "奥斯卡", wilde: "王尔德", psychology: "心理学", red: "红色", scare: "恐慌", camera: "摄影", rubber: "橡胶", trench: "堑壕", crimes: "罪行", war: "战争", treaty: "条约", london: "伦敦", texas: "得克萨斯", independence: "独立", tibet: "西藏", expedition: "远征", zanzibar: "桑给巴尔", alaska: "阿拉斯加", amazon: "亚马孙", amazonas: "亚马孙", argentina: "阿根廷", paraguay: "巴拉圭", peru: "秘鲁", bolivia: "玻利维亚", patagonia: "巴塔哥尼亚", sweden: "瑞典", japan: "日本", korea: "朝鲜", persia: "波斯", romania: "罗马尼亚", scotland: "苏格兰", egypt: "埃及", ethiopia: "埃塞俄比亚", hawaii: "夏威夷", hispaniola: "伊斯帕尼奥拉", cuba: "古巴", dominican: "多米尼加", spain: "西班牙", portugal: "葡萄牙", brazil: "巴西", india: "印度", philippines: "菲律宾", indochina: "印度支那", poland: "波兰", russia: "俄罗斯", kazakhstan: "哈萨克斯坦", caucasus: "高加索", korea: "朝鲜", mongolia: "蒙古", tibet: "西藏", china: "中国", japan: "日本", korea: "朝鲜", native: "原住民", resettlement: "重新安置", wild: "狂野", west: "西部", goldrush: "淘金热", gold: "黄金", rush: "热潮", emu: "鸸鹋", war: "战争", autocracy: "专制主义", positivism: "实证主义", psychology: "心理学", utilitarian: "功利主义", marx: "马克思主义", luddite: "卢德派", grunderzeit: "奠基时代", caudillo: "考迪罗", metternich: "梅特涅", dreyfus: "德雷福斯", garibaldi: "加里波第", victoria: "维多利亚", pedro: "佩德罗", meiji: "明治", tenpo: "天保", shogunate: "幕府", zaibatsu: "财阀", iwakura: "岩仓使节团", krakatoa: "喀拉喀托", krakow: "克拉科夫", galicia: "加利西亚", ezo: "虾夷", ryukyu: "琉球", sikh: "锡克", mughal: "莫卧儿", sepoy: "印度土兵", princely: "土邦", jail: "监狱", cable: "电缆", street: "街道", dreadnought: "无畏舰", hoax: "骗局", missionary: "传教士", missionaries: "传教士", boxer: "义和团", acre: "阿克里", amazon: "亚马孙", balkan: "巴尔干", wars: "战争", austrian: "奥地利", federation: "联邦", trialism: "三元制", germany: "德国", rhine: "莱茵", confederation: "邦联", hungry: "饥饿", forties: "四十年代", natural: "自然", borders: "疆界", silkworm: "蚕", diseases: "疾病", slave: "奴隶", revolt: "起义", yeet: "驱逐", agitator: "煽动者", government: "政府", collapse: "崩溃", petition: "请愿", acceptance: "接受度", vernacular: "方言", two: "二", spain: "西班牙", mon: "黑山", state: "国家", eastern: "东方", question: "问题", austria: "奥地利", russia: "俄罗斯", central: "中部", asia: "亚洲", caucasuswar: "高加索战争", end: "结束", expulsion: "驱逐", gg: "大博弈", core: "核心", lobby: "游说", proposal: "提案", fund: "资助", south: "南部", america: "美洲", spooky: "万圣节", halloween: "万圣节", sol: "生活水平", pm: "生产方式", event: "事件", events: "" , state: "国家", country: "国家", character: "人物", commander: "指挥官", generals: "将领", expedition: "远征", after: "后续", technical: "技术", special: "特殊", political: "政治", pulse: "进程", context: "背景", election: "选举", other: "其他", parties: "政党", neutral: "中立", conservative: "保守派", liberal: "自由派", moderate: "温和派", generic: "通用", law: "法律", laws: "法律", generic: "通用", welfare: "福利", rights: "权利", women: "女性", healthcare: "医疗", education: "教育", free: "自由", speech: "言论", power: "权力", distribution: "分配", economy: "经济", migration: "移民", internal: "内部", security: "安全", isolation: "孤立", labor: "劳工", labour: "劳工", associations: "协会", corporate: "企业", council: "委员会", republic: "共和国", monarchy: "君主制", single: "单一", party: "政党", state: "国家", atheism: "无神论", tax: "税收", technocracy: "技术官僚制", theocracy: "神权制", unable: "无法", enact: "制定", imposition: "强制", liberalism: "自由主义", famine: "饥荒", railway: "铁路", railways: "铁路", destiny: "天命", manifest: "昭昭天命", meiji: "明治", metro: "地铁", formation: "建国", movement: "运动", native: "原住民", resettlement: "重新安置", disaster: "灾害", neighbor: "邻国", nihilism: "虚无主义", obligation: "义务", oil: "石油", opium: "鸦片", wars: "战争", oscar: "奥斯卡", wilde: "王尔德", red: "红色", scare: "恐慌", resignation: "辞职", caudillo: "考迪罗", wedding: "婚礼", russia: "俄罗斯", great: "伟大", reformer: "改革者", russo: "俄中", chinese: "中国", scotland: "苏格兰", yard: "警察厅", secession: "分离", sick: "病弱", man: "人", skyscraper: "摩天楼", slave: "奴隶", owner: "所有者", paranoia: "偏执", earn: "赢得", recognition: "承认", afghanistan: "阿富汗", lobby: "游说", fund: "资助", south: "南部", america: "美洲", plague: "瘟疫", strike: "罢工", sweden: "瑞典", tanzimat: "坦齐马特", aviation: "航空", flamethrowers: "火焰喷射器", nursing: "护理", rubber: "橡胶", dt: "社会技术", trench: "堑壕", crimes: "罪行", titanic: "泰坦尼克", trade: "贸易", trains: "铁路", treaty: "条约", tunguska: "通古斯", urbanization: "城市化", utopian: "乌托邦", vampire: "吸血鬼", veiled: "隐秘", protectorate: "保护国", warlord: "军阀", zanzibar: "桑给巴尔", populism: "民粹主义", v: "维多利亚", BRZ: "巴西", CHI: "中国", gg: "大博弈", ip4: "第四个扩展包" };
  const parts = group.split("_").filter((part) => !["event", "events"].includes(part));
  const translated = parts.map((part) => tokenNames[part] || part).filter(Boolean).join("");
  return `${translated || group}事件`;
}

*/
function groupEvents(eventsToGroup) {
  const groups = new Map();
  eventsToGroup.forEach((event) => {
    const name = eventGroupName(event);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(event);
  });
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
    .map(([name, groupEvents]) => ({ name, events: groupEvents.sort(sortEvents) }));
}

function renderEventGroupNavigation(groups) {
  if (!els.eventGroupNav) return;
  els.eventGroupNav.innerHTML = groups.map(({ name, events: groupedEvents }) => `<button type="button" class="event-group-nav-item" data-event-group-target="${escapeHtml(name)}"><span>${escapeHtml(eventGroupTitle(name))}</span><code>${escapeHtml(name)}</code><small>${localizedNumber(groupedEvents.length)}</small></button>`).join("") || `<p class="event-group-nav-empty">${escapeHtml(t("board.event.empty"))}</p>`;
  els.eventGroupNav.querySelectorAll("[data-event-group-target]").forEach((button) => button.addEventListener("click", () => {
    const target = document.querySelector(`#event-group-${CSS.escape(button.dataset.eventGroupTarget)}`);
    const results = document.querySelector(".results");
    if (target && results) results.scrollTo({ top: Math.max(0, target.offsetTop - 12), behavior: "auto" });
  }));
}

function renderEventFilterOptions() {
  if (!els.eventTypeFilters || !els.eventFlavorFilters || !els.eventTagFilters) return;
  const types = [...new Set(events.map((event) => event.event_type || "(empty)"))].sort((left, right) => localizedCompare(eventTypeName(left), eventTypeName(right)));
  const allPressed = state.eventTypes.size === 0;
  els.eventTypeFilters.innerHTML = `<button class="filter-token event-type-filter" type="button" data-event-type="" aria-pressed="${allPressed}">${escapeHtml(t("board.event.allTypes"))}</button>${types.map((type) => `<button class="filter-token event-type-filter" type="button" data-event-type="${escapeHtml(type)}" aria-pressed="${state.eventTypes.has(type)}">${escapeHtml(eventTypeName(type))}</button>`).join("")}`;
  const allFlavorKindsPressed = state.eventFlavorKinds.size === 0;
  els.eventFlavorFilters.innerHTML = `<button class="filter-token event-flavor-filter" type="button" data-event-flavor-filter="" aria-pressed="${allFlavorKindsPressed}">${escapeHtml(t("board.event.allFlavorKinds"))}</button>${["flavor", "generic"].map((kind) => `<button class="filter-token event-flavor-filter" type="button" data-event-flavor-filter="${kind}" aria-pressed="${state.eventFlavorKinds.has(kind)}">${escapeHtml(eventFlavorKindName(kind))}</button>`).join("")}`;
  els.eventTagFilters.innerHTML = `<button class="filter-token event-tag-filter" type="button" data-event-tag="" aria-pressed="${state.eventTags.size === 0}">${escapeHtml(t("board.event.allTags", "全部标签"))}</button>${EVENT_TAG_KEYS.map((tag) => `<button class="filter-token event-tag-filter" type="button" data-event-tag="${tag}" aria-pressed="${state.eventTags.has(tag)}">${escapeHtml(eventTagName(tag))}</button>`).join("")}`;
  if (els.eventTypeFilters.dataset.bound === "true") return;
  els.eventTypeFilters.dataset.bound = "true";
  els.eventTypeFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-event-type]");
    if (!button) return;
    const type = button.dataset.eventType;
    if (!type) state.eventTypes.clear();
    else if (state.eventTypes.has(type)) state.eventTypes.delete(type);
    else state.eventTypes.add(type);
    if (state.selectedEvent && !eventVisible(eventByKey.get(state.selectedEvent))) {
      state.selectedEvent = "";
      replaceHash("/event");
    }
    render();
  });
  els.eventFlavorFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-event-flavor-filter]");
    if (!button) return;
    const kind = button.dataset.eventFlavorFilter;
    if (!kind) state.eventFlavorKinds.clear();
    else if (state.eventFlavorKinds.has(kind)) state.eventFlavorKinds.delete(kind);
    else state.eventFlavorKinds.add(kind);
    if (state.selectedEvent && !eventVisible(eventByKey.get(state.selectedEvent))) {
      state.selectedEvent = "";
      replaceHash("/event");
    }
    render();
  });
  els.eventTagFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-event-tag]");
    if (!button) return;
    const tag = button.dataset.eventTag;
    if (!tag) state.eventTags.clear();
    else if (state.eventTags.has(tag)) state.eventTags.delete(tag);
    else state.eventTags.add(tag);
    if (state.selectedEvent && !eventVisible(eventByKey.get(state.selectedEvent))) {
      state.selectedEvent = "";
      replaceHash("/event");
    }
    render();
  });
}

function renderEventBoard() {
  const visible = events.filter(eventVisible).sort(sortEvents);
  const selected = eventByKey.get(state.selectedEvent) || null;
  if (state.selectedEvent && !selected) {
    state.selectedEvent = "";
    replaceHash("/event");
  }
  els.countryList.className = "country-list event-list";
  if (els.eventSearchInput && els.eventSearchInput.value !== state.search) els.eventSearchInput.value = state.search;
  els.resultCount.textContent = t("board.event.resultCount", { count: localizedNumber(visible.length) });
  els.activeHint.textContent = state.eventTypes.size || state.eventTags.size ? t("board.event.filterHint", { types: localizedNumber(state.eventTypes.size), tags: localizedNumber(state.eventTags.size) }) : "";
  const groups = groupEvents(visible);
  renderEventGroupNavigation(groups);
  els.countryList.innerHTML = groups
    .map(({ name, events: groupedEvents }) => `<section class="event-group" id="event-group-${escapeHtml(name)}"><h3 class="event-group-title" data-event-group="${escapeHtml(name)}"><span>${escapeHtml(eventGroupTitle(name))}</span><code>${escapeHtml(name)}</code><small>${localizedNumber(groupedEvents.length)}</small></h3>${groupedEvents.map(eventCardHtml).join("")}</section>`)
    .join("") || `<p class="event-empty">${escapeHtml(t("board.event.empty"))}</p>`;
  els.countryList.querySelectorAll("[data-event-id]").forEach((card) => card.addEventListener("click", () => {
    state.selectedEvent = card.dataset.eventId;
    replaceHash(`/event/${encodeURIComponent(state.selectedEvent)}`);
    render();
  }));
  renderEventDetail(selected);
}

/* function eventCardHtml(event) {
  const selected = event.key === state.selectedEvent;
  const title = eventText(event, "title", event.title_key || event.key);
  const icon = eventIconUrl(event);
  const options = (event.options || []).map((option, index) => `<span class="event-option" data-event-option>${escapeHtml(eventOptionText(event, option, index))}</span>`).join("");
  return `<button class="event-card" type="button" data-event-id="${escapeHtml(event.key)}" data-event-kind="${eventFlavorKind(event)}" aria-pressed="${selected}"><span class="event-card-icon" aria-hidden="true">${icon ? `<img class="event-icon" src="${escapeHtml(icon)}" alt="">` : "◇"}</span><span class="event-card-copy"><strong>${escapeHtml(title)}</strong><small class="event-card-meta">${escapeHtml(event.key)} · ${escapeHtml(eventTypeName(event.event_type))}</small>${options ? `<span class="event-card-options">${options}</span>` : ""}</span></button>`;
} */

function renderEventDetail(event) {
  if (!event) {
    els.detail.innerHTML = `<section class="event-detail-empty"><span aria-hidden="true">◇</span><h2>${escapeHtml(t("board.event.selectTitle"))}</h2><p>${escapeHtml(t("board.event.selectDescription"))}</p></section>`;
    return;
  }
  const scriptSections = [["trigger", "board.event.trigger"], ["immediate", "board.event.immediate"]].filter(([key]) => event.script?.[key]);
  const title = eventText(event, "title", event.title_key || event.key);
  const desc = eventText(event, "desc", event.desc_key || "");
  const flavor = eventText(event, "flavor", event.flavor_key || "");
  const eventIds = event.triggered_event_ids || [];
  const image = [event.event_image?.video && `${t("board.event.video")}: ${event.event_image.video}`, event.event_image?.texture && `${t("board.event.texture")}: ${event.event_image.texture}`].filter(Boolean);
  const icon = eventIconUrl(event);
  els.detail.innerHTML = `<article class="event-detail"><header class="event-detail-head"><span class="event-detail-icon" aria-hidden="true">${icon ? `<img class="event-icon" src="${escapeHtml(icon)}" alt="">` : "◇"}</span><div><p>${escapeHtml(eventTypeName(event.event_type))}</p><h2>${escapeHtml(title)}</h2><code>${escapeHtml(event.key)}</code></div><button type="button" data-event-back aria-label="${escapeHtml(t("board.event.closeDetail"))}">×</button></header><div class="event-detail-meta"><span>${escapeHtml(t("board.event.placement", { value: event.placement || t("board.event.unspecified") }))}</span>${event.duration ? `<span>${escapeHtml(t("board.event.duration", { value: event.duration }))}</span>` : ""}${event.hidden ? `<span>${escapeHtml(t("board.event.hidden"))}</span>` : ""}</div>${desc ? `<section class="event-description"><h3>${escapeHtml(t("board.event.description"))}</h3><p>${escapeHtml(desc)}</p></section>` : ""}${flavor ? `<section class="event-flavor-section"><h3>${escapeHtml(t("board.event.flavor"))}</h3><p class="event-flavor">${escapeHtml(flavor)}</p></section>` : ""}${image.length ? `<section><h3>${escapeHtml(t("board.event.eventImage"))}</h3><div class="event-image-meta">${image.map((item) => `<code>${escapeHtml(item)}</code>`).join("")}</div></section>` : ""}<section class="event-source"><h3>${escapeHtml(t("board.event.source"))}</h3><code>${escapeHtml(event.source_file)}:${escapeHtml(event.source_line)}</code></section>${eventIds.length ? `<section><h3>${escapeHtml(t("board.event.triggeredEvents"))}</h3><div class="event-event-ids">${eventIds.map((id) => `<code>${escapeHtml(id)}</code>`).join("")}</div></section>` : ""}<section class="event-script-sections"><h3>${escapeHtml(t("board.event.scripts"))}</h3>${scriptSections.map(([key, label]) => `<details open><summary>${escapeHtml(t(label))}</summary><pre>${escapeHtml(event.script[key])}</pre></details>`).join("") || `<p>${escapeHtml(t("board.event.noScripts"))}</p>`}</section><section class="event-options"><h3>${escapeHtml(t("board.event.optionsTitle", { count: event.options.length }))}</h3><div class="event-option-card-list">${event.options.map((option, index) => eventOptionDetailHtml(event, option, index)).join("") || `<p>${escapeHtml(t("board.event.noOptions"))}</p>`}</div></section></article>`;
  els.detail.querySelector(".event-detail-head")?.insertAdjacentHTML("afterend", `<div class="event-detail-tags">${(event.tags || []).map(eventTagHtml).join("")}</div>`);
  els.detail.querySelector(".event-detail-meta")?.insertAdjacentHTML("beforeend", `<span>${escapeHtml(eventFlavorKindName(eventFlavorKind(event)))}</span>`);
  els.detail.querySelector(".event-detail-meta")?.insertAdjacentHTML("afterend", eventCountryScopeHtml(event));
  els.detail.querySelector("[data-event-back]")?.addEventListener("click", () => { state.selectedEvent = ""; replaceHash("/event"); render(); });
}

function eventCardHtml(event) {
  const selected = event.key === state.selectedEvent;
  const title = eventText(event, "title", event.title_key || event.key);
  const icon = eventIconUrl(event);
  const options = (event.options || []).map((option, index) => `<span class="event-option" data-event-option>${escapeHtml(eventOptionText(event, option, index))}</span>`).join("");
  return `<button class="event-card" type="button" data-event-id="${escapeHtml(event.key)}" data-event-kind="${eventFlavorKind(event)}" aria-pressed="${selected}"><span class="event-card-icon" aria-hidden="true">${icon ? `<img class="event-icon" src="${escapeHtml(icon)}" alt="">` : "◇"}</span><span class="event-card-copy"><strong>${escapeHtml(title)}</strong><small class="event-card-meta">${escapeHtml(event.key)} · ${escapeHtml(eventTypeName(event.event_type))}</small><span class="event-card-markers">${(event.tags || []).map(eventTagHtml).join("")}</span>${options ? `<span class="event-card-options">${options}</span>` : ""}</span></button>`;
}
