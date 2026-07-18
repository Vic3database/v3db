const versionConfig = window.VIC3_VERSION_CONFIG || null;
let countryFlagData = {};

let data = {};
let dataIndex = null;
let loadedDataVersion = "";
const loadedDataChunks = new Set();
let dataChunkLoadPromise = null;
let countries = [];
let cultures = [];
let cultureTraits = [];
let cultureTraitGroups = [];
let stateRegions = [];
let strategicRegions = [];
let geographicRegions = [];
let companies = [];
let companyCharterTypes = [];
let interestGroups = [];
let interestGroupTraits = [];
let ideologies = [];
let laws = [];
let lawGroups = [];
let technologies = [];
let technologyEras = [];
let mapData = null;
let siteTitle = "Vicdata";

let byTag = new Map();
let byCulture = new Map();
let byStateRegion = new Map();
let byStrategicRegion = new Map();
let byGeographicRegion = new Map();
let byCompany = new Map();
let byInterestGroup = new Map();
let interestGroupTraitByKey = new Map();
let ideologyByKey = new Map();
let lawByKey = new Map();
let lawGroupByKey = new Map();
let technologyByKey = new Map();
const ideologyUsageCache = new Map();
let cultureTraitByKey = new Map();
let cultureTraitGroupByKey = new Map();
let changelogData = { baseVersion: "", targetVersion: "", boards: [], changes: [] };
let changelogBoardOrder = ["all"];
let changelogLoadedPair = "";
const newsItems = Array.isArray(window.VIC3_NEWS_DATA) ? window.VIC3_NEWS_DATA : [];
let stateKeyByProvinceColor = new Map();
let landStrategicRegions = [];
let seaStrategicRegions = [];
let seaStateRegionKeys = new Set();
let landStateRegions = [];
let landGeographicRegions = [];
let groupedGeographicRegions = [];
const MAP_SEA_COLOR = "#c9dde2";
const MAP_SEA_BORDER_COLOR = "#7f9ba6";
const MAP_MUTED_COLOR = "#e4e8e3";
const MAP_CULTURE_MATCH_COLOR = "#2f7f64";
const MAP_LAYER_CACHE_LIMIT = 5;
const MAP_LAND_ALPHA = 210;
const MAP_SEA_ALPHA = 0;
const MAP_MUTED_ALPHA = 150;
const MAP_LABEL_FONT_FAMILY = "\"Microsoft YaHei UI\", \"Microsoft YaHei\", \"PingFang SC\", \"Noto Sans CJK SC\", Arial, sans-serif";
const VICTORIAN_CENTURY_SOURCE_MARKER = "workshop/content/529340/3219394272";
const CONCEPT_TOOLTIP_DELAY_MS = 320;

let conceptTooltipTimer = 0;
let pendingConceptTooltipTarget = null;
let pendingConceptTooltipPoint = null;

const mapRuntime = {
  imageUrl: "assets/map/provinces.png",
  image: null,
  paperMapUrl: "assets/map/flatmap_votp.png",
  paperMapImage: null,
  sourcePixels: null,
  width: 4096,
  height: 1808,
  ready: false,
  loading: false,
  error: "",
  transform: {
    scale: 1,
    x: 0,
    y: 0,
  },
  drag: null,
  visibleStateKeys: new Set(),
  stateKeysByIndex: [""],
  ownerKeysByIndex: [""],
  pixelStateIndexes: null,
  pixelOwnerIndexes: null,
  filteredCountryTags: new Set(),
  countrySearchMatchedTags: new Set(),
  layerCache: new Map(),
  layerSignature: "",
};

