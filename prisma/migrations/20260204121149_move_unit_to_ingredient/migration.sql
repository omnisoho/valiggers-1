/*
  Warnings:

  - You are about to drop the column `quantityUnit` on the `MealIngredient` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "quantityUnit" "QuantityUnit" NOT NULL DEFAULT 'GRAM';

-- AlterTable
ALTER TABLE "MealIngredient" DROP COLUMN "quantityUnit";
