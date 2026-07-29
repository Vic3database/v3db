import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const baseUrl = process.argv[2] || "http://127.0.0.1:8877/vc/index.html";
const chromePath = process.env.VC_CHROME_PATH || "";
const expectedCountries = [
  { tag: "IMP", name: "帝国联邦", defaultImage: "assets/victorian-century-flags/IMP/IMP.png", variants: 3 },
  { tag: "RME", name: "罗马帝国", defaultImage: "assets/victorian-century-flags/RME/RME_Flag_Monarchy.png", variants: 4 },
];
const browser = await chromium.launch({
  headless: true,
  ...(chromePath ? { executablePath: chromePath } : {}),
});

const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

  const results = {};
  for (const expected of expectedCountries) {
    await page.goto(`${baseUrl}#/country/${expected.tag}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForSelector(".detail-title .country-flag-title", { state: "visible", timeout: 20000 });
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll(".country-flag-variant-image"))
        .every((image) => image.complete && image.naturalWidth === 240 && image.naturalHeight === 144),
      { timeout: 20000 },
    );
    const result = await page.evaluate(() => ({
      title: document.querySelector(".detail-title h2")?.textContent?.trim() || "",
      defaultImage: document.querySelector(".detail-title .country-flag-title")?.getAttribute("src") || "",
      variants: Array.from(document.querySelectorAll(".country-flag-variant-image"), (image) => image.getAttribute("src") || ""),
    }));
    assert(result.title === expected.name, `${expected.tag} detail title is incorrect: ${result.title}`);
    assert(result.defaultImage === expected.defaultImage, `${expected.tag} default flag path is incorrect: ${result.defaultImage}`);
    assert(result.variants.length === expected.variants, `${expected.tag} flag variant count is incorrect: ${result.variants.length}`);
    results[expected.tag] = result;
  }
  await page.close();
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(JSON.stringify({ victorian_century_country_flags_browser: "ok", baseUrl, results }, null, 2));
} finally {
  await browser.close();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
