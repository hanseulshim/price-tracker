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
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { getPricesForItem } from "@/actions/prices";

type Price = Awaited<ReturnType<typeof getPricesForItem>>[number];

const STORE_COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ef4444", // red
  "#06b6d4", // cyan
  "#ec4899", // pink
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
    <span className="text-emerald-600 text-xs ml-1 inline-flex items-center gap-0.5">
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!itemId || !open) return;
    setLoading(true);
    getPricesForItem(itemId).then((data) => {
      setPrices(data);
      setLoading(false);
    });
  }, [itemId, open]);

  // Unique stores that have prices
  const stores = Array.from(
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
          <DialogTitle className="text-base">
            {itemName}
            <span className="font-normal text-muted-foreground ml-2">— Price History</span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-muted-foreground py-8 text-center text-sm">Loading…</p>
        ) : prices.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No price history yet. Import a receipt to start tracking.
          </p>
        ) : (
          <div className="space-y-5">
            {/* Store summary badges */}
            <div className="flex flex-wrap gap-2">
              {stores.map((store, i) => {
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
                    {stores.map((store, i) => (
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
                        <span className="font-semibold text-emerald-700">
                          ${p.price.toFixed(2)}
                        </span>
                        {p.originalPrice && (
                          <div className="text-xs text-muted-foreground line-through">${p.originalPrice.toFixed(2)}</div>
                        )}
                        {p.originalPrice && (
                          <div className="text-xs text-orange-600 font-medium">Sale −${(p.originalPrice - p.price).toFixed(2)}</div>
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
