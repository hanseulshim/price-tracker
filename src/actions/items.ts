"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getItems(categoryId?: number) {
  return db.item.findMany({
    where: categoryId ? { categoryId } : undefined,
    orderBy: { name: "asc" },
    include: {
      category: true,
      _count: { select: { prices: true } },
    },
  });
}

export async function getItem(id: number) {
  return db.item.findUnique({
    where: { id },
    include: {
      category: true,
      prices: {
        include: { store: true },
        orderBy: { date: "desc" },
      },
    },
  });
}

export async function createItem(data: {
  name: string;
  brand?: string;
  unit?: string;
  categoryId: number;
}) {
  const item = await db.item.create({ data });
  revalidatePath("/items");
  return item;
}

export async function updateItem(
  id: number,
  data: { name: string; brand?: string; unit?: string; categoryId: number }
) {
  const item = await db.item.update({ where: { id }, data });
  revalidatePath("/items");
  return item;
}

export async function deleteItem(id: number) {
  await db.item.delete({ where: { id } });
  revalidatePath("/items");
}

export async function searchItems(query: string) {
  return db.item.findMany({
    where: {
      OR: [
        { name: { contains: query } },
        { brand: { contains: query } },
      ],
    },
    include: { category: true },
    take: 20,
    orderBy: { name: "asc" },
  });
}
