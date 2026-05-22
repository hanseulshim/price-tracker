import { getReceipts } from "@/actions/receipts";
import { getStores } from "@/actions/stores";
import { getCategories } from "@/actions/categories";
import { getItems } from "@/actions/items";
import { ReceiptPage } from "@/components/receipts/receipt-page";

export default async function ReceiptsPageWrapper() {
  const [receipts, stores, categories, items] = await Promise.all([
    getReceipts(),
    getStores(),
    getCategories(),
    getItems(),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Receipts</h1>
        <p className="text-muted-foreground mt-1">Import receipts to track prices</p>
      </div>
      <ReceiptPage receipts={receipts} stores={stores} categories={categories} items={items} />
    </div>
  );
}
