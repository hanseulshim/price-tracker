"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getCategories() {
  return db.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true } } },
  });
}

export async function createCategory(name: string) {
  const cat = await db.category.create({ data: { name } });
  revalidatePath("/categories");
  revalidatePath("/items");
  return cat;
}

export async function updateCategory(id: number, name: string) {
  const cat = await db.category.update({ where: { id }, data: { name } });
  revalidatePath("/categories");
  revalidatePath("/items");
  return cat;
}

export async function deleteCategory(id: number) {
  await db.category.delete({ where: { id } });
  revalidatePath("/categories");
  revalidatePath("/items");
}
