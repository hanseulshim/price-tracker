export interface ParsedItem {
  rawName: string;
  price: number;
  quantity?: number;
}

export interface ParsedReceipt {
  items: ParsedItem[];
  date?: string; // ISO date string YYYY-MM-DD if detected
}

// Lines to skip that match common receipt noise
const SKIP_PATTERNS = [
  /^(sub)?total/i,
  /^tax/i,
  /^balance/i,
  /^change/i,
  /^cash/i,
  /^credit/i,
  /^debit/i,
  /^visa/i,
  /^mastercard/i,
  /^amex/i,
  /^payment/i,
  /^thank you/i,
  /^savings/i,
  /^discount/i,
  /^coupon/i,
  /^member/i,
  /^\*+/,
  /^-+$/,
  /^=+$/,
  /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/, // dates
  /^#\d+/, // order numbers
  /^\(\d{3}\)/, // phone numbers
];

// Patterns to extract price from a line
const PRICE_PATTERNS = [
  // "2 x $1.99" or "2 @ $1.99"
  /^(\d+(?:\.\d+)?)\s*[@x]\s*\$?(\d+\.\d{2})\s*$/i,
  // "ITEM NAME    $1.99" or "ITEM NAME    1.99"
  /^(.+?)\s{2,}\$?(\d+\.\d{2})\s*[A-Z]?\s*$/,
  // "ITEM NAME $1.99" with single space
  /^(.+?)\s+\$(\d+\.\d{2})\s*$/,
];

// ─── Walmart Web Page Format Parser ───────────────────────────────────────────
// Handles copy-paste from walmart.com/orders — structured blocks with
// section headers (Weight-adjusted / Shopped / Unavailable), per-item
// Qty lines, savings lines, and "Was $X.XX" original-price markers.

const WALMART_SECTION_HEADERS = new Set([
  "Weight-adjusted",
  "Shopped",
  "Unavailable",
]);

const WALMART_DETAIL_PATTERNS = [
  /^\d+\s+items\s+received$/i,
  /^Qty\s+\d+$/,
  /^Final weight/i,
  /^Requested weight/i,
  /^Multipack Quantity/i,
  /^Was \$/,
  /from savings$/i,
  / ea$/i,
  /^Ordered price/i,
  /^Discount price/i,
  /[¢$]\/(?:oz|lb|ea|fl\s*oz)/i, // unit rates: "24.8¢/oz", "$3.22/lb"
  /^\$[\d.]+\//, // "$X.XX/unit"
  /^\$[\d.]+$/, // standalone price like "$4.24"
  /^\d+\.?\d*\s*lbs?$/, // weight: "1.7 lbs"
];

function isWalmartDetailLine(line: string): boolean {
  return (
    WALMART_SECTION_HEADERS.has(line) ||
    WALMART_DETAIL_PATTERNS.some((p) => p.test(line))
  );
}

function isWalmartItemName(line: string): boolean {
  if (!line || isWalmartDetailLine(line)) return false;
  // Must start with a letter (product names) — handles "fairlife" (lowercase)
  return /^[A-Za-z]/.test(line);
}

function extractWalmartItemPrice(block: string[]): {
  price: number | null;
  qty: number;
} {
  let qty = 1;
  const prices: { index: number; value: number }[] = [];
  let wasIndex = -1;

  for (let i = 0; i < block.length; i++) {
    const line = block[i];

    const qtyMatch = line.match(/^Qty\s+(\d+)$/);
    if (qtyMatch) {
      qty = parseInt(qtyMatch[1]);
      continue;
    }

    if (/^Was \$/.test(line)) {
      wasIndex = i;
      continue;
    }

    // Skip all non-plain-price detail lines
    if (
      /from savings$/i.test(line) ||
      / ea$/i.test(line) ||
      /^Ordered price/i.test(line) ||
      /^Discount price/i.test(line) ||
      /[¢$]\//.test(line) ||
      /^\$[\d.]+\//.test(line) ||
      /^Final weight/i.test(line) ||
      /^Requested weight/i.test(line) ||
      /^Multipack Quantity/i.test(line) ||
      /^\d+\.?\d*\s*lbs?$/.test(line)
    ) {
      continue;
    }

    const priceMatch = line.match(/^\$(\d+\.\d{2})$/);
    if (priceMatch) {
      prices.push({ index: i, value: parseFloat(priceMatch[1]) });
    }
  }

  let finalPrice: number | null = null;
  if (wasIndex >= 0) {
    // Item had a discount — use the last plain price BEFORE "Was $X"
    const beforeWas = prices.filter((p) => p.index < wasIndex);
    if (beforeWas.length > 0) {
      finalPrice = beforeWas[beforeWas.length - 1].value;
    }
  } else {
    // No discount — use last plain price
    if (prices.length > 0) {
      finalPrice = prices[prices.length - 1].value;
    }
  }

  return { price: finalPrice, qty };
}

