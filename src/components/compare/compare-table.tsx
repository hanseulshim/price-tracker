"use client";

import { useState, useMemo } from "react";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Layers, TrendingUp, TrendingDown, Minus, Download } from "lucide-react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PriceHistoryDialog } from "@/components/items/price-history-dialog";

type Store = { id: number; name: string };
type Category = { id: number; name: string; _count: { items: number } };

type ItemData = {
  id: number;
  name: string;
  unit: string | null;
  size: number | null;
  imageUrl: string | null;
  category: { id: number; name: string };
  storePrices: Array<{
    id: number;
    price: number;
    originalPrice: number | null;
    prevPrice: number | null;
    storeId: number;
    brand: string | null;
    date: Date;
    store: Store;
  }>;
  cheapestStoreId: number | null;
};

type SortKey = "name" | "savings" | `store-${number}`;
type SortDir = "asc" | "desc";

function SortButton({
  label, sortKey, current, dir, onSort,
}: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors w-full justify-center"
      onClick={() => onSort(sortKey)}
    >
      {label}
      {active ? (
        dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

function TrendIcon({ price, prevPrice }: { price: number; prevPrice: number | null }) {
  if (!prevPrice || price === prevPrice) return <Minus className="h-3 w-3 text-muted-foreground inline" />;
  if (price < prevPrice) return (
    <span title={`Was $${prevPrice.toFixed(2)}`}>
      <TrendingDown className="h-3 w-3 text-green-600 inline" />
    </span>
  );
  return (
    <span title={`Was $${prevPrice.toFixed(2)}`}>
      <TrendingUp className="h-3 w-3 text-red-500 inline" />
    </span>
  );
}

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
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [groupByCategory, setGroupByCategory] = useState(false);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const activeStoreIds = new Set(
    data.flatMap((item) => item.storePrices.map((p) => p.storeId))
  );
  const activeStores = stores.filter((s) => activeStoreIds.has(s.id));

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = data.filter((item) => {
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.storePrices.some((p) => p.brand?.toLowerCase().includes(q));
      const matchesCat = !filterCat || item.category.id === filterCat;
      return matchesSearch && matchesCat;
    });

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortKey === "savings") {
        const savingsA = (() => {
          const prices = a.storePrices.map((p) => p.price);
          return prices.length >= 2 ? Math.max(...prices) - Math.min(...prices) : 0;
        })();
        const savingsB = (() => {
          const prices = b.storePrices.map((p) => p.price);
          return prices.length >= 2 ? Math.max(...prices) - Math.min(...prices) : 0;
        })();
        cmp = savingsB - savingsA;
      } else if (sortKey.startsWith("store-")) {
        const storeId = Number(sortKey.split("-")[1]);
        const priceA = a.storePrices.find((p) => p.storeId === storeId)?.price ?? Infinity;
        const priceB = b.storePrices.find((p) => p.storeId === storeId)?.price ?? Infinity;
        cmp = priceA - priceB;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [data, search, filterCat, sortKey, sortDir]);

  function exportCSV(filteredItems: ItemData[], exportStores: Store[]) {
    const activeExportStores = exportStores.filter(s => filteredItems.some(i => i.storePrices.some(p => p.storeId === s.id)));
    const header = ["Item", "Category", "Unit", "Size", ...activeExportStores.map(s => s.name), "Best Price Store"].join(",");
    const rows = filteredItems.map(item => {
      const priceMap = new Map(item.storePrices.map(p => [p.storeId, p.price]));
      const cheapest = item.storePrices.reduce<typeof item.storePrices[0] | null>((min, p) => !min || p.price < min.price ? p : min, null);
      return [
        `"${item.name.replace(/"/g, '""')}"`,
        `"${item.category.name}"`,
        item.unit ?? "",
        item.size ?? "",
        ...activeExportStores.map(s => priceMap.get(s.id)?.toFixed(2) ?? ""),
        cheapest ? `"${cheapest.store.name}"` : "",
      ].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "price-comparison.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

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

  const storesWithData = stores.filter((s) =>
    data.some((row) => row.prices.some((p) => p.storeId === s.id))
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <div className="relative sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="border rounded-md px-3 py-2 text-sm bg-background text-foreground"
            value={filterCat ?? ""}
            onChange={(e) => setFilterCat(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm font-medium transition-colors",
              groupByCategory
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground hover:bg-muted"
            )}
            onClick={() => setGroupByCategory((v) => !v)}
          >
            <Layers className="h-4 w-4" />
            Group by Category
          </button>
          <Button variant="outline" size="sm" onClick={() => exportCSV(filtered, activeStores)}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm min-w-max">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left py-4 px-4 font-medium sticky left-0 bg-muted/50 min-w-[200px]">
                <button
                  className={cn("hover:text-foreground transition-colors flex items-center gap-1", sortKey === "name" ? "text-foreground" : "text-muted-foreground")}
                  onClick={() => handleSort("name")}
                >
                  Item {sortKey === "name" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3 inline" /> : <ArrowDown className="h-3 w-3 inline" />) : <ArrowUpDown className="h-3 w-3 inline opacity-40" />}
                </button>
              </th>
              {activeStores.map((store) => (
                <th key={store.id} className="text-center py-4 px-4 font-medium whitespace-nowrap min-w-[120px]">
                  <SortButton
                    label={store.name}
                    sortKey={`store-${store.id}`}
                    current={sortKey}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                </th>
              ))}
              <th className="text-center py-4 px-4 font-medium whitespace-nowrap min-w-[90px]">
                <SortButton
                  label="Savings"
                  sortKey="savings"
                  current={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const colSpan = activeStores.length + 2;

              function renderItemRow(item: ItemData) {
                const priceMap = new Map(item.storePrices.map((p) => [p.storeId, p]));
                const prices = item.storePrices.map((p) => p.price);
                const minPrice = prices.length ? Math.min(...prices) : null;
                const maxPrice = prices.length ? Math.max(...prices) : null;
                return (
                  <tr key={item.id} className="border-t hover:bg-muted/20">
                    <td className="py-3.5 px-4 sticky left-0 bg-background">
                      <div className="flex items-start gap-2">
                        {item.imageUrl && (
                          <Image
                            src={item.imageUrl}
                            alt={item.name}
                            width={36}
                            height={36}
                            className="rounded object-contain flex-shrink-0 mt-0.5"
                            unoptimized
                          />
                        )}
                        <div>
                          <button
                            className="font-medium text-left hover:text-primary hover:underline transition-colors"
                            onClick={() => setHistoryItem({ id: item.id, name: item.name })}
                          >
                            {item.name}
                          </button>
                          {!groupByCategory && (
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <Badge variant="outline" className="text-xs">{item.category.name}</Badge>
                              {item.unit && <span className="text-xs text-muted-foreground">{item.size ? `${item.size} ${item.unit}` : item.unit}</span>}
                            </div>
                          )}
                          {groupByCategory && item.unit && (
                            <div className="text-xs text-muted-foreground mt-0.5">{item.size ? `${item.size} ${item.unit}` : item.unit}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    {activeStores.map((store) => {
                      const p = priceMap.get(store.id);
                      const isCheapest = minPrice !== null && p?.price === minPrice && prices.length > 1;
                      const isMostExpensive = maxPrice !== null && p?.price === maxPrice && prices.length > 1;
                      const unitPrice = p && item.size ? p.price / item.size : null;
                      return (
                        <td
                          key={store.id}
                          className={cn(
                            "py-3.5 px-4 text-center",
                            isCheapest && "bg-green-50 dark:bg-green-950/30",
                            isMostExpensive && !isCheapest && "bg-red-50/50 dark:bg-red-950/20"
                          )}
                        >
                          {p ? (
                            <div>
                              <div className="flex items-center justify-center gap-1">
                                <span className={cn("font-semibold", isCheapest && "text-green-700 dark:text-green-400", isMostExpensive && !isCheapest && "text-red-600 dark:text-red-400")}>
                                  ${p.price.toFixed(2)}
                                </span>
                                {p.originalPrice && (
                                  <span className="text-xs text-muted-foreground line-through">${p.originalPrice.toFixed(2)}</span>
                                )}
                                <TrendIcon price={p.price} prevPrice={p.prevPrice} />
                              </div>
                              {unitPrice !== null && (
                                <div className="text-xs text-muted-foreground">
                                  ${unitPrice.toFixed(2)}/{item.unit}
                                </div>
                              )}
                              {p.brand && <div className="text-xs text-muted-foreground mt-0.5 italic">{p.brand}</div>}
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {new Date(p.date).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}
                              </div>
                              {p.originalPrice && (
                                <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                                  Sale −${(p.originalPrice - p.price).toFixed(2)}
                                </div>
                              )}
                              {isCheapest && prices.length > 1 && <div className="text-xs text-green-600 font-medium">Best price</div>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-3.5 px-4 text-center">
                      {prices.length >= 2 ? (
                        <span className="text-primary font-medium text-sm">
                          ${(Math.max(...prices) - Math.min(...prices)).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              }

              if (!groupByCategory) {
                return filtered.map(renderItemRow);
              }

              const groups = new Map<string, { catName: string; items: ItemData[] }>();
              for (const item of filtered) {
                const key = item.category.name;
                if (!groups.has(key)) groups.set(key, { catName: key, items: [] });
                groups.get(key)!.items.push(item);
              }
              const sortedGroups = Array.from(groups.values()).sort((a, b) =>
                a.catName.localeCompare(b.catName)
              );

              return sortedGroups.flatMap(({ catName, items }) => [
                <tr key={`cat-${catName}`} className="border-t">
                  <td
                    colSpan={colSpan}
                    className="py-2 px-4 bg-muted/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground sticky left-0"
                  >
                    {catName} <span className="font-normal normal-case">({items.length})</span>
                  </td>
                </tr>,
                ...items.map(renderItemRow),
              ]);
            })()}
          </tbody>
        </table>
      </div>

      {storesWithData.length < 2 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Add prices from a second store to see savings comparisons.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {data.length} items.{" "}
        <span className="text-green-600 font-medium">Green</span> = best price.{" "}
        <TrendingDown className="h-3 w-3 text-green-600 inline" /> price went down,{" "}
        <TrendingUp className="h-3 w-3 text-red-500 inline" /> price went up vs. last time.{" "}
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
