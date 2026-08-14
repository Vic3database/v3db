import assert from "node:assert/strict";
import {
  classifyImageType,
  derivedNameCandidate,
  exclusionReason,
  filterRejectedImages,
  fetchWithRetry,
  eligibleUndatedCandidates,
  identityEvidence,
  mediaInfoRows,
  nameVariants,
  queryBatchWithSplit,
  selectImage,
  selectReviewedImage,
  validateImageReviewDocument,
} from "./lib/historical_character_images.mjs";

const einsteinPerson = {
  name_en: "Albert Einstein",
  character_keys: ["albert_einstein_template"],
  wikidataId: "Q937",
};
const einsteinPhoto = {
  title: "File:Einstein 1921 by F Schmutzer - restoration.jpg",
  categories: ["Category:Albert Einstein by Schmutzer (1921)"],
  description: "Albert Einstein during a lecture in Vienna in 1921",
  mediaLabel: "Einstein 1921 by F Schmutzer - restoration",
  directPersonImage: true,
  license: "Public domain",
};
const einsteinReview = {
  schema_version: 2,
  reviews: [{
    character_keys: ["albert_einstein_template"],
    wikidata_id: "Q937",
    file_title: einsteinPhoto.title,
    decision: "approve",
    type: "photograph",
    reviewed_at: "2026-08-13",
    reason: "The file is an identified 1921 photograph of Albert Einstein.",
  }],
  person_reviews: [],
};
const validatedEinsteinReview = validateImageReviewDocument(einsteinReview);
assert.equal(validatedEinsteinReview.image_reviews.length, 1);
assert.deepEqual(validatedEinsteinReview.person_reviews, []);
assert.equal(selectReviewedImage([einsteinPhoto], einsteinPerson, einsteinReview.reviews)?.image.type, "photograph");
assert.throws(() => validateImageReviewDocument({
  schema_version: 2,
  reviews: [einsteinReview.reviews[0], { ...einsteinReview.reviews[0], file_title: "File:Another Einstein.jpg" }],
  person_reviews: [],
}), /duplicates an approved person decision/);

const carmichaelPersonReview = {
  character_keys: ["BIC_amy_carmichael"],
  wikidata_ids: ["Q481824"],
  candidate_file_titles: ["File:Amy Carmichael with children2.jpg"],
  decision: "no_eligible_image",
  reviewed_at: "2026-08-13",
  reason: "The only current candidate is a group image.",
};
const validatedPersonReview = validateImageReviewDocument({
  schema_version: 2,
  reviews: [],
  person_reviews: [carmichaelPersonReview],
});
assert.deepEqual(validatedPersonReview.person_reviews, [carmichaelPersonReview]);
assert.throws(() => validateImageReviewDocument({
  schema_version: 2,
  reviews: [],
  person_reviews: [{ ...carmichaelPersonReview, wikidata_ids: ["Q9", "Q1"] }],
}), /wikidata_ids must be sorted and unique/);
assert.throws(() => validateImageReviewDocument({
  schema_version: 2,
  reviews: [],
  person_reviews: [{ ...carmichaelPersonReview, candidate_file_titles: [carmichaelPersonReview.candidate_file_titles[0], carmichaelPersonReview.candidate_file_titles[0]] }],
}), /candidate_file_titles must be sorted and unique/);
assert.throws(() => validateImageReviewDocument({
  schema_version: 2,
  reviews: einsteinReview.reviews,
  person_reviews: [{
    ...carmichaelPersonReview,
    character_keys: einsteinReview.reviews[0].character_keys,
    wikidata_ids: [einsteinReview.reviews[0].wikidata_id],
    candidate_file_titles: [einsteinReview.reviews[0].file_title],
  }],
}), /conflicts with an approved image review/);

const rejectedEinstein = {
  ...einsteinReview.reviews[0],
  decision: "reject",
  type: "",
};
assert.equal(selectReviewedImage([einsteinPhoto], einsteinPerson, [rejectedEinstein]), null);
assert.deepEqual(filterRejectedImages([einsteinPhoto], einsteinPerson, [rejectedEinstein]), []);

