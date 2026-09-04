-- Sprint 1  Enterprise Foundation
-- Adds: AuditLog, ReporterReputation, DedupSignature, PushSubscription,
--       NotificationOutbox, SafetyCheckCampaign, SafetyCheckResponse
-- All additions are purely additive; existing tables are not touched.

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" VARCHAR(64) NOT NULL,
    "actorType" VARCHAR(32) NOT NULL,
    "actorRef" VARCHAR(128),
    "resourceType" VARCHAR(32) NOT NULL,
    "resourceId" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "prevHash" CHAR(64) NOT NULL,
    "hash" CHAR(64) NOT NULL,
    "chainId" VARCHAR(32) NOT NULL DEFAULT 'default',

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporter_reputation" (
    "deviceKey" CHAR(64) NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 50,
    "reportsTotal" INTEGER NOT NULL DEFAULT 0,
    "reportsVerified" INTEGER NOT NULL DEFAULT 0,
    "reportsQuarantined" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedAt" TIMESTAMPTZ(6),
    "blockedReason" VARCHAR(256),

    CONSTRAINT "reporter_reputation_pkey" PRIMARY KEY ("deviceKey")
);

-- CreateTable
CREATE TABLE "dedup_signature" (
    "signature" CHAR(64) NOT NULL,
    "reportId" VARCHAR(64) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeen" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dedup_signature_pkey" PRIMARY KEY ("signature")
);

-- CreateTable
CREATE TABLE "push_subscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "geoScope" JSONB NOT NULL,
    "topicSismos" BOOLEAN NOT NULL DEFAULT true,
    "topicTsunami" BOOLEAN NOT NULL DEFAULT true,
    "topicAyuda" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failuresCount" INTEGER NOT NULL DEFAULT 0,
    "retiredAt" TIMESTAMPTZ(6),

    CONSTRAINT "push_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_outbox" (
    "id" BIGSERIAL NOT NULL,
    "channel" VARCHAR(16) NOT NULL,
    "payload" JSONB NOT NULL,
    "scopeKey" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pickedAt" TIMESTAMPTZ(6),
    "deliveredAt" TIMESTAMPTZ(6),
    "failedAt" TIMESTAMPTZ(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "payloadHash" CHAR(64) NOT NULL,

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_check_campaign" (
    "id" TEXT NOT NULL,
    "triggerEventId" VARCHAR(64) NOT NULL,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "affectedH3Cells" TEXT[],
    "closedAt" TIMESTAMPTZ(6),

    CONSTRAINT "safety_check_campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_check_response" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "deviceKey" CHAR(64) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "h3Cell" VARCHAR(16) NOT NULL,
    "triageColor" VARCHAR(8),
    "notesRedacted" VARCHAR(280),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "safety_check_response_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audit_log_hash_key" ON "audit_log"("hash");

-- CreateIndex
CREATE INDEX "audit_log_resourceType_resourceId_idx" ON "audit_log"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "audit_log_occurredAt_idx" ON "audit_log"("occurredAt");

-- CreateIndex
CREATE INDEX "audit_log_eventType_occurredAt_idx" ON "audit_log"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_log_chainId_id_idx" ON "audit_log"("chainId", "id");

-- CreateIndex
CREATE INDEX "reporter_reputation_score_idx" ON "reporter_reputation"("score");

-- CreateIndex
CREATE INDEX "reporter_reputation_blockedAt_idx" ON "reporter_reputation"("blockedAt");

-- CreateIndex
CREATE INDEX "dedup_signature_reportId_idx" ON "dedup_signature"("reportId");

-- CreateIndex
CREATE INDEX "dedup_signature_lastSeen_idx" ON "dedup_signature"("lastSeen");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscription_endpoint_key" ON "push_subscription"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscription_retiredAt_idx" ON "push_subscription"("retiredAt");

-- CreateIndex
CREATE INDEX "push_subscription_lastActiveAt_idx" ON "push_subscription"("lastActiveAt");

-- CreateIndex
CREATE INDEX "notification_outbox_deliveredAt_pickedAt_idx" ON "notification_outbox"("deliveredAt", "pickedAt");

-- CreateIndex
CREATE INDEX "notification_outbox_scopeKey_payloadHash_createdAt_idx" ON "notification_outbox"("scopeKey", "payloadHash", "createdAt");

-- CreateIndex
CREATE INDEX "safety_check_campaign_startedAt_idx" ON "safety_check_campaign"("startedAt");

-- CreateIndex
CREATE INDEX "safety_check_response_campaignId_status_idx" ON "safety_check_response"("campaignId", "status");

-- CreateIndex
CREATE INDEX "safety_check_response_h3Cell_campaignId_idx" ON "safety_check_response"("h3Cell", "campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "safety_check_response_campaignId_deviceKey_key" ON "safety_check_response"("campaignId", "deviceKey");

-- AddForeignKey
ALTER TABLE "safety_check_response" ADD CONSTRAINT "safety_check_response_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "safety_check_campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;