import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const dataPath = path.join(process.cwd(), "site/versions/1.13.9/data-cultures.js");
const raw = fs.readFileSync(dataPath, "utf8");
const data = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf(";")));

function names(items) {
  return new Set((items || []).map((item) => item?.name_zh).filter(Boolean));
}

const european = data.cultureTraitGroups.find((item) => item.key === "heritage_group_european");
assert.ok(european, "European heritage group is missing");
assert.ok(
  names(data.cultureTraits.filter((item) => item.group_key === european.key)).has("高卢"),
  "European heritage group must include Gaulish heritage",
);
assert.ok(
  names(data.cultures.filter((item) => item.heritage?.key === "heritage_latin_american_settler")).has("阿根廷"),
  "Latin American settler heritage must include Argentine culture",
);
assert.ok(
  names(data.cultureTraits.filter((item) => item.group_key === "language_group_bantu")).has("斯瓦希里语"),
  "Bantu language group must include Swahili",
);
assert.ok(
  names(data.cultures.filter((item) => item.language?.key === "language_hispanophone")).has("西班牙"),
  "Hispanophone language must include Spanish culture",
);
assert.ok(
  names(data.cultures.filter((item) => (item.traditions || []).some((trait) => trait.key === "tradition_rumelian"))).has("阿尔巴尼亚"),
  "Rumelian tradition must include Albanian culture",
);
assert.ok(
  names(data.cultures.find((item) => item.key === "afro_brazilian")?.obsessions).has("咖啡"),
  "Afro-Brazilian culture must include coffee obsession",
);
assert.ok(
  names(data.cultures.find((item) => item.key === "japanese")?.taboos).has("肉类"),
  "Japanese culture must include meat taboo",
);

console.log(JSON.stringify({ culture_tooltip_relations: "ok" }));