const einsteinGroup = {
  ...einsteinPhoto,
  title: "File:Albert Einstein at a conference.jpg",
  description: "Albert Einstein at a conference on physics with other scientists.",
};
assert.throws(() => selectReviewedImage([einsteinGroup], einsteinPerson, [{
  ...einsteinReview.reviews[0],
  file_title: einsteinGroup.title,
}]), /group image/);

const cauacuGroup = {
  ...einsteinPhoto,
  title: "File:Anésia Cauaçu.jpg",
  description: "Anésia Cauaçu and daughter.",
};
assert.equal(exclusionReason(cauacuGroup), "group image", "a portrait with the subject's daughter should be treated as a group image");

const waughGroupCrop = {
  ...einsteinPhoto,
  title: "File:Andrew Scott Waugh 1861.jpg",
  description: "Andrew Scott Waugh, Bengal Engineers. From a group photo of the Survey of India taken in Calcutta on March 1861.",
};
assert.equal(exclusionReason(waughGroupCrop), "group image", "a crop sourced from a group photo should be treated as a group image");

const adaPainting = {
  title: "File:Ada Lovelace.jpg",
  categories: [
    "Category:Artistic portraits of Ada Lovelace",
    "Category:1836 oil on canvas paintings in the United Kingdom",
  ],
  description: "Portrait of Ada Lovelace",
  mediaLabel: "Ada Lovelace",
  depicts: [],
  license: "Public domain",
};
assert.equal(classifyImageType(adaPainting), "painting");
assert.equal(exclusionReason(adaPainting), "");
assert.equal(identityEvidence(adaPainting, { wikidataId: "Q7259", name: "Ada Lovelace" }), "portrait category names person");

const photographedPainting = {
  title: "File:Painted portrait photographed in a museum.jpg",
  categories: ["Category:Portrait paintings of politicians", "Category:Photographs of paintings"],
  description: "Photograph of an oil painting",
  mediaLabel: "Painted portrait",
  depicts: [],
  license: "Public domain",
};
assert.equal(classifyImageType(photographedPainting), "painting");

const bustLengthPhotograph = {
  title: "File:Alfred Krupp.jpg",
  categories: ["Category:Black and white portrait photographs of men at bust length"],
  description: "",
  mediaLabel: "Alfred Krupp",
  license: "Public domain",
};
assert.equal(exclusionReason(bustLengthPhotograph), "", "bust length should describe portrait framing, not a sculpture");

const portraitWithCoatOfArms = {
  title: "File:José López Domínguez (Palacio del Senado de España).jpg",
  categories: [
    "Category:1907 portrait paintings of men",
    "Category:20th-century portraits with coat of arms",
  ],
  description: "Portrait of José López Domínguez",
  mediaLabel: "José López Domínguez",
  license: "Public domain",
};
assert.equal(exclusionReason(portraitWithCoatOfArms), "", "a coat of arms within a portrait should not exclude the portrait");

const standaloneCoatOfArms = {
  title: "File:Example coat of arms.svg",
  categories: ["Category:Coats of arms"],
  description: "Coat of arms",
  mediaLabel: "Example coat of arms",
  license: "Public domain",
};
assert.equal(exclusionReason(standaloneCoatOfArms), "not a two-dimensional portrait of the person", "a standalone coat of arms should remain excluded");

const lincolnPhoto = {
  title: "File:Abraham Lincoln O-77 matte collodion print.jpg",
  categories: ["Category:Abraham Lincoln in 1863", "Category:Images from the Library of Congress"],
  description: "This portrait of Abraham Lincoln was taken by Alexander Gardner in 1863.",
  mediaLabel: "Portrait of Abraham Lincoln",
  depicts: ["Q91"],
  license: "Public domain",
};
assert.equal(classifyImageType(lincolnPhoto), "photograph");
assert.equal(identityEvidence(lincolnPhoto, { wikidataId: "Q91", name: "Abraham Lincoln" }), "structured depicts statement");

const thiersPhoto = {
  title: "File:Adolphe Thiers par Nadar.jpg",
  categories: ["Category:Photographs of Adolphe Thiers by Nadar"],
  description: "Adolphe Thiers par Nadar",
  mediaLabel: "Adolphe Thiers par Nadar",
  depicts: [],
  directPersonImage: true,
  license: "Public domain",
};
assert.equal(classifyImageType(thiersPhoto), "photograph");
assert.equal(identityEvidence(thiersPhoto, { wikidataId: "Q5738", name: "Adolphe Thiers" }), "Wikidata image statement for exact person");

