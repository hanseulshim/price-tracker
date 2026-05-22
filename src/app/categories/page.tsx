import { getCategories } from "@/actions/categories";
import { CategoryList } from "@/components/categories/category-list";

export default async function CategoriesPage() {
  const categories = await getCategories();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Categories</h1>
        <p className="text-muted-foreground mt-1">Organize items by category</p>
      </div>
      <CategoryList categories={categories} />
    </div>
  );
}
