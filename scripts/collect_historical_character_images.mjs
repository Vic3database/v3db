import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import {
  classifyImageType,
  derivedNameCandidate,
  exclusionReason,
  fetchWithRetry,
  identityEvidence,
  mediaInfoRows,
  normalize,
  eligibleUndatedCandidates,
  queryBatchWithSplit,
  selectImage,
} from "./lib/historical_character_images.mjs";

const root = process.cwd();
const args = parseArgs(process.argv.slice(2));
const characterFile = path.resolve(root, args.characters || "site/versions/1.13.9/data-characters.js");
const outDir = path.resolve(root, args.out || "output/historical-character-images");
const cacheDir = path.join(outDir, "cache");
const reportFile = path.join(outDir, "historical-character-images.json");
const nameCandidateFile = path.resolve(root, args["name-candidates"] || path.join(outDir, "historical-character-image-name-candidates.json"));
const batchSize = positiveInteger(args["batch-size"], 40);
const offset = nonNegativeInteger(args.offset, 0);
const limit = args.limit ? positiveInteger(args.limit, 40) : Number.POSITIVE_INFINITY;
const requestDelayMs = nonNegativeInteger(args["request-delay-ms"], 6000);
const userAgent = "VicdataPortraitResearch/0.1 (historical character image audit)";

fs.mkdirSync(cacheDir, { recursive: true });
const characters = readCharacterData(characterFile);
const people = groupCharacters(characters);
const undatedGroups = groupUndatedCharacters(characters);
const selectedPeople = people.slice(offset, Number.isFinite(limit) ? offset + limit : undefined);
let matches = [];

for (let index = 0; index < selectedPeople.length; index += batchSize) {
  const batch = selectedPeople.slice(index, index + batchSize);
  const cacheFile = path.join(cacheDir, `wikidata-${cacheKey(batch.map((person) => [person.name_en, person.birth_year]))}.json`);
  let rows;
  if (fs.existsSync(cacheFile)) {
    rows = readJson(cacheFile);
  } else {
    rows = await queryWikidataBatch(batch);
    writeJson(cacheFile, rows);
    await delay(requestDelayMs);
  }
  matches.push(...matchWikidataRows(batch, rows));
  console.log(`维基数据人物匹配：${Math.min(index + batch.length, selectedPeople.length)}/${selectedPeople.length}`);
}

matches = matches.map((person) => ({ ...person, match_method: "exact_name_and_birth_year", matched_variants: [] }));
if (fs.existsSync(nameCandidateFile)) {
  const selectedKeys = new Set(selectedPeople.map(personKey));
  const candidateReport = readJson(nameCandidateFile);
  const derivedPeople = (candidateReport.candidates || [])
    .filter((person) => selectedKeys.has(personKey(person)))
    .map((person) => ({ person, candidate: derivedNameCandidate(person) }))
    .filter((item) => item.candidate);
  const qids = [...new Set(derivedPeople.map((item) => item.candidate.wikidata_id))];
  const entities = new Map();
  for (let index = 0; index < qids.length; index += batchSize) {
    const ids = qids.slice(index, index + batchSize);
    const cacheFile = path.join(cacheDir, `wikidata-derived-images-${cacheKey(ids)}.json`);
    let rows;
    if (fs.existsSync(cacheFile)) {
      rows = readJson(cacheFile);
    } else {
      rows = await queryWikidataEntityImagesBatch(ids);
      writeJson(cacheFile, rows);
      await delay(requestDelayMs);
    }
    for (const row of rows) entities.set(row.qid, row);
    console.log(`维基数据别名人物图片：${Math.min(index + ids.length, qids.length)}/${qids.length}`);
  }
  const derivedByPerson = new Map(derivedPeople.map(({ person, candidate }) => {
    const entity = entities.get(candidate.wikidata_id) || { images: [] };
    return [personKey(person), {
      name_en: person.name_en,
      name_zh: person.name_zh,
      birth_year: person.birth_year,
      character_keys: person.character_keys,
      match_method: "derived_name_variant",
      matched_variants: candidate.matched_variants || [],
      wikidata_candidates: [{
        qid: candidate.wikidata_id,
        label: candidate.wikidata_label,
        birth: candidate.birth,
        images: entity.images || [],
      }],
    }];
  }));
  matches = matches.map((person) => derivedByPerson.get(personKey(person)) || person);
  console.log(`保守别名匹配并入：${derivedByPerson.size}/${candidateReport.stats?.source_people || 0}`);
}