function parseWalmartWeb(text: string): ParsedItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const items: ParsedItem[] = [];
  let currentSection = "";
  let currentItemName = "";
  let currentBlock: string[] = [];

  function flushItem() {
    if (!currentItemName || currentSection === "Unavailable") return;
    const { price, qty } = extractWalmartItemPrice(currentBlock);
    if (price === null || price <= 0) return;
    const unitPrice = Math.round((price / qty) * 100) / 100;
    items.push({
      rawName: cleanItemName(currentItemName),
      price: unitPrice,
      quantity: qty > 1 ? qty : undefined,
    });
  }

  for (const line of lines) {
    if (WALMART_SECTION_HEADERS.has(line)) {
      flushItem();
      currentSection = line;
      currentItemName = "";
      currentBlock = [];
      continue;
    }

    if (!currentSection) continue; // skip header lines before first section

    if (isWalmartItemName(line)) {
      flushItem();
      currentItemName = line;
      currentBlock = [];
    } else {
      currentBlock.push(line);
    }
  }

  flushItem(); // process last item
  return items;
}

function isWalmartWebFormat(text: string): boolean {
  return (
    /\d+\s+items\s+received/i.test(text) &&
    (WALMART_SECTION_HEADERS.has("Shopped") ||
      WALMART_SECTION_HEADERS.has("Weight-adjusted")) &&
    /Weight-adjusted|Shopped/m.test(text) &&
    /[¢$]\/(?:oz|lb|ea|fl\s*oz)/i.test(text)
  );
}

// ─── Costco Receipt Parser ────────────────────────────────────────────────────
// Handles copy-paste from Costco paper receipts — tab-separated lines:
//   [E]\t<itemNum>\t<NAME>\t<price> <taxCode>
//   \t<discountNum>\t/ <itemNum>\t<amount>-
// Discounts are applied back to the item they reference (by item number).

function titleCase(str: string): string {
  return str.toLowerCase().replace(/(?:^|\s)\w/g, (c) => c.toUpperCase());
}

function parseCostco(text: string): ParsedItem[] {
  const lines = text.split(/\r?\n/);
  const items: ParsedItem[] = [];
  // item number → index in items[]
  const itemIndexByNum: Record<string, number> = {};
  let lastItemIndex = -1;

  for (const raw of lines) {
    const parts = raw.split("\t");

    let itemNum: string;
    let name: string;
    let priceField: string;

    // 4 fields: [taxCode, itemNum, name, price]
    if (parts.length >= 4) {
      itemNum = parts[1].trim();
      name = parts[2].trim();
      priceField = parts[3].trim();
    } else if (parts.length === 3) {
      // 3 fields: [itemNum, name, price] (no leading tax code tab)
      itemNum = parts[0].trim();
      name = parts[1].trim();
      priceField = parts[2].trim();
    } else {
      continue;
    }

    if (!name || !priceField) continue;

    // Discount line: name starts with "/"
    if (name.startsWith("/")) {
      const discountMatch = priceField.match(/^(\d+\.\d{2})-$/);
      if (!discountMatch) continue;
      const discount = parseFloat(discountMatch[1]);

      // Try to find the referenced item number (e.g. "/ 1271446" or "/2012084")
      const refNum = name.replace(/^\/\s*/, "").trim();
      if (itemIndexByNum[refNum] !== undefined) {
        const idx = itemIndexByNum[refNum];
        items[idx].price = Math.round((items[idx].price - discount) * 100) / 100;
      } else if (lastItemIndex >= 0) {
        // Fallback: apply to last item (e.g. "/WATER" reference)
        items[lastItemIndex].price =
          Math.round((items[lastItemIndex].price - discount) * 100) / 100;
      }
      continue;
    }

    // Regular item: price field like "10.79 3" or "14.99 Y" or "5.00 N"
    const priceMatch = priceField.match(/^(\d+\.\d{2})\s+[0-9A-Z]$/);
    if (!priceMatch) continue;
    const price = parseFloat(priceMatch[1]);
    if (price <= 0 || price > 9999) continue;

    // Skip subtotal/tax/total summary rows
    const strippedName = name.replace(/^\*+/, "").trim();
    if (!strippedName || /^(SUBTOTAL|TAX|TOTAL|CMN-DONATION)/i.test(strippedName)) continue;

    // Clean name: strip leading *** (Kirkland item prefix), title-case
    const cleanName = titleCase(strippedName);

    const index = items.length;
    items.push({ rawName: cleanName, price });
    if (itemNum) itemIndexByNum[itemNum] = index;
    lastItemIndex = index;
  }

  // Drop any items with non-positive price after discounts
  return items.filter((item) => item.price > 0);
}

