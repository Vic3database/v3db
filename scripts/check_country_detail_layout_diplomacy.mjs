import assert from "node:assert/strict";
import fs from "node:fs";

const presentation = fs.readFileSync("site/app/presentation.js", "utf8");
const styles = fs.readFileSync("site/styles/country-detail.css", "utf8");

assert.match(presentation, /function countryOverviewCard\s*\(/, "country overview must use dedicated cards");
assert.match(presentation, /country-overview-card/, "country overview cards are missing");
assert.match(presentation, /country-diplomacy-target/, "diplomacy cards must separate the target country");
assert.match(presentation, /country-diplomacy-kind/, "diplomacy cards must separate relationship metadata");
assert.match(styles, /\.country-overview-card\s*\{/, "country overview card styles are missing");
assert.match(styles, /\.country-diplomacy-kind\.is-positive/, "positive relation values need a visual state");
assert.match(styles, /\.country-diplomacy-kind\.is-negative/, "negative relation values need a visual state");
assert.match(styles, /\.country-diplomacy-record\s*\{[\s\S]*justify-content: space-between/, "diplomacy records must keep target and relation aligned");
assert.match(styles, /\.country-diplomacy-kind\s*\{[\s\S]*max-width: 54%/, "diplomacy metadata must have a bounded width");

console.log("country_detail_layout_diplomacy: ok");