const existingByName = new Map();
for (const person of matches) {
  const key = normalize(person.name_en);
  const rows = existingByName.get(key) || [];
  rows.push(person);
  existingByName.set(key, rows);
}
const excludedFictional = undatedGroups.filter((person) => person.fictional);
const undatedToQuery = [];
let linkedUndatedTemplates = 0;
for (const person of undatedGroups.filter((item) => !item.fictional)) {
  const existing = existingByName.get(normalize(person.name_en)) || [];
  if (existing.length === 1 && existing[0].wikidata_candidates.length === 1) {
    existing[0].character_keys.push(...person.character_keys);
    linkedUndatedTemplates += person.character_keys.length;
  } else {
    undatedToQuery.push(person);
  }
}
for (let index = 0; index < undatedToQuery.length; index += batchSize) {
  const batch = undatedToQuery.slice(index, index + batchSize);
  const cacheFile = path.join(cacheDir, `wikidata-undated-v2-${cacheKey(batch.map((person) => [person.name_en, person.expected_birth_years]))}.json`);
  let rows;
  if (fs.existsSync(cacheFile)) {
    rows = readJson(cacheFile);
  } else {
    rows = await queryBatchWithSplit(batch, queryWikidataUndatedBatch, { delayMs: requestDelayMs });
    writeJson(cacheFile, rows);
    await delay(requestDelayMs);
  }
  matches.push(...matchUndatedRows(batch, rows));
  console.log(`无明确出生日期人物匹配：${Math.min(index + batch.length, undatedToQuery.length)}/${undatedToQuery.length}`);
}
console.log(`无日期模板同名并入：${linkedUndatedTemplates}；虚构模板排除：${excludedFictional.reduce((sum, person) => sum + person.character_keys.length, 0)}`);

const imageClaims = matches.flatMap((person) => (person.wikidata_candidates || []).flatMap((candidate) =>
  (candidate.images || []).map((image) => ({ ...image, qid: candidate.qid }))));
const fileTitles = [...new Set(imageClaims.map((claim) => claim.file_title).filter(Boolean))];
const fileMetadata = new Map();

for (let index = 0; index < fileTitles.length; index += batchSize) {
  const titles = fileTitles.slice(index, index + batchSize);
  const cacheFile = path.join(cacheDir, `commons-v2-${cacheKey(titles)}.json`);
  let rows;
  if (fs.existsSync(cacheFile)) {
    rows = readJson(cacheFile);
  } else {
    rows = await queryCommonsBatch(titles);
    writeJson(cacheFile, rows);
    await delay(requestDelayMs);
  }
  for (const row of rows) fileMetadata.set(row.title, row);
  console.log(`维基共享资源文件元数据：${Math.min(index + titles.length, fileTitles.length)}/${fileTitles.length}`);
}

const pageIds = [...fileMetadata.values()].map((row) => row.page_id).filter(Boolean);
const structuredMetadata = new Map();
for (let index = 0; index < pageIds.length; index += batchSize) {
  const ids = pageIds.slice(index, index + batchSize);
  const cacheFile = path.join(cacheDir, `commons-structured-v2-${cacheKey(ids)}.json`);
  let rows;
  if (fs.existsSync(cacheFile)) {
    rows = readJson(cacheFile);
  } else {
    rows = await queryCommonsStructuredBatch(ids);
    writeJson(cacheFile, rows);
    await delay(requestDelayMs);
  }
  for (const row of rows) structuredMetadata.set(row.page_id, row);
  console.log(`维基共享资源结构化数据：${Math.min(index + ids.length, pageIds.length)}/${pageIds.length}`);
}
for (const row of fileMetadata.values()) {
  const structured = structuredMetadata.get(row.page_id);
  if (!structured) continue;
  row.depicts = structured.depicts;
  row.structuredTypes = structured.structured_types;
}

