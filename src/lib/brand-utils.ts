/**
 * Known store brand prefixes to strip from item names.
 */
const BRAND_PREFIXES = [
  // Walmart
  "great value",
  "marketside",
  "freshness guaranteed",
  "sam's choice",
  "parent's choice",
  "equate",
  "better goods",
  // Costco
  "kirkland signature",
  "kirkland",
  // Lidl
  "simply nature",
  "preferred selection",
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
  // Other common brands (for normalization)
  "del monte",
  "green giant",
  "birds eye",
  "trader joe's",
];

/**
 * Leading qualifiers to strip iteratively from item names.
 */
const LEADING_QUALIFIERS = [
  "fresh",
  "whole",
  "organic",
  "raw",
  "plain",
  "nonfat",
  "non-fat",
  "fat free",
  "fat-free",
  "gluten-free",
  "gluten free",
  "lactose free",
  "lactose-free",
  "reduced fat",
  "reduced-fat",
  "low fat",
  "low-fat",
  "low sodium",
  "ultra filtered",
  "extra light",
  "all natural",
  "natural",
  "bulk",
  "large",
  "grade a",
  "grade-a",
  "white",
  "amber",
  "2%",
  "1%",
];

/**
 * Trailing pack/size descriptor labels to strip from the end.
 */
const TRAILING_LABELS = [
  "family pack",
  "family size",
  "value pack",
  "multipack",
  "sugar substitute",
  "each",
  "bulk",
  "fresh produce",
  "canned fruit",
  "canned vegetable",
];

/**
 * Strips leading store brand prefixes for fuzzy matching purposes.
 * Also strips generic qualifiers like "organic", "fresh", "natural".
 */
export function stripBrandPrefix(name: string): string {
  let result = name.trim();

  const allPrefixes = [...BRAND_PREFIXES, "organic", "fresh", "all natural", "natural"].sort(
    (a, b) => b.length - a.length
  );
  for (const prefix of allPrefixes) {
    const re = new RegExp(`^${escapeRegex(prefix)}\\s+`, "i");
    result = result.replace(re, "");
  }

  // Strip trailing size/unit descriptors
  result = result.replace(/,?\s*\d[\d./\s-]*\s*(fl\s*oz|oz|lb|lbs|ml|l|kg|g|ct|count|pack)\b.*/i, "").trim();

  return result || name;
}

/**
 * Normalizes a raw receipt item name into a clean, human-readable product name.
 *
 * Examples:
 *   "Fresh Whole Red Onion, Each"                                    → "Red Onion"
 *   "Freshness Guaranteed Boneless Skinless Chicken Thighs Family Pack, 4.7 - 6 lb Tray" → "Boneless Skinless Chicken Thighs"
 *   "Great Value Organic Raw Amber Blue Agave Sweetener Sugar Substitute, 23.5 oz Bottle" → "Blue Agave Sweetener Sugar Substitute"
 */