const state = {
  view: "home",
  search: "",
  globalSearch: "",
  globalSearchDialogOpen: false,
  infoDialog: "",
  globalSearchIncludeLegacy: false,
  globalSearchActiveIndex: 0,
  changelogBoard: "all",
  changelogSearch: "",
  changelogPair: "",
  changelogLoading: false,
  changelogError: "",
  newsCategory: "all",
  newsPage: 1,
  flags: new Set(),
  tiers: new Set(),
  types: new Set(),
  strategicRegions: new Set(),
  heritageGroups: new Set(),
  heritages: new Set(),
  languageGroups: new Set(),
  languages: new Set(),
  resourceFilters: new Set(),
  companyKinds: new Set(),
  includeIndustryCharter: false,
  companyPrestigeGoods: new Set(),
  companyDlcs: new Set(),
  ideologyTypes: new Set(),
  ideologyGroups: new Set(),
  ideologyOccurrences: new Set(),
  ideologyLawGroups: new Set(),
  lawGroups: new Set(),
  commonLawIdeologyOnly: false,
  resultsPanelMode: "side",
  whiteDecentralized: false,
  subjectOverlordColors: true,
  omitIndigenousLanguagesCultures: true,
  omitDecentralizedTags: false,
  dimUnfilteredCountries: false,
  tradition: "",
  sort: "key",
  selectedTag: "",
  selectedCulture: "",
  selectedStateRegion: "",
  mapSelectedStateRegion: "",
  selectedStrategicRegion: "",
  selectedGeographicRegion: "",
  selectedCompany: "",
  selectedIdeology: "",
  selectedLaw: "",
  selectedTechnology: "",
  technologyCategory: "production",
  technologySearch: "",
  technologyViewport: { x: 0, y: 0, scale: 1 },
  selectedGlobalResult: "",
  globalSearchColorRestoreTag: "",
  detailKind: "country",
  regionListMode: "state",
  mapMode: "resource",
  mapSubject: "",
  theme: "votp",
};

const tierOrder = ["hegemony", "empire", "kingdom", "grand_principality", "principality", "city_state"];

const countryTypeOrder = ["recognized", "colonial", "company", "unrecognized", "decentralized"];

const countryTypeTagLabels = {
  recognized: "受认可国家",
  colonial: "殖民国家",
  unrecognized: "未受认可国家",
  decentralized: "松散政权",
  company: "公司国家",
};

const buildingIconFileByKey = {
  building_coal_mine: "coal_mine.png",
  building_iron_mine: "iron_mine.png",
  building_lead_mine: "lead_mine.png",
  building_sulfur_mine: "sulfur_mine.png",
  building_gold_mine: "gold_mine.png",
  building_gold_field: "gold_fields.png",
  building_logging_camp: "logging_camp.png",
  building_whaling_station: "whaling_station.png",
  building_rubber_plantation: "rubber_lodge.png",
  building_oil_rig: "oil_rig.png",
  building_fishing_wharf: "fishing_wharf.png",
  building_silk_plantation: "silk_plantation.png",
  building_coffee_plantation: "coffee_plantation.png",
  building_wheat_farm: "wheat_farm.png",
  building_millet_farm: "millet_farm.png",
  building_dye_plantation: "dye_plantation.png",
  building_cotton_plantation: "cotton_plantation.png",
  building_rice_farm: "rice_farm.png",
  building_tobacco_plantation: "tobacco_plantation.png",
  building_maize_farm: "maize_farm.png",
  building_livestock_ranch: "cattle_ranch.png",
  building_sugar_plantation: "sugar_plantation.png",
  building_tea_plantation: "tea_plantation.png",
  building_vineyard: "vineyards.png",
  building_banana_plantation: "banana_plantation.png",
  building_opium_plantation: "opium_plantation.png",
  building_rye_farm: "rye_farm.png",
  building_power_plant: "power_plant.png",
  building_port: "building_port.png",
  building_trade_center: "building_trade_center.png",
  building_railway: "building_railway.png",
  building_art_academy: "building_arts_academy.png",
  building_university: "building_university.png",
  building_panama_canal: "panama_canal.png",
  building_suez_canal: "suez_canal.png",
  building_skyscraper: "skyscraper.png",
  building_glassworks: "glassworks.png",
  building_textile_mill: "textile_industry.png",
  building_tooling_workshop: "tooling_workshops.png",
  building_furniture_manufactory: "furniture_manufacturies.png",
  building_food_industry: "food_industry.png",
  building_shipyard: "shipyards.png",
  building_paper_mill: "paper_mills.png",
  building_electrics_industry: "electrics_industry.png",
  building_motor_industry: "motor_industry.png",
  building_chemical_plant: "chemicals_industry.png",
  building_synthetics_plant: "synthetics_plants.png",
  building_steel_mill: "steel_mills.png",
  building_automotive_industry: "vehicles_industry.png",
  building_explosives_factory: "explosives_factory.png",
  building_munition_plant: "munition_plants.png",
  building_artillery_foundry: "artillery_foundry.png",
  building_arms_industry: "arms_industry.png",
  building_military_shipyards: "military_shipyards.png",
};