const report = buildReport(matches, imageClaims, fileMetadata, characters.length, people.length, {
  undated_character_templates: undatedGroups.reduce((sum, person) => sum + person.character_keys.length, 0),
  excluded_fictional_character_templates: excludedFictional.reduce((sum, person) => sum + person.character_keys.length, 0),
  linked_undated_character_templates: linkedUndatedTemplates,
});
fs.mkdirSync(outDir, { recursive: true });
writeJson(reportFile, report);
console.log(JSON.stringify(report.stats));
console.log(`已写入：${reportFile}`);

function readCharacterData(file) {
  const source = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const value = JSON.parse(source.replace(/^window\.VIC3_DATA_CHUNK\s*=\s*/, "").replace(/;\s*$/, ""));
  if (!Array.isArray(value.historicalCharacters)) throw new Error(`${file} 缺少 historicalCharacters 数组`);
  return value.historicalCharacters;
}

function groupCharacters(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const birthYear = birthYearOf(row.birth_date);
    if (!row.name_en || !birthYear) continue;
    const groupKey = `${normalize(row.name_en)}\u0000${birthYear}`;
    const existing = grouped.get(groupKey) || {
      name_en: row.name_en,
      name_zh: row.name_zh || "",
      birth_year: birthYear,
      character_keys: [],
    };
    existing.character_keys.push(row.key);
    grouped.set(groupKey, existing);
  }
  return [...grouped.values()].sort((left, right) =>
    left.name_en.localeCompare(right.name_en, "en") || left.birth_year - right.birth_year);
}

function groupUndatedCharacters(rows) {
  const grouped = new Map();
  for (const row of rows.filter((item) => item.name_en && !birthYearOf(item.birth_date))) {
    const groupKey = normalize(row.name_en);
    const existing = grouped.get(groupKey) || {
      name_en: row.name_en,
      name_zh: row.name_zh || "",
      birth_year: 0,
      character_keys: [],
      game_age: row.age || "",
      game_date_status: row.age ? "age_only" : "missing",
      game_in_starting_history: false,
      expected_birth_years: [],
      fictional: false,
    };
    existing.character_keys.push(row.key);
    existing.game_in_starting_history ||= Boolean(row.in_starting_history);
    existing.fictional ||= /(?:^|\/)spooky_templates\.txt$/i.test(row.source_file || "");
    if (row.in_starting_history && /^\d+$/.test(String(row.age || ""))) {
      const age = Number(row.age);
      existing.expected_birth_years = [...new Set([...existing.expected_birth_years, 1835 - age, 1836 - age])].sort();
    }
    grouped.set(groupKey, existing);
  }
  return [...grouped.values()].sort((left, right) => left.name_en.localeCompare(right.name_en, "en"));
}

