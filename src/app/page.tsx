import { db } from "@/lib/db";
import { getComparisonData } from "@/actions/prices";
import { ShoppingCart, Store, Tag, Receipt, TrendingDown, BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [storeCount, itemCount, receiptCount, comparisonData] =
    await Promise.all([
      db.store.count(),
      db.item.count(),
      db.receipt.count(),
      getComparisonData(),
    ]);

  const bestDeals = comparisonData
    .filter((item) => item.storePrices.length >= 2)
    .slice(0, 10);

  const recentReceipts = await db.receipt.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { store: true, _count: { select: { items: true } } },
  });

  const priceEntryCount = comparisonData.reduce((sum, i) => sum + i.storePrices.length, 0);

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-6 shadow-md">
        <div className="flex items-center gap-3 mb-1">
          <ShoppingCart className="h-6 w-6 text-emerald-200" />
          <h1 className="text-2xl font-bold tracking-tight">Price Tracker</h1>
        </div>
        <p className="text-emerald-100 text-sm">
          Track and compare grocery prices across your favorite stores
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Store} label="Stores" value={storeCount} href="/stores"
          color="bg-blue-500" colorLight="bg-blue-50 dark:bg-blue-950/40" textColor="text-blue-600 dark:text-blue-400" />
        <StatCard icon={Tag} label="Items" value={itemCount} href="/items"
          color="bg-emerald-500" colorLight="bg-emerald-50 dark:bg-emerald-950/40" textColor="text-emerald-600 dark:text-emerald-400" />
        <StatCard icon={Receipt} label="Receipts" value={receiptCount} href="/receipts"
          color="bg-amber-500" colorLight="bg-amber-50 dark:bg-amber-950/40" textColor="text-amber-600 dark:text-amber-400" />
        <StatCard icon={BarChart2} label="Price Entries" value={priceEntryCount} href="/compare"
          color="bg-violet-500" colorLight="bg-violet-50 dark:bg-violet-950/40" textColor="text-violet-600 dark:text-violet-400" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50">
                <TrendingDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Best Price Deals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bestDeals.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Import receipts or add prices to see comparisons.{" "}
                <Link href="/receipts" className="text-primary underline">Import receipt</Link>
              </p>
            ) : (
              <div className="space-y-1">
                {bestDeals.map((item) => {
                  const sorted = [...item.storePrices].sort((a, b) => a.price - b.price);
                  const cheapest = sorted[0];
                  const priceDiff = sorted.length > 1 ? sorted[sorted.length - 1].price - sorted[0].price : 0;
                  return (
                    <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <span className="text-sm font-medium">{item.name}</span>
                        {cheapest.brand && <span className="text-xs text-muted-foreground ml-1.5 italic">{cheapest.brand}</span>}
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          ${cheapest.price.toFixed(2)}{" "}
                          <span className="text-xs font-normal text-muted-foreground">@ {cheapest.store.name}</span>
                        </div>
                        {priceDiff > 0.01 && (
                          <div className="text-xs text-muted-foreground">save ${priceDiff.toFixed(2)}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {bestDeals.length > 0 && (
              <Link href="/compare" className="text-sm text-primary hover:underline mt-3 block font-medium">View full comparison →</Link>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-900/50">
                <Receipt className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              Recent Receipts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentReceipts.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No receipts yet.{" "}
                <Link href="/receipts" className="text-primary underline">Import your first receipt</Link>
              </p>
            ) : (
              <div className="space-y-1">
                {recentReceipts.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <span className="text-sm font-medium">{r.store.name}</span>
                      <div className="text-xs text-muted-foreground">{new Date(r.date).toLocaleDateString()}</div>
                    </div>
                    <Badge variant="secondary" className="text-xs">{r._count.items} items</Badge>
                  </div>
                ))}
              </div>
            )}
            {recentReceipts.length > 0 && (
              <Link href="/receipts" className="text-sm text-primary hover:underline mt-3 block font-medium">View all receipts →</Link>
            )}
          </CardContent>
        </Card>
      </div>

      {storeCount === 0 && (
        <Card className="border-dashed border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="py-8 text-center">
            <div className="h-14 w-14 mx-auto mb-3 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <ShoppingCart className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="font-semibold mb-1">Get started</h3>
            <p className="text-sm text-muted-foreground mb-4">Add your first store to start tracking prices.</p>
            <Link href="/stores" className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors">
              Add a store
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, href, color, colorLight, textColor,
}: {
  icon: React.ElementType; label: string; value: number; href: string;
  color: string; colorLight: string; textColor: string;
}) {
  return (
    <Link href={href}>
      <Card className={cn("hover:shadow-md transition-shadow cursor-pointer border-0 shadow-sm", colorLight)}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-lg text-white shadow-sm", color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <div className={cn("text-2xl font-bold", textColor)}>{value}</div>
              <div className="text-xs text-muted-foreground font-medium">{label}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
