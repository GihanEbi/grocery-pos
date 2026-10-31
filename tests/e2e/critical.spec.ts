import { expect, test } from "@playwright/test";
import { confirm, login, openRegisterIfNeeded, readData, sellOnPos, stockOf } from "./helpers";

/** Critical workflow coverage — maps 1:1 to the "Required Tests" list in the spec (§16). */

test("1. login with each demo role lands on the right home page", async ({ page }) => {
  await login(page, "admin");
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByTestId("user-menu").click();
  await page.getByTestId("logout").click();
  await expect(page).toHaveURL(/\/login/);

  await login(page, "manager");
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByTestId("user-menu").click();
  await page.getByTestId("logout").click();

  await login(page, "cashier");
  await expect(page).toHaveURL(/\/pos/);
  // Role guard: a cashier can't open product management.
  await page.goto("/products");
  await expect(page.getByText("You don't have access to this page")).toBeVisible();
});

test("2. admin can navigate through all major pages", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "admin");
  const routes = ["/dashboard", "/products", "/inventory", "/inventory/movements", "/inventory/expiry", "/purchasing", "/purchasing/new", "/suppliers", "/sales", "/customers", "/shifts", "/expenses", "/reports", "/ai-assistant", "/notifications", "/settings"];
  for (const r of routes) {
    await page.goto(r);
    await expect(page.locator("main h1").first()).toBeVisible();
  }
  await page.goto("/pos");
  await expect(page.getByTestId("pos-product-grid")).toBeVisible();
  expect(errors).toEqual([]);
});

test("3. add and edit a product", async ({ page }) => {
  await login(page, "manager");
  await page.goto("/products");
  await page.getByTestId("add-product").click();
  await page.getByTestId("product-name").fill("Kithul Treacle 750ml");
  await page.getByTestId("product-sku").fill("PAN-901");
  await page.getByTestId("product-barcode").fill("4790000009019");
  await page.getByTestId("product-cost").fill("950");
  await page.getByTestId("product-price").fill("1180");
  await page.getByTestId("product-opening-stock").fill("12");
  await page.getByTestId("product-min-stock").fill("4");
  await page.getByTestId("product-form-submit").click();
  await page.getByTestId("product-search").fill("PAN-901");
  await expect(page.getByTestId("product-row-PAN-901")).toBeVisible();

  // Duplicate SKU is rejected.
  await page.getByTestId("add-product").click();
  await page.getByTestId("product-name").fill("Duplicate");
  await page.getByTestId("product-sku").fill("PAN-901");
  await expect(page.getByText(/already/i).first()).toBeVisible();
  await page.keyboard.press("Escape");
  const discard = page.getByTestId("confirm-action");
  if (await discard.isVisible().catch(() => false)) await discard.click();

  // Edit the new product.
  await page.getByTestId("product-actions-PAN-901").click();
  await page.getByRole("menuitem", { name: /edit/i }).click();
  await page.getByTestId("product-price").fill("1250");
  await page.getByTestId("product-form-submit").click();
  await expect.poll(async () => (await readData(page)).products.find((p) => p.sku === "PAN-901")?.sellingPrice).toBe(125000);

  // New active, in-stock product is sellable at the POS.
  await page.goto("/pos");
  await page.getByTestId("pos-search").fill("Kithul");
  await expect(page.getByTestId("pos-product-PAN-901")).toBeEnabled();
});

test("4. search and filter products", async ({ page }) => {
  await login(page, "manager");
  await page.goto("/products");
  await page.getByTestId("product-search").fill("RIC-001");
  await expect(page.getByTestId("product-row-RIC-001")).toBeVisible();
  await expect(page.getByTestId("product-row-BAK-001")).toHaveCount(0);
  await page.getByTestId("product-search").fill("");
  await page.goto("/products?status=out_of_stock");
  await expect(page.getByTestId("product-row-VEG-009")).toBeVisible(); // Beans — seeded out of stock
  await expect(page.getByTestId("product-row-RIC-001")).toHaveCount(0);
});

