import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const database = path.join(root, "database", "victorian_century");
const read = (name) => JSON.parse(fs.readFileSync(path.join(database, name), "utf8"));
const journals = read("journal_entries.json");
const events = read("events.json");
const decisions = read("decisions.json");
assert.equal(events.filter((row) => row.vc_change_kind === "added").length, 683, "VC-added event count");
assert.equal(events.filter((row) => row.vc_change_kind === "adjusted").length, 12, "VC-adjusted event count");
assert.equal(events.filter((row) => row.sources?.length === 2 && !row.vc_change_kind).length, 14, "identical VC overrides must not receive an adjusted tag");
assert.equal(journals.filter((row) => row.vc_change_kind === "added").length, 439, "VC-added journal count");
assert.equal(journals.filter((row) => row.vc_change_kind === "adjusted").length, 39, "VC-adjusted journal count");
assert.equal(journals.find((row) => row.id === "je_autocracy")?.vc_change_kind, "adjusted", "VC REPLACE_OR_CREATE journal overrides must receive an adjusted tag");
assert.equal(decisions.filter((row) => row.sources?.length === 1 && row.sources[0] === "vc").length, 42, "VC-only decision count");
assert.ok(journals.some((row) => row.sources?.length === 1 && row.sources[0] === "vc"), "journals must retain VC-only provenance");
console.log(JSON.stringify({ victorian_century_content_change_contract: "ok", events: { added: 683, adjusted: 12, identicalOverrides: 14 }, journals: { added: 439, adjusted: 39 }, decisionsVcOnly: 42 }, null, 2));
