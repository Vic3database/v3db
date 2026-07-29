import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const baseUrl = process.argv[2] || "http://127.0.0.1:8877/vc/index.html";
const chromePath = process.env.VC_CHROME_PATH || "";
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

  await page.goto(`${baseUrl}#/region`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector("[data-state-region='STATE_SVEALAND']", { state: "attached", timeout: 20000 });
  const listBadges = await page.evaluate(() => {
    const row = document.querySelector("[data-state-region='STATE_SVEALAND']");
    return {
      added: row?.querySelectorAll(".country-tags .tag-vc-added").length || 0,
      adjusted: row?.querySelectorAll(".country-tags .tag-vc-adjusted").length || 0,
    };
  });
  assert(listBadges.added === 0, `region list should not repeat added state-trait badges: ${JSON.stringify(listBadges)}`);
  assert(listBadges.adjusted === 1, `region list should show the adjusted region badge only once: ${JSON.stringify(listBadges)}`);

  await page.goto(`${baseUrl}#/state-region/STATE_SVEALAND`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForSelector(".trait-card-layout .tag-vc-added", { state: "visible", timeout: 20000 });
  const detailBadges = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll(".trait-card-layout"));
    const changedCards = cards
      .map((card) => {
        const title = card.querySelector(".rule-head strong");
        const badge = title?.querySelector(".tag-vc");
        const nameRange = document.createRange();
        if (title?.firstChild) nameRange.selectNode(title.firstChild);
        const nameRect = nameRange.getBoundingClientRect();
        const badgeRect = badge?.getBoundingClientRect();
        return {
          name: title?.childNodes?.[0]?.textContent?.trim() || "",
          addedInsideName: Boolean(title?.querySelector(".tag-vc-added")),
          adjustedInsideName: Boolean(title?.querySelector(".tag-vc-adjusted")),
          gap: badgeRect && nameRect ? Math.round((badgeRect.left - nameRect.right) * 100) / 100 : Number.NaN,
        };
      })
      .filter((card) => card.addedInsideName || card.adjustedInsideName);
    return { changedCards };
  });
  assert(detailBadges.changedCards.length === 3, `state trait detail should retain all three changed-trait badges: ${JSON.stringify(detailBadges)}`);
  assert(detailBadges.changedCards.filter((card) => card.addedInsideName).length === 2, `state trait detail should show two added badges after the Chinese names: ${JSON.stringify(detailBadges)}`);
  assert(detailBadges.changedCards.filter((card) => card.adjustedInsideName).length === 1, `state trait detail should show one adjusted badge after the Chinese name: ${JSON.stringify(detailBadges)}`);
  assert(detailBadges.changedCards.every((card) => card.gap >= 11 && card.gap <= 13), `state trait detail badge spacing should be 12px after the Chinese name: ${JSON.stringify(detailBadges)}`);

  await page.close();
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(JSON.stringify({ victorian_century_region_trait_badges_browser: "ok", listBadges, detailBadges }, null, 2));
} finally {
  await browser.close();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
