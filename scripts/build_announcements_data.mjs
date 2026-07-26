import fs from "node:fs";
import path from "node:path";
import { parseAnnouncements, serializeAnnouncements } from "./lib/announcements.mjs";

const root = path.resolve(process.argv[2] || process.cwd());
const sourceFile = path.join(root, "announcements.md");
const outputFile = path.join(root, "site", "announcement-data.js");
const items = parseAnnouncements(fs.readFileSync(sourceFile, "utf8"));

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, serializeAnnouncements(items), "utf8");
console.log(JSON.stringify({ announcements: items.length, output: path.relative(root, outputFile) }));
