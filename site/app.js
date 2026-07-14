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
const ideologyUsageCache = new Map();
let cultureTraitByKey = new Map();
let cultureTraitGroupByKey = new Map();
let changelogData = { baseVersion: "", targetVersion: "", boards: [], changes: [] };
let changelogBoardOrder = ["all"];
let changelogLoadedPair = "";
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
  paperMapUrls: ["assets/map/flatmap_votp.webp", "assets/map/flatmap_votp.png"],
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
  selectedGlobalResult: "",
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
  changelog: "更新日志",
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

function setOptionalText(node, text) {
  if (!node) return;
  node.replaceChildren(document.createTextNode(text));
}

init().catch((error) => {
  console.error(error);
  setOptionalText(els.metaLine, `数据加载失败：${error?.message || String(error)}`);
});

async function init() {
  await loadCountryFlagData();
  await loadInitialDataset();
  syncViewLabels();
  initTheme();
  initDisplaySettings();
  renderFilterOptions();
  bindEvents();
  els.homeGuideButton?.addEventListener("click", () => openInfoDialog("about"));
  await applyHash();
  render();
}

async function loadCountryFlagData() {
  countryFlagData = window.VIC3_COUNTRY_FLAGS || await loadScriptValue("assets/flags/country-flags.js", "VIC3_COUNTRY_FLAGS") || {};
}

async function loadInitialDataset() {
  if (versionConfig) {
    const version = selectedVersionFromLocation() || versionConfig.default_version;
    await loadVersion(version || versionConfig.versions?.[0]?.version, { replaceUrl: false });
    return;
  }
  applyLoadedDataset(window.VIC3_DATA || {}, window.VIC3_MAP_DATA || null);
}

function selectedVersionFromLocation() {
  const params = new URLSearchParams(window.location.search);
  return params.get("version") || "";
}

async function loadVersion(version, options = {}) {
  const entry = versionEntry(version) || versionEntry(versionConfig?.default_version) || versionConfig?.versions?.[0];
  if (!entry) {
    applyLoadedDataset(window.VIC3_DATA || {}, window.VIC3_MAP_DATA || null);
    return;
  }
  setOptionalText(els.metaLine, `正在加载 ${entry.label || entry.version}`);
  const [nextDataIndex, nextMapData] = await Promise.all([
    loadScriptValue(entry.data_index, "VIC3_DATA_INDEX"),
    loadScriptValue(entry.map_data, "VIC3_MAP_DATA"),
  ]);
  dataIndex = nextDataIndex || null;
  loadedDataVersion = entry.version;
  loadedDataChunks.clear();
  applyLoadedDataset({ meta: dataIndex?.meta || {} }, nextMapData || null);
  await ensureDataChunksForRoute();
  if (els.versionSelect) els.versionSelect.value = entry.version;
  if (options.replaceUrl !== false) {
    const params = new URLSearchParams(window.location.search);
    params.set("version", entry.version);
    history.replaceState(null, "", `?${params.toString()}${window.location.hash}`);
  }
}

function dataChunksForView(view) {
  if (view === "country") return ["country", "culture", "region", "ideology"];
  if (view === "culture") return ["culture", "region", "country"];
  if (view === "region") return ["region", "country", "culture", "company"];
  if (view === "company") return ["company", "region", "country"];
  if (view === "ideology") return ["ideology", "law", "country"];
  if (view === "law") return ["law", "ideology", "country"];
  return [];
}

async function ensureDataChunksForRoute() {
  return ensureDataChunks(dataChunksForView(routeView()));
}

function routeView() {
  const segment = location.hash.replace(/^#\/?/, "").split("/")[0];
  if (["country", "culture", "region", "company", "ideology", "law"].includes(segment)) return segment;
  if (["state-region", "strategic-region", "geographic-region"].includes(segment)) return "region";
  return "home";
}

async function ensureDataChunks(chunkKeys) {
  if (!dataIndex?.chunks) return;
  const pending = chunkKeys.filter((key) => !loadedDataChunks.has(key));
  if (!pending.length) return;
  if (dataChunkLoadPromise) {
    await dataChunkLoadPromise;
    return ensureDataChunks(chunkKeys);
  }
  dataChunkLoadPromise = (async () => {
    for (const key of pending) {
      const entry = dataIndex.chunks[key];
      for (const file of entry?.files || []) {
        const chunk = await loadScriptValue(`versions/${loadedDataVersion}/${file}`, "VIC3_DATA_CHUNK");
        for (const [field, value] of Object.entries(chunk || {})) {
          data[field] = field === "countries" ? [...(data[field] || []), ...(value || [])] : value;
        }
      }
      loadedDataChunks.add(key);
    }
  })();
  try {
    await dataChunkLoadPromise;
    applyLoadedDataset(data, mapData);
  } finally {
    dataChunkLoadPromise = null;
  }
}

function versionEntry(version) {
  return (versionConfig?.versions || []).find((item) => item.version === version) || null;
}

function loadScriptValue(src, globalName) {
  return new Promise((resolve, reject) => {
    if (!src) {
      resolve(null);
      return;
    }
    window[globalName] = undefined;
    const script = document.createElement("script");
    script.src = `${src}${src.includes("?") ? "&" : "?"}v=${Date.now()}`;
    script.async = true;
    script.onload = () => {
      const value = window[globalName];
      script.remove();
      resolve(value);
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(`无法加载 ${src}`));
    };
    document.head.appendChild(script);
  });
}

function applyLoadedDataset(nextData, nextMapData) {
  data = nextData || {};
  countries = data.countries || [];
  cultures = data.cultures || [];
  cultureTraits = data.cultureTraits || [];
  cultureTraitGroups = data.cultureTraitGroups || [];
  stateRegions = data.stateRegions || [];
  strategicRegions = data.strategicRegions || [];
  geographicRegions = data.geographicRegions || [];
  companies = data.companies || [];
  companyCharterTypes = data.companyCharterTypes || [];
  interestGroups = data.interestGroups || [];
  interestGroupTraits = data.interestGroupTraits || [];
  ideologies = data.ideologies || [];
  laws = data.laws || [];
  lawGroups = data.lawGroups || [];
  mapData = nextMapData || null;
  siteTitle = versionConfig?.site_title || data.meta?.site_title || data.meta?.dataset_name || "Vicdata";

  byTag = new Map(countries.map((country) => [country.tag, country]));
  byCulture = new Map(cultures.map((culture) => [culture.key, culture]));
  byStateRegion = new Map(stateRegions.map((stateRegion) => [stateRegion.key, stateRegion]));
  byStrategicRegion = new Map(strategicRegions.map((strategicRegion) => [strategicRegion.key, strategicRegion]));
  byGeographicRegion = new Map(geographicRegions.map((region) => [region.key, region]));
  byCompany = new Map(companies.map((company) => [company.key, company]));
  byInterestGroup = new Map(interestGroups.map((group) => [group.key, group]));
  interestGroupTraitByKey = new Map(interestGroupTraits.map((trait) => [trait.key, trait]));
  ideologyByKey = new Map(ideologies.map((ideology) => [ideology.key, ideology]));
  lawByKey = new Map(laws.map((law) => [law.key, law]));
  lawGroupByKey = new Map(lawGroups.map((group) => [group.key, group]));
  cultureTraitByKey = new Map(cultureTraits.map((trait) => [trait.key, trait]));
  cultureTraitGroupByKey = new Map(cultureTraitGroups.map((group) => [group.key, group]));
  stateKeyByProvinceColor = buildStateKeyByProvinceColor();
  landStrategicRegions = strategicRegions.filter((region) => !isSeaStrategicRegion(region));
  seaStrategicRegions = strategicRegions.filter(isSeaStrategicRegion);
  seaStateRegionKeys = new Set(seaStrategicRegions.flatMap((region) => (
    (region.states || []).map((stateRegion) => stateRegion.key)
  )));
  landStateRegions = stateRegions.filter((stateRegion) => !isSeaStateRegion(stateRegion));
  landGeographicRegions = geographicRegions.filter((region) => geographicRegionStateRegions(region).some((stateRegion) => !isSeaStateRegion(stateRegion)));
  groupedGeographicRegions = geographicRegions.filter((region) => region.geographic_region_group && !region.is_current_strategic_region);
  resetDatasetState();
  resetMapRuntime();
  updateMetaLine();
  renderVersionOptions();
}

function dataCount(field, loadedRows) {
  if (loadedDataChunks.size || !dataIndex?.chunks) return loadedRows.length;
  for (const chunk of Object.values(dataIndex.chunks)) {
    if (Object.hasOwn(chunk.counts || {}, field)) return chunk.counts[field];
  }
  return loadedRows.length;
}

function resetDatasetState() {
  state.search = "";
  state.globalSearch = "";
  state.flags.clear();
  state.tiers.clear();
  state.types.clear();
  state.strategicRegions.clear();
  state.heritageGroups.clear();
  state.heritages.clear();
  state.languageGroups.clear();
  state.languages.clear();
  state.resourceFilters.clear();
  state.companyKinds.clear();
  state.includeIndustryCharter = false;
  state.companyPrestigeGoods.clear();
  state.companyDlcs.clear();
  state.ideologyTypes.clear();
  state.ideologyGroups.clear();
  state.ideologyOccurrences.clear();
  state.ideologyLawGroups.clear();
  state.lawGroups.clear();
  state.dimUnfilteredCountries = false;
  state.tradition = "";
  state.mapSubject = "";
  state.selectedTag = "";
  state.selectedCulture = "";
  state.selectedStateRegion = "";
  state.selectedStrategicRegion = "";
  state.selectedGeographicRegion = "";
  state.selectedCompany = "";
  state.selectedIdeology = "";
  state.selectedLaw = "";
  state.selectedGlobalResult = "";
  if (els.searchInput) els.searchInput.value = "";
  if (els.globalSearchDialogInput) els.globalSearchDialogInput.value = "";
  if (els.globalSearchLegacyToggle) els.globalSearchLegacyToggle.checked = false;
  hasInitializedFilterSections = false;
}

function resetMapRuntime() {
  if (!mapRuntime) return;
  mapRuntime.ready = false;
  mapRuntime.loading = false;
  mapRuntime.error = "";
  mapRuntime.sourcePixels = null;
  mapRuntime.stateKeysByIndex = [""];
  mapRuntime.ownerKeysByIndex = [""];
  mapRuntime.pixelStateIndexes = null;
  mapRuntime.pixelOwnerIndexes = null;
  mapRuntime.filteredCountryTags = new Set();
  mapRuntime.layerCache = new Map();
  mapRuntime.layerSignature = "";
  mapRuntime.lastMapStateRegions = null;
}

function updateMetaLine() {
  const datasetPrefix = data.meta?.dataset_name ? `${data.meta.dataset_name}，` : "";
  setOptionalText(els.metaLine, `${datasetPrefix}版本 ${data.meta?.victoria3_version || "未知"}，国家 ${dataCount("countries", countries)} 个，文化 ${dataCount("cultures", cultures)} 个，州地区 ${dataCount("stateRegions", stateRegions)} 个，地理区域 ${dataCount("geographicRegions", groupedGeographicRegions)} 个，公司 ${dataCount("companies", companies)} 个，意识形态 ${dataCount("ideologies", ideologies)} 个，法律 ${dataCount("laws", laws)} 条`);
}

function renderVersionOptions() {
  if (!els.versionSelect || !versionConfig) return;
  const entries = (versionConfig.versions || []).slice();
  els.versionSelect.innerHTML = entries.map((entry) => (
    `<option value="${escapeHtml(entry.version)}"${data.meta?.victoria3_version === entry.version ? " selected" : ""}>${escapeHtml(entry.label || entry.version)}</option>`
  )).join("");
}

function syncViewLabels() {
  const buttonByView = {
    country: els.countryViewButton,
    culture: els.cultureViewButton,
    region: els.regionViewButton,
    company: els.companyViewButton,
    ideology: els.ideologyViewButton,
    law: els.lawViewButton,
  };
  for (const [view, label] of Object.entries(viewLabels)) {
    if (buttonByView[view]) buttonByView[view].textContent = label;
    const option = els.viewSelect?.querySelector(`option[value="${view}"]`);
    if (option) option.textContent = label;
  }
}

function renderFilterOptions() {
  const tiers = unique(countries.map((country) => country.tier).filter(Boolean))
    .sort((a, b) => orderValueByList(tierOrder, a) - orderValueByList(tierOrder, b) || a.localeCompare(b));
  const types = unique(countries.map((country) => country.countryType).filter(Boolean))
    .sort((a, b) => orderValueByList(countryTypeOrder, a) - orderValueByList(countryTypeOrder, b) || a.localeCompare(b));
  const heritageGroups = collectCultureRefs((culture) => culture.heritage_group, sortHeritageGroupRef);
  const languageGroups = collectCultureRefs((culture) => culture.language_group);
  const traditions = collectCultureRefs((culture) => culture.traditions || []);

  els.tierFilters.innerHTML = tiers.map((tier) => {
    const sample = countries.find((country) => country.tier === tier);
    return optionToken("tier", tier, sample?.tierZh || tier, state.tiers.has(tier));
  }).join("");

  els.countryTypeFilters.innerHTML = types.map((type) => {
    const sample = countries.find((country) => country.countryType === type);
    return optionToken("type", type, countryTypeTagLabel(sample || { countryType: type }), state.types.has(type));
  }).join("");

  els.heritageGroupFilters.innerHTML = heritageGroups.map((group) => (
    optionToken("heritage-group", group.key, group.name_zh, state.heritageGroups.has(group.key))
  )).join("");

  els.languageGroupFilters.innerHTML = languageGroups.map((group) => (
    optionToken("language-group", group.key, group.name_zh, state.languageGroups.has(group.key))
  )).join("");

  els.traditionFilters.innerHTML = traditions.map((trait) => (
    optionToken("tradition", trait.key, trait.name_zh || trait.key, state.tradition === trait.key)
  )).join("");

  renderDependentFilterOptions();
  renderStrategicRegionFilterOptions();
  renderGeographicRegionFilterOptions();
  renderResourceFilterOptions();
  renderCompanyFilterOptions();
  renderIdeologyFilterOptions();
  renderLawFilterOptions();
  renderSortOptions();
}

function bindEvents() {
  document.querySelectorAll("[data-nav-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      await setView(button.dataset.navView);
      render();
    });
  });
  els.settingsNavButton?.addEventListener("click", () => {
    openInfoDialog("settings");
  });
  els.aboutNavButton?.addEventListener("click", () => {
    openInfoDialog("about");
  });
  els.globalSearchButton?.addEventListener("click", openGlobalSearchDialog);
  els.globalSearchCloseButton?.addEventListener("click", closeGlobalSearchDialog);
  els.globalSearchDialog?.addEventListener("click", (event) => {
    if (event.target === els.globalSearchDialog) closeGlobalSearchDialog();
  });
  els.infoDialogCloseButton?.addEventListener("click", closeInfoDialog);
  els.infoDialog?.addEventListener("click", (event) => {
    if (event.target === els.infoDialog) closeInfoDialog();
  });
  els.globalSearchDialogInput?.addEventListener("input", () => {
    state.globalSearch = els.globalSearchDialogInput.value.trim().toLowerCase();
    state.globalSearchActiveIndex = 0;
    renderGlobalSearchDialogResults();
  });
  els.globalSearchLegacyToggle?.addEventListener("change", () => {
    state.globalSearchIncludeLegacy = els.globalSearchLegacyToggle.checked;
    renderGlobalSearchDialogResults();
  });
  document.addEventListener("keydown", handleGlobalSearchDialogKeydown);
  document.addEventListener("keydown", handleInfoDialogKeydown);
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-detail-back]");
    if (!button) return;
    await setView(button.dataset.detailBack || "country");
    render();
  });
  els.countryViewButton?.addEventListener("click", async () => {
    await setView("country");
    render();
  });
  els.cultureViewButton?.addEventListener("click", async () => {
    await setView("culture");
    render();
  });
  els.regionViewButton?.addEventListener("click", async () => {
    await setView("region");
    render();
  });
  els.companyViewButton?.addEventListener("click", async () => {
    await setView("company");
    render();
  });
  els.ideologyViewButton?.addEventListener("click", async () => {
    await setView("ideology");
    render();
  });
  els.lawViewButton?.addEventListener("click", async () => {
    await setView("law");
    render();
  });
  els.viewSelect?.addEventListener("change", async () => {
    await setView(els.viewSelect.value);
    render();
  });
  els.versionSelect?.addEventListener("change", async () => {
    hideTransientOverlays();
    els.versionSelect.disabled = true;
    try {
      await loadVersion(els.versionSelect.value);
      renderFilterOptions();
      await applyHash();
      render();
    } finally {
      els.versionSelect.disabled = false;
    }
  });
  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value.trim().toLowerCase();
    render();
  });

  bindTokenSet("[data-filter]", state.flags, "filter");
  bindTokenSet("[data-tier]", state.tiers, "tier");
  bindTokenSet("[data-type]", state.types, "type");
  els.filteredCountryMapToggle?.addEventListener("click", () => {
    state.dimUnfilteredCountries = !state.dimUnfilteredCountries;
    render();
  });
  bindContainerTokenSet(els.strategicRegionFilters, state.strategicRegions, "strategicRegion");
  els.geographicRegionFilters?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-geographic-region-filter]");
    if (!button || !els.geographicRegionFilters.contains(button)) return;
    const value = button.dataset.geographicRegionFilter;
    state.selectedGeographicRegion = state.selectedGeographicRegion === value ? "" : value;
    render();
  });
  bindResourceFilterTokens();
  bindTokenChoice(els.industryCharterFilters, "industryCharter", () => {
    state.includeIndustryCharter = !state.includeIndustryCharter;
    renderCompanyFilterOptions();
    render();
  });
  bindContainerTokenSet(els.companyKindFilters, state.companyKinds, "companyKind");
  bindContainerTokenSet(els.companyPrestigeFilters, state.companyPrestigeGoods, "companyPrestige");
  bindContainerTokenSet(els.companyDlcFilters, state.companyDlcs, "companyDlc");
  bindContainerTokenSet(els.ideologyTypeFilters, state.ideologyTypes, "ideologyType");
  bindContainerTokenSet(els.ideologyGroupFilters, state.ideologyGroups, "ideologyGroup");
  bindContainerTokenSet(els.ideologyOccurrenceFilters, state.ideologyOccurrences, "ideologyOccurrence");
  bindContainerTokenSet(els.ideologyLawGroupFilters, state.ideologyLawGroups, "ideologyLawGroup");
  bindLawGroupFilterTokens();
  els.commonLawIdeologyFilter?.addEventListener("change", () => {
    state.commonLawIdeologyOnly = els.commonLawIdeologyFilter.checked;
    render();
  });
  bindContainerTokenSet(els.heritageGroupFilters, state.heritageGroups, "heritageGroup", () => {
    renderDependentFilterOptions();
  });
  bindContainerTokenSet(els.heritageGroupFilters, state.heritages, "heritage");
  bindContainerTokenSet(els.languageGroupFilters, state.languageGroups, "languageGroup", () => {
    renderDependentFilterOptions();
  });
  bindContainerTokenSet(els.languageGroupFilters, state.languages, "language");
  bindTokenChoice(els.traditionFilters, "tradition", (value) => {
    state.tradition = state.tradition === value ? "" : value;
    syncTokenGroup(els.traditionFilters, state.tradition);
    render();
  });

  els.sortSelect.addEventListener("change", () => {
    state.sort = els.sortSelect.value;
    render();
  });
  els.mapModeSelect.addEventListener("change", () => {
    state.mapMode = els.mapModeSelect.value;
    state.mapSubject = "";
    render();
  });
  els.mapSubjectSelect.addEventListener("change", () => {
    state.mapSubject = els.mapSubjectSelect.value;
    render();
  });
  els.mapFitWidthButton?.addEventListener("click", () => {
    fitMapToWidth();
  });
  els.leftPanelToggle?.addEventListener("click", () => {
    document.body.classList.toggle("filters-collapsed");
    updatePanelToggleState();
  });
  els.bottomPanelToggle?.addEventListener("click", () => {
    cycleResultsPanelMode();
  });
  bindMapEvents();
  bindConceptEvents();
  els.resetButton.addEventListener("click", () => {
    hideTransientOverlays();
    state.search = "";
    state.globalSearch = "";
    state.flags.clear();
    state.tiers.clear();
    state.types.clear();
    state.strategicRegions.clear();
    state.heritageGroups.clear();
    state.heritages.clear();
    state.languageGroups.clear();
    state.languages.clear();
    state.resourceFilters.clear();
    state.companyKinds.clear();
    state.includeIndustryCharter = false;
    state.companyPrestigeGoods.clear();
    state.companyDlcs.clear();
    state.ideologyTypes.clear();
    state.ideologyGroups.clear();
    state.ideologyOccurrences.clear();
    state.ideologyLawGroups.clear();
    state.lawGroups.clear();
    state.commonLawIdeologyOnly = false;
    state.dimUnfilteredCountries = false;
    state.tradition = "";
    state.mapSubject = "";
    state.selectedGlobalResult = "";
    els.searchInput.value = "";
    if (els.commonLawIdeologyFilter) els.commonLawIdeologyFilter.checked = false;
    if (els.globalSearchDialogInput) els.globalSearchDialogInput.value = "";
    document.querySelectorAll("[data-filter-token]").forEach((button) => setTokenPressed(button, false));
    setTokenPressed(els.filteredCountryMapToggle, false);
    renderDependentFilterOptions();
    render();
  });
  window.addEventListener("hashchange", async () => {
    hideTransientOverlays();
    state.globalSearch = "";
    state.selectedGlobalResult = "";
    if (els.globalSearchDialogInput) els.globalSearchDialogInput.value = "";
    await applyHash();
    render();
  });
}

function initTheme() {
  setTheme("votp", false);
}

function initDisplaySettings() {
  const getStored = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      if (value === null) return fallback;
      return value === "true";
    } catch {
      return fallback;
    }
  };
  state.whiteDecentralized = getStored("vicdata-white-decentralized", state.whiteDecentralized);
  state.omitIndigenousLanguagesCultures = getStored("vicdata-omit-indigenous", state.omitIndigenousLanguagesCultures);
  state.omitDecentralizedTags = getStored("vicdata-omit-decentralized-tags", state.omitDecentralizedTags);
}

function persistDisplaySetting(key, value) {
  try {
    localStorage.setItem(key, String(Boolean(value)));
  } catch {
    // 浏览器禁用本地存储时仅保留本次页面状态。
  }
}

function setTheme(theme, persist = true) {
  state.theme = "votp";
  document.body.dataset.theme = state.theme;
  if (persist && theme === "votp") {
    try {
      localStorage.setItem("vicdata-theme", state.theme);
    } catch {
      // 浏览器禁用本地存储时只保留本次页面状态。
    }
  }
}

function bindTokenSet(selector, set, datasetKey, afterChange) {
  document.querySelectorAll(selector).forEach((button) => {
    button.addEventListener("click", async () => {
      const pressed = button.getAttribute("aria-pressed") === "true";
      setTokenPressed(button, !pressed);
      toggleSet(set, button.dataset[datasetKey], !pressed);
      if (afterChange) afterChange();
      render();
    });
  });
}

function bindContainerTokenSet(container, set, datasetKey, afterChange) {
  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter-token]");
    if (!button || !container.contains(button)) return;
    const value = button.dataset[datasetKey];
    if (!value) return;
    const pressed = button.getAttribute("aria-pressed") === "true";
    setTokenPressed(button, !pressed);
    toggleSet(set, value, !pressed);
    if (afterChange) afterChange();
    render();
  });
}

function bindResourceFilterTokens() {
  els.resourceFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter-token]");
    if (!button || !els.resourceFilters.contains(button)) return;
    const value = button.dataset.resourceFilter;
    if (!value) return;
    const pressed = button.getAttribute("aria-pressed") === "true";
    if (state.view === "region") {
      state.resourceFilters.clear();
      if (!pressed) state.resourceFilters.add(value);
      state.mapSubject = "";
      render();
      return;
    }
    setTokenPressed(button, !pressed);
    toggleSet(state.resourceFilters, value, !pressed);
    render();
  });
}

function bindTokenChoice(container, datasetKey, onChange) {
  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter-token]");
    if (!button || !container.contains(button)) return;
    onChange(button.dataset[datasetKey]);
  });
}

function bindConceptEvents() {
  document.addEventListener("contextmenu", (event) => {
    const target = event.target.closest("[data-concept-key]");
    if (!target) return;
    event.preventDefault();
    searchConcept(target);
    hideConceptTooltip();
  });
  document.addEventListener("pointerover", (event) => {
    const target = event.target.closest("[data-concept-key]");
    if (!target) return;
    scheduleConceptTooltip(target, event);
  });
  document.addEventListener("pointermove", (event) => {
    if (pendingConceptTooltipTarget) {
      scheduleConceptTooltip(pendingConceptTooltipTarget, event);
    }
    if (!els.conceptTooltip || els.conceptTooltip.hidden) return;
    moveConceptTooltip(event);
  });
  document.addEventListener("pointerout", (event) => {
    const target = event.target.closest("[data-concept-key]");
    if (!target) return;
    if (event.relatedTarget && target.contains(event.relatedTarget)) return;
    hideConceptTooltip();
  });
  document.addEventListener("mouseover", (event) => {
    const target = event.target.closest("[data-concept-key]");
    if (!target) return;
    scheduleConceptTooltip(target, event);
  });
  document.addEventListener("mousemove", (event) => {
    if (pendingConceptTooltipTarget) {
      scheduleConceptTooltip(pendingConceptTooltipTarget, event);
    }
    if (!els.conceptTooltip || els.conceptTooltip.hidden) return;
    moveConceptTooltip(event);
  });
  document.addEventListener("mouseout", (event) => {
    const target = event.target.closest("[data-concept-key]");
    if (!target) return;
    if (event.relatedTarget && target.contains(event.relatedTarget)) return;
    hideConceptTooltip();
  });
  document.addEventListener("focusin", (event) => {
    const target = event.target.closest("[data-concept-key]");
    if (!target) return;
    const rect = target.getBoundingClientRect();
    showConceptTooltip(target, { clientX: rect.right, clientY: rect.top });
  });
  document.addEventListener("focusout", (event) => {
    const target = event.target.closest("[data-concept-key]");
    if (!target) return;
    hideConceptTooltip();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideConceptTooltip();
  });
}

function scheduleConceptTooltip(target, event) {
  if (!els.conceptTooltip) return;
  if (document.body.classList.contains("results-collapsed")) {
    hideConceptTooltip();
    return;
  }
  clearConceptTooltipTimer();
  pendingConceptTooltipTarget = target;
  pendingConceptTooltipPoint = conceptTooltipPoint(event);
  conceptTooltipTimer = window.setTimeout(() => {
    const delayedTarget = pendingConceptTooltipTarget;
    const delayedPoint = pendingConceptTooltipPoint;
    clearConceptTooltipTimer();
    if (!delayedTarget?.isConnected || !delayedPoint) return;
    showConceptTooltip(delayedTarget, delayedPoint);
  }, CONCEPT_TOOLTIP_DELAY_MS);
}

function conceptTooltipPoint(event) {
  return { clientX: event.clientX, clientY: event.clientY };
}

function clearConceptTooltipTimer() {
  if (conceptTooltipTimer) {
    window.clearTimeout(conceptTooltipTimer);
    conceptTooltipTimer = 0;
  }
  pendingConceptTooltipTarget = null;
  pendingConceptTooltipPoint = null;
}

function showConceptTooltip(target, event) {
  if (!els.conceptTooltip) return;
  if (document.body.classList.contains("results-collapsed")) {
    hideConceptTooltip();
    return;
  }
  const isIdeology = target.dataset.conceptKind === "ideology";
  els.conceptTooltip.classList.toggle("ideology-tooltip", isIdeology);
  els.conceptTooltip.innerHTML = isIdeology ? ideologyTooltipRows(target) : conceptTooltipRows(target);
  els.conceptTooltip.hidden = false;
  moveConceptTooltip(event);
}

function ideologyTooltipRows(target) {
  const key = target.dataset.conceptKey || "";
  const ideology = ideologyByKey.get(key);
  if (!ideology) return conceptTooltipRows(target);
  return `
    <div class="ideology-tooltip-head">
      <div class="ideology-tooltip-identity">
        ${ideologyIconHtml(ideology, "ideology-tooltip-icon")}
        <div>
          <div class="ideology-tooltip-title">${escapeHtml(ideology.name_zh || ideology.key)}</div>
          <div class="ideology-tooltip-id">${escapeHtml(ideology.key)}</div>
        </div>
      </div>
      <div class="ideology-tooltip-type">${escapeHtml(ideologyTypeLabels.get(ideologyTypeKey(ideology)) || "")}</div>
    </div>
    ${ideologyTooltipAttitudeGroups(ideology)}
    ${ideology.desc_zh ? `<p class="ideology-tooltip-desc">${escapeHtml(cleanIdeologyDescription(ideology.desc_zh))}</p>` : ""}
  `;
}

function ideologyTooltipAttitudeGroups(ideology) {
  return groupLawStances(ideology?.law_stances || []).map((group) => {
    const items = [...group.items].sort((left, right) => {
      const leftLaw = lawByKey.get(left.law_key) || left;
      const rightLaw = lawByKey.get(right.law_key) || right;
      return sortLaws(leftLaw, rightLaw);
    });
    return `
      <section class="ideology-tooltip-attitude-group">
        <h4>对${escapeHtml(group.name)}的态度</h4>
        ${ideologyTooltipAttitudeLines(items)}
      </section>
    `;
  }).join("");
}

function ideologyTooltipAttitudeLines(stances) {
  const grouped = new Map();
  for (const stance of stances || []) {
    const key = stance.stance || "neutral";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(stance);
  }
  return lawStanceDisplayOrder.filter((stance) => grouped.has(stance)).map((stance) => {
    const names = grouped.get(stance).map((item) => {
      const law = lawByKey.get(item.law_key) || item;
      return lawDisplayName(law);
    }).filter(Boolean).join("、");
    return `<div class="ideology-tooltip-attitude-line ${lawStanceClassName(stance)}"><span>${escapeHtml(lawStanceSentencePrefix(stance))}</span> ${escapeHtml(names)}</div>`;
  }).join("");
}

function conceptTooltipRows(target) {
  const label = target.dataset.conceptLabel || target.textContent?.trim() || "";
  const key = target.dataset.conceptKey || "";
  const kind = target.dataset.conceptKind || "";
  const kindText = conceptKindLabel(kind);
  const context = conceptTooltipContextLine(kind, key);
  return [
    `<strong>${escapeHtml(label || key)}</strong>`,
    `<span>${escapeHtml([kindText, key].filter(Boolean).join(" · "))}</span>`,
    context ? `<span>${escapeHtml(context)}</span>` : "",
    `<small>${escapeHtml(conceptTooltipActionText(target))}</small>`,
  ].filter(Boolean).join("");
}

function conceptTooltipContextLine(kind, key) {
  if (!key) return "";
  if (kind === "country") {
    const country = byTag.get(key);
    return [countryTypeTagLabel(country || {}), country?.tierZh].filter(Boolean).join(" · ");
  }
  if (kind === "culture") {
    const culture = byCulture.get(key);
    return [culture?.heritage?.name_zh, culture?.language?.name_zh].filter(Boolean).join(" · ");
  }
  if (kind === "stateRegion") {
    const stateRegion = byStateRegion.get(key);
    return [refNames(stateRegion?.strategic_regions), resourceSummaryText(stateRegion)].filter(Boolean).join(" · ");
  }
  if (kind === "strategicRegion") {
    const region = byStrategicRegion.get(key);
    const count = (region?.states || []).length;
    return count ? `${count} 个州地区` : "";
  }
  if (kind === "geographicRegion") {
    const region = byGeographicRegion.get(key);
    const count = geographicRegionStateRegions(region).length;
    return count ? `${count} 个州地区` : "";
  }
  if (kind === "company") {
    const company = byCompany.get(key);
    return [companyKindText(company || {}), company?.category_zh || company?.category].filter(Boolean).join(" · ");
  }
  if (kind === "ideology") {
    const ideology = ideologyByKey.get(key);
    return [
      ideologyTypeLabels.get(ideologyTypeKey(ideology || {})),
      refNames(ideologyInterestGroupRefs(ideology || {})),
      conceptTooltipIdeologyLawStance(ideology),
    ].filter(Boolean).join(" · ");
  }
  if (kind === "building") return "建筑";
  if (kind === "goods") return "商品";
  if (kind === "cultureTrait" || kind === "cultureTraitGroup") return "文化特质";
  if (kind === "interestGroup") return "利益集团";
  if (kind === "interestGroupTrait") return "利益集团特质";
  if (kind === "law") return "法律";
  return "";
}

function conceptTooltipIdeologyLawStance(ideology) {
  const law = state.detailKind === "law" ? lawByKey.get(state.selectedLaw) : null;
  const stanceLaw = law ? lawByKey.get(lawStanceSourceKey(law)) || law : null;
  const stance = stanceLaw && (ideology?.law_stances || []).find((item) => item.law_key === stanceLaw.key);
  return stance ? `对${lawDisplayName(law)}：${lawStanceLabel(stance.stance)}` : "";
}

function conceptTooltipActionText(target) {
  return target.matches("a[href]") ? "打开详情，右键搜索" : "右键搜索";
}

function moveConceptTooltip(event) {
  if (!els.conceptTooltip) return;
  const margin = 14;
  const rect = els.conceptTooltip.getBoundingClientRect();
  const x = Math.min(event.clientX + margin, window.innerWidth - rect.width - margin);
  const y = Math.min(event.clientY + margin, window.innerHeight - rect.height - margin);
  els.conceptTooltip.style.left = `${Math.max(margin, x)}px`;
  els.conceptTooltip.style.top = `${Math.max(margin, y)}px`;
}

function hideConceptTooltip() {
  clearConceptTooltipTimer();
  if (!els.conceptTooltip) return;
  els.conceptTooltip.hidden = true;
  els.conceptTooltip.classList.remove("ideology-tooltip");
}

function searchConcept(target) {
  const text = target.dataset.conceptSearch || target.dataset.conceptLabel || target.dataset.conceptKey || "";
  state.globalSearch = "";
  state.selectedGlobalResult = "";
  state.search = text.trim().toLowerCase();
  els.searchInput.value = text.trim();
  if (els.globalSearchDialogInput) els.globalSearchDialogInput.value = "";
  render();
}

function conceptKindLabel(kind) {
  return {
    country: "国家",
    culture: "文化",
    stateRegion: "州地区",
    strategicRegion: "战略区域",
    geographicRegion: "地理区域",
    company: "公司",
    interestGroup: "利益集团",
    interestGroupTrait: "利益集团特质",
    ideology: "意识形态",
    law: "法律",
    building: "建筑",
    cultureTrait: "文化特质",
    cultureTraitGroup: "文化特质组",
    stateTrait: "地区特质",
    goods: "商品",
    religion: "宗教",
    trait: "角色特质",
  }[kind] || "概念";
}

async function openGlobalSearchDialog() {
  if (state.infoDialog) {
    state.infoDialog = "";
    syncInfoDialogVisibility();
  }
  await ensureDataChunks(Object.keys(dataIndex?.chunks || {}));
  state.globalSearchDialogOpen = true;
  state.globalSearchActiveIndex = 0;
  if (!els.globalSearchDialog) return;
  els.globalSearchDialog.hidden = false;
  document.body.classList.add("global-search-dialog-open");
  if (els.globalSearchDialogInput) els.globalSearchDialogInput.value = state.globalSearch || "";
  if (els.globalSearchLegacyToggle) els.globalSearchLegacyToggle.checked = state.globalSearchIncludeLegacy;
  renderGlobalSearchDialogResults();
  requestAnimationFrame(() => els.globalSearchDialogInput?.focus());
}

function closeGlobalSearchDialog() {
  state.globalSearchDialogOpen = false;
  if (els.globalSearchDialog) els.globalSearchDialog.hidden = true;
  document.body.classList.remove("global-search-dialog-open");
  els.globalSearchButton?.focus();
}

function openInfoDialog(kind) {
  if (state.globalSearchDialogOpen) closeGlobalSearchDialog();
  state.infoDialog = kind === "settings" ? "settings" : "about";
  syncInfoDialogVisibility();
  requestAnimationFrame(() => els.infoDialogCloseButton?.focus());
}

function closeInfoDialog() {
  const previous = state.infoDialog;
  state.infoDialog = "";
  if (els.infoDialog) els.infoDialog.hidden = true;
  if (els.infoDialogTitle) els.infoDialogTitle.textContent = "";
  if (els.infoDialogBody) els.infoDialogBody.innerHTML = "";
  document.body.classList.remove("info-dialog-open");
  if (previous === "settings") els.settingsNavButton?.focus();
  else els.aboutNavButton?.focus();
}

function renderInfoDialog() {
  if (!els.infoDialogTitle || !els.infoDialogBody || !state.infoDialog) return;
  if (state.infoDialog === "settings") {
    els.infoDialogTitle.textContent = "设置";
    els.infoDialogBody.innerHTML = renderSettingsDialogContent();
    bindSettingsControls(els.infoDialogBody);
    return;
  }
  els.infoDialogTitle.textContent = "关于";
  els.infoDialogBody.innerHTML = renderAboutDialogContent();
}

function syncInfoDialogVisibility() {
  if (!els.infoDialog) return;
  if (!state.infoDialog) {
    els.infoDialog.hidden = true;
    document.body.classList.remove("info-dialog-open");
    return;
  }
  renderInfoDialog();
  els.infoDialog.hidden = false;
  document.body.classList.add("info-dialog-open");
}

function handleGlobalSearchDialogKeydown(event) {
  if (!state.globalSearchDialogOpen) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeGlobalSearchDialog();
    return;
  }
  const items = [...(els.globalSearchDialogResults?.querySelectorAll("[data-global-dialog-result]") || [])];
  if (!items.length) return;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.globalSearchActiveIndex = Math.min(items.length - 1, state.globalSearchActiveIndex + 1);
    updateGlobalSearchActiveDescendant();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    state.globalSearchActiveIndex = Math.max(0, state.globalSearchActiveIndex - 1);
    updateGlobalSearchActiveDescendant();
  } else if (event.key === "Enter") {
    event.preventDefault();
    items[state.globalSearchActiveIndex]?.click();
  }
}

function handleInfoDialogKeydown(event) {
  if (!state.infoDialog) return;
  if (event.key !== "Escape") return;
  event.preventDefault();
  closeInfoDialog();
}

