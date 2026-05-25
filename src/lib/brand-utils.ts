/**
 * Store brand prefixes to strip before fuzzy-matching item names.
 * e.g. "Great Value Coconut Milk" → "Coconut Milk"
 *      "Kirkland Signature Chicken Broth" → "Chicken Broth"
 */
const STORE_BRAND_PREFIXES = [
  // Walmart
  "great value",
  "marketside",
  "freshness guaranteed",
  "sam's choice",
  "parent's choice",
  "equate",
  "george",
  "mainstays",
  "better goods",
  // Costco
  "kirkland signature",
  "kirkland",
  // Lidl
  "simply nature",
  "preferred selection",
  "trader joe's", // not Lidl but common
  // Aldi
  "specially selected",
  "fit & active",
  "season's choice",
  // Target
  "good & gather",
  "market pantry",
  "favorite day",
  // Whole Foods
  "365 by whole foods market",
  "365",
  // Generic qualifiers
  "organic",
  "fresh",
  "all natural",
  "natural",
];

/**
 * Strips leading store brand prefixes and common qualifiers from an item name
 * to improve fuzzy matching across stores.
 *
 * e.g. "Great Value Organic Coconut Milk, 13.5 fl oz, Can" → "Coconut Milk"
 */
export function stripBrandPrefix(name: string): string {
  let result = name.trim();

  // Strip brand prefixes (longest first to avoid partial matches)
  const sorted = [...STORE_BRAND_PREFIXES].sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    const re = new RegExp(`^${prefix}\\s+`, "i");
    result = result.replace(re, "");
  }

  // Strip trailing size/unit descriptors like ", 13.5 fl oz, Can" or "32 oz Carton"
  result = result.replace(/,?\s*\d[\d./]*\s*(fl\s*oz|oz|lb|lbs|ml|l|kg|g|ct|count|pack)\b.*/i, "").trim();

  return result || name; // fallback to original if we stripped too much
}
