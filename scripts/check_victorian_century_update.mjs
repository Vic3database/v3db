import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(SCRIPT_DIR, "..");

const DEFAULTS = {
  appId: "529340",
  workshopId: "3219394272",
  datasetName: "Victorian Century",
  version: "1.13.9",
  gamePath: "D:\\SteamLibrary\\steamapps\\common\\Victoria 3",
  modPath: "D:\\SteamLibrary\\steamapps\\workshop\\content\\529340\\3219394272",
  databaseDir: path.join(PROJECT_DIR, "database", "victorian_century"),
  outDir: path.join(PROJECT_DIR, "output_victorian_century"),
  siteDir: path.join(PROJECT_DIR, "Victorian Century Database"),
  mapWidth: "8192",
  mapHeight: "3616",
};

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});

async function main() {
  const config = makeConfig(args);
  const checkOnly = Boolean(args["check-only"] || args["dry-run"]);
  const force = Boolean(args.force);
  const skipMap = Boolean(args["skip-map"]);
  const jsonOnly = Boolean(args.json);

  const currentIndex = readJsonIfExists(path.join(config.databaseDir, "index.json"));
  const previousState = readJsonIfExists(config.stateFile);
  const acf = readWorkshopAcf(config);
  const installed = acf ? extractInstalledWorkshopItem(acf, config.workshopId) : {};
  const remote = await fetchWorkshopDetails(config, { skipNetwork: Boolean(args["skip-network"]) });

  const pendingSteamDownload = hasPendingSteamDownload(remote, installed);
  const installedSource = makeInstalledSource(installed);
  const latestSource = makeLatestSource(remote, installed);
  const generatedAtMs = Date.parse(currentIndex?.generated_at || "");
  const sourceUpdatedAtMs = installedSource.timeUpdatedMs || latestSource.timeUpdatedMs || 0;
  const previousManifest = previousState?.workshop?.installed_manifest || "";
  const installedManifest = installedSource.manifest || "";
  const manifestChanged = Boolean(previousManifest && installedManifest && previousManifest !== installedManifest);
  const generatedBeforeSource = Boolean(generatedAtMs && sourceUpdatedAtMs && generatedAtMs < sourceUpdatedAtMs);
  const missingDatabase = !currentIndex;
  const needsUpdate = Boolean(force || missingDatabase || manifestChanged || generatedBeforeSource);

  const initialStatus = {
    status: pendingSteamDownload ? "steam_download_pending" : needsUpdate ? "update_available" : "up_to_date",
    check_only: checkOnly,
    force,
    workshop: {
      app_id: config.appId,
      published_file_id: config.workshopId,
      title: remote?.title || config.datasetName,
      remote_time_updated: latestSource.timeUpdated || "",
      remote_manifest: latestSource.manifest || "",
      installed_time_updated: installedSource.timeUpdated || "",
      installed_manifest: installedSource.manifest || "",
      download_progress: installed.downloadProgress || null,
    },
    database: {
      path: config.databaseDir,
      generated_at: currentIndex?.generated_at || "",
      counts: currentIndex?.counts || {},
    },
    reason: updateReason({ force, missingDatabase, manifestChanged, generatedBeforeSource, pendingSteamDownload }),
  };

  if (pendingSteamDownload) {
    printStatus(initialStatus, jsonOnly);
    return;
  }

  if (!needsUpdate) {
    printStatus(initialStatus, jsonOnly);
    return;
  }

  if (checkOnly) {
    printStatus(initialStatus, jsonOnly);
    return;
  }

  printStatus({ ...initialStatus, status: "updating" }, jsonOnly);
  await runUpdate(config, { skipMap });
  const updatedIndex = readJson(path.join(config.databaseDir, "index.json"));
  const state = makeState(config, {
    remote,
    installed,
    index: updatedIndex,
    skipMap,
  });
  writeJson(config.stateFile, state);

  printStatus({
    status: "updated",
    workshop: state.workshop,
    database: {
      path: config.databaseDir,
      generated_at: updatedIndex.generated_at,
      counts: updatedIndex.counts,
    },
    site: state.site,
  }, jsonOnly);
}

function makeConfig(parsedArgs) {
  const appId = String(parsedArgs["app-id"] || DEFAULTS.appId);
  const workshopId = String(parsedArgs["workshop-id"] || DEFAULTS.workshopId);
  const gamePath = path.resolve(String(parsedArgs["game-path"] || DEFAULTS.gamePath));
  const modPath = path.resolve(String(parsedArgs["mod-path"] || DEFAULTS.modPath));
  const databaseDir = path.resolve(String(parsedArgs.database || DEFAULTS.databaseDir));
  const siteDir = path.resolve(String(parsedArgs.site || DEFAULTS.siteDir));
  const outDir = path.resolve(String(parsedArgs.out || DEFAULTS.outDir));
  return {
    appId,
    workshopId,
    datasetName: String(parsedArgs["dataset-name"] || DEFAULTS.datasetName),
    version: String(parsedArgs.version || DEFAULTS.version),
    gamePath,
    modPath,
    databaseDir,
    siteDir,
    outDir,
    mapWidth: Number(parsedArgs["map-width"] || DEFAULTS.mapWidth),
    mapHeight: Number(parsedArgs["map-height"] || DEFAULTS.mapHeight),
    workshopAcf: path.resolve(String(parsedArgs["workshop-acf"] || inferWorkshopAcf(modPath, appId))),
    stateFile: path.join(databaseDir, "update-state.json"),
  };
}