async function applyHash() {
  await ensureDataChunksForRoute();
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  state.infoDialog = "";
  if (!parts.length || parts[0] === "home") {
    state.view = "home";
    state.detailKind = "home";
    return;
  }
  if (parts[0] === "settings") {
    state.infoDialog = "settings";
    return;
  }
  if (parts[0] === "changelog") {
    state.view = "changelog";
    state.detailKind = "changelog";
    return;
  }
  if (parts[0] === "about") {
    state.infoDialog = "about";
    return;
  }
  if (parts[0] === "country" && !parts[1]) {
    state.view = "country";
    state.detailKind = "country";
    return;
  }
  if (parts[0] === "country" && parts[1] && byTag.has(parts[1].toUpperCase())) {
    state.view = "country";
    state.selectedTag = parts[1].toUpperCase();
    state.detailKind = "country";
    return;
  }
  if (parts[0] === "culture" && !parts[1]) {
    state.view = "culture";
    state.detailKind = "culture";
    return;
  }
  if (parts[0] === "culture" && parts[1] && byCulture.has(decodeURIComponent(parts[1]))) {
    state.view = "culture";
    state.selectedCulture = decodeURIComponent(parts[1]);
    state.detailKind = "culture";
    return;
  }
  if (parts[0] === "region") {
    state.view = "region";
    state.detailKind = "stateRegion";
    return;
  }
  if (parts[0] === "state-region" && parts[1] && byStateRegion.has(decodeURIComponent(parts[1]))) {
    state.view = "region";
    state.selectedStateRegion = decodeURIComponent(parts[1]);
    state.detailKind = "stateRegion";
    return;
  }
  if (parts[0] === "strategic-region" && parts[1] && byStrategicRegion.has(decodeURIComponent(parts[1]))) {
    state.view = "region";
    state.regionListMode = "strategic";
    state.selectedStrategicRegion = decodeURIComponent(parts[1]);
    state.detailKind = "strategicRegion";
    return;
  }
  if (parts[0] === "geographic-region" && parts[1] && byGeographicRegion.has(decodeURIComponent(parts[1]))) {
    state.view = "region";
    state.regionListMode = "geographic";
    state.selectedGeographicRegion = decodeURIComponent(parts[1]);
    state.detailKind = "geographicRegion";
    return;
  }
  if (parts[0] === "company" && !parts[1]) {
    state.view = "company";
    state.detailKind = "company";
    return;
  }
  if (parts[0] === "company" && parts[1] && byCompany.has(decodeURIComponent(parts[1]))) {
    state.view = "company";
    state.selectedCompany = decodeURIComponent(parts[1]);
    state.detailKind = "company";
    return;
  }
  if (parts[0] === "ideology" && !parts[1]) {
    state.view = "ideology";
    state.detailKind = "ideology";
    return;
  }
  if (parts[0] === "ideology" && parts[1] && ideologyByKey.has(decodeURIComponent(parts[1]))) {
    state.view = "ideology";
    state.selectedIdeology = decodeURIComponent(parts[1]);
    state.detailKind = "ideology";
    return;
  }
  if (parts[0] === "law" && !parts[1]) {
    state.view = "law";
    state.detailKind = "law";
    return;
  }
  if (parts[0] === "law" && parts[1] && lawByKey.has(decodeURIComponent(parts[1]))) {
    state.view = "law";
    state.selectedLaw = decodeURIComponent(parts[1]);
    state.detailKind = "law";
    return;
  }
  if (parts[0] === "religion" && parts[1]) {
    state.search = decodeURIComponent(parts[1]).toLowerCase();
    els.searchInput.value = state.search;
  }
}

async function setView(view) {
  hideTransientOverlays();
  state.view = view;
  state.detailKind = view === "region" ? "stateRegion" : view;
  if (view === "region") state.regionListMode = "state";
  replaceHash(`/${view}`);
  await ensureDataChunksForRoute();
  renderStrategicRegionFilterOptions();
  renderSortOptions();
}

function regionListModeDetailKind() {
  return "stateRegion";
}

function replaceHash(hashPath) {
  const prefix = window.location.search || "";
  history.replaceState(null, "", `${prefix}#${hashPath}`);
}

function hideTransientOverlays() {
  hideMapTooltip();
  hideConceptTooltip();
}

function updatePageChrome() {
  const label = viewLabels[state.view] || "国家";
  const title = `${label} - ${siteTitle}`;
  setOptionalText(els.pageTitle, title);
  document.title = title;
  if (els.viewSelect) {
    els.viewSelect.value = state.view;
  }
}

function cycleResultsPanelMode() {
  const order = ["side", "collapsed"];
  const index = order.indexOf(state.resultsPanelMode);
  state.resultsPanelMode = order[(index + 1) % order.length];
  updateResultsPanelMode();
  if (state.resultsPanelMode === "collapsed") hideConceptTooltip();
  if (mapRuntime.ready) paintMapCanvas();
}

function updateResultsPanelMode() {
  const mode = state.resultsPanelMode || "side";
  document.body.dataset.resultsPanel = mode;
  document.body.classList.toggle("results-collapsed", mode === "collapsed");
  updatePanelToggleState();
}

function updatePanelToggleState() {
  if (els.leftPanelToggle) {
    const collapsed = document.body.classList.contains("filters-collapsed");
    els.leftPanelToggle.setAttribute("aria-pressed", String(collapsed));
    els.leftPanelToggle.setAttribute("aria-label", collapsed ? "展开筛选" : "折叠筛选");
    els.leftPanelToggle.title = collapsed ? "展开筛选" : "折叠筛选";
  }
  if (els.bottomPanelToggle) {
    const collapsed = (state.resultsPanelMode || "side") === "collapsed";
    els.bottomPanelToggle.setAttribute("aria-pressed", String(collapsed));
    els.bottomPanelToggle.setAttribute("aria-label", collapsed ? "展开列表" : "折叠列表");
    els.bottomPanelToggle.title = collapsed ? "展开列表" : "折叠列表";
  }
}

function render() {
  hideTransientOverlays();
  document.body.dataset.view = state.view;
  if (els.homeWelcome) els.homeWelcome.hidden = state.view !== "home";
  if (els.homeLinks) els.homeLinks.hidden = state.view !== "home";
  document.body.classList.toggle("detail-page", isDetailPageRoute());
  document.body.classList.toggle("global-search-active", Boolean(state.globalSearch));
  updatePageChrome();
  syncInfoDialogVisibility();
  updateResultsPanelMode();
  els.countryViewButton?.setAttribute("aria-pressed", String(state.view === "country"));
  els.cultureViewButton?.setAttribute("aria-pressed", String(state.view === "culture"));
  els.regionViewButton?.setAttribute("aria-pressed", String(state.view === "region"));
  els.companyViewButton?.setAttribute("aria-pressed", String(state.view === "company"));
  els.ideologyViewButton?.setAttribute("aria-pressed", String(state.view === "ideology"));
  els.lawViewButton?.setAttribute("aria-pressed", String(state.view === "law"));
  document.querySelectorAll("[data-nav-view]").forEach((button) => {
    button.setAttribute("aria-current", String(button.dataset.navView === state.view));
  });
  setTokenPressed(els.filteredCountryMapToggle, state.dimUnfilteredCountries);
  els.strategicRegionFilterTitle.textContent = state.view === "culture" ? "本土战略区域" : state.view === "company" ? "相关战略区域" : "所在战略区域";
  els.resourceFilterTitle.textContent = state.view === "company" ? "相关建筑" : "资源";
  els.searchInput.placeholder = searchPlaceholder();
  renderSortOptions();
  renderStrategicRegionFilterOptions();
  renderGeographicRegionFilterOptions();
  renderResourceFilterOptions();
  renderCompanyFilterOptions();
  renderIdeologyFilterOptions();
  renderLawFilterOptions();
  syncFilterSectionOpenStates();
  renderMapControls();

  if (state.view === "home") {
    renderHomeBoard();
  } else if (state.view === "changelog") {
    renderChangelogBoard();
  } else if (state.view === "culture") {
    renderCultureBoard();
  } else if (state.view === "region") {
    renderRegionBoard();
  } else if (state.view === "company") {
    renderCompanyBoard();
  } else if (state.view === "ideology") {
    renderIdeologyBoard();
  } else if (state.view === "law") {
    renderLawBoard();
  } else {
    renderCountryBoard();
  }
  const boardManagesDetail = state.view === "home";
  if (!boardManagesDetail && state.view !== "changelog" && isDetailPageRoute()) {
    renderDetailForState();
  } else if (!boardManagesDetail) {
    els.detail.innerHTML = "";
  }
}

function isDetailPageRoute() {
  return Boolean(detailRouteKey());
}

function detailRouteKey() {
  const [route, key] = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (!route || !key) return "";
  return ["country", "culture", "state-region", "strategic-region", "geographic-region", "company", "ideology", "law"].includes(route) ? key : "";
}

function syncFilterSectionOpenStates() {
  const hasPressedToken = (container) => Boolean(container?.querySelector('[data-filter-token][aria-pressed="true"]'));
  const setSection = (selector, open) => {
    document.querySelectorAll(selector).forEach((section) => {
      if (open || !hasInitializedFilterSections) section.open = Boolean(open);
    });
  };

  if (!hasInitializedFilterSections) initializeDefaultFilterSectionOpenStates();
  setSection(".filter-section:has(#resourceFilters)", state.resourceFilters.size > 0 || state.includeIndustryCharter);
  setSection(".filter-section:has(#countryTypeFilters)", state.view === "country" || state.types.size > 0 || state.flags.size > 0);
  setSection(".filter-section:has(#tierFilters)", state.view === "country" || state.tiers.size > 0);
  setSection(".filter-section:has(#strategicRegionFilters)", state.view === "country" || state.strategicRegions.size > 0);
  setSection(".filter-section:has(#geographicRegionFilters)", state.view === "company" && Boolean(state.selectedGeographicRegion));
  setSection(".filter-section:has(#companyKindFilters)", state.companyKinds.size > 0);
  setSection(".filter-section:has(#companyPrestigeFilters)", state.companyPrestigeGoods.size > 0);
  setSection(".filter-section:has(#companyDlcFilters)", state.companyDlcs.size > 0);
  setSection(".filter-section:has(#ideologyTypeFilters)", state.ideologyTypes.size > 0);
  setSection(".filter-section:has(#ideologyGroupFilters)", state.ideologyGroups.size > 0);
  setSection(".filter-section:has(#ideologyOccurrenceFilters)", state.ideologyOccurrences.size > 0);
  setSection(".filter-section:has(#ideologyLawGroupFilters)", state.ideologyLawGroups.size > 0);
  setSection(".filter-section:has(#lawGroupFilters)", ["law", "ideology"].includes(state.view) || state.lawGroups.size > 0 || state.commonLawIdeologyOnly);
  setSection(".filter-section:has(#heritageGroupFilters)", state.heritageGroups.size > 0 || state.heritages.size > 0);
  setSection(".filter-section:has(#languageGroupFilters)", state.languageGroups.size > 0 || state.languages.size > 0);
  setSection(".filter-section:has(#traditionFilters)", Boolean(state.tradition));
  document.querySelectorAll(".filter-section").forEach((section) => {
    if (!section.open && hasPressedToken(section)) section.open = true;
  });
  hasInitializedFilterSections = true;
}

function initializeDefaultFilterSectionOpenStates() {
  document.querySelectorAll(".filter-section").forEach((section) => {
    section.open = false;
  });
}

function renderHomeBoard() {
  mapRuntime.filteredCountryTags = new Set();
  els.resultCount.textContent = "";
  els.activeHint.textContent = "";
  els.countryList.className = "country-list home-board";
  const entries = [
    { category: "外交", label: "国家", text: `${dataCount("countries", countries)} 个国家`, view: "country", icon: "assets/home/waving_flag.png" },
    { category: "外交", label: "国家集团", text: "筹备中", icon: "assets/home/sovereign_empire.png" },
    { category: "外交", label: "外交条约与博弈", text: "筹备中", icon: "assets/home/international_diplomacy.png" },
    { category: "内政", label: "法律", text: `${laws.length} 条法律`, view: "law", icon: "assets/home/law_enforcement.png" },
    { category: "内政", label: "意识形态", text: `${dataCount("ideologies", ideologies)} 个意识形态`, view: "ideology", icon: "assets/home/democracy.png" },
    { category: "内政", label: "日志、事件与决议", text: "筹备中", icon: "assets/home/event_default.png" },
    { category: "社会", label: "文化", text: `${dataCount("cultures", cultures)} 个文化`, view: "culture", icon: "assets/home/nationalism.png" },
    { category: "社会", label: "科技", text: "筹备中", icon: "assets/home/academia.png" },
    { category: "社会", label: "角色", text: "筹备中", icon: "assets/home/event_portrait.png" },
    { category: "经济", label: "地区", text: `${landStateRegions.length} 个州地区`, view: "region", icon: "assets/home/state.png" },
    { category: "经济", label: "建筑", text: "筹备中", icon: "assets/home/manufacturies.png" },
    { category: "经济", label: "商品", text: "筹备中", icon: "assets/home/grand_strategy_games_prestige.png" },
    { category: "经济", label: "公司", text: `${dataCount("companies", companies)} 个公司`, view: "company", icon: "assets/home/companies.png" },
    { category: "军事", label: "陆军", text: "筹备中", icon: "assets/home/line_infantry.png" },
    { category: "军事", label: "海军", text: "筹备中", icon: "assets/home/dreadnought.png" },
    { category: "其他", label: "成就", text: "筹备中", icon: "assets/home/icon_achievements_enabled.png" },
    { category: "其他", label: "游戏资源展示", text: "筹备中", icon: "assets/home/romanticism.png" },
    { category: "其他", label: "更新日志", text: "版本差异", view: "changelog", icon: "assets/home/mass_communication.png" },
  ];
  const categoryRows = [["外交", "内政"], ["经济", "军事"], ["社会", "其他"]];
  const homeUpdatedAt = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date()).replace(/\//g, "-");
  els.countryList.innerHTML = `
    <div class="home-category-list">
      ${categoryRows.map(([leftCategory, rightCategory]) => {
        const rowEntries = [...entries.filter((entry) => entry.category === leftCategory), ...entries.filter((entry) => entry.category === rightCategory)];
        return `
          <section class="home-category-row" aria-label="${escapeHtml(leftCategory)}和${escapeHtml(rightCategory)}">
            <div class="home-category-heading"><h2>${escapeHtml(leftCategory)}</h2><span>${escapeHtml(String(entries.filter((entry) => entry.category === leftCategory).length))} 项</span></div>
            <div class="home-category-heading"><h2>${escapeHtml(rightCategory)}</h2><span>${escapeHtml(String(entries.filter((entry) => entry.category === rightCategory).length))} 项</span></div>
            <div class="home-entry-grid">
              ${rowEntries.map((entry) => entry.view ? `
                <button class="home-entry" type="button" data-home-view="${escapeHtml(entry.view)}">
                  <img class="home-entry-icon" src="${escapeHtml(entry.icon)}" alt="" aria-hidden="true">
                  <span class="home-entry-copy"><strong>${escapeHtml(entry.label)}</strong><small>${escapeHtml(entry.text)}</small></span>
                </button>
              ` : `
                <article class="home-entry home-entry-pending" aria-label="${escapeHtml(entry.label)}，筹备中">
                  <img class="home-entry-icon" src="${escapeHtml(entry.icon)}" alt="" aria-hidden="true">
                  <span class="home-entry-copy"><strong>${escapeHtml(entry.label)}</strong><small>${escapeHtml(entry.text)}</small></span>
                </article>
              `).join("")}
            </div>
          </section>
        `;
      }).join("")}
    </div>
  `;
  els.countryList.querySelectorAll("[data-home-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (button.dataset.homeView === "changelog") {
        location.hash = "/changelog";
        return;
      }
      await setView(button.dataset.homeView);
      render();
    });
  });
  els.detail.innerHTML = `
    <section class="home-side-panel home-announcement">
      <div class="home-side-heading"><h2>公告</h2><span>站内</span></div>
      <article class="home-announcement-item">
        <time>2026-07-13</time>
        <strong>主页资料入口正在调整</strong>
        <p>已建成板块可直接进入，后续板块会在资料准备完成后开放。</p>
      </article>
      <article class="home-announcement-item">
        <time>当前数据版本</time>
        <strong>Victoria 3 ${escapeHtml(data.meta?.victoria3_version || "未知")}</strong>
        <p>页面中的资料、筛选条件和地图内容以当前选择的版本为准。</p>
      </article>
      <p class="home-updated-at">最近更新：${escapeHtml(homeUpdatedAt)}</p>
    </section>
    <section class="home-side-panel home-news-placeholder">
      <div class="home-side-heading"><h2>游戏资讯</h2><span>占位</span></div>
      <div class="home-news-empty">
        <img src="assets/home/romanticism.png" alt="" aria-hidden="true">
        <p>此处将用于整理版本说明、开发日志与资料片资讯。目前保留为占位。</p>
      </div>
    </section>
  `;
  renderMap([]);
}

function renderSettingsDialogContent() {
  return `
    <section class="settings-placeholder settings-panel">
      <p>这些选项会影响筛选栏、地图和国家列表的默认显示。</p>
      <label class="settings-toggle">
        <input id="whiteDecentralizedSetting" type="checkbox"${state.whiteDecentralized ? " checked" : ""}>
        <span>松散政权显示为白地</span>
      </label>
      <label class="settings-toggle">
        <input id="omitIndigenousSetting" type="checkbox"${state.omitIndigenousLanguagesCultures ? " checked" : ""}>
        <span>省略原住民语言、文化</span>
      </label>
      <label class="settings-toggle">
        <input id="omitDecentralizedTagsSetting" type="checkbox"${state.omitDecentralizedTags ? " checked" : ""}>
        <span>过滤松散政权 tag</span>
      </label>
    </section>
  `;
}

function renderAboutDialogContent() {
  const version = data.meta?.victoria3_version || "未知";
  return `
    <div class="about-dialog-grid">
      <section class="settings-placeholder about-intro">
        <h3>${escapeHtml(siteTitle)}</h3>
        <p>Vicdata 是一个面向《维多利亚 3》的资料查询网站。当前公开站点保留 ${escapeHtml(version)} 数据，提供国家、地区、文化、公司和意识形态等条目的浏览、筛选、搜索和地图查看。</p>
        <p>网站把游戏数据整理成静态页面，适合用来查国家标签、地区资源、公司条件、文化关系和意识形态对法律的态度。地图用于辅助查看开局归属、地区范围、文化本土和公司关联，不模拟游戏运行时的全部判断。</p>
      </section>
      <section class="about-stat-grid" aria-label="站点数据范围">
        ${aboutStat("当前版本", version)}
        ${aboutStat("国家", `${dataCount("countries", countries)} 个`)}
        ${aboutStat("州地区", `${landStateRegions.length} 个`)}
        ${aboutStat("文化", `${dataCount("cultures", cultures)} 个`)}
        ${aboutStat("公司", `${dataCount("companies", companies)} 个`)}
        ${aboutStat("意识形态", `${dataCount("ideologies", ideologies)} 个`)}
      </section>
      <section class="settings-placeholder about-note">
        <h3>数据与声明</h3>
        <p>站点数据来自本地《维多利亚 3》安装目录的解析和转换。项目不是 Paradox Interactive 或《维多利亚 3》的官方项目，游戏数据、图片、名称和商标仍属于原权利方。</p>
      </section>
    </div>
    <section class="settings-placeholder developer-card" aria-label="开发者简介">
      <img class="developer-avatar" src="assets/about/developer.jpg" alt="开发者头像">
      <div class="developer-copy">
        <h3>开发者</h3>
        <p>这个网站由霜月制作和维护。开发者长期整理《维多利亚 3》的数据、图标和地图资料，把分散在脚本、图片和本地数据库里的内容做成可以检索、可以对照的网页。</p>
        <p>站点的主要工作包括解析游戏文件、生成资料库、整理公开发布资源、调整中文界面，以及持续检查国家、地区、公司和意识形态页面的显示结果。</p>
        <a class="feedback-link" href="${feedbackMailto}">发送希望添加的功能到 ${feedbackEmail}</a>
      </div>
    </section>
  `;
}

