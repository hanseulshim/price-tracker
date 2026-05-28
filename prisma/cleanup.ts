import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = new PrismaLibSql({ url });
const db = new PrismaClient({ adapter });

async function main() {
  const { count } = await db.price.deleteMany({ where: { receiptId: null } });
  console.log(`Deleted ${count} orphaned price record(s).`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