const strategicRegionOrder = [
  "region_western_europe",
  "region_southern_europe",
  "region_central_europe",
  "region_northern_europe",
  "region_balkans",
  "region_eastern_europe",
  "region_russia",
  "region_central_asia",
  "region_greater_persia",
  "region_near_east",
  "region_arabia",
  "region_india",
  "region_north_india",
  "region_south_india",
  "region_himalayas",
  "region_indochina",
  "region_indonesia",
  "region_south_china",
  "region_north_china",
  "region_northeast_asia",
  "region_siberia",
  "region_canada",
  "region_atlantic_coast",
  "region_great_plains",
  "region_pacific_coast",
  "region_mexico",
  "region_central_america",
  "region_caribbean",
  "region_gran_colombia",
  "region_andes",
  "region_la_plata",
  "region_brazil",
  "region_oceania",
  "region_north_africa",
  "region_nile_basin",
  "region_west_africa",
  "region_niger",
  "region_equatorial_africa",
  "region_east_africa",
  "region_southern_africa",
];

const strategicRegionOrderByKey = new Map(strategicRegionOrder.map((key, index) => [key, index]));

const strategicRegionContinentGroups = [
  {
    key: "europe",
    name: "欧洲",
    regions: [
      "region_western_europe",
      "region_southern_europe",
      "region_central_europe",
      "region_northern_europe",
      "region_balkans",
      "region_eastern_europe",
      "region_russia",
    ],
  },
  {
    key: "asia",
    name: "亚洲",
    regions: [
      "region_central_asia",
      "region_greater_persia",
      "region_near_east",
      "region_arabia",
      "region_india",
      "region_north_india",
      "region_south_india",
      "region_himalayas",
      "region_indochina",
      "region_indonesia",
      "region_south_china",
      "region_north_china",
      "region_northeast_asia",
      "region_siberia",
    ],
  },
  {
    key: "americas_oceania",
    name: "美洲与大洋洲",
    regions: [
      "region_canada",
      "region_atlantic_coast",
      "region_great_plains",
      "region_pacific_coast",
      "region_mexico",
      "region_central_america",
      "region_caribbean",
      "region_gran_colombia",
      "region_andes",
      "region_la_plata",
      "region_brazil",
      "region_oceania",
    ],
  },
  {
    key: "africa",
    name: "非洲",
    regions: [
      "region_north_africa",
      "region_nile_basin",
      "region_west_africa",
      "region_niger",
      "region_equatorial_africa",
      "region_east_africa",
      "region_southern_africa",
    ],
  },
];

const strategicRegionContinentByKey = new Map(strategicRegionContinentGroups.flatMap((group) => (
  group.regions.map((regionKey) => [regionKey, group.key])
)));

const heritageGroupOrder = [
  "heritage_group_european",
  "heritage_group_middle_eastern",
  "heritage_group_central_asian",
  "heritage_group_south_asian",
  "heritage_group_east_asian",
  "heritage_group_southeast_asian",
  "heritage_group_indigenous_american",
  "heritage_group_indigenous_oceanic",
  "heritage_group_african",
];

const heritageGroupOrderByKey = new Map(heritageGroupOrder.map((key, index) => [key, index]));

