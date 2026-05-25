"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PriceHistoryDialog } from "@/components/items/price-history-dialog";

type Store = { id: number; name: string };
type Category = { id: number; name: string; _count: { items: number } };

type ItemData = {
  id: number;
  name: string;
  unit: string | null;
  category: { id: number; name: string };
  storePrices: Array<{
    id: number;
    price: number;
    storeId: number;
    brand: string | null;
    date: Date;
    store: Store;
  }>;
  cheapestStoreId: number | null;
};

export function CompareTable({
  data,
  stores,
  categories,
}: {
  data: ItemData[];
  stores: Store[];
  categories: Category[];
}) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<number | null>(null);
  const [historyItem, setHistoryItem] = useState<{ id: number; name: string } | null>(null);

  const filtered = data.filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.storePrices.some((p) => p.brand?.toLowerCase().includes(q));
    const matchesCat = !filterCat || item.category.id === filterCat;
    return matchesSearch && matchesCat;
  });

  // Stores that appear in at least one price entry
  const activeStoreIds = new Set(
    data.flatMap((item) => item.storePrices.map((p) => p.storeId))
  );
  const activeStores = stores.filter((s) => activeStoreIds.has(s.id));

  if (data.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">
            No price data yet. Import receipts or add prices to items to see comparisons.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-col sm:flex-row">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border rounded-md px-3 py-2 text-sm bg-background"
          value={filterCat ?? ""}
          onChange={(e) => setFilterCat(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-max">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left py-3 px-4 font-medium sticky left-0 bg-muted/50 min-w-[180px]">
                Item
              </th>
              {activeStores.map((store) => (
                <th key={store.id} className="text-center py-3 px-4 font-medium whitespace-nowrap min-w-[110px]">
                  {store.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const priceMap = new Map(
                item.storePrices.map((p) => [p.storeId, p])
              );
              const prices = item.storePrices.map((p) => p.price);
              const minPrice = prices.length ? Math.min(...prices) : null;
              const maxPrice = prices.length ? Math.max(...prices) : null;

              return (
                <tr key={item.id} className="border-t hover:bg-muted/20">
                  <td className="py-2.5 px-4 sticky left-0 bg-background">
                    <button
                      className="font-medium text-left hover:text-primary hover:underline transition-colors"
                      onClick={() => setHistoryItem({ id: item.id, name: item.name })}
                    >
                      {item.name}
                    </button>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <Badge variant="outline" className="text-xs">{item.category.name}</Badge>
                      {item.unit && (
                        <span className="text-xs text-muted-foreground">/ {item.unit}</span>
                      )}
                    </div>
                  </td>
                  {activeStores.map((store) => {
                    const p = priceMap.get(store.id);
                    const isCheapest = minPrice !== null && p?.price === minPrice && prices.length > 1;
                    const isMostExpensive = maxPrice !== null && p?.price === maxPrice && prices.length > 1;
                    return (
                      <td
                        key={store.id}
                        className={cn(
                          "py-2.5 px-4 text-center",
                          isCheapest && "bg-green-50 dark:bg-green-950/30",
                          isMostExpensive && !isCheapest && "bg-red-50/50 dark:bg-red-950/20"
                        )}
                      >
                        {p ? (
                          <div>
                            <span
                              className={cn(
                                "font-semibold",
                                isCheapest && "text-green-700 dark:text-green-400",
                                isMostExpensive && !isCheapest && "text-red-600 dark:text-red-400"
                              )}
                            >
                              ${p.price.toFixed(2)}
                            </span>
                            {p.brand && (
                              <div className="text-xs text-muted-foreground mt-0.5 italic">{p.brand}</div>
                            )}
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {new Date(p.date).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}
                            </div>
                            {isCheapest && prices.length > 1 && (
                              <div className="text-xs text-green-600 font-medium">Best price</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {data.length} items.{" "}
        <span className="text-green-600 font-medium">Green</span> = best price.{" "}
        Prices shown are the most recent recorded price at each store.{" "}
        Click any item name to view price history.
      </p>

      <PriceHistoryDialog
        itemId={historyItem?.id ?? null}
        itemName={historyItem?.name ?? ""}
        open={historyItem !== null}
        onClose={() => setHistoryItem(null)}
      />
    </div>
  );
}
