/*
  Warnings:

  - You are about to drop the column `phone` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `premium` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[phone_no]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `phone_no` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."User_phone_key";

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "phone",
DROP COLUMN "premium",
ADD COLUMN     "isPremium" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone_no" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_no_key" ON "public"."User"("phone_no");