async function queryWikidataBatch(batch) {
  const values = batch.map((person, index) =>
    `(\"${escapeSparql(person.name_en)}\"@en ${person.birth_year} ${index})`).join("\n    ");
  const query = `SELECT ?inputIndex ?name ?year ?item ?itemLabel ?birth ?image ?rank WHERE {
  VALUES (?name ?year ?inputIndex) {
    ${values}
  }
  VALUES ?namePredicate { rdfs:label skos:altLabel }
  ?item wdt:P31 wd:Q5;
        ?namePredicate ?name;
        wdt:P569 ?birth.
  FILTER(YEAR(?birth) = ?year)
  OPTIONAL {
    ?item p:P18 ?imageStatement.
    ?imageStatement ps:P18 ?image;
                    wikibase:rank ?rank.
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language \"en\". }
}`;
  const url = new URL("https://query.wikidata.org/sparql");
  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");
  const data = await requestJson(url, { Accept: "application/sparql-results+json" }, true);
  return data.results.bindings.map((row) => ({
    input_index: Number(row.inputIndex.value),
    input_name: row.name.value,
    input_year: Number(row.year.value),
    qid: row.item.value.replace(/^.*\//, ""),
    label: row.itemLabel?.value || row.name.value,
    birth: row.birth.value,
    file_title: row.image ? fileTitleFromImageUrl(row.image.value) : "",
    rank: row.rank?.value?.replace(/^.*#/, "") || "",
  }));
}

function matchWikidataRows(batch, rows) {
  return batch.map((person, inputIndex) => {
    const candidatesByQid = new Map();
    for (const row of rows.filter((item) => item.input_index === inputIndex)) {
      const candidate = candidatesByQid.get(row.qid) || {
        qid: row.qid,
        label: row.label,
        birth: row.birth,
        images: [],
      };
      if (row.file_title) candidate.images.push({ file_title: row.file_title, rank: row.rank });
      candidatesByQid.set(row.qid, candidate);
    }
    return { ...person, wikidata_candidates: [...candidatesByQid.values()] };
  });
}

async function queryWikidataUndatedBatch(batch) {
  const values = batch.map((person, index) => `("${escapeSparql(person.name_en)}"@en ${index})`).join("\n    ");
  const query = `SELECT ?inputIndex ?name ?item ?itemLabel ?birth ?image ?rank WHERE {
  VALUES (?name ?inputIndex) {
    ${values}
  }
  VALUES ?namePredicate { rdfs:label skos:altLabel }
  ?item wdt:P31 wd:Q5;
        ?namePredicate ?name;
        wdt:P569 ?birth.
  OPTIONAL {
    ?item p:P18 ?imageStatement.
    ?imageStatement ps:P18 ?image;
                    wikibase:rank ?rank.
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;
  const url = new URL("https://query.wikidata.org/sparql");
  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");
  const data = await requestJson(url, { Accept: "application/sparql-results+json" }, true);
  return data.results.bindings.map((row) => ({
    input_index: Number(row.inputIndex.value),
    input_name: row.name.value,
    qid: row.item.value.replace(/^.*\//, ""),
    label: row.itemLabel?.value || row.name.value,
    birth: row.birth.value,
    file_title: row.image ? fileTitleFromImageUrl(row.image.value) : "",
    rank: row.rank?.value?.replace(/^.*#/, "") || "",
  }));
}

function matchUndatedRows(batch, rows) {
  return batch.map((person, inputIndex) => {
    const candidatesByQid = new Map();
    for (const row of rows.filter((item) => item.input_index === inputIndex)) {
      const candidate = candidatesByQid.get(row.qid) || {
        qid: row.qid,
        label: row.label,
        birth: row.birth,
        images: [],
      };
      if (row.file_title && !candidate.images.some((image) => image.file_title === row.file_title)) {
        candidate.images.push({ file_title: row.file_title, rank: row.rank });
      }
      candidatesByQid.set(row.qid, candidate);
    }
    const eligible = eligibleUndatedCandidates(person, [...candidatesByQid.values()]);
    return {
      ...person,
      match_method: person.expected_birth_years.length ? "exact_name_and_starting_age" : "unconfirmed_without_game_birth_date",
      matched_variants: [],
      wikidata_candidates: eligible,
      no_match_reason: candidatesByQid.size && !eligible.length
        ? "exact Wikidata people do not match starting age or lack a birth date"
        : "no unique exact Wikidata person without a game birth date",
    };
  });
}

async function queryWikidataEntityImagesBatch(qids) {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", qids.join("|"));
  url.searchParams.set("props", "claims");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  const data = await requestJson(url, {}, true);
  return Object.entries(data.entities || {}).map(([qid, entity]) => ({
    qid,
    images: (entity.claims?.P18 || []).map((claim) => ({
      file_title: claim.mainsnak?.datavalue?.value ? `File:${claim.mainsnak.datavalue.value}` : "",
      rank: claim.rank || "",
    })).filter((image) => image.file_title),
  }));
}

async function queryCommonsBatch(titles) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", titles.join("|"));
  url.searchParams.set("prop", "categories|imageinfo");
  url.searchParams.set("cllimit", "max");
  url.searchParams.set("iiprop", "url|size|mime|mediatype|extmetadata");
  url.searchParams.set("iiurlwidth", "240");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("origin", "*");
  const data = await requestJson(url, {}, true);
  return (data.query?.pages || []).filter((page) => !page.missing).map((page) => {
    const info = page.imageinfo?.[0] || {};
    const metadata = info.extmetadata || {};
    return {
      title: page.title,
      page_id: page.pageid,
      file_page: info.descriptionurl || "",
      original_url: stripTracking(info.url || ""),
      thumbnail_url: stripTracking(info.thumburl || ""),
      width: info.width || 0,
      height: info.height || 0,
      mime: info.mime || "",
      media_type: info.mediatype || "",
      categories: (page.categories || []).map((category) => category.title),
      description: stripHtml(metadata.ImageDescription?.value || ""),
      mediaLabel: stripHtml(metadata.ObjectName?.value || ""),
      artist: stripHtml(metadata.Artist?.value || ""),
      date: stripHtml(metadata.DateTimeOriginal?.value || metadata.DateTime?.value || ""),
      credit: stripHtml(metadata.Credit?.value || metadata.Institution?.value || ""),
      license: stripHtml(metadata.LicenseShortName?.value || metadata.UsageTerms?.value || ""),
      license_url: metadata.LicenseUrl?.value || "",
      depicts: [],
    };
  });
}

async function queryCommonsStructuredBatch(pageIds) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("ids", pageIds.map((id) => `M${id}`).join("|"));
  url.searchParams.set("props", "claims");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  const data = await requestJson(url, {}, true);
  return mediaInfoRows(data);
}

function buildReport(matches, claims, fileMetadata, sourceCharacterCount, sourcePeopleCount, scopeStats = {}) {
  const claimRank = new Map(claims.map((claim) => [`${claim.qid}\u0000${claim.file_title}`, claim.rank]));
  const confirmed = [];
  const review = [];
  const unmatched = [];
  for (const person of matches) {
    if (person.wikidata_candidates.length !== 1) {
      (person.wikidata_candidates.length ? review : unmatched).push({
        ...person,
        reason: person.wikidata_candidates.length ? "multiple exact Wikidata people" : (person.no_match_reason || "no exact Wikidata person"),
      });
      continue;
    }
    const candidate = person.wikidata_candidates[0];
    const images = candidate.images.map(({ file_title }) => {
      const metadata = fileMetadata.get(file_title);
      return metadata ? {
        ...metadata,
        directPersonImage: true,
        wikidataRank: claimRank.get(`${candidate.qid}\u0000${file_title}`) || "",
      } : null;
    }).filter(Boolean);
    const selected = selectImage(images, { wikidataId: candidate.qid, name: person.name_en });
    if (!selected) {
      review.push({
        ...person,
        wikidata_id: candidate.qid,
        wikidata_label: candidate.label,
        reason: candidate.images.length ? "images require review or do not meet portrait rules" : "Wikidata person has no image",
        image_candidates: images.map((image) => ({
          file_title: image.title,
          file_page: image.file_page,
          type: classifyImageType(image),
          identity_evidence: identityEvidence(image, { wikidataId: candidate.qid, name: person.name_en }),
          excluded_reason: exclusionReason(image),
          license: image.license,
        })),
      });
      continue;
    }
    confirmed.push({
      name_en: person.name_en,
      name_zh: person.name_zh,
      birth_year: person.birth_year || Number(String(candidate.birth || "").slice(0, 4)) || 0,
      game_birth_year_explicit: Boolean(person.birth_year),
      game_date_status: person.game_date_status || "explicit_birth_date",
      game_age: person.game_age || "",
      expected_birth_years: person.expected_birth_years || [],
      character_keys: person.character_keys,
      match_method: person.match_method,
      matched_variants: person.matched_variants || [],
      wikidata_id: candidate.qid,
      wikidata_url: `https://www.wikidata.org/wiki/${candidate.qid}`,
      wikidata_label: cleanDisplayText(candidate.label, person.name_en),
      image: {
        type: classifyImageType(selected),
        file_title: selected.title,
        file_page: selected.file_page,
        original_url: selected.original_url,
        thumbnail_url: selected.thumbnail_url,
        width: selected.width,
        height: selected.height,
        mime: selected.mime,
        artist: selected.artist,
        date: selected.date,
        credit: cleanDisplayText(selected.credit),
        license: selected.license,
        license_url: selected.license_url,
        identity_evidence: identityEvidence(selected, { wikidataId: candidate.qid, name: person.name_en }),
        excluded_reason: "",
      },
    });
  }
  const confirmedTemplates = confirmed.reduce((sum, person) => sum + person.character_keys.length, 0);
  return {
    schema_version: 1,
    source: "Wikidata and Wikimedia Commons",
    generated_at: new Date().toISOString(),
    scope: "historical character templates with an English name, excluding explicitly fictional spooky templates",
    rules: {
      accepted_types: ["photograph", "painting", "print"],
      identity: "exact or conservative multi-token English name match with the same birth year, or exact English name with a birth year consistent with the 1836 starting age, followed by person-specific evidence on the Commons file",
      excluded: ["generated or reconstructed images", "sculptures and monuments", "signatures and heraldry", "group images"],
    },
    stats: {
      source_character_templates: sourceCharacterCount,
      source_unique_people_with_birth_year: sourcePeopleCount,
      source_undated_character_templates: scopeStats.undated_character_templates || 0,
      excluded_fictional_character_templates: scopeStats.excluded_fictional_character_templates || 0,
      linked_undated_character_templates: scopeStats.linked_undated_character_templates || 0,
      processed_people: matches.length,
      confirmed_people: confirmed.length,
      confirmed_character_templates: confirmedTemplates,
      confirmed_exact_name_people: confirmed.filter((person) => person.match_method === "exact_name_and_birth_year").length,
      confirmed_derived_name_people: confirmed.filter((person) => person.match_method === "derived_name_variant").length,
      confirmed_starting_age_people: confirmed.filter((person) => person.match_method === "exact_name_and_starting_age").length,
      review_people: review.length,
      unmatched_people: unmatched.length,
    },
    people: confirmed,
    review,
    unmatched,
  };
}

