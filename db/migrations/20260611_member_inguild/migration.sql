-- Add inGuild flag to Member — preserves XP when member leaves/rejoins
ALTER TABLE "Member" ADD COLUMN "inGuild" BOOLEAN NOT NULL DEFAULT true;
