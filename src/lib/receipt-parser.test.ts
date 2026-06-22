import { describe, it, expect } from "vitest";
import {
  parseReceiptText,
  extractDate,
  extractOrderNumber,
  extractStoreAddress,
} from "./receipt-parser";

// ─── Costco Parser ────────────────────────────────────────────────────────────

describe("Costco parser", () => {
  // Wrap lines in minimal Costco context so isCostcoFormat triggers via
  // the "costco" keyword in the header.
  function makeCostcoText(lines: string): string {
    return `Costco Wholesale\n${lines}\nSUBTOTAL\t\t\t100.00\n`;
  }

  it("parses a 4-field item line (tax code as first field, no leading tab)", () => {
    // Format: taxCode\titemNum\tname\tprice
    const text = makeCostcoText("E\t1234567\tKS OLIVE OIL\t14.99 Y");
    const { items } = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0].rawName).toBe("Ks Olive Oil");
    expect(items[0].price).toBe(14.99);
    expect(items[0].externalId).toBe("1234567");
  });

  it("parses a 3-field item line (no tax code prefix)", () => {
    // Format: itemNum\tname\tprice
    const text = makeCostcoText("1234567\tKS OLIVE OIL\t14.99 Y");
    const { items } = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0].rawName).toBe("Ks Olive Oil");
    expect(items[0].price).toBe(14.99);
    expect(items[0].externalId).toBe("1234567");
  });

  it("applies a discount line and sets originalPrice", () => {
    // Discount line: \t\t/ <itemNum>\t<amount>-
    const lines = [
      "Y\t1234567\tKS OLIVE OIL\t14.99 Y",
      "\t\t/ 1234567\t3.00-",
    ].join("\n");
    const text = makeCostcoText(lines);
    const { items } = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0].price).toBe(11.99);
    expect(items[0].originalPrice).toBe(14.99);
  });

  it("skips SUBTOTAL and TAX summary rows", () => {
    // These item names are explicitly filtered out by the parser
    const lines = [
      "Y\t9999999\tSUBTOTAL\t200.00 Y",
      "Y\t8888888\tTAX\t10.00 3",
      "N\t1111111\tKS WATER\t5.99 N",
    ].join("\n");
    const text = makeCostcoText(lines);
    const { items } = parseReceiptText(text);
    expect(items.some((i) => i.rawName === "Ks Water")).toBe(true);
    expect(items.every((i) => !/subtotal|tax/i.test(i.rawName))).toBe(true);
  });

  it("drops items whose price becomes non-positive after a full discount", () => {
    // A $5.00 item with a $5.00 discount → price = 0 → filtered out
    const lines = [
      "N\t7654321\tFREE ITEM\t5.00 N",
      "\t\t/ 7654321\t5.00-",
    ].join("\n");
    const text = makeCostcoText(lines);
    const { items } = parseReceiptText(text);
    expect(items).toHaveLength(0);
  });

  it("title-cases item names", () => {
    const text = makeCostcoText("N\t5555555\tKS SPARKLING WATER\t6.99 N");
    const { items } = parseReceiptText(text);
    expect(items[0].rawName).toBe("Ks Sparkling Water");
  });

  it("parses multiple items correctly", () => {
    const lines = [
      "Y\t1000001\tKS BACON\t12.99 Y",
      "N\t1000002\tORGANIC MILK\t5.49 N",
      "3\t1000003\tCHEDDAR CHEESE\t8.99 3",
    ].join("\n");
    const text = makeCostcoText(lines);
    const { items } = parseReceiptText(text);
    expect(items).toHaveLength(3);
    expect(items[0].rawName).toBe("Ks Bacon");
    expect(items[1].rawName).toBe("Organic Milk");
    expect(items[2].rawName).toBe("Cheddar Cheese");
  });
});

// ─── Walmart Web Parser ───────────────────────────────────────────────────────

