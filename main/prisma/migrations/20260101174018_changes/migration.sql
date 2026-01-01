/*
  Warnings:

  - You are about to drop the column `api_keys` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `domainName` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `nameservers` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `requestsCount` on the `projects` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[websiteUrl]` on the table `projects` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `api_token` to the `projects` table without a default value. This is not possible if the table is not empty.
  - Made the column `websiteUrl` on table `projects` required. This step will fail if there are existing NULL values in that column.
  - Made the column `zoneId` on table `projects` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "projects_userId_name_key";

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "api_keys",
DROP COLUMN "domainName",
DROP COLUMN "name",
DROP COLUMN "nameservers",
DROP COLUMN "requestsCount",
ADD COLUMN     "api_token" TEXT NOT NULL,
ALTER COLUMN "websiteUrl" SET NOT NULL,
ALTER COLUMN "zoneId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "projects_websiteUrl_key" ON "projects"("websiteUrl");