export function normalizeName(raw: string): string {
  let result = raw.trim();

  // Step 1: Strip brand prefix
  const allBrands = [...BRAND_PREFIXES].sort((a, b) => b.length - a.length);
  for (const brand of allBrands) {
    const re = new RegExp(`^${escapeRegex(brand)}\\s+`, "i");
    result = result.replace(re, "");
  }

  // Step 2: Iteratively strip leading qualifiers
  let changed = true;
  while (changed) {
    changed = false;
    const qualifiers = [...LEADING_QUALIFIERS].sort((a, b) => b.length - a.length);
    for (const q of qualifiers) {
      const re = new RegExp(`^${escapeRegex(q)}\\s+`, "i");
      if (re.test(result)) {
        result = result.replace(re, "").trim();
        changed = true;
      }
    }
  }

  // Step 3: Strip trailing size/weight/container descriptors
  // e.g. ", 4.7 - 6 lb Tray", ", 23.5 oz Bottle", "52 fl oz", "32 oz Carton"
  result = result.replace(/,?\s*\d[\d./\s-]*\s*(fl\s*oz|oz|fl oz|lb|lbs|ml|l|kg|g|ct|count|pack)\b[^,]*/gi, "").trim();

  // Step 4: Strip after first comma (removes sub-descriptions like ", Canned Fruit", ", Each", ", Fresh Produce")
  const commaIdx = result.indexOf(",");
  if (commaIdx > 3) result = result.substring(0, commaIdx).trim();

  // Step 5: Strip trailing pack/label descriptors
  changed = true;
  while (changed) {
    changed = false;
    const labels = [...TRAILING_LABELS].sort((a, b) => b.length - a.length);
    for (const label of labels) {
      const re = new RegExp(`\\s+${escapeRegex(label)}$`, "i");
      if (re.test(result)) {
        result = result.replace(re, "").trim();
        changed = true;
      }
    }
  }

  return result.trim() || raw.trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Guesses the category name for an item based on keywords in its name.
 * Returns the category name string (to be looked up by the caller).
 */
export function guessCategory(name: string): string {
  const n = name.toLowerCase();

  const check = (...keywords: string[]) => keywords.some((k) => n.includes(k));

  if (check("chicken", "beef", "pork", "turkey", "salmon", "shrimp", "lamb", "steak",
    "ground beef", "sausage", "bacon", "ham", "brisket", "thigh", "breast",
    "tenderloin", "tuna", "tilapia", "cod", "halibut", "crab", "lobster",
    "scallop", "seafood", "fish fillet", "meatball", "hot dog"))
    return "Meat & Seafood";

  if (check("milk", "egg", "eggs", "yogurt", "butter", "cheese", "cream", "mozzarella",
    "cheddar", "parmesan", "cottage", "kefir", "brie", "feta", "gouda",
    "whipping cream", "sour cream", "cream cheese", "half and half"))
    return "Dairy & Eggs";

  if (check("bread", "naan", "roll", "bagel", "muffin", "croissant", "baguette",
    "tortilla", "pita", "bun", "loaf", "cake", "pie", "donut", "danish", "brioche"))
    return "Bakery";

  if (check("frozen", "ice cream", "pizza") && n.includes("frozen"))
    return "Frozen";

  if (check("chip", "cracker", "popcorn", "cookie", "granola bar", "trail mix",
    "jerky", "candy", "chocolate", "pretzel", "gummy", "snack"))
    return "Snacks";

  if (check("juice", "soda", "sparkling water", "energy drink", "coffee", "tea",
    "lemonade", "kombucha", "smoothie", "sports drink", "coconut water"))
    return "Beverages";

  if (check("detergent", "dish soap", "laundry", "paper towel", "toilet paper",
    "trash bag", "aluminum foil", "plastic wrap", "sponge", "wipe", "bleach",
    "cleaning", "cleaner", "dryer sheet", "fabric softener"))
    return "Household";

  if (check("shampoo", "conditioner", "toothpaste", "deodorant", "lotion", "razor",
    "vitamin", "supplement", "sunscreen", "bandage", "medicine", "body wash",
    "face wash", "moisturizer", "lip balm"))
    return "Personal Care";

  if (check("sauce", "broth", "stock", "olive oil", "vegetable oil", "canola oil",
    "vinegar", "flour", "sugar", "pasta", "rice", "bean", "lentil",
    "cereal", "oat", "oatmeal", "syrup", "honey", "jam", "jelly",
    "mustard", "ketchup", "mayo", "mayonnaise", "dressing", "coconut milk",
    "agave", "tomato sauce", "salsa", "soy sauce", "hot sauce", "seasoning",
    "spice", "salt", "pepper", "cinnamon", "cumin", "paprika", "oregano",
    "noodle", "quinoa", "couscous", "hummus", "peanut butter", "almond butter",
    "canned", "soup", "chili", "baking"))
    return "Pantry";

  if (check("onion", "tomato", "banana", "lemon", "lime", "ginger", "cilantro",
    "cucumber", "peach", "mango", "apple", "orange", "garlic", "potato",
    "carrot", "broccoli", "spinach", "lettuce", "avocado", "bell pepper",
    "mushroom", "pear", "plum", "grape", "strawberry", "blueberry", "berry",
    "melon", "watermelon", "cantaloupe", "squash", "zucchini", "kale",
    "celery", "corn", "arugula", "basil", "mint", "parsley", "dill",
    "thyme", "rosemary", "herb", "radish", "beet", "cabbage", "chard",
    "leek", "scallion", "shallot", "eggplant", "artichoke", "asparagus",
    "fennel", "turnip", "yam", "sweet potato"))
    return "Produce";

  return "Other";
}


/**
 * Extracts the store brand label from a raw item name if it starts with a known prefix.
 * Returns null if no known brand prefix found.
 *
 * e.g. "Great Value Coconut Milk" → "Great Value"
 *      "Kirkland Signature Chicken Broth" → "Kirkland Signature"
 */
export function extractBrand(name: string): string | null {
  const sorted = [...BRAND_PREFIXES].sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    const re = new RegExp(`^(${escapeRegex(prefix)})\\s+`, "i");
    const m = name.match(re);
    if (m) return m[1];
  }
  return null;
}
