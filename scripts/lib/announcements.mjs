const headingPattern = /^##\s+(\d{4}-\d{2}-\d{2})｜(.+?)\s*$/u;

export function parseAnnouncements(source) {
  const lines = String(source).replaceAll("\r\n", "\n").split("\n");
  if (lines[0]?.trim() !== "# 站内公告") {
    throw new Error("公告文件第一行必须是 # 站内公告");
  }

  const items = [];
  let current = null;
  const finishCurrent = () => {
    if (!current) return;
    const body = current.lines.join("\n").trim();
    if (!body) throw new Error(`公告第 ${current.line} 行缺少正文`);
    items.push({ date: current.date, title: current.title, body });
  };

  lines.forEach((line, index) => {
    if (!line.startsWith("## ")) {
      if (current) current.lines.push(line);
      return;
    }
    finishCurrent();
    const match = line.match(headingPattern);
    if (!match) throw new Error(`公告第 ${index + 1} 行必须使用 YYYY-MM-DD｜标题，且同时包含日期和标题`);
    current = { date: match[1], title: match[2].trim(), line: index + 1, lines: [] };
  });
  finishCurrent();

  if (!items.length) throw new Error("公告文件至少需要一条公告");
  return items.sort((left, right) => right.date.localeCompare(left.date));
}

export function serializeAnnouncements(items) {
  return `window.VICDATA_ANNOUNCEMENTS = ${JSON.stringify(items, null, 2)};\n`;
}
