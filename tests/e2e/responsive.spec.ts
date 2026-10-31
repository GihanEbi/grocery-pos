import { expect, test } from "@playwright/test";
import { login } from "./helpers";

/** No horizontal page overflow and readable layout at the four required widths. */
const WIDTHS = [375, 768, 1280, 1920];
const ROUTES = ["/dashboard", "/pos", "/products", "/inventory", "/inventory/expiry", "/purchasing", "/purchasing/new", "/suppliers", "/sales", "/customers", "/shifts", "/expenses", "/reports", "/ai-assistant", "/notifications", "/settings"];

for (const width of WIDTHS) {
  test(`layouts fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 800 ? 812 : 900 });
    await login(page, "admin");
    const overflowing: string[] = [];
    for (const r of ROUTES) {
      await page.goto(r);
      await page.waitForLoadState("networkidle");
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 1) overflowing.push(`${r} (+${over}px)`);
    }
    expect(overflowing).toEqual([]);
  });
}

test("dialogs fit on a small phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await login(page, "admin");
  await page.goto("/products");
  await page.getByTestId("add-product").click();
  const box = await page.getByRole("dialog").boundingBox();
  expect(box!.width).toBeLessThanOrEqual(376);
  expect(box!.x).toBeGreaterThanOrEqual(0);
});
