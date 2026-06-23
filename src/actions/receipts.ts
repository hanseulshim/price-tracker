"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { parseReceiptText } from "@/lib/receipt-parser";
import { extractBrand } from "@/lib/brand-utils";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

const ReceiptItemSchema = z.object({
  rawName: z.string().min(1).max(500),
  price: z.number().positive().max(99999),
  quantity: z.number().positive().optional(),
  itemId: z.number().int().positive().optional(),
  externalId: z.string().max(50).optional(),
  originalPrice: z.number().positive().max(99999).optional(),
});

const ImportReceiptSchema = z.object({
  storeId: z.number().int().positive(),
  date: z.date(),
  rawText: z.string().min(1, "Receipt text is required"),
  orderNumber: z.string().max(100).optional(),
  addressLine1: z.string().max(200).optional(),
  addressCity: z.string().max(100).optional(),
  addressState: z.string().max(2).optional(),
  addressZip: z.string().max(10).optional(),
  notes: z.string().max(500).optional(),
  items: z.array(ReceiptItemSchema).min(1, "Receipt must have at least one item"),
});

const UpdateReceiptSchema = z.object({
  storeId: z.number().int().positive(),
  date: z.date(),
  orderNumber: z.string().max(100).optional(),
  addressLine1: z.string().max(200).optional(),
  addressCity: z.string().max(100).optional(),
  addressState: z.string().max(2).optional(),
  addressZip: z.string().max(10).optional(),
  notes: z.string().max(500).optional(),
});

export async function getReceipts() {
  return db.receipt.findMany({
    select: {
      id: true,
      date: true,
      orderNumber: true,
      addressLine1: true,
      addressCity: true,
      addressState: true,
      addressZip: true,
      notes: true,
      storeId: true,
      store: { select: { id: true, name: true } },
      _count: { select: { items: true } },
      items: { select: { price: true, quantity: true } },
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
  addressLine1?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  notes?: string;
  items: Array<{
    rawName: string;
    price: number;
    quantity?: number;
    itemId?: number;
    externalId?: string;
    originalPrice?: number;
  }>;
}) {
  const parsed = ImportReceiptSchema.parse(data);

  // Check for duplicate receipts
  if (parsed.orderNumber) {
    const existing = await db.receipt.findFirst({
      where: { storeId: parsed.storeId, orderNumber: parsed.orderNumber },
      select: { id: true },
    });
    if (existing) throw new Error(`This receipt was already imported (order #${parsed.orderNumber})`);
  } else {
    const existing = await db.receipt.findFirst({
      where: { storeId: parsed.storeId, rawText: parsed.rawText },
      select: { id: true },
    });
    if (existing) throw new Error("This receipt appears to have already been imported");
  }

  try {
    const receipt = await db.receipt.create({
      data: {
        storeId: parsed.storeId,
        date: parsed.date,
        rawText: parsed.rawText,
        orderNumber: parsed.orderNumber,
        addressLine1: parsed.addressLine1,
        addressCity: parsed.addressCity,
        addressState: parsed.addressState,
        addressZip: parsed.addressZip,
        notes: parsed.notes,
        items: {
          create: parsed.items.map((item) => ({
            rawName: item.rawName,
            price: item.price,
            quantity: item.quantity,
            itemId: item.itemId,
            externalId: item.externalId,
          })),
        },
      },
      include: { items: true },
    });

    // Save prices for matched items — batch insert
    const originalPriceMap = new Map(
      parsed.items.map((item) => [item.rawName, item.originalPrice])
    );
    const priceData = receipt.items
      .filter((ri) => ri.itemId != null)
      .map((ri) => ({
        itemId: ri.itemId!,
        storeId: parsed.storeId,
        receiptId: receipt.id,
        price: ri.price,
        originalPrice: originalPriceMap.get(ri.rawName) ?? null,
        quantity: ri.quantity ?? null,
        brand: extractBrand(ri.rawName) ?? null,
        date: parsed.date,
        notes: `From receipt #${receipt.id}`,
      }));
    if (priceData.length > 0) {
      await db.price.createMany({ data: priceData });
    }

    revalidatePath("/receipts");
    revalidatePath("/items");
    revalidatePath("/compare");
    revalidatePath("/");
    return receipt;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("A record with this name already exists");
    }
    if (err instanceof Error) throw err;
    throw new Error("Failed to import receipt");
  }
}

export async function deleteReceipt(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid id");
  await db.price.deleteMany({ where: { receiptId: id } });
  await db.receipt.delete({ where: { id } });
  revalidatePath("/receipts");
  revalidatePath("/compare");
  revalidatePath("/");
}

export async function updateReceipt(
  id: number,
  data: {
    storeId: number;
    date: Date;
    orderNumber?: string;
    addressLine1?: string;
    addressCity?: string;
    addressState?: string;
    addressZip?: string;
    notes?: string;
  }
) {
  const parsed = UpdateReceiptSchema.parse(data);
  try {
    await db.receipt.update({ where: { id }, data: parsed });
    revalidatePath("/receipts");
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("A record with this name already exists");
    }
    if (err instanceof Error) throw err;
    throw new Error("Failed to update receipt");
  }
}
