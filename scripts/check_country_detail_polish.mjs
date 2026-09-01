import assert from "node:assert/strict";
import fs from "node:fs";

const presentation = fs.readFileSync("site/app/presentation.js", "utf8");
const components = fs.readFileSync("site/app/components.js", "utf8");
const boards = fs.readFileSync("site/app/boards.js", "utf8");
const styles = fs.readFileSync("site/styles/country-detail.css", "utf8");
const homeStyles = fs.readFileSync("site/styles/home.css", "utf8");

assert.match(presentation, /const religion = country\.religion[\s\S]*religionByKey/, "country overview must resolve religion through the localized religion map");
assert.match(presentation, /interestGroupDetailHref|#\/interest-group\//, "country interest-group details must provide a link to the group detail");
assert.match(presentation, /group\.display_name[\s\S]*entityText\(group\.display_name/, "flavor name must be preferred before the base interest-group name");
assert.match(styles, /country-interest-group-detail-link/, "country interest-group detail link needs a dedicated style");
assert.match(boards, /function interestGroupTraitApprovalOrder\s*\(/, "all interest-group approval content must use one fixed approval order");
assert.match(homeStyles, /\.interest-group-trait-slot-list\s*\{[\s\S]*grid-auto-flow:\s*row/, "all interest-group approval cards must keep row-major ordering");
assert.match(components, /function interestGroupTraitDetailCard[\s\S]*cleanDescriptionText/, "interest-group trait descriptions must use the full cleaned text");
assert.match(homeStyles, /\.interest-group-board-description\s*\{[\s\S]*max-height:\s*none/, "interest-group board descriptions must not be clipped");
assert.match(homeStyles, /\.interest-group-detail-heading \.interest-group-detail-description\s*\{[\s\S]*max-height:\s*none/, "interest-group detail descriptions must not be clipped");
assert.match(presentation, /countryFlagVariantSection\(country\)\s*\|\|\s*""/, "country variants must keep the flag variant section visible");
const flagSection = functionSource(components, "countryFlagVariantSection");
assert.doesNotMatch(flagSection, /collapsibleDetailSection\(/, "country flag variants must not be wrapped in a collapsed details element");

console.log("country_detail_polish: ok");

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `missing ${name}`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated ${name}`);
}
