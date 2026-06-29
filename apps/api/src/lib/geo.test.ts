// apps/api/src/lib/geo.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { roundToGrid } from "./geo";

test("redondea a rejilla de 0.001° (~110 m)", () => {
  assert.equal(roundToGrid(10.512345), 10.512);
  assert.equal(roundToGrid(-66.918765), -66.919);
});

test("es determinista: misma entrada, misma salida", () => {
  assert.equal(roundToGrid(10.512345), roundToGrid(10.512345));
});

test("nunca conserva más de 3 decimales (no expone la coordenada exacta)", () => {
  const r = roundToGrid(10.512999);
  assert.equal(Math.round(r * 1000) / 1000, r);
});
