import type { Category, Product } from "@/types";

/** Emoji illustrations offered in the product form image picker. */
export const PRODUCT_EMOJIS = ["📦", "🍚", "🌾", "🥬", "🥕", "🍅", "🧅", "🍌", "🍎", "🥛", "🧀", "🥚", "🍞", "🧃", "🍪", "🐟"] as const;

export const MAX_IMAGE_BYTES = 300 * 1024;

/** EAN-13 check digit for a 12-digit body. */
export function ean13CheckDigit(body12: string): string {
  const s = body12.split("").map(Number).reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  return String((10 - (s % 10)) % 10);
}

export function isValidEan13(code: string): boolean {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === code[12];
}

/** Random valid EAN-13 starting with the Sri Lanka GS1 prefix 479, unique against `taken`. */
export function generateBarcode(taken: Set<string>): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let body = "479";
    for (let i = 0; i < 9; i++) body += Math.floor(Math.random() * 10);
    const code = body + ean13CheckDigit(body);
    if (!taken.has(code)) return code;
  }
  return "4790000000000";
}

/** Category SKU prefix — reuses the prefix existing products in that category use. */
export function skuPrefix(category: Category | undefined, products: Product[]): string {
  if (!category) return "PRD";
  const existing = products.find((p) => p.categoryId === category.id && /^[A-Z]{2,5}-\d+$/.test(p.sku));
  if (existing) return existing.sku.split("-")[0]!;
  const letters = category.name.replace(/[^A-Za-z]/g, "").toUpperCase();
  return (letters.slice(0, 3) || "PRD").padEnd(3, "X");
}

/** Next free SKU for a category, e.g. "DAI-019". */
export function suggestSku(category: Category | undefined, products: Product[]): string {
  const prefix = skuPrefix(category, products);
  const re = new RegExp(`^${prefix}-(\\d+)$`, "i");
  const max = products.reduce((m, p) => {
    const match = p.sku.match(re);
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  const taken = new Set(products.map((p) => p.sku.toLowerCase()));
  let n = max + 1;
  while (taken.has(`${prefix}-${String(n).padStart(3, "0")}`.toLowerCase())) n++;
  return `${prefix}-${String(n).padStart(3, "0")}`;
}