function aboutStat(label, value) {
  return `
    <article class="about-stat">
      <span class="about-stat-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderChangelogBoard() {
  const defaultPair = changelogPairs()[0]?.id || "";
  if (!state.changelogPair && defaultPair) state.changelogPair = defaultPair;
  mapRuntime.filteredCountryTags = new Set();
  els.resultCount.textContent = "更新日志";
  els.activeHint.textContent = changelogData.targetVersion && changelogData.baseVersion
    ? `${changelogData.baseVersion} -> ${changelogData.targetVersion}`
    : "版本变化";
  els.countryList.className = "country-list changelog-board";
  els.detail.innerHTML = "";
  renderMap([]);
  if (state.changelogLoading) {
    els.countryList.innerHTML = `<p class="empty">正在加载更新日志。</p>`;
    return;
  }
  if (state.changelogError) {
    els.countryList.innerHTML = `<p class="empty">${escapeHtml(state.changelogError)}</p>`;
    return;
  }
  if (changelogLoadedPair !== state.changelogPair) {
    els.countryList.innerHTML = `<p class="empty">没有可显示的更新日志。</p>`;
    ensureChangelogLoaded();
    return;
  }
  const visible = filteredChangelogChanges();
  const duplicateState = duplicateStateByDiff(visible);
  const diffCount = visible.reduce((sum, change) => sum + (change.diffs || []).length, 0);
  const repeatedCount = [...duplicateState.values()].filter((item) => item.repeated).length;
  const repeatedText = repeatedCount ? `，${repeatedCount} 个为同类后续表现` : "";
  els.countryList.innerHTML = `
    <section class="changelog-panel embedded-changelog-panel" aria-label="更新日志">
      <div class="changelog-heading">
        <div>
          <h2>${escapeHtml(changelogData.targetVersion || "")} 相对 ${escapeHtml(changelogData.baseVersion || "")}</h2>
          <p class="changelog-note">完整记录 ${escapeHtml(String(changelogData.changes.length))} 条对象变化。</p>
        </div>
        <label class="changelog-search">
          <span>版本段</span>
          <select id="changelogPairSelect" aria-label="更新日志版本段">
            ${changelogPairs().map((pair) => `<option value="${escapeHtml(pair.id)}"${pair.id === state.changelogPair ? " selected" : ""}>${escapeHtml(pair.label)}</option>`).join("")}
          </select>
        </label>
        <label class="changelog-search">
          <span>搜索</span>
          <input id="changelogSearch" type="search" autocomplete="off" value="${escapeHtml(state.changelogSearch)}" placeholder="条目、字段、源文件">
        </label>
      </div>
      <div id="changelogBoardFilters" class="changelog-filters" aria-label="板块筛选">
        ${renderChangelogFiltersHtml()}
      </div>
      <div class="changelog-stats">显示 ${escapeHtml(String(visible.length))} 条对象变化，${escapeHtml(String(diffCount))} 个字段差异${escapeHtml(repeatedText)}。</div>
      <div class="changelog-list">
        ${visible.length ? visible.map((change) => changeHtml(change, duplicateState)).join("") : `<p class="empty">没有匹配的变化。</p>`}
      </div>
    </section>
  `;
  bindChangelogControls();
}

function ensureChangelogLoaded() {
  const pair = changelogPairs().find((item) => item.id === state.changelogPair) || changelogPairs()[0];
  if (!pair || state.changelogLoading || changelogLoadedPair === pair.id) return;
  loadChangelogPair(pair.id).catch((error) => {
    state.changelogLoading = false;
    state.changelogError = error?.message || String(error);
    render();
  });
}

async function loadChangelogPair(pairId) {
  const pair = changelogPairs().find((item) => item.id === pairId) || changelogPairs()[0];
  if (!pair) return;
  const requestPairId = pair.id;
  state.changelogLoading = true;
  state.changelogError = "";
  state.changelogPair = requestPairId;
  state.changelogBoard = "all";
  state.changelogSearch = "";
  changelogLoadedPair = "";
  changelogData = { baseVersion: "", targetVersion: "", boards: [], changes: [] };
  changelogBoardOrder = ["all"];
  renderChangelogBoard();
  const loaded = await loadScriptValue(pair.data, "VIC3_CHANGELOG_DATA");
  if (state.changelogPair !== requestPairId) return;
  changelogData = loaded || { baseVersion: "", targetVersion: "", boards: [], changes: [] };
  changelogBoardOrder = ["all", ...(changelogData.boards || []).map((board) => board.key)];
  changelogLoadedPair = requestPairId;
  state.changelogLoading = false;
  render();
}

function changelogPairs() {
  return (versionConfig?.changelogs || []).map((pair) => ({
    ...pair,
    id: pair.id || `${pair.base_version}_to_${pair.target_version}`,
  }));
}

function bindChangelogControls() {
  const pairSelect = els.countryList.querySelector("#changelogPairSelect");
  const searchInput = els.countryList.querySelector("#changelogSearch");
  const filters = els.countryList.querySelector("#changelogBoardFilters");
  pairSelect?.addEventListener("change", () => {
    loadChangelogPair(pairSelect.value).catch((error) => {
      state.changelogLoading = false;
      state.changelogError = error?.message || String(error);
      render();
    });
  });
  searchInput?.addEventListener("input", () => {
    state.changelogSearch = searchInput.value.trim().toLowerCase();
    renderChangelogBoard();
  });
  filters?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-board-filter]");
    if (!button || !filters.contains(button)) return;
    state.changelogBoard = button.dataset.boardFilter || "all";
    renderChangelogBoard();
  });
}

function renderChangelogFiltersHtml() {
  const counts = changelogBoardCounts();
  return changelogBoardOrder.map((boardKey) => {
    const label = boardKey === "all"
      ? "全部"
      : (changelogData.boards || []).find((board) => board.key === boardKey)?.label || boardKey;
    const count = boardKey === "all" ? (changelogData.changes || []).length : counts.get(boardKey) || 0;
    return `<button class="filter-token" type="button" data-board-filter="${escapeHtml(boardKey)}" aria-pressed="${state.changelogBoard === boardKey}">${escapeHtml(label)} ${escapeHtml(String(count))}</button>`;
  }).join("");
}

function filteredChangelogChanges() {
  const search = state.changelogSearch;
  return (changelogData.changes || []).filter((change) => {
    if (state.changelogBoard !== "all" && change.board !== state.changelogBoard) return false;
    if (!search) return true;
    return changelogSearchBlob(change).includes(search);
  });
}

function changelogBoardCounts() {
  const counts = new Map();
  for (const change of changelogData.changes || []) {
    counts.set(change.board, (counts.get(change.board) || 0) + 1);
  }
  return counts;
}

function duplicateStateByDiff(changes) {
  const seen = new Map();
  const states = new Map();
  for (const change of changes || []) {
    (change.diffs || []).forEach((diff, index) => {
      const key = diff.duplicateKey || `${change.id}:${index}`;
      const current = (seen.get(key) || 0) + 1;
      const total = Number(diff.duplicateCount) || 1;
      seen.set(key, current);
      states.set(diffStateKey(change, index), {
        current,
        total,
        repeated: total > 1 && current > 1,
      });
    });
  }
  return states;
}

function diffStateKey(change, index) {
  return `${change.id}:${index}`;
}

function changeHtml(change, duplicateState) {
  const source = change.sourceFile ? `<div class="change-source">${escapeHtml(change.sourceFile)}</div>` : "";
  return `
    <article class="change-card">
      <div class="change-card-head">
        <div>
          <div class="change-label">${escapeHtml(change.boardLabel)}</div>
          <h3>${escapeHtml(change.title)}</h3>
          ${source}
        </div>
        <div class="change-actions">
          <a class="topbar-link" href="${escapeHtml(change.baseUrl)}">查看 ${escapeHtml(changelogData.baseVersion)}</a>
          <a class="topbar-link" href="${escapeHtml(change.targetUrl)}">查看 ${escapeHtml(changelogData.targetVersion)}</a>
        </div>
      </div>
      <div class="change-diffs">
        ${(change.diffs || []).map((diff, index) => diffHtml(change, diff, index, duplicateState)).join("")}
      </div>
    </article>
  `;
}

function diffHtml(change, diff, index, duplicateState) {
  const kindLabel = diff.kind === "raw" ? "源代码" : "抽取字段";
  const currentState = duplicateState.get(diffStateKey(change, index)) || { current: 1, total: 1, repeated: false };
  const duplicateClass = currentState.repeated ? " is-duplicate" : "";
  const duplicateLabel = currentState.total > 1
    ? `<span class="change-duplicate-badge">同类 ${currentState.current}/${currentState.total}</span>`
    : "";
  return `
    <details class="change-diff${duplicateClass}">
      <summary>
        <span>${escapeHtml(diff.label)}</span>
        <span class="change-summary-actions">
          ${duplicateLabel}
          <span class="change-open-label">查看对应内容的源代码变化</span>
          <span class="change-kind">${escapeHtml(kindLabel)}</span>
        </span>
      </summary>
      <div class="source-compare" aria-label="源代码变化 ${index + 1}">
        <section>
          <h4>${escapeHtml(changelogData.baseVersion)}</h4>
          <pre><code>${escapeHtml(diff.oldText)}</code></pre>
        </section>
        <section>
          <h4>${escapeHtml(changelogData.targetVersion)}</h4>
          <pre><code>${escapeHtml(diff.newText)}</code></pre>
        </section>
      </div>
    </details>
  `;
}

function changelogSearchBlob(change) {
  return [
    change.boardLabel,
    change.key,
    change.title,
    change.sourceFile,
    ...(change.diffs || []).flatMap((diff) => [diff.path, diff.label, diff.oldText, diff.newText]),
  ].join("\n").toLowerCase();
}

function bindSettingsControls(container = els.countryList) {
  const white = container?.querySelector("#whiteDecentralizedSetting");
  const omitIndigenous = container?.querySelector("#omitIndigenousSetting");
  const omitDecentralized = container?.querySelector("#omitDecentralizedTagsSetting");
  white?.addEventListener("change", () => {
    state.whiteDecentralized = white.checked;
    persistDisplaySetting("vicdata-white-decentralized", state.whiteDecentralized);
    render();
    renderInfoDialog();
  });
  omitIndigenous?.addEventListener("change", () => {
    state.omitIndigenousLanguagesCultures = omitIndigenous.checked;
    persistDisplaySetting("vicdata-omit-indigenous", state.omitIndigenousLanguagesCultures);
    renderFilterOptions();
    render();
    renderInfoDialog();
  });
  omitDecentralized?.addEventListener("change", () => {
    state.omitDecentralizedTags = omitDecentralized.checked;
    persistDisplaySetting("vicdata-omit-decentralized-tags", state.omitDecentralizedTags);
    render();
    renderInfoDialog();
  });
}

function renderCountryBoard() {
  const filtered = countries.filter(matchesCountryFilters).sort(sortCountries);
  mapRuntime.filteredCountryTags = new Set(filtered.map((country) => country.tag));
  if (state.selectedTag && !byTag.has(state.selectedTag)) state.selectedTag = "";
  if (!isDetailPageRoute() && state.selectedTag && !filtered.some((country) => country.tag === state.selectedTag)) state.selectedTag = "";
  const selectedCountry = byTag.get(state.selectedTag);
  els.resultCount.textContent = `${filtered.length} 个国家`;
  els.activeHint.textContent = buildActiveHint(filtered.length);
  renderCountryList(filtered);
  renderMap(countryMapStateRegions(selectedCountry));
  focusCountryOnMap(selectedCountry);
}

function renderCultureBoard() {
  const filtered = cultures.filter(matchesCultureFilters).sort(sortCultures);
  if (state.selectedCulture && !byCulture.has(state.selectedCulture)) state.selectedCulture = "";
  if (!isDetailPageRoute() && state.selectedCulture && !filtered.some((culture) => culture.key === state.selectedCulture)) state.selectedCulture = "";
  els.resultCount.textContent = `${filtered.length} 个文化`;
  els.activeHint.textContent = buildActiveHint(filtered.length);
  renderCultureList(filtered);
  renderMap(stateRegions);
}

function renderRegionBoard() {
  const filteredStrategicRegions = landStrategicRegions.filter(matchesStrategicRegionFilters).sort(sortStrategicRegionRef);
  const filteredSeaRegions = seaStrategicRegions.filter(matchesStrategicRegionFilters).sort(sortStrategicRegionRef);
  const filteredStateRegions = landStateRegions.filter(matchesStateRegionFilters).sort(sortStateRegions);
  const filteredGeographicRegions = geographicRegions.filter(matchesGeographicRegionFilters).sort(sortGeographicRegions);
  const filteredSeaStateRegions = uniqueByKey(filteredSeaRegions
    .flatMap((region) => region.states || [])
    .map((stateRef) => byStateRegion.get(stateRef.key))
    .filter(Boolean));
  if (state.selectedStateRegion && !byStateRegion.has(state.selectedStateRegion)) state.selectedStateRegion = "";
  if (state.mapSelectedStateRegion && !byStateRegion.has(state.mapSelectedStateRegion)) state.mapSelectedStateRegion = "";
  if (!isDetailPageRoute() && state.selectedStateRegion && !filteredStateRegions.some((stateRegion) => stateRegion.key === state.selectedStateRegion) && state.selectedStateRegion !== state.mapSelectedStateRegion) state.selectedStateRegion = "";
  if (state.selectedStrategicRegion && ![...filteredStrategicRegions, ...filteredSeaRegions].some((region) => region.key === state.selectedStrategicRegion)) {
    state.selectedStrategicRegion = "";
  }
  if (state.selectedGeographicRegion && !filteredGeographicRegions.some((region) => region.key === state.selectedGeographicRegion)) {
    state.selectedGeographicRegion = "";
  }
  if (!["stateRegion", "strategicRegion", "geographicRegion"].includes(state.detailKind)) {
    state.detailKind = regionListModeDetailKind();
  }
  const selectedStateRegion = byStateRegion.get(state.selectedStateRegion);
  els.resultCount.textContent = `州地区 ${filteredStateRegions.length} 个`;
  els.activeHint.textContent = buildActiveHint(filteredStateRegions.length);
  renderRegionList(filteredStrategicRegions, filteredStateRegions, filteredSeaRegions, filteredGeographicRegions);
  renderMap(regionMapStateRegions(filteredStateRegions, filteredSeaStateRegions, filteredGeographicRegions));
  focusStateRegionOnMap(selectedStateRegion);
}

function renderCompanyBoard() {
  const filtered = companies.filter(matchesCompanyFilters).sort(sortCompanies);
  if (state.selectedCompany && !byCompany.has(state.selectedCompany)) state.selectedCompany = "";
  if (!isDetailPageRoute() && state.selectedCompany && !filtered.some((company) => company.key === state.selectedCompany)) state.selectedCompany = "";
  const selectedCompany = byCompany.get(state.selectedCompany);
  mapRuntime.companyMapCompanies = selectedCompany ? [selectedCompany] : filtered;
  els.resultCount.textContent = `${filtered.length} 个公司`;
  els.activeHint.textContent = buildActiveHint(filtered.length);
  renderCompanyList(filtered);
  renderMap(companyMapStateRegions(mapRuntime.companyMapCompanies));
  focusCompanyOnMap(selectedCompany);
}

function renderIdeologyBoard() {
  const filtered = ideologies.filter(matchesIdeologyFilters).sort(sortIdeologies);
  if (state.selectedIdeology && !ideologyByKey.has(state.selectedIdeology)) state.selectedIdeology = "";
  if (!isDetailPageRoute() && state.selectedIdeology && !filtered.some((ideology) => ideology.key === state.selectedIdeology)) state.selectedIdeology = "";
  els.resultCount.textContent = `${filtered.length} 个意识形态`;
  els.activeHint.textContent = buildActiveHint(filtered.length);
  renderIdeologyList(filtered);
}

function renderLawBoard() {
  const filtered = laws.filter(matchesLawFilters).sort(sortLaws);
  if (state.selectedLaw && !lawByKey.has(state.selectedLaw)) state.selectedLaw = "";
  if (!isDetailPageRoute() && state.selectedLaw && !filtered.some((law) => law.key === state.selectedLaw)) state.selectedLaw = "";
  els.resultCount.textContent = `${filtered.length} 条法律`;
  els.activeHint.textContent = buildActiveHint(filtered.length);
  renderLawList(filtered);
}

function renderDetailForState() {
  const activeDetailRouteKey = detailRouteKey();
  if (state.detailKind === "law" && lawByKey.has(state.selectedLaw)) {
    renderLawDetail(lawByKey.get(state.selectedLaw));
    return;
  }
  if (state.detailKind === "ideology" && ideologyByKey.has(state.selectedIdeology)) {
    renderIdeologyDetail(ideologyByKey.get(state.selectedIdeology));
    return;
  }
  if (state.detailKind === "company" && byCompany.has(state.selectedCompany) && activeDetailRouteKey) {
    renderCompanyDetail(byCompany.get(state.selectedCompany));
    return;
  }
  if (state.detailKind === "culture" && byCulture.has(state.selectedCulture)) {
    renderCultureDetail(byCulture.get(state.selectedCulture));
    return;
  }
  if (state.detailKind === "stateRegion" && byStateRegion.has(state.selectedStateRegion)) {
    renderStateRegionDetail(byStateRegion.get(state.selectedStateRegion));
    return;
  }
  if (state.detailKind === "strategicRegion" && byStrategicRegion.has(state.selectedStrategicRegion)) {
    renderStrategicRegionDetail(byStrategicRegion.get(state.selectedStrategicRegion));
    return;
  }
  if (state.detailKind === "geographicRegion" && byGeographicRegion.has(state.selectedGeographicRegion)) {
    renderGeographicRegionDetail(byGeographicRegion.get(state.selectedGeographicRegion));
    return;
  }
  renderCountryDetailPage(byTag.get(state.selectedTag));
}

function renderGlobalSearchBoard() {
  const results = globalSearchResults(state.globalSearch);
  if (!state.selectedGlobalResult || !results.some((item) => item.id === state.selectedGlobalResult)) {
    state.selectedGlobalResult = results[0]?.id || "";
  }
  els.resultCount.textContent = `${results.length} 个全局结果`;
  els.activeHint.textContent = state.globalSearch ? `搜索：${state.globalSearch}` : "";
  renderGlobalSearchList(results);
  renderGlobalSearchDetail(results.find((item) => item.id === state.selectedGlobalResult) || null);
}

function renderGlobalSearchList(results) {
  els.countryList.className = "country-list global-search-list";
  if (!results.length) {
    els.countryList.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  const groups = [];
  for (const result of results) {
    let group = groups.find((item) => item.label === result.typeLabel);
    if (!group) {
      group = { label: result.typeLabel, items: [] };
      groups.push(group);
    }
    group.items.push(result);
  }
  els.countryList.innerHTML = groups.map((group) => `
    <div class="list-section-title">${escapeHtml(group.label)}</div>
    ${group.items.map((result) => `
      <button class="country-row global-result-row" type="button" data-global-result="${escapeHtml(result.id)}" aria-current="${result.id === state.selectedGlobalResult}">
        <span class="country-heading">
          ${result.kind === "country" ? countryFlagIconHtml(result.raw, "country-flag-inline") : result.color ? `<span class="country-color" style="${colorStyle(result.color)}" aria-hidden="true"></span>` : ""}
          <span class="tag">${escapeHtml(result.key)}</span>
          <span class="name">${escapeHtml(result.displayTitle || result.title)}</span>
        </span>
        <span class="minor country-meta">${escapeHtml(result.subtitle || result.searchHint || "")}</span>
      </button>
    `).join("")}
  `).join("");
  els.countryList.querySelectorAll("[data-global-result]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.selectedGlobalResult = button.dataset.globalResult;
      render();
    });
  });
}

function renderGlobalSearchDialogResults() {
  if (!els.globalSearchDialogResults) return;
  const results = globalSearchResults(state.globalSearch);
  if (!state.globalSearch) {
    els.globalSearchDialogResults.innerHTML = `<p class="empty">输入文本后显示相关资料。</p>`;
    return;
  }
  if (!results.length) {
    els.globalSearchDialogResults.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  const groups = [];
  for (const result of results) {
    let group = groups.find((item) => item.label === result.typeLabel);
    if (!group) {
      group = { label: result.typeLabel, items: [] };
      groups.push(group);
    }
    group.items.push(result);
  }
  let itemIndex = 0;
  els.globalSearchDialogResults.innerHTML = groups.map((group) => `
    <div class="list-section-title">${escapeHtml(group.label)}</div>
    ${group.items.map((result) => {
      const active = itemIndex === state.globalSearchActiveIndex;
      const html = `
        <button class="country-row global-result-row" type="button" data-global-dialog-result="${escapeHtml(result.id)}" data-result-kind="${escapeHtml(result.kind)}" data-result-key="${escapeHtml(result.navigationKey || result.key)}" aria-selected="${active}">
          ${renderEntityBadge(result.kind, result.raw || result, result.displayTitle || result.title)}
          <span class="country-heading">
            <span class="tag">${escapeHtml(result.key)}</span>
            <span class="name">${escapeHtml(result.displayTitle || result.title)}</span>
          </span>
          <span class="minor country-meta">${escapeHtml(result.subtitle || result.searchHint || "")}</span>
        </button>
      `;
      itemIndex += 1;
      return html;
    }).join("")}
  `).join("");
  els.globalSearchDialogResults.querySelectorAll("[data-global-dialog-result]").forEach((button, index) => {
    button.addEventListener("click", async () => {
      state.globalSearchActiveIndex = index;
      await navigateGlobalSearchResult(button.dataset.resultKind, button.dataset.resultKey);
      closeGlobalSearchDialog();
    });
  });
  updateGlobalSearchActiveDescendant();
}

function updateGlobalSearchActiveDescendant() {
  const items = [...(els.globalSearchDialogResults?.querySelectorAll("[data-global-dialog-result]") || [])];
  items.forEach((item, index) => {
    item.setAttribute("aria-selected", String(index === state.globalSearchActiveIndex));
    if (index === state.globalSearchActiveIndex) item.scrollIntoView({ block: "nearest" });
  });
}

async function navigateGlobalSearchResult(kind, key) {
  if (!kind || !key) return;
  if (kind === "interestGroupFlavor") {
    const [countryTag, groupKey] = key.split(":");
    if (!countryTag || !groupKey) return;
    replaceHash(`/country/${encodeURIComponent(countryTag)}`);
    await applyHash();
    render();
    focusInterestGroupFlavorResult(countryTag, groupKey);
    return;
  }
  if (kind === "country") replaceHash(`/country/${encodeURIComponent(key)}`);
  else if (kind === "culture") replaceHash(`/culture/${encodeURIComponent(key)}`);
  else if (kind === "stateRegion") replaceHash(`/state-region/${encodeURIComponent(key)}`);
  else if (kind === "strategicRegion") replaceHash(`/strategic-region/${encodeURIComponent(key)}`);
  else if (kind === "geographicRegion") replaceHash(`/geographic-region/${encodeURIComponent(key)}`);
  else if (kind === "company") replaceHash(`/company/${encodeURIComponent(key)}`);
  else if (kind === "ideology") replaceHash(`/ideology/${encodeURIComponent(key)}`);
  else if (kind === "law") replaceHash(`/law/${encodeURIComponent(key)}`);
  else return;
  await applyHash();
  render();
}

function renderGlobalSearchDetail(result) {
  if (!result) {
    els.detail.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  if (result.kind === "country") return renderCountryDetail(byTag.get(result.key));
  if (result.kind === "culture") return renderCultureDetail(byCulture.get(result.key));
  if (result.kind === "stateRegion") return renderStateRegionDetail(byStateRegion.get(result.key));
  if (result.kind === "strategicRegion") return renderStrategicRegionDetail(byStrategicRegion.get(result.key));
  if (result.kind === "geographicRegion") return renderGeographicRegionDetail(byGeographicRegion.get(result.key));
  if (result.kind === "company") return renderCompanyDetail(byCompany.get(result.key));
  if (result.kind === "ideology") return renderIdeologyDetail(ideologyByKey.get(result.key));
  if (result.kind === "law") return renderLawDetail(lawByKey.get(result.key));
  if (result.kind === "cultureTrait" || result.kind === "cultureTraitGroup") return renderCultureTraitDetail(result);
  if (result.kind === "interestGroup") return renderInterestGroupDetail(result);
  if (result.kind === "interestGroupTrait") return renderInterestGroupTraitDetail(result);
  if (result.kind === "interestGroupFlavor") return renderCountryDetail(byTag.get(result.countryTag));
  els.detail.innerHTML = `
    <div class="detail-title">
      <div class="detail-title-main"><h2>${escapeHtml(result.title)}</h2></div>
      <span class="tag">${escapeHtml(result.typeLabel)}</span>
    </div>
    <dl class="field-grid">
      ${field("编号", escapeHtml(result.key))}
      ${field("类型", escapeHtml(result.typeLabel))}
    </dl>
  `;
}

function globalSearchResults(query) {
  const needle = normalizeSearchText(query);
  if (!needle) return [];
  const results = [];
  const add = (result) => {
    const haystack = normalizeSearchText([result.title, result.key, result.aliases, result.subtitle, result.searchText].flat().filter(Boolean).join(" "));
    if (!haystack.includes(needle)) return;
    const title = normalizeSearchText(result.title || "");
    const key = normalizeSearchText(result.key || "");
    const score = title === needle ? 0 : key === needle ? 1 : title.startsWith(needle) ? 2 : haystack.indexOf(needle) + 10;
    results.push({ ...result, displayTitle: globalSearchDisplayTitle(result, needle), score });
  };
  countries.forEach((country) => add({
    id: `country:${country.tag}`,
    kind: "country",
    typeLabel: "国家",
    key: country.tag,
    title: country.name,
    subtitle: [countryTypeTagLabel(country), country.tierZh].filter(Boolean).join("，"),
    color: country.colorHex,
    raw: country,
    searchText: countrySearchBlob(country),
  }));
  cultures.forEach((culture) => add({
    id: `culture:${culture.key}`,
    kind: "culture",
    typeLabel: "文化",
    key: culture.key,
    title: culture.name_zh || culture.key,
    subtitle: [culture.heritage?.name_zh, culture.language?.name_zh].filter(Boolean).join("，"),
    raw: culture,
    searchText: cultureSearchBlob(culture),
  }));
  landStateRegions.forEach((stateRegion) => add({
    id: `stateRegion:${stateRegion.key}`,
    kind: "stateRegion",
    typeLabel: "地区",
    key: stateRegion.key,
    title: stateRegion.name_zh || stateRegion.key,
    aliases: stateRegionVariantNames(stateRegion),
    subtitle: refNames(stateRegion.strategic_regions),
    color: byStrategicRegion.get(stateRegion.strategic_regions?.[0]?.key)?.map_color?.hex || "",
    raw: stateRegion,
    searchText: stateRegionSearchBlob(stateRegion),
  }));
  landStrategicRegions.forEach((region) => add({
    id: `strategicRegion:${region.key}`,
    kind: "strategicRegion",
    typeLabel: "战略区域",
    key: region.key,
    title: strategicRegionName(region),
    subtitle: `州地区 ${(region.states || []).length} 个`,
    color: region.map_color?.hex || "",
    raw: region,
    searchText: strategicRegionSearchBlob(region),
  }));
  groupedGeographicRegions.forEach((region) => add({
    id: `geographicRegion:${region.key}`,
    kind: "geographicRegion",
    typeLabel: "地理区域",
    key: region.key,
    title: geographicRegionDisplayName(region),
    subtitle: `州地区 ${geographicRegionStateRegions(region).length} 个`,
    raw: region,
    searchText: geographicRegionSearchBlob(region),
  }));
  companies.forEach((company) => add({
    id: `company:${company.key}`,
    kind: "company",
    typeLabel: "公司",
    key: company.key,
    title: company.name_zh || company.key,
    subtitle: companyKindText(company),
    raw: company,
    searchText: companySearchBlob(company),
  }));
  ideologies.forEach((ideology) => add({
    id: `ideology:${ideology.key}`,
    kind: "ideology",
    typeLabel: "意识形态",
    key: ideology.key,
    title: ideology.name_zh || ideology.key,
    subtitle: ideologyTypeLabels.get(ideologyTypeKey(ideology)) || "",
    raw: ideology,
    searchText: ideologySearchBlob(ideology),
  }));
  laws.forEach((law) => add({
    id: `law:${law.key}`,
    kind: "law",
    typeLabel: "法律",
    key: law.key,
    title: law.name_zh || law.key,
    subtitle: law.group_name_zh || law.group_key || "",
    raw: law,
    searchText: lawSearchBlob(law),
  }));
  cultureTraits.forEach((trait) => add({
    id: `cultureTrait:${trait.key}`,
    kind: "cultureTrait",
    typeLabel: trait.type_zh || "文化特质",
    key: trait.key,
    title: trait.name_zh || trait.key,
    subtitle: trait.group_name_zh || trait.type_zh || "",
    searchText: [trait.name_zh, trait.key, trait.group_name_zh, trait.type_zh].filter(Boolean).join(" "),
  }));
  cultureTraitGroups.forEach((group) => add({
    id: `cultureTraitGroup:${group.key}`,
    kind: "cultureTraitGroup",
    typeLabel: group.type === "language" ? "语族" : group.type_zh ? `${group.type_zh}组` : "文化特质组",
    key: group.key,
    title: group.name_zh || group.key,
    subtitle: group.type_zh || "",
    searchText: [group.name_zh, group.key, group.type_zh].filter(Boolean).join(" "),
  }));
  interestGroups.forEach((group) => add({
    id: `interestGroup:${group.key}`,
    kind: "interestGroup",
    typeLabel: "利益集团",
    key: group.key,
    title: group.name_zh || group.key,
    subtitle: group.desc_zh || "",
    color: group.color?.hex || "",
    searchText: [group.name_zh, group.key, group.desc_zh].filter(Boolean).join(" "),
  }));
  interestGroupTraits.forEach((trait) => add({
    id: `interestGroupTrait:${trait.key}`,
    kind: "interestGroupTrait",
    typeLabel: "利益集团特质",
    key: trait.key,
    title: trait.name_zh || trait.key,
    subtitle: trait.modifier_summary_zh || "",
    searchText: [trait.name_zh, trait.key, trait.desc_zh, trait.modifier_summary_zh].filter(Boolean).join(" "),
  }));
  interestGroupFlavorSearchResults().forEach(add);
  const order = new Map(["国家", "文化", "地区", "地理区域", "语言", "语族", "传承", "传承组", "传统", "战略区域", "公司", "意识形态", "法律", "利益集团", "利益集团特质", "利益集团风味"].map((label, index) => [label, index]));
  return results
    .sort((a, b) => a.score - b.score || orderValue(order, a.typeLabel) - orderValue(order, b.typeLabel) || a.title.localeCompare(b.title, "zh-Hans-CN"))
    .slice(0, 120);
}

function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase();
}

function renderCultureTraitDetail(result) {
  const trait = result.kind === "cultureTrait" ? cultureTraitByKey.get(result.key) : null;
  const group = result.kind === "cultureTraitGroup" ? cultureTraitGroupByKey.get(result.key) : null;
  const relatedCultures = cultures.filter((culture) => {
    if (trait) {
      return [culture.heritage, culture.language, ...(culture.traditions || [])].some((item) => item?.key === trait.key);
    }
    if (group) {
      return [culture.heritage_group, culture.language_group].some((item) => item?.key === group.key);
    }
    return false;
  }).sort(sortCultures);
  const title = trait?.name_zh || group?.name_zh || result.title;
  els.detail.innerHTML = `
    <div class="detail-title">
      <div class="detail-title-main"><h2>${escapeHtml(title)}</h2></div>
      <span class="tag">${escapeHtml(result.typeLabel)}</span>
    </div>
    <dl class="field-grid">
      ${field("编号", escapeHtml(result.key))}
      ${field("类型", escapeHtml(result.typeLabel))}
      ${field("所属组", escapeHtml(trait?.group_name_zh || group?.type_zh || ""))}
      ${field("相关文化", cultureLinks(relatedCultures.map((culture) => ({ key: culture.key, name_zh: culture.name_zh || culture.key }))))}
    </dl>
  `;
}

function renderInterestGroupDetail(result) {
  const group = byInterestGroup.get(result.key);
  if (!group) {
    els.detail.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  els.detail.innerHTML = `
    <div class="detail-title">
      <div class="detail-title-main">
        ${interestGroupIconHtml(group)}
        <h2>${escapeHtml(group.name_zh || group.key)}</h2>
      </div>
      <span class="tag">${escapeHtml(group.key)}</span>
    </div>
    <dl class="field-grid">
      ${field("标准色", colorValue(group.color?.hex, group.color?.rgb))}
      ${field("意识形态", ideologyPills(group.ideologies, "tag-ideology"))}
      ${field("角色意识形态", ideologyPills(group.character_ideologies, "tag-tradition"))}
      ${field("基础特质", interestGroupTraitDetailsHtml(group.base_traits, false))}
    </dl>
  `;
}

function renderInterestGroupTraitDetail(result) {
  const trait = interestGroupTraitByKey.get(result.key);
  if (!trait) {
    els.detail.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  els.detail.innerHTML = `
    <div class="detail-title">
      <div class="detail-title-main"><h2>${escapeHtml(trait.name_zh || trait.key)}</h2></div>
      <span class="tag">${escapeHtml(trait.key)}</span>
    </div>
    ${interestGroupTraitDetailCard(trait)}
  `;
}

function matchesCountryFilters(country) {
  if (state.omitDecentralizedTags && country.countryType === "decentralized") return false;
  if (state.flags.size > 0) {
    for (const key of state.flags) {
      if (key === "isCivilWar") {
        if (!countryCivilWarMatch(country)) return false;
      } else if (country[key] !== "是") return false;
    }
  }
  if (state.tiers.size > 0 && !state.tiers.has(country.tier)) return false;
  if (state.types.size > 0 && !state.types.has(country.countryType)) return false;
  if (!matchesRefSet(state.strategicRegions, country.locationStrategicRegions)) return false;
  if (!matchesRefSet(state.heritageGroups, country.primaryCultureHeritageGroups)) return false;
  if (!matchesRefSet(state.heritages, country.primaryCultureHeritages)) return false;
  if (!matchesRefSet(state.languageGroups, country.primaryCultureLanguageGroups)) return false;
  if (!matchesRefSet(state.languages, country.primaryCultureLanguages)) return false;
  if (state.tradition && !(country.primaryCultureTraditions || []).some((trait) => trait.key === state.tradition)) return false;
  return matchesSearchBlob(countrySearchBlob(country));
}

function countryCivilWarMatch(country) {
  if (country.isCivilWar || country.is_civil_war || country.civil_war) return true;
  return /civil_war/i.test([country.tag, country.name, country.name_zh, country.key].filter(Boolean).join(" "));
}

function isIndigenousCulture(culture) {
  return [culture?.heritage_group?.key, culture?.heritage?.group_key]
    .filter(Boolean)
    .some((key) => key === "heritage_group_indigenous_american" || key === "heritage_group_indigenous_oceanic");
}

function matchesCultureFilters(culture) {
  if (state.omitIndigenousLanguagesCultures && isIndigenousCulture(culture)) return false;
  if (!matchesRefSet(state.strategicRegions, culture.homeland_strategic_regions)) return false;
  if (!matchesRefSet(state.heritageGroups, compactRefs([culture.heritage_group]))) return false;
  if (!matchesRefSet(state.heritages, compactRefs([culture.heritage]))) return false;
  if (!matchesRefSet(state.languageGroups, compactRefs([culture.language_group]))) return false;
  if (!matchesRefSet(state.languages, compactRefs([culture.language]))) return false;
  if (state.tradition && !(culture.traditions || []).some((trait) => trait.key === state.tradition)) return false;
  return matchesSearchBlob(cultureSearchBlob(culture));
}

function matchesStateRegionFilters(stateRegion) {
  if (!matchesRefSet(state.strategicRegions, stateRegion.strategic_regions)) return false;
  if (state.view === "region" && state.selectedGeographicRegion) {
    const region = byGeographicRegion.get(state.selectedGeographicRegion);
    if (region) {
      const stateKeys = new Set(geographicRegionStateRegions(region).map((item) => item.key));
      if (!stateKeys.has(stateRegion.key)) return false;
    }
  }
  if (!matchesResourceFilters(stateRegion)) return false;
  return matchesSearchBlob(stateRegionSearchBlob(stateRegion));
}

function matchesStrategicRegionFilters(region) {
  if (state.strategicRegions.size > 0 && !state.strategicRegions.has(region.key)) return false;
  if (state.resourceFilters.size > 0 && !strategicRegionHasMatchingResource(region)) return false;
  return matchesSearchBlob(strategicRegionSearchBlob(region));
}

function matchesGeographicRegionFilters(region) {
  if (region.is_current_strategic_region) return false;
  if (state.strategicRegions.size > 0 && !geographicRegionStrategicRegionKeys(region).some((key) => state.strategicRegions.has(key))) return false;
  if (state.resourceFilters.size > 0 && !geographicRegionStateRegions(region).some(matchesResourceFilters)) return false;
  return matchesSearchBlob(geographicRegionSearchBlob(region));
}

function matchesCompanyFilters(company) {
  if (!matchesRefSet(state.strategicRegions, company.referenced_strategic_regions)) return false;
  if (!matchesCompanyGeographicRegionFilter(company)) return false;
  if (!matchesCompanyResourceFilters(company)) return false;
  if (!matchesCompanyKindFilters(company)) return false;
  if (!matchesCompanyPrestigeFilters(company)) return false;
  if (!matchesCompanyDlcFilters(company)) return false;
  return matchesSearchBlob(companySearchBlob(company));
}

function matchesCompanyGeographicRegionFilter(company) {
  if (state.view !== "company" || !state.selectedGeographicRegion) return true;
  const region = byGeographicRegion.get(state.selectedGeographicRegion);
  if (!region) return true;
  const companyGeographicKeys = new Set((company.referenced_geographic_regions || []).map((item) => item.key).filter(Boolean));
  if (companyGeographicKeys.has(region.key)) return true;
  const stateKeys = new Set(geographicRegionStateRegions(region).map((item) => item.key));
  const companyStateKeys = new Set((company.referenced_state_regions || []).map((item) => item.key).filter(Boolean));
  if ([...companyStateKeys].some((key) => stateKeys.has(key))) return true;
  const strategicKeys = new Set(geographicRegionStrategicRegionKeys(region));
  const companyStrategicKeys = new Set((company.referenced_strategic_regions || []).map((item) => item.key).filter(Boolean));
  return [...companyStrategicKeys].some((key) => strategicKeys.has(key));
}

function matchesIdeologyFilters(ideology) {
  if (!matchesCommonLawAndIdeologyFilter(ideology, "ideology")) return false;
  if (state.ideologyTypes.size > 0 && !state.ideologyTypes.has(ideologyTypeKey(ideology))) return false;
  if (!matchesRefSet(state.ideologyGroups, ideologyInterestGroupRefs(ideology))) return false;
  if (!matchesRefSet(state.ideologyOccurrences, ideologyOccurrenceRefs(ideology))) return false;
  if (!matchesRefSet(state.ideologyLawGroups, ideologyLawGroupRefs(ideology))) return false;
  return matchesSearchBlob(ideologySearchBlob(ideology));
}

function matchesLawFilters(law) {
  if (!matchesCommonLawAndIdeologyFilter(law, "law")) return false;
  if (state.lawGroups.size > 0 && !state.lawGroups.has(law.group_key)) return false;
  return matchesSearchBlob(lawSearchBlob(law));
}

function matchesSearchBlob(blob) {
  const value = String(blob || "");
  if (state.search && !value.includes(state.search)) return false;
  return true;
}

function matchesCompanyKindFilters(company) {
  if (state.companyKinds.size === 0) return true;
  return state.companyKinds.has(companyKindKey(company));
}

function matchesCompanyPrestigeFilters(company) {
  if (state.companyPrestigeGoods.size === 0) return true;
  for (const key of state.companyPrestigeGoods) {
    if (key === "any" && (company.possible_prestige_goods || []).length > 0) return true;
    if (key === "none" && (company.possible_prestige_goods || []).length === 0) return true;
    if (key === prestigeGoodsKindKey(company)) return true;
  }
  return false;
}

function matchesCompanyDlcFilters(company) {
  if (state.companyDlcs.size === 0) return true;
  return state.companyDlcs.has(companyDlcKey(company));
}

function matchesHomelandCultureFilters(cultureRefs) {
  if (!hasCultureTraitFilters()) return true;
  return (cultureRefs || []).some((cultureRef) => {
    const culture = byCulture.get(cultureRef.key);
    if (!culture) return false;
    if (!matchesRefSet(state.heritageGroups, compactRefs([culture.heritage_group]))) return false;
    if (!matchesRefSet(state.heritages, compactRefs([culture.heritage]))) return false;
    if (!matchesRefSet(state.languageGroups, compactRefs([culture.language_group]))) return false;
    if (!matchesRefSet(state.languages, compactRefs([culture.language]))) return false;
    if (state.tradition && !(culture.traditions || []).some((trait) => trait.key === state.tradition)) return false;
    return true;
  });
}

function hasCultureTraitFilters() {
  return state.heritageGroups.size > 0
    || state.heritages.size > 0
    || state.languageGroups.size > 0
    || state.languages.size > 0
    || Boolean(state.tradition);
}

function matchingHomelandCulturesForFilters(stateRegion) {
  if (!hasCultureTraitFilters()) return [];
  return (stateRegion.homeland_cultures || [])
    .map((cultureRef) => byCulture.get(cultureRef.key))
    .filter(Boolean)
    .filter(matchesCultureTraitSelection)
    .sort(sortCultures);
}

function matchesCultureTraitSelection(culture) {
  if (!matchesRefSet(state.heritageGroups, compactRefs([culture.heritage_group]))) return false;
  if (!matchesRefSet(state.heritages, compactRefs([culture.heritage]))) return false;
  if (!matchesRefSet(state.languageGroups, compactRefs([culture.language_group]))) return false;
  if (!matchesRefSet(state.languages, compactRefs([culture.language]))) return false;
  if (state.tradition && !(culture.traditions || []).some((trait) => trait.key === state.tradition)) return false;
  return true;
}

function matchesResourceFilters(stateRegion) {
  if (state.resourceFilters.size === 0) return true;
  for (const key of state.resourceFilters) {
    const filter = resourceFilterByKey.get(key);
    if (filter && stateRegionMatchesResourceFilter(stateRegion, filter)) return true;
  }
  return false;
}

function matchesCompanyResourceFilters(company) {
  if (state.resourceFilters.size === 0) return true;
  for (const key of state.resourceFilters) {
    const filter = resourceFilterByKey.get(key);
    if (filter && companyMatchesResourceFilter(company, filter)) return true;
  }
  return false;
}

function companyMatchesResourceFilter(company, filter) {
  const mainBuildingKeys = new Set((company.building_types || []).map((item) => item.key));
  const extensionBuildingKeys = new Set((company.extension_building_types || []).map((item) => item.key));
  return resourceFilterBuildingKeys(filter).some((key) => (
    mainBuildingKeys.has(key) || (state.includeIndustryCharter && extensionBuildingKeys.has(key))
  ));
}

function resourceFilterBuildingKeys(filter) {
  return [...(filter.resources || []), ...(filter.arableResources || []), ...(filter.companyBuildings || [])];
}

function strategicRegionHasMatchingResource(region) {
  return (region.states || []).some((stateRef) => {
    const stateRegion = byStateRegion.get(stateRef.key);
    return stateRegion && matchesResourceFilters(stateRegion);
  });
}

function stateRegionMatchesResourceFilter(stateRegion, filter) {
  if (filter.arableResources) {
    const resourceKeys = new Set(filter.arableResources || []);
    return (stateRegion.arable_resources || []).some((item) => resourceKeys.has(item.key));
  }
  const resourceKeys = new Set(filter.resources || []);
  return stateRegionResourceKeys(stateRegion).some((key) => resourceKeys.has(key));
}

function stateRegionResourceKeys(stateRegion) {
  return [
    ...(stateRegion.capped_resources || []),
    ...(stateRegion.discoverable_resources || []),
  ].map((item) => item.key).filter(Boolean);
}

function renderEntityBadge(kind, entity, label = "") {
  const text = label || entity?.name_zh || entity?.name || entity?.tag || entity?.key || "?";
  const initial = text.trim().slice(0, 1).toUpperCase() || "?";
  if (kind === "country") {
    return countryFlagIconHtml(entity, "entity-badge entity-badge-flag") || `<span class="entity-badge entity-badge-square entity-badge-country">${escapeHtml(initial)}</span>`;
  }
  if (kind === "interestGroup" || kind === "interestGroupFlavor") {
    return interestGroupIconHtml(entity, "entity-badge entity-badge-interest-group");
  }
  if (kind === "interestGroupTrait") {
    return traitIconHtml(entity, "interest-group").replace('class="trait-icon"', 'class="entity-badge entity-badge-trait"');
  }
  if (kind === "company") {
    return companyIconHtml(entity).replace('class="company-logo"', 'class="entity-badge entity-badge-company"');
  }
  if (kind === "ideology") {
    return ideologyIconHtml(entity, "entity-badge entity-badge-ideology");
  }
  if (kind === "stateRegion" || kind === "strategicRegion" || kind === "geographicRegion" || kind === "region") {
    const color = entity?.map_color?.hex || entity?.colorHex || "#9b7a5f";
    return `<span class="entity-badge entity-badge-round entity-badge-region" style="--entity-color:${escapeHtml(color)}"></span>`;
  }
  if (kind === "culture" || kind === "religion" || kind === "cultureTrait" || kind === "cultureTraitGroup") {
    const color = entity?.color?.hex || entity?.colorHex || "#b28a67";
    return `<span class="entity-badge entity-badge-swatch" style="--entity-color:${escapeHtml(color)}">${escapeHtml(initial)}</span>`;
  }
  return `<span class="entity-badge entity-badge-square">${escapeHtml(initial)}</span>`;
}

function renderCountryList(filtered) {
  const visible = filtered.slice(0, 220);
  els.countryList.className = "country-list";
  els.countryList.innerHTML = visible.map((country) => `
    <article class="country-row selectable-row" data-country="${country.tag}" style="${countryBorderStyle(country.colorHex)}" aria-current="${country.tag === state.selectedTag && state.detailKind === "country"}" tabindex="0">
      ${renderEntityBadge("country", country, country.name)}
      <span class="country-heading">
        <span class="tag">${escapeHtml(country.tag)}</span>
        <span class="name">${countryNameText(country)}</span>
        ${rowDetailButton("data-country-detail", country.tag)}
      </span>
      <span class="minor country-meta">${countryCapitalText(country)}</span>
      <span class="minor country-meta">主流文化：${escapeHtml((country.primaryCulturesZh || []).join("、") || "无")}</span>
      <span class="pill-line country-tags">${countryTagPills(country)}</span>
    </article>
  `).join("");
  els.countryList.querySelectorAll("[data-country]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("a, button, [data-concept-key]")) return;
      selectCountryCard(row.dataset.country);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("a, button, [data-concept-key]")) return;
      event.preventDefault();
      selectCountryCard(row.dataset.country);
    });
  });
  els.countryList.querySelectorAll("[data-country-detail]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openCountryDetail(button.dataset.countryDetail);
    });
  });
}

function selectCountryCard(countryTag) {
  if (!countryTag || !byTag.has(countryTag)) return;
  state.selectedTag = countryTag;
  state.detailKind = "country";
  replaceHash(selectionHashForCard("/country", `/country/${encodeURIComponent(countryTag)}`));
  render();
}

function openCountryDetail(countryTag) {
  if (!countryTag || !byTag.has(countryTag)) return;
  state.selectedTag = countryTag;
  state.detailKind = "country";
  replaceHash(`/country/${encodeURIComponent(countryTag)}`);
  render();
}

function renderRegionList(filteredStrategicRegions, filteredStateRegions, filteredSeaRegions, filteredGeographicRegions) {
  const visibleStateRegions = filteredStateRegions;
  const selectedStateRegionFromMap = byStateRegion.get(state.mapSelectedStateRegion);
  const mapSelectionIsFilteredOut = selectedStateRegionFromMap && !visibleStateRegions.some((stateRegion) => stateRegion.key === selectedStateRegionFromMap.key);
  els.countryList.className = "country-list region-list";
  const selectedFromMapHtml = mapSelectionIsFilteredOut ? `
    <article class="country-row region-row region-map-selected selectable-row" data-state-region="${escapeHtml(selectedStateRegionFromMap.key)}" style="${stateRegionBorderStyle(selectedStateRegionFromMap)}" aria-current="true" tabindex="0">
      <span class="country-heading">
        <span class="tag">${escapeHtml(selectedStateRegionFromMap.key)}</span>
        <span class="name">${stateRegionNameText(selectedStateRegionFromMap)}</span>
        ${rowDetailButton("data-state-region-detail", selectedStateRegionFromMap.key)}
      </span>
      <span class="minor country-meta">${escapeHtml(stateRegionSummaryText(selectedStateRegionFromMap))}</span>
      <span class="minor country-meta">本土文化：${escapeHtml(refNames(selectedStateRegionFromMap.homeland_cultures))}</span>
      <span class="pill-line country-tags">${stateRegionTagPills(selectedStateRegionFromMap)}</span>
      <span class="region-building-strip">${stateRegionBuildingStrip(selectedStateRegionFromMap)}</span>
    </article>
  ` : "";
  const stateRegionHtml = visibleStateRegions.length ? `
    <div class="list-section-title">州地区</div>
    ${visibleStateRegions.map((stateRegion) => `
      <article class="country-row region-row selectable-row" data-state-region="${escapeHtml(stateRegion.key)}" style="${stateRegionBorderStyle(stateRegion)}" aria-current="${stateRegion.key === state.selectedStateRegion && state.detailKind === "stateRegion"}" tabindex="0">
        <span class="country-heading">
          <span class="tag">${escapeHtml(stateRegion.key)}</span>
          <span class="name">${stateRegionNameText(stateRegion)}</span>
          ${rowDetailButton("data-state-region-detail", stateRegion.key)}
        </span>
        <span class="minor country-meta">${escapeHtml(stateRegionSummaryText(stateRegion))}</span>
        <span class="minor country-meta">本土文化：${escapeHtml(refNames(stateRegion.homeland_cultures))}</span>
        <span class="pill-line country-tags">${stateRegionTagPills(stateRegion)}</span>
        <span class="region-building-strip">${stateRegionBuildingStrip(stateRegion)}</span>
      </article>
    `).join("")}
  ` : "";
  els.countryList.innerHTML = `${selectedFromMapHtml}${stateRegionHtml || (selectedFromMapHtml ? "" : `<p class="empty">没有匹配结果。</p>`)}`;
  els.countryList.querySelectorAll("[data-state-region]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("a, button, [data-concept-key]")) return;
      selectStateRegionCard(row.dataset.stateRegion);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("a, button, [data-concept-key]")) return;
      event.preventDefault();
      selectStateRegionCard(row.dataset.stateRegion);
    });
  });
  els.countryList.querySelectorAll("[data-state-region-detail]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openStateRegionDetail(button.dataset.stateRegionDetail);
    });
  });
}

function selectStateRegionCard(stateRegionKey) {
  if (!stateRegionKey || !byStateRegion.has(stateRegionKey)) return;
  state.selectedStateRegion = stateRegionKey;
  state.mapSelectedStateRegion = "";
  state.detailKind = "stateRegion";
  state.regionListMode = "state";
  replaceHash(selectionHashForCard("/region", `/state-region/${encodeURIComponent(stateRegionKey)}`));
  render();
}

function selectStateRegionFromMap(stateRegionKey) {
  if (!stateRegionKey || !byStateRegion.has(stateRegionKey)) return;
  state.selectedStateRegion = stateRegionKey;
  state.mapSelectedStateRegion = stateRegionKey;
  state.detailKind = "stateRegion";
  state.regionListMode = "state";
  replaceHash("/region");
  render();
  requestAnimationFrame(() => {
    const selectedRow = els.countryList.querySelector(`[data-state-region="${stateRegionKey}"]`);
    selectedRow?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}

function openStateRegionDetail(stateRegionKey) {
  if (!stateRegionKey || !byStateRegion.has(stateRegionKey)) return;
  state.selectedStateRegion = stateRegionKey;
  state.mapSelectedStateRegion = "";
  state.detailKind = "stateRegion";
  state.regionListMode = "state";
  replaceHash(`/state-region/${encodeURIComponent(stateRegionKey)}`);
  render();
}

function renderCultureList(filtered) {
  const visible = filtered.slice(0, 220);
  els.countryList.className = "country-list culture-list";
  els.countryList.innerHTML = visible.map((culture) => `
    <article class="culture-row selectable-row" data-culture="${escapeHtml(culture.key)}" aria-current="${culture.key === state.selectedCulture && state.detailKind === "culture"}" tabindex="0">
      <span class="country-color" style="${colorStyle(culture.color?.hex)}" aria-hidden="true"></span>
      <span class="tag">${escapeHtml(culture.key)}</span>
      <span>
        <span class="name">${escapeHtml(culture.name_zh)}</span>
        <span class="minor">${escapeHtml([culture.heritage?.name_zh, culture.language?.name_zh].filter(Boolean).join("、"))}</span>
      </span>
      ${rowDetailButton("data-culture-detail", culture.key)}
      <span class="minor">${escapeHtml((culture.homeland_strategic_regions || []).map((region) => region.name_zh).join("、"))}</span>
      <span class="pill-line">${traitList(culture.traditions)}${victorianCenturyBadge(culture)}</span>
    </article>
  `).join("");
  els.countryList.querySelectorAll("[data-culture]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("a, button, [data-concept-key]")) return;
      selectCultureCard(row.dataset.culture);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("a, button, [data-concept-key]")) return;
      event.preventDefault();
      selectCultureCard(row.dataset.culture);
    });
  });
  els.countryList.querySelectorAll("[data-culture-detail]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openCultureDetail(button.dataset.cultureDetail);
    });
  });
}

function selectCultureCard(cultureKey) {
  if (!cultureKey || !byCulture.has(cultureKey)) return;
  state.selectedCulture = cultureKey;
  state.detailKind = "culture";
  replaceHash(selectionHashForCard("/culture", `/culture/${encodeURIComponent(cultureKey)}`));
  render();
}

function openCultureDetail(cultureKey) {
  if (!cultureKey || !byCulture.has(cultureKey)) return;
  state.selectedCulture = cultureKey;
  state.detailKind = "culture";
  replaceHash(`/culture/${encodeURIComponent(cultureKey)}`);
  render();
}

function renderCompanyList(filtered) {
  const visible = filtered;
  els.countryList.className = "country-list company-list";
  els.countryList.innerHTML = visible.map((company) => `
    <article class="country-row company-row" data-company="${escapeHtml(company.key)}" aria-current="${company.key === state.selectedCompany && state.detailKind === "company"}" tabindex="0">
      <span class="company-heading">
        ${companyIconHtml(company)}
        <span class="company-title-text">
          <span class="name">${escapeHtml(company.name_zh || company.key)}</span>
          <span class="tag">${escapeHtml(company.key)}</span>
        </span>
        ${companyDlcIconPill(company)}
        ${rowDetailButton("data-company-detail", company.key)}
      </span>
      <span class="region-building-strip">${companyBuildingStrip(company)}</span>
      <span class="pill-line country-tags company-asset-line">${companyPrestigeGoodsPills(company)}</span>
      <span class="minor country-meta">${companyMetaLine(company)}</span>
      <span class="pill-line country-tags company-tag-line">${companyTagPills(company)}</span>
    </article>
  `).join("");
  els.countryList.querySelectorAll("[data-company]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("a, button, [data-concept-key]")) return;
      selectCompanyCard(row.dataset.company);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("a, button, [data-concept-key]")) return;
      event.preventDefault();
      selectCompanyCard(row.dataset.company);
    });
  });
  els.countryList.querySelectorAll("[data-company-detail]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openCompanyDetail(button.dataset.companyDetail);
    });
  });
}

function selectCompanyCard(companyKey) {
  if (!companyKey || !byCompany.has(companyKey)) return;
  state.selectedCompany = companyKey;
  state.detailKind = "company";
  replaceHash(selectionHashForCard("/company", `/company/${encodeURIComponent(companyKey)}`));
  render();
}

function openCompanyDetail(companyKey) {
  if (!companyKey || !byCompany.has(companyKey)) return;
  state.selectedCompany = companyKey;
  state.detailKind = "company";
  replaceHash(`/company/${encodeURIComponent(companyKey)}`);
  render();
}

function renderIdeologyList(filtered) {
  const visible = filtered.slice(0, 220);
  els.countryList.className = "country-list ideology-list";
  if (!visible.length) {
    els.countryList.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  const grouped = ideologyTypeOptions.map((type) => ({
    ...type,
    items: visible.filter((ideology) => ideologyTypeKey(ideology) === type.key),
  })).filter((type) => type.items.length > 0);
  els.countryList.innerHTML = grouped.map((type) => `
    <div class="list-section-title">${escapeHtml(type.label)}</div>
    ${type.items.map((ideology) => `
      <article class="country-row ideology-row selectable-row" data-ideology="${escapeHtml(ideology.key)}" aria-current="${ideology.key === state.selectedIdeology && state.detailKind === "ideology"}" tabindex="0">
        <span class="country-heading ideology-row-heading">
          ${ideologyIconHtml(ideology, "ideology-icon ideology-row-icon")}
          <span class="ideology-row-title">
            <span class="tag">${escapeHtml(ideology.key)}</span>
            <span class="name">${escapeHtml(ideology.name_zh || ideology.key)}</span>
          </span>
          ${rowDetailButton("data-ideology-detail", ideology.key)}
        </span>
        <span class="minor country-meta">${escapeHtml(cleanIdeologyDescription(ideology.desc_zh) || "无描述")}</span>
        <span class="pill-line country-tags">${victorianCenturyBadge(ideology)}</span>
        ${ideologyLawGroupPreviewHtml(ideology)}
      </article>
    `).join("")}
  `).join("");
  els.countryList.querySelectorAll("[data-ideology]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("a, button, [data-concept-key]")) return;
      selectIdeologyCard(row.dataset.ideology);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("a, button, [data-concept-key]")) return;
      event.preventDefault();
      selectIdeologyCard(row.dataset.ideology);
    });
  });
  els.countryList.querySelectorAll("[data-ideology-detail]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openIdeologyDetail(button.dataset.ideologyDetail);
    });
  });
}

function selectIdeologyCard(ideologyKey) {
  if (!ideologyKey || !ideologyByKey.has(ideologyKey)) return;
  state.selectedIdeology = ideologyKey;
  state.detailKind = "ideology";
  replaceHash(selectionHashForCard("/ideology", `/ideology/${encodeURIComponent(ideologyKey)}`));
  render();
}

function selectionHashForCard(boardHash, detailHash) {
  return isDetailPageRoute() ? detailHash : boardHash;
}

function openIdeologyDetail(ideologyKey) {
  if (!ideologyKey || !ideologyByKey.has(ideologyKey)) return;
  state.selectedIdeology = ideologyKey;
  state.detailKind = "ideology";
  replaceHash(`/ideology/${encodeURIComponent(ideologyKey)}`);
  render();
}

function renderLawList(filtered) {
  const categories = new Map();
  for (const law of filtered) {
    const groupKey = law.group_key || "uncategorized";
    const group = lawGroupByKey.get(groupKey) || { key: groupKey, name_zh: law.group_name_zh || groupKey, category: "uncategorized" };
    const categoryKey = group.category || "uncategorized";
    if (!categories.has(categoryKey)) categories.set(categoryKey, { key: categoryKey, groups: new Map() });
    const groups = categories.get(categoryKey).groups;
    if (!groups.has(groupKey)) groups.set(groupKey, { ...group, laws: [] });
    groups.get(groupKey).laws.push(law);
  }
  const sections = [...categories.values()].sort((a, b) => lawGroupCategoryOrder(a.key) - lawGroupCategoryOrder(b.key)
    || lawGroupCategoryLabel(a.key).localeCompare(lawGroupCategoryLabel(b.key), "zh-Hans-CN"));
  els.countryList.className = "country-list law-list";
  if (!sections.length) {
    els.countryList.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  els.countryList.innerHTML = sections.map((category) => `
    <details class="law-category-section" open>
      <summary class="law-category-title">${escapeHtml(lawGroupCategoryLabel(category.key))}</summary>
      ${[...category.groups.values()].sort(sortLawGroup).map((group) => `
        <section class="law-group-section">
          <h3 class="list-section-title">${escapeHtml(group.name_zh)}</h3>
          ${group.laws.sort(sortLaws).map((law) => `
      <article class="country-row law-row selectable-row" data-law="${escapeHtml(law.key)}" aria-current="${law.key === state.selectedLaw && state.detailKind === "law"}" tabindex="0">
        <span class="country-heading law-row-heading">
          ${lawIconHtml(law, "law-icon law-row-icon")}
          <span class="law-row-title"><span class="tag">${escapeHtml(law.key)}</span><span class="name">${escapeHtml(lawDisplayName(law))}</span></span>
          ${rowDetailButton("data-law-detail", law.key)}
        </span>
      </article>
          `).join("")}
        </section>
      `).join("")}
    </details>
  `).join("");
  els.countryList.querySelectorAll("[data-law]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("a, button, [data-concept-key]")) return;
      selectLawCard(row.dataset.law);
    });
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("a, button, [data-concept-key]")) return;
      event.preventDefault();
      selectLawCard(row.dataset.law);
    });
  });
  els.countryList.querySelectorAll("[data-law-detail]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openLawDetail(button.dataset.lawDetail);
    });
  });
}

function selectLawCard(lawKey) {
  if (!lawKey || !lawByKey.has(lawKey)) return;
  state.selectedLaw = lawKey;
  state.detailKind = "law";
  replaceHash(selectionHashForCard("/law", `/law/${encodeURIComponent(lawKey)}`));
  render();
}

function openLawDetail(lawKey) {
  if (!lawKey || !lawByKey.has(lawKey)) return;
  state.selectedLaw = lawKey;
  state.detailKind = "law";
  replaceHash(`/law/${encodeURIComponent(lawKey)}`);
  render();
}

function lawProgressivenessLabel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "进步度：无";
  return `进步度：${numeric > 0 ? "+" : ""}${numeric}`;
}

function globalSearchDisplayTitle(result, needle) {
  const title = result.title || result.key || "";
  const aliases = result.aliases || [];
  if (result.kind === "interestGroupFlavor" && aliases.length) return `${title}（${aliases.join("/")}）`;
  const matchedAliases = aliases.filter((alias) => normalizeSearchText(alias).includes(needle));
  if (!matchedAliases.length) return title;
  const remainingAliases = aliases.filter((alias) => !matchedAliases.includes(alias));
  return `${title}（${[...matchedAliases, ...remainingAliases].join("/")}）`;
}

function interestGroupFlavorSearchResults() {
  const candidates = countries.flatMap((country) => (country.interestGroups || [])
    .filter((group) => group.display_name?.is_flavored)
    .map((group) => ({
      id: `interestGroupFlavor:${country.tag}:${group.key}`,
      kind: "interestGroupFlavor",
      typeLabel: "利益集团风味",
      key: group.key,
      navigationKey: `${country.tag}:${group.key}`,
      title: group.display_name?.name_zh || group.name_zh || group.key,
      aliases: [group.name_zh].filter((name) => name && name !== group.display_name?.name_zh),
      subtitle: country.name,
      raw: group,
      countryTag: country.tag,
      searchText: [country.tag, country.name, group.key, group.name_zh, group.display_name?.key, group.display_name?.name_zh].filter(Boolean).join(" "),
    })));
  const byFlavor = new Map();
  for (const candidate of candidates) {
    const identity = `${candidate.key}:${candidate.title}`;
    const current = byFlavor.get(identity);
    if (!current || candidate.countryTag === "JAP") byFlavor.set(identity, candidate);
  }
  return [...byFlavor.values()];
}

function matchesCommonLawAndIdeologyFilter(item, kind) {
  if (!state.commonLawIdeologyOnly) return true;
  if (kind === "law") return !item.parent;
  return isCommonIdeology(item);
}

function isCommonIdeology(ideology) {
  return ideology?.is_universal === true;
}

function bindLawGroupFilterTokens() {
  els.lawGroupFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-law-group]");
    if (!button || !els.lawGroupFilters.contains(button)) return;
    const value = button.dataset.lawGroup;
    if (!value) return;
    const pressed = button.getAttribute("aria-pressed") === "true";
    state.lawGroups.clear();
    if (!pressed) state.lawGroups.add(value);
    render();
  });
}

function lawDisplayName(law) {
  if (!law) return "";
  const name = law.name_zh || law.key || "";
  const parent = law.parent ? lawByKey.get(law.parent) : null;
  const parentName = parent?.name_zh || law.parent || "";
  return parentName ? `${name}（${parentName}）` : name;
}

function lawGroupCategoryLabel(category) {
  return {
    power_structure: "权力结构",
    economy: "经济",
    human_rights: "人权",
    uncategorized: "未分类",
  }[category] || category || "未分类";
}

function lawGroupCategoryOrder(category) {
  return ["power_structure", "economy", "human_rights", "uncategorized"].indexOf(category);
}

function lawEffectListHtml(law) {
  const modifiers = (law.modifiers || []).map((modifier) => ({ kind: "modifier", modifier }));
  const institutionModifiers = (law.institution_modifiers || []).map((modifier) => ({ kind: "modifier", modifier }));
  const enactmentEffects = (law.enactment_effects || []).map((label) => ({ kind: "enactment", label }));
  const hasInstitutionEffects = Boolean(law.institution) || institutionModifiers.length > 0;
  if (!modifiers.length && !hasInstitutionEffects && !enactmentEffects.length) return `<p class="empty compact">暂无可直接展示的效果。</p>`;
  return `<ul class="law-effect-list">
    ${modifiers.map(lawEffectItemHtml).join("")}
    ${law.institution ? lawEffectItemHtml({ kind: "institution", institution: law.institution }) : ""}
    ${institutionModifiers.length ? `<li class="law-effect-section-label">机构效果(每级):</li>${institutionModifiers.map(lawEffectItemHtml).join("")}` : ""}
    ${enactmentEffects.map(lawEffectItemHtml).join("")}
  </ul>`;
}

function lawEffectItemHtml(entry) {
  if (entry.kind === "institution") return `<li class="law-effect-neutral">解锁${escapeHtml(entry.institution.name_zh || entry.institution.key)}机构</li>`;
  if (entry.kind === "enactment") return `<li class="law-effect-neutral">${escapeHtml(entry.label)}</li>`;
  const modifier = entry.modifier || entry;
  const label = modifier?.name_zh || modifier?.key || "";
  const value = modifier?.value_zh || "";
  return `<li class="law-effect-neutral"><span>${escapeHtml(label)}</span>${value ? ` <strong class="law-effect-value ${lawEffectClassName(modifier)}">${escapeHtml(value)}</strong>` : ""}</li>`;
}

function lawEffectClassName(modifier) {
  const value = Number(modifier?.value);
  if (Number.isFinite(value) && value > 0) return "law-effect-positive";
  if (Number.isFinite(value) && value < 0) return "law-effect-negative";
  return "law-effect-neutral";
}

function lawAmendmentDetailsHtml(amendments) {
  if (!(amendments || []).length) return "";
  return `
    <h3>相关修正案</h3>
    <div class="law-amendment-list">
      ${amendments.map((amendment) => `
        <details class="law-amendment-card">
          <summary>${escapeHtml(amendment.name_zh || amendment.key)}</summary>
          ${amendment.desc_zh ? `<p>${escapeHtml(cleanDescriptionText(amendment.desc_zh))}</p>` : ""}
          <dl class="field-grid">
            ${field("上位法", lawPill(lawByKey.get(amendment.parent_law) || { key: amendment.parent_law, name_zh: amendment.parent_law }))}
            ${field("适用法律", lawPills(amendment.allowed_laws || []))}
          </dl>
          <h4>效果</h4>
          ${lawEffectListHtml({ modifiers: amendment.modifiers || [] })}
          ${rawDetails("触发条件", amendment.possible?.raw)}
        </details>
      `).join("")}
    </div>
  `;
}

function ideologyLawGroupPreviewHtml(ideology) {
  const groups = ideologyLawGroupRefs(ideology).slice(0, 6);
  if (!groups.length) return "";
  return `
    <span class="ideology-law-preview" aria-label="相关法律组">
      ${groups.map((group) => `<span>${escapeHtml(group.name_zh || group.key)}</span>`).join("")}
    </span>
  `;
}

function renderCompanyDetail(company) {
  if (!company) {
    els.detail.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  els.detail.innerHTML = `
    <div class="detail-title">
      ${detailBackButton("company")}
      <div class="detail-title-main">
        <span class="company-icon-box">${companyIconHtml(company)}</span>
        <h2>${escapeHtml(company.name_zh || company.key)}</h2>
      </div>
      <span class="tag">${escapeHtml(company.key)}</span>
      ${victorianCenturyBadge(company)}
    </div>

    <h3>基础</h3>
    <dl class="field-grid">
      ${field("类型", tagPill(companyKindText(company), companyKindKey(company) === "historical" ? "tag-special" : "tag-type"))}
      ${field("控股类别", tagPill(company.category_zh || company.category, "tag-tier", company.category))}
      ${field("资料片", companyDlcIconPill(company) || tagPill(companyDlcLabel(company), "tag-dlc", company.dlc_name_en || companyDlcKey(company)))}
      ${field("名贵商品状态", tagPill(companyPrestigeLabel(company), "tag-good"))}
      ${field("总部倾向", stateRegionLinks(company.preferred_headquarters))}
      ${field("相关战略区域", strategicRegionLinks(company.referenced_strategic_regions))}
      ${field("相关地理区域", geographicRegionLinks(company.referenced_geographic_regions))}
      ${field("相关州地区", stateRegionLinks(company.referenced_state_regions))}
      ${field("相关文化", cultureLinks(company.referenced_cultures))}
      ${field("相关国家", countryLinks((company.referenced_countries || []).map((item) => item.tag), (company.referenced_countries || []).map((item) => item.name_zh)))}
      ${field("所需科技", listText(company.required_technologies))}
      ${field("AI 倾向科技", listText(company.ai_will_do_technologies))}
    </dl>

    <h3>经营</h3>
    <dl class="field-grid">
      ${field("主营建筑", buildingList(company.building_types, "tag-industry"))}
      ${field("扩展建筑", buildingList(company.extension_building_types, "extension-building-pill"))}
      ${field("名贵商品", companyPrestigeGoodsPills(company))}
      ${field("繁荣效果", modifierPills(company.prosperity_modifiers))}
    </dl>

    <h3>条件脚本</h3>
    ${rawDetails("潜在条件", company.potential_raw)}
    ${rawDetails("可见条件", company.attainable_raw)}
    ${rawDetails("成立条件", company.possible_raw)}
    ${rawDetails("名贵商品条件", company.prestige_goods_trigger_raw)}
    ${rawDetails("AI 倾向条件", company.ai_will_do_raw)}
    ${rawDetails("AI 建造目标", company.ai_construction_targets_raw)}
  `;
}

function renderIdeologyDetail(ideology) {
  if (!ideology) {
    els.detail.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  const typeKey = ideologyTypeKey(ideology);
  const related = relatedIdeologyUsage(ideology);
  const relatedGroups = ideologyInterestGroupRefs(ideology).slice(0, 8);
  const description = cleanIdeologyDescription(ideology.desc_zh);
  els.detail.innerHTML = `
    <article class="vic3-ideology-panel">
      <header class="vic3-ideology-header">
        ${detailBackButton("ideology")}
        <div class="vic3-ideology-title">
          ${ideologyIconHtml(ideology, "ideology-icon ideology-detail-icon")}
          <div>
            <h2>${escapeHtml(ideology.name_zh || ideology.key)}</h2>
            <div class="vic3-ideology-meta">
              <span>${escapeHtml(ideologyTypeLabels.get(typeKey) || "意识形态")}</span>
              <span>${escapeHtml(ideology.key)}</span>
              ${victorianCenturyBadge(ideology)}
            </div>
          </div>
        </div>
        <span class="vic3-ideology-kind">意识形态</span>
      </header>
      ${relatedGroups.length ? `
        <div class="vic3-ideology-interest-groups">
          ${relatedGroups.map((group) => `
            <span class="vic3-ig-icon" title="${escapeHtml(group.name_zh || group.key)}">${interestGroupIconHtml(group)}</span>
          `).join("")}
        </div>
      ` : ""}
      ${lawStanceGroupsHtml(ideology)}
      ${description ? `<p class="vic3-ideology-desc">${escapeHtml(description)}</p>` : ""}
      ${ideologyUnlockTagsHtml(ideology)}
      ${ideologyRuleSourceLabel(ideology)}
      ${ideologyFlavorDefinitionHtml(ideology)}
      ${ideologyReplacementUsageHtml(related)}
      ${ideologyWeightSectionHtml(ideology)}
    </article>
  `;
}

function renderCountryDetail(country) {
  if (!country) {
    els.detail.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  els.detail.innerHTML = `
    <div class="detail-title">
      ${detailBackButton("country")}
      <div class="detail-title-main">
        ${countryFlagIconHtml(country, "country-flag-title") || `<span class="country-color large" style="${colorStyle(country.colorHex)}" aria-hidden="true"></span>`}
        <h2>${escapeHtml(country.name)}</h2>
      </div>
      <span class="tag">${country.tag}</span>
      ${victorianCenturyBadge(country)}
    </div>

    <h3>基础</h3>
    <dl class="field-grid">
      ${field("国家类型", tagPill(countryTypeTagLabel(country), "tag-type"))}
      ${field("国家位阶", tagPill(country.tierZh, "tag-tier"))}
      ${field("标准色", colorValue(country.colorHex, country.colorRgb))}
      ${field("部队颜色", unitColorText(country))}
      ${field("主流文化", linkedTerms(country.primaryCultures, country.primaryCulturesZh, "culture"))}
      ${field("所在战略区域", strategicRegionLinks(country.locationStrategicRegions))}
      ${field("所在州地区", stateRegionLinks(country.locationStateRegions))}
      ${field("主流文化本土战略区域", strategicRegionLinks(country.primaryCultureHomelandStrategicRegions))}
      ${field("传承", groupedTraitPills(country.primaryCultureHeritageGroups, country.primaryCultureHeritages, "tag-heritage-group", "tag-heritage"))}
      ${field("语言", groupedTraitPills(country.primaryCultureLanguageGroups, country.primaryCultureLanguages, "tag-language-group", "tag-language"))}
      ${field("传统", traitList(country.primaryCultureTraditions))}
      ${field("宗教", linkedTerms([country.religion], [country.religionZh], "religion") + sourceSuffix(country.religionSource))}
      ${field("首都", stateRegionLinks(country.capital ? [{ key: country.capital, name_zh: country.capitalZh }] : []))}
    </dl>

    ${collapsibleDetailSection("利益集团风味", interestGroupFlavorList(country.interestGroups), `${(country.interestGroups || []).length} 组`)}

    <h3>国名变体</h3>
    ${dynamicNameList(country)}

    <h3>地图色</h3>
    ${dynamicMapColorList(country)}

    ${countryFlagVariantSection(country)}

    <h3>开局</h3>
    <dl class="field-grid">
      ${field("开局存在", country.existsAtStart)}
      ${field("开局州数", String(country.startingStateCount))}
      ${field("开局州", countryStartingStateRegionLinks(country))}
      ${field("历史文件", country.hasHistoryCountryFile)}
    </dl>

    <h3>成立</h3>
    <dl class="field-grid">
      ${field("次要统一", country.isMinorFormable)}
      ${field("重大统一", country.isMajorFormable)}
      ${field("特殊机制", country.specialMechanic)}
      ${field("同文化可成立", countryLinks(country.canFormTags, country.canFormNames))}
      ${field("成立文化", linkedTerms(country.formationRequiredCultures, country.formationRequiredCulturesZh, "culture"))}
      ${field("成立范围战略区域", strategicRegionLinks(country.formationStrategicRegions))}
      ${field("成立范围州地区", stateRegionLinks(country.formationStateRegions))}
      ${field("规则直接列州", stateRegionLinks((country.formationStates || []).map((key) => ({ key, name_zh: byStateRegion.get(key)?.name_zh || key }))))}
      ${field("成立地区", escapeHtml(country.formationRegion || ""))}
    </dl>

    <h3>释放</h3>
    <dl class="field-grid">
      ${field("可释放", country.isReleasable)}
      ${field("释放州", stateRegionLinks((country.releaseStates || []).map((key) => ({ key, name_zh: byStateRegion.get(key)?.name_zh || key }))))}
    </dl>
  `;
}

function renderCountryDetailPage(country) {
  renderCountryDetail(country);
}

function detailBackButton(view = state.view) {
  const target = view === "region" ? "region" : view || "country";
  const label = viewLabels[target] || "国家";
  return `<button class="detail-back-button" type="button" data-detail-back="${escapeHtml(target)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"><img class="lucide-icon" src="assets/lucide/icons/arrow-left.svg" alt="" aria-hidden="true"></button>`;
}

function rowDetailButton(attributeName, key) {
  return `<button class="row-detail-button" type="button" ${attributeName}="${escapeHtml(key)}" aria-label="进入详情" title="进入详情"><img class="lucide-icon" src="assets/lucide/icons/arrow-right.svg" alt="" aria-hidden="true"></button>`;
}

function renderCultureDetail(culture) {
  if (!culture) {
    els.detail.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  els.detail.innerHTML = `
    <div class="detail-title">
      ${detailBackButton("culture")}
      <div class="detail-title-main">
        <span class="country-color large" style="${colorStyle(culture.color?.hex)}" aria-hidden="true"></span>
        <h2>${escapeHtml(culture.name_zh)}</h2>
      </div>
      <span class="tag">${escapeHtml(culture.key)}</span>
      ${victorianCenturyBadge(culture)}
    </div>

    <h3>基础</h3>
    <dl class="field-grid">
      ${field("颜色", colorValue(culture.color?.hex, culture.color?.rgb))}
      ${field("默认宗教", linkedTerms([culture.religion?.key], [culture.religion?.name_zh], "religion"))}
      ${field("传承", groupedTraitPills(compactRefs([culture.heritage_group]), compactRefs([culture.heritage]), "tag-heritage-group", "tag-heritage"))}
      ${field("语言", groupedTraitPills(compactRefs([culture.language_group]), compactRefs([culture.language]), "tag-language-group", "tag-language"))}
      ${field("传统", traitList(culture.traditions))}
      ${field("本土战略区域", strategicRegionLinks(culture.homeland_strategic_regions))}
      ${field("本土州", stateRegionLinks(culture.homeland_state_regions))}
    </dl>

    <h3>消费</h3>
    <dl class="field-grid">
      ${field("痴迷", goodsList(culture.obsessions))}
      ${field("禁忌", goodsList(culture.taboos))}
    </dl>

    <h3>关联</h3>
    <dl class="field-grid">
      ${field("相关国家", countryLinks(
        (culture.related_countries || []).map((countryRef) => countryRef.tag),
        (culture.related_countries || []).map((countryRef) => countryRef.name_zh),
      ))}
      ${field("同传承组文化", cultureLinks(culture.same_heritage_group_cultures))}
      ${field("同传承文化", cultureLinks(culture.same_heritage_cultures))}
      ${field("同语言组文化", cultureLinks(culture.same_language_group_cultures))}
      ${field("同语言文化", cultureLinks(culture.same_language_cultures))}
      ${field("同传统文化", sameTraditionCultures(culture.traditions, culture.same_tradition_cultures))}
    </dl>
  `;
}

function renderStateRegionDetail(stateRegion) {
  const relatedCompanies = companiesForStateRegion(stateRegion);
  els.detail.innerHTML = `
    <div class="detail-title">
      ${detailBackButton("region")}
      <div class="detail-title-main">
        <h2>${stateRegionNameText(stateRegion)}</h2>
      </div>
      <span class="tag">${escapeHtml(stateRegion.key)}</span>
      ${victorianCenturyBadge(stateRegion)}
    </div>
    <h3>基础</h3>
    <dl class="field-grid">
      ${field("战略区域", strategicRegionLinks(stateRegion.strategic_regions))}
      ${field("开局归属", countryLinks((stateRegion.starting_owners || []).map((country) => country.tag), (stateRegion.starting_owners || []).map((country) => country.name_zh)))}
      ${field("本土文化", cultureLinks(stateRegion.homeland_cultures))}
      ${field("地区特质", stateTraitPills(stateRegion.traits))}
      ${field("固定资源", cappedResourceList(stateRegion.capped_resources))}
      ${field("可发现资源", discoverableResourceList(stateRegion.discoverable_resources))}
      ${field("农业建筑", buildingList(stateRegion.arable_resources))}
      ${field("耕地", stateRegion.arable_land === null ? "" : String(stateRegion.arable_land))}
    </dl>
    <h3>相关公司</h3>
    <dl class="field-grid">
      ${field("总部倾向", companyAssociationLinks(relatedCompanies.filter((item) => item.kind === "headquarters")))}
      ${field("条件引用", companyAssociationLinks(relatedCompanies.filter((item) => item.kind === "special")))}
    </dl>
    <h3>地区特质效果</h3>
    ${stateTraitEffectList(stateRegion.traits)}
    <h3>名称变体</h3>
    ${dynamicStateNameList(stateRegion)}
  `;
}

function renderStrategicRegionDetail(region) {
  const regionKind = isSeaStrategicRegion(region) ? "海域" : "战略区域";
  els.detail.innerHTML = `
    <div class="detail-title">
      ${detailBackButton("region")}
      <div class="detail-title-main">
        <span class="country-color large" style="${colorStyle(region.map_color?.hex)}" aria-hidden="true"></span>
        <h2>${escapeHtml(strategicRegionName(region))}</h2>
      </div>
      <span class="tag">${escapeHtml(region.key)}</span>
      ${victorianCenturyBadge(region)}
    </div>
    <h3>基础</h3>
    <dl class="field-grid">
      ${field("类型", tagPill(regionKind, isSeaStrategicRegion(region) ? "tag-sea" : "tag-region"))}
      ${field("颜色", colorValue(region.map_color?.hex, region.map_color?.rgb))}
      ${field("州地区", stateRegionLinks(region.states))}
      ${field("本土文化", cultureLinks(region.homeland_cultures))}
      ${field("开局国家", countryLinks((region.starting_owners || []).map((country) => country.tag), (region.starting_owners || []).map((country) => country.name_zh)))}
    </dl>
  `;
}

function renderGeographicRegionDetail(region) {
  const stateRefs = geographicRegionStateRegions(region);
  const strategicRefs = geographicRegionStrategicRegions(region);
  const startingOwners = uniqueByTag(stateRefs.flatMap((stateRegion) => stateRegion.starting_owners || []));
  const homelandCultures = uniqueByKey(stateRefs.flatMap((stateRegion) => stateRegion.homeland_cultures || []));
  els.detail.innerHTML = `
    <div class="detail-title">
      ${detailBackButton("region")}
      <div class="detail-title-main">
        <h2>${escapeHtml(geographicRegionDisplayName(region))}</h2>
      </div>
      <span class="tag">${escapeHtml(region.key)}</span>
      ${victorianCenturyBadge(region)}
    </div>
    <h3>基础</h3>
    <dl class="field-grid">
      ${field("类型", tagPill("地理区域", "tag-region"))}
      ${field("分组", tagPill(geographicRegionGroupLabels.get(region.geographic_region_group) || region.geographic_region_group_zh || region.geographic_region_group || "暂置", "tag-muted"))}
      ${field("战略区域", strategicRegionLinks(strategicRefs))}
      ${field("州地区", stateRegionLinks(stateRefs))}
      ${field("州地区数量", escapeHtml(String(stateRefs.length)))}
      ${field("开局国家", countryLinks(startingOwners.map((country) => country.tag), startingOwners.map((country) => country.name_zh)))}
      ${field("本土文化", cultureLinks(homelandCultures))}
    </dl>
    <h3>来源</h3>
    <dl class="field-grid">
      ${field("文件", escapeHtml(region.source_file || ""))}
    </dl>
  `;
}

function renderMapControls() {
  if (!els.mapModeSelect || !els.mapSubjectSelect) return;
  if (state.view === "ideology" || state.view === "law") {
    return;
  }
  syncMapModeForView();
  els.mapModeSelect.value = state.mapMode;
  const options = mapSubjectOptions(state.mapMode);
  if (!options.some((option) => option.value === state.mapSubject)) {
    state.mapSubject = defaultMapSubject(state.mapMode, options);
  }
  els.mapSubjectSelect.innerHTML = options.map((option) => (
    `<option value="${escapeHtml(option.value)}"${state.mapSubject === option.value ? " selected" : ""}>${escapeHtml(option.label)}</option>`
  )).join("");
}

function syncMapModeForView() {
  if (state.view === "ideology" || state.view === "law") {
    state.mapMode = "";
    state.mapSubject = "";
    return;
  }
  if (state.view === "country") {
    state.mapMode = "country";
    state.mapSubject = "";
    return;
  }
  if (state.view === "company") {
    state.mapMode = "company";
    state.mapSubject = "";
    return;
  }
  if (state.view === "culture") {
    if (hasCultureTraitFilters()) {
      state.mapMode = "cultureFilter";
      state.mapSubject = "";
    } else {
      state.mapMode = "culture";
      if (state.selectedCulture) state.mapSubject = state.selectedCulture;
    }
    return;
  }
  if (state.view === "region" && state.resourceFilters.size > 0) {
    state.mapMode = "resourceSelection";
    state.mapSubject = [...state.resourceFilters][0] || "";
    return;
  }
  if (state.view === "region") {
    state.mapMode = "strategicRegion";
    state.mapSubject = "";
    return;
  }
  state.mapMode = "country";
  state.mapSubject = "";
}

function mapSubjectOptions(mode) {
  if (mode === "country" || mode === "company" || mode === "cultureFilter" || mode === "resourceSelection" || mode === "strategicRegion") {
    return [{ value: state.mapSubject || "", label: automaticMapSubjectLabel(mode) }];
  }
  if (mode === "culture") {
    return cultures
      .slice()
      .sort(sortCultures)
      .map((culture) => ({ value: culture.key, label: culture.name_zh || culture.key }));
  }
  if (mode === "trait") {
    const traits = collectStateTraitRefs();
    return [
      { value: "__any_trait", label: "全部地区特质" },
      ...traits.map((trait) => ({ value: trait.key, label: trait.name_zh || trait.key })),
    ];
  }
  return collectMapResourceRefs().map((resource) => ({ value: resource.key, label: resource.name_zh || resource.key }));
}

function defaultMapSubject(mode, options) {
  if (mode === "resource" && options.some((option) => option.value === "building_oil_rig")) return "building_oil_rig";
  if (mode === "culture" && state.selectedCulture && options.some((option) => option.value === state.selectedCulture)) return state.selectedCulture;
  if (mode === "culture" && options.some((option) => option.value === "french")) return "french";
  return options[0]?.value || "";
}

function collectMapResourceRefs() {
  const ordered = resourceFilterGroups.flatMap((group) => group.filters || []).map((filter) => ({
    key: filter.key,
    name_zh: filter.label,
  }));
  const byKey = new Map(ordered.map((item) => [item.key, item]));
  for (const stateRegion of stateRegions) {
    for (const item of [
      ...(stateRegion.capped_resources || []),
      ...(stateRegion.discoverable_resources || []),
      ...(stateRegion.arable_resources || []),
    ]) {
      if (item?.key && !byKey.has(item.key)) byKey.set(item.key, { key: item.key, name_zh: item.name_zh || item.key });
    }
  }
  return [...byKey.values()];
}

function collectStateTraitRefs() {
  const byKey = new Map();
  for (const stateRegion of stateRegions) {
    for (const trait of stateRegion.traits || []) {
      if (trait?.key && !byKey.has(trait.key)) byKey.set(trait.key, trait);
    }
  }
  return [...byKey.values()].sort(sortRefByName);
}

function renderMap(mapStateRegions) {
  if (!els.mapCanvas) return;
  syncMapModeForView();
  mapRuntime.visibleStateKeys = new Set((mapStateRegions || []).map((stateRegion) => stateRegion.key));
  mapRuntime.lastMapStateRegions = mapStateRegions || [];
  if (!mapRuntime.ready) {
    ensureMapLoaded();
    return;
  }
  const signature = mapLayerSignature();
  const cachedLayer = getCachedMapLayer(signature);
  let features = cachedLayer?.features;
  if (cachedLayer) {
    mapRuntime.featureByStateKey = cachedLayer.features;
    mapRuntime.layerCanvas = cachedLayer.canvas;
    mapRuntime.currentMaxValue = cachedLayer.currentMaxValue || 0;
    mapRuntime.currentCompanyMaxValue = cachedLayer.currentCompanyMaxValue || 0;
    mapRuntime.layerSignature = signature;
  } else {
    mapRuntime.currentMaxValue = 0;
    mapRuntime.currentCompanyMaxValue = 0;
    features = buildMapFeatures();
    mapRuntime.featureByStateKey = features;
    drawMapLayer(features);
    cacheMapLayer(signature, {
      canvas: mapRuntime.layerCanvas,
      features,
      currentMaxValue: mapRuntime.currentMaxValue || 0,
      currentCompanyMaxValue: mapRuntime.currentCompanyMaxValue || 0,
    });
    mapRuntime.layerSignature = signature;
  }
  paintMapCanvas();
}

function mapLayerSignature() {
  const parts = [
    state.mapMode,
    state.mapSubject || "",
    `visible:${setSignature(mapRuntime.visibleStateKeys)}`,
  ];
  if (state.mapMode === "country") {
    parts.push(`selected:${selectedCountryMapSignature()}`);
    parts.push(`white:${state.whiteDecentralized ? 1 : 0}`);
    parts.push(`dim:${shouldDimUnfilteredCountries() ? 1 : 0}`);
    if (shouldDimUnfilteredCountries()) parts.push(`countries:${setSignature(mapRuntime.filteredCountryTags)}`);
  }
  if (state.mapMode === "company") {
    parts.push(`companies:${objectKeySignature(mapRuntime.companyMapCompanies)}`);
  }
  if (state.mapMode === "resourceSelection") {
    parts.push(`resources:${setSignature(state.resourceFilters)}`);
  }
  if (state.mapMode === "cultureFilter") {
    parts.push(`heritageGroups:${setSignature(state.heritageGroups)}`);
    parts.push(`heritages:${setSignature(state.heritages)}`);
    parts.push(`languageGroups:${setSignature(state.languageGroups)}`);
    parts.push(`languages:${setSignature(state.languages)}`);
    parts.push(`tradition:${state.tradition || ""}`);
  }
  return parts.join("|");
}

function getCachedMapLayer(signature) {
  const entry = mapRuntime.layerCache.get(signature);
  if (!entry) return null;
  mapRuntime.layerCache.delete(signature);
  mapRuntime.layerCache.set(signature, entry);
  return entry;
}

function cacheMapLayer(signature, entry) {
  if (!signature || !entry?.canvas || !entry?.features) return;
  mapRuntime.layerCache.set(signature, entry);
  while (mapRuntime.layerCache.size > MAP_LAYER_CACHE_LIMIT) {
    const oldestKey = mapRuntime.layerCache.keys().next().value;
    mapRuntime.layerCache.delete(oldestKey);
  }
}

function setSignature(values) {
  return [...(values || [])].filter(Boolean).sort().join(",");
}

function objectKeySignature(items) {
  return (items || []).map((item) => item?.key).filter(Boolean).sort().join(",");
}

function ensureMapLoaded() {
  if (mapRuntime.ready || mapRuntime.loading) return;
  mapRuntime.loading = true;
  if (!mapData?.runs || !mapData?.stateKeys) {
    mapRuntime.loading = false;
    mapRuntime.error = "地图索引文件缺失";
    return;
  }
  window.setTimeout(async () => {
    mapRuntime.paperMapImage = await loadImageCandidates(mapRuntime.paperMapUrls).catch(() => null);
    mapRuntime.width = mapData.width || mapRuntime.width;
    mapRuntime.height = mapData.height || mapRuntime.height;
    mapRuntime.stateKeysByIndex = mapData.stateKeys || [""];
    mapRuntime.ownerKeysByIndex = mapData.ownerKeys || [""];
    mapRuntime.pixelStateIndexes = decodeMapRuns(mapData.runs, mapRuntime.width * mapRuntime.height);
    mapRuntime.pixelOwnerIndexes = mapData.ownerRuns
      ? decodeMapRuns(mapData.ownerRuns, mapRuntime.width * mapRuntime.height)
      : null;
    mapRuntime.stateCenters = computeMapStateCenters(mapRuntime.pixelStateIndexes, mapRuntime.width, mapRuntime.height, mapRuntime.stateKeysByIndex);
    mapRuntime.ready = true;
    mapRuntime.loading = false;
    resetMapTransform();
    renderMap(mapRuntime.lastMapStateRegions || landStateRegions);
    focusCurrentMapSelection();
  }, 0);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function loadImageCandidates(sources) {
  let lastError = null;
  for (const source of sources || []) {
    try {
      return await loadImage(source);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("图片加载失败");
}

function decodeMapRuns(runs, expectedLength) {
  const indexes = new Int32Array(expectedLength);
  let cursor = 0;
  for (let i = 0; i < runs.length; i += 2) {
    const index = runs[i] || 0;
    const length = runs[i + 1] || 0;
    indexes.fill(index, cursor, cursor + length);
    cursor += length;
  }
  return indexes;
}

function computeMapStateCenters(indexes, width, height, stateKeysByIndex) {
  const sums = Array.from({ length: stateKeysByIndex.length }, () => ({ x: 0, y: 0, count: 0 }));
  for (let pixel = 0; pixel < indexes.length; pixel += 1) {
    const index = indexes[pixel];
    if (!index) continue;
    const item = sums[index];
    item.x += pixel % width;
    item.y += Math.floor(pixel / width);
    item.count += 1;
  }
  const centers = new Map();
  for (let index = 1; index < sums.length; index += 1) {
    const item = sums[index];
    const key = stateKeysByIndex[index];
    if (!key || !item.count) continue;
    centers.set(key, {
      x: item.x / item.count,
      y: item.y / item.count,
      count: item.count,
    });
  }
  return centers;
}

function buildMapFeatures() {
  if (state.mapMode === "country") return buildCountryMapFeatures();
  if (state.mapMode === "strategicRegion") return buildStrategicRegionMapFeatures();
  if (state.mapMode === "company") return buildCompanyMapFeatures();
  if (state.mapMode === "resourceSelection") return buildSelectedResourceMapFeatures();
  if (state.mapMode === "cultureFilter") return buildCultureFilterMapFeatures();
  if (state.mapMode === "culture") return buildCultureMapFeatures();
  if (state.mapMode === "trait") return buildTraitMapFeatures();
  return buildResourceMapFeatures();
}

function mapFeatureColor(stateRegion, color) {
  if (isSeaStateRegion(stateRegion)) return MAP_SEA_COLOR;
  return mapRuntime.visibleStateKeys.has(stateRegion.key) ? color : MAP_MUTED_COLOR;
}

function buildCompanyMapFeatures() {
  const selectedCompanies = mapRuntime.companyMapCompanies || companies;
  const associations = buildCompanyStateAssociations(selectedCompanies);
  const maxValue = Math.max(0, ...[...associations.values()].map((item) => item.count));
  mapRuntime.currentCompanyMaxValue = maxValue;
  const features = new Map();
  for (const stateRegion of stateRegions) {
    const isSea = isSeaStateRegion(stateRegion);
    const association = associations.get(stateRegion.key) || emptyCompanyAssociation();
    const region = primaryStrategicRegionForState(stateRegion);
    const baseColor = region?.map_color?.hex || "#8f8d80";
    const color = isSea ? MAP_SEA_COLOR : companyAssociationColor(baseColor, association.count);
    const title = isSea ? "海域" : companyAssociationTitle(association, region);
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, color),
      active: association.count > 0,
      value: association.count,
      label: association.count > 1 ? String(association.count) : "",
      title,
      companyAssociation: association,
    });
  }
  return features;
}

function buildCompanyStateAssociations(selectedCompanies) {
  const associations = new Map();
  for (const company of selectedCompanies || []) {
    const headquarters = new Set((company.preferred_headquarters || []).map((stateRegion) => stateRegion.key).filter(Boolean));
    const referenced = new Set((company.referenced_state_regions || []).map((stateRegion) => stateRegion.key).filter(Boolean));
    const stateKeys = unique([...headquarters, ...referenced]);
    for (const stateKey of stateKeys) {
      const stateRegion = byStateRegion.get(stateKey);
      if (!stateRegion || isSeaStateRegion(stateRegion)) continue;
      if (!associations.has(stateKey)) associations.set(stateKey, emptyCompanyAssociation());
      const association = associations.get(stateKey);
      association.count += 1;
      if (headquarters.has(stateKey)) association.headquarters += 1;
      if (referenced.has(stateKey) && !headquarters.has(stateKey)) association.special += 1;
      association.companies.push({
        key: company.key,
        name_zh: company.name_zh || company.key,
        kind: headquarters.has(stateKey) ? "headquarters" : "special",
      });
    }
  }
  return associations;
}

function emptyCompanyAssociation() {
  return {
    count: 0,
    headquarters: 0,
    special: 0,
    companies: [],
  };
}

function primaryStrategicRegionForState(stateRegion) {
  return (stateRegion.strategic_regions || [])
    .map((region) => byStrategicRegion.get(region.key))
    .filter((region) => region && !isSeaStrategicRegion(region))
    .sort(sortStrategicRegionRef)[0] || null;
}

function geographicRegionStateRegions(region) {
  if (!region) return [];
  return uniqueByKey((region.state_regions || [])
    .map((stateRef) => byStateRegion.get(stateRef.key) || stateRef)
    .filter((stateRef) => stateRef?.key))
    .sort(sortStateRegions);
}

function geographicRegionStrategicRegions(region) {
  if (!region) return [];
  const directRefs = (region.strategic_regions || [])
    .map((strategicRef) => byStrategicRegion.get(strategicRef.key) || strategicRef)
    .filter((strategicRef) => strategicRef?.key);
  const expandedRefs = geographicRegionStateRegions(region)
    .flatMap((stateRegion) => stateRegion.strategic_regions || [])
    .map((strategicRef) => byStrategicRegion.get(strategicRef.key) || strategicRef)
    .filter((strategicRef) => strategicRef?.key);
  return uniqueByKey([...directRefs, ...expandedRefs]).sort(sortStrategicRegionRef);
}

function geographicRegionStrategicRegionKeys(region) {
  return geographicRegionStrategicRegions(region).map((strategicRegion) => strategicRegion.key);
}

function uniqueByTag(items) {
  const map = new Map();
  for (const item of items || []) {
    if (!item?.tag || map.has(item.tag)) continue;
    map.set(item.tag, item);
  }
  return [...map.values()].sort((a, b) => a.tag.localeCompare(b.tag));
}

function companyAssociationColor(baseColor, count) {
  return interpolateColor("#f5f1e8", baseColor, count > 0 ? 0.62 : 0.18);
}

function companyAssociationTitle(association, region) {
  if (!association.count) {
    return `${region?.name_zh || "无战略区域"}：无公司关联`;
  }
  const companyNames = association.companies
    .slice(0, 5)
    .map((company) => company.name_zh)
    .join("、");
  const more = association.companies.length > 5 ? `等 ${association.companies.length} 个` : "";
  return [
    `${region?.name_zh || "无战略区域"}：关联公司 ${association.count} 个`,
    `总部 ${association.headquarters} 个`,
    `条件 ${association.special} 个`,
    [companyNames, more].filter(Boolean).join(""),
  ].filter(Boolean).join("；");
}

function companyMapStateRegions(selectedCompanies) {
  return selectedCompanies ? stateRegions : stateRegions;
}

function regionMapStateRegions(filteredStateRegions, filteredSeaStateRegions, filteredGeographicRegions) {
  if (state.selectedGeographicRegion) {
    const selectedRegion = byGeographicRegion.get(state.selectedGeographicRegion) || filteredGeographicRegions[0];
    const states = selectedRegion ? geographicRegionStateRegions(selectedRegion) : [];
    return states.length ? states : filteredStateRegions;
  }
  if (state.resourceFilters.size > 0 || state.strategicRegions.size > 0) {
    return [...filteredStateRegions, ...filteredSeaStateRegions];
  }
  return stateRegions;
}

function buildStrategicRegionMapFeatures() {
  const features = new Map();
  const selectedGeographicStateKeys = state.selectedGeographicRegion
    ? new Set(geographicRegionStateRegions(byGeographicRegion.get(state.selectedGeographicRegion)).map((stateRegion) => stateRegion.key))
    : null;
  for (const stateRegion of stateRegions) {
    const region = primaryStrategicRegionForState(stateRegion);
    const isSea = isSeaStateRegion(stateRegion);
    const inGeographicRegion = selectedGeographicStateKeys?.has(stateRegion.key);
    const color = isSea
      ? MAP_SEA_COLOR
      : inGeographicRegion
        ? "#4f8a61"
        : region?.map_color?.hex || "#d7d8cf";
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, color),
      active: selectedGeographicStateKeys ? Boolean(inGeographicRegion) : Boolean(region),
      value: selectedGeographicStateKeys ? Number(Boolean(inGeographicRegion)) : region ? 1 : 0,
      title: selectedGeographicStateKeys
        ? inGeographicRegion
          ? byGeographicRegion.get(state.selectedGeographicRegion)?.name_zh || "地理区域"
          : "不在当前地理区域"
        : region ? strategicRegionName(region) : "无战略区域",
      strategicRegion: region,
    });
  }
  return features;
}

function buildCountryMapFeatures() {
  const selectedCountry = byTag.get(state.selectedTag);
  const selectedStateKeys = new Set(countryMapStateKeys(selectedCountry));
  const features = new Map();
  for (const stateRegion of stateRegions) {
    const isSea = isSeaStateRegion(stateRegion);
    const owners = stateRegion.starting_owners || [];
    const owner = owners[0]?.tag ? byTag.get(owners[0].tag) : null;
    if (selectedCountry && selectedStateKeys.size > 0) {
      const isSelectedTerritory = selectedStateKeys.has(stateRegion.key);
      features.set(stateRegion.key, {
        color: isSea
          ? MAP_SEA_COLOR
          : isSelectedTerritory
            ? selectedCountryMapColor(selectedCountry)
            : MAP_MUTED_COLOR,
        active: isSelectedTerritory,
        value: Number(isSelectedTerritory),
        title: isSea
          ? "娴峰煙"
          : isSelectedTerritory
            ? `${selectedCountry.name} (${selectedCountry.tag})`
            : "涓嶅湪褰撳墠鍥藉榛樿棰嗗湡",
      });
      continue;
    }
    const color = isSea
      ? "#b9d7df"
      : countryOwnerMapColor(owner, owners[0]?.tag || "");
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, color),
      active: owners.length > 0,
      value: owners.length,
      title: isSea ? "海域" : owners.length ? `开局归属：${refNames(owners)}` : "无开局归属",
    });
  }
  return features;
}

function countryMapStateRegions(country) {
  const selectedKeys = countryMapStateKeys(country);
  if (selectedKeys.length) {
    return selectedKeys
      .map((key) => byStateRegion.get(key))
      .filter(Boolean);
  }
  return stateRegions;
}

function countryMapStateKeys(country) {
  if (!country) return [];
  const formationStateKeys = [
    ...(country.formationStateRegions || []).map((stateRegion) => stateRegion.key),
    ...(country.formationStates || []),
  ].filter(Boolean);
  if (formationStateKeys.length) return unique(formationStateKeys);
  if (country.formationRegion) {
    const region = byGeographicRegion.get(country.formationRegion);
    const regionStateKeys = geographicRegionStateRegions(region).map((stateRegion) => stateRegion.key);
    if (regionStateKeys.length) return unique(regionStateKeys);
  }
  const fallbackKeys = [
    ...(country.startingStates || []),
    ...(country.releaseStates || []),
  ].filter(Boolean);
  return unique(fallbackKeys);
}

function selectedCountryMapColor(country) {
  return country?.colorHex || "#b68d42";
}

function selectedCountryMapSignature() {
  const country = byTag.get(state.selectedTag);
  if (!country) return "";
  return `${country.tag}:${countryMapStateKeys(country).sort().join(",")}`;
}

function countryMapUsesOwnerPixels() {
  if (state.mapMode !== "country" || !mapRuntime.pixelOwnerIndexes) return false;
  const selectedCountry = byTag.get(state.selectedTag);
  return !selectedCountry || countryMapStateKeys(selectedCountry).length === 0;
}

function countryOwnerMapColor(owner, ownerTag) {
  if (shouldDimUnfilteredCountries() && ownerTag && !mapRuntime.filteredCountryTags.has(ownerTag)) return "#d8dedb";
  if (state.whiteDecentralized && owner?.countryType === "decentralized") return "#f7f6f1";
  if (owner?.countryType === "decentralized") return owner?.colorHex ? interpolateColor(owner.colorHex, "#f7f6f1", 0.8) : "#efece4";
  if (owner?.colorHex) return owner.colorHex;
  if (ownerTag) return "#b8b1a5";
  return "#e9e5dc";
}

function shouldDimUnfilteredCountries() {
  return state.dimUnfilteredCountries || hasCountryMapFilterSelection();
}

function hasCountryMapFilterSelection() {
  return state.view === "country" && (
    Boolean(state.search)
    || state.flags.size > 0
    || state.tiers.size > 0
    || state.types.size > 0
    || state.strategicRegions.size > 0
    || state.heritageGroups.size > 0
    || state.heritages.size > 0
    || state.languageGroups.size > 0
    || state.languages.size > 0
    || Boolean(state.tradition)
  );
}

function buildSelectedResourceMapFeatures() {
  const selectedFilters = [...state.resourceFilters]
    .map((key) => resourceFilterByKey.get(key))
    .filter(Boolean);
  const values = new Map();
  let maxValue = 0;
  for (const stateRegion of stateRegions) {
    const items = selectedFilters.map((filter) => {
      const resourceKey = (filter.resources || filter.arableResources || [])[0] || filter.key;
      const valueInfo = stateRegionResourceValue(stateRegion, resourceKey);
      return {
        key: resourceKey,
        label: filter.label,
        ...valueInfo,
      };
    }).filter((item) => item.value > 0);
    const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
    values.set(stateRegion.key, { total, items });
    maxValue = Math.max(maxValue, total);
  }
  const features = new Map();
  for (const stateRegion of stateRegions) {
    const valueInfo = values.get(stateRegion.key) || { total: 0, items: [] };
    const visible = mapRuntime.visibleStateKeys.has(stateRegion.key);
    const isSea = isSeaStateRegion(stateRegion);
    const color = isSea
      ? MAP_SEA_COLOR
      : valueInfo.total > 0
        ? interpolateColor("#f6d89a", "#9b4a2f", Math.sqrt(valueInfo.total / Math.max(maxValue, 1)))
        : "#eee9df";
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, color),
      active: valueInfo.total > 0,
      value: valueInfo.total,
      label: valueInfo.total > 0 ? formatMapLabelValue(valueInfo.total) : "",
      title: valueInfo.items.length
        ? valueInfo.items.map((item) => `${item.label} ${item.detail}`).join("；")
        : `无${selectedResourceMapLabel()}`,
      resourceItems: valueInfo.items,
    });
  }
  mapRuntime.currentMaxValue = maxValue;
  return features;
}

function buildCultureFilterMapFeatures() {
  const features = new Map();
  let maxValue = 0;
  const matchesByState = new Map();
  for (const stateRegion of stateRegions) {
    const matches = matchingHomelandCulturesForFilters(stateRegion);
    matchesByState.set(stateRegion.key, matches);
    maxValue = Math.max(maxValue, matches.length);
  }
  for (const stateRegion of stateRegions) {
    const matches = matchesByState.get(stateRegion.key) || [];
    const isSea = isSeaStateRegion(stateRegion);
    const color = isSea
      ? MAP_SEA_COLOR
      : matches.length
        ? MAP_CULTURE_MATCH_COLOR
        : "#eee9df";
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, color),
      active: matches.length > 0,
      value: matches.length,
      title: matches.length ? matches.map((culture) => culture.name_zh || culture.key).join("、") : "无匹配文化本土",
      cultures: matches,
    });
  }
  return features;
}

function buildResourceMapFeatures() {
  const subject = state.mapSubject;
  const resourceName = mapSubjectLabel();
  const values = new Map();
  let maxValue = 0;
  for (const stateRegion of stateRegions) {
    const valueInfo = stateRegionResourceValue(stateRegion, subject);
    values.set(stateRegion.key, valueInfo);
    maxValue = Math.max(maxValue, valueInfo.value || 0);
  }
  const features = new Map();
  for (const stateRegion of stateRegions) {
    const valueInfo = values.get(stateRegion.key) || { value: 0, detail: "" };
    const visible = mapRuntime.visibleStateKeys.has(stateRegion.key);
    const isSea = isSeaStateRegion(stateRegion);
    const color = isSea
      ? MAP_SEA_COLOR
      : valueInfo.value > 0
        ? interpolateColor("#f6d89a", "#9b4a2f", Math.sqrt(valueInfo.value / Math.max(maxValue, 1)))
        : "#eee9df";
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, color),
      active: valueInfo.value > 0,
      value: valueInfo.value,
      title: valueInfo.value > 0 ? `${resourceName} ${valueInfo.detail}` : `无${resourceName}`,
      legend: resourceName,
    });
  }
  mapRuntime.currentMaxValue = maxValue;
  return features;
}

function buildCultureMapFeatures() {
  const selectedCulture = byCulture.get(state.mapSubject);
  const features = new Map();
  for (const stateRegion of stateRegions) {
    const relation = cultureRelationForStateRegion(stateRegion, selectedCulture);
    const visible = mapRuntime.visibleStateKeys.has(stateRegion.key);
    const color = cultureRelationColor(relation.rank, isSeaStateRegion(stateRegion));
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, color),
      active: relation.rank > 0,
      value: relation.rank,
      title: relation.label,
      relation,
    });
  }
  return features;
}

function buildTraitMapFeatures() {
  const selectedTraitKey = state.mapSubject;
  const allTraits = selectedTraitKey === "__any_trait";
  const maxCount = Math.max(1, ...stateRegions.map((stateRegion) => (stateRegion.traits || []).length));
  const features = new Map();
  for (const stateRegion of stateRegions) {
    const traits = stateRegion.traits || [];
    const matchingTraits = allTraits ? traits : traits.filter((trait) => trait.key === selectedTraitKey);
    const visible = mapRuntime.visibleStateKeys.has(stateRegion.key);
    const isSea = isSeaStateRegion(stateRegion);
    const color = isSea
      ? MAP_SEA_COLOR
      : matchingTraits.length
        ? allTraits
          ? interpolateColor("#d7e8b5", "#5f7f3f", matchingTraits.length / maxCount)
          : matchingTraits.some((trait) => trait.has_mapi)
            ? "#b46a2b"
            : "#5f8f55"
        : "#eee9df";
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, color),
      active: matchingTraits.length > 0,
      value: matchingTraits.length,
      title: matchingTraits.length ? matchingTraits.map((trait) => trait.name_zh || trait.key).join("、") : "无匹配地区特质",
      traits: matchingTraits,
    });
  }
  return features;
}

function drawMapLayer(features) {
  const canvas = document.createElement("canvas");
  canvas.width = mapRuntime.width;
  canvas.height = mapRuntime.height;
  const context = canvas.getContext("2d");
  const imageData = context.createImageData(mapRuntime.width, mapRuntime.height);
  const data = imageData.data;
  const stateIndexes = mapRuntime.pixelStateIndexes;
  const stateLayer = buildStateLayerColors(features);
  const ownerLayerColors = countryMapUsesOwnerPixels()
    ? buildOwnerLayerColors()
    : null;
  for (let pixel = 0, offset = 0; pixel < stateIndexes.length; pixel += 1, offset += 4) {
    const stateIndex = stateIndexes[pixel] || 0;
    const rgb = ownerLayerColors && stateIndex
      ? countryPixelRgb(stateIndex, mapRuntime.pixelOwnerIndexes[pixel] || 0, stateLayer, ownerLayerColors)
      : stateLayer.colors[stateIndex] || stateLayer.colors[0];
    data[offset] = rgb[0];
    data[offset + 1] = rgb[1];
    data[offset + 2] = rgb[2];
    data[offset + 3] = stateIndex
      ? mapPixelAlpha(stateIndex, stateLayer)
      : 0;
  }
  addMapBorders(
    data,
    stateIndexes,
    mapRuntime.width,
    mapRuntime.height,
    state.mapMode === "country" ? mapRuntime.pixelOwnerIndexes : null,
  );
  context.putImageData(imageData, 0, 0);
  mapRuntime.layerCanvas = canvas;
}

function mapPixelAlpha(stateIndex, stateLayer) {
  if (stateLayer.sea[stateIndex]) return MAP_SEA_ALPHA;
  if (!stateLayer.visible[stateIndex]) return MAP_MUTED_ALPHA;
  return MAP_LAND_ALPHA;
}

function buildStateLayerColors(features) {
  const colors = Array.from({ length: mapRuntime.stateKeysByIndex.length }, () => hexToRgb("#ebeae6"));
  const sea = new Uint8Array(mapRuntime.stateKeysByIndex.length);
  const visible = new Uint8Array(mapRuntime.stateKeysByIndex.length);
  for (let index = 1; index < mapRuntime.stateKeysByIndex.length; index += 1) {
    const stateKey = mapRuntime.stateKeysByIndex[index];
    const stateRegion = byStateRegion.get(stateKey);
    const feature = features.get(stateKey);
    const isSea = stateRegion && isSeaStateRegion(stateRegion);
    if (isSea) sea[index] = 1;
    if (stateRegion && mapRuntime.visibleStateKeys.has(stateRegion.key)) visible[index] = 1;
    const color = !stateRegion
      ? "#ebeae6"
      : isSea
        ? MAP_SEA_COLOR
        : feature?.color || "#ebeae6";
    colors[index] = hexToRgb(color);
  }
  return {
    colors,
    sea,
    visible,
    muted: hexToRgb(MAP_MUTED_COLOR),
    seaColor: hexToRgb(MAP_SEA_COLOR),
  };
}

function buildOwnerLayerColors() {
  return mapRuntime.ownerKeysByIndex.map((ownerTag) => {
    const owner = byTag.get(ownerTag);
    return hexToRgb(countryOwnerMapColor(owner, ownerTag));
  });
}

function countryPixelRgb(stateIndex, ownerIndex, stateLayer, ownerLayerColors) {
  if (stateLayer.sea[stateIndex]) return stateLayer.seaColor;
  if (!stateLayer.visible[stateIndex]) return stateLayer.muted;
  return ownerLayerColors[ownerIndex] || ownerLayerColors[0];
}

function mapPixelColor(stateRegion, feature, pixel) {
  if (!stateRegion) return "#ebeae6";
  if (isSeaStateRegion(stateRegion)) return MAP_SEA_COLOR;
  if (countryMapUsesOwnerPixels()) {
    if (!mapRuntime.visibleStateKeys.has(stateRegion.key)) return MAP_MUTED_COLOR;
    const ownerIndex = mapRuntime.pixelOwnerIndexes[pixel] || 0;
    const ownerTag = mapRuntime.ownerKeysByIndex[ownerIndex] || "";
    const owner = byTag.get(ownerTag);
    if (state.dimUnfilteredCountries && ownerTag && !mapRuntime.filteredCountryTags.has(ownerTag)) return "#d8dedb";
    if (state.whiteDecentralized && owner?.countryType === "decentralized") return "#f7f6f1";
    if (owner?.colorHex) return owner.colorHex;
    if (ownerTag) return "#b8b1a5";
    return "#e9e5dc";
  }
  if (feature) return feature.color;
  return "#ebeae6";
}

function addMapBorders(data, stateIndexes, width, height, ownerIndexes = null) {
  const border = [54, 66, 60];
  const ownerBoundaryColor = [82, 93, 87];
  const seaBorder = hexToRgb(MAP_SEA_BORDER_COLOR);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width;
    const hasDown = y < height - 1;
    for (let x = 0; x < width; x += 1) {
      const pixel = rowStart + x;
      const index = stateIndexes[pixel];
      if (!index) continue;
      const rightPixel = x === width - 1 ? rowStart : pixel + 1;
      const downPixel = hasDown ? pixel + width : -1;
      const rightIndex = stateIndexes[rightPixel];
      const downIndex = hasDown ? stateIndexes[downPixel] : index;
      const stateBorder = index !== rightIndex || (hasDown && index !== downIndex);
      const hasOwnerBorder = ownerIndexes && (
        (index === rightIndex && (ownerIndexes[pixel] || 0) !== (ownerIndexes[rightPixel] || 0))
        || (hasDown && index === downIndex && (ownerIndexes[pixel] || 0) !== (ownerIndexes[downPixel] || 0))
      );
      if (stateBorder || hasOwnerBorder) {
        const color = indexTouchesSea(index, rightIndex) || indexTouchesSea(index, downIndex)
          ? seaBorder
          : stateBorder
            ? border
            : ownerBoundaryColor;
        paintBorderPixel(data, pixel, color);
        if (index !== rightIndex && rightIndex) paintBorderPixel(data, rightPixel, color);
        if (hasDown && index !== downIndex && downIndex) paintBorderPixel(data, downPixel, color);
      }
    }
  }
}

function paintBorderPixel(data, pixel, color) {
  const offset = pixel * 4;
  data[offset] = color[0];
  data[offset + 1] = color[1];
  data[offset + 2] = color[2];
  data[offset + 3] = 255;
}

function indexTouchesSea(index, neighborIndex) {
  if (!neighborIndex || index === neighborIndex) return false;
  return isSeaStateRegion(byStateRegion.get(mapRuntime.stateKeysByIndex[index]))
    || isSeaStateRegion(byStateRegion.get(mapRuntime.stateKeysByIndex[neighborIndex]));
}

function paintMapCanvas() {
  if (!mapRuntime.layerCanvas || !els.mapCanvas || !els.mapViewport) return;
  const canvas = els.mapCanvas;
  const rect = els.mapViewport.getBoundingClientRect();
  const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1) * 1.4);
  const width = Math.max(320, Math.floor(rect.width * ratio));
  const height = Math.max(260, Math.floor(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#d7c2a4";
  context.fillRect(0, 0, width, height);
  context.setTransform(
    mapRuntime.transform.scale * ratio,
    0,
    0,
    mapRuntime.transform.scale * ratio,
    mapRuntime.transform.x * ratio,
    mapRuntime.transform.y * ratio,
  );
  context.imageSmoothingEnabled = false;
  const copyRange = visibleMapCopyRange(rect.width);
  for (let copy = copyRange.start; copy <= copyRange.end; copy += 1) {
    if (mapRuntime.paperMapImage) {
      context.drawImage(mapRuntime.paperMapImage, copy * mapRuntime.width, 0, mapRuntime.width, mapRuntime.height);
    }
    context.drawImage(mapRuntime.layerCanvas, copy * mapRuntime.width, 0);
  }
  drawMapLabels(context, copyRange);
}

function resetMapTransform() {
  if (!els.mapViewport) return;
  const rect = els.mapViewport.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const scale = Math.min(rect.width / mapRuntime.width, rect.height / mapRuntime.height);
  mapRuntime.transform.scale = scale;
  mapRuntime.transform.x = (rect.width - mapRuntime.width * scale) / 2;
  mapRuntime.transform.y = (rect.height - mapRuntime.height * scale) / 2;
  normalizeMapTransformX();
}

function fitMapToWidth() {
  if (!els.mapViewport || !mapRuntime.ready) return;
  const rect = els.mapViewport.getBoundingClientRect();
  if (!rect.width || !rect.height || !mapRuntime.width || !mapRuntime.height) return;
  const scale = rect.width / mapRuntime.width;
  mapRuntime.transform.scale = scale;
  mapRuntime.transform.x = 0;
  mapRuntime.transform.y = (rect.height - mapRuntime.height * scale) / 2;
  normalizeMapTransformX();
  hideMapTooltip();
  paintMapCanvas();
}

function focusCompanyOnMap(company) {
  if (state.view !== "company" || !company || !mapRuntime.ready || !els.mapViewport || !mapRuntime.stateCenters) return;
  focusStateRegionsOnMap(companyStateRegionKeys(company), { maxWorldScale: 2.2, padding: 260 });
}

function focusCountryOnMap(country) {
  if (state.view !== "country" || !country || !mapRuntime.ready || !els.mapViewport || !mapRuntime.stateCenters) return;
  focusStateRegionsOnMap(countryMapStateKeys(country), { maxWorldScale: 2.1, padding: 280 });
}

function focusStateRegionOnMap(stateRegion) {
  if (state.view !== "region" || !stateRegion || isSeaStateRegion(stateRegion) || !mapRuntime.ready || !els.mapViewport || !mapRuntime.stateCenters) return;
  focusStateRegionsOnMap([stateRegion.key], { maxWorldScale: 2.1, padding: 320 });
}

function focusCurrentMapSelection() {
  if (state.view === "country") {
    focusCountryOnMap(byTag.get(state.selectedTag));
    return;
  }
  if (state.view === "region") {
    focusStateRegionOnMap(byStateRegion.get(state.selectedStateRegion));
    return;
  }
  if (state.view === "company") {
    focusCompanyOnMap(byCompany.get(state.selectedCompany));
  }
}

function focusStateRegionsOnMap(stateKeys, options = {}) {
  if (!mapRuntime.ready || !els.mapViewport || !mapRuntime.stateCenters) return;
  const centers = (stateKeys || []).map((key) => mapRuntime.stateCenters.get(key)).filter(Boolean);
  if (!centers.length) return;
  const viewport = els.mapViewport.getBoundingClientRect();
  if (!viewport.width || !viewport.height) return;
  const minX = Math.min(...centers.map((point) => point.x));
  const maxX = Math.max(...centers.map((point) => point.x));
  const minY = Math.min(...centers.map((point) => point.y));
  const maxY = Math.max(...centers.map((point) => point.y));
  const padding = options.padding ?? 70;
  const targetWidth = Math.max(80, maxX - minX + padding * 2);
  const targetHeight = Math.max(80, maxY - minY + padding * 2);
  const targetScale = Math.min(viewport.width / targetWidth, viewport.height / targetHeight);
  const worldFitScale = Math.min(viewport.width / mapRuntime.width, viewport.height / mapRuntime.height);
  const minScale = options.minScale ?? worldFitScale;
  const maxScale = options.maxWorldScale
    ? worldFitScale * options.maxWorldScale
    : options.maxScale ?? 2.8;
  const scale = clampNumber(targetScale, minScale, maxScale);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  mapRuntime.transform.scale = scale;
  mapRuntime.transform.x = viewport.width / 2 - centerX * scale;
  mapRuntime.transform.y = viewport.height / 2 - centerY * scale;
  normalizeMapTransformX();
  hideMapTooltip();
  paintMapCanvas();
}

function companyStateRegionKeys(company) {
  return unique([
    ...(company?.preferred_headquarters || []).map((stateRegion) => stateRegion.key),
    ...(company?.referenced_state_regions || []).map((stateRegion) => stateRegion.key),
  ].filter(Boolean));
}

function visibleMapCopyRange(viewportWidth) {
  const scale = Math.max(mapRuntime.transform.scale, 0.001);
  const left = -mapRuntime.transform.x / scale;
  const right = (viewportWidth - mapRuntime.transform.x) / scale;
  return {
    start: Math.floor(left / mapRuntime.width) - 1,
    end: Math.ceil(right / mapRuntime.width) + 1,
  };
}

function normalizeMapTransformX() {
  const scaledMapWidth = mapRuntime.width * Math.max(mapRuntime.transform.scale, 0.001);
  if (!Number.isFinite(scaledMapWidth) || scaledMapWidth <= 0) return;
  let x = mapRuntime.transform.x % scaledMapWidth;
  if (x > 0) x -= scaledMapWidth;
  mapRuntime.transform.x = x;
}

function drawMapLabels(context, copyRange = { start: 0, end: 0 }) {
  if (!["resourceSelection", "company"].includes(state.mapMode) || !mapRuntime.stateCenters || !mapRuntime.featureByStateKey) return;
  const inverseScale = 1 / Math.max(mapRuntime.transform.scale, 0.001);
  const baseFontSize = state.mapMode === "resourceSelection" ? 14 : 16;
  context.save();
  context.font = `700 ${Math.round(baseFontSize * inverseScale)}px ${MAP_LABEL_FONT_FAMILY}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.lineWidth = (state.mapMode === "resourceSelection" ? 3.2 : 4.5) * inverseScale;
  const drawQueue = [];
  for (const [stateKey, feature] of mapRuntime.featureByStateKey) {
    if (!feature?.label) continue;
    const center = mapRuntime.stateCenters.get(stateKey);
    if (!center || center.count < 6) continue;
    const text = String(feature.label);
    const priority = Number(feature.value || 0) * 1000000 + center.count;
    for (let copy = copyRange.start; copy <= copyRange.end; copy += 1) {
      drawQueue.push({
        text,
        x: center.x + copy * mapRuntime.width,
        y: center.y + 0.5 * inverseScale,
        priority,
      });
    }
  }
  drawQueue.sort((a, b) => a.priority - b.priority);
  for (const item of drawQueue) {
    context.strokeStyle = "rgba(255, 254, 249, 0.96)";
    context.strokeText(item.text, item.x, item.y);
    context.fillStyle = "#18231f";
    context.fillText(item.text, item.x, item.y);
  }
  context.restore();
}

