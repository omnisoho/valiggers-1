/*
  Warnings:

  - You are about to drop the column `mealId` on the `Ingredient` table. All the data in the column will be lost.
  - You are about to drop the column `suggestedMealId` on the `Ingredient` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Ingredient" DROP CONSTRAINT "Ingredient_mealId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Ingredient" DROP CONSTRAINT "Ingredient_suggestedMealId_fkey";

-- AlterTable
ALTER TABLE "Ingredient" DROP COLUMN "mealId",
DROP COLUMN "suggestedMealId";

-- CreateTable
CREATE TABLE "MealIngredient" (
    "mealId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,

    CONSTRAINT "MealIngredient_pkey" PRIMARY KEY ("mealId","ingredientId")
);

-- CreateTable
CREATE TABLE "SuggestedMealIngredient" (
    "suggestedMealId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,

    CONSTRAINT "SuggestedMealIngredient_pkey" PRIMARY KEY ("suggestedMealId","ingredientId")
);

-- AddForeignKey
ALTER TABLE "MealIngredient" ADD CONSTRAINT "MealIngredient_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealIngredient" ADD CONSTRAINT "MealIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedMealIngredient" ADD CONSTRAINT "SuggestedMealIngredient_suggestedMealId_fkey" FOREIGN KEY ("suggestedMealId") REFERENCES "SuggestedMeal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedMealIngredient" ADD CONSTRAINT "SuggestedMealIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