const resourceFilterGroups = [
  {
    key: "mines",
    filters: [
      { key: "building_coal_mine", label: "煤矿", resources: ["building_coal_mine"] },
      { key: "building_iron_mine", label: "铁矿", resources: ["building_iron_mine"] },
      { key: "building_lead_mine", label: "铅矿", resources: ["building_lead_mine"] },
      { key: "building_sulfur_mine", label: "硫矿", resources: ["building_sulfur_mine"] },
      { key: "building_gold_mine", label: "金矿", resources: ["building_gold_mine"] },
    ],
  },
  {
    key: "resources",
    filters: [
      { key: "building_fishing_wharf", label: "渔业码头", resources: ["building_fishing_wharf"] },
      { key: "building_whaling_station", label: "捕鲸站", resources: ["building_whaling_station"] },
      { key: "building_logging_camp", label: "伐木营地", resources: ["building_logging_camp"] },
      { key: "building_rubber_plantation", label: "橡胶种植园", resources: ["building_rubber_plantation"] },
      { key: "building_oil_rig", label: "油井", resources: ["building_oil_rig"] },
    ],
  },
  {
    key: "agriculture",
    filters: [
      { key: "building_wheat_farm", label: "小麦农场", arableResources: ["building_wheat_farm"] },
      { key: "building_rye_farm", label: "黑麦农场", arableResources: ["building_rye_farm"] },
      { key: "building_rice_farm", label: "水稻农场", arableResources: ["building_rice_farm"] },
      { key: "building_maize_farm", label: "玉米农场", arableResources: ["building_maize_farm"] },
      { key: "building_millet_farm", label: "杂谷农场", arableResources: ["building_millet_farm"] },
      { key: "building_livestock_ranch", label: "畜牧场", arableResources: ["building_livestock_ranch"] },
      { key: "building_vineyard", label: "葡萄园", arableResources: ["building_vineyard"] },
      { key: "building_coffee_plantation", label: "咖啡种植园", arableResources: ["building_coffee_plantation"] },
      { key: "building_tea_plantation", label: "茶叶种植园", arableResources: ["building_tea_plantation"] },
      { key: "building_tobacco_plantation", label: "烟草种植园", arableResources: ["building_tobacco_plantation"] },
      { key: "building_opium_plantation", label: "鸦片种植园", arableResources: ["building_opium_plantation"] },
      { key: "building_banana_plantation", label: "香蕉种植园", arableResources: ["building_banana_plantation"] },
      { key: "building_sugar_plantation", label: "糖料作物种植园", arableResources: ["building_sugar_plantation"] },
      { key: "building_silk_plantation", label: "丝绸种植园", arableResources: ["building_silk_plantation"] },
      { key: "building_cotton_plantation", label: "棉花种植园", arableResources: ["building_cotton_plantation"] },
      { key: "building_dye_plantation", label: "染料作物种植园", arableResources: ["building_dye_plantation"] },
    ],
  },
  {
    key: "light_industry",
    companyOnly: true,
    filters: [
      { key: "building_glassworks", label: "玻璃厂", companyBuildings: ["building_glassworks"] },
      { key: "building_textile_mill", label: "纺织厂", companyBuildings: ["building_textile_mill"] },
      { key: "building_tooling_workshop", label: "工艺装备工坊", companyBuildings: ["building_tooling_workshop"] },
      { key: "building_furniture_manufactory", label: "家具制造厂", companyBuildings: ["building_furniture_manufactory"] },
      { key: "building_food_industry", label: "食品厂", companyBuildings: ["building_food_industry"] },
      { key: "building_shipyard", label: "造船厂", companyBuildings: ["building_shipyard"] },
      { key: "building_paper_mill", label: "造纸厂", companyBuildings: ["building_paper_mill"] },
    ],
  },
  {
    key: "heavy_industry",
    companyOnly: true,
    filters: [
      { key: "building_electrics_industry", label: "电子厂", companyBuildings: ["building_electrics_industry"] },
      { key: "building_motor_industry", label: "动力机械厂", companyBuildings: ["building_motor_industry"] },
      { key: "building_chemical_plant", label: "肥料厂", companyBuildings: ["building_chemical_plant"] },
      { key: "building_synthetics_plant", label: "化学合成厂", companyBuildings: ["building_synthetics_plant"] },
      { key: "building_steel_mill", label: "炼钢厂", companyBuildings: ["building_steel_mill"] },
      { key: "building_automotive_industry", label: "汽车工业", companyBuildings: ["building_automotive_industry"] },
      { key: "building_explosives_factory", label: "炸药厂", companyBuildings: ["building_explosives_factory"] },
    ],
  },
  {
    key: "military_industry",
    companyOnly: true,
    filters: [
      { key: "building_munition_plant", label: "弹药厂", companyBuildings: ["building_munition_plant"] },
      { key: "building_artillery_foundry", label: "火炮铸造厂", companyBuildings: ["building_artillery_foundry"] },
      { key: "building_arms_industry", label: "武器厂", companyBuildings: ["building_arms_industry"] },
    ],
  },
  {
    key: "infrastructure",
    companyOnly: true,
    filters: [
      { key: "building_power_plant", label: "发电厂", companyBuildings: ["building_power_plant"] },
      { key: "building_port", label: "港口", companyBuildings: ["building_port"] },
      { key: "building_trade_center", label: "贸易中心", companyBuildings: ["building_trade_center"] },
      { key: "building_railway", label: "铁路", companyBuildings: ["building_railway"] },
      { key: "building_art_academy", label: "艺术学院", companyBuildings: ["building_art_academy"] },
    ],
  },
];

