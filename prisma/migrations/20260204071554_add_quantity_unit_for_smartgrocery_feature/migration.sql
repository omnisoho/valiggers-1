-- CreateEnum
CREATE TYPE "QuantityUnit" AS ENUM ('GRAM', 'KILOGRAM', 'MILLILITER', 'LITER', 'TABLESPOON', 'TEASPOON', 'CUP', 'PIECE');

-- AlterTable
ALTER TABLE "MealIngredient" ADD COLUMN     "quantityUnit" "QuantityUnit" NOT NULL DEFAULT 'GRAM';