async function requestJson(url, headers = {}, preferPowerShell = false) {
  if (preferPowerShell) return requestJsonWithPowerShell(url);
  try {
    const response = await fetchWithRetry(url, {
      attempts: 2,
      delayMs: requestDelayMs,
      userAgent,
      headers,
    });
    return await response.json();
  } catch (error) {
    console.warn(`Node.js 网络请求失败，改用 Windows 网络接口：${url.hostname}`);
    return requestJsonWithPowerShell(url);
  }
}

function requestJsonWithPowerShell(url) {
  const script = [
    "$ProgressPreference = 'SilentlyContinue'",
    "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)",
    "$OutputEncoding = [Console]::OutputEncoding",
    `$uri = ${powershellLiteral(url.toString())}`,
    `$headers = @{ 'User-Agent' = ${powershellLiteral(userAgent)} }`,
    "$result = Invoke-RestMethod -Uri $uri -Headers $headers -TimeoutSec 120",
    "$json = $result | ConvertTo-Json -Depth 100 -Compress",
    "$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)",
    "[Convert]::ToBase64String($bytes)",
  ].join("\n");
  const output = execFileSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  const json = Buffer.from(output.trim(), "base64").toString("utf8");
  return JSON.parse(json.replace(/^\uFEFF/, ""));
}

