"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingDown, TrendingUp, Minus, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { getPricesForItem, addPrice } from "@/actions/prices";
import { getStores } from "@/actions/stores";
import { cn } from "@/lib/utils";

type Price = Awaited<ReturnType<typeof getPricesForItem>>[number];
type Store = Awaited<ReturnType<typeof getStores>>[number];

const STORE_COLORS = [
  "#818cf8", // indigo
  "#34d399", // emerald
  "#f59e0b", // amber
  "#a78bfa", // violet
  "#f87171", // red
  "#22d3ee", // cyan
  "#f472b6", // pink
];

function PriceTrend({ prices, storeId }: { prices: Price[]; storeId: number }) {
  const storePrices = prices
    .filter((p) => p.storeId === storeId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (storePrices.length < 2) return null;
  const diff = storePrices[0].price - storePrices[1].price;
  if (Math.abs(diff) < 0.01) return <Minus className="h-3 w-3 text-muted-foreground inline ml-1" />;
  if (diff > 0)
    return (
      <span className="text-red-500 text-xs ml-1 inline-flex items-center gap-0.5">
        <TrendingUp className="h-3 w-3" />+${diff.toFixed(2)}
      </span>
    );
  return (
    <span className="text-green-500 text-xs ml-1 inline-flex items-center gap-0.5">
      <TrendingDown className="h-3 w-3" />${diff.toFixed(2)}
    </span>
  );
}

export function PriceHistoryDialog({
  itemId,
  itemName,
  open,
  onClose,
}: {
  itemId: number | null;
  itemName: string;
  open: boolean;
  onClose: () => void;
}) {
  const [prices, setPrices] = useState<Price[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Add price form state
  const [addOpen, setAddOpen] = useState(false);
  const [addStoreId, setAddStoreId] = useState(0);
  const [addPrice_, setAddPrice_] = useState("");
  const [addDate, setAddDate] = useState(new Date().toISOString().split("T")[0]);
  const [addNotes, setAddNotes] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!itemId || !open) return;
    setLoading(true);
    setError(false);
    Promise.all([getPricesForItem(itemId), getStores()]).then(([priceData, storeData]) => {
      setPrices(priceData);
      setStores(storeData);
      if (storeData.length > 0) setAddStoreId(storeData[0].id);
    }).catch(() => {
      setError(true);
    }).finally(() => {
      setLoading(false);
    });
  }, [itemId, open]);

  async function handleAddPrice() {
    if (!itemId || !addStoreId || !addPrice_) return;
    const price = parseFloat(addPrice_);
    if (isNaN(price) || price <= 0) { toast.error("Enter a valid price"); return; }
    setAdding(true);
    try {
      const [y, m, d] = addDate.split("-").map(Number);
      await addPrice({
        itemId,
        storeId: addStoreId,
        price,
        date: new Date(y, m - 1, d, 12, 0, 0),
        notes: addNotes.trim() || undefined,
      });
      const updated = await getPricesForItem(itemId);
      setPrices(updated);
      setAddPrice_("");
      setAddNotes("");
      setAddDate(new Date().toISOString().split("T")[0]);
      setAddOpen(false);
      toast.success("Price added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add price");
    } finally {
      setAdding(false);
    }
  }

  // Unique stores that have prices (for chart/badges)
  const priceStores = Array.from(
    new Map(prices.map((p) => [p.storeId, p.store.name])).entries()
  ).map(([id, name]) => ({ id, name }));

  // Build chart data: [{ date, Walmart: 1.99, Costco: 1.49 }, ...]
  const dateEntries = new Map<string, Record<string, number | string>>();
  for (const p of [...prices].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )) {
    const dateKey = new Date(p.date).toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
    if (!dateEntries.has(dateKey)) dateEntries.set(dateKey, { date: dateKey });
    dateEntries.get(dateKey)![p.store.name] = p.price;
  }
  const chartData = Array.from(dateEntries.values());

  const sorted = [...prices].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-base">
              {itemName}
              <span className="font-normal text-muted-foreground ml-2">— Price History</span>
            </DialogTitle>
            {stores.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setAddOpen((v) => !v)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Price
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Inline add-price form */}
        {addOpen && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Price Entry</p>
            <div className="space-y-2">
              <Label className="text-xs">Store</Label>
              <div className="flex flex-wrap gap-2">
                {stores.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setAddStoreId(s.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors",
                      addStoreId === s.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    )}
                  >
                    {addStoreId === s.id && <Check className="h-3.5 w-3.5" />}
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={addPrice_}
                  onChange={(e) => setAddPrice_(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input
                placeholder="e.g. on sale, bulk pack"
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAddPrice} disabled={adding || !addPrice_ || !addStoreId}>
                {adding ? "Saving..." : "Save Price"}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground py-8 text-center text-sm">Loading…</p>
        ) : error ? (
          <p className="text-destructive py-8 text-center text-sm">Failed to load price history.</p>
        ) : prices.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No price history yet. Import a receipt or add a price manually.
          </p>
        ) : (
          <div className="space-y-5">
            {/* Store summary badges */}
            <div className="flex flex-wrap gap-2">
              {priceStores.map((store, i) => {
                const latest = prices
                  .filter((p) => p.storeId === store.id)
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                return (
                  <div
                    key={store.id}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium text-white"
                    style={{ backgroundColor: STORE_COLORS[i % STORE_COLORS.length] }}
                  >
                    <span>{store.name}</span>
                    <span className="opacity-90">${latest.price.toFixed(2)}</span>
                    <PriceTrend prices={prices} storeId={store.id} />
                  </div>
                );
              })}
            </div>

            {/* Line chart */}
            {chartData.length > 0 && (
              <div className="bg-card border rounded-lg p-4">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => `$${v}`}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={45}
                    />
                    <Tooltip
                      formatter={(value) => `$${Number(value).toFixed(2)}`}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid hsl(var(--border))",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    {priceStores.map((store, i) => (
                      <Line
                        key={store.id}
                        type="monotone"
                        dataKey={store.name}
                        stroke={STORE_COLORS[i % STORE_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4, strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                        connectNulls={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* History table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="py-2 px-3 font-medium text-xs text-muted-foreground">Date</th>
                    <th className="py-2 px-3 font-medium text-xs text-muted-foreground">Store</th>
                    <th className="py-2 px-3 font-medium text-xs text-muted-foreground">Brand</th>
                    <th className="py-2 px-3 font-medium text-xs text-muted-foreground text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => (
                    <tr key={p.id} className="border-t last:border-0">
                      <td className="py-2 px-3 text-muted-foreground">
                        {new Date(p.date).toLocaleDateString("en-US", {
                          timeZone: "UTC",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-2 px-3 font-medium">{p.store.name}</td>
                      <td className="py-2 px-3 text-muted-foreground italic text-xs">
                        {p.brand ?? "—"}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="font-semibold text-foreground">
                          ${p.price.toFixed(2)}
                        </span>
                        {p.originalPrice && (
                          <div className="text-xs text-muted-foreground line-through">${p.originalPrice.toFixed(2)}</div>
                        )}
                        {p.originalPrice && (
                          <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">Sale −${(p.originalPrice - p.price).toFixed(2)}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
