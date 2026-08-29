import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("site/index.html", "utf8");
assert.match(source, /<script src="app\/characters\.js\?v=[^"]+"><\/script>/, "root homepage must load the character board module");
assert.match(source, /<script src="app\/name-pools\.js\?v=[^"]+"><\/script>/, "root homepage must load the name-pool board module");
assert.ok(source.indexOf("app/characters.js") < source.indexOf("app/bootstrap.js"), "character module must load before homepage initialization");
assert.ok(source.indexOf("app/name-pools.js") < source.indexOf("app/bootstrap.js"), "name-pool module must load before homepage initialization");
console.log("homepage_init_contract: ok");
