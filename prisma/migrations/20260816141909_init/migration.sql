-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" DATETIME,
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" DATETIME
);

-- CreateTable
CREATE TABLE "ShopSettings" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL DEFAULT '{}',
    "secrets" TEXT NOT NULL DEFAULT '{}',
    "defaults" TEXT NOT NULL DEFAULT '{}',
    "seededAt" DATETIME,
    "seedVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "productHandle" TEXT,
    "productTitle" TEXT,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "draft" TEXT NOT NULL DEFAULT '{}',
    "published" TEXT,
    "compiled" TEXT,
    "compiledAt" DATETIME,
    "previewToken" TEXT NOT NULL,
    "hasUnpublishedChanges" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "publishedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sessionId" TEXT,
    "cardIndex" INTEGER,
    "market" TEXT,
    "locale" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "referrer" TEXT,
    "device" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImageAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "prompt" TEXT,
    "alt" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Page_shop_status_idx" ON "Page"("shop", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Page_shop_slug_key" ON "Page"("shop", "slug");

-- CreateIndex
CREATE INDEX "Event_shop_pageId_createdAt_idx" ON "Event"("shop", "pageId", "createdAt");

-- CreateIndex
CREATE INDEX "Event_pageId_type_idx" ON "Event"("pageId", "type");

-- CreateIndex
CREATE INDEX "ImageAsset_shop_createdAt_idx" ON "ImageAsset"("shop", "createdAt");
