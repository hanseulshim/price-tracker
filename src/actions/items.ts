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
  unit?: string;
  size?: number;
  imageUrl?: string;
  categoryId: number;
}) {
  const item = await db.item.create({ data });
  revalidatePath("/items");
  return item;
}

export async function updateItem(
  id: number,
  data: { name?: string; unit?: string; size?: number; imageUrl?: string; categoryId?: number }
) {
  const item = await db.item.update({ where: { id }, data });
  revalidatePath("/items");
  return item;
}

export async function deleteItem(id: number) {
  await db.item.delete({ where: { id } });
  revalidatePath("/items");
}

export async function syncCostcoItemNames(): Promise<{ updated: number; skipped: number }> {
  // Find all distinct (itemId, externalId) pairs from receipt items
  const rows = await db.receiptItem.findMany({
    where: { externalId: { not: null }, itemId: { not: null } },
    select: { itemId: true, externalId: true },
    distinct: ["itemId"],
  });

  const { lookupCostcoItem } = await import("./lookup");
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const info = await lookupCostcoItem(row.externalId!);
    if (!info) { skipped++; continue; }

    const sizeMatch = info.name.match(/,?\s*(\d+(?:\.\d+)?)\s*(oz|fl\s*oz|lb|ct|count|pk|pack)\b/i);
    await db.item.update({
      where: { id: row.itemId! },
      data: {
        name: info.name,
        ...(info.imageUrl ? { imageUrl: info.imageUrl } : {}),
        ...(sizeMatch ? {
          size: parseFloat(sizeMatch[1]),
          unit: sizeMatch[2].replace(/\s+/g, " ").toLowerCase(),
        } : {}),
      },
    });
    updated++;
  }

  revalidatePath("/items");
  revalidatePath("/compare");
  revalidatePath("/");
  return { updated, skipped };
}

export async function searchItems(query: string) {
  return db.item.findMany({
    where: {
      OR: [
        { name: { contains: query } },
      ],
    },
    include: { category: true },
    take: 20,
    orderBy: { name: "asc" },
  });
}
