import fs from "node:fs";
import path from "node:path";
import { readSiteAppSource, readSiteStyleSource } from "./site_frontend_sources.mjs";

const root = process.cwd();
const siteRoot = path.join(root, "site");
const indexFile = path.join(siteRoot, "index.html");
const avatarFile = path.join(siteRoot, "assets", "about", "developer.jpg");

const failures = [];
const indexSource = fs.readFileSync(indexFile, "utf8");
const appSource = readSiteAppSource(root);
const stylesSource = readSiteStyleSource(root);

expect(indexSource.includes('id="aboutNavButton"'), "topbar actions should include an about dialog button");
expect(!indexSource.includes('data-nav-view="about"'), "about should not be a board navigation entry");
expect(!indexSource.includes('<option value="about">'), "hidden view selector should not include about");
expect(indexSource.includes('id="infoDialog"'), "settings and about should share an auxiliary dialog shell");
expect(appSource.includes('infoDialog: ""'), "state should track the auxiliary dialog");
expect(appSource.includes('openInfoDialog("about")'), "about button should open a dialog");
expect(appSource.includes('openInfoDialog("settings")'), "settings button should open a dialog");
expect(!appSource.includes('replaceHash("/settings")'), "settings should not switch the hash route");
expect(appSource.includes("function renderAboutDialogContent()"), "app should define about dialog content");
expect(appSource.includes("function renderSettingsDialogContent()"), "app should define settings dialog content");
expect(appSource.includes('classList.toggle("info-dialog-about", state.infoDialog === "about")'), "about dialog should receive its dedicated width class");
expect(appSource.includes("assets/about/developer.jpg"), "about dialog should reference developer avatar");
expect(appSource.includes("mailto:vic3database@outlook.com"), "about dialog should include the feedback email entry");
expect(/class="support-link"[^>]*disabled[^>]*>BUY ME A TEA<\/button>[\s\S]*class="feedback-link"/.test(appSource), "about dialog should place the disabled Buy Me a Tea button above the feedback link");
expect(stylesSource.includes(".info-dialog"), "styles should include the auxiliary dialog layout");
expect(/\.info-dialog\s*\{[\s\S]*width:\s*min\(820px,\s*100%\)/.test(stylesSource), "settings dialog should retain its existing width");
expect(/\.info-dialog-about\s*\{[\s\S]*width:\s*min\(1080px,\s*100%\)/.test(stylesSource), "about dialog should use the global search dialog width");
expect(stylesSource.includes(".support-link"), "styles should include the Buy Me a Tea button style");
expect(stylesSource.includes(".developer-avatar"), "styles should include developer avatar");
expect(fs.existsSync(avatarFile), "developer avatar should be copied into site/assets/about");

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  about_dialog: "ok",
  avatar: path.relative(root, avatarFile).replaceAll("\\", "/"),
}, null, 2));

function expect(condition, message) {
  if (!condition) failures.push(message);
}