function updateReason({ force, missingDatabase, manifestChanged, generatedBeforeSource, pendingSteamDownload }) {
  if (pendingSteamDownload) return "Steam has a newer workshop file that is not installed locally.";
  if (force) return "Forced update was requested.";
  if (missingDatabase) return "The Victorian Century database index is missing.";
  if (manifestChanged) return "The installed workshop manifest changed after the last recorded update.";
  if (generatedBeforeSource) return "The database was generated before the installed workshop update time.";
  return "The database already matches the installed workshop copy.";
}

async function runUpdate(config, { skipMap }) {
  assertPathExists(config.gamePath, "game path");
  assertPathExists(config.modPath, "mod path");
  assertPathExists(path.join(PROJECT_DIR, "scripts", "extract_vic3_countries.mjs"), "extract script");
  assertPathExists(path.join(PROJECT_DIR, "scripts", "build_wiki.mjs"), "wiki build script");
  assertPathExists(config.siteDir, "site directory");

  fs.mkdirSync(config.outDir, { recursive: true });
  fs.mkdirSync(config.databaseDir, { recursive: true });

  await runCommand(process.execPath, [
    path.join(PROJECT_DIR, "scripts", "extract_vic3_countries.mjs"),
    "--game-path", config.gamePath,
    "--version", config.version,
    "--out", config.outDir,
    "--database", config.databaseDir,
    "--mod-path", config.modPath,
    "--dataset-name", config.datasetName,
  ], PROJECT_DIR);

  await runCommand(process.execPath, [
    path.join(PROJECT_DIR, "scripts", "build_wiki.mjs"),
    "--database", config.databaseDir,
    "--out", config.siteDir,
  ], PROJECT_DIR);

  if (!skipMap) {
    const gameData = resolveContentRoot(config.gamePath);
    await runCommand("powershell", [
      "-ExecutionPolicy", "Bypass",
      "-File", path.join(PROJECT_DIR, "scripts", "build_map_data.ps1"),
      "-Database", config.databaseDir,
      "-ProvinceMap", path.join(gameData, "map_data", "provinces.png"),
      "-OutFile", path.join(config.siteDir, "map-data.js"),
      "-Width", String(config.mapWidth),
      "-Height", String(config.mapHeight),
    ], PROJECT_DIR);
  }
}

