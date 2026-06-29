// apps/api/src/services/trapped-persons.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { toMarkerDTO } from "./trapped-persons";
import type { CitizenReport } from "../generated/prisma";

const base = {
  id: "r1",
  reportType: "trapped_person",
  title: "Persona atrapada",
  description: "texto privado",
  state: "La Guaira",
  municipality: "Vargas",
  parish: null,
  latitude: 10.612345,
  longitude: -66.918765,
  locationPrecision: "approximate",
  urgency: "critical",
  evidenceUrl: null,
  reportSourceType: "first_hand",
  privateContact: "0414...",
  publicSafeSummary: "Atrapada en planta baja",
  verificationStatus: "pending",
  moderatorNotes: null,
  resolvedAt: null,
  createdAt: new Date("2026-06-26T12:00:00Z"),
  updatedAt: new Date("2026-06-26T12:00:00Z"),
} as unknown as CitizenReport;

test("difumina las coordenadas (no expone las exactas)", () => {
  const dto = toMarkerDTO(base);
  assert.equal(dto.approxLat, 10.61);
  assert.equal(dto.approxLng, -66.92);
});

test("no incluye campos privados ni coordenadas exactas", () => {
  const dto = toMarkerDTO(base) as unknown as Record<string, unknown>;
  assert.equal("latitude" in dto, false);
  assert.equal("longitude" in dto, false);
  assert.equal("privateContact" in dto, false);
  assert.equal("description" in dto, false);
});

test("sin coordenadas: approxLat/approxLng son null (aparece en lista, no en mapa)", () => {
  const dto = toMarkerDTO({ ...base, latitude: null, longitude: null } as unknown as CitizenReport);
  assert.equal(dto.approxLat, null);
  assert.equal(dto.approxLng, null);
});

test("resolved deriva de resolvedAt", () => {
  assert.equal(toMarkerDTO(base).resolved, false);
  assert.equal(toMarkerDTO({ ...base, resolvedAt: new Date() }).resolved, true);
});