test("5–7. POS sale reduces inventory and shows a receipt", async ({ page }) => {
  await login(page, "cashier");
  const before = await stockOf(page, "BAK-001");
  const salesBefore = (await readData(page)).sales.length;

  await page.getByTestId("pos-product-grid").waitFor();
  await openRegisterIfNeeded(page);
  // Barcode scan of bread, then tap twice more, then a weighed item.
  const bread = (await readData(page)).products.find((p) => p.sku === "BAK-001")!;
  await page.getByTestId("pos-barcode").fill(bread.barcode);
  await page.keyboard.press("Enter");
  await page.getByTestId("pos-product-BAK-001").click();
  await page.getByTestId("cart-inc-BAK-001").click();
  await expect(page.getByTestId("cart-qty-BAK-001")).toHaveValue("3");
  await page.getByTestId("pos-product-RIC-001").click();
  await page.getByTestId("weight-input").fill("1.5");
  await expect(page.getByTestId("weight-price")).toHaveText("Rs 345.00");
  await page.getByTestId("weight-submit").click();

  // Discount within the cashier limit (10%).
  await page.getByTestId("pos-discount").click();
  await page.getByTestId("discount-value").fill("20");
  await expect(page.getByTestId("discount-limit-error")).toBeVisible();
  await page.getByTestId("discount-value").fill("5");
  await page.getByTestId("discount-apply").click();

  await page.getByTestId("pos-pay").click();
  await page.getByTestId("pay-method-cash").click();
  await page.getByTestId("cash-tendered").fill("5000");
  await expect(page.getByTestId("change-due")).not.toHaveText("Rs 0.00");
  await page.getByTestId("complete-payment").click();
  await expect(page.getByTestId("sale-complete")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("receipt")).toContainText("Sandwich Bread 450g");
  await expect(page.getByTestId("receipt")).toContainText("Bill discount");

  expect(await stockOf(page, "BAK-001")).toBe(before - 3);
  const data = await readData(page);
  expect(data.sales.length).toBe(salesBefore + 1);
  expect(data.movements.some((m) => m.type === "sale" && m.reference === data.sales[0].receiptNo)).toBe(true);

  // Receipt is reachable from sales history too.
  await page.getByTestId("new-sale").click();
  await page.goto(`/sales/${data.sales[0].id}`);
  await page.getByTestId("view-receipt").click();
  await expect(page.getByTestId("receipt")).toContainText(data.sales[0].receiptNo);
});

test("POS blocks checkout when stock is insufficient", async ({ page }) => {
  await login(page, "cashier");
  await page.goto("/pos");
  await expect(page.getByTestId("pos-product-VEG-009")).toBeDisabled(); // out of stock
});

test("8–9. create a purchase order, approve and receive stock", async ({ page }) => {
  await login(page, "manager");
  const before = await stockOf(page, "PAN-001");
  await page.goto("/purchasing/new");
  await page.getByTestId("po-supplier-select").click();
  await page.getByRole("option", { name: /Ceylon Spice/ }).click();
  await page.getByTestId("po-add-item-search").fill("Coconut Oil");
  const oil = (await readData(page)).products.find((p) => p.sku === "PAN-001")!;
  await page.getByTestId(`po-product-option-${oil.id}`).click();
  await page.getByTestId(`po-line-qty-${oil.id}`).fill("24");
  await page.getByTestId("po-save-approve").click();
  await confirm(page);
  await expect(page).toHaveURL(/\/purchasing\?po=/);
  await expect(page.getByTestId("po-detail")).toBeVisible();

  await page.getByTestId("po-receive").click();
  await page.getByTestId("receive-confirm").click();
  await confirm(page);
  await expect.poll(() => stockOf(page, "PAN-001")).toBe(before + 24);
  const data = await readData(page);
  expect(data.purchaseOrders[0].status).toBe("received");
  expect(data.movements.some((m) => m.type === "purchase" && m.reference === data.purchaseOrders[0].poNumber)).toBe(true);
});

test("10. process a valid return", async ({ page }) => {
  await login(page, "manager");
  const data = await readData(page);
  const sale = data.sales.find((s) => s.status === "completed" && s.items[0].unit !== "kg" && s.items[0].quantity >= 1)!;
  const item = sale.items[0];
  const product = data.products.find((p) => p.id === item.productId)!;
  await page.goto(`/sales/${sale.id}`);
  await page.getByTestId("return-open").click();
  await page.getByTestId(`return-check-${item.productId}`).click();
  await page.getByTestId(`return-qty-${item.productId}`).fill(String(item.quantity + 5));
  await expect(page.getByText(/remaining eligible/i)).toBeVisible();
  await page.getByTestId(`return-qty-${item.productId}`).fill("1");
  await page.getByTestId("return-reason").click();
  await page.getByRole("option", { name: "Customer changed mind" }).click();
  await page.getByTestId("return-review").click();
  await page.getByTestId("return-confirm").click();
  await expect.poll(async () => (await readData(page)).returns.length).toBe(data.returns.length + 1);
  const after = await readData(page);
  expect(after.sales.find((s) => s.id === sale.id)!.status).not.toBe("completed");
  expect(after.products.find((p) => p.id === product.id)!.stock).toBe(product.stock + 1);
});

