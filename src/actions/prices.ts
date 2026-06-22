"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

const PriceSchema = z.object({
  itemId: z.number().int().positive(),
  storeId: z.number().int().positive(),
  price: z.number().positive("Price must be positive").max(99999),
  quantity: z.number().positive().optional(),
  brand: z.string().max(100).optional(),
  date: z.date().optional(),
  notes: z.string().max(500).optional(),
});

const PriceUpdateSchema = z.object({
  price: z.number().positive("Price must be positive").max(99999),
  quantity: z.number().positive().optional(),
  date: z.date().optional(),
  notes: z.string().max(500).optional(),
});

export async function addPrice(data: {
  itemId: number;
  storeId: number;
  price: number;
  quantity?: number;
  brand?: string;
  date?: Date;
  notes?: string;
}) {
  const parsed = PriceSchema.parse(data);
  try {
    const price = await db.price.create({
      data: {
        ...parsed,
        date: parsed.date ?? new Date(),
      },
    });
    revalidatePath("/items");
    revalidatePath("/compare");
    revalidatePath("/");
    return price;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("A record with this name already exists");
    }
    if (err instanceof Error) throw err;
    throw new Error("Failed to add price");
  }
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
  const parsed = PriceUpdateSchema.parse(data);
  try {
    const price = await db.price.update({ where: { id }, data: parsed });
    revalidatePath("/items");
    revalidatePath("/compare");
    return price;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("A record with this name already exists");
    }
    if (err instanceof Error) throw err;
    throw new Error("Failed to update price");
  }
}

export async function deletePrice(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid id");
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
    // Build latest + previous price per store (for trend)
    const latestByStore = new Map<number, (typeof item.prices)[number]>();
    const prevByStore = new Map<number, (typeof item.prices)[number]>();
    for (const price of item.prices) {
      if (!latestByStore.has(price.storeId)) {
        latestByStore.set(price.storeId, price);
      } else if (!prevByStore.has(price.storeId)) {
        prevByStore.set(price.storeId, price);
      }
    }
    const storePrices = Array.from(latestByStore.values()).map((p) => ({
      ...p,
      prevPrice: prevByStore.get(p.storeId)?.price ?? null,
    }));
    const cheapest = storePrices.reduce<(typeof storePrices)[number] | null>(
      (min, p) => (!min || p.price < min.price ? p : min),
      null
    );
    return { ...item, storePrices, cheapestStoreId: cheapest?.storeId ?? null };
  });
}
