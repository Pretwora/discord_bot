-- CreateTable
CREATE TABLE "GoldRaid" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "announcedBy" TEXT NOT NULL,
    "messageId" TEXT,
    "channelId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalGold" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GoldRaid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoldRaidPumper" (
    "id" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "noShow" BOOLEAN NOT NULL DEFAULT false,
    "earnedGold" INTEGER,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GoldRaidPumper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoldRaidBuyer" (
    "id" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "raidTarget" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL,
    "goldAmount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "noShow" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GoldRaidBuyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoldRaidUserStats" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "pumperRaids" INTEGER NOT NULL DEFAULT 0,
    "pumperGold" INTEGER NOT NULL DEFAULT 0,
    "buyerRaids" INTEGER NOT NULL DEFAULT 0,
    "itemsWon" INTEGER NOT NULL DEFAULT 0,
    "noShowCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GoldRaidUserStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoldRaidBlacklist" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "reason" TEXT,
    "noShows" INTEGER NOT NULL DEFAULT 0,
    "addedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GoldRaidBlacklist_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GoldRaid" ADD CONSTRAINT "GoldRaid_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoldRaidPumper" ADD CONSTRAINT "GoldRaidPumper_raidId_fkey" FOREIGN KEY ("raidId") REFERENCES "GoldRaid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoldRaidBuyer" ADD CONSTRAINT "GoldRaidBuyer_raidId_fkey" FOREIGN KEY ("raidId") REFERENCES "GoldRaid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "GoldRaidPumper_raidId_userId_key" ON "GoldRaidPumper"("raidId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GoldRaidUserStats_guildId_userId_key" ON "GoldRaidUserStats"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GoldRaidBlacklist_guildId_userId_key" ON "GoldRaidBlacklist"("guildId", "userId");
