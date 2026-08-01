// 标签悬停的可编辑分类与说明。键应使用标签生成器传入的稳定语义键或样式类别。
const TAG_TOOLTIP_DEFAULTS = {
  tag: {
    category: "属性标签",
  },
  concept: {},
  building: {
    category: "建筑",
  },
  goods: {
    category: "商品",
  },
  technology: {
    category: "科技",
  },
  ideology: {
    categoryKey: "tooltip.category.ideology",
  },
  law: {
    categoryKey: "tooltip.category.law",
  },
  interestGroup: {
    categoryKey: "tooltip.category.interestGroup",
  },
  interestGroupTrait: {
    categoryKey: "tooltip.category.interestGroupTrait",
  },
  stateTrait: {
    category: "地区特质",
  },
  culture: {
    category: "文化",
  },
  cultureTrait: {
    category: "文化特质",
  },
  cultureTraitGroup: {
    category: "文化特质组",
  },
  cultureRelations: {
    empty: "无",
    heritageGroup: "组内传承",
    heritage: "关联文化",
    languageGroup: "组内语言",
    language: "关联文化",
    tradition: "关联文化",
    primaryCultureCountries: "主流文化国家",
    obsessions: "痴迷",
    taboos: "禁忌",
  },
};

const TAG_TOOLTIP_DEFINITIONS = {
  "country-status:start": {
    category: "国家状态",
    description: "该国家在1836年开局时已存在。",
  },
  "country-status:releasable": {
    category: "国家状态",
    description: "该国家可通过释放附属国等机制建立。",
  },
  "country-formation:major": {
    category: "国家统一",
    description: "该国家可通过重大统一成立。",
  },
  "country-formation:minor": {
    category: "国家统一",
    description: "该国家可通过次要统一成立。",
  },
  "country-status:special": {
    category: "国家状态",
    description: "该国家具有特殊的建立或显示规则。",
  },
  "country-status:dual-heritage": {
    category: "国家状态",
    description: "该国家拥有两种不同传承组的主流文化。",
  },
  "country-type:受认可国家": {
    category: "国家类型",
  },
  "country-type:殖民国家": {
    category: "国家类型",
  },
  "country-type:公司国家": {
    category: "国家类型",
  },
  "country-type:未受认可国家": {
    category: "国家类型",
  },
  "country-type:松散政权": {
    category: "国家类型",
  },
  "country-tier:城邦": {
    category: "国家位阶",
  },
  "country-tier:公国": {
    category: "国家位阶",
  },
  "country-tier:大公国": {
    category: "国家位阶",
  },
  "country-tier:王国": {
    category: "国家位阶",
  },
  "country-tier:帝国": {
    category: "国家位阶",
  },
  "country-tier:霸权": {
    category: "国家位阶",
  },
  "country-type": { category: "国家类型" },
  "country-tier": { category: "国家位阶" },
  "company-dlc": { category: "资料片" },
  "company-ownership-category": { category: "控股类别" },
  "state-trait-category": {
    category: "地区特质类别",
  },
  "state-trait-effect": {
    category: "地区特质效果",
  },
  "modifier-effect": {
    category: "修正效果",
  },
  "mapi-summary": {
    category: "市场接入度的价格影响",
    description: "该地域的地区特质会改变市场接入度对商品本地价格的最大影响。",
  },
  "mapi-category": {
    category: "市场价格影响",
    description: "该类别用于标示会影响市场接入度价格影响的地区特质。",
  },
  "mapi-effect": {
    category: "市场接入度的价格影响",
    description: "该修正会提高或降低市场接入度对商品本地价格的最大影响。",
  },
  "strategic-region-starting-owner": {
    category: "战略区域的开局国家",
    description: "该国家在1836年开局时拥有该战略区域。",
  },
  "strategic-region-homeland-culture": {
    category: "战略区域的本土文化",
    description: "该文化在该战略区域拥有本土地域。",
  },
  "geographic-region-strategic-region": {
    category: "地理区域的战略区域",
  },
  "geographic-region-state-region-count": {
    category: "地理区域的地域数量",
  },
  "tag-type": { category: "类型" },
  "tag-tier": { category: "位阶" },
  "tag-region": { category: "区域关系" },
  "tag-heritage-group": {
    category: "传承组",
    description: "将相近的文化传承归类，供文化规则和条件判断引用。",
  },
  "tag-heritage": {
    category: "文化传承",
  },
  "tag-language-group": {
    category: "语言组",
  },
  "tag-language": {
    category: "语言",
  },
  "tag-tradition": {
    category: "文化传统",
  },
  "tag-dlc": { category: "资料片" },
  "tag-good": { category: "商品" },
  "tag-vc": { category: "版本来源" },
  "tag-arable": { category: "可耕地资源" },
  "tag-more": { category: "数量说明" },
  "tag-muted": { category: "补充信息" },
  "tag-mapi": { category: "市场接入度的价格影响" },
  "tag-effect": { category: "效果" },
  "tag-release": { category: "国家状态" },
  "tag-dual": { category: "国家状态" },
  "tag-special": { category: "特殊属性" },
  "tag-ig-changed": { category: "名称变体" },
  "good": { category: "国家状态" },
  "warn": { category: "国家状态" },
  "special": { category: "国家状态" },
};
