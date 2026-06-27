import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  ALERT_LEVEL,
  CAPACITY_STATUS,
  COASTAL_RISK_LEVEL,
  EVENT_TYPE,
  FETCH_STATUS,
  LOCATION_PRECISION,
  MISSING_PERSON_STATUS,
  NEED_STATUS,
  RECOMMENDATION_CONTEXT,
  REPORT_SOURCE_TYPE,
  REPORT_TYPE,
  REPORT_VERIFICATION_STATUS,
  RESOURCE_STATUS,
  RESOURCE_TYPE,
  SEISMIC_STATUS,
  SOURCE_STATUS,
  SOURCE_TYPE,
  TRUST_LEVEL,
  TSUNAMI_PROVIDER,
  TSUNAMI_STATUS,
  URGENCY,
  VERIFICATION_STATUS,
} from "@sismicaid/shared";

// Cada enum de Prisma debe cubrir EXACTAMENTE los mismos literales que su
// equivalente en @sismicaid/shared. Si alguien añade/quita un valor en un solo lado,
// este test falla y evita la deriva enum(DB) <-> enum(tipos).
// El cliente generado es CJS; lo cargamos con require para obtener los enum
// runtime sin lidiar con interop ESM de namespace.
const require = createRequire(import.meta.url);
const enums = require("./generated/prisma") as Record<string, Record<string, string>>;

const pairs: Array<[string, readonly string[]]> = [
  ["TrustLevel", TRUST_LEVEL],
  ["SourceType", SOURCE_TYPE],
  ["SourceStatus", SOURCE_STATUS],
  ["SeismicStatus", SEISMIC_STATUS],
  ["EventType", EVENT_TYPE],
  ["AlertLevel", ALERT_LEVEL],
  ["TsunamiProvider", TSUNAMI_PROVIDER],
  ["TsunamiStatus", TSUNAMI_STATUS],
  ["CoastalRiskLevel", COASTAL_RISK_LEVEL],
  ["ResourceType", RESOURCE_TYPE],
  ["ResourceStatus", RESOURCE_STATUS],
  ["CapacityStatus", CAPACITY_STATUS],
  ["LocationPrecision", LOCATION_PRECISION],
  ["VerificationStatus", VERIFICATION_STATUS],
  ["Urgency", URGENCY],
  ["NeedStatus", NEED_STATUS],
  ["ReportType", REPORT_TYPE],
  ["ReportSourceType", REPORT_SOURCE_TYPE],
  ["ReportVerificationStatus", REPORT_VERIFICATION_STATUS],
  ["RecommendationContext", RECOMMENDATION_CONTEXT],
  ["FetchStatus", FETCH_STATUS],
  ["MissingPersonStatus", MISSING_PERSON_STATUS],
];

for (const [name, shared] of pairs) {
  test(`enum ${name} paridad shared <-> prisma`, () => {
    const prismaEnum = enums[name];
    assert.ok(prismaEnum, `Prisma no exporta el enum ${name} (¿corriste prisma generate?)`);
    assert.deepEqual(Object.values(prismaEnum).sort(), [...shared].sort());
  });
}
