import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const scriptPath = path.join(process.cwd(), "scripts", "deploy-vicdata.sh");
assert.ok(fs.existsSync(scriptPath), "deploy-vicdata.sh is missing");
const source = fs.readFileSync(scriptPath, "utf8");

assert.match(source, /^#!\/bin\/sh/m, "deployment script must use POSIX sh");
assert.match(source, /STAGE=\$\{1:\?/, "deployment script must require a stage directory argument");
assert.match(source, /STAGE_PARENT.*\/home\/vicadmin/, "deployment script must only accept vicadmin staging directories");
assert.match(source, /vicdata-stage-\*/, "deployment script must require a vicdata staging directory name");
assert.match(source, /versions\/1\.13\.9\/data-technologies\.js/, "deployment script must verify the current data bundle");
assert.match(source, /site\.previous-\$STAMP/, "deployment script must retain timestamped rollback directories");
assert.match(source, /mv "\$TARGET" "\$PREVIOUS"/, "deployment script must retain the active site before switching");
assert.match(source, /mv "\$STAGE" "\$TARGET"/, "deployment script must atomically activate the validated stage");
assert.doesNotMatch(source, /\b(chown|nginx|systemctl|rm -rf)\b/, "content-only deployment must not require root operations or delete the rollback directory");

console.log(JSON.stringify({ deploy_vicdata_script: "ok" }));