const resourceFilterByKey = new Map(resourceFilterGroups.flatMap((group) => (
  group.filters.map((filter) => [filter.key, filter])
)));

const companyKindOptions = [
  { key: "historical", label: "史实公司" },
  { key: "easter_egg", label: "彩蛋公司" },
  { key: "generic", label: "通用公司" },
];

const industryCharterOption = { key: "include", label: "包含产业特许" };

const companyPrestigeOptions = [
  { key: "none", label: "无名贵商品" },
  { key: "any", label: "有名贵商品" },
  { key: "generic_only", label: "仅通用名贵商品" },
  { key: "special_only", label: "仅特殊名贵商品" },
];

const companyDlcOptions = [
  { key: "base", label: "本体", title: "Victoria 3", icon: "v3.png" },
  { key: "dlc008", label: "Colossus of the South", title: "Colossus of the South", icon: "dlc008.png" },
  { key: "dlc010", label: "Sphere of Influence", title: "Sphere of Influence", icon: "dlc010.png" },
  { key: "dlc011", label: "Pivot of Empire", title: "Pivot of Empire", icon: "dlc011.png" },
  { key: "dlc013", label: "Charters of Commerce", title: "Charters of Commerce", icon: "dlc013.png" },
  { key: "dlc014", label: "National Awakening", title: "National Awakening", icon: "dlc014.png" },
  { key: "dlc016", label: "Iberian Twilight", title: "Iberian Twilight", icon: "dlc016.png" },
  { key: "dlc018", label: "The Great Wave", title: "The Great Wave", icon: "dlc018.png" },
];

const prestigeGoodIconOverrides = new Map([
  ["prestige_good_brunn_type_engines", "brunn_type_engine_prestige.png"],
  ["prestige_good_havana_sugar", "generic_sugar_prestige.png"],
  ["prestige_good_kikkoman_soy_sauce", "kikkoman_soy_sauce.png"],
]);

const ideologyTypeOptions = [
  { key: "interestGroup", label: "利益集团", shortLabel: "利益集团", className: "tag-ideology" },
  { key: "character", label: "角色", shortLabel: "角色", className: "tag-tradition" },
  { key: "movement", label: "运动", shortLabel: "运动", className: "tag-special" },
];

const viewLabels = {
  home: "首页",
  country: "国家",
  culture: "文化",
  region: "地区（资源）",
  company: "公司",
  ideology: "意识形态",
  law: "法律",
  technology: "科技",
  changelog: "更新日志",
  news: "游戏资讯",
};

const feedbackEmail = "vic3database@outlook.com";
const feedbackMailto = "mailto:vic3database@outlook.com?subject=Vicdata%20feature%20request";

const ideologyOccurrenceOptions = [
  { key: "default", label: "默认" },
  { key: "flavor", label: "风味" },
  { key: "technology", label: "科技" },
  { key: "journal", label: "日志" },
];

const ideologyLawGroupOrder = [
  "lawgroup_governance_principles",
  "lawgroup_distribution_of_power",
  "lawgroup_citizenship",
  "lawgroup_caste_hegemony",
  "lawgroup_edo_social_system",
  "lawgroup_church_and_state",
  "lawgroup_bureaucracy",
  "lawgroup_army_model",
  "lawgroup_navy_model",
  "lawgroup_internal_security",
  "lawgroup_economic_system",
  "lawgroup_trade_policy",
  "lawgroup_taxation",
  "lawgroup_land_reform",
  "lawgroup_colonization",
  "lawgroup_policing",
  "lawgroup_education_system",
  "lawgroup_health_system",
  "lawgroup_free_speech",
  "lawgroup_labor_rights",
  "lawgroup_childrens_rights",
  "lawgroup_rights_of_women",
  "lawgroup_welfare",
  "lawgroup_migration",
  "lawgroup_slavery",
  "lawgroup_labour_associations",
];

