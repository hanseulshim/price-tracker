import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const dbUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url: dbUrl });

const prisma = new PrismaClient({ adapter });

async function main() {
  const categories = [
    "Produce",
    "Meat & Seafood",
    "Dairy & Eggs",
    "Bakery",
    "Frozen",
    "Pantry",
    "Snacks",
    "Beverages",
    "Household",
    "Personal Care",
    "Other",
  ];

  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log(`✅ Seeded ${categories.length} categories`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
