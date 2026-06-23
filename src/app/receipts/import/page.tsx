import { getStores } from "@/actions/stores";
import { getCategories } from "@/actions/categories";
import { getItems } from "@/actions/items";
import { ImportFlow } from "@/components/receipts/import-flow";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ImportReceiptPage() {
  const [stores, categories, items] = await Promise.all([
    getStores(),
    getCategories(),
    getItems(),
  ]);

  if (stores.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <Link href="/receipts" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Receipts
          </Link>
          <h1 className="text-2xl font-bold">Import Receipt</h1>
        </div>
        <p className="text-muted-foreground">Add a store first before importing receipts.</p>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <Link href="/receipts" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Receipts
          </Link>
          <h1 className="text-2xl font-bold">Import Receipt</h1>
        </div>
        <p className="text-muted-foreground">Add at least one category first before importing receipts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/receipts" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Receipts
        </Link>
        <h1 className="text-2xl font-bold">Import Receipt</h1>
        <p className="text-muted-foreground mt-1">Paste receipt text to extract and save prices</p>
      </div>
      <ImportFlow stores={stores} categories={categories} items={items} />
    </div>
  );
}
