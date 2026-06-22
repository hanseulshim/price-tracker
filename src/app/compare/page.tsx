import { getComparisonData } from "@/actions/prices";
import { getStores } from "@/actions/stores";
import { getCategories } from "@/actions/categories";
import { CompareTable } from "@/components/compare/compare-table";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const [data, stores, categories] = await Promise.all([
    getComparisonData(),
    getStores(),
    getCategories(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Price Comparison</h1>
        <p className="text-muted-foreground mt-1">
          Compare prices across stores — cheapest highlighted in green
        </p>
      </div>
      <CompareTable data={data} stores={stores} categories={categories} />
    </div>
  );
}
