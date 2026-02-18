-- CreateEnum
CREATE TYPE "BodyPart" AS ENUM ('ABS', 'ARMS', 'BACK', 'BUTT_HIPS', 'CHEST', 'SHOULDERS', 'LEGS', 'FULL_BODY');

-- CreateEnum
CREATE TYPE "Equipment" AS ENUM ('NONE', 'DUMBBELLS', 'BARBELL', 'MACHINE', 'RESISTANCE_BANDS', 'CABLES');

-- CreateTable
CREATE TABLE "Exercise" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDesc" TEXT NOT NULL,
    "longDesc" TEXT,
    "bodyPart" "BodyPart" NOT NULL,
    "equipment" "Equipment" NOT NULL,
    "difficulty" "ResourceDifficulty" NOT NULL,
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_slug_key" ON "Exercise"("slug");