describe("Walmart Web parser (isWalmartWebFormat)", () => {
  // isWalmartWebFormat requires: "N items received", a section header
  // (Shopped or Weight-adjusted), and a unit rate like "24.8¢/oz".
  const UNIT_RATE = "24.8¢/oz";

  it("is detected when text has items-received count, section header, and unit rate", () => {
    const text = [
      "3 items received",
      "Shopped",
      "Great Value Whole Milk",
      "$3.99",
      UNIT_RATE,
    ].join("\n");
    const { items } = parseReceiptText(text);
    expect(items.length).toBeGreaterThan(0);
  });

  it("parses a basic item under the Shopped section", () => {
    const text = [
      "1 items received",
      "Shopped",
      "Great Value Whole Milk",
      "$3.99",
      UNIT_RATE,
    ].join("\n");
    const { items } = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0].rawName).toBe("Great Value Whole Milk");
    expect(items[0].price).toBe(3.99);
  });

  it("sets originalPrice from 'Was $X.XX' line (discounted item)", () => {
    const text = [
      "1 items received",
      "Shopped",
      "Tropicana Orange Juice",
      "$3.48",
      "Was $4.98",
      UNIT_RATE,
    ].join("\n");
    const { items } = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0].price).toBe(3.48);
    expect(items[0].originalPrice).toBe(4.98);
  });

  it("skips items under the Unavailable section", () => {
    const text = [
      "2 items received",
      "Shopped",
      "Great Value Whole Milk",
      "$3.99",
      UNIT_RATE,
      "Unavailable",
      "Out Of Stock Item",
      "$2.49",
      UNIT_RATE,
    ].join("\n");
    const { items } = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0].rawName).toBe("Great Value Whole Milk");
  });

  it("divides total price by qty when Qty > 1 and sets quantity", () => {
    const text = [
      "1 items received",
      "Shopped",
      "Lipton Tea Bags",
      "Qty 2",
      "$6.00",
      UNIT_RATE,
    ].join("\n");
    const { items } = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0].price).toBe(3.0);
    expect(items[0].quantity).toBe(2);
  });

  it("parses items in the Weight-adjusted section", () => {
    // Weight-adjusted items have a weight line and a per-lb rate instead of ¢/oz,
    // but we include ¢/oz elsewhere to satisfy format detection.
    const text = [
      "2 items received",
      "Weight-adjusted",
      "Organic Bananas",
      "$1.47",
      "1.7 lbs",
      "$0.86/lb",
      "Shopped",
      "Great Value Milk",
      "$3.99",
      UNIT_RATE,
    ].join("\n");
    const { items } = parseReceiptText(text);
    const banana = items.find((i) => i.rawName === "Organic Bananas");
    expect(banana).toBeDefined();
    expect(banana!.price).toBe(1.47);
  });
});

// ─── Walmart Order Parser ─────────────────────────────────────────────────────

describe("Walmart Order parser (isWalmartOrderFormat)", () => {
  it("is detected when text has items received, Review item, and Add to cart", () => {
    const text = [
      "3 items received",
      "Great Value Whole Milk",
      "$3.99",
      "Review item",
      "Add to cart",
    ].join("\n");
    const { items } = parseReceiptText(text);
    expect(items.length).toBeGreaterThan(0);
  });

  it("parses item name and price from a block ending with Review item", () => {
    const text = [
      "1 items received",
      "Tropicana Pure Premium Orange Juice",
      "$5.48",
      "Review item",
      "Add to cart",
    ].join("\n");
    const { items } = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0].rawName).toBe("Tropicana Pure Premium Orange Juice");
    expect(items[0].price).toBe(5.48);
  });

  it("sets originalPrice from 'Was $X.XX' line", () => {
    const text = [
      "1 items received",
      "Quaker Oats Old Fashioned",
      "$4.48",
      "Was $5.48",
      "Review item",
      "Add to cart",
    ].join("\n");
    const { items } = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0].price).toBe(4.48);
    expect(items[0].originalPrice).toBe(5.48);
  });

  it("parses multiple items each separated by Review item", () => {
    const text = [
      "2 items received",
      "Great Value Whole Milk",
      "$3.99",
      "Review item",
      "Add to cart",
      "Wonder Bread Classic White",
      "$2.48",
      "Review item",
      "Add to cart",
    ].join("\n");
    const { items } = parseReceiptText(text);
    expect(items).toHaveLength(2);
    expect(items[0].rawName).toBe("Great Value Whole Milk");
    expect(items[1].rawName).toBe("Wonder Bread Classic White");
  });
});

