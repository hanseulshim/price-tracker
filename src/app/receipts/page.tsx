import { getReceipts } from "@/actions/receipts";
import { getStores } from "@/actions/stores";
import { ReceiptPage } from "@/components/receipts/receipt-page";

export const dynamic = "force-dynamic";

export default async function ReceiptsPageWrapper() {
  const [receipts, stores] = await Promise.all([
    getReceipts(),
    getStores(),
  ]);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Receipts</h1>
        <p className="text-muted-foreground mt-1">Import receipts to track prices</p>
      </div>
      <ReceiptPage receipts={receipts} stores={stores} />
    </div>
  );
}
