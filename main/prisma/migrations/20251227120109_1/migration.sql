/*
  Warnings:

  - You are about to drop the `api_keys` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId,name]` on the table `projects` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_projectId_fkey";

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "api_keys" TEXT,
ADD COLUMN     "domainName" TEXT;

-- DropTable
DROP TABLE "api_keys";

-- CreateIndex
CREATE UNIQUE INDEX "projects_userId_name_key" ON "projects"("userId", "name");