// ─── Generic Parser ───────────────────────────────────────────────────────────

// NOTE: cleanItemName() strips a trailing single uppercase letter (the sale
// flag, e.g. "F" or "B"). Item names used here are chosen to avoid ending
// with a single capital letter so the stripped name matches expectations.

describe("Generic receipt parser", () => {
  it("parses 'ITEM NAME    price' with multiple spaces", () => {
    // cleanItemName strips a trailing single uppercase letter (sale flag).
    // "OLIVE OIL 32oz" ends with lowercase, so it is preserved as-is.
    const text = "OLIVE OIL 32oz          3.49";
    const { items } = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0].rawName).toBe("OLIVE OIL 32oz");
    expect(items[0].price).toBe(3.49);
  });

  it("parses 'ITEM $price' with a dollar sign", () => {
    // "BREAD 20oz" ends with lowercase 'z', so cleanItemName won't strip it.
    const text = "BREAD 20oz $1.99";
    const { items } = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0].rawName).toBe("BREAD 20oz");
    expect(items[0].price).toBe(1.99);
  });

  it("skips lines matching SKIP_PATTERNS (Subtotal, Tax, Total, Cash, etc.)", () => {
    const text = [
      "OLIVE OIL 32oz     5.99",
      "SUBTOTAL              5.99",
      "TAX                   0.30",
      "TOTAL                 6.29",
      "CASH                 10.00",
      "CHANGE                3.71",
    ].join("\n");
    const { items } = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0].rawName).toBe("OLIVE OIL 32oz");
  });

  it("sets quantity from '2 x $1.99' multiplier line on the previous item", () => {
    // "YOGURT 32oz" ends with 'z', cleanItemName preserves it.
    const text = ["YOGURT 32oz  1.99", "2 x $1.99"].join("\n");
    const { items } = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it("sets quantity from '2 @ 3.00' multiplier line on the previous item", () => {
    // "ORANGE JUICE 64oz" ends with 'z'.
    const text = ["ORANGE JUICE 64oz  3.00", "2 @ 3.00"].join("\n");
    const { items } = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it("does not produce items with price of zero", () => {
    const text = "FAKE ITEM    0.00";
    const { items } = parseReceiptText(text);
    expect(items).toHaveLength(0);
  });

  it("skips Credit/Debit/Visa/Mastercard lines", () => {
    // "PASTA PESTO 16oz" ends with 'z', preserved intact.
    const text = [
      "PASTA PESTO 16oz  2.99",
      "CREDIT CARD  2.99",
      "VISA              2.99",
    ].join("\n");
    const { items } = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0].rawName).toBe("PASTA PESTO 16oz");
  });
});

// ─── extractDate ──────────────────────────────────────────────────────────────

describe("extractDate", () => {
  it('parses "Month DD, YYYY" format', () => {
    expect(extractDate("May 20, 2026 order")).toBe("2026-05-20");
  });

  it('parses "Month D YYYY" without comma', () => {
    expect(extractDate("Ordered January 5 2026")).toBe("2026-01-05");
  });

  it("parses MM/DD/YYYY slash format", () => {
    expect(extractDate("Date: 05/20/2026")).toBe("2026-05-20");
  });

  it("parses M/D/YY two-digit year (adds 2000)", () => {
    expect(extractDate("Date: 5/3/26")).toBe("2026-05-03");
  });

  it("parses ISO format YYYY-MM-DD", () => {
    expect(extractDate("Order placed on 2026-05-20")).toBe("2026-05-20");
  });

  it("returns undefined when no date is present", () => {
    expect(extractDate("No date here at all")).toBeUndefined();
  });

  it("pads single-digit month and day with leading zeros", () => {
    expect(extractDate("March 7, 2026")).toBe("2026-03-07");
  });

  it("handles abbreviated month names", () => {
    expect(extractDate("Dec 25, 2026")).toBe("2026-12-25");
  });
});

// ─── extractOrderNumber ───────────────────────────────────────────────────────

