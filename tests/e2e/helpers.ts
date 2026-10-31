import { expect, type Page } from "@playwright/test";
import type { AppData } from "../../src/types/data";

export type Role = "admin" | "manager" | "cashier";

/** Sign in with a demo account from the login page. Each test starts with fresh storage → fresh seed data. */
export async function login(page: Page, role: Role) {
  await page.goto("/login");
  await page.getByTestId(`demo-login-${role}`).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
}

/** Read the persisted demo dataset straight from localStorage. */
export async function readData(page: Page): Promise<AppData> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("freshmart-pos-data") ?? "{}").state);
}

export async function stockOf(page: Page, sku: string): Promise<number> {
  const d = await readData(page);
  return d.products.find((p) => p.sku === sku)!.stock;
}

/** Accept the shared confirmation dialog. */
export async function confirm(page: Page) {
  await page.getByTestId("confirm-action").click();
}

export async function openRegisterIfNeeded(page: Page) {
  const banner = page.getByTestId("register-closed-banner");
  if (await banner.isVisible()) {
    await page.getByTestId("pos-open-register").click();
    await page.getByTestId("pos-open-register-submit").click();
    await expect(banner).toBeHidden();
  }
}

/** Complete a cash sale of the given product SKUs (non-weighted) on the POS. */
export async function sellOnPos(page: Page, skus: string[]) {
  await page.goto("/pos");
  await page.getByTestId("pos-product-grid").waitFor();
  await openRegisterIfNeeded(page);
  for (const sku of skus) await page.getByTestId(`pos-product-${sku}`).click();
  await page.getByTestId("pos-pay").click();
  await page.getByTestId("pay-method-cash").click();
  await page.getByTestId("cash-exact").click();
  await page.getByTestId("complete-payment").click();
  await expect(page.getByTestId("sale-complete")).toBeVisible({ timeout: 15_000 });
  return (await page.getByTestId("receipt-number").textContent())!.trim();
}
