-- AlterTable
ALTER TABLE "GoldRaidPumper" ADD COLUMN     "inQueue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pumperRole" TEXT;
