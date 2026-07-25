// 标签悬停的可编辑分类与说明。键应使用标签生成器传入的稳定语义键或样式类别。
const TAG_TOOLTIP_DEFAULTS = {
  tag: {
    category: "属性标签",
    description: "“{label}”用于标示当前条目的{category}。",
  },
  concept: {
    description: "“{label}”属于{category}。",
  },
  building: {
    category: "建筑",
    description: "“{label}”用于标示当前条目的{category}。",
  },
  culture: {
    category: "文化",
    description: "“{label}”是一种文化。",
  },
  cultureTrait: {
    category: "文化特质",
    description: "“{label}”是一项文化特质。",
  },
  cultureTraitGroup: {
    category: "文化特质组",
    description: "“{label}”是一组文化特质。",
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
    description: "该国家开局时属于受认可国家。",
  },
  "country-type:殖民国家": {
    category: "国家类型",
    description: "该国家属于殖民国家。",
  },
  "country-type:公司国家": {
    category: "国家类型",
    description: "该国家属于公司国家。",
  },
  "country-type:未受认可国家": {
    category: "国家类型",
    description: "该国家开局时属于未受认可国家。",
  },
  "country-type:松散政权": {
    category: "国家类型",
    description: "该国家属于松散政权。",
  },
  "country-tier:城邦": {
    category: "国家位阶",
    description: "该国家的位阶为城邦。",
  },
  "country-tier:公国": {
    category: "国家位阶",
    description: "该国家的位阶为公国。",
  },
  "country-tier:大公国": {
    category: "国家位阶",
    description: "该国家的位阶为大公国。",
  },
  "country-tier:王国": {
    category: "国家位阶",
    description: "该国家的位阶为王国。",
  },
  "country-tier:帝国": {
    category: "国家位阶",
    description: "该国家的位阶为帝国。",
  },
  "country-tier:霸权": {
    category: "国家位阶",
    description: "该国家的位阶为霸权。",
  },
  "country-type": { category: "国家类型" },
  "country-tier": { category: "国家位阶" },
  "company-dlc": { category: "资料片" },
  "tag-type": { category: "类型" },
  "tag-tier": { category: "位阶" },
  "tag-region": { category: "地区" },
  "tag-heritage-group": {
    category: "传承组",
    description: "将相近的文化传承归类，供文化规则和条件判断引用。",
  },
  "tag-heritage": {
    category: "文化传承",
    description: "“{label}”是一项文化传承。",
  },
  "tag-language-group": {
    category: "语言组",
    description: "“{label}”是一组语言。",
  },
  "tag-language": {
    category: "语言",
    description: "“{label}”是一种语言。",
  },
  "tag-tradition": {
    category: "文化传统",
    description: "“{label}”是一项文化传统。",
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
