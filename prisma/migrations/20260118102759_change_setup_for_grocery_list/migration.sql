/*
  Warnings:

  - You are about to drop the `GroceryItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Ingredient` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MealIngredient` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ShoppingSession` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."GroceryItem" DROP CONSTRAINT "GroceryItem_shoppingSessionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MealIngredient" DROP CONSTRAINT "MealIngredient_ingredientId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MealIngredient" DROP CONSTRAINT "MealIngredient_mealId_fkey";

-- DropTable
DROP TABLE "public"."GroceryItem";

-- DropTable
DROP TABLE "public"."Ingredient";

-- DropTable
DROP TABLE "public"."MealIngredient";

-- DropTable
DROP TABLE "public"."ShoppingSession";

-- DropEnum
DROP TYPE "public"."GroceryItemState";

-- DropEnum
DROP TYPE "public"."ShoppingSessionStatus";