const structuredPainting = {
  title: "File:Portrait without descriptive categories.jpg",
  categories: [],
  description: "",
  mediaLabel: "",
  structuredTypes: ["Q3305213"],
  depicts: ["Q5738"],
  license: "Public domain",
};
assert.equal(classifyImageType(structuredPainting), "painting");

const photographedPortraitPainting = {
  title: "File:Portrait painting photographed in a museum.jpg",
  categories: [],
  description: "A portrait painting of Pedro Peláez located at a school in Manila.",
  structuredTypes: ["Q125191"],
  license: "Public domain",
};
assert.equal(classifyImageType(photographedPortraitPainting), "painting");

const museumPortraitPainting = {
  title: "File:'Rafael Uribe Uribe' (1915) by Francisco Antonio Cano Cardona - Museo de Antioquia.jpg",
  categories: ["Category:Rafael Uribe Uribe (1915) by Francisco Antonio Cano"],
  description: "'Rafael Uribe Uribe' (1915) by Francisco Antonio Cano Cardona - Museo de Antioquia",
  structuredTypes: ["Q125191"],
  license: "CC BY-SA 4.0",
};
assert.equal(classifyImageType(museumPortraitPainting), "painting");

const scannedLithograph = {
  title: "File:Minister portrait.jpg",
  categories: [],
  description: "Portrait of the minister, Lithografie, 1830",
  structuredTypes: ["Q125191"],
  license: "Public domain",
};
assert.equal(classifyImageType(scannedLithograph), "print");

const buttrePortraitAfterDaguerreotype = {
  title: "File:Samuel houston.jpg",
  categories: ["Category:John Chester Buttre", "Category:Daguerreotype portraits"],
  description: "John Chester Buttre, Portrait of Sam Houston, 1858. After a daguerreotype by B. P. Paige.",
  structuredTypes: ["Q125191"],
  license: "Public domain",
};
assert.equal(classifyImageType(buttrePortraitAfterDaguerreotype), "print");

const photographedPaintingOfKing = {
  title: "File:King portrait.jpg",
  categories: [],
  description: "A 19th century painting of the king.",
  structuredTypes: ["Q125191"],
  license: "Public domain",
};
assert.equal(classifyImageType(photographedPaintingOfKing), "painting");

assert.equal(classifyImageType({ title: "File:Fotografía de una persona.jpg", categories: [], license: "Public domain" }), "photograph");
assert.equal(classifyImageType({ title: "File:Retrato al óleo.jpg", categories: [], license: "Public domain" }), "painting");
assert.equal(classifyImageType({ title: "File:Litografía de una persona.jpg", categories: [], license: "Public domain" }), "print");

const mediaRows = mediaInfoRows({
  entities: {
    M42812335: {
      id: "M42812335",
      statements: {
        P180: [{ mainsnak: { datavalue: { value: { id: "Q91" } } } }],
        P31: [{ mainsnak: { datavalue: { value: { id: "Q125191" } } } }],
      },
    },
  },
});
assert.deepEqual(mediaRows, [{ page_id: 42812335, depicts: ["Q91"], structured_types: ["Q125191"] }]);

assert.deepEqual(
  nameVariants({ name_en: "Abul Azad", character_keys: ["BIC_maulana_azad"] }),
  ["Maulana Azad", "Abul"],
);

const splitCalls = [];
const splitResult = await queryBatchWithSplit([1, 2, 3, 4], async (batch) => {
  splitCalls.push([...batch]);
  if (batch.length > 2) throw new Error("timeout");
  return batch.map((value) => value * 10);
}, { delayMs: 0 });
assert.deepEqual(splitCalls, [[1, 2, 3, 4], [1, 2], [3, 4]]);
assert.deepEqual(splitResult, [10, 20, 30, 40]);

