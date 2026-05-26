"use server";

export interface CostcoItemInfo {
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  currentPrice?: number;
  description?: string;
  itemNumber: string;
}

/**
 * Looks up a Costco item by item number using WarehouseRunner.
 * Parses the JSON-LD Product schema from the page <head>.
 */
export async function lookupCostcoItem(itemNumber: string): Promise<CostcoItemInfo | null> {
  try {
    const res = await fetch(`https://app.warehouserunner.com/costco/${itemNumber}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PriceTracker/1.0)" },
      next: { revalidate: 86400 }, // cache 24h
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Extract the Product JSON-LD from the <head>
    const ldMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    for (const match of ldMatches) {
      try {
        const json = JSON.parse(match[1]);
        if (json["@type"] === "Product") {
          return {
            itemNumber,
            name: json.name ?? "",
            brand: json.brand?.name,
            category: json.category,
            imageUrl: Array.isArray(json.image) ? json.image[0] : json.image,
            currentPrice: json.offers?.lowPrice ?? json.offers?.price,
            description: typeof json.description === "string"
              ? json.description.slice(0, 300)
              : undefined,
          };
        }
      } catch {
        // skip malformed JSON-LD blocks
      }
    }
    return null;
  } catch {
    return null;
  }
}
