import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const styleSource = fs.readFileSync(path.join(root, "site", "styles", "shell.css"), "utf8").replace(/^\uFEFF/, "");
const entryStyleSource = fs.readFileSync(path.join(root, "site", "styles.css"), "utf8").replace(/^\uFEFF/, "");
const indexSource = fs.readFileSync(path.join(root, "site", "index.html"), "utf8").replace(/^\uFEFF/, "");
const failures = [];
const desktopMapPanel = ruleBlock(".map-panel");

assert(
  /\.map-panel\s*{[\s\S]*top:\s*12px[\s\S]*right:\s*12px[\s\S]*bottom:\s*12px[\s\S]*left:\s*12px/.test(styleSource),
  "desktop map panel should leave a 12px gap on all four sides",
);

assert(
  /\.map-viewport\s*{[\s\S]*overflow:\s*hidden[\s\S]*border:\s*1px solid rgba\(205,\s*161,\s*95,\s*0\.18\)[\s\S]*border-radius:\s*8px/.test(styleSource),
  "map viewport should clip its canvas inside the shared 8px framed corner",
);

assert(
  /background:\s*transparent/.test(desktopMapPanel),
  "map panel should stay transparent outside the rounded map viewport",
);

assert(
  /\.map-viewport canvas\s*{[\s\S]*width:\s*100%[\s\S]*height:\s*100%/.test(styleSource),
  "map canvas should continue filling the framed viewport",
);

assert(
  /styles\/shell\.css\?v=20260720-map-frame/.test(entryStyleSource),
  "map-frame stylesheet should use a new cache version",
);

assert(
  /href="styles\.css\?v=20260720-map-frame"/.test(indexSource),
  "the page entry should refresh the stylesheet cache version",
);

assert(
  /\.layout::before\s*{[\s\S]*position:\s*absolute[\s\S]*z-index:\s*1[\s\S]*top:\s*12px[\s\S]*bottom:\s*12px[\s\S]*left:\s*12px[\s\S]*width:\s*var\(--left-panel-width\)[\s\S]*background:\s*var\(--bg\)[\s\S]*pointer-events:\s*none/.test(styleSource),
  "the filter panel corner should have a dark underlay instead of exposing the map",
);

assert(
  /body\.filters-collapsed\s+\.layout::before\s*{[\s\S]*display:\s*none/.test(styleSource),
  "the filter underlay should disappear with the collapsed filter panel",
);

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({
  checked: [
    path.join("site", "styles.css"),
    path.join("site", "styles", "shell.css"),
  ],
  map_frame_layout: "ok",
}, null, 2));

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function ruleBlock(selector) {
  const start = styleSource.indexOf(selector);
  const open = styleSource.indexOf("{", start);
  const close = styleSource.indexOf("}", open);
  if (start < 0 || open < 0 || close < 0) return "";
  return styleSource.slice(start, close + 1);
}
