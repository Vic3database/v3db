import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("site/app/content-dynamic-text.js", "utf8");
const context = { escapeHtml: (value) => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;") };
vm.runInNewContext(source, context, { filename: "site/app/content-dynamic-text.js" });

const { readableContentText, readableContentHtml } = context;
assert.equal(typeof readableContentText, "function", "shared readable text converter must be defined");
assert.equal(readableContentText("[ROOT.GetCountry.GetName]的[ROOT.GetCountry.GetRuler.GetPrimaryRoleTitle]"), "（当前国家）的（统治者头衔）");
assert.equal(readableContentText("[ROOT.GetCountry.GetRuler.GetFullName]"), "（统治者姓名）");
assert.equal(readableContentText("[SCOPE.sCharacter('romeo').GetFullName]"), "（相关人物姓名）");
assert.equal(readableContentText("[SCOPE.sLaw('current_law_scope').GetName]"), "（当前法律）");
assert.equal(readableContentText("[SCOPE.gsInterestGroup('relevant_ig').GetName]"), "（相关利益集团）");
assert.equal(readableContentText("[SCOPE.sParty('ruling_party').GetName]"), "（相关政党）");
assert.equal(readableContentText("[SCOPE.sPoliticalLobby('relevant_lobby').GetName]"), "（相关游说团）");
assert.equal(readableContentText("[SCOPE.sState('capital_scope').GetCityHubName]"), "（相关城市）");
assert.equal(readableContentText("[GetGeographicRegion('geographic_region_angola').GetNameNoFormatting]"), "（安哥拉地区）");
assert.equal(readableContentText("[SCOPE.sGoods('coal_scope').GetName]"), "（煤炭）");
assert.equal(readableContentText("[Unknown.GetMystery]"), "（动态内容）");
assert.equal(readableContentText("[concept_heir]"), "[concept_heir]", "concept links must remain intact");
const html = readableContentHtml("由[ROOT.GetCountry.GetRuler.GetPrimaryRoleTitle]决定");
assert.match(html, /class="dynamic-content-token"/);
assert.match(html, /title="\[ROOT\.GetCountry\.GetRuler\.GetPrimaryRoleTitle\]"/);
assert.match(html, /（统治者头衔）/);
assert.doesNotMatch(html, /<script/i, "converter output must remain escaped HTML");

console.log(JSON.stringify({ content_dynamic_text: "ok", checked: 14 }, null, 2));
