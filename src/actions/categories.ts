"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

const CategorySchema = z.string().min(1, "Category name is required").max(100);

export async function getCategories() {
  return db.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true } } },
  });
}

export async function createCategory(name: string) {
  const parsed = CategorySchema.parse(name);
  try {
    const cat = await db.category.create({ data: { name: parsed } });
    revalidatePath("/categories");
    revalidatePath("/items");
    return cat;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("A category with this name already exists");
    }
    if (err instanceof Error) throw err;
    throw new Error("Failed to create category");
  }
}

export async function updateCategory(id: number, name: string) {
  const parsed = CategorySchema.parse(name);
  try {
    const cat = await db.category.update({ where: { id }, data: { name: parsed } });
    revalidatePath("/categories");
    revalidatePath("/items");
    return cat;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("A category with this name already exists");
    }
    if (err instanceof Error) throw err;
    throw new Error("Failed to update category");
  }
}

export async function deleteCategory(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid id");
  await db.category.delete({ where: { id } });
  revalidatePath("/categories");
  revalidatePath("/items");
}
