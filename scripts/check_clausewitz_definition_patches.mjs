import assert from "node:assert/strict";
import {
  applyDefinitionAssignment,
  parseDefinitionDirective,
} from "./lib/clausewitz-definition-patches.mjs";

const node = (assignments = [], items = []) => ({ assignments, items });
const assignment = (key, value) => ({ key, op: "=", value });
const scalar = (key, value) => assignment(key, String(value));
const definitions = new Map();

applyDefinitionAssignment(definitions, assignment("pm_wooden_buildings", node([
  scalar("texture", "wooden.dds"),
  assignment("building_modifiers", node([
    assignment("workforce_scaled", node([
      scalar("goods_input_fabric_add", 25),
      scalar("goods_input_wood_add", 75),
    ])),
    assignment("level_scaled", node([scalar("building_employment_laborers_add", 800)])),
  ])),
  assignment("state_modifiers", node([
    assignment("workforce_scaled", node([scalar("state_construction_mult", 0.002)])),
  ])),
])), "base/13_construction.txt");
applyDefinitionAssignment(definitions, assignment("INJECT:pm_wooden_buildings", node([
  assignment("building_modifiers", node([
    assignment("workforce_scaled", node([
      scalar("goods_input_fabric_add", 5),
      scalar("goods_input_wood_add", 15),
    ])),
  ])),
  assignment("state_modifiers", node([
    assignment("workforce_scaled", node([scalar("state_construction_mult", -0.001)])),
  ])),
])), "mod/joi_methods.txt", { modStage: true });

applyDefinitionAssignment(definitions, assignment("pm_dye_production", node([
  assignment("building_modifiers", node([
    assignment("workforce_scaled", node([scalar("goods_input_fertilizer_add", 30)])),
  ])),
])), "base/08_textile_mills.txt");
applyDefinitionAssignment(definitions, assignment("INJECT:pm_dye_production", node([
  assignment("building_modifiers", node([
    assignment("workforce_scaled", node([scalar("goods_input_fertilizer_add", -5)])),
  ])),
])), "mod/joi_methods.txt", { modStage: true });

applyDefinitionAssignment(definitions, assignment("pmg_banana_exploitation", node([
  assignment("production_methods", node([], [
    "default_labour",
    "slave_exploitation_banana",
    "worker_exploitation_banana",
  ])),
])), "base/04_plantations.txt");
applyDefinitionAssignment(definitions, assignment("INJECT:pmg_banana_exploitation", node([
  assignment("production_methods", node([], ["worker_exploitation_banana", "united_fruit_banana"])),
])), "mod/joi_plantations.txt", { modStage: true });

applyDefinitionAssignment(definitions, assignment("building_rye_farm", node([
  scalar("icon", "rye.dds"),
])), "base/01_farms.txt");
applyDefinitionAssignment(definitions, assignment("TRY_INJECT:building_rye_farm", node([
  assignment("can_build_private", node([scalar("vc_private_rule", "yes")])),
])), "mod/joi_buildings.txt", { modStage: true });
applyDefinitionAssignment(definitions, assignment("TRY_INJECT:missing_building", node([
  scalar("enabled", "yes"),
])), "mod/missing.txt", { modStage: true });

applyDefinitionAssignment(definitions, assignment("building_opium_plantation", node([
  scalar("icon", "old.dds"),
  scalar("building_group", "bg_plantations"),
])), "base/04_plantations.txt");
applyDefinitionAssignment(definitions, assignment("REPLACE:building_opium_plantation", node([
  scalar("icon", "replacement.dds"),
  scalar("building_group", "bg_plantations"),
])), "mod/joi_opium.txt", { modStage: true });

applyDefinitionAssignment(definitions, assignment("CREATE:united_fruit_banana", node([
  scalar("texture", "banana.dds"),
])), "mod/joi_methods.txt", { modStage: true });
applyDefinitionAssignment(definitions, assignment("REPLACE_OR_CREATE:bg_mining", node([
  scalar("parent_group", "bg_extraction"),
])), "mod/joi_groups.txt", { modStage: true });

const read = (root, ...keys) => keys.reduce(
  (value, key) => value.assignments.find((item) => item.key === key).value,
  root,
);
const wooden = definitions.get("pm_wooden_buildings");

assert.deepEqual(
  parseDefinitionDirective("TRY_INJECT:building_rye_farm"),
  { directive: "TRY_INJECT", key: "building_rye_farm" },
);
assert.deepEqual(
  parseDefinitionDirective("pm_wooden_buildings"),
  { directive: "DEFINE", key: "pm_wooden_buildings" },
);
assert.equal(read(wooden.node, "building_modifiers", "workforce_scaled", "goods_input_fabric_add"), "30");
assert.equal(read(wooden.node, "building_modifiers", "workforce_scaled", "goods_input_wood_add"), "90");
assert.equal(read(wooden.node, "state_modifiers", "workforce_scaled", "state_construction_mult"), "0.001");
assert.equal(read(wooden.node, "building_modifiers", "level_scaled", "building_employment_laborers_add"), "800");
assert.equal(
  read(definitions.get("pm_dye_production").node, "building_modifiers", "workforce_scaled", "goods_input_fertilizer_add"),
  "25",
);
assert.deepEqual(
  read(definitions.get("pmg_banana_exploitation").node, "production_methods").items,
  ["default_labour", "slave_exploitation_banana", "worker_exploitation_banana", "united_fruit_banana"],
);
assert.equal(read(definitions.get("building_rye_farm").node, "icon"), "rye.dds");
assert.equal(read(definitions.get("building_rye_farm").node, "can_build_private", "vc_private_rule"), "yes");
assert.equal(definitions.has("missing_building"), false);
assert.equal(read(definitions.get("building_opium_plantation").node, "icon"), "replacement.dds");
assert.equal(definitions.get("building_opium_plantation").node.assignments.length, 2);
assert.deepEqual(wooden.source_files, ["base/13_construction.txt", "mod/joi_methods.txt"]);
assert.deepEqual(wooden.patch_directives, ["INJECT"]);
assert.deepEqual(definitions.get("building_rye_farm").patch_directives, ["TRY_INJECT"]);
assert.deepEqual(definitions.get("building_opium_plantation").patch_directives, ["REPLACE"]);
assert.deepEqual(definitions.get("united_fruit_banana").patch_directives, ["CREATE"]);
assert.deepEqual(definitions.get("bg_mining").patch_directives, ["REPLACE_OR_CREATE"]);

assert.throws(
  () => applyDefinitionAssignment(definitions, assignment("INJECT:absent", node()), "mod/error.txt", { modStage: true }),
  /INJECT.*absent.*mod\/error\.txt/,
);
assert.throws(
  () => applyDefinitionAssignment(definitions, assignment("REPLACE:absent", node()), "mod/error.txt", { modStage: true }),
  /REPLACE.*absent.*mod\/error\.txt/,
);
assert.throws(
  () => applyDefinitionAssignment(definitions, assignment("CREATE:pm_wooden_buildings", node()), "mod/error.txt", { modStage: true }),
  /CREATE.*pm_wooden_buildings/,
);

console.log(JSON.stringify({
  clausewitz_definition_patches: "ok",
  definitions: definitions.size,
}, null, 2));
