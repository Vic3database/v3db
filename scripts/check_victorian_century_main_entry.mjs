import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const mainIndex = fs.readFileSync(path.join(root, "site", "index.html"), "utf8");
const versionsFile = path.join(root, "site", "versions.js");
const uiFile = path.join(root, "site", "app", "ui.js");
const stylesFile = fs.readFileSync(path.join(root, "site", "styles.css"), "utf8");
const foundationStyles = fs.readFileSync(path.join(root, "site", "styles", "foundation.css"), "utf8");
const publishRoot = path.join(root, "site", "vc");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(versionsFile, "utf8"), sandbox, { filename: versionsFile });
const libraries = JSON.parse(JSON.stringify(sandbox.window.VIC3_VERSION_CONFIG?.libraries || []));

assert.deepEqual(libraries, [
  { id: "vic3", label: "Victoria 3 原版 1.13.9", href: "./" },
  { id: "victorian-century", label: "Victorian Century", href: "vc/index.html" },
]);
assert.match(mainIndex, /id="vcHomeEntry"/, "main homepage must expose the VC entry");
assert.match(mainIndex, /href="vc\/index\.html"/, "main VC entry must target the VC homepage instead of its directory");
assert.match(mainIndex, /id="librarySelect"/, "main top bar must expose the library selector");
assert.match(fs.readFileSync(uiFile, "utf8"), /new URL\("\.\.\/index\.html", window\.location\.href\)/, "VC selector must target the main homepage instead of its directory");
assert.match(mainIndex, /versions\.js\?v=20260729-vc-library-navigation1/, "main page must refresh the library config cache version");
assert.match(mainIndex, /app\/ui\.js\?v=20260729-vc-library-navigation1/, "main page must refresh the UI cache version");
assert.match(stylesFile, /styles\/home\.css\?v=20260729-vc-entry1/, "home stylesheet must refresh the cache version");
assert.match(foundationStyles, /\.topbar-icon-select select\s*\{[\s\S]*?color-scheme:\s*dark/, "library selector must request a dark native menu");
assert.match(foundationStyles, /\.topbar-icon-select select option\s*\{[\s\S]*?color:\s*#181715/, "library selector options must use dark text on the native white menu");
for (const file of ["index.html", "data-index.js", "map-data.js", "victorian-century-config.js", "assets/map/provinces.png"]) {
  assert.ok(fs.existsSync(path.join(publishRoot, file)), `missing published VC file: vc/${file}`);
}

console.log(JSON.stringify({ victorian_century_main_entry: "ok" }));
