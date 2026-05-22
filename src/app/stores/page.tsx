import { getStores } from "@/actions/stores";
import { StoreList } from "@/components/stores/store-list";

export default async function StoresPage() {
  const stores = await getStores();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stores</h1>
          <p className="text-muted-foreground mt-1">Manage the stores you shop at</p>
        </div>
      </div>
      <StoreList stores={stores} />
    </div>
  );
}
