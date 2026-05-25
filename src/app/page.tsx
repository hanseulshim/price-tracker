import { db } from "@/lib/db";
import { getComparisonData } from "@/actions/prices";
import { ShoppingCart, Store, Tag, Receipt, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Track prices across your favorite stores</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={Store} label="Stores" value={storeCount} href="/stores" />
        <StatCard icon={Tag} label="Items" value={itemCount} href="/items" />
        <StatCard icon={Receipt} label="Receipts" value={receiptCount} href="/receipts" />
        <StatCard icon={ShoppingCart} label="Price Entries" value={comparisonData.reduce((sum, i) => sum + i.storePrices.length, 0)} href="/compare" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-green-600" />
              Price Comparisons
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bestDeals.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Import receipts or add prices to see comparisons.{" "}
                <Link href="/receipts" className="text-primary underline">Import receipt</Link>
              </p>
            ) : (
              <div className="space-y-2">
                {bestDeals.map((item) => {
                  const sorted = [...item.storePrices].sort((a, b) => a.price - b.price);
                  const cheapest = sorted[0];
                  const priceDiff = sorted.length > 1 ? sorted[sorted.length - 1].price - sorted[0].price : 0;
                  return (
                    <div key={item.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <div>
                        <span className="text-sm font-medium">{item.name}</span>
                        {cheapest.brand && <span className="text-xs text-muted-foreground ml-1 italic">{cheapest.brand}</span>}
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="text-sm font-semibold text-green-600">
                          ${cheapest.price.toFixed(2)}{" "}
                          <span className="text-xs font-normal text-muted-foreground">@ {cheapest.store.name}</span>
                        </div>
                        {priceDiff > 0.01 && (
                          <div className="text-xs text-muted-foreground">save ${priceDiff.toFixed(2)} vs highest</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {bestDeals.length > 0 && (
              <Link href="/compare" className="text-sm text-primary hover:underline mt-3 block">View full comparison →</Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4" />
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
              <div className="space-y-2">
                {recentReceipts.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
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
              <Link href="/receipts" className="text-sm text-primary hover:underline mt-3 block">View all receipts →</Link>
            )}
          </CardContent>
        </Card>
      </div>

      {storeCount === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">Get started</h3>
            <p className="text-sm text-muted-foreground mb-4">Add your first store to start tracking prices.</p>
            <Link href="/stores" className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90">
              Add a store
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, href }: { icon: React.ElementType; label: string; value: number; href: string }) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-md">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
