"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { parseReceiptText } from "@/lib/receipt-parser";
import { extractBrand } from "@/lib/brand-utils";

export async function getReceipts() {
  return db.receipt.findMany({
    select: {
      id: true,
      date: true,
      orderNumber: true,
      notes: true,
      store: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { date: "desc" },
  });
}

export async function getReceipt(id: number) {
  return db.receipt.findUnique({
    where: { id },
    include: {
      store: true,
      items: { include: { item: { include: { category: true } } } },
    },
  });
}

export async function parseReceipt(text: string) {
  return parseReceiptText(text);
}

export async function importReceipt(data: {
  storeId: number;
  date: Date;
  rawText: string;
  orderNumber?: string;
  notes?: string;
  items: Array<{
    rawName: string;
    price: number;
    quantity?: number;
    itemId?: number;
  }>;
}) {
  const receipt = await db.receipt.create({
    data: {
      storeId: data.storeId,
      date: data.date,
      rawText: data.rawText,
      orderNumber: data.orderNumber,
      notes: data.notes,
      items: {
        create: data.items.map((item) => ({
          rawName: item.rawName,
          price: item.price,
          quantity: item.quantity,
          itemId: item.itemId,
        })),
      },
    },
    include: { items: true },
  });

  // Save prices for matched items
  for (const ri of receipt.items) {
    if (ri.itemId) {
      await db.price.create({
        data: {
          itemId: ri.itemId,
          storeId: data.storeId,
          price: ri.price,
          quantity: ri.quantity,
          brand: extractBrand(ri.rawName) ?? undefined,
          date: data.date,
          notes: `From receipt #${receipt.id}`,
        },
      });
    }
  }

  revalidatePath("/receipts");
  revalidatePath("/items");
  revalidatePath("/compare");
  revalidatePath("/");
  return receipt;
}

export async function deleteReceipt(id: number) {
  await db.receipt.delete({ where: { id } });
  revalidatePath("/receipts");
}