function isCostcoFormat(text: string): boolean {
  // Costco receipts have tab-separated lines with price codes (3/Y/N)
  // and typically contain "Costco" or the characteristic SUBTOTAL/Total lines
  return (
    /costco/i.test(text) ||
    (/\t[A-Z0-9 &*/]+\t\d+\.\d{2}\s+[3YN]\b/.test(text) &&
      /SUBTOTAL/.test(text))
  );
}

// ─── Date Extraction ──────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Attempts to extract a date from receipt text.
 * Handles formats like:
 *   "May 20, 2026 order"
 *   "Delivered on May 20"  (current year assumed)
 *   "05/20/2026", "5/20/26"
 *   "2026-05-20"
 */
export function extractDate(text: string): string | undefined {
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  for (const line of lines) {
    // "Month DD, YYYY" or "Month DD YYYY" — e.g. "May 20, 2026 order"
    const longDate = line.match(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2}),?\s+(\d{4})\b/i
    );
    if (longDate) {
      const month = MONTHS[longDate[1].toLowerCase()];
      const day = parseInt(longDate[2]);
      const year = parseInt(longDate[3]);
      if (month && day >= 1 && day <= 31) return toISO(year, month, day);
    }

    // ISO date "YYYY-MM-DD"
    const iso = line.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (iso) {
      const year = parseInt(iso[1]);
      if (year >= 2000 && year <= 2100) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    }

    // MM/DD/YYYY or M/D/YY
    const slashDate = line.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
    if (slashDate) {
      const month = parseInt(slashDate[1]);
      const day = parseInt(slashDate[2]);
      let year = parseInt(slashDate[3]);
      if (year < 100) year += 2000;
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000)
        return toISO(year, month, day);
    }
  }

  return undefined;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export function parseReceiptText(text: string): ParsedReceipt {
  const date = extractDate(text);
  let items: ParsedItem[];
  if (isCostcoFormat(text)) {
    items = parseCostco(text);
  } else if (isWalmartWebFormat(text)) {
    items = parseWalmartWeb(text);
  } else {
    items = parseGenericReceipt(text);
  }
  return { items, date };
}

function parseGenericReceipt(text: string): ParsedItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const items: ParsedItem[] = [];

  for (const line of lines) {
    // Skip noise lines
    if (SKIP_PATTERNS.some((p) => p.test(line))) continue;

    // Try quantity multiplier pattern first: "2 x $1.99" or "2 @ 3.00"
    const qtyMatch = line.match(
      /^(\d+(?:\.\d+)?)\s*[@x]\s*\$?(\d+\.\d{2})/i
    );
    if (qtyMatch) {
      // This is a quantity line — look back at the previous item
      const qty = parseFloat(qtyMatch[1]);
      if (items.length > 0) {
        items[items.length - 1].quantity = qty;
      }
      continue;
    }

    // Try price extraction patterns
    let matched = false;
    for (const pattern of PRICE_PATTERNS) {
      const m = line.match(pattern);
      if (m) {
        const name = m[1].trim();
        const price = parseFloat(m[2]);

        if (
          !name ||
          isNaN(price) ||
          price <= 0 ||
          price > 9999 ||
          name.length < 2
        ) {
          continue;
        }

        // Skip lines where the "name" is just digits or very short noise
        if (/^\d+$/.test(name)) continue;

        items.push({ rawName: cleanItemName(name), price });
        matched = true;
        break;
      }
    }

    // If no pattern matched but line has a price at the end, try a looser pattern
    if (!matched) {
      const looseMatch = line.match(/^(.{3,40}?)\s+(\d+\.\d{2})\s*$/);
      if (looseMatch) {
        const name = looseMatch[1].trim();
        const price = parseFloat(looseMatch[2]);
        if (name && !isNaN(price) && price > 0 && price < 9999) {
          if (SKIP_PATTERNS.every((p) => !p.test(name))) {
            items.push({ rawName: cleanItemName(name), price });
          }
        }
      }
    }
  }

  return items;
}

function cleanItemName(name: string): string {
  return name
    .replace(/\s+/g, " ")
    .replace(/[*#@]/g, "")
    .replace(/\s*[A-Z]\s*$/, "") // trailing sale flag like "F" or "B"
    .trim();
}