function bindMapEvents() {
  if (!els.mapCanvas || !els.mapViewport) return;
  els.mapCanvas.addEventListener("wheel", (event) => {
    if (!mapRuntime.ready) return;
    event.preventDefault();
    const rect = els.mapCanvas.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const before = screenToMapPoint(pointerX, pointerY);
    const factor = event.deltaY < 0 ? 1.18 : 0.85;
    mapRuntime.transform.scale = clampNumber(mapRuntime.transform.scale * factor, 0.12, 8);
    mapRuntime.transform.x = pointerX - before.x * mapRuntime.transform.scale;
    mapRuntime.transform.y = pointerY - before.y * mapRuntime.transform.scale;
    normalizeMapTransformX();
    paintMapCanvas();
    updateMapTooltip(event);
  }, { passive: false });
  els.mapCanvas.addEventListener("pointerdown", (event) => {
    mapRuntime.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: mapRuntime.transform.x,
      y: mapRuntime.transform.y,
      moved: false,
    };
    els.mapCanvas.setPointerCapture(event.pointerId);
  });
  els.mapCanvas.addEventListener("pointermove", (event) => {
    if (mapRuntime.drag) {
      const dx = event.clientX - mapRuntime.drag.startX;
      const dy = event.clientY - mapRuntime.drag.startY;
      if (Math.abs(dx) + Math.abs(dy) > 2) mapRuntime.drag.moved = true;
      mapRuntime.transform.x = mapRuntime.drag.x + dx;
      mapRuntime.transform.y = mapRuntime.drag.y + dy;
      normalizeMapTransformX();
      paintMapCanvas();
      hideMapTooltip();
      return;
    }
    updateMapTooltip(event);
  });
  els.mapCanvas.addEventListener("pointerup", (event) => {
    const drag = mapRuntime.drag;
    mapRuntime.drag = null;
    if (drag?.pointerId) els.mapCanvas.releasePointerCapture(drag.pointerId);
    if (drag && !drag.moved) {
      const stateRegion = stateRegionFromPointerEvent(event);
      if (stateRegion) {
        selectStateRegionFromMap(stateRegion.key);
      }
    }
  });
  els.mapCanvas.addEventListener("dblclick", (event) => {
    if (state.view !== "region") return;
    const stateRegion = stateRegionFromPointerEvent(event);
    if (stateRegion) openStateRegionDetail(stateRegion.key);
  });
  els.mapCanvas.addEventListener("pointerleave", () => {
    mapRuntime.drag = null;
    hideMapTooltip();
  });
  window.addEventListener("resize", () => {
    if (state.view === "region" && mapRuntime.ready) {
      resetMapTransform();
      paintMapCanvas();
    }
  });
}

