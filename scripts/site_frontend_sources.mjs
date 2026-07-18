import fs from "node:fs";
import path from "node:path";

export const appSections = [
  "app/runtime.js",
  "app/data.js",
  "app/ui.js",
  "app/boards.js",
  "app/filters.js",
  "app/presentation.js",
  "app/map.js",
  "app/components.js",
  "app/bootstrap.js",
];

export const styleSections = [
  "styles/foundation.css",
  "styles/filters.css",
  "styles/map.css",
  "styles/records.css",
  "styles/shell.css",
  "styles/home.css",
  "styles/dialogs.css",
  "styles/technology.css",
];

export function readSiteAppSource(root) {
  return readSections(root, appSections);
}

export function readSiteStyleSource(root) {
  return readSections(root, styleSections);
}

function readSections(root, sections) {
  return sections.map((section) => (
    fs.readFileSync(path.join(root, "site", section), "utf8").replace(/^\uFEFF/, "")
  )).join("\n");
}
