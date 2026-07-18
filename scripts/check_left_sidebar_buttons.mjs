import fs from "node:fs";
import path from "node:path";
import { readSiteAppSource, readSiteStyleSource } from "./site_frontend_sources.mjs";

const root = process.cwd();
const failures = [];

const appSource = readSiteAppSource(root);
const styleSource = readSiteStyleSource(root);

checkImageButtonContracts();

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({
  checked: [
    "site/app.js",
    "site/styles.css",
  ],
  left_sidebar_buttons: "ok",
}, null, 2));

function checkImageButtonContracts() {
  assert(/class="filter-token filter-token-with-icon resource-filter-token"/.test(appSource), "resource filter buttons should opt into the shared image-button class");
  assert(/class="filter-token filter-token-with-icon dlc-filter-token"/.test(appSource), "DLC filter buttons should opt into the shared image-button class");
  assert(/class="ideology-group-icon-button"/.test(appSource), "interest-group filter buttons should use the left-column image-button style");

  const imageButtonBlock = styleBlock(".filter-token-with-icon,\n.ideology-group-icon-button");
  assert(/border-color:\s*transparent/.test(imageButtonBlock), "image-backed filter buttons should not keep a visible pill border");
  assert(/background:\s*transparent/.test(imageButtonBlock), "image-backed filter buttons should not keep a pill background");
  assert(/box-shadow:\s*none/.test(imageButtonBlock), "image-backed filter buttons should not keep an inset pill frame");

  const imageHoverBlock = styleBlock(".filter-token-with-icon:hover,\n.ideology-group-icon-button:hover");
  assert(/background:\s*transparent/.test(imageHoverBlock), "image-backed filter hover should not add a card behind the PNG");
  assert(/border-color:\s*transparent/.test(imageHoverBlock), "image-backed filter hover should not show a pill border");

  const imagePressedBlock = styleBlock(".filter-token-with-icon[aria-pressed=\"true\"],\n.ideology-group-icon-button[aria-pressed=\"true\"]");
  assert(/border-color:\s*var\(--accent\)/.test(imagePressedBlock), "selected image-backed filters should use the gold selected border");
  assert(/background:\s*transparent/.test(imagePressedBlock), "selected image-backed filters should not add a card behind the PNG");
  assert(/box-shadow:\s*inset\s+0\s+0\s+0\s+1px\s+rgba\(200,\s*164,\s*91,\s*0\.36\)/.test(imagePressedBlock), "selected image-backed filters should reinforce the gold border without using an underline");

  const resourceBlock = styleBlock(".resource-filter-token");
  assert(!/border-color:\s*rgba\(/.test(resourceBlock), "resource image buttons should not reintroduce their own visible border");
  assert(!/background:\s*rgba\(/.test(resourceBlock), "resource image buttons should not reintroduce their own pill background");

  const resourceIconBlock = styleBlock(".resource-filter-token .resource-icon");
  assert(/background:\s*transparent/.test(resourceIconBlock), "resource PNGs should not keep the shared building icon card background");
  assert(/box-shadow:\s*none/.test(resourceIconBlock), "resource PNGs should not keep the shared building icon inner shadow");
  assert(/border-radius:\s*0/.test(resourceIconBlock), "resource PNGs should not keep a rounded inner card shape");

  const resourcePressedBlock = styleBlock(".resource-filter-token[aria-pressed=\"true\"]");
  assert(!/background:\s*var\(--accent\)/.test(resourcePressedBlock), "selected resource image buttons should not use the old solid pill fill");
  assert(!/background:\s*rgba\(/.test(resourcePressedBlock), "selected resource image buttons should not reintroduce a selected plate");
  assert(/border-color:\s*var\(--accent\)/.test(resourcePressedBlock), "selected resource image buttons should use the shared gold selected border");

  const resourceItemsBlock = styleBlock(".resource-filter-items");
  assert(/grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(40px,\s*1fr\)\)/.test(resourceItemsBlock), "region resource filters should use the same 40px auto-fill icon grid as company filters");
  assert(!/grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/.test(resourceItemsBlock), "region resource filters should not stretch seven columns across the whole sidebar");

  const globalControlIndex = styleSource.lastIndexOf("button,\nselect,\ninput");
  const finalImageButtonIndex = styleSource.lastIndexOf(".filter-token-with-icon,\n.ideology-group-icon-button");
  assert(globalControlIndex >= 0, "global control style block is missing");
  assert(finalImageButtonIndex > globalControlIndex, "image-backed filter button reset should come after the global button style block");
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, "");
}

function styleBlock(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styleSource.match(new RegExp(`${escaped}\\s*{([^}]*)}`, "m"));
  return match?.[1] || "";
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}
