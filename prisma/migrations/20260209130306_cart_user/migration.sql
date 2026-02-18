/*
  Warnings:

  - You are about to drop the column `personId` on the `StoreCart` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `StoreCart` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `StoreCart` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."StoreCart" DROP CONSTRAINT "StoreCart_personId_fkey";

-- DropIndex
DROP INDEX "public"."StoreCart_personId_key";

-- AlterTable
ALTER TABLE "StoreCart" DROP COLUMN "personId",
ADD COLUMN     "userId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "StoreCart_userId_key" ON "StoreCart"("userId");

-- AddForeignKey
ALTER TABLE "StoreCart" ADD CONSTRAINT "StoreCart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
