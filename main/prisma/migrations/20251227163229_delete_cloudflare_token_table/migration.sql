/*
  Warnings:

  - You are about to drop the `cloudflare_tokens` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "cloudflare_tokens" DROP CONSTRAINT "cloudflare_tokens_userId_fkey";

-- DropTable
DROP TABLE "cloudflare_tokens";
