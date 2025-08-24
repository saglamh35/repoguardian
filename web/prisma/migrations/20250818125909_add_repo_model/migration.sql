/*
  Warnings:

  - You are about to drop the column `installedAt` on the `Repo` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Repo` table. All the data in the column will be lost.
  - You are about to drop the column `owner` on the `Repo` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,githubId]` on the table `Repo` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `githubId` to the `Repo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `private` to the `Repo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Repo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Repo" DROP COLUMN "installedAt",
DROP COLUMN "name",
DROP COLUMN "owner",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "githubId" BIGINT NOT NULL,
ADD COLUMN     "htmlUrl" TEXT,
ADD COLUMN     "private" BOOLEAN NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Repo_userId_githubId_key" ON "public"."Repo"("userId", "githubId");
