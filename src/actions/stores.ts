"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

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
  const store = await db.store.create({ data });
  revalidatePath("/stores");
  return store;
}

export async function updateStore(
  id: number,
  data: { name: string; location?: string }
) {
  const store = await db.store.update({ where: { id }, data });
  revalidatePath("/stores");
  return store;
}

export async function deleteStore(id: number) {
  await db.store.delete({ where: { id } });
  revalidatePath("/stores");
}
