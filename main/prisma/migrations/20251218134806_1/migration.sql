/*
  Warnings:

  - You are about to drop the column `clerkId` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "users_clerkId_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "clerkId",
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_userId_key" ON "users"("userId");