test("11. add an expense", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/expenses");
  await page.getByTestId("add-expense").click();
  await page.getByTestId("expense-description").fill("Freezer gasket replacement");
  await page.getByTestId("expense-amount").fill("4250");
  await page.getByTestId("expense-form-submit").click();
  await expect(page.getByTestId("expenses-table")).toContainText("Freezer gasket replacement");
});

test("12. reports respond to date filters", async ({ page }) => {
  await login(page, "manager");
  await page.goto("/reports");
  await expect(page.getByTestId("reports-tabs")).toBeVisible();
  const trigger = page.getByTestId("date-range-trigger").first();
  await expect(trigger).toContainText("Last 30 days");
  await trigger.click();
  await page.getByRole("button", { name: "Last 7 days" }).click();
  await expect(trigger).toContainText("Last 7 days");
  await page.getByTestId("report-tab-profit").click();
  await expect(page.locator(".print-area")).toContainText(/profit/i);
});

test("13. AI assistant answers business questions and drafts a PO", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/ai-assistant");
  await page.getByTestId("ai-input").fill("Which products are low on stock?");
  await page.getByTestId("ai-send").click();
  await expect(page.getByTestId("ai-message").last()).toContainText(/stock/i, { timeout: 10_000 });

  await page.getByTestId("ai-input").fill("How much did we sell today?");
  await page.getByTestId("ai-send").click();
  await expect(page.getByTestId("ai-message")).toHaveCount(2, { timeout: 10_000 });
  await expect(page.getByTestId("ai-message").last()).toContainText("Rs");

  await page.getByTestId("ai-input").fill("What should I reorder?");
  await page.getByTestId("ai-send").click();
  await expect(page.getByTestId("ai-message")).toHaveCount(3, { timeout: 10_000 });
  const poCount = (await readData(page)).purchaseOrders.length;
  await page.getByTestId("ai-message").last().getByTestId("create-draft-po").first().click();
  await expect(page).toHaveURL(/\/purchasing\/new\?.*source=ai/);
  await expect(page.getByTestId("po-ai-banner")).toBeVisible();
  // Nothing is saved until the user confirms.
  expect((await readData(page)).purchaseOrders.length).toBe(poCount);
});

test("14. switch between light and dark themes", async ({ page }) => {
  await login(page, "admin");
  await page.getByTestId("theme-toggle").click();
  await page.getByTestId("theme-dark").click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByTestId("theme-toggle").click();
  await page.getByTestId("theme-light").click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("15. mobile navigation drawer", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, "admin");
  await page.getByTestId("mobile-menu").click();
  await expect(page.getByTestId("mobile-nav")).toBeVisible();
  await page.getByTestId("mobile-nav").getByTestId("nav-inventory").click();
  await expect(page).toHaveURL(/\/inventory/);
  await expect(page.getByTestId("mobile-nav")).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});

test("16. data persists across a page refresh", async ({ page }) => {
  await login(page, "cashier");
  const receipt = await sellOnPos(page, ["SNK-001"]);
  await page.reload();
  await page.goto("/sales");
  await page.getByTestId("sales-search").fill(receipt);
  await expect(page.getByTestId(`sale-row-${receipt}`)).toBeVisible();
});

test("17. reset demo data restores the original state", async ({ page }) => {
  await login(page, "admin");
  const seeded = await readData(page);
  await sellOnPos(page, ["SNK-001"]);
  expect((await readData(page)).sales.length).toBe(seeded.sales.length + 1);
  await page.goto("/settings?tab=demo");
  await page.getByTestId("reset-demo-data").click();
  await confirm(page);
  await expect.poll(async () => (await readData(page)).sales.length).toBe(seeded.sales.length);
  expect((await readData(page)).products.find((p) => p.sku === "SNK-001")!.stock).toBe(seeded.products.find((p) => p.sku === "SNK-001")!.stock);
});
