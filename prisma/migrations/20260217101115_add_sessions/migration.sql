-- CreateTable
CREATE TABLE "MealPreparationSession" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "mealId" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealPreparationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPreparationItem" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "ingredientName" TEXT NOT NULL,
    "requiredQuantity" DOUBLE PRECISION NOT NULL,
    "stockStatus" TEXT NOT NULL,
    "preparationStatus" TEXT NOT NULL,

    CONSTRAINT "MealPreparationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingSession" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShoppingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingSessionItem" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "ingredientId" INTEGER NOT NULL,
    "ingredientName" TEXT NOT NULL,
    "quantityAdded" DOUBLE PRECISION NOT NULL,
    "purchaseStatus" TEXT NOT NULL,
    "stockStatus" TEXT NOT NULL,

    CONSTRAINT "ShoppingSessionItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MealPreparationItem" ADD CONSTRAINT "MealPreparationItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MealPreparationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingSessionItem" ADD CONSTRAINT "ShoppingSessionItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ShoppingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
