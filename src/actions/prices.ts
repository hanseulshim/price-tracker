"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function addPrice(data: {
  itemId: number;
  storeId: number;
  price: number;
  quantity?: number;
  date?: Date;
  notes?: string;
}) {
  const price = await db.price.create({
    data: {
      ...data,
      date: data.date ?? new Date(),
    },
  });
  revalidatePath("/items");
  revalidatePath("/compare");
  revalidatePath("/");
  return price;
}

export async function updatePrice(
  id: number,
  data: {
    price: number;
    quantity?: number;
    date?: Date;
    notes?: string;
  }
) {
  const price = await db.price.update({ where: { id }, data });
  revalidatePath("/items");
  revalidatePath("/compare");
  return price;
}

export async function deletePrice(id: number) {
  await db.price.delete({ where: { id } });
  revalidatePath("/items");
  revalidatePath("/compare");
  revalidatePath("/");
}

export async function getPricesForItem(itemId: number) {
  return db.price.findMany({
    where: { itemId },
    include: { store: true },
    orderBy: { date: "desc" },
  });
}

export async function getComparisonData(itemIds?: number[]) {
  const items = await db.item.findMany({
    where: itemIds?.length ? { id: { in: itemIds } } : undefined,
    include: {
      category: true,
      prices: {
        include: { store: true },
        orderBy: { date: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return items.map((item) => {
    const latestByStore = new Map<number, (typeof item.prices)[number]>();
    for (const price of item.prices) {
      if (!latestByStore.has(price.storeId)) {
        latestByStore.set(price.storeId, price);
      }
    }
    const storePrices = Array.from(latestByStore.values());
    const cheapest = storePrices.reduce<(typeof item.prices)[number] | null>(
      (min, p) => (!min || p.price < min.price ? p : min),
      null
    );
    return { ...item, storePrices, cheapestStoreId: cheapest?.storeId ?? null };
  });
}
