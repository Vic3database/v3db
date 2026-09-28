import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const file = process.argv[2] || "site/vc/changelogs/441298602252521480.js";
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
const data = sandbox.window.VIC3_VC_CHANGELOG_DATA;
assert.equal(data?.newManifest, "441298602252521480", "new manifest must match the current VC update");
assert.equal(data?.oldManifest, "6136745052571973354", "old manifest must match the previous VC snapshot");
assert.ok(Array.isArray(data?.changes) && data.changes.length > 0, "VC changelog must contain grouped changes");
for (const group of data.changes) {
  assert.ok(group.board && group.field, "every group must identify its board and field");
  assert.ok(Array.isArray(group.members) && group.members.length > 0, "every group must retain members");
  assert.equal(group.memberCount, group.members.length, "memberCount must match members");
  assert.equal(group.field.includes("value_raw"), false, "technical value_raw mirrors must not create visible groups");
}
const countryGroups = data.changes.filter((group) => group.board === "country" && group.field.includes("interest_groups"));
assert.ok(countryGroups.length > 0, "country interest-group changes must be grouped");
assert.ok(countryGroups.some((group) => group.members.length > 1), "identical country changes must share a group");
const countryMember = countryGroups.flatMap((group) => group.members).find((member) => member.key === "ANH");
assert.ok(countryMember && countryMember.title && countryMember.title !== "ANH", "country members must expose localized Chinese names");
assert.ok(countryMember.titleEn && countryMember.titleEn !== "ANH", "country members must expose localized English names");
assert.equal(countryMember.icon?.kind, "country", "country members must expose a flag icon descriptor");
assert.ok(countryGroups.some((group) => group.fieldLabel?.includes("实业家") && group.fieldLabel?.includes("加成")), "country interest-group changes must have semantic Chinese labels");
const companyGroups = data.changes.filter((group) => group.board === "company");
assert.ok(companyGroups.some((group) => group.details?.some((detail) => detail.fieldLabel?.startsWith("繁荣时"))), "company prosperity changes must have translated labels");
assert.ok(companyGroups.some((group) => group.members.some((member) => member.icon?.kind === "company")), "company members must expose icon descriptors");
const traitGroups = data.changes.filter((group) => group.board === "interestGroupTrait");
assert.ok(traitGroups.some((group) => group.members.some((member) => member.icon?.kind === "trait" && member.icon.interestGroup?.texture)), "interest-group traits must expose both trait and interest-group icons");
const ricordi = data.changes.find((group) => group.board === "company" && group.members.some((member) => member.key === "company_ricordi"));
assert.ok(ricordi && ricordi.details?.length >= 2, "company changes must group multiple modifiers under one company");
assert.equal(new Set(data.changes.map((group) => group.id)).size, data.changes.length, "group IDs must be unique");
console.log(JSON.stringify({ vc_changelog: "ok", file, groups: data.changes.length, countryInterestGroups: countryGroups.length }, null, 2));