describe("extractOrderNumber", () => {
  it("extracts Walmart order number from 'Order# XXXXX'", () => {
    expect(extractOrderNumber("Order# 2000147-33985221")).toBe(
      "2000147-33985221"
    );
  });

  it("handles 'Order #' with a space before the hash", () => {
    expect(extractOrderNumber("Order # 2000147-33985221")).toBe(
      "2000147-33985221"
    );
  });

  it("extracts Costco barcode from the line following a 'barcode' header", () => {
    const text = "barcode\n123456789012345678";
    expect(extractOrderNumber(text)).toBe("123456789012345678");
  });

  it("does not match a barcode sequence shorter than 15 digits", () => {
    const text = "barcode\n12345678901";
    expect(extractOrderNumber(text)).toBeUndefined();
  });

  it("returns undefined when no order number is present", () => {
    expect(extractOrderNumber("Nothing to see here")).toBeUndefined();
  });
});

// ─── extractStoreAddress ──────────────────────────────────────────────────────

// NOTE: extractStoreAddress uses `s.replace(/\b\w/g, c => c.toUpperCase())`
// which only uppercases the first character of each word and leaves the rest
// unchanged. All-caps input therefore stays all-caps. Tests reflect actual
// implementation output.

describe("extractStoreAddress", () => {
  it("extracts address fields from a Costco-style header block", () => {
    const text = [
      "Costco Wholesale",
      "FAIRFAX #204",
      "4725 W OX RD",
      "FAIRFAX, VA 22030",
    ].join("\n");
    const addr = extractStoreAddress(text);
    // toTitle on all-caps input keeps trailing chars uppercase
    expect(addr.addressLine1).toBe("4725 W OX RD");
    expect(addr.addressCity).toBe("FAIRFAX");
    expect(addr.addressState).toBe("VA");
    expect(addr.addressZip).toBe("22030");
  });

  it("handles city-state-zip without a comma separator", () => {
    const text = ["123 MAIN ST", "SPRINGFIELD VA 22150"].join("\n");
    const addr = extractStoreAddress(text);
    expect(addr.addressLine1).toBe("123 MAIN ST");
    expect(addr.addressCity).toBe("SPRINGFIELD");
    expect(addr.addressState).toBe("VA");
    expect(addr.addressZip).toBe("22150");
  });

  it("returns an empty object when no address is found", () => {
    const addr = extractStoreAddress("No address here at all.");
    expect(addr).toEqual({});
  });

  it("handles extended ZIP+4 format", () => {
    const text = ["500 ELM AVE", "ARLINGTON, VA 22201-4321"].join("\n");
    const addr = extractStoreAddress(text);
    expect(addr.addressZip).toBe("22201-4321");
  });

  it("correctly extracts state as 2-character abbreviation", () => {
    const text = ["1900 CONSUMER DR", "RICHMOND, VA 23219"].join("\n");
    const addr = extractStoreAddress(text);
    expect(addr.addressState).toBe("VA");
  });
});

// ─── parseReceiptText integration ────────────────────────────────────────────

describe("parseReceiptText (integration)", () => {
  it("returns date, orderNumber, and address alongside items for a Costco receipt", () => {
    const text = [
      "Costco Wholesale",
      "FAIRFAX #204",
      "4725 W OX RD",
      "FAIRFAX, VA 22030",
      "05/20/2026",
      "barcode",
      "123456789012345678",
      "Y\t1234567\tKS OLIVE OIL\t14.99 Y",
      "SUBTOTAL",
    ].join("\n");
    const receipt = parseReceiptText(text);
    expect(receipt.date).toBe("2026-05-20");
    expect(receipt.orderNumber).toBe("123456789012345678");
    expect(receipt.addressLine1).toBe("4725 W OX RD");
    expect(receipt.addressCity).toBe("FAIRFAX");
    expect(receipt.items).toHaveLength(1);
    expect(receipt.items[0].rawName).toBe("Ks Olive Oil");
  });

  it("falls back to generic parser for plain receipt text without format markers", () => {
    // Names end with lowercase to avoid cleanItemName stripping the last letter.
    const text = ["OLIVE OIL 32oz     2.49", "RICE 5lb          3.99"].join("\n");
    const receipt = parseReceiptText(text);
    expect(receipt.items).toHaveLength(2);
    expect(receipt.items[0].rawName).toBe("OLIVE OIL 32oz");
    expect(receipt.items[1].rawName).toBe("RICE 5lb");
  });
});
