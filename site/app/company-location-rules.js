/*
 * 公司详情小地图的人工审计规则。
 * 未列出的公司由总部与成立条件中的州地区、战略区域、地理区域、文化本土和州地区特质自动定位。
 */
var COMPANY_LOCATION_RULES = Object.freeze({
  company_construction_power_bloc: {
    map: false,
  },
  company_bunge_born: {
    excludeStateKeys: [
      "STATE_ARAUCANIA",
      "STATE_PATAGONIA",
      "STATE_SOUTH_ATLANTIC_ISLANDS",
    ],
  },
  company_argentinian_wine: {
    excludeStateKeys: [
      "STATE_ARAUCANIA",
      "STATE_PATAGONIA",
      "STATE_SOUTH_ATLANTIC_ISLANDS",
      "STATE_CHACO",
      "STATE_CORRIENTES",
      "STATE_ALTO_PARAGUAY",
      "STATE_BAJO_PARAGUAY",
    ],
  },
  company_el_aguila: {
    replaceDerivedLocations: true,
    stateKeys: [
      "STATE_RIO_GRANDE",
      "STATE_VERACRUZ",
      "STATE_WESTERN_CUBA",
      "STATE_WEST_INDIES",
    ],
  },
  company_imperial_tobacco: {
    replaceDerivedLocations: true,
    stateKeys: [
      "STATE_AZERBAIJAN",
      "STATE_URMIA",
      "STATE_TABRIZ",
      "STATE_MAZANDARAN",
      "STATE_PERSIAN_KURDISTAN",
      "STATE_IRAKAJEMI",
      "STATE_SEMNAN",
      "STATE_KHORASAN",
      "STATE_LURISTAN",
      "STATE_ISFAHAN",
      "STATE_KERMAN",
      "STATE_KHUZESTAN",
      "STATE_FARS",
      "STATE_LARISTAN",
      "STATE_SISTAN",
    ],
  },
  company_john_holt: {
    excludeStateKeys: [
      "STATE_MAURITANIA",
      "STATE_INNER_MAURITANIA",
      "STATE_TIMBUKTU",
      "STATE_NIGER",
      "STATE_WESTERN_MALI",
      "STATE_EASTERN_MALI",
      "STATE_OUTER_HAUSALAND",
      "STATE_EAST_HAUSALAND",
      "STATE_BORNU",
    ],
  },
  company_perskhlopok: {
    excludeStateKeys: [
      "STATE_ARMENIA",
      "STATE_ELIZAVETPOL",
      "STATE_SEMNAN",
      "STATE_BALUCHISTAN",
      "STATE_NORTHERN_BALUCHISTAN",
      "STATE_QUETTA",
      "STATE_PASHTUNISTAN",
    ],
  },
  company_persshelk: {
    excludeStateKeys: [
      "STATE_ELIZAVETPOL",
      "STATE_SEMNAN",
      "STATE_SISTAN",
      "STATE_BALUCHISTAN",
      "STATE_NORTHERN_BALUCHISTAN",
      "STATE_KANDAHAR",
      "STATE_KABUL",
      "STATE_BALKH",
      "STATE_QUETTA",
      "STATE_PASHTUNISTAN",
    ],
  },
  company_standard_oil: {
    replaceDerivedLocations: true,
    stateKeys: [
      "STATE_FLORIDA",
      "STATE_ALABAMA",
      "STATE_MISSISSIPPI",
      "STATE_OHIO",
      "STATE_PENNSYLVANIA",
    ],
  },
  company_ralli_brothers: {
    replaceDerivedLocations: true,
  },
  company_steel_brothers: {
    replaceDerivedLocations: true,
    stateTraitKeys: ["state_trait_burmese_teak"],
  },
  company_cfr: {
    homelandCultureKeys: ["romanian"],
  },
  company_ottoman_tobacco_regie: {
    homelandCultureKeys: ["turkish"],
  },
  company_sunhwaguk: {
    homelandCultureKeys: ["korean"],
  },
  company_uniao_fabril: {
    homelandCultureKeys: ["portuguese"],
  },
  company_united_tobacco_factories: {
    homelandCultureKeys: ["bulgarian"],
  },
});

/* 开局已存在、且保存数据中的总部与默认总部不同的公司。 */
var COMPANY_INITIAL_HEADQUARTERS = Object.freeze({
  company_dmc: ["STATE_ALSACE_LORRAINE"],
  company_hbc: ["STATE_HOME_COUNTIES"],
  company_east_india_company: ["STATE_HOME_COUNTIES"],
  company_krupp: ["STATE_WESTPHALIA"],
  company_russian_american_company: ["STATE_INGRIA"],
  company_william_cramp: ["STATE_PENNSYLVANIA"],
});

/* 数据库尚未收录、但游戏定义中只由战略区域组成的地理区域。 */
var COMPANY_LOCATION_GEOGRAPHIC_REGION_STRATEGIC_REGIONS = Object.freeze({
  geographic_region_nile_basin: ["region_nile_basin"],
  geographic_region_indonesia: ["region_indonesia"],
});
