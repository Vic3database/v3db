import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function readText(file) {
  return fs.readFileSync(file, "utf8");
}

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated ${name}`);
}

function loadLocaleChunk(file, key) {
  const context = { window: {} };
  vm.runInNewContext(readText(file), context, { filename: file });
  return context.window.VIC3_LOCALE_CHUNKS[key].messages;
}

const extractor = Function(`return (${functionSource(readText("scripts/extract_vic3_countries.mjs"), "cleanLocalizationText")});`)();
const runtimeCleaner = Function(`return (${functionSource(readText("site/app/components.js"), "cleanGameLocalizationText")});`)();
const styledText = "#lore This group supports the leadership of an #italic Imam#!, and promotes an order.#!";
const cleanedText = "This group supports the leadership of an Imam, and promotes an order.";

assert.equal(extractor(styledText, new Map()), cleanedText, "data extraction must remove both opening and closing game style markers");
assert.equal(runtimeCleaner("This group supports the leadership of an Imam!, and promotes an order.!"), cleanedText, "the page must also clean legacy punctuation-adjacent marker remnants");
assert.equal(runtimeCleaner("这个集团支持伊玛目!，并主张理想秩序。!"), "这个集团支持伊玛目，并主张理想秩序。", "the page must clean legacy marker remnants before Chinese punctuation");

const ideologyMessages = loadLocaleChunk("site/versions/1.13.9/locale-ideologies.en.js", "en:ideology:locale-ideologies");
assert.equal(ideologyMessages["ideology:ideology_ibadi_imamate.description"], "This group supports the leadership of an Imam, and promotes the political supremacy of the Imamate and an ideal political-religious order.", "rebuilt English ideology data must not retain style-marker exclamation marks");
assert.equal(ideologyMessages["ideology:ideology_ibadi_shura.description"].includes("!"), false, "a second punctuation-adjacent style marker must also be removed");

console.log("Localization markup cleanup checks passed.");
