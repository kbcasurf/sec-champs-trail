/*
  Warnings:

  - Added the required column `experienceLevel` to the `TrainingTrack` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hoursPerWeek` to the `TrainingTrack` table without a default value. This is not possible if the table is not empty.
  - Added the required column `techStack` to the `TrainingTrack` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('beginner', 'intermediate', 'advanced');

-- AlterTable
ALTER TABLE "TrainingTrack" ADD COLUMN     "experienceLevel" "ExperienceLevel" NOT NULL,
ADD COLUMN     "hoursPerWeek" INTEGER NOT NULL,
ADD COLUMN     "techStack" TEXT NOT NULL;