function runCommand(command, commandArgs, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd,
      stdio: "inherit",
      shell: false,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

function makeState(config, { remote, installed, index, skipMap }) {
  const siteFiles = {
    data_js: fileStamp(path.join(config.siteDir, "data.js")),
    map_data_js: fileStamp(path.join(config.siteDir, "map-data.js")),
  };
  return {
    schema_version: 1,
    updated_at: new Date().toISOString(),
    dataset_name: config.datasetName,
    victoria3_version: config.version,
    workshop: {
      app_id: config.appId,
      published_file_id: config.workshopId,
      title: remote?.title || config.datasetName,
      remote_time_updated: remote?.timeUpdated || "",
      remote_manifest: remote?.manifest || "",
      installed_time_updated: secondsToIso(installed.timeUpdated),
      installed_manifest: installed.manifest || "",
      installed_size: installed.size || "",
    },
    database: {
      path: config.databaseDir,
      generated_at: index.generated_at,
      counts: index.counts || {},
    },
    site: {
      path: config.siteDir,
      map_rebuilt: !skipMap,
      files: siteFiles,
    },
  };
}

function makeInstalledSource(installed) {
  return {
    manifest: installed.manifest || "",
    timeUpdated: secondsToIso(installed.timeUpdated),
    timeUpdatedMs: secondsToMs(installed.timeUpdated),
  };
}

function makeLatestSource(remote, installed) {
  const timeUpdated = remote?.timeUpdatedSeconds || installed.latestTimeUpdated || installed.timeUpdated || 0;
  return {
    manifest: remote?.manifest || installed.latestManifest || installed.manifest || "",
    timeUpdated: secondsToIso(timeUpdated),
    timeUpdatedMs: secondsToMs(timeUpdated),
  };
}

function hasPendingSteamDownload(remote, installed) {
  if (!remote?.manifest || !installed.manifest) return false;
  return remote.manifest !== installed.manifest;
}

function extractInstalledWorkshopItem(acf, workshopId) {
  const root = acf.AppWorkshop || acf;
  const installed = root.WorkshopItemsInstalled?.[workshopId] || {};
  const details = root.WorkshopItemDetails?.[workshopId] || {};
  return {
    manifest: String(installed.manifest || details.manifest || ""),
    latestManifest: String(details.latest_manifest || ""),
    timeUpdated: numberOrZero(installed.timeupdated || details.timeupdated),
    latestTimeUpdated: numberOrZero(details.latest_timeupdated),
    size: String(installed.size || ""),
    downloadProgress: downloadProgress(details),
  };
}

function downloadProgress(details) {
  const downloaded = String(details.BytesDownloaded || "");
  const total = String(details.BytesToDownload || "");
  if (!downloaded && !total) return null;
  return { downloaded, total };
}

async function fetchWorkshopDetails(config, { skipNetwork }) {
  if (skipNetwork) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const body = new URLSearchParams();
    body.set("itemcount", "1");
    body.set("publishedfileids[0]", config.workshopId);
    const response = await fetch("https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/", {
      method: "POST",
      body,
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const json = await response.json();
    const item = json?.response?.publishedfiledetails?.[0];
    if (!item || Number(item.result) !== 1) return null;
    return {
      title: String(item.title || config.datasetName),
      timeUpdatedSeconds: numberOrZero(item.time_updated),
      timeUpdated: secondsToIso(item.time_updated),
      manifest: String(item.hcontent_file || ""),
      fileSize: String(item.file_size || ""),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function readWorkshopAcf(config) {
  if (!fs.existsSync(config.workshopAcf)) return null;
  return parseValveKeyValues(fs.readFileSync(config.workshopAcf, "utf8"));
}

function parseValveKeyValues(text) {
  const tokens = tokenizeValveKeyValues(text);
  let position = 0;
  const root = {};
  while (position < tokens.length) {
    const key = tokens[position++];
    if (!key || key === "}") continue;
    if (tokens[position] === "{") {
      position += 1;
      root[key] = readObject();
    } else {
      root[key] = tokens[position++] || "";
    }
  }
  return root;

  function readObject() {
    const object = {};
    while (position < tokens.length) {
      const key = tokens[position++];
      if (key === "}") break;
      if (tokens[position] === "{") {
        position += 1;
        object[key] = readObject();
      } else {
        object[key] = tokens[position++] || "";
      }
    }
    return object;
  }
}

function tokenizeValveKeyValues(text) {
  const tokens = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "{" || char === "}") {
      tokens.push(char);
      index += 1;
      continue;
    }
    if (char === "\"") {
      index += 1;
      let value = "";
      while (index < text.length) {
        const next = text[index++];
        if (next === "\\") {
          value += text[index++] || "";
        } else if (next === "\"") {
          break;
        } else {
          value += next;
        }
      }
      tokens.push(value);
      continue;
    }
    let value = "";
    while (index < text.length && !/\s|[{}]/.test(text[index])) {
      value += text[index++];
    }
    if (value) tokens.push(value);
  }
  return tokens;
}

function printStatus(status, jsonOnly) {
  if (jsonOnly) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }
  console.log(`[${status.status}] ${status.reason || ""}`.trim());
  if (status.workshop) {
    console.log(`workshop: ${status.workshop.title || ""} ${status.workshop.installed_manifest || ""}`);
    if (status.workshop.remote_time_updated) console.log(`remote updated: ${status.workshop.remote_time_updated}`);
    if (status.workshop.installed_time_updated) console.log(`installed updated: ${status.workshop.installed_time_updated}`);
  }
  if (status.database?.generated_at) console.log(`database generated: ${status.database.generated_at}`);
  if (status.database?.counts) console.log(`counts: ${JSON.stringify(status.database.counts)}`);
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
    } else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

function inferWorkshopAcf(modPath, appId) {
  const normalized = path.resolve(modPath);
  const marker = `${path.sep}content${path.sep}${appId}${path.sep}`;
  const markerIndex = normalized.toLowerCase().indexOf(marker.toLowerCase());
  if (markerIndex >= 0) {
    return path.join(normalized.slice(0, markerIndex), `appworkshop_${appId}.acf`);
  }
  return `D:\\SteamLibrary\\steamapps\\workshop\\appworkshop_${appId}.acf`;
}

function resolveContentRoot(sourcePath) {
  const resolved = path.resolve(sourcePath);
  if (fs.existsSync(path.join(resolved, "game", "common"))) return path.join(resolved, "game");
  return resolved;
}

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  return readJson(file);
}

function readJson(file) {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(text);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `\uFEFF${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fileStamp(file) {
  if (!fs.existsSync(file)) return null;
  const stat = fs.statSync(file);
  return {
    path: file,
    size: stat.size,
    modified_at: stat.mtime.toISOString(),
  };
}

function assertPathExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Missing ${label}: ${targetPath}`);
  }
}

function secondsToMs(value) {
  const seconds = numberOrZero(value);
  return seconds > 0 ? seconds * 1000 : 0;
}

function secondsToIso(value) {
  const ms = secondsToMs(value);
  return ms ? new Date(ms).toISOString() : "";
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
