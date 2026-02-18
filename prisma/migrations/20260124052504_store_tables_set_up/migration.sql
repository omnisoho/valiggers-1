/*
  Warnings:

  - You are about to drop the column `quantity` on the `Ingredient` table. All the data in the column will be lost.
  - The primary key for the `MealIngredient` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the `SuggestedMeal` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SuggestedMealIngredient` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId,name]` on the table `Ingredient` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[mealId,ingredientId]` on the table `MealIngredient` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `Ingredient` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "IngredientStatus" AS ENUM ('IN_STOCK', 'RUNNING_OUT', 'OUT_OF_STOCK');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'PURCHASED', 'NOT_PURCHASED');

-- CreateEnum
CREATE TYPE "StoreCategory" AS ENUM ('SUPPLEMENTS', 'WOMENS_CLOTHING', 'MENS_CLOTHING');

-- DropForeignKey
ALTER TABLE "public"."MealIngredient" DROP CONSTRAINT "MealIngredient_ingredientId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MealIngredient" DROP CONSTRAINT "MealIngredient_mealId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SuggestedMealIngredient" DROP CONSTRAINT "SuggestedMealIngredient_ingredientId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SuggestedMealIngredient" DROP CONSTRAINT "SuggestedMealIngredient_suggestedMealId_fkey";

-- AlterTable
ALTER TABLE "Ingredient" DROP COLUMN "quantity",
ADD COLUMN     "purchaseStatus" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "status" "IngredientStatus" NOT NULL DEFAULT 'IN_STOCK',
ADD COLUMN     "userId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "MealIngredient" DROP CONSTRAINT "MealIngredient_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD COLUMN     "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD CONSTRAINT "MealIngredient_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "public"."SuggestedMeal";

-- DropTable
DROP TABLE "public"."SuggestedMealIngredient";

-- CreateTable
CREATE TABLE "StoreProduct" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "category" "StoreCategory" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreCart" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "personId" INTEGER NOT NULL,

    CONSTRAINT "StoreCart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreCartItem" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cartId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "StoreCartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreFavourite" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "personId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,

    CONSTRAINT "StoreFavourite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreProduct_slug_key" ON "StoreProduct"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "StoreCart_personId_key" ON "StoreCart"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreCartItem_cartId_productId_key" ON "StoreCartItem"("cartId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreFavourite_personId_productId_key" ON "StoreFavourite"("personId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_userId_name_key" ON "Ingredient"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MealIngredient_mealId_ingredientId_key" ON "MealIngredient"("mealId", "ingredientId");

-- AddForeignKey
ALTER TABLE "MealIngredient" ADD CONSTRAINT "MealIngredient_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealIngredient" ADD CONSTRAINT "MealIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCart" ADD CONSTRAINT "StoreCart_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCartItem" ADD CONSTRAINT "StoreCartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "StoreCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreCartItem" ADD CONSTRAINT "StoreCartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreFavourite" ADD CONSTRAINT "StoreFavourite_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreFavourite" ADD CONSTRAINT "StoreFavourite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
