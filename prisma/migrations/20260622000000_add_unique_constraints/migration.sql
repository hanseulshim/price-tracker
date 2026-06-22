-- CreateIndex: unique item name per category
CREATE UNIQUE INDEX "Item_name_categoryId_key" ON "Item"("name", "categoryId");

-- CreateIndex: unique price entry per item/store/receipt (prevents duplicate prices from the same receipt)
CREATE UNIQUE INDEX "Price_itemId_storeId_receiptId_key" ON "Price"("itemId", "storeId", "receiptId");
