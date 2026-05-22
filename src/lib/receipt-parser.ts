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

export function parseReceiptText(text: string): ParsedItem[] {
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
