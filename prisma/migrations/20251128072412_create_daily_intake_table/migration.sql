-- CreateTable
CREATE TABLE "DailyIntake" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalCalories" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailyIntake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyIntake_userId_date_key" ON "DailyIntake"("userId", "date");
