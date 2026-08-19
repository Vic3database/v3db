import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const version = process.argv[2] || "1.13.9";
const versionPath = path.join(root, "site", "versions", version);
const index = readGlobal(path.join(versionPath, "data-index.js"), "VIC3_DATA_INDEX");
const eventChunk = readGlobal(path.join(versionPath, "data-events.js"), "VIC3_DATA_CHUNK");
const html = fs.readFileSync(path.join(root, "site", "index.html"), "utf8");
const app = ["runtime.js", "data.js", "ui.js", "events.js"].map((file) => fs.readFileSync(path.join(root, "site", "app", file), "utf8")).join("\n");

const expectedEvents = version === "1.13.9" ? 2236 : 2239;
assert.equal(index.chunks?.event?.counts?.events, expectedEvents, "published data index must expose the event chunk");
assert.equal(eventChunk.events?.length, expectedEvents, "published data chunk must contain game events");
assert.match(html, /data-nav-view="event"/, "published page must expose the event navigation");
assert.match(html, /app\/events\.js\?v=/, "published page must load the event board script");
assert.match(app, /function renderEventBoard\(/, "published app must render the event board");
assert.match(app, /replaceHash\(`\/event\/\$\{encodeURIComponent\(state\.selectedEvent\)\}`\)/, "published event cards must write an event detail route");
assert.match(app, /eventByKey\.has\(decodeURIComponent\(parts\[1\]\)\)/, "published router must resolve event detail routes");

console.log(JSON.stringify({ event_publish_target: "ok", version, events: eventChunk.events.length }, null, 2));

function readGlobal(file, name) {
  assert(fs.existsSync(file), `missing published file: ${path.relative(root, file)}`);
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox.window[name] || {};
}