function updateMapTooltip(event) {
  const stateRegion = stateRegionFromPointerEvent(event);
  if (!stateRegion) {
    hideMapTooltip();
    return;
  }
  const feature = mapRuntime.featureByStateKey?.get(stateRegion.key);
  const ownerTag = countryOwnerTagFromPointerEvent(event);
  els.mapTooltip.hidden = false;
  els.mapTooltip.innerHTML = mapTooltipHtml(stateRegion, feature, ownerTag);
  const viewportRect = els.mapViewport.getBoundingClientRect();
  const x = event.clientX - viewportRect.left + 12;
  const y = event.clientY - viewportRect.top + 12;
  const tooltipWidth = els.mapTooltip.offsetWidth || 440;
  const tooltipHeight = els.mapTooltip.offsetHeight || 280;
  els.mapTooltip.style.left = `${Math.max(8, Math.min(x, viewportRect.width - tooltipWidth - 8))}px`;
  els.mapTooltip.style.top = `${Math.max(8, Math.min(y, viewportRect.height - tooltipHeight - 8))}px`;
}

function hideMapTooltip() {
  if (els.mapTooltip) els.mapTooltip.hidden = true;
}

function stateRegionFromPointerEvent(event) {
  const pixel = mapPixelIndexFromPointerEvent(event);
  if (pixel < 0) return null;
  const index = mapRuntime.pixelStateIndexes?.[pixel] || 0;
  const stateKey = mapRuntime.stateKeysByIndex?.[index] || "";
  return byStateRegion.get(stateKey) || null;
}

function countryOwnerTagFromPointerEvent(event) {
  if (!mapRuntime.pixelOwnerIndexes) return "";
  const pixel = mapPixelIndexFromPointerEvent(event);
  if (pixel < 0) return "";
  const index = mapRuntime.pixelOwnerIndexes[pixel] || 0;
  return mapRuntime.ownerKeysByIndex?.[index] || "";
}

function mapPixelIndexFromPointerEvent(event) {
  const rect = els.mapCanvas.getBoundingClientRect();
  const point = screenToMapPoint(event.clientX - rect.left, event.clientY - rect.top);
  const x = wrapMapX(Math.floor(point.x));
  const y = Math.floor(point.y);
  if (y < 0 || y >= mapRuntime.height) return -1;
  return y * mapRuntime.width + x;
}

function screenToMapPoint(x, y) {
  return {
    x: (x - mapRuntime.transform.x) / mapRuntime.transform.scale,
    y: (y - mapRuntime.transform.y) / mapRuntime.transform.scale,
  };
}

function wrapMapX(x) {
  const width = mapRuntime.width || 1;
  return ((x % width) + width) % width;
}

function mapTooltipHtml(stateRegion, feature, ownerTag = "") {
  const isSea = isSeaStateRegion(stateRegion);
  const kind = isSea ? "海域" : "州地区";
  const variants = stateRegionVariantNames(stateRegion);
  const variantText = variants.length ? `（${escapeHtml(variants.join("/"))}）` : "";
  if (isSea) {
    return `
      <div class="map-tooltip-title">${escapeHtml(stateRegion.name_zh || stateRegion.key)}</div>
      <div class="map-tooltip-sub">${escapeHtml(kind)} · ${escapeHtml(stateRegion.key)}</div>
    `;
  }
  const rows = mapTooltipRowsForView(stateRegion, feature, ownerTag);
  return `
    <div class="map-tooltip-title">${escapeHtml(stateRegion.name_zh || stateRegion.key)}${variantText}</div>
    <div class="map-tooltip-sub">${escapeHtml(kind)} · ${escapeHtml(stateRegion.key)}</div>
    <dl>
      ${rows.map(([label, value]) => tooltipField(label, value)).join("")}
    </dl>
  `;
}

function mapTooltipRowsForView(stateRegion, feature, ownerTag = "") {
  if (state.view === "country" || state.mapMode === "country") {
    return compactTooltipRows([
      ["开局归属", refNames(stateRegion.starting_owners)],
      ["当前省份归属", ownerTag ? countryNameWithTag(ownerTag) : ""],
      ["战略区域", refNames(stateRegion.strategic_regions)],
      ["本土文化", refNames(stateRegion.homeland_cultures)],
    ]);
  }
  if (state.view === "culture" || state.mapMode === "culture") {
    const selectedCulture = byCulture.get(state.selectedCulture);
    return compactTooltipRows([
      ["开局归属", refNames(stateRegion.starting_owners)],
      ["当前省份归属", ownerTag ? countryNameWithTag(ownerTag) : ""],
      ["本土文化", refNames(stateRegion.homeland_cultures)],
      ["文化关系", selectedCulture ? cultureRelationForStateRegion(stateRegion, selectedCulture).label : feature?.title || ""],
    ]);
  }
  if (state.view === "company" || state.mapMode === "company") {
    return compactTooltipRows([
      ["开局归属", countryRefNames(stateRegion.starting_owners)],
      ["战略区域", refNames(stateRegion.strategic_regions)],
      ...mapTooltipResourceRows(stateRegion),
      ["地区特质", mapTooltipTraitSummary(stateRegion)],
    ]);
  }
  return compactTooltipRows([
    ["战略区域", refNames(stateRegion.strategic_regions)],
    ...mapTooltipResourceRows(stateRegion),
    ["耕地", stateRegion.arable_land === null ? "" : String(stateRegion.arable_land)],
    ["地区特质", mapTooltipTraitSummary(stateRegion)],
  ]);
}

function compactTooltipRows(rows) {
  return rows.filter(([, value]) => tooltipValuePresent(value));
}

function tooltipValuePresent(value) {
  if (value && typeof value === "object" && "html" in value) return Boolean(String(value.html || "").trim());
  return Boolean(String(value || "").trim());
}

function resourceSummaryText(stateRegion) {
  const resources = [
    ...(stateRegion?.capped_resources || []).map((item) => compactResourceLabel(item, item.amount)),
    ...(stateRegion?.discoverable_resources || []).map((item) => {
      const amount = item.undiscovered_amount ?? item.discovered_amount ?? item.amount ?? "";
      return compactResourceLabel(item, amount);
    }),
    ...(stateRegion?.arable_resources || []).map((item) => compactResourceLabel(item, "")),
  ].filter(Boolean);
  return summarizeTextItems(resources, 5);
}

function mapTooltipTraitSummary(stateRegion) {
  const traits = (stateRegion?.traits || []).map((trait) => trait.name_zh || trait.key).filter(Boolean);
  return summarizeTextItems(traits, 4);
}

function compactResourceLabel(item, amount = "") {
  const label = item?.name_zh || item?.key || "";
  if (!label) return "";
  return amount !== "" && amount !== null ? `${label} ${amount}` : label;
}

const miningResourceBuildingKeys = new Set([
  "building_coal_mine",
  "building_iron_mine",
  "building_lead_mine",
  "building_sulfur_mine",
  "building_gold_mine",
  "building_gold_fields",
  "building_gold_field",
]);

function mapTooltipResourceRows(stateRegion) {
  const groups = mapTooltipResourceGroups(stateRegion);
  return compactTooltipRows([
    ["采矿", tooltipHtml(mapTooltipResourceGroupHtml(groups.mining))],
    ["其他资源", tooltipHtml(mapTooltipResourceGroupHtml(groups.other))],
    ["农业", tooltipHtml(mapTooltipResourceGroupHtml(groups.agriculture))],
  ]);
}

function mapTooltipResourceGroups(stateRegion) {
  const capped = (stateRegion?.capped_resources || []).map((item) => ({ item, amount: item.amount, className: "resource-chip" }));
  const discoverable = (stateRegion?.discoverable_resources || []).map((item) => {
    const amount = item.undiscovered_amount ?? item.discovered_amount ?? item.amount ?? "";
    return { item, amount, className: "resource-chip discoverable-chip" };
  });
  const resources = [...capped, ...discoverable].filter((entry) => entry.item?.key);
  return {
    mining: resources.filter((entry) => miningResourceBuildingKeys.has(entry.item.key)),
    other: resources.filter((entry) => !miningResourceBuildingKeys.has(entry.item.key)),
    agriculture: (stateRegion?.arable_resources || []).map((item) => ({ item, amount: "", className: "resource-chip arable-chip" })),
  };
}

function mapTooltipResourceGroupHtml(entries) {
  const chips = (entries || []).map((entry) => buildingChip(entry.item, entry.amount, entry.className)).filter(Boolean);
  return chips.length ? `<span class="map-tooltip-resource-row">${chips.join("")}</span>` : "";
}

function tooltipHtml(html) {
  return { html };
}

function summarizeTextItems(items, limit) {
  const values = [...new Set((items || []).filter(Boolean))];
  if (!values.length) return "";
  const visible = values.slice(0, limit);
  const more = values.length > limit ? `等 ${values.length} 项` : "";
  return [...visible, more].filter(Boolean).join("、");
}

function tooltipField(label, value) {
  const htmlValue = value && typeof value === "object" && "html" in value;
  return `<dt>${escapeHtml(label)}</dt><dd>${htmlValue ? value.html : escapeHtml(value || "无")}</dd>`;
}

function sortCountries(a, b) {
  if (state.sort === "name") return a.name.localeCompare(b.name, "zh-Hans-CN") || a.tag.localeCompare(b.tag);
  if (state.sort === "tier") return Number(b.tierPrestige || 0) - Number(a.tierPrestige || 0) || a.tag.localeCompare(b.tag);
  if (state.sort === "states") return b.startingStateCount - a.startingStateCount || a.tag.localeCompare(b.tag);
  return a.tag.localeCompare(b.tag);
}

function sortCultures(a, b) {
  if (state.sort === "name") return a.name_zh.localeCompare(b.name_zh, "zh-Hans-CN") || a.key.localeCompare(b.key);
  if (state.sort === "homelands") return (b.homeland_state_regions || []).length - (a.homeland_state_regions || []).length || a.key.localeCompare(b.key);
  return a.key.localeCompare(b.key);
}

function sortStateRegions(a, b) {
  if (state.view === "region" && state.resourceFilters.size > 0) {
    return selectedResourceValue(b) - selectedResourceValue(a)
      || firstStrategicRegionOrder(a) - firstStrategicRegionOrder(b)
      || Number(a.numeric_id || Number.MAX_SAFE_INTEGER) - Number(b.numeric_id || Number.MAX_SAFE_INTEGER)
      || a.key.localeCompare(b.key);
  }
  if (state.sort === "name") return a.name_zh.localeCompare(b.name_zh, "zh-Hans-CN") || a.key.localeCompare(b.key);
  if (state.sort === "region") {
    return firstStrategicRegionOrder(a) - firstStrategicRegionOrder(b)
      || Number(a.numeric_id || Number.MAX_SAFE_INTEGER) - Number(b.numeric_id || Number.MAX_SAFE_INTEGER)
      || a.key.localeCompare(b.key);
  }
  if (state.sort === "resources") return stateRegionResourceCount(b) - stateRegionResourceCount(a) || a.key.localeCompare(b.key);
  return Number(a.numeric_id || Number.MAX_SAFE_INTEGER) - Number(b.numeric_id || Number.MAX_SAFE_INTEGER) || a.key.localeCompare(b.key);
}

function sortGeographicRegions(a, b) {
  if (state.sort === "name") return geographicRegionDisplayName(a).localeCompare(geographicRegionDisplayName(b), "zh-Hans-CN") || a.key.localeCompare(b.key);
  if (state.sort === "region") {
    return firstGeographicStrategicRegionOrder(a) - firstGeographicStrategicRegionOrder(b)
      || geographicRegionDisplayName(a).localeCompare(geographicRegionDisplayName(b), "zh-Hans-CN")
      || a.key.localeCompare(b.key);
  }
  if (state.sort === "resources") return geographicRegionStateRegions(b).length - geographicRegionStateRegions(a).length || a.key.localeCompare(b.key);
  return a.key.localeCompare(b.key);
}

