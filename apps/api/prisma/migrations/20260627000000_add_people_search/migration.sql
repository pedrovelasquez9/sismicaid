-- CreateEnum
-- (El valor 'missing_persons' de SourceType se agrega en la migración previa
-- 20260626130000_source_type_missing_persons, en su propia transacción.)
CREATE TYPE "MissingPersonStatus" AS ENUM ('missing', 'found', 'hospitalized');

-- CreateTable
CREATE TABLE "missing_person_reports" (
    "id" UUID NOT NULL,
    "source_id" UUID,
    "source_name" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "age" INTEGER,
    "is_minor" BOOLEAN NOT NULL DEFAULT false,
    "gender" TEXT,
    "last_seen_location" TEXT,
    "last_seen_state" TEXT,
    "status" "MissingPersonStatus" NOT NULL DEFAULT 'missing',
    "hospital_name" TEXT,
    "health_status" TEXT,
    "found_by" TEXT,
    "description" TEXT,
    "source_url" TEXT NOT NULL,
    "reported_at" TIMESTAMP(3),
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "missed_runs" INTEGER NOT NULL DEFAULT 0,
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "stale_since" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "missing_person_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "missing_person_reports_normalized_name_idx" ON "missing_person_reports"("normalized_name");

-- CreateIndex
CREATE INDEX "missing_person_reports_status_idx" ON "missing_person_reports"("status");

-- CreateIndex
CREATE INDEX "missing_person_reports_stale_idx" ON "missing_person_reports"("stale");

-- CreateIndex
CREATE INDEX "missing_person_reports_source_id_idx" ON "missing_person_reports"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "missing_person_reports_source_id_external_id_key" ON "missing_person_reports"("source_id", "external_id");

-- AddForeignKey
ALTER TABLE "missing_person_reports" ADD CONSTRAINT "missing_person_reports_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "official_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