assert.equal(derivedNameCandidate({
  wikidata_candidates: [{ wikidata_id: "Q196617", matched_variants: ["Maulana Azad"] }],
})?.wikidata_id, "Q196617");
assert.equal(derivedNameCandidate({
  wikidata_candidates: [{ wikidata_id: "Q4062873", matched_variants: ["Boris"] }],
}), null);
assert.equal(derivedNameCandidate({
  wikidata_candidates: [
    { wikidata_id: "Q1", matched_variants: ["Alexander III"] },
    { wikidata_id: "Q2", matched_variants: ["Aleksandr"] },
  ],
}), null);
assert.deepEqual(
  nameVariants({ name_en: "Adam Kok", character_keys: ["PHL_adam_kok_III"] }),
  ["Adam Kok III", "Adam"],
);

const undatedCandidates = [
  { qid: "Q1", birth: "1801-07-01T00:00:00Z" },
  { qid: "Q2", birth: "1810-01-01T00:00:00Z" },
  { qid: "Q3", birth: "" },
];
assert.deepEqual(
  eligibleUndatedCandidates({ expected_birth_years: [1801, 1802] }, undatedCandidates).map((item) => item.qid),
  ["Q1"],
);
assert.deepEqual(eligibleUndatedCandidates({ expected_birth_years: [] }, undatedCandidates), []);
assert.deepEqual(
  nameVariants({ name_en: "Abdülmecid Osmanoglu", character_keys: ["tur_abdulmecid_osmanoglu_template"] }),
  ["Abdulmecid Osmanoglu", "Abdülmecid", "Abdulmecid"],
);

const generatedLincoln = {
  title: "File:Abraham Lincoln 1846 47 interpreted Gemini.png",
  categories: [],
  description: "Interpreted Gemini image of Abraham Lincoln",
  mediaLabel: "Abraham Lincoln",
  depicts: [],
  license: "Public domain",
};
assert.equal(exclusionReason(generatedLincoln), "generated or reconstructed image");

const publicRally = {
  title: "File:Comicio republicano em Lisboa.jpg",
  categories: ["Category:Political speeches"],
  description: "Azedo Gneco addressing a republican rally in Lisbon.",
  license: "Public domain",
};
assert.equal(exclusionReason(publicRally), "group image");

const shipConference = {
  title: "File:ConferenceOnTheSemiramis1863.JPG",
  categories: ["Category:Relations of France and Japan in the Edo period"],
  description: "Franco-Anglo-Japanese conference on the Semiramis, July 2, 1863",
  license: "Public domain",
};
assert.equal(exclusionReason(shipConference), "group image");

const courtScene = {
  title: "File:Ghulam Murtaza Khan The Delhi Darbar of Akbar II.jpg",
  categories: ["Category:Delhi Durbar"],
  description: "Akbar II holds court while his sons stand in attendance.",
  license: "Public domain",
};
assert.equal(exclusionReason(courtScene), "group image");

const cabinetGroup = {
  title: "File:Cabinet in 1911.jpg",
  categories: [],
  description: "De izquierda a derecha (de pie) Feliciano Viera, Pedro Manini Ríos, Mateo Margariños Solsona, Antonio M. Rodríguez, el coronel Laborde, José Serrato y Domingo Arena, (sentados) Claudio Williman, Diego Pons y José Batlle y Ordoñez.",
  license: "Public domain",
};
assert.equal(exclusionReason(cabinetGroup), "group image");

const familyPair = {
  title: "File:Father and son.jpg",
  categories: [],
  description: "A father standing beside his son.",
  license: "Public domain",
};
assert.equal(exclusionReason(familyPair), "group image");

const selected = selectImage([
  generatedLincoln,
  lincolnPhoto,
], { wikidataId: "Q91", name: "Abraham Lincoln" });
assert.equal(selected?.title, lincolnPhoto.title);

let attempts = 0;
const retriedResponse = await fetchWithRetry("https://example.invalid", {
  attempts: 3,
  delayMs: 0,
  fetchImpl: async () => {
    attempts += 1;
    if (attempts < 3) throw new TypeError("fetch failed");
    return new Response("ok", { status: 200 });
  },
});
assert.equal(attempts, 3);
assert.equal(await retriedResponse.text(), "ok");

console.log("historical character image rules: ok");