function firstGeographicStrategicRegionOrder(region) {
  const values = geographicRegionStrategicRegionKeys(region).map((key) => orderValue(strategicRegionOrderByKey, key));
  return Math.min(...values, Number.MAX_SAFE_INTEGER);
}

function selectedResourceValue(stateRegion) {
  let total = 0;
  for (const key of state.resourceFilters) {
    const filter = resourceFilterByKey.get(key);
    const resourceKey = (filter?.resources || filter?.arableResources || [])[0] || key;
    total += Number(stateRegionResourceValue(stateRegion, resourceKey).value || 0);
  }
  return total;
}

function sortCompanies(a, b) {
  if (state.sort === "name") return (a.name_zh || a.key).localeCompare(b.name_zh || b.key, "zh-Hans-CN") || a.key.localeCompare(b.key);
  if (state.sort === "kind") return Number(b.flavored_company) - Number(a.flavored_company) || a.key.localeCompare(b.key);
  if (state.sort === "buildings") {
    return ((b.building_types || []).length + (b.extension_building_types || []).length)
      - ((a.building_types || []).length + (a.extension_building_types || []).length)
      || a.key.localeCompare(b.key);
  }
  return a.key.localeCompare(b.key);
}

function sortIdeologies(a, b) {
  if (state.sort === "name") return (a.name_zh || a.key).localeCompare(b.name_zh || b.key, "zh-Hans-CN") || a.key.localeCompare(b.key);
  if (state.sort === "type") {
    return orderValue(ideologyTypeOrder, ideologyTypeKey(a)) - orderValue(ideologyTypeOrder, ideologyTypeKey(b))
      || (a.name_zh || a.key).localeCompare(b.name_zh || b.key, "zh-Hans-CN")
      || a.key.localeCompare(b.key);
  }
  if (state.sort === "laws") return lawStanceCount(b) - lawStanceCount(a) || a.key.localeCompare(b.key);
  return a.key.localeCompare(b.key);
}

function renderLawDetail(law) {
  if (!law) {
    els.detail.innerHTML = `<p class="empty">没有匹配结果。</p>`;
    return;
  }
  const group = lawGroupByKey.get(law.group_key);
  const stances = lawIdeologyStances(law);
  els.detail.innerHTML = `
    <div class="detail-title law-detail-title">
      ${detailBackButton("law")}
      <div class="detail-title-main">
        ${lawIconHtml(law, "law-icon law-detail-icon")}
      <h2>${escapeHtml(lawDisplayName(law))}</h2>
      </div>
      <span class="tag">${escapeHtml(law.key)}</span>
    </div>
    <h3>基础</h3>
    <dl class="field-grid">
      ${field("法律组", tagPill(group?.name_zh || law.group_name_zh || law.group_key, "tag-type", law.group_key))}
      ${field("进步度", lawProgressivenessLabel(law.progressiveness))}
      ${field("前置科技", refItemsPills(law.unlocking_technologies, "technology", "tag-technology"))}
      ${field("互斥法律", lawPills(law.disallowing_laws || []))}
      ${field("来源文件", escapeHtml(fileBaseName(law.source_file)))}
    </dl>
    <h3>效果</h3>
    ${lawEffectListHtml(law)}
    ${lawAmendmentDetailsHtml(law.amendments)}
    <h3>意识形态态度</h3>
    ${lawIdeologyStanceHtml(stances)}
    <h3>条件脚本</h3>
    ${rawDetails("可见条件", law.is_visible?.raw)}
    ${rawDetails("颁布条件", law.can_enact?.raw)}
    ${rawDetails("法律组启用条件", group?.enable?.raw)}
    ${rawDetails("法律组变更条件", group?.change_allowed_trigger?.raw)}
  `;
}

function lawIdeologyStances(law) {
  const lawKey = lawStanceSourceKey(law);
  const grouped = new Map();
  for (const ideology of ideologies) {
    const stance = (ideology.law_stances || []).find((item) => item.law_key === lawKey);
    if (!stance) continue;
    if (!grouped.has(stance.stance)) grouped.set(stance.stance, []);
    grouped.get(stance.stance).push(ideology);
  }
  for (const items of grouped.values()) items.sort(sortIdeologyRefsByType);
  return grouped;
}

function lawStanceSourceKey(law) {
  const visited = new Set();
  let current = law;
  while (current?.parent && !visited.has(current.key)) {
    visited.add(current.key);
    current = lawByKey.get(current.parent);
  }
  return current?.key || law?.key || "";
}

function lawIdeologyStanceHtml(grouped) {
  const blocks = lawStanceDisplayOrder.map((stance) => {
    const items = grouped.get(stance) || [];
    if (!items.length) return "";
    return `
      <section class="law-ideology-stance ${lawStanceClassName(stance)}">
        <h4>${escapeHtml(lawStanceSentencePrefix(stance))}</h4>
        ${ideologyPillGroups(items, `tag-ideology ${lawStanceClassName(stance)}`)}
      </section>
    `;
  }).filter(Boolean).join("");
  return blocks ? `<div class="law-ideology-stance-list">${blocks}</div>` : `<p class="empty compact">没有意识形态态度数据。</p>`;
}

function sortLaws(a, b) {
  return Number(a.sort_order ?? Number.MAX_SAFE_INTEGER) - Number(b.sort_order ?? Number.MAX_SAFE_INTEGER)
    || a.key.localeCompare(b.key);
}

function sortCountriesByTag(a, b) {
  return a.tag.localeCompare(b.tag);
}

function renderSortOptions() {
  const options = state.view === "culture"
    ? [
      ["key", "按 Key"],
      ["name", "按名称"],
      ["homelands", "按本土州数"],
    ]
    : state.view === "region"
      ? [
        ["key", "按州编号"],
        ["name", "按名称"],
        ["region", "按战略区域"],
        ["resources", "按资源项数"],
      ]
      : state.view === "company"
        ? [
          ["key", "按 Key"],
          ["name", "按名称"],
          ["kind", "按类型"],
          ["buildings", "按建筑数"],
        ]
        : state.view === "ideology"
          ? [
            ["key", "按编号"],
            ["name", "按名称"],
            ["type", "按类型"],
          ]
          : state.view === "law"
            ? [["key", "游戏内顺序"]]
    : [
      ["key", "按 Tag"],
      ["name", "按名称"],
      ["tier", "按位阶"],
      ["states", "按开局州数"],
    ];
  if (!options.some(([key]) => key === state.sort)) state.sort = options[0][0];
  els.sortSelect.innerHTML = options.map(([key, label]) => (
    `<option value="${key}"${state.sort === key ? " selected" : ""}>${escapeHtml(label)}</option>`
  )).join("");
}

function collectCultureRefs(getter, sorter = sortRefByName, sourceCultures = cultures) {
  const map = new Map();
  for (const culture of sourceCultures) {
    const value = getter(culture);
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      if (!item?.key || map.has(item.key)) continue;
      map.set(item.key, item);
    }
  }
  return [...map.values()].sort(sorter);
}

function renderDependentFilterOptions() {
  const filterCultures = state.omitIndigenousLanguagesCultures
    ? cultures.filter((culture) => !isIndigenousCulture(culture))
    : cultures;
  const heritageGroups = collectCultureRefs((culture) => culture.heritage_group, sortHeritageGroupRef, filterCultures);
  const languageGroups = collectCultureRefs((culture) => culture.language_group, sortLanguageGroupRef, filterCultures);
  const heritages = collectCultureRefs((culture) => culture.heritage, sortRefByName, filterCultures)
    .filter((trait) => !state.heritageGroups.size || state.heritageGroups.has(trait.group_key));
  const languages = collectCultureRefs((culture) => culture.language, sortRefByName, filterCultures)
    .filter((trait) => !state.languageGroups.size || state.languageGroups.has(trait.group_key));

  syncSetWithOptions(state.heritages, heritages);
  syncSetWithOptions(state.languages, languages);

  renderGroupedFilterOptions({
    container: els.heritageGroupFilters,
    groups: heritageGroups,
    traits: heritages,
    selectedGroups: state.heritageGroups,
    selectedTraits: state.heritages,
    groupKind: "heritage-group",
    traitKind: "heritage",
  });
  renderGroupedFilterOptions({
    container: els.languageGroupFilters,
    groups: languageGroups,
    traits: languages,
    selectedGroups: state.languageGroups,
    selectedTraits: state.languages,
    groupKind: "language-group",
    traitKind: "language",
  });
  if (els.heritageFilters) els.heritageFilters.innerHTML = "";
  if (els.languageFilters) els.languageFilters.innerHTML = "";
}

function renderGroupedFilterOptions({ container, groups, traits, selectedGroups, selectedTraits, groupKind, traitKind }) {
  const traitsByGroup = new Map();
  for (const trait of traits || []) {
    if (!trait?.group_key) continue;
    if (!traitsByGroup.has(trait.group_key)) traitsByGroup.set(trait.group_key, []);
    traitsByGroup.get(trait.group_key).push(trait);
  }
  container.innerHTML = (groups || []).map((group) => {
    const groupTraits = traitsByGroup.get(group.key) || [];
    const singleTraitClass = groupKind === "language-group" && groupTraits.length === 1 ? " filter-single-trait" : "";
    return `
      <div class="filter-row filter-group-block${singleTraitClass}">
        <div class="filter-row-label">${optionToken(groupKind, group.key, group.name_zh || group.key, selectedGroups.has(group.key), "filter-token-group")}</div>
        <span class="filter-row-items">
          ${groupTraits.map((trait) => (
            optionToken(traitKind, trait.key, trait.name_zh || trait.key, selectedTraits.has(trait.key))
          )).join("")}
        </span>
      </div>
    `;
  }).join("");
}

function renderStrategicRegionFilterOptions() {
  const regionKeys = state.view === "culture"
    ? new Set(cultures.flatMap((culture) => (culture.homeland_strategic_regions || []).map((region) => region.key)))
    : state.view === "region"
      ? new Set(landStrategicRegions.map((region) => region.key))
      : state.view === "company"
        ? new Set(companies.flatMap((company) => (company.referenced_strategic_regions || []).map((region) => region.key)))
        : new Set(countries.flatMap((country) => (country.locationStrategicRegions || []).map((region) => region.key)));
  const options = strategicRegions
    .filter((region) => regionKeys.has(region.key) && !isSeaStrategicRegion(region))
    .sort(sortStrategicRegionRef);
  syncSetWithOptions(state.strategicRegions, options);
  renderStrategicRegionGroups(options);
}

function renderResourceFilterOptions() {
  const groups = visibleResourceFilterGroups();
  syncSetWithOptions(state.resourceFilters, groups.flatMap((group) => group.filters || []));
  els.resourceFilters.innerHTML = groups.map((group) => `
    <div class="filter-row resource-filter-row">
      <span class="filter-row-items resource-filter-items">
        ${group.filters.map((filter) => (
          resourceOptionToken(filter)
        )).join("")}
      </span>
    </div>
  `).join("");
}

function renderCompanyFilterOptions() {
  syncSetWithOptions(state.companyKinds, companyKindOptions);
  syncSetWithOptions(state.companyPrestigeGoods, companyPrestigeOptions);
  syncSetWithOptions(state.companyDlcs, companyDlcOptions);
  els.industryCharterFilters.innerHTML = optionToken(
    "industry-charter",
    industryCharterOption.key,
    industryCharterOption.label,
    state.includeIndustryCharter,
  );
  els.companyKindFilters.innerHTML = companyKindOptions.map((option) => (
    optionToken("company-kind", option.key, option.label, state.companyKinds.has(option.key))
  )).join("");
  els.companyPrestigeFilters.innerHTML = companyPrestigeOptions.map((option) => (
    optionToken("company-prestige", option.key, option.label, state.companyPrestigeGoods.has(option.key))
  )).join("");
  els.companyDlcFilters.innerHTML = companyDlcOptions.map((option) => (
    companyDlcOptionToken(option, state.companyDlcs.has(option.key))
  )).join("");
}

function renderIdeologyFilterOptions() {
  syncSetWithOptions(state.ideologyTypes, ideologyTypeOptions);
  const groups = collectIdeologyInterestGroupOptions();
  const occurrences = ideologyOccurrenceOptions;
  const lawGroups = collectIdeologyLawGroupOptions();
  syncSetWithOptions(state.ideologyGroups, groups);
  syncSetWithOptions(state.ideologyOccurrences, occurrences);
  syncSetWithOptions(state.ideologyLawGroups, lawGroups);
  els.ideologyTypeFilters.innerHTML = ideologyTypeOptions.map((option) => (
    ideologyChoiceToken("ideology-type", option.key, option.label, state.ideologyTypes.has(option.key))
  )).join("");
  els.ideologyGroupFilters.innerHTML = groups.map((group) => (
    ideologyGroupIconToken(group, state.ideologyGroups.has(group.key))
  )).join("");
  els.ideologyOccurrenceFilters.innerHTML = occurrences.map((option) => (
    ideologyChoiceToken("ideology-occurrence", option.key, option.label, state.ideologyOccurrences.has(option.key))
  )).join("");
  els.ideologyLawGroupFilters.innerHTML = renderIdeologyLawGroupFilterSections(lawGroups);
}

function renderLawFilterOptions() {
  const groups = lawGroups.slice().sort(sortLawGroup);
  syncSetWithOptions(state.lawGroups, groups);
  els.lawGroupFilters.innerHTML = renderLawGroupFilterSections(groups);
}

function renderLawGroupFilterSections(groups) {
  const byCategory = new Map();
  for (const group of groups) {
    const category = group.category || "uncategorized";
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(group);
  }
  return [...byCategory.entries()]
    .sort(([a], [b]) => lawGroupCategoryOrder(a) - lawGroupCategoryOrder(b) || lawGroupCategoryLabel(a).localeCompare(lawGroupCategoryLabel(b), "zh-Hans-CN"))
    .map(([category, categoryGroups]) => `
      <section class="ideology-law-filter-group">
        <h3>${escapeHtml(lawGroupCategoryLabel(category))}</h3>
        <div class="ideology-law-filter-items">
          ${categoryGroups.map((group) => ideologyChoiceToken("law-group", group.key, group.name_zh || group.key, state.lawGroups.has(group.key))).join("")}
        </div>
      </section>
    `).join("");
}

function sortLawGroup(a, b) {
  return orderValue(ideologyLawGroupOrderMap, a.key) - orderValue(ideologyLawGroupOrderMap, b.key)
    || (a.name_zh || a.key).localeCompare(b.name_zh || b.key, "zh-Hans-CN")
    || a.key.localeCompare(b.key);
}

function collectIdeologyInterestGroupOptions() {
  return (interestGroups || []).filter((group) => group?.key).slice(0, 8);
}

function collectIdeologyLawGroupOptions() {
  const map = new Map();
  for (const ideology of ideologies || []) {
    for (const stance of ideology.law_stances || []) {
      if (!stance.law_group_key || map.has(stance.law_group_key)) continue;
      map.set(stance.law_group_key, {
        key: stance.law_group_key,
        name_zh: stance.law_group_name_zh || stance.law_group_key,
      });
    }
  }
  return [...map.values()].sort(sortIdeologyLawGroup);
}

function renderIdeologyLawGroupFilterSections(lawGroups) {
  const byCategory = new Map([
    ...ideologyLawFilterGroups.map((group) => [group.key, []]),
    [ideologyLawUnknownFilterGroup.key, []],
  ]);
  for (const lawGroup of lawGroups || []) {
    const groupKey = ideologyLawFilterGroupByLawKey.get(lawGroup.key) || ideologyLawUnknownFilterGroup.key;
    byCategory.get(groupKey).push(lawGroup);
  }
  const visibleGroups = [
    ...ideologyLawFilterGroups,
    ...((byCategory.get(ideologyLawUnknownFilterGroup.key) || []).length ? [ideologyLawUnknownFilterGroup] : []),
  ];
  return visibleGroups.map((group) => {
    const items = byCategory.get(group.key) || [];
    if (!items.length) return "";
    return `
      <section class="ideology-law-filter-group">
        <h3>${escapeHtml(group.label)}</h3>
        <div class="ideology-law-filter-items">
          ${items.map((option) => (
            ideologyChoiceToken("ideology-law-group", option.key, option.name_zh || option.label || option.key, state.ideologyLawGroups.has(option.key))
          )).join("")}
        </div>
      </section>
    `;
  }).join("");
}

function sortIdeologyLawGroup(a, b) {
  const aName = a.name_zh || a.name || a.key;
  const bName = b.name_zh || b.name || b.key;
  return orderValue(ideologyLawGroupOrderMap, a.key) - orderValue(ideologyLawGroupOrderMap, b.key)
    || aName.localeCompare(bName, "zh-Hans-CN")
    || a.key.localeCompare(b.key);
}

function ideologyChoiceToken(kind, value, label, checked = false) {
  return `<button class="ideology-choice" type="button" data-filter-token data-${kind}="${escapeHtml(value)}" aria-pressed="${checked ? "true" : "false"}">${escapeHtml(label)}</button>`;
}

function ideologyGroupIconToken(group, checked = false) {
  const label = group.name_zh || group.key;
  return `
    <button class="ideology-group-icon-button" type="button" data-filter-token data-ideology-group="${escapeHtml(group.key)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" aria-pressed="${checked ? "true" : "false"}">
      ${interestGroupIconHtml(group)}
    </button>
  `;
}

function visibleResourceFilterGroups() {
  if (state.view === "company") return resourceFilterGroups;
  const groups = resourceFilterGroups.filter((group) => !group.companyOnly);
  const merged = [];
  const agricultureFilters = [];
  for (const group of groups) {
    if (group.key.startsWith("agriculture")) {
      agricultureFilters.push(...(group.filters || []));
    } else {
      merged.push(group);
    }
  }
  if (agricultureFilters.length) {
    merged.push({ key: "agriculture", filters: agricultureFilters });
  }
  return merged;
}

function renderStrategicRegionGroups(options) {
  const regionsByGroup = new Map(strategicRegionContinentGroups.map((group) => [group.key, []]));
  const otherRegions = [];
  for (const region of options || []) {
    const groupKey = strategicRegionContinentByKey.get(region.key);
    if (groupKey && regionsByGroup.has(groupKey)) regionsByGroup.get(groupKey).push(region);
    else otherRegions.push(region);
  }
  const rows = strategicRegionContinentGroups
    .map((group) => renderStrategicRegionGroupRow(group.name, regionsByGroup.get(group.key)))
    .filter(Boolean);
  if (otherRegions.length) {
    rows.push(renderStrategicRegionGroupRow("其他", otherRegions.sort(sortStrategicRegionRef)));
  }
  els.strategicRegionFilters.innerHTML = rows.join("");
}

function renderGeographicRegionFilterOptions() {
  if (!els.geographicRegionFilters) return;
  const regions = groupedGeographicRegions
    .filter((region) => matchesSearchBlob(geographicRegionSearchBlob(region)))
    .sort(sortGeographicRegions);
  const rows = geographicRegionGroupRows(regions).map((group) => renderGeographicRegionFilterGroupRow(group.label, group.regions));
  els.geographicRegionFilters.innerHTML = rows.join("") || `<p class="empty small-empty">没有匹配地理区域。</p>`;
}

function geographicRegionGroupRows(regions) {
  const byGroup = new Map(geographicRegionGroupOrder.map((key) => [key, []]));
  for (const region of regions || []) {
    const groupKey = region.geographic_region_group || "pending";
    if (!byGroup.has(groupKey)) byGroup.set(groupKey, []);
    byGroup.get(groupKey).push(region);
  }
  return [...byGroup.entries()]
    .map(([key, groupRegions]) => ({
      key,
      label: geographicRegionGroupLabels.get(key) || groupRegions[0]?.geographic_region_group_zh || key,
      regions: groupRegions.sort(sortGeographicRegions),
    }))
    .filter((group) => group.regions.length);
}

function renderGeographicRegionFilterGroupRow(label, regions) {
  if (!(regions || []).length) return "";
  return `
    <div class="filter-row geographic-filter-row">
      <span class="filter-row-label">${escapeHtml(label)}</span>
      <span class="filter-row-items">
        ${regions.map((region) => (
          `<button class="filter-token geographic-filter-token" type="button" data-geographic-region-filter="${escapeHtml(region.key)}" aria-pressed="${String(region.key === state.selectedGeographicRegion)}">
            <span class="filter-token-main">${escapeHtml(geographicRegionDisplayName(region))}</span>
            <span class="filter-token-count">${escapeHtml(String(geographicRegionStateRegions(region).length))}</span>
          </button>`
        )).join("")}
      </span>
    </div>
  `;
}

function renderStrategicRegionGroupRow(label, regions) {
  if (!(regions || []).length) return "";
  return `
    <div class="filter-row filter-group-block">
      <span class="filter-row-label">${escapeHtml(label)}</span>
      <span class="filter-row-items">
        ${regions.map((region) => (
          optionToken("strategic-region", region.key, strategicRegionName(region), state.strategicRegions.has(region.key))
        )).join("")}
      </span>
    </div>
  `;
}

function matchesRefSet(selectedSet, refs) {
  if (selectedSet.size === 0) return true;
  const keys = new Set((refs || []).map((item) => item.key));
  for (const key of selectedSet) {
    if (keys.has(key)) return true;
  }
  return false;
}

function countryTagPills(country) {
  return [
    victorianCenturyBadge(country),
    statusPills(country),
    tagPill(countryTypeTagLabel(country), "tag-type"),
    tagPill(country.tierZh, "tag-tier"),
    groupedTraitPills(country.primaryCultureHeritageGroups, country.primaryCultureHeritages, "tag-heritage-group", "tag-heritage"),
    groupedTraitPills(country.primaryCultureLanguageGroups, country.primaryCultureLanguages, "tag-language-group", "tag-language"),
    refPills(country.primaryCultureTraditions, "tag-tradition"),
    refPills(country.locationStrategicRegions, "tag-region"),
  ].filter(Boolean).join("");
}

function statusPills(country) {
  const pills = [];
  if (country.existsAtStart === "是") pills.push(tagPill("开局", "good"));
  if (country.isReleasable === "是") pills.push(tagPill("释放", "tag-release"));
  if (country.isMajorFormable === "是") pills.push(tagPill("重大统一", "warn"));
  else if (country.isMinorFormable === "是") pills.push(tagPill("次要统一", "warn"));
  if (country.isSpecial === "是") pills.push(tagPill("特殊", "special"));
  if (country.isDualHeritage === "是") pills.push(tagPill("双传承", "tag-dual"));
  return pills.join("");
}

function groupedTraitPills(groups, traits, groupClass, traitClass) {
  const items = [];
  const traitsByGroup = new Map();
  const remaining = [];
  for (const trait of traits || []) {
    if (trait?.group_key) {
      if (!traitsByGroup.has(trait.group_key)) traitsByGroup.set(trait.group_key, []);
      traitsByGroup.get(trait.group_key).push(trait);
    } else if (trait?.key) {
      remaining.push(trait);
    }
  }
  const orderedGroups = [...(groups || [])].sort(groupClass.includes("heritage") ? sortHeritageGroupRef : sortRefByName);
  for (const group of orderedGroups) {
    if (!group?.key) continue;
    items.push(conceptPill({
      label: group.name_zh || group.key,
      className: groupClass,
      title: group.key,
      kind: "cultureTraitGroup",
      key: group.key,
    }));
    for (const trait of traitsByGroup.get(group.key) || []) {
      items.push(conceptPill({
        label: trait.name_zh || trait.key,
        className: traitClass,
        title: trait.key,
        kind: "cultureTrait",
        key: trait.key,
      }));
    }
    traitsByGroup.delete(group.key);
  }
  for (const traits of traitsByGroup.values()) {
    for (const trait of traits) {
      items.push(conceptPill({
        label: trait.name_zh || trait.key,
        className: traitClass,
        title: trait.key,
        kind: "cultureTrait",
        key: trait.key,
      }));
    }
  }
  for (const trait of remaining) {
    items.push(conceptPill({
      label: trait.name_zh || trait.key,
      className: traitClass,
      title: trait.key,
      kind: "cultureTrait",
      key: trait.key,
    }));
  }
  return items.join("");
}

function refPills(items, className) {
  return (items || []).map((item) => refConceptPill(item, className)).join("");
}

function limitedRefPills(items, className, limit = 10) {
  const refs = items || [];
  const visible = refs.slice(0, limit).map((item) => refConceptPill(item, className)).join("");
  const more = refs.length > limit ? tagPill(`另有 ${refs.length - limit} 项`, "tag-more") : "";
  return `${visible}${more}`;
}

function strategicRegionTagPills(region) {
  return [
    victorianCenturyBadge(region),
    limitedRefPills(region.starting_owners, "tag-type", 8),
    limitedRefPills(region.homeland_cultures, "tag-heritage", 10),
  ].filter(Boolean).join("");
}

function geographicRegionTagPills(region) {
  return [
    victorianCenturyBadge(region),
    limitedRefPills(geographicRegionStrategicRegions(region), "tag-region", 6),
    tagPill(`${geographicRegionStateRegions(region).length} 个州地区`, "tag-muted"),
  ].filter(Boolean).join("");
}

function conceptPill({
  label,
  className = "",
  title = "",
  hideNativeTitle = false,
  kind = "",
  key = "",
  href = "",
  search = "",
  html = "",
}) {
  if (!label && !html) return "";
  const classText = className ? ` ${className}` : "";
  const conceptKey = key || label || "";
  const tooltip = title || conceptKey;
  const attrs = [
    `class="pill concept-pill${classText}"`,
    !hideNativeTitle && tooltip && tooltip !== label ? `title="${escapeHtml(tooltip)}"` : "",
    kind ? `data-concept-kind="${escapeHtml(kind)}"` : "",
    conceptKey ? `data-concept-key="${escapeHtml(conceptKey)}"` : "",
    label ? `data-concept-label="${escapeHtml(label)}"` : "",
    search || label || conceptKey ? `data-concept-search="${escapeHtml(search || label || conceptKey)}"` : "",
  ].filter(Boolean).join(" ");
  const content = html || escapeHtml(label);
  if (href) return `<a ${attrs} href="${escapeHtml(href)}">${content}</a>`;
  return `<span ${attrs}>${content}</span>`;
}

function conceptHref(kind, key) {
  if (!key) return "";
  if (kind === "country") return `#/country/${encodeURIComponent(key)}`;
  if (kind === "culture") return `#/culture/${encodeURIComponent(key)}`;
  if (kind === "stateRegion") return `#/state-region/${encodeURIComponent(key)}`;
  if (kind === "strategicRegion") return `#/strategic-region/${encodeURIComponent(key)}`;
  if (kind === "geographicRegion") return `#/geographic-region/${encodeURIComponent(key)}`;
  if (kind === "company") return `#/company/${encodeURIComponent(key)}`;
  if (kind === "ideology") return `#/ideology/${encodeURIComponent(key)}`;
  if (kind === "law") return `#/law/${encodeURIComponent(key)}`;
  if (kind === "religion") return `#/religion/${encodeURIComponent(key)}`;
  return "";
}

function kindFromRef(item) {
  if (item?.tag) return "country";
  if (item?.id?.startsWith("country:")) return "country";
  if (item?.id?.startsWith("culture:")) return "culture";
  if (item?.id?.startsWith("state_region:")) return "stateRegion";
  if (item?.id?.startsWith("strategic_region:")) return "strategicRegion";
  if (item?.id?.startsWith("geographic_region:")) return "geographicRegion";
  if (item?.id?.startsWith("interest_group:")) return "interestGroup";
  if (item?.id?.startsWith("interest_group_trait:")) return "interestGroupTrait";
  if (item?.id?.startsWith("ideology:")) return "ideology";
  if (item?.id?.startsWith("law:")) return "law";
  if (item?.id?.startsWith("culture_trait_group:")) return "cultureTraitGroup";
  if (item?.id?.startsWith("culture_trait:")) return "cultureTrait";
  if (item?.id?.startsWith("building:")) return "building";
  if (item?.id?.startsWith("goods:") || item?.id?.startsWith("prestige_good:")) return "goods";
  if (item?.id?.startsWith("state_trait:")) return "stateTrait";
  return "";
}

function refConceptPill(item, className = "") {
  if (!item) return "";
  const key = item.tag || item.key || "";
  const kind = kindFromRef(item) || inferConceptKind(key);
  const label = kind === "country"
    ? countryRefLabel(item)
    : kind === "strategicRegion"
    ? strategicRegionName(byStrategicRegion.get(key) || item)
    : kind === "geographicRegion"
      ? geographicRegionDisplayName(byGeographicRegion.get(key) || item)
    : item.name_zh || item.key || item.tag || "";
  return conceptPill({
    label,
    className,
    title: key,
    kind,
    key,
    href: conceptHref(kind, key),
  });
}

function inferConceptKind(key) {
  if (!key) return "";
  if (byTag.has(key)) return "country";
  if (byCulture.has(key)) return "culture";
  if (byStateRegion.has(key)) return "stateRegion";
  if (byStrategicRegion.has(key)) return "strategicRegion";
  if (byGeographicRegion.has(key)) return "geographicRegion";
  if (byInterestGroup.has(key)) return "interestGroup";
  if (interestGroupTraitByKey.has(key)) return "interestGroupTrait";
  if (ideologyByKey.has(key)) return "ideology";
  if (cultureTraitByKey.has(key)) return "cultureTrait";
  if (String(key).startsWith("building_")) return "building";
  if (String(key).startsWith("goods_") || String(key).startsWith("prestige_good_")) return "goods";
  return "";
}

function tagPill(label, className = "", title = "") {
  if (!label) return "";
  const titleText = title && title !== label ? ` title="${escapeHtml(title)}"` : "";
  const classText = className ? ` ${className}` : "";
  return `<span class="pill tag-pill${classText}"${titleText}>${escapeHtml(label)}</span>`;
}

function victorianCenturyBadge(item) {
  if (!isVictorianCenturyEntry(item)) return "";
  return tagPill("VC新增/调整", "tag-vc", "Victorian Century 新增或调整的条目");
}

function isVictorianCenturyEntry(item) {
  return ownSourcePaths(item).some((path) => normalizeSourcePath(path).includes(VICTORIAN_CENTURY_SOURCE_MARKER));
}

function ownSourcePaths(item) {
  const source = item?.source || {};
  return [
    item?.source_file,
    item?.sourceFile,
    item?.definitionFile,
    item?.definition_file,
    source.file,
    source.source_file,
    source.definition_file,
    source.definitionFile,
  ].filter(Boolean);
}

function normalizeSourcePath(path) {
  return String(path || "").replaceAll("\\", "/").toLowerCase();
}

function countryTypeTagLabel(country) {
  return countryTypeTagLabels[country.countryType] || country.countryTypeZh || country.countryType || "";
}

function field(label, value) {
  const html = value || `<span class="empty">无</span>`;
  return `<dt>${escapeHtml(label)}</dt><dd>${html}</dd>`;
}

function linkedTerms(keys, names, kind) {
  const links = (keys || []).map((key, index) => {
    if (!key) return "";
    const name = names?.[index] || key;
    const conceptKind = kind === "state-region" ? "stateRegion" : kind;
    return conceptPill({
      label: name,
      kind: conceptKind,
      key,
      title: key,
      href: conceptHref(conceptKind, key) || `#/${kind}/${encodeURIComponent(key)}`,
    });
  }).filter(Boolean);
  return links.length ? `<span class="link-list">${links.join("")}</span>` : "";
}

function countryLinks(tags, names) {
  const links = (tags || []).map((tag, index) => {
    if (!tag) return "";
    return conceptPill({
      label: countryRefLabel({ tag, name_zh: names?.[index] }),
      kind: "country",
      key: tag,
      title: tag,
      href: conceptHref("country", tag),
    });
  }).filter(Boolean);
  return links.length ? `<span class="link-list">${links.join("")}</span>` : "";
}

function cultureLinks(items) {
  const links = (items || []).map((item) => {
    if (!item?.key) return "";
    return refConceptPill(item);
  }).filter(Boolean);
  return links.length ? `<span class="link-list">${links.join("")}</span>` : "";
}

function stateRegionLinks(items) {
  const links = (items || []).map((item) => {
    if (!item?.key) return "";
    return refConceptPill(item);
  }).filter(Boolean);
  return links.length ? `<span class="link-list">${links.join("")}</span>` : "";
}

function countryStartingStateRegionLinks(country) {
  const items = (country?.startingStates || []).map((key) => {
    const stateRegion = byStateRegion.get(key);
    const name = stateRegion?.name_zh || key;
    const suffix = isSplitStartingStateForCountry(stateRegion, country.tag) ? "(分属)" : "";
    return { key, name_zh: `${name}${suffix}`, id: `state_region:${key}` };
  });
  return stateRegionLinks(items);
}

function isSplitStartingStateForCountry(stateRegion, tag) {
  if (!stateRegion || !tag) return false;
  const owners = stateRegion.starting_province_owners || [];
  return owners.length > 1 && owners.some((owner) => owner.tag === tag);
}

function strategicRegionLinks(items) {
  const links = (items || []).map((item) => {
    if (!item?.key) return "";
    const region = byStrategicRegion.get(item.key) || item;
    return refConceptPill({ ...region, id: region.id || `strategic_region:${item.key}` });
  }).filter(Boolean);
  return links.length ? `<span class="link-list">${links.join("")}</span>` : "";
}

function geographicRegionLinks(items) {
  const links = (items || []).map((item) => {
    if (!item?.key) return "";
    const region = byGeographicRegion.get(item.key) || item;
    return refConceptPill({ ...region, id: region.id || `geographic_region:${item.key}` });
  }).filter(Boolean);
  return links.length ? `<span class="link-list">${links.join("")}</span>` : "";
}

function companyAssociationLinks(items) {
  const links = (items || []).map((item) => {
    const company = item.company;
    if (!company?.key) return "";
    const label = company.name_zh || company.key;
    return conceptPill({
      label,
      className: `resource-pill company-link-pill ${item.kind === "special" ? "extension-building-pill" : ""}`,
      title: company.key,
      kind: "company",
      key: company.key,
      href: conceptHref("company", company.key),
      html: `${companyIconHtml(company)}<span>${escapeHtml(label)}</span>`,
    });
  }).filter(Boolean);
  return links.length ? `<span class="link-list company-association-list">${links.join("")}</span>` : "";
}

function companiesForStateRegion(stateRegion) {
  const stateKey = stateRegion?.key || "";
  if (!stateKey) return [];
  return companies.map((company) => {
    const isHeadquarters = (company.preferred_headquarters || []).some((item) => item.key === stateKey);
    const isReferenced = (company.referenced_state_regions || []).some((item) => item.key === stateKey);
    if (!isHeadquarters && !isReferenced) return null;
    return {
      company,
      kind: isHeadquarters ? "headquarters" : "special",
    };
  }).filter(Boolean).sort((a, b) => (
    Number(b.kind === "headquarters") - Number(a.kind === "headquarters")
    || (a.company.name_zh || a.company.key).localeCompare(b.company.name_zh || b.company.key, "zh-Hans-CN")
    || a.company.key.localeCompare(b.company.key)
  ));
}

function sourceSuffix(source) {
  return source ? ` <span class="minor">来源：${escapeHtml(source)}</span>` : "";
}

