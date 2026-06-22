import { getItems } from "@/actions/items";
import { getCategories } from "@/actions/categories";
import { ItemList } from "@/components/items/item-list";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  const [items, categories] = await Promise.all([getItems(), getCategories()]);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Items</h1>
        <p className="text-muted-foreground mt-1">Browse and manage grocery items</p>
      </div>
      <ItemList items={items} categories={categories} />
    </div>
  );
}
