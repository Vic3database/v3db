init().catch((error) => {
  console.error(error);
  setOptionalText(els.metaLine, t("ui.datasetLoadFailed", { message: error?.message || String(error) }));
});
