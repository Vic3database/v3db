import assert from "node:assert/strict";
import {
  collectLocalizationRefs,
  splitLocalizedTrees,
  textTemplate,
} from "./lib/localization-schema.mjs";

const zh = [{
  id: "country:PRU",
  tag: "PRU",
  name_zh: "普鲁士",
  capital: {
    id: "state_region:STATE_BRANDENBURG",
    key: "STATE_BRANDENBURG",
    name_zh: "勃兰登堡",
  },
}];
const en = [{
  id: "country:PRU",
  tag: "PRU",
  name_zh: "Prussia",
  capital: {
    id: "state_region:STATE_BRANDENBURG",
    key: "STATE_BRANDENBURG",
    name_zh: "Brandenburg",
  },
}];

const result = splitLocalizedTrees({ "zh-Hans": zh, en });
assert.deepEqual(result.structure, [{
  id: "country:PRU",
  tag: "PRU",
  loc: { name: "country:PRU.name" },
  capital: {
    id: "state_region:STATE_BRANDENBURG",
    key: "STATE_BRANDENBURG",
    loc: { name: "state_region:STATE_BRANDENBURG.name" },
  },
}]);
assert.equal(result.catalogs.en["country:PRU.name"], "Prussia");
assert.equal(result.catalogs["zh-Hans"]["state_region:STATE_BRANDENBURG.name"], "勃兰登堡");
assert.deepEqual(textTemplate("template.modifierSummary", {
  name: { message: "modifier:authority.name" },
  value: "+10%",
}), {
  template: "template.modifierSummary",
  args: {
    name: { message: "modifier:authority.name" },
    value: "+10%",
  },
});
assert.deepEqual([...collectLocalizationRefs(result.structure)].sort(), [
  "country:PRU.name",
  "state_region:STATE_BRANDENBURG.name",
]);

const empty = splitLocalizedTrees({
  "zh-Hans": [{ id: "culture:sample", name_zh: "样本" }],
  en: [{ id: "culture:sample", name_zh: "" }],
});
assert.deepEqual(empty.missing.en, ["culture:sample.name"]);
assert.throws(
  () => splitLocalizedTrees({ "zh-Hans": [{ id: "country:PRU", tag: "PRU" }], en: [{ id: "country:PRU", tag: "BAD" }] }),
  /en.*\$\[0\]\.tag/,
);

console.log("localization_schema: ok");