const ideologyLawGroupOrderMap = new Map(ideologyLawGroupOrder.map((key, index) => [key, index]));
const ideologyLawUnknownFilterGroup = { key: "uncategorized", label: "未分类" };

const ideologyLawFilterGroups = [
  {
    key: "power",
    label: "权力结构",
    lawGroups: [
      "lawgroup_governance_principles",
      "lawgroup_distribution_of_power",
      "lawgroup_citizenship",
      "lawgroup_caste_hegemony",
      "lawgroup_edo_social_system",
      "lawgroup_church_and_state",
      "lawgroup_bureaucracy",
      "lawgroup_army_model",
      "lawgroup_navy_model",
      "lawgroup_internal_security",
    ],
  },
  {
    key: "economy",
    label: "经济",
    lawGroups: [
      "lawgroup_economic_system",
      "lawgroup_trade_policy",
      "lawgroup_taxation",
      "lawgroup_land_reform",
      "lawgroup_colonization",
      "lawgroup_policing",
      "lawgroup_education_system",
      "lawgroup_health_system",
    ],
  },
  {
    key: "rights",
    label: "人权",
    lawGroups: [
      "lawgroup_free_speech",
      "lawgroup_labor_rights",
      "lawgroup_childrens_rights",
      "lawgroup_rights_of_women",
      "lawgroup_welfare",
      "lawgroup_migration",
      "lawgroup_slavery",
      "lawgroup_labour_associations",
    ],
  },
];

const ideologyLawFilterGroupByLawKey = new Map(ideologyLawFilterGroups.flatMap((group) => (
  group.lawGroups.map((lawKey) => [lawKey, group.key])
)));

const lawStanceLabels = {
  strongly_approve: "强烈支持",
  approve: "支持",
  neutral: "中立",
  disapprove: "反对",
  strongly_disapprove: "强烈反对",
};

const lawStanceDisplayOrder = ["strongly_approve", "approve", "neutral", "disapprove", "strongly_disapprove"];

const companyKindLabels = new Map(companyKindOptions.map((item) => [item.key, item.label]));
const companyPrestigeLabels = new Map([
  ...companyPrestigeOptions,
  { key: "generic_only", label: "通用名贵商品" },
  { key: "special_only", label: "特殊名贵商品" },
  { key: "mixed", label: "通用和特殊名贵商品" },
].map((item) => [item.key, item.label]));
const companyDlcLabels = new Map(companyDlcOptions.map((item) => [item.key, item.label]));
const ideologyTypeLabels = new Map(ideologyTypeOptions.map((item) => [item.key, item.label]));
const ideologyTypeShortLabels = new Map(ideologyTypeOptions.map((item) => [item.key, item.shortLabel]));
const ideologyTypeClassNames = new Map(ideologyTypeOptions.map((item) => [item.key, item.className]));
const ideologyTypeOrder = new Map(ideologyTypeOptions.map((item, index) => [item.key, index]));
let hasInitializedFilterSections = false;

const geographicRegionGroupOrder = ["natural", "history", "culture", "world", "economy", "pending", "old_strategic"];
const geographicRegionGroupLabels = new Map([
  ["old_strategic", "旧战略区域"],
  ["natural", "自然地理区域"],
  ["history", "历史地理区域"],
  ["culture", "文化地理区域"],
  ["world", "世界与大区"],
  ["economy", "经济地理区域"],
  ["pending", "暂置"],
]);

