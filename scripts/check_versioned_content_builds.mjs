import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const version = "1.13.11";
const database = path.join(root, "database", `vic3_${version}`);
const site = path.join(root, "site", "versions", version);

const result = spawnSync(process.execPath, [
  path.join(root, "scripts", "build_vanilla_content_site_data.mjs"),
  "--version", version,
  "--database", database,
  "--site", site,
], { cwd: root, encoding: "utf8" });

assert.equal(result.status, 0, `versioned content build failed:\n${result.stdout}\n${result.stderr}`);
assert(fs.existsSync(path.join(site, "data-events.js")), "versioned event chunk is missing");
assert(fs.existsSync(path.join(site, "data-content.js")), "versioned shared content chunk is missing");
assert(fs.existsSync(path.join(site, "locale-events.zh-Hans.js")), "versioned Chinese event locale is missing");
assert(fs.existsSync(path.join(site, "locale-events.en.js")), "versioned English event locale is missing");

console.log(JSON.stringify({ versioned_content_builds: "ok", version }, null, 2));
