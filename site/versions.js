window.VIC3_VERSION_CONFIG = {
  site_title: "Vicdata",
  default_version: "1.13.9",
  libraries: [
    { id: "vic3", label: "Victoria 3 1.13.9", labelKey: "library.vic3", href: "./" },
    { id: "victorian-century", label: "Victorian Century", labelKey: "library.victorianCentury", href: "vc/index.html" },
  ],
  version_groups: [
    {
      id: "1.13",
      label: "1.13",
      major: 1,
      min_minor: 13,
      max_minor: 13,
    },
  ],
  versions: [
    {
      version: "1.13.9",
      label: "1.13.9",
      data_index: "versions/1.13.9/data-index.js",
      map_data: "versions/1.13.9/map-data.js",
    },
  ],
  changelogs: [],
};
