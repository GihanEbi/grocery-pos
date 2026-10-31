import { test } from "@playwright/test";
import { login } from "./helpers";

/**
 * Captures documentation screenshots into docs/screenshots.
 * Run with: npm run screenshots   (skipped during the normal test run)
 */
test.skip(!process.env.SCREENSHOTS, "Set SCREENSHOTS=1 to capture documentation screenshots");

const PAGES: [string, string][] = [
  ["dashboard", "/dashboard"],
  ["products", "/products"],
  ["inventory", "/inventory"],
  ["purchasing", "/purchasing"],
  ["reports", "/reports"],
  ["ai-assistant", "/ai-assistant?q=What%20should%20I%20reorder%3F"],
];

for (const theme of ["light", "dark"] as const) {
  test(`capture ${theme} screenshots`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, "admin");
    for (const [name, url] of PAGES) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(name === "ai-assistant" ? 2500 : 900);
      await page.screenshot({ path: `docs/screenshots/${name}-${theme}.png` });
    }
    // POS with a bill in progress
    await page.goto("/pos");
    for (const sku of ["BAK-001", "DAI-008", "SNK-001", "BEV-001"]) await page.getByTestId(`pos-product-${sku}`).click();
    await page.getByTestId("pos-product-RIC-002").click();
    await page.getByTestId("weight-input").fill("2");
    await page.getByTestId("weight-submit").click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `docs/screenshots/pos-${theme}.png` });
  });
}

test("capture mobile screenshots", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "admin");
  for (const [name, url] of [["dashboard", "/dashboard"], ["pos", "/pos"]] as const) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(900);
    await page.screenshot({ path: `docs/screenshots/${name}-mobile.png` });
  }
});