function listText(values) {
  const items = (values || []).map((item) => {
    const label = typeof item === "string" ? item : item?.name_zh || item?.key || "";
    const title = typeof item === "string" ? "" : item?.key && item.key !== label ? ` title="${escapeHtml(item.key)}"` : "";
    return label ? `<span class="pill"${title}>${escapeHtml(label)}</span>` : "";
  }).filter(Boolean);
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function traitPill(trait) {
  if (!trait?.key) return "";
  return conceptPill({
    label: trait.name_zh || trait.key,
    kind: "cultureTrait",
    key: trait.key,
    title: trait.key,
  });
}

function traitGroupPill(group) {
  if (!group?.key) return "";
  return conceptPill({
    label: group.name_zh || group.key,
    kind: "cultureTraitGroup",
    key: group.key,
    title: group.key,
  });
}

function traitList(traits) {
  const items = (traits || []).map(traitPill).filter(Boolean);
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function traitGroupList(groups) {
  const items = (groups || []).map(traitGroupPill).filter(Boolean);
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function goodsList(goods) {
  const items = (goods || []).map((item) => conceptPill({
    label: item.name_zh || item.key,
    kind: "goods",
    key: item.key,
    title: item.key,
  }));
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function cappedResourceList(resources) {
  const items = (resources || []).map((item) => resourcePill(item, item.amount));
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function discoverableResourceList(resources) {
  const items = (resources || []).map((item) => {
    const amount = item.undiscovered_amount ?? item.discovered_amount ?? item.amount ?? "";
    return resourcePill(item, amount);
  });
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function buildingList(buildings, className = "tag-arable") {
  const items = (buildings || []).map((item) => buildingPill(item, className));
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function resourcePill(item, amount = "") {
  const name = item?.name_zh || item?.key || "";
  const suffix = amount !== "" && amount !== null ? ` · ${escapeHtml(amount)}` : "";
  return conceptPill({
    label: `${name}${amount !== "" && amount !== null ? ` ${amount}` : ""}`,
    className: "resource-pill image-pill",
    title: item?.key || "",
    kind: "building",
    key: item?.key || "",
    html: `${buildingIconHtml(item?.key, name)}<span>${escapeHtml(name)}${suffix}</span>`,
  });
}

function buildingPill(item, className = "") {
  const name = item?.name_zh || item?.key || "";
  const classText = className ? ` ${className}` : "";
  const extensionBadge = className.includes("extension-building-pill") ? `<span class="building-kind-badge">扩展</span>` : "";
  return conceptPill({
    label: name,
    className: `resource-pill image-pill${classText}`,
    title: item?.key || "",
    kind: "building",
    key: item?.key || "",
    html: `${buildingIconHtml(item?.key, name)}${extensionBadge}<span>${escapeHtml(name)}</span>`,
  });
}

function stateTraitPills(traits) {
  const items = (traits || []).map((trait) => (
    tagPill(trait.name_zh || trait.key, trait.has_mapi ? "tag-mapi" : "tag-tradition", trait.key)
  ));
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function stateTraitEffectList(traits) {
  if (!(traits || []).length) {
    return `<p class="empty compact">无地区特质。</p>`;
  }
  return `<div class="rule-list">${traits.map((trait) => `
    <article class="rule-item">
      <div class="trait-card-layout">
        ${traitIconHtml(trait, "state")}
        <div class="trait-card-content">
          <div class="rule-head">
            <strong>${escapeHtml(trait.name_zh || trait.key)}</strong>
            <span class="minor">${escapeHtml(trait.key)}</span>
          </div>
          <dl class="mini-grid">
            ${field("类型", traitCategoryPills(trait.categories))}
            ${field("效果", modifierPills(trait.modifiers))}
            ${field("殖民科技", escapeHtml((trait.required_techs_for_colonization || []).join("、")))}
            ${field("失效科技", escapeHtml((trait.disabling_technologies || []).join("、")))}
          </dl>
        </div>
      </div>
    </article>
  `).join("")}</div>`;
}

function traitCategoryPills(categories) {
  const items = (categories || []).map((category) => tagPill(category.name_zh || category.key, category.key === "mapi" ? "tag-mapi" : "tag-tradition", category.key));
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function modifierPills(modifiers) {
  const items = (modifiers || []).map((modifier) => {
    const title = [modifier.key, modifier.desc_zh].filter(Boolean).join("；");
    return tagPill(modifierSummaryLabel(modifier), modifier.key === "state_market_access_price_impact" ? "tag-mapi" : "tag-effect", title);
  });
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function modifierSummaryLabel(modifier) {
  if (modifier?.key === "state_market_access_price_impact") {
    return `市场接入度的价格影响(MAPI)${modifier?.value_zh ? ` ${modifier.value_zh}` : ""}`;
  }
  return modifier?.summary_zh || modifier?.key || "";
}

function interestGroupFlavorList(groups) {
  const items = (groups || []).filter(Boolean);
  if (!items.length) {
    return `<p class="empty compact">松散政权没有常规利益集团风味数据。</p>`;
  }
  return `<div class="interest-group-list">${items.map(interestGroupFlavorCard).join("")}</div>`;
}

function interestGroupFlavorCard(group) {
  const displayName = interestGroupDisplayName(group);
  const flavoredNameTag = group.display_name?.is_flavored ? tagPill("改名", "tag-ig-changed", group.display_name.key) : "";
  const changedTraits = !sameKeySet(group.base_traits, group.active_traits);
  const changedIdeologies = (group.added_ideologies || []).length || (group.removed_ideologies || []).length;
  return `
    <article id="interest-group-flavor-target-${escapeHtml(group.key)}" class="rule-item interest-group-card interest-group-flavor-target" tabindex="-1" style="${interestGroupStyle(group)}">
      <div class="rule-head interest-group-head">
        <span class="interest-group-title">
          <span class="interest-group-color" aria-hidden="true"></span>
          <strong>${escapeHtml(displayName)}</strong>
          ${!group.display_name?.is_flavored ? `<span class="pill tag-pill tag-muted">基础</span>` : ""}
        </span>
        <span class="minor">${escapeHtml(group.key)}</span>
      </div>
      <dl class="mini-grid interest-group-grid">
        ${flavoredNameTag ? field("风味名", flavoredNameTag) : ""}
        ${field("特质", interestGroupTraitDetailsHtml(group.active_traits, changedTraits))}
        ${field("意识形态", activeIdeologyPills(group))}
        ${changedIdeologies ? field("新增", ideologyPills(group.added_ideologies, "tag-ig-added")) : ""}
        ${changedIdeologies ? field("移除", ideologyPills(group.removed_ideologies, "tag-ig-removed")) : ""}
        ${field("个人意识形态", ideologyPills(group.character_ideologies, "tag-tradition"))}
        ${field("规则", interestGroupRuleSummary(group.applied_rules))}
      </dl>
      ${interestGroupRuleDetails(group.applied_rules)}
    </article>
  `;
}

function interestGroupDisplayName(group) {
  const name = group.display_name?.name_zh || group.name_zh || group.key;
  const baseName = group.name_zh || byInterestGroup.get(group.key)?.name_zh || group.key;
  if (group.display_name?.is_flavored && baseName && baseName !== name) {
    return `${name}（${baseName}）`;
  }
  return name;
}

function interestGroupNamePill(group) {
  const key = group.display_name?.key || group.key;
  const label = interestGroupDisplayName(group);
  return conceptPill({
    label,
    className: group.display_name?.is_flavored ? "tag-ig-changed" : "tag-muted",
    title: key,
    kind: "interestGroup",
    key: group.key,
    search: label,
  });
}

function interestGroupTraitPills(traits, options = {}) {
  const normalizedOptions = typeof options === "string" ? { className: options } : options;
  const items = (traits || []).map((trait, index) => {
    const approval = interestGroupTraitApprovalText(trait);
    const title = [trait.key, approval, trait.modifier_summary_zh, trait.desc_zh].filter(Boolean).join("；");
    const orderedClass = index < 3 ? `tag-ig-trait-${index + 1}` : "tag-effect";
    const classes = [
      normalizedOptions.className || orderedClass,
      normalizedOptions.base ? "tag-base-adopted" : "",
      normalizedOptions.changed ? "tag-changed-outline" : "",
    ].filter(Boolean).join(" ");
    return conceptPill({
      label: trait.name_zh || trait.key,
      className: classes,
      title,
      kind: "interestGroupTrait",
      key: trait.key,
      search: trait.name_zh || trait.key,
    });
  }).filter(Boolean);
  return items.length ? `<span class="link-list">${items.join("")}</span>` : "";
}

function interestGroupTraitDetailsHtml(traits, changed = false) {
  const items = (traits || []).map((trait) => interestGroupTraitDetailCard(trait, changed)).filter(Boolean);
  return items.length ? `<div class="interest-group-trait-list">${items.join("")}</div>` : "";
}

function interestGroupTraitDetailCard(trait, changed = false) {
  if (!trait) return "";
  const approval = interestGroupTraitApprovalText(trait);
  const summary = trait.modifier_summary_zh || "";
  const desc = cleanDescriptionText(trait.desc_zh || "");
  const className = changed ? " interest-group-trait-card-changed" : "";
  return `
    <article class="interest-group-trait-card${className}" data-concept-kind="interestGroupTrait" data-concept-key="${escapeHtml(trait.key || "")}" data-concept-label="${escapeHtml(trait.name_zh || trait.key || "")}" data-concept-search="${escapeHtml(trait.name_zh || trait.key || "")}">
      <div class="trait-card-layout">
        ${traitIconHtml(trait, "interest-group")}
        <div class="trait-card-content">
          <div class="interest-group-trait-head">
            <strong>${escapeHtml(trait.name_zh || trait.key || "")}</strong>
            ${approval ? `<span>${escapeHtml(approval)}</span>` : ""}
          </div>
          ${summary ? `<p>${escapeHtml(summary)}</p>` : ""}
          ${desc ? `<p class="minor">${escapeHtml(desc)}</p>` : ""}
        </div>
      </div>
    </article>
  `;
}

function traitIconHtml(trait, kind) {
  const iconPath = String(trait?.icon || "");
  const fileName = iconPath
    ? iconPath.split(/[\\/]/).at(-1).replace(/\.dds$/i, ".png")
    : String(trait?.key || "").replace(/^ig_trait_/, "").replace(/^state_trait_/, "") + ".png";
  if (!fileName || fileName === ".png") return "";
  const folder = kind === "interest-group" ? "interest-group-traits" : "state-traits";
  const alt = escapeHtml(trait?.name_zh || trait?.key || "特质");
  return `<img class="trait-icon" src="assets/${folder}/${escapeHtml(fileName)}" alt="${alt}" onerror="this.hidden=true">`;
}

function activeIdeologyPills(group) {
  const addedKeys = new Set((group.added_ideologies || []).map((item) => item.key));
  return ideologyPillGroups(group.active_ideologies, (ideology) => (
    addedKeys.has(ideology.key) ? "tag-ig-added" : "tag-muted"
  ));
}

function focusInterestGroupFlavorResult(countryTag, groupKey) {
  requestAnimationFrame(() => {
    const target = document.querySelector(`#interest-group-flavor-target-${CSS.escape(groupKey)}`);
    if (!target || state.selectedTag !== countryTag) return;
    const section = target.closest("details");
    if (section) section.open = true;
    target.scrollIntoView({ block: "center" });
    target.classList.add("interest-group-flavor-focus");
    target.focus({ preventScroll: true });
    window.setTimeout(() => target.classList.remove("interest-group-flavor-focus"), 1800);
  });
}

function ideologyPills(ideologyRefs, className = "tag-ideology") {
  return ideologyPillGroups(ideologyRefs, className);
}

function ideologyPillGroups(ideologyRefs, className = "tag-ideology") {
  const groups = ideologyTypeOptions.map((type) => ({
    ...type,
    items: [...(ideologyRefs || [])]
      .filter((ideology) => ideologyTypeKey(ideologyByKey.get(ideology?.key) || ideology) === type.key)
      .sort(sortRefByName),
  })).filter((type) => type.items.length > 0);
  return groups.map((type) => {
    const items = type.items.map((ideology) => {
      const resolvedClassName = typeof className === "function" ? className(ideology) : className;
      return ideologyPill(ideology, resolvedClassName);
    }).filter(Boolean);
    return `<div class="ideology-pill-group"><span class="ideology-pill-group-label">${escapeHtml(type.label)}：</span><span class="link-list">${items.join("")}</span></div>`;
  }).join("");
}

function ideologyPill(ideology, className = "tag-ideology") {
  if (!ideology?.key) return "";
  const source = ideologyByKey.get(ideology.key) || ideology;
  // 类型标题“运动：”替代了名称后的“(运动)”后缀。
  const label = ideology.name_zh || ideology.key;
  return conceptPill({
    label,
    className: `${className} ideology-tooltip-trigger`.trim(),
    title: ideologyLawStanceTooltip(source),
    hideNativeTitle: true,
    kind: "ideology",
    key: ideology.key,
    search: ideology.name_zh || ideology.key,
    href: conceptHref("ideology", ideology.key),
  });
}

function ideologyRefPill(key, className = "tag-ideology") {
  const ideology = ideologyByKey.get(key) || { key, name_zh: key };
  return ideologyPill(ideology, className);
}

function ideologyLawGroupTooltip(ideology) {
  const groups = ideologyLawGroupNames(ideology);
  return [ideology?.key, groups.length ? `相关法律组：${groups.join("、")}` : ""].filter(Boolean).join("；");
}

function ideologyLawStanceTooltip(ideology) {
  const law = state.detailKind === "law" ? lawByKey.get(state.selectedLaw) : null;
  const stanceLaw = law ? lawByKey.get(lawStanceSourceKey(law)) || law : null;
  const stance = stanceLaw && (ideology?.law_stances || []).find((item) => item.law_key === stanceLaw.key);
  const stanceText = stance ? `对${lawDisplayName(law)}：${lawStanceLabel(stance.stance)}` : "";
  return [ideologyLawGroupTooltip(ideology), stanceText].filter(Boolean).join("；");
}

function ideologyLawGroupNames(ideology) {
  const seen = new Map();
  for (const stance of ideology?.law_stances || []) {
    if (!stance.law_group_key || seen.has(stance.law_group_key)) continue;
    seen.set(stance.law_group_key, stance.law_group_name_zh || stance.law_group_key);
  }
  return [...seen.entries()]
    .sort((a, b) => orderValue(ideologyLawGroupOrderMap, a[0]) - orderValue(ideologyLawGroupOrderMap, b[0]) || a[1].localeCompare(b[1], "zh-Hans-CN"))
    .map(([, name]) => name);
}

function ideologyTypeKey(ideology) {
  const source = fileBaseName(ideology?.source_file);
  if (source === "03_ig_ideologies_movement.txt") return "movement";
  if (source.includes("character")) return "character";
  return "interestGroup";
}

function lawStanceCount(ideology) {
  return (ideology?.law_stances || []).length;
}

function cleanIdeologyDescription(value) {
  return cleanDescriptionText(value);
}

function cleanDescriptionText(value) {
  return String(value || "").replace(/!+$/, "").trim();
}

function ideologyInterestGroupRefs(ideology) {
  const related = relatedIdeologyUsage(ideology);
  const map = new Map();
  for (const group of [...related.baseInterestGroups, ...related.characterInterestGroups]) {
    if (group?.key) map.set(group.key, group);
  }
  for (const country of countries || []) {
    for (const group of country.interestGroups || []) {
      if (!group?.key) continue;
      const hasIdeology = [
        ...(group.active_ideologies || []),
        ...(group.added_ideologies || []),
        ...(group.removed_ideologies || []),
      ].some((item) => item.key === ideology?.key);
      if (hasIdeology) map.set(group.key, byInterestGroup.get(group.key) || group);
    }
  }
  return [...map.values()].filter((group) => group?.key);
}

function ideologyOccurrenceRefs(ideology) {
  const keys = new Set();
  const related = relatedIdeologyUsage(ideology);
  const file = fileBaseName(ideology?.source_file).toLowerCase();
  if (related.baseInterestGroups.length || related.characterInterestGroups.length) keys.add("default");
  if ((related.flavorUsage || []).length || file.includes("flavor") || file.includes("event")) keys.add("flavor");
  if (file.includes("tech") || file.includes("technology") || (ideology.unlock_technologies || []).length) keys.add("technology");
  if (file.includes("journal") || (ideology.unlock_journal_entries || []).length) keys.add("journal");
  return [...keys].map((key) => ({ key, name_zh: ideologyOccurrenceOptions.find((item) => item.key === key)?.label || key }));
}

function ideologyLawGroupRefs(ideology) {
  const map = new Map();
  for (const stance of ideology?.law_stances || []) {
    if (!stance.law_group_key || map.has(stance.law_group_key)) continue;
    map.set(stance.law_group_key, {
      key: stance.law_group_key,
      name_zh: stance.law_group_name_zh || stance.law_group_key,
    });
  }
  return [...map.values()].sort(sortIdeologyLawGroup);
}

function lawStanceGroupsHtml(ideology) {
  const groups = groupLawStances(ideology?.law_stances || []);
  if (!groups.length) return `<p class="empty compact">没有法律态度数据。</p>`;
  return `<div class="vic3-law-groups">${groups.map((group) => `
    <section class="vic3-law-group">
      <h3>对${escapeHtml(group.name)}的态度</h3>
      <div class="vic3-law-lines">
        ${lawAttitudeLinesHtml(group.items)}
      </div>
    </section>
  `).join("")}</div>`;
}

function groupLawStances(stances) {
  const groups = new Map();
  for (const stance of stances || []) {
    const key = stance.law_group_key || "";
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: stance.law_group_name_zh || key || "未分组",
        items: [],
      });
    }
    groups.get(key).items.push(stance);
  }
  return [...groups.values()].sort((a, b) => sortIdeologyLawGroup(a, b));
}

function lawStanceChip(stance) {
  const name = stance.law_name_zh || stance.law_key || "";
  const stanceLabel = lawStanceLabel(stance.stance);
  const className = `law-pill ${lawStanceClassName(stance.stance)}`;
  return conceptPill({
    label: `${name} ${stanceLabel}`,
    className,
    title: [stance.law_key, stance.stance].filter(Boolean).join("；"),
    kind: "law",
    key: stance.law_key,
    search: name,
    html: `<span class="law-name">${escapeHtml(name)}</span><span class="law-stance-label">${escapeHtml(stanceLabel)}</span>`,
  });
}

function lawAttitudeLinesHtml(stances) {
  const grouped = new Map();
  for (const stance of stances || []) {
    const key = stance.stance || "neutral";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(stance);
  }
  return lawStanceDisplayOrder
    .filter((stance) => grouped.has(stance))
    .map((stance) => {
      const items = grouped.get(stance).sort((a, b) => (
        (a.law_name_zh || a.law_key || "").localeCompare(b.law_name_zh || b.law_key || "", "zh-Hans-CN")
      ));
      const names = items.map((item) => item.law_name_zh || item.law_key).filter(Boolean).join("、");
      return `
        <div class="vic3-law-line ${lawStanceClassName(stance)}">
          <span>${escapeHtml(lawStanceSentencePrefix(stance))} </span>${escapeHtml(names)}
        </div>
      `;
    }).join("");
}

function lawStanceSentencePrefix(stance) {
  return {
    strongly_disapprove: "坚决反对",
    disapprove: "反对",
    neutral: "不在意",
    approve: "支持",
    strongly_approve: "坚决支持",
  }[stance] || lawStanceLabel(stance);
}

function ideologyUnlockTagsHtml(ideology) {
  const tags = [
    ...(ideology.unlock_technologies || []).map((item) => conceptPill({
      label: `科技：${item.name_zh || item.key}`,
      className: "tag-technology",
      title: item.key,
      key: item.key,
      search: item.name_zh || item.key,
    })),
    ...(ideology.unlock_journal_entries || []).map((item) => conceptPill({
      label: `日志：${item.name_zh || item.key}`,
      className: "tag-journal",
      title: item.key,
      key: item.key,
      search: item.name_zh || item.key,
    })),
  ].filter(Boolean);
  if (!tags.length) return "";
  return `
    <div class="ideology-unlock-tags" aria-label="解锁来源">
      ${tags.join("")}
    </div>
  `;
}

function ideologyRuleSourceLabel(ideology) {
  const sources = uniqueUnlockSourceRows(ideology.unlock_sources || []);
  if (!sources.length) return "";
  return `
    <section class="vic3-special-usage ideology-source-usage">
      <h3>来源</h3>
      <dl class="field-grid">
        ${sources.slice(0, 12).map((source) => field(ideologySourceKindLabel(source.kind), ideologySourceText(source))).join("")}
      </dl>
    </section>
  `;
}

function uniqueUnlockSourceRows(sources) {
  const seen = new Set();
  const result = [];
  for (const source of sources || []) {
    const key = [source.kind, source.source_key, source.source_file, source.condition_summary_zh].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(source);
  }
  return result;
}

function ideologySourceKindLabel(kind) {
  return {
    interest_group_flavor: "风味规则",
    political_movement: "政治运动",
    event_or_journal: "事件/日志",
  }[kind] || "来源";
}

function ideologySourceText(source) {
  const parts = [
    source.source_name_zh && source.source_name_zh !== source.source_key ? `${source.source_name_zh}（${source.source_key}）` : source.source_key,
    ideologyUnlockRefsText(source.technologies, "科技"),
    ideologyUnlockRefsText(source.journal_entries, "日志"),
    source.condition_summary_zh && source.condition_summary_zh !== "脚本条件" ? source.condition_summary_zh : "",
    fileBaseName(source.source_file),
  ].filter(Boolean);
  return escapeHtml(parts.join("；"));
}

function ideologyUnlockRefsText(items, label) {
  if (!(items || []).length) return "";
  return `${label}：${(items || []).map((item) => item.name_zh || item.key).join("、")}`;
}

function ideologyReplacementUsageHtml(related) {
  const rows = (related?.flavorUsage || [])
    .map((rule) => field(ideologyFlavorUsageLabel(rule), ideologyFlavorUsageValue(rule)))
    .filter(Boolean);
  if (!rows.length) return "";
  return `
    <section class="vic3-special-usage ideology-replacement-usage">
      <h3>出现和替换</h3>
      <dl class="field-grid">${rows.join("")}</dl>
    </section>
  `;
}

function ideologyFlavorUsageLabel(rule) {
  if (rule.kind === "added") return "风味·新增";
  if (rule.kind === "removed") return "风味·移除";
  if (rule.kind === "replaces") {
    return "风味·替换";
  }
  if (rule.kind === "replaced_by") {
    return "风味：替换为";
  }
  return "风味";
}

function ideologyFlavorUsageValue(rule) {
  const refs = [];
  if (rule.kind === "replaces" && rule.ideologyKey) refs.push(ideologyRefPill(rule.ideologyKey, "tag-ig-removed"));
  if (rule.kind === "replaced_by" && rule.ideologyKey) refs.push(ideologyRefPill(rule.ideologyKey, "tag-ig-added"));
  const countryHtml = fullCountryLinks(rule.countries);
  const ideologyHtml = refs.length ? `<span class="link-list">${refs.join("")}</span>` : "";
  return [ideologyHtml, countryHtml].filter(Boolean).join("");
}

function ideologyFlavorDefinitionHtml(ideology) {
  if (ideology?.flavor_definition_status !== "unassigned") return "";
  return `
    <section class="vic3-special-usage ideology-flavor-definition">
      <h3>风味定义</h3>
      <p>${escapeHtml(ideology.flavor_definition_note_zh || "风味意识形态定义；当前脚本未分配给任何利益集团。")}</p>
      <dl class="field-grid">
        ${field("状态", tagPill("未分配", "tag-muted"))}
        ${field("文件", escapeHtml(fileBaseName(ideology.source_file)))}
      </dl>
    </section>
  `;
}

function ideologyWeightSectionHtml(ideology) {
  const requirements = ideology.character_requirements || {};
  const leaderWeight = ideology.interest_group_leader_weight;
  const nonLeaderWeight = ideology.non_interest_group_leader_weight;
  if (!requirements.country && !requirements.interest_group_leader && !requirements.non_interest_group_leader && !leaderWeight && !nonLeaderWeight) return "";
  const sections = [
    weightRequirementHtml("国家要求", requirements.country),
    weightRequirementHtml("领袖要求", requirements.interest_group_leader),
    weightRequirementHtml("非领袖要求", requirements.non_interest_group_leader),
    weightListHtml("领袖权重", leaderWeight),
    weightListHtml("非领袖权重", nonLeaderWeight),
  ].filter(Boolean).join("");
  return `
    <details class="collapsible-detail-section ideology-weight-section">
      <summary><span>角色权重</span><small>要求与权重修正</small></summary>
      <div class="collapsible-detail-body ideology-weight-body">
        ${sections}
      </div>
    </details>
  `;
}

function weightRequirementHtml(label, requirement) {
  if (!requirement) return "";
  return `
    <section class="ideology-weight-group">
      <h3>${escapeHtml(label)}</h3>
      <p>${escapeHtml(requirement.summary_zh || "脚本条件")}</p>
      ${conditionRefPills(requirement)}
      ${rawDetails("条件脚本", requirement.raw)}
    </section>
  `;
}

function weightListHtml(label, weight) {
  const entries = weight?.entries || [];
  if (!entries.length) return "";
  return `
    <section class="ideology-weight-group">
      <h3>${escapeHtml(label)}</h3>
      <div class="ideology-weight-list">
        ${entries.map(weightEntryHtml).join("")}
      </div>
    </section>
  `;
}

function weightEntryHtml(entry) {
  const label = entry.kind === "multiply"
    ? `乘数 ${formatWeightValue(entry.value)}`
    : entry.condition_summary_zh
      ? `${entry.kind === "base" ? "基础" : "加值"} ${formatSignedWeight(entry.value)}`
      : `基础 ${formatWeightValue(entry.value)}`;
  const refs = conditionRefPills(entry);
  return `
    <article class="ideology-weight-entry">
      <div class="ideology-weight-entry-head">
        <strong>${escapeHtml(label)}</strong>
        ${entry.desc ? `<span>${escapeHtml(weightDescLabel(entry.desc))}</span>` : ""}
      </div>
      ${entry.condition_summary_zh ? `<p>${escapeHtml(entry.condition_summary_zh)}</p>` : ""}
      ${refs}
      ${rawDetails("条件脚本", entry.condition_raw)}
    </article>
  `;
}

function conditionRefPills(condition) {
  const parts = [
    refItemsPills(condition.interest_groups, "interestGroup", "tag-ig-changed"),
    refItemsPills(condition.laws, "law", "tag-law"),
    refItemsPills(condition.technologies, "", "tag-technology"),
    refItemsPills(condition.journal_entries, "", "tag-journal"),
    refItemsPills(condition.traits, "trait", "tag-tradition"),
  ].filter(Boolean);
  return parts.length ? `<div class="ideology-weight-refs">${parts.join("")}</div>` : "";
}

function refItemsPills(items, kind, className) {
  const pills = (items || []).map((item) => conceptPill({
    label: item.name_zh || item.key,
    className,
    title: item.key,
    kind,
    key: item.key,
    href: conceptHref(kind, item.key),
  })).filter(Boolean);
  return pills.length ? `<span class="link-list">${pills.join("")}</span>` : "";
}

function formatSignedWeight(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value || "");
  return number > 0 ? `+${number}` : String(number);
}

function formatWeightValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : String(value || "");
}

function weightDescLabel(desc) {
  if (desc === "base_value") return "基础值";
  return desc || "";
}

function lawStanceLabel(stance) {
  return lawStanceLabels[stance] || stance || "";
}

function lawStanceClassName(stance) {
  return {
    strongly_approve: "stance-strongly-approve",
    approve: "stance-approve",
    neutral: "stance-neutral",
    disapprove: "stance-disapprove",
    strongly_disapprove: "stance-strongly-disapprove",
  }[stance] || "stance-neutral";
}

function relatedIdeologyUsage(ideology) {
  const key = ideology?.key || "";
  const baseInterestGroups = [];
  const characterInterestGroups = [];
  const activeCountries = new Map();
  const addedCountries = new Map();
  const removedCountries = new Map();
  const flavorUsage = new Map();
  if (!key) {
    return { baseInterestGroups, characterInterestGroups, activeCountries: [], addedCountries: [], removedCountries: [], flavorUsage: [] };
  }
  if (ideologyUsageCache.has(key)) return ideologyUsageCache.get(key);
  for (const group of interestGroups || []) {
    if ((group.ideologies || []).some((item) => item.key === key)) baseInterestGroups.push(group);
    if ((group.character_ideologies || []).some((item) => item.key === key)) characterInterestGroups.push(group);
  }
  for (const country of countries || []) {
    for (const group of country.interestGroups || []) {
      if ((group.active_ideologies || []).some((item) => item.key === key)) activeCountries.set(country.tag, country);
      if ((group.added_ideologies || []).some((item) => item.key === key)) addedCountries.set(country.tag, country);
      if ((group.removed_ideologies || []).some((item) => item.key === key)) removedCountries.set(country.tag, country);
      classifyFlavorIdeologyUsage(key, group, country, flavorUsage);
    }
  }
  const result = {
    baseInterestGroups: baseInterestGroups.sort(sortRefByName),
    characterInterestGroups: characterInterestGroups.sort(sortRefByName),
    activeCountries: [...activeCountries.values()].sort(sortCountriesByTag),
    addedCountries: [...addedCountries.values()].sort(sortCountriesByTag),
    removedCountries: [...removedCountries.values()].sort(sortCountriesByTag),
    flavorUsage: [...flavorUsage.values()].map((rule) => ({
      ...rule,
      countries: [...rule.countries.values()].sort(sortCountriesByTag),
    })).sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN")),
  };
  ideologyUsageCache.set(key, result);
  return result;
}

function classifyFlavorIdeologyUsage(key, group, country, out) {
  for (const rule of group.applied_rules || []) {
    const added = rule.added_ideologies || [];
    const removed = rule.removed_ideologies || [];
    if (!added.length && !removed.length) continue;
    const pairedAddedKeys = new Set();
    const pairedRemovedKeys = new Set();
    for (const addedIdeology of added) {
      for (const removedIdeology of removed) {
        if (!sharedIdeologyLawGroupKeys(addedIdeology.key, removedIdeology.key).length) continue;
        pairedAddedKeys.add(addedIdeology.key);
        pairedRemovedKeys.add(removedIdeology.key);
        if (addedIdeology.key === key) {
          addIdeologyFlavorUsage(out, {
            kind: "replaces",
            ideologyKey: removedIdeology.key,
            ideologyName: removedIdeology.name_zh || removedIdeology.key,
            country,
          });
        }
        if (removedIdeology.key === key) {
          addIdeologyFlavorUsage(out, {
            kind: "replaced_by",
            ideologyKey: addedIdeology.key,
            ideologyName: addedIdeology.name_zh || addedIdeology.key,
            currentKey: removedIdeology.key,
            currentName: removedIdeology.name_zh || removedIdeology.key,
            country,
          });
        }
      }
    }
    for (const addedIdeology of added) {
      if (addedIdeology.key === key && !pairedAddedKeys.has(addedIdeology.key)) {
        addIdeologyFlavorUsage(out, {
          kind: "added",
          country,
        });
      }
    }
    for (const removedIdeology of removed) {
      if (removedIdeology.key === key && !pairedRemovedKeys.has(removedIdeology.key)) {
        addIdeologyFlavorUsage(out, {
          kind: "removed",
          country,
        });
      }
    }
  }
}

function sharedIdeologyLawGroupKeys(leftKey, rightKey) {
  const left = new Set(((ideologyByKey.get(leftKey)?.law_stances) || []).map((stance) => stance.law_group_key).filter(Boolean));
  const right = new Set(((ideologyByKey.get(rightKey)?.law_stances) || []).map((stance) => stance.law_group_key).filter(Boolean));
  return [...left].filter((key) => right.has(key));
}

function addIdeologyFlavorUsage(out, rule) {
  const label = [rule.kind, rule.ideologyKey || "", rule.currentKey || ""].join(":");
  if (!out.has(label)) {
    out.set(label, {
      label,
      kind: rule.kind,
      ideologyKey: rule.ideologyKey,
      ideologyName: rule.ideologyName,
      currentKey: rule.currentKey,
      currentName: rule.currentName,
      countries: new Map(),
    });
  }
  if (rule.country?.tag) out.get(label).countries.set(rule.country.tag, rule.country);
}

function interestGroupRefPills(groups, className = "") {
  const pills = (groups || []).map((group) => conceptPill({
    label: group.name_zh || group.key,
    className,
    title: group.key,
    kind: "interestGroup",
    key: group.key,
    search: group.name_zh || group.key,
  })).filter(Boolean);
  return pills.length ? `<span class="link-list">${pills.join("")}</span>` : "";
}

function limitedCountryLinks(items, limit = 36) {
  const countriesToShow = (items || []).slice(0, limit);
  const links = countriesToShow.map((country) => conceptPill({
    label: countryRefLabel(country),
    kind: "country",
    key: country.tag,
    title: country.tag,
    href: conceptHref("country", country.tag),
  })).join("");
  const more = (items || []).length > limit ? tagPill(`另有 ${(items || []).length - limit} 个国家`, "tag-more") : "";
  return links || more ? `<span class="link-list">${links}${more}</span>` : "";
}

function fullCountryLinks(items) {
  const links = (items || []).map((country) => conceptPill({
    label: countryRefLabel(country),
    kind: "country",
    key: country.tag,
    title: country.tag,
    href: conceptHref("country", country.tag),
  })).join("");
  return links ? `<span class="link-list full-link-list">${links}</span>` : "";
}

function interestGroupRuleSummary(rules) {
  const names = unique((rules || []).flatMap((rule) => [
    ...(rule.names || []).map((item) => item.name_zh || item.key),
    ...(rule.traits || []).map((item) => item.name_zh || item.key),
    ...(rule.added_ideologies || []).map((item) => item.name_zh || item.key),
  ]).filter(Boolean));
  if (!names.length) return tagPill("基础默认", "tag-muted");
  return tagPill(`${rules.length} 条匹配规则`, "tag-special", names.join("；"));
}

function interestGroupRuleDetails(rules) {
  if (!(rules || []).length) return "";
  return `
    <details class="script-details interest-group-rule-details">
      <summary>匹配规则</summary>
      <div class="interest-group-rule-list">
        ${rules.map((rule) => `
          <section class="interest-group-rule">
            <div class="minor">${escapeHtml(rule.condition_summary_zh || "默认")}</div>
            <dl class="mini-grid">
              ${field("名称", interestGroupEffectRefPills(rule.names, "interestGroup", "tag-ig-changed"))}
              ${field("特质", interestGroupEffectRefPills(rule.traits, "interestGroupTrait", "tag-changed-outline"))}
              ${field("新增", interestGroupEffectRefPills(rule.added_ideologies, "ideology", "tag-ig-added"))}
              ${field("移除", interestGroupEffectRefPills(rule.removed_ideologies, "ideology", "tag-ig-removed"))}
            </dl>
            ${rawDetails("条件脚本", rule.condition_raw)}
          </section>
        `).join("")}
      </div>
    </details>
  `;
}

function interestGroupEffectRefPills(items, kind, className) {
  const pills = (items || []).map((item) => conceptPill({
    label: item.name_zh || item.key,
    className,
    title: item.key,
    kind,
    key: item.key,
    href: conceptHref(kind, item.key),
  })).filter(Boolean);
  return pills.length ? `<span class="link-list">${pills.join("")}</span>` : "";
}

function interestGroupTraitApprovalText(trait) {
  const parts = [];
  if (trait?.min_approval) parts.push(`最低支持：${trait.min_approval}`);
  if (trait?.max_approval) parts.push(`最高支持：${trait.max_approval}`);
  return parts.join("；");
}

function sameKeySet(left, right) {
  const leftKeys = (left || []).map((item) => item.key).filter(Boolean).sort();
  const rightKeys = (right || []).map((item) => item.key).filter(Boolean).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index]);
}

function interestGroupStyle(group) {
  const hex = byInterestGroup.get(group?.key)?.color?.hex || group?.color?.hex || "";
  return hex ? `--interest-group-color:${escapeHtml(hex)}` : "";
}

function stateRegionTagPills(stateRegion) {
  return [
    victorianCenturyBadge(stateRegion),
    refPills(stateRegion.strategic_regions, "tag-region"),
    stateRegionMapiPill(stateRegion),
    refPills(stateRegion.traits, "tag-tradition"),
  ].filter(Boolean).join("");
}

function stateRegionMapiPill(stateRegion) {
  const values = unique((stateRegion.traits || [])
    .filter((trait) => trait.has_mapi)
    .map((trait) => trait.mapi_value_zh)
    .filter(Boolean));
  if (!values.length) return "";
  return tagPill(`MAPI ${values.join("/")}`, "tag-mapi", "MAPI");
}

function companyKindText(company) {
  return company.company_kind_zh || companyKindLabels.get(companyKindKey(company)) || "通用公司";
}

function companyKindKey(company) {
  if (company?.company_kind) return company.company_kind;
  if (company?.key === "company_paradox") return "easter_egg";
  return company?.flavored_company ? "historical" : "generic";
}

function prestigeGoodsKindKey(company) {
  if (company?.prestige_goods_kind) return company.prestige_goods_kind;
  const goods = company?.possible_prestige_goods || [];
  const hasGeneric = goods.some((item) => String(item?.key || "").startsWith("prestige_good_generic_"));
  const hasSpecial = goods.some((item) => item?.key && !String(item.key).startsWith("prestige_good_generic_"));
  if (!goods.length) return "none";
  if (hasGeneric && hasSpecial) return "mixed";
  if (hasGeneric) return "generic_only";
  return "special_only";
}

function companyDlcKey(company) {
  return company?.dlc_key || "base";
}

function companyDlcLabel(company) {
  return company?.dlc_name_en || company?.dlc_name_zh || companyDlcLabels.get(companyDlcKey(company)) || companyDlcKey(company);
}

function companyPrestigeLabel(company) {
  const label = company?.prestige_goods_kind_zh || companyPrestigeLabels.get(prestigeGoodsKindKey(company)) || "";
  return label.replace(/^仅(?=通用名贵商品|特殊名贵商品)/, "");
}

function companyTagPills(company) {
  return [
    victorianCenturyBadge(company),
    limitedRefPills(company.referenced_strategic_regions, "tag-region", 4),
    limitedRefPills(company.referenced_geographic_regions, "tag-region", 3),
    tagPill(company.category_zh || company.category, "tag-tier", company.category),
    companyKindKey(company) === "easter_egg" ? tagPill(companyKindText(company), "tag-special") : "",
  ].filter(Boolean).join("");
}

function companyMetaLine(company) {
  return [
    company.preferred_headquarters?.length ? `总部倾向：${refNames(company.preferred_headquarters, " / ")}` : "",
    company.referenced_cultures?.length ? `限定文化：${refNames(company.referenced_cultures, " / ")}` : "",
  ].filter(Boolean).join("；");
}

function companyDlcIconPill(company) {
  if (companyDlcKey(company) === "base") return "";
  const option = companyDlcOptions.find((item) => item.key === companyDlcKey(company));
  if (!option) return tagPill(companyDlcLabel(company), "tag-dlc");
  return `<span class="pill tag-pill tag-dlc company-dlc-pill" title="${escapeHtml(companyDlcLabel(company))}">${dlcIconHtml(option)}</span>`;
}

function companyPrestigeGoodsPills(company) {
  if (!(company.possible_prestige_goods || []).length) return "";
  return limitedHtmlItems((company.possible_prestige_goods || []).map((item) => companyPrestigeGoodPill(item)), 3);
}

function companyPrestigeGoodPill(item) {
  if (!item) return "";
  const key = item.key || "";
  const label = item.name_zh || key;
  return conceptPill({
    label,
    className: "tag-good prestige-good-pill",
    title: key,
    kind: "goods",
    key,
    html: `${goodsIconHtml(item, "prestige-good-icon")}<span>${escapeHtml(label)}</span>`,
  });
}

function goodsIconHtml(item, className = "prestige-good-icon") {
  const label = item?.name_zh || item?.key || "";
  const path = prestigeGoodIconPath(item?.key || "");
  if (!path) return "";
  return `<img class="${escapeHtml(className)}" src="${path}" alt="" title="${escapeHtml(label)}">`;
}

function prestigeGoodIconPath(key) {
  if (!key) return "";
  const override = prestigeGoodIconOverrides.get(key);
  const base = String(key).replace(/^prestige_good_/, "");
  const fileName = override || `${base}_prestige.png`;
  return `assets/prestige-goods/${encodeURIComponent(fileName)}`;
}

function companyBuildingStrip(company) {
  const main = (company.building_types || []).map((item) => companyBuildingPill(item));
  const extension = (company.extension_building_types || []).map((item) => companyBuildingPill(item, "extension-building-pill"));
  if (!main.length && !extension.length) return "";
  const separator = main.length && extension.length ? `<span class="company-building-separator" aria-hidden="true"></span>` : "";
  return `${main.join("")}${separator}${extension.join("")}`;
}

function companyBuildingPill(item, className = "") {
  const name = item?.name_zh || item?.key || "";
  if (!name) return "";
  const classText = className ? ` ${className}` : "";
  return conceptPill({
    label: name,
    className: `resource-pill image-pill company-building-pill${classText}`,
    title: item?.key || "",
    kind: "building",
    key: item?.key || "",
    html: buildingIconHtml(item?.key, name),
  });
}

function resourceSummaryPills(stateRegion) {
  const resourcePills = [
    ...(stateRegion.capped_resources || []).map((item) => resourcePill(item, item.amount)),
    ...(stateRegion.discoverable_resources || []).map((item) => {
      const amount = item.undiscovered_amount ?? item.discovered_amount ?? item.amount ?? "";
      return resourcePill(item, amount);
    }),
  ];
  return limitedHtmlItems(resourcePills, 6);
}

function agricultureSummaryPills(stateRegion) {
  const arableResources = (stateRegion.arable_resources || []).map((item) => buildingPill(item, "tag-arable"));
  return limitedHtmlItems(arableResources, 8);
}

function stateRegionBuildingStrip(stateRegion) {
  const resources = [
    ...(stateRegion.capped_resources || []).map((item) => buildingChip(item, item.amount, "resource-chip")),
    ...(stateRegion.discoverable_resources || []).map((item) => {
      const amount = item.undiscovered_amount ?? item.discovered_amount ?? item.amount ?? "";
      return buildingChip(item, amount, "resource-chip discoverable-chip");
    }),
  ];
  const agriculture = (stateRegion.arable_resources || []).map((item) => buildingChip(item, "", "resource-chip arable-chip"));
  const items = [...resources, ...agriculture].filter(Boolean);
  return items.length ? items.join("") : "";
}

function buildingChip(item, amount = "", className = "") {
  const name = item?.name_zh || item?.key || "";
  const count = amount !== "" && amount !== null ? `<span class="building-chip-count">${escapeHtml(amount)}</span>` : "";
  const titleParts = [name, item?.key && item.key !== name ? item.key : "", amount !== "" && amount !== null ? String(amount) : ""].filter(Boolean);
  const title = titleParts.length ? ` title="${escapeHtml(titleParts.join(" · "))}"` : "";
  const classText = className ? ` ${className}` : "";
  return `<span class="building-chip${classText}"${title} data-concept-kind="building" data-concept-key="${escapeHtml(item?.key || name)}" data-concept-label="${escapeHtml(name)}" data-concept-search="${escapeHtml(name)}">${buildingIconHtml(item?.key, name)}${count}</span>`;
}

function limitedHtmlItems(items, limit) {
  const filtered = (items || []).filter(Boolean);
  if (filtered.length <= limit) return filtered.join("");
  return `${filtered.slice(0, limit).join("")}${tagPill(`另有 ${filtered.length - limit} 项`, "tag-more")}`;
}

function sameTraditionCultures(traditions, groups) {
  const blocks = (traditions || []).map((tradition) => {
    const related = groups?.[tradition.key] || [];
    if (!related.length) return "";
    return `
      <div class="inline-block">
        <span class="minor">${escapeHtml(tradition.name_zh)}</span>
        ${cultureLinks(related)}
      </div>
    `;
  }).filter(Boolean);
  return blocks.length ? blocks.join("") : "";
}

function dynamicNameList(country) {
  if (!(country.dynamicNameVariants || []).length) {
    return `<p class="empty compact">无专属国名变体。</p>`;
  }
  return `<div class="rule-list">${country.dynamicNameVariants.map((variant) => `
    <article class="rule-item">
      <div class="rule-head">
        <strong>${escapeHtml(variant.name_zh || variant.name_key)}</strong>
        <span class="minor">${escapeHtml(variant.name_key)}</span>
      </div>
      <dl class="mini-grid">
        ${field("形容词", escapeHtml(variant.adjective_zh || variant.adjective_key || ""))}
        ${field("优先级", escapeHtml(variant.priority || "0"))}
        ${field("革命名", escapeHtml(variant.is_revolutionary))}
        ${field("引用", refsText(variant))}
      </dl>
      ${rawDetails("条件脚本", variant.trigger_raw)}
    </article>
  `).join("")}</div>`;
}

function dynamicStateNameList(stateRegion) {
  const variants = visibleDynamicStateNameVariants(stateRegion);
  if (!variants.length) {
    return `<p class="empty compact">无地区名称变体。</p>`;
  }
  return `<div class="rule-list">${variants.map((variant) => `
    <article class="rule-item">
      <div class="rule-head">
        <strong>${escapeHtml(variant.name_zh || variant.name_key)}</strong>
        <span class="minor">${escapeHtml(variant.name_key)}</span>
      </div>
      <dl class="mini-grid">
        ${field("采用名称", escapeHtml(variant.name_zh || variant.name_key || ""))}
        ${field("来源", escapeHtml(fileBaseName(variant.source_file)))}
      </dl>
      ${rawDetails("采用条件", variant.trigger_raw)}
    </article>
  `).join("")}</div>`;
}

function dynamicMapColorList(country) {
  if (!(country.dynamicMapColorRules || []).length) {
    return `<p class="empty compact">无专属特殊地图色。</p>`;
  }
  return `<div class="rule-list">${country.dynamicMapColorRules.map((rule) => `
    <article class="rule-item color-rule">
      <div class="rule-head">
        <span class="color-name">
          <span class="country-color" style="${colorStyle(rule.color_hex)}" aria-hidden="true"></span>
          <strong>${escapeHtml(rule.key)}</strong>
        </span>
        <span class="minor">${escapeHtml(rule.color_key)} ${escapeHtml(rule.color_hex)}</span>
      </div>
      <dl class="mini-grid">
        ${field("颜色", colorValue(rule.color_hex, splitNumbers(rule.color_rgb)))}
        ${field("引用", refsText(rule))}
      </dl>
      ${rawDetails("条件脚本", rule.possible_raw)}
    </article>
  `).join("")}</div>`;
}

function countryFlagVariantSection(country) {
  const flagInfo = countryFlagData[country?.tag];
  const variants = flagInfo?.variants || [];
  if (!variants.length) return "";
  const body = `
    <div class="country-flag-variant-grid">
      ${variants.map((variant) => `
        <article class="country-flag-variant-card">
          <img class="country-flag-variant-image" src="${escapeHtml(variant.image)}" alt="${escapeHtml(countryFlagVariantAlt(country, variant))}">
          <div class="country-flag-variant-body">
            <div class="rule-head country-flag-variant-head">
              <strong>${escapeHtml(variant.key)}</strong>
              <span class="tag">${escapeHtml(variant.exportKey || variant.key)}</span>
            </div>
            <dl class="mini-grid country-flag-variant-meta">
              ${field("优先级", escapeHtml(String(variant.priority ?? 0)))}
              ${field("触发", escapeHtml(variant.triggerSummary || "默认候选"))}
              ${field("附属旗角", escapeHtml(variant.subjectCanton || ""))}
              ${field("领主旗角", escapeHtml(flagYesNo(variant.allowOverlordCanton)))}
            </dl>
            ${rawDetails("触发条件", variant.triggerRaw)}
          </div>
        </article>
      `).join("")}
    </div>
  `;
  return collapsibleDetailSection("国旗变体", body, `${variants.length} 种`);
}

function countryFlagVariantAlt(country, variant) {
  const name = country?.name || country?.tag || "国家";
  return `${name} ${variant.key || variant.exportKey || "国旗"}`;
}

function flagYesNo(value) {
  if (value === "yes") return "是";
  if (value === "no") return "否";
  return "";
}

function refsText(rule) {
  const parts = [];
  if (rule.referenced_tags) parts.push(`国家：${rule.referenced_tags}`);
  if (rule.referenced_cultures) parts.push(`文化：${rule.referenced_cultures}`);
  if (rule.referenced_laws) parts.push(`法律：${rule.referenced_laws}`);
  if (rule.referenced_journal_entries) parts.push(`日志：${rule.referenced_journal_entries}`);
  if (rule.referenced_variables) parts.push(`变量：${rule.referenced_variables}`);
  return parts.length ? escapeHtml(parts.join("；")) : "";
}

function rawDetails(label, value) {
  if (!value) return "";
  return `
    <details class="script-details">
      <summary>${escapeHtml(label)}</summary>
      <pre>${escapeHtml(value)}</pre>
    </details>
  `;
}

function lawIconHtml(law, className = "law-icon") {
  const baseName = fileBaseName(law?.icon).replace(/\.dds$/i, "");
  if (!baseName) return "";
  const alt = escapeHtml(law?.name_zh || law?.key || "法律");
  return webpPictureHtml({
    className,
    pngPath: `assets/laws/${encodeURIComponent(baseName)}.png`,
    alt,
    fallbackOnError: "this.hidden=true",
  });
}

function lawPill(law) {
  if (!law?.key) return "";
  return conceptPill({
    label: law.name_zh || law.key,
    className: "tag-law",
    title: law.key,
    kind: "law",
    key: law.key,
    href: conceptHref("law", law.key),
  });
}

function sortIdeologyRefsByType(left, right) {
  return orderValue(ideologyTypeOrder, ideologyTypeKey(ideologyByKey.get(left?.key) || left))
    - orderValue(ideologyTypeOrder, ideologyTypeKey(ideologyByKey.get(right?.key) || right))
    || sortRefByName(left, right);
}

function lawPills(keys) {
  const pills = (keys || []).map((key) => lawPill(lawByKey.get(key) || { key, name_zh: key })).filter(Boolean);
  return pills.length ? `<span class="link-list">${pills.join("")}</span>` : "";
}

function collapsibleDetailSection(title, html, meta = "") {
  const body = String(html || "").trim();
  if (!body) return "";
  return `
    <details class="collapsible-detail-section">
      <summary>
        <span>${escapeHtml(title)}</span>
        ${meta ? `<small>${escapeHtml(meta)}</small>` : ""}
      </summary>
      <div class="collapsible-detail-body">${body}</div>
    </details>
  `;
}

function buildingIconHtml(key, label = "") {
  const fileName = buildingIconFileByKey[key];
  if (!fileName) return "";
  const path = `assets/buildings/${encodeURIComponent(fileName)}`;
  return webpPictureHtml({ className: "resource-icon", pngPath: path, alt: "", title: label || key });
}

function companyIconHtml(company) {
  const label = company?.name_zh || company?.key || "公司";
  const title = [label, company?.icon].filter(Boolean).join("；");
  const path = companyIconPath(company?.icon);
  if (!path) return `<span class="company-icon-placeholder" title="${escapeHtml(title)}">司</span>`;
  return webpPictureHtml({ className: "company-logo", pngPath: path, alt: "", title });
}

function companyIconPath(icon) {
  const baseName = fileBaseName(icon).replace(/\.dds$/i, ".png");
  if (!baseName || baseName === fileBaseName(icon)) return "";
  return `assets/companies/${encodeURIComponent(baseName)}`;
}

function countryFlagIconHtml(country, className = "country-flag-inline") {
  const image = countryDefaultFlagImage(country);
  if (!image) return "";
  const label = country?.name || country?.name_zh || country?.tag || "country";
  const tag = country?.tag || "";
  const title = [label, tag].filter(Boolean).join(" ");
  return `<img class="${escapeHtml(className)}" src="${escapeHtml(image)}" alt="" title="${escapeHtml(title)}">`;
}

function countryDefaultFlagImage(country) {
  const tag = country?.tag || country?.key || "";
  if (!tag) return "";
  const variants = countryFlagData[tag]?.variants || [];
  return variants.find((variant) => variant.key === tag)?.image || variants[0]?.image || "";
}

function ideologyIconHtml(ideology, className = "ideology-icon") {
  const label = ideology?.name_zh || ideology?.key || "意识形态";
  const title = [label, ideology?.key].filter(Boolean).join("；");
  const path = ideologyIconPath(ideology?.icon);
  if (!path) return `<span class="${escapeHtml(className)} ideology-icon-placeholder" title="${escapeHtml(title)}"></span>`;
  return webpPictureHtml({
    className,
    pngPath: path,
    alt: "",
    title,
    fallbackOnError: "this.onerror=null;this.src='assets/ideologies/no_ideology.png';",
  });
}

function webpPictureHtml({ className = "", pngPath = "", alt = "", title = "", fallbackOnError = "" }) {
  if (!pngPath) return "";
  const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
  const errorAttribute = fallbackOnError ? ` onerror="${escapeHtml(fallbackOnError)}"` : "";
  return `<picture><source srcset="${escapeHtml(webpAssetPath(pngPath))}" type="image/webp"><img class="${escapeHtml(className)}" src="${escapeHtml(pngPath)}" alt="${escapeHtml(alt)}"${titleAttribute}${errorAttribute}></picture>`;
}

function webpAssetPath(pngPath) {
  return String(pngPath || "").replace(/\.png$/i, ".webp");
}

function ideologyIconPath(icon) {
  const baseName = fileBaseName(icon).replace(/\.dds$/i, ".png");
  if (!baseName || baseName === fileBaseName(icon)) return "";
  return `assets/ideologies/${encodeURIComponent(baseName)}`;
}

function interestGroupIconHtml(group, className = "interest-group-icon") {
  const label = group?.name_zh || group?.key || "利益集团";
  const path = interestGroupIconPath(group?.texture);
  if (!path) return `<span class="${escapeHtml(className)} interest-group-icon-placeholder" title="${escapeHtml(label)}"></span>`;
  return `<img class="${escapeHtml(className)}" src="${path}" alt="" title="${escapeHtml(label)}">`;
}

function interestGroupIconPath(texture) {
  const baseName = fileBaseName(texture).replace(/\.dds$/i, ".png");
  if (!baseName || baseName === fileBaseName(texture)) return "";
  return `assets/interest-groups/${encodeURIComponent(baseName)}`;
}

function dlcIconHtml(option) {
  if (!option?.icon) return "";
  const title = option.title || option.label || option.key;
  return `<img class="dlc-icon" src="assets/dlc/${encodeURIComponent(option.icon)}" alt="" title="${escapeHtml(title)}">`;
}

function fileBaseName(file) {
  return String(file || "").split(/[\\/]/).pop() || "";
}

function colorValue(hex, rgb) {
  if (!hex) return "";
  const rgbText = Array.isArray(rgb) && rgb.length ? `RGB ${rgb.join(", ")}` : "";
  return `
    <span class="color-value">
      <span class="country-color" style="${colorStyle(hex)}" aria-hidden="true"></span>
      <span>${escapeHtml(hex)}</span>
      <span class="minor">${escapeHtml(rgbText)}</span>
    </span>
  `;
}

function colorStyle(hex) {
  return hex ? `background:${escapeHtml(hex)}` : "";
}

function countryBorderStyle(hex) {
  return hex ? `--country-color:${escapeHtml(hex)}` : "";
}

function countryNameText(country) {
  const variants = countryVariantNames(country);
  const suffix = variants.length
    ? `<span class="name-variants">（${escapeHtml(variants.join("/"))}）</span>`
    : "";
  return `${escapeHtml(country.name)}${suffix}`;
}

function stateRegionNameText(stateRegion) {
  const variants = stateRegionVariantNames(stateRegion);
  const suffix = variants.length
    ? `<span class="name-variants">（${escapeHtml(variants.join("/"))}）</span>`
    : "";
  return `${escapeHtml(stateRegion.name_zh || stateRegion.key)}${suffix}`;
}

function countryVariantNames(country) {
  const names = [];
  const seen = new Set([country.name]);
  for (const variant of country.dynamicNameVariants || []) {
    const name = variant.name_zh || variant.name_key || "";
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

function stateRegionVariantNames(stateRegion) {
  return visibleDynamicStateNameVariants(stateRegion).map((variant) => variant.name_zh || variant.name_key);
}

function visibleDynamicStateNameVariants(stateRegion) {
  const seen = new Set([stateRegion.name_zh || stateRegion.key]);
  const visible = [];
  for (const variant of stateRegion.dynamic_name_variants || []) {
    const name = variant.name_zh || "";
    if (!name || name === variant.name_key || seen.has(name)) continue;
    seen.add(name);
    visible.push(variant);
  }
  return visible;
}

function countryCapitalText(country) {
  const capital = country.capitalZh || country.capital || "无";
  const stateRegion = byStateRegion.get(country.capital);
  const strategicRegionNames = (stateRegion?.strategic_regions || [])
    .map((region) => `${strategicRegionName(byStrategicRegion.get(region.key) || region)}战略区域`);
  const suffix = strategicRegionNames.length ? `（${strategicRegionNames.join("、")}）` : "";
  return `首都：${escapeHtml(capital)}${escapeHtml(suffix)}`;
}

function stateRegionSummaryText(stateRegion) {
  return `开局归属：${countryRefNames(stateRegion.starting_owners)}`;
}

function refNames(items, separator = "、") {
  const names = (items || []).map(refName).filter(Boolean);
  return names.length ? names.join(separator) : "无";
}

function refName(item) {
  if (!item) return "";
  if (item.tag) return countryRefLabel(item);
  if (item.key && byStrategicRegion.has(item.key)) return strategicRegionName(byStrategicRegion.get(item.key));
  if (item.key && byStateRegion.has(item.key)) return byStateRegion.get(item.key)?.name_zh || item.key;
  return item.name_zh || item.key || item.tag || "";
}

function countryNameWithTag(tag) {
  return countryRefLabel({ tag });
}

function countryRefNames(items, separator = "、") {
  const names = (items || []).map(countryRefLabel).filter(Boolean);
  return names.length ? names.join(separator) : "无";
}

function countryRefLabel(item) {
  if (!item) return "";
  const tag = item.tag || item.key || "";
  if (!tag) return "";
  const country = byTag.get(tag);
  const name = item.name_zh || item.name || country?.name || country?.name_zh || tag;
  return `${name}(${tag})`;
}

function strategicRegionName(region) {
  const rawName = region?.name_zh || region?.key || "";
  if (!isWrappedLocalizationKey(rawName)) return rawName;
  const stateKey = rawName.slice(1, -1);
  const stateRegion = byStateRegion.get(stateKey);
  return stateRegion?.name_zh || stateKey || rawName;
}

function isSeaStrategicRegion(region) {
  return String(region?.source_file || "").includes("water_strategic_regions")
    || isWrappedLocalizationKey(region?.name_zh);
}

function isSeaStateRegion(stateRegion) {
  return seaStateRegionKeys.has(stateRegion?.key);
}

function isWrappedLocalizationKey(value) {
  return typeof value === "string" && value.length > 2 && value.startsWith("$") && value.endsWith("$");
}

function stateRegionBorderStyle(stateRegion) {
  const regionKey = stateRegion.strategic_regions?.[0]?.key;
  const hex = byStrategicRegion.get(regionKey)?.map_color?.hex || "";
  return countryBorderStyle(hex);
}

function firstStrategicRegionOrder(stateRegion) {
  const values = (stateRegion.strategic_regions || []).map((region) => orderValue(strategicRegionOrderByKey, region.key));
  return values.length ? Math.min(...values) : Number.MAX_SAFE_INTEGER;
}

function stateRegionResourceCount(stateRegion) {
  return (stateRegion.arable_resources || []).length
    + (stateRegion.capped_resources || []).length
    + (stateRegion.discoverable_resources || []).length;
}

function buildStateKeyByProvinceColor() {
  const map = new Map();
  for (const stateRegion of stateRegions) {
    for (const color of stateRegion.province_colors || []) {
      map.set(normalizeProvinceColorKey(color), stateRegion.key);
    }
  }
  return map;
}

function stateRegionResourceValue(stateRegion, resourceKey) {
  const capped = (stateRegion.capped_resources || []).find((item) => item.key === resourceKey);
  if (capped) {
    return {
      value: Number(capped.amount || 0),
      detail: String(capped.amount || 0),
    };
  }
  const discoverable = (stateRegion.discoverable_resources || []).find((item) => item.key === resourceKey);
  if (discoverable) {
    const amount = discoverable.undiscovered_amount ?? discoverable.discovered_amount ?? discoverable.amount ?? 0;
    return {
      value: Number(amount || 0),
      detail: String(amount || 0),
    };
  }
  const arable = (stateRegion.arable_resources || []).find((item) => item.key === resourceKey);
  if (arable) {
    const arableLand = Number(stateRegion.arable_land || 0);
    return {
      value: arableLand || 1,
      detail: arableLand ? `耕地 ${arableLand}` : "可建",
    };
  }
  return {
    value: 0,
    detail: "",
  };
}

function cultureRelationForStateRegion(stateRegion, selectedCulture) {
  if (!selectedCulture) return { rank: 0, label: "未选择文化" };
  if (isSeaStateRegion(stateRegion)) return { rank: 0, label: "海域" };
  const homelands = stateRegion.homeland_cultures || [];
  if (homelands.some((cultureRef) => cultureRef.key === selectedCulture.key)) {
    return { rank: 5, label: `${selectedCulture.name_zh || selectedCulture.key}本土` };
  }
  let best = { rank: 0, label: "无关系" };
  for (const cultureRef of homelands) {
    const culture = byCulture.get(cultureRef.key);
    if (!culture) continue;
    const relation = cultureRelation(selectedCulture, culture);
    if (relation.rank > best.rank) best = relation;
  }
  return best;
}

function cultureRelation(selectedCulture, culture) {
  if (selectedCulture.language?.key && selectedCulture.language.key === culture.language?.key) {
    return { rank: 4, label: `同语言：${culture.name_zh}` };
  }
  if (selectedCulture.language_group?.key && selectedCulture.language_group.key === culture.language_group?.key) {
    return { rank: 3, label: `同语言组：${culture.name_zh}` };
  }
  if (selectedCulture.heritage?.key && selectedCulture.heritage.key === culture.heritage?.key) {
    return { rank: 2, label: `同传承：${culture.name_zh}` };
  }
  if (selectedCulture.heritage_group?.key && selectedCulture.heritage_group.key === culture.heritage_group?.key) {
    return { rank: 1, label: `同传承组：${culture.name_zh}` };
  }
  return { rank: 0, label: "无关系" };
}

function cultureRelationColor(rank, isSea) {
  if (isSea) return MAP_SEA_COLOR;
  if (rank === 5) return "#1f5f8b";
  if (rank === 4) return "#238a7d";
  if (rank === 3) return "#77b9a8";
  if (rank === 2) return "#8a5a9e";
  if (rank === 1) return "#cab6dc";
  return "#eee9df";
}

function mapModeLabel(mode) {
  if (mode === "country") return "开局归属";
  if (mode === "strategicRegion") return "战略区域";
  if (mode === "company") return "公司关联";
  if (mode === "cultureFilter") return "文化筛选";
  if (mode === "resourceSelection") return "资源潜力";
  if (mode === "culture") return "文化关系";
  if (mode === "trait") return "地区特质";
  return "资源潜力";
}

function mapSubjectLabel() {
  const option = mapSubjectOptions(state.mapMode).find((item) => item.value === state.mapSubject);
  return option?.label || state.mapSubject || "";
}

function automaticMapSubjectLabel(mode) {
  if (mode === "country") return "开局归属";
  if (mode === "company") return "当前公司列表";
  if (mode === "cultureFilter") return cultureFilterMapLabel();
  if (mode === "resourceSelection") return selectedResourceMapLabel();
  return mapModeLabel(mode);
}

function selectedResourceMapLabel() {
  const labels = [...state.resourceFilters]
    .map((key) => resourceFilterByKey.get(key)?.label)
    .filter(Boolean);
  if (!labels.length) return "战略区域";
  return labels.length > 3 ? `${labels.slice(0, 3).join("、")}等 ${labels.length} 项` : labels.join("、");
}

function cultureFilterMapLabel() {
  const labels = [
    ...selectedTraitFilterLabels(state.heritageGroups, "传承组"),
    ...selectedTraitFilterLabels(state.heritages, "传承"),
    ...selectedTraitFilterLabels(state.languageGroups, "语言组"),
    ...selectedTraitFilterLabels(state.languages, "语言"),
  ];
  if (state.tradition) {
    const tradition = cultureTraitByKey.get(state.tradition);
    labels.push(`传统：${tradition?.name_zh || state.tradition}`);
  }
  if (!labels.length) return "未选择文化特质";
  return labels.length > 3 ? `${labels.slice(0, 3).join("、")}等 ${labels.length} 项` : labels.join("、");
}

function selectedTraitFilterLabels(values, prefix) {
  return [...values].map((key) => {
    const trait = cultureTraitByKey.get(key);
    return `${prefix}：${trait?.name_zh || key}`;
  });
}

function formatMapLabelValue(value) {
  return Number.isFinite(Number(value)) ? String(Number(value)) : String(value || "");
}

function normalizeProvinceColorKey(value) {
  const match = String(value || "").trim().match(/^x?([0-9a-fA-F]{6})$/);
  return match ? `x${match[1].toUpperCase()}` : "";
}

function rgbToProvinceColor(r, g, b) {
  return `x${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function interpolateColor(fromHex, toHex, amount) {
  const from = hexToRgb(fromHex);
  const to = hexToRgb(toHex);
  const ratio = clampNumber(amount, 0, 1);
  const rgb = from.map((value, index) => Math.round(value + (to[index] - value) * ratio));
  return rgbToHexString(rgb);
}

function hexToRgb(hex) {
  const value = String(hex || "#000000").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return [0, 0, 0];
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHexString(rgb) {
  return `#${rgb.map((value) => clampNumber(value, 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function searchPlaceholder() {
  if (state.view === "culture") return "文化、特质、宗教、本土战略区域、州地区";
  if (state.view === "region") return "州地区、战略区域、海域、资源、地区特质、国家、文化";
  if (state.view === "company") return "公司、建筑、名贵商品、总部、战略区域、条件";
  if (state.view === "ideology") return "板块内搜索：意识形态、利益集团、法律组、法律";
  if (state.view === "law") return "法律、法律组、修正、条件";
  return "国家、Tag、文化、宗教、州地区";
}

function unitColorText(country) {
  const values = [
    country.primaryUnitColor && `一色 ${country.primaryUnitColor}`,
    country.secondaryUnitColor && `二色 ${country.secondaryUnitColor}`,
    country.tertiaryUnitColor && `三色 ${country.tertiaryUnitColor}`,
  ].filter(Boolean);
  return values.length ? escapeHtml(values.join("；")) : "";
}

function splitNumbers(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/\s+/).map(Number).filter(Number.isFinite);
}

function countrySearchBlob(country) {
  return [
    country.tag,
    country.name,
    country.capital,
    country.capitalZh,
    country.countryType,
    country.countryTypeZh,
    countryTypeTagLabel(country),
    country.tier,
    country.tierZh,
    country.isDualHeritage === "是" ? "双传承" : "",
    country.religion,
    country.religionZh,
    ...country.primaryCultures,
    ...country.primaryCulturesZh,
    ...refSearchParts(country.primaryCultureHeritageGroups),
    ...refSearchParts(country.primaryCultureHeritages),
    ...refSearchParts(country.primaryCultureLanguageGroups),
    ...refSearchParts(country.primaryCultureLanguages),
    ...refSearchParts(country.primaryCultureTraditions),
    ...refSearchParts(country.primaryCultureHomelandStrategicRegions),
    ...refSearchParts(country.primaryCultureHomelandStateRegions),
    ...refSearchParts(country.locationStrategicRegions),
    ...refSearchParts(country.locationStateRegions),
    ...refSearchParts(country.formationStrategicRegions),
    ...refSearchParts(country.formationStateRegions),
    ...country.startingStates,
    ...country.formationStates,
    ...country.releaseStates,
    ...country.canFormTags,
    ...country.canFormNames,
    country.specialMechanic,
    ...(country.specialTags || []),
    country.colorHex,
    ...(country.dynamicNameVariants || []).flatMap((variant) => [
      variant.name_key,
      variant.name_zh,
      variant.adjective_key,
      variant.adjective_zh,
      variant.referenced_tags,
      variant.referenced_cultures,
      variant.referenced_laws,
      variant.referenced_journal_entries,
      variant.referenced_variables,
    ]),
  ].join(" ").toLowerCase();
}

function cultureSearchBlob(culture) {
  return [
    culture.key,
    culture.name_zh,
    culture.religion?.key,
    culture.religion?.name_zh,
    ...refSearchParts([culture.heritage_group, culture.heritage, culture.language_group, culture.language]),
    ...refSearchParts(culture.traditions),
    ...refSearchParts(culture.homeland_strategic_regions),
    ...refSearchParts(culture.homeland_state_regions),
    ...refSearchParts(culture.related_countries),
    ...refSearchParts(culture.obsessions),
    ...refSearchParts(culture.taboos),
  ].join(" ").toLowerCase();
}

function stateRegionSearchBlob(stateRegion) {
  return [
    stateRegion.key,
    stateRegion.name_zh,
    stateRegion.numeric_id,
    stateRegion.subsistence_building,
    ...refSearchParts(stateRegion.strategic_regions),
    ...refSearchParts(stateRegion.starting_owners),
    ...refSearchParts(stateRegion.homeland_cultures),
    ...refSearchParts(stateRegion.traits),
    ...stateTraitSearchParts(stateRegion.traits),
    ...dynamicStateNameSearchParts(stateRegion.dynamic_name_variants),
    ...refSearchParts(stateRegion.arable_resources),
    ...resourceSearchParts(stateRegion.capped_resources),
    ...resourceSearchParts(stateRegion.discoverable_resources),
  ].join(" ").toLowerCase();
}

function strategicRegionSearchBlob(region) {
  return [
    region.key,
    region.name_zh,
    strategicRegionName(region),
    region.capital_province,
    ...refSearchParts(region.states),
    ...refSearchParts(region.homeland_cultures),
    ...refSearchParts(region.starting_owners),
  ].join(" ").toLowerCase();
}

function geographicRegionSearchBlob(region) {
  return [
    region.key,
    region.name_zh,
    region.display_name_zh,
    ...refSearchParts(geographicRegionStrategicRegions(region)),
    ...refSearchParts(geographicRegionStateRegions(region)),
  ].join(" ").toLowerCase();
}

function geographicRegionDisplayName(region) {
  return region?.display_name_zh || region?.name_zh || region?.key || "";
}

function companySearchBlob(company) {
  return [
    company.key,
    company.name_zh,
    company.desc_zh,
    company.category,
    company.category_zh,
    companyKindText(company),
    companyPrestigeLabel(company),
    companyDlcLabel(company),
    company.dlc_name_en,
    company.source_file,
    company.prosperity_modifier_summary_zh,
    ...refSearchParts(company.preferred_headquarters),
    ...refSearchParts(company.referenced_state_regions),
    ...refSearchParts(company.referenced_strategic_regions),
    ...refSearchParts(company.referenced_geographic_regions),
    ...refSearchParts(company.referenced_cultures),
    ...refSearchParts(company.referenced_countries),
    ...refSearchParts(company.building_types),
    ...refSearchParts(company.extension_building_types),
    ...refSearchParts(company.referenced_buildings),
    ...refSearchParts(company.possible_prestige_goods),
    ...refSearchParts(company.required_technologies),
    ...refSearchParts(company.ai_will_do_technologies),
    company.potential_raw,
    company.attainable_raw,
    company.possible_raw,
    company.prestige_goods_trigger_raw,
    company.ai_will_do_raw,
  ].join(" ").toLowerCase();
}

function ideologySearchBlob(ideology) {
  const typeKey = ideologyTypeKey(ideology);
  return [
    ideology.key,
    ideology.name_zh,
    cleanIdeologyDescription(ideology.desc_zh),
    ideologyTypeLabels.get(typeKey),
    ideologyTypeShortLabels.get(typeKey),
    fileBaseName(ideology.source_file),
    ...refSearchParts(ideology.unlock_technologies),
    ...refSearchParts(ideology.unlock_journal_entries),
    ...(ideology.unlock_sources || []).flatMap((source) => [
      source.source_key,
      source.source_name_zh,
      fileBaseName(source.source_file),
      source.condition_summary_zh,
    ]),
    ideology.flavor_definition_status,
    ideology.flavor_definition_note_zh,
    ...ideologyWeightSearchParts(ideology),
    ...refSearchParts(ideologyInterestGroupRefs(ideology)),
    ...refSearchParts(ideologyOccurrenceRefs(ideology)),
    ...lawStanceSearchParts(ideology.law_stances),
  ].join(" ").toLowerCase();
}

function lawSearchBlob(law) {
  const group = lawGroupByKey.get(law.group_key);
  return [
    law.key,
    law.name_zh,
    law.group_key,
    law.group_name_zh,
    law.progressiveness,
    law.modifier_summary_zh,
    law.parent,
    ...(law.disallowing_laws || []),
    ...(law.modifiers || []).flatMap((modifier) => [modifier.key, modifier.name_zh, modifier.desc_zh, modifier.summary_zh]),
    ...conditionSearchParts(law.can_enact),
    ...conditionSearchParts(law.is_visible),
    ...conditionSearchParts(group?.enable),
    ...conditionSearchParts(group?.change_allowed_trigger),
  ].filter(Boolean).join(" ").toLowerCase();
}

function ideologyWeightSearchParts(ideology) {
  return [
    ...conditionSearchParts(ideology.character_requirements?.country),
    ...conditionSearchParts(ideology.character_requirements?.interest_group_leader),
    ...conditionSearchParts(ideology.character_requirements?.non_interest_group_leader),
    ...weightSearchParts(ideology.interest_group_leader_weight),
    ...weightSearchParts(ideology.non_interest_group_leader_weight),
  ];
}

function weightSearchParts(weight) {
  return (weight?.entries || []).flatMap((entry) => [
    entry.kind,
    entry.value,
    entry.desc,
    entry.condition_summary_zh,
    ...conditionSearchParts(entry),
  ]);
}

function conditionSearchParts(condition) {
  if (!condition) return [];
  return [
    condition.summary_zh,
    condition.condition_summary_zh,
    ...refSearchParts(condition.interest_groups),
    ...refSearchParts(condition.laws),
    ...refSearchParts(condition.technologies),
    ...refSearchParts(condition.journal_entries),
    ...refSearchParts(condition.traits),
    ...(condition.variables || []),
  ];
}

function lawStanceSearchParts(stances) {
  return (stances || []).flatMap((stance) => [
    stance?.law_group_key,
    stance?.law_group_name_zh,
    stance?.law_key,
    stance?.law_name_zh,
    stance?.stance,
    lawStanceLabel(stance?.stance),
  ]).filter(Boolean);
}

function refSearchParts(items) {
  return (items || []).flatMap((item) => [
    item?.key,
    item?.tag,
    item?.name_zh,
    item?.group_key,
    item?.group_name_zh,
  ]).filter(Boolean);
}

function resourceSearchParts(items) {
  return (items || []).flatMap((item) => [
    item?.key,
    item?.name_zh,
    item?.amount,
    item?.discovered_amount,
    item?.undiscovered_amount,
  ]).filter(Boolean);
}

function stateTraitSearchParts(traits) {
  return (traits || []).flatMap((trait) => [
    trait?.category_zh,
    trait?.modifier_summary_zh,
    trait?.has_mapi ? "MAPI" : "",
    ...(trait?.categories || []).flatMap((category) => [category.key, category.name_zh]),
    ...(trait?.modifiers || []).flatMap((modifier) => [
      modifier.key,
      modifier.name_zh,
      modifier.desc_zh,
      modifier.value_zh,
      modifier.summary_zh,
    ]),
  ]).filter(Boolean);
}

function dynamicStateNameSearchParts(variants) {
  return (variants || []).flatMap((variant) => [
    variant.name_key,
    variant.name_zh,
    variant.trigger_raw,
  ]).filter(Boolean);
}

function resourceOptionToken(filter) {
  const iconKey = (filter.resources || filter.arableResources || filter.companyBuildings || [])[0] || "";
  const checked = state.resourceFilters.has(filter.key);
  return `
    <button class="filter-token filter-token-with-icon resource-filter-token" type="button" data-filter-token data-resource-filter="${escapeHtml(filter.key)}" aria-label="${escapeHtml(filter.label)}" title="${escapeHtml(filter.label)}" aria-pressed="${checked ? "true" : "false"}">
      ${buildingIconHtml(iconKey, filter.label)}
    </button>
  `;
}

function companyDlcOptionToken(option, checked = false) {
  const title = `${option.label} / ${option.title || option.key}`;
  return `
    <button class="filter-token filter-token-with-icon dlc-filter-token" type="button" data-filter-token data-company-dlc="${escapeHtml(option.key)}" aria-label="${escapeHtml(title)}" title="${escapeHtml(title)}" aria-pressed="${checked ? "true" : "false"}">
      ${dlcIconHtml(option)}
    </button>
  `;
}

function optionToken(kind, value, label, checked = false, extraClass = "") {
  const classText = extraClass ? ` ${extraClass}` : "";
  return `<button class="filter-token${classText}" type="button" data-filter-token data-${kind}="${escapeHtml(value)}" aria-pressed="${checked ? "true" : "false"}">${escapeHtml(label)}</button>`;
}

function buildActiveHint(count) {
  const parts = [];
  if (state.search) parts.push(`搜索：${state.search}`);
  if (state.globalSearch) parts.push(`全局：${state.globalSearch}`);
  if (state.view === "country" && state.flags.size) parts.push(`状态 ${state.flags.size}`);
  if (state.view === "country" && state.tiers.size) parts.push(`位阶 ${state.tiers.size}`);
  if (state.view === "country" && state.types.size) parts.push(`类型 ${state.types.size}`);
  if (state.view !== "ideology" && state.strategicRegions.size) {
    parts.push(`${state.view === "culture" ? "本土战略区域" : state.view === "company" ? "相关战略区域" : "所在战略区域"} ${state.strategicRegions.size}`);
  }
  if (["country", "culture"].includes(state.view) && state.heritageGroups.size) parts.push(`传承组 ${state.heritageGroups.size}`);
  if (["country", "culture"].includes(state.view) && state.heritages.size) parts.push(`传承 ${state.heritages.size}`);
  if (["country", "culture"].includes(state.view) && state.languageGroups.size) parts.push(`语言组 ${state.languageGroups.size}`);
  if (["country", "culture"].includes(state.view) && state.languages.size) parts.push(`语言 ${state.languages.size}`);
  if ((state.view === "region" || state.view === "company") && state.resourceFilters.size) {
    parts.push(`${state.view === "company" ? "建筑" : "资源"} ${state.resourceFilters.size}`);
  }
  if (state.view === "company" && state.companyKinds.size) parts.push(`公司类型 ${state.companyKinds.size}`);
  if (state.view === "company" && state.includeIndustryCharter) parts.push("包含产业特许");
  if (state.view === "company" && state.companyPrestigeGoods.size) parts.push(`名贵商品 ${state.companyPrestigeGoods.size}`);
  if (state.view === "company" && state.companyDlcs.size) parts.push(`资料片 ${state.companyDlcs.size}`);
  if (state.view === "ideology" && state.ideologyTypes.size) parts.push(`类型 ${state.ideologyTypes.size}`);
  if (state.view === "ideology" && state.ideologyGroups.size) parts.push(`利益集团 ${state.ideologyGroups.size}`);
  if (state.view === "ideology" && state.ideologyOccurrences.size) parts.push(`出现方式 ${state.ideologyOccurrences.size}`);
  if (state.view === "ideology" && state.ideologyLawGroups.size) parts.push(`法律组 ${state.ideologyLawGroups.size}`);
  if (state.view === "law" && state.lawGroups.size) parts.push(`法律组 ${state.lawGroups.size}`);
  if (["country", "culture"].includes(state.view) && state.tradition) parts.push(`传统 ${getTraitName(state.tradition)}`);
  return parts.join("；");
}

function getTraitName(key) {
  return cultureTraitByKey.get(key)?.name_zh || key;
}

function toggleSet(set, value, checked) {
  if (!value) return;
  if (checked) set.add(value);
  else set.delete(value);
}

function setTokenPressed(button, pressed) {
  if (!button) return;
  button.setAttribute("aria-pressed", String(pressed));
}

function syncTokenGroup(container, selectedValue) {
  if (!container) return;
  container.querySelectorAll("[data-filter-token]").forEach((button) => {
    const tokenValue = Object.entries(button.dataset)
      .find(([key]) => key !== "filterToken")?.[1] || "";
    setTokenPressed(button, tokenValue === selectedValue);
  });
}

function syncSetWithOptions(set, options) {
  const allowed = new Set((options || []).map((item) => item.key));
  for (const key of [...set]) {
    if (!allowed.has(key)) {
      set.delete(key);
    }
  }
}

function compactRefs(items) {
  return (items || []).filter((item) => item?.key);
}

function unique(values) {
  return [...new Set(values)];
}

function uniqueByKey(items) {
  const byKey = new Map();
  for (const item of items || []) {
    if (item?.key && !byKey.has(item.key)) byKey.set(item.key, item);
  }
  return [...byKey.values()];
}

function sortRefByName(a, b) {
  return (a.name_zh || a.key || a.tag).localeCompare(b.name_zh || b.key || b.tag, "zh-Hans-CN") || (a.key || a.tag).localeCompare(b.key || b.tag);
}

function sortStrategicRegionRef(a, b) {
  return orderValue(strategicRegionOrderByKey, a.key) - orderValue(strategicRegionOrderByKey, b.key)
    || strategicRegionName(a).localeCompare(strategicRegionName(b), "zh-Hans-CN")
    || a.key.localeCompare(b.key);
}

function sortHeritageGroupRef(a, b) {
  return orderValue(heritageGroupOrderByKey, a.key) - orderValue(heritageGroupOrderByKey, b.key) || sortRefByName(a, b);
}

function sortLanguageGroupRef(a, b) {
  return languageGroupSortBucket(a) - languageGroupSortBucket(b) || sortRefByName(a, b);
}

function languageGroupSortBucket(ref) {
  const key = ref?.key || "";
  if (/sinitic|japonic|koreanic|tibeto|hmongic|daic/.test(key)) return 10;
  if (/indo_aryan|dravidian|iranic/.test(key)) return 20;
  if (/semitic|turkic|berber|armenian/.test(key)) return 30;
  if (/germanic|romance|slavic|baltic|celtic|hellenic|uralic|albanic|vasconic/.test(key)) return 40;
  if (/austronesian|austroasiatic/.test(key)) return 50;
  if (/bantu|nilotic|kushitic|mande|kwa|volta|chadic|saharan|songhai|senegambian|kru|gur|furan|khoisan|kordofanian|ubangian|central_sudanic|benue_congo|senufic|mal/.test(key)) return 60;
  if (/algic|arawakan|aymaran|caddoan|cariban|chibchan|chonan|eskaleut|hokan|iroquoian|mayan|misumalpan|muskogean|na_dene|oto_manguean|penutian|quechuan|salishan|siouan|tarascan|tupian|uto_aztecan|pama_nyungan/.test(key)) return 90;
  return 70;
}

function orderValue(orderMap, key) {
  return orderMap.has(key) ? orderMap.get(key) : Number.MAX_SAFE_INTEGER;
}

function orderValueByList(orderList, key) {
  const index = orderList.indexOf(key);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}
