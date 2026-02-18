-- CreateEnum
CREATE TYPE "ProductInventoryStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD_OUT');

-- AlterTable
ALTER TABLE "StoreProduct" ADD COLUMN     "inventoryStatus" "ProductInventoryStatus" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "reservedQty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stockQty" INTEGER NOT NULL DEFAULT 0;
