import Link from "next/link";
import { getComparisonData } from "@/actions/prices";
import { getStores } from "@/actions/stores";
import { getCategories } from "@/actions/categories";
import { CompareTable } from "@/components/compare/compare-table";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [data, stores, categories] = await Promise.all([
    getComparisonData(),
    getStores(),
    getCategories(),
  ]);

  const needsSetup = stores.length === 0 || categories.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Price Comparison</h1>
        <p className="text-muted-foreground mt-1">
          Compare prices across stores — cheapest highlighted in green
        </p>
      </div>

      {needsSetup && (
        <Card className="border-amber-400 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-5 px-6">
            <p className="font-semibold text-amber-900 dark:text-amber-200 mb-3">
              👋 Get started — complete these steps first
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-3">
                {stores.length > 0 ? (
                  <span className="text-green-600 font-bold text-base">✓</span>
                ) : (
                  <span className="text-muted-foreground text-base">○</span>
                )}
                <span className={stores.length > 0 ? "text-muted-foreground line-through" : "text-foreground"}>
                  Add at least one store
                </span>
                {stores.length === 0 && (
                  <Link
                    href="/stores"
                    className="ml-auto text-sm font-medium text-amber-800 dark:text-amber-300 underline underline-offset-2 hover:text-amber-900"
                  >
                    Go to Stores →
                  </Link>
                )}
              </li>
              <li className="flex items-center gap-3">
                {categories.length > 0 ? (
                  <span className="text-green-600 font-bold text-base">✓</span>
                ) : (
                  <span className="text-muted-foreground text-base">○</span>
                )}
                <span className={categories.length > 0 ? "text-muted-foreground line-through" : "text-foreground"}>
                  Add at least one category
                </span>
                {categories.length === 0 && (
                  <Link
                    href="/categories"
                    className="ml-auto text-sm font-medium text-amber-800 dark:text-amber-300 underline underline-offset-2 hover:text-amber-900"
                  >
                    Go to Categories →
                  </Link>
                )}
              </li>
            </ul>
          </CardContent>
        </Card>
      )}

      <CompareTable data={data} stores={stores} categories={categories} />
    </div>
  );
}
