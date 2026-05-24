export interface ParsedItem {
  rawName: string;
  price: number;
  quantity?: number;
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

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export function parseReceiptText(text: string): ParsedItem[] {
  if (isWalmartWebFormat(text)) {
    return parseWalmartWeb(text);
  }
  return parseGenericReceipt(text);
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