function fileTitleFromImageUrl(value) {
  const url = new URL(value);
  const marker = "/Special:FilePath/";
  const index = url.pathname.indexOf(marker);
  if (index < 0) return "";
  return `File:${decodeURIComponent(url.pathname.slice(index + marker.length)).replaceAll("_", " ")}`;
}

function stripTracking(value) {
  if (!value) return "";
  const url = new URL(value);
  url.search = "";
  return url.toString();
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDisplayText(value, fallback = "") {
  const text = String(value || "").replaceAll("�", "").trim();
  return /[A-Za-zÀ-ž]\?[A-Za-zÀ-ž]/.test(text) ? fallback : text;
}

function birthYearOf(value) {
  const match = String(value || "").match(/^(\d{4})(?:\.|$)/);
  return match ? Number(match[1]) : 0;
}

function personKey(person) {
  return `${normalize(person.name_en)}\u0000${person.birth_year}`;
}

function escapeSparql(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n");
}

function powershellLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    result[arg.slice(2)] = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : true;
  }
  return result;
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function nonNegativeInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function cacheKey(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex").slice(0, 16);
}

function delay(milliseconds) {
  return milliseconds > 0 ? new Promise((resolve) => setTimeout(resolve, milliseconds)) : Promise.resolve();
}
