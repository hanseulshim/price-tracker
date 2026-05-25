/*
  Warnings:

  - You are about to drop the column `brand` on the `Item` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Price" ADD COLUMN "brand" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "categoryId" INTEGER NOT NULL,
    CONSTRAINT "Item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("categoryId", "id", "name", "unit") SELECT "categoryId", "id", "name", "unit" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
