"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

const StoreSchema = z.object({
  name: z.string().min(1, "Store name is required").max(100),
  location: z.string().max(200).optional(),
});

export async function getStores() {
  return db.store.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { prices: true, receipts: true } },
    },
  });
}

export async function getStore(id: number) {
  return db.store.findUnique({
    where: { id },
    include: {
      prices: {
        include: { item: { include: { category: true } } },
        orderBy: { date: "desc" },
      },
    },
  });
}

export async function createStore(data: { name: string; location?: string }) {
  const parsed = StoreSchema.parse(data);
  try {
    const store = await db.store.create({ data: parsed });
    revalidatePath("/stores");
    return store;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("A store with this name already exists");
    }
    if (err instanceof Error) throw err;
    throw new Error("Failed to create store");
  }
}

export async function updateStore(
  id: number,
  data: { name: string; location?: string }
) {
  const parsed = StoreSchema.parse(data);
  try {
    const store = await db.store.update({ where: { id }, data: parsed });
    revalidatePath("/stores");
    return store;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("A store with this name already exists");
    }
    if (err instanceof Error) throw err;
    throw new Error("Failed to update store");
  }
}

export async function deleteStore(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid id");
  await db.store.delete({ where: { id } });
  revalidatePath("/stores");
  revalidatePath("/compare");
  revalidatePath("/items");
  revalidatePath("/");
}
