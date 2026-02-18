/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `UserMeal` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserMeal_userId_key" ON "UserMeal"("userId");
