import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = parseArgs(process.argv.slice(2));
const oldDir = path.resolve(args.old || path.join(root, "database", "vic3_1.13.10"));
const newDir = path.resolve(args.new || path.join(root, "database", "vic3_1.13.11"));
const outJson = path.resolve(args.json || path.join(root, "docs", "worklog", "2026-08-19-victoria-1.13.11-diff.json"));
const outMarkdown = path.resolve(args.markdown || path.join(root, "docs", "worklog", "2026-08-19-victoria-1.13.11-diff.md"));

const files = [...new Set([...listJsonFiles(oldDir), ...listJsonFiles(newDir)])]
  .filter((file) => !["index.json", "content-index.json"].includes(file))
  .sort();
const reports = files.map((relativeFile) => compareFile(relativeFile));
const summary = {
  old_version: readVersion(oldDir),
  new_version: readVersion(newDir),
  compared_files: reports.length,
  changed_files: reports.filter((item) => item.changed).length,
  added_files: reports.filter((item) => item.status === "added").length,
  removed_files: reports.filter((item) => item.status === "removed").length,
  reports,
};

fs.mkdirSync(path.dirname(outJson), { recursive: true });
fs.writeFileSync(outJson, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
fs.writeFileSync(outMarkdown, renderMarkdown(summary), "utf8");
console.log(JSON.stringify({ full_database_diff: "ok", compared_files: summary.compared_files, changed_files: summary.changed_files, added_files: summary.added_files, removed_files: summary.removed_files }, null, 2));

function compareFile(relativeFile) {
  const oldFile = path.join(oldDir, relativeFile);
  const newFile = path.join(newDir, relativeFile);
  const oldExists = fs.existsSync(oldFile);
  const newExists = fs.existsSync(newFile);
  if (!oldExists) return { file: relativeFile, status: "added", changed: true, old_count: 0, new_count: countValue(readJson(newFile)), added: countValue(readJson(newFile)), removed: 0, changed_records: 0, samples: [] };
  if (!newExists) return { file: relativeFile, status: "removed", changed: true, old_count: countValue(readJson(oldFile)), new_count: 0, added: 0, removed: countValue(readJson(oldFile)), changed_records: 0, samples: [] };
  const oldValue = readJson(oldFile);
  const newValue = readJson(newFile);
  if (Array.isArray(oldValue) && Array.isArray(newValue)) return compareArrays(relativeFile, oldValue, newValue);
  return { file: relativeFile, status: "present", changed: stable(oldValue) !== stable(newValue), old_count: countValue(oldValue), new_count: countValue(newValue), added: 0, removed: 0, changed_records: stable(oldValue) === stable(newValue) ? 0 : 1, samples: [] };
}

function compareArrays(file, oldRows, newRows) {
  const oldMap = keyed(oldRows);
  const newMap = keyed(newRows);
  const added = [...newMap.keys()].filter((key) => !oldMap.has(key));
  const removed = [...oldMap.keys()].filter((key) => !newMap.has(key));
  const changed = [...newMap.keys()].filter((key) => oldMap.has(key) && stable(oldMap.get(key)) !== stable(newMap.get(key)));
  return { file, status: "present", changed: added.length > 0 || removed.length > 0 || changed.length > 0, old_count: oldRows.length, new_count: newRows.length, added: added.length, removed: removed.length, changed_records: changed.length, samples: [...added.map((key) => `+ ${key}`), ...removed.map((key) => `- ${key}`), ...changed.map((key) => `~ ${key}`)].slice(0, 12) };
}

function keyed(rows) {
  const map = new Map();
  rows.forEach((row, index) => {
    const identity = row && typeof row === "object" ? (row.key ?? row.id ?? row.tag ?? row.code ?? row.name ?? `@${index}`) : `@${index}`;
    const base = String(identity);
    let key = base;
    let suffix = 2;
    while (map.has(key)) key = `${base}#${suffix++}`;
    map.set(key, row);
  });
  return map;
}

function listJsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = entry.name;
    if (entry.isDirectory()) return listJsonFiles(path.join(directory, entry.name)).map((file) => path.join(relative, file));
    return entry.name.endsWith(".json") ? [relative] : [];
  });
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")); }
function readVersion(directory) { const index = path.join(directory, "index.json"); return fs.existsSync(index) ? readJson(index).victoria3_version || "" : ""; }
function countValue(value) { return Array.isArray(value) ? value.length : value && typeof value === "object" ? Object.keys(value).length : value == null ? 0 : 1; }
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).sort().join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function renderMarkdown(report) {
  const changed = report.reports.filter((item) => item.changed);
  const oldVersion = path.basename(oldDir).replace(/^vic3_/, "");
  const newVersion = path.basename(newDir).replace(/^vic3_/, "");
  const lines = [`# Victoria 3 ${oldVersion} → ${newVersion} 全库差异`, "", `比较文件：${report.compared_files} 个；发生差异：${report.changed_files} 个；新增文件：${report.added_files} 个；删除文件：${report.removed_files} 个。`, "", `| 数据文件 | ${oldVersion} 数量 | ${newVersion} 数量 | 新增 | 删除 | 变化记录 |`, "| --- | ---: | ---: | ---: | ---: | ---: |"];
  for (const item of changed) lines.push(`| ${item.file} | ${item.old_count} | ${item.new_count} | ${item.added} | ${item.removed} | ${item.changed_records} |`);
  lines.push("", "## 变化样本", "");
  for (const item of changed.filter((entry) => entry.samples.length).slice(0, 80)) lines.push(`- ${item.file}：${item.samples.join("；")}`);
  return `${lines.join("\n")}\n`;
}

function parseArgs(values) {
  const parsed = { old: "", new: "", json: "", markdown: "" };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (["--old", "--new", "--json", "--markdown"].includes(value)) {
      parsed[value.slice(2)] = values[index + 1] || "";
      if (!parsed[value.slice(2)]) throw new Error(`Missing value for ${value}`);
      index += 1;
    } else if (value === "--help" || value === "-h") {
      console.log("Usage: node scripts/compare_version_databases.mjs [--old <dir>] [--new <dir>] [--json <file>] [--markdown <file>]");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${value}`);
  }
  return parsed;
}
