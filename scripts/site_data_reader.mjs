import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

export function readChunkedSiteData(root, relativeVersionDir = "site/versions/1.13.9") {
  const versionDir = path.join(root, relativeVersionDir);
  const indexFile = path.join(versionDir, "data-index.js");
  const indexContext = { window: {} };
  vm.runInNewContext(fs.readFileSync(indexFile, "utf8"), indexContext, { filename: indexFile });
  const index = indexContext.window.VIC3_DATA_INDEX || {};
  const data = { meta: index.meta || {} };
  for (const chunk of Object.values(index.chunks || {})) {
    for (const file of chunk.files || []) {
      const chunkFile = path.join(versionDir, file);
      const chunkContext = { window: {} };
      vm.runInNewContext(fs.readFileSync(chunkFile, "utf8"), chunkContext, { filename: chunkFile });
      const value = chunkContext.window.VIC3_DATA_CHUNK || {};
      for (const [field, rows] of Object.entries(value)) {
        data[field] = field === "countries" ? [...(data[field] || []), ...(rows || [])] : rows;
      }
    }
  }
  return data;
}
