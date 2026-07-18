init().catch((error) => {
  console.error(error);
  setOptionalText(els.metaLine, `数据加载失败：${error?.message || String(error)}`);
});