const els = {
  pageTitle: document.querySelector("#pageTitle"),
  metaLine: document.querySelector("#metaLine"),
  globalSearchButton: document.querySelector("#globalSearchButton"),
  globalSearchDialog: document.querySelector("#globalSearchDialog"),
  globalSearchDialogInput: document.querySelector("#globalSearchDialogInput"),
  globalSearchDialogResults: document.querySelector("#globalSearchDialogResults"),
  globalSearchLegacyToggle: document.querySelector("#globalSearchLegacyToggle"),
  globalSearchCloseButton: document.querySelector("#globalSearchCloseButton"),
  settingsNavButton: document.querySelector("#settingsNavButton"),
  aboutNavButton: document.querySelector("#aboutNavButton"),
  infoDialog: document.querySelector("#infoDialog"),
  infoDialogTitle: document.querySelector("#infoDialogTitle"),
  infoDialogBody: document.querySelector("#infoDialogBody"),
  infoDialogCloseButton: document.querySelector("#infoDialogCloseButton"),
  viewSelect: document.querySelector("#viewSelect"),
  versionSelect: document.querySelector("#versionSelect"),
  resetButton: document.querySelector("#resetButton"),
  countryViewButton: document.querySelector("#countryViewButton"),
  cultureViewButton: document.querySelector("#cultureViewButton"),
  regionViewButton: document.querySelector("#regionViewButton"),
  companyViewButton: document.querySelector("#companyViewButton"),
  ideologyViewButton: document.querySelector("#ideologyViewButton"),
  lawViewButton: document.querySelector("#lawViewButton"),
  searchInput: document.querySelector("#searchInput"),
  tierFilters: document.querySelector("#tierFilters"),
  countryTypeFilters: document.querySelector("#countryTypeFilters"),
  filteredCountryMapToggle: document.querySelector("#filteredCountryMapToggle"),
  strategicRegionFilterTitle: document.querySelector("#strategicRegionFilterTitle"),
  strategicRegionFilters: document.querySelector("#strategicRegionFilters"),
  geographicRegionFilters: document.querySelector("#geographicRegionFilters"),
  resourceFilterTitle: document.querySelector("#resourceFilterTitle"),
  industryCharterFilters: document.querySelector("#industryCharterFilters"),
  resourceFilters: document.querySelector("#resourceFilters"),
  companyKindFilters: document.querySelector("#companyKindFilters"),
  companyPrestigeFilters: document.querySelector("#companyPrestigeFilters"),
  companyDlcFilters: document.querySelector("#companyDlcFilters"),
  ideologyTypeFilters: document.querySelector("#ideologyTypeFilters"),
  ideologyGroupFilters: document.querySelector("#ideologyGroupFilters"),
  ideologyOccurrenceFilters: document.querySelector("#ideologyOccurrenceFilters"),
  ideologyLawGroupFilters: document.querySelector("#ideologyLawGroupFilters"),
  lawGroupFilters: document.querySelector("#lawGroupFilters"),
  commonLawIdeologyFilter: document.querySelector("#commonLawIdeologyFilter"),
  heritageGroupFilters: document.querySelector("#heritageGroupFilters"),
  heritageFilters: document.querySelector("#heritageFilters"),
  languageGroupFilters: document.querySelector("#languageGroupFilters"),
  languageFilters: document.querySelector("#languageFilters"),
  traditionFilters: document.querySelector("#traditionFilters"),
  sortSelect: document.querySelector("#sortSelect"),
  resultCount: document.querySelector("#resultCount"),
  activeHint: document.querySelector("#activeHint"),
  homeWelcome: document.querySelector("#homeWelcome"),
  homeGuideButton: document.querySelector("#homeGuideButton"),
  homeLinks: document.querySelector("#homeLinks"),
  mapPanel: document.querySelector("#mapPanel"),
  mapModeSelect: document.querySelector("#mapModeSelect"),
  mapSubjectSelect: document.querySelector("#mapSubjectSelect"),
  mapFitWidthButton: document.querySelector("#mapFitWidthButton"),
  mapViewport: document.querySelector("#mapViewport"),
  mapCanvas: document.querySelector("#mapCanvas"),
  mapTooltip: document.querySelector("#mapTooltip"),
  leftPanelToggle: document.querySelector("#leftPanelToggle"),
  bottomPanelToggle: document.querySelector("#bottomPanelToggle"),
  countryList: document.querySelector("#countryList"),
  detail: document.querySelector("#detail"),
  conceptTooltip: document.querySelector("#conceptTooltip"),
};
