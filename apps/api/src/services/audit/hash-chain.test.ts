import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalize,
  computeBlockHash,
  verifyChain,
  GENESIS_PREV_HASH,
  type ChainBlock,
} from "./hash-chain";

// ---- canonicalize ----------------------------------------------------------

test("canonicalize: sorts keys deterministically", () => {
  const a = canonicalize({ z: 1, a: 2, m: { y: 3, b: 4 } });
  const b = canonicalize({ a: 2, m: { b: 4, y: 3 }, z: 1 });
  assert.equal(a, b);
  assert.equal(a, '{"a":2,"m":{"b":4,"y":3},"z":1}');
});

test("canonicalize: omits undefined values", () => {
  assert.equal(canonicalize({ a: 1, b: undefined }), '{"a":1}');
});

test("canonicalize: serializes Dates as ISO", () => {
  const d = new Date("2026-06-26T12:00:00.000Z");
  assert.equal(canonicalize({ t: d }), '{"t":"2026-06-26T12:00:00.000Z"}');
});

test("canonicalize: handles BigInt with n suffix", () => {
  assert.equal(canonicalize({ id: 123n }), '{"id":"123n"}');
});

test("canonicalize: handles nested arrays and primitives", () => {
  const got = canonicalize({ list: [3, 1, { b: 2, a: 1 }], n: null });
  assert.equal(got, '{"list":[3,1,{"a":1,"b":2}],"n":null}');
});

// ---- computeBlockHash ------------------------------------------------------

test("computeBlockHash: rejects invalid prevHash", () => {
  assert.throws(() => computeBlockHash("not-hex", { a: 1 }));
  assert.throws(() => computeBlockHash("0".repeat(63), { a: 1 }));
  assert.throws(() => computeBlockHash("F".repeat(64), { a: 1 })); // uppercase rejected
});

test("computeBlockHash: is deterministic", () => {
  const h1 = computeBlockHash(GENESIS_PREV_HASH, { x: 1 });
  const h2 = computeBlockHash(GENESIS_PREV_HASH, { x: 1 });
  assert.equal(h1, h2);
});

test("computeBlockHash: changes with any payload change", () => {
  const h1 = computeBlockHash(GENESIS_PREV_HASH, { x: 1 });
  const h2 = computeBlockHash(GENESIS_PREV_HASH, { x: 2 });
  assert.notEqual(h1, h2);
});

test("computeBlockHash: changes with prevHash", () => {
  const h1 = computeBlockHash(GENESIS_PREV_HASH, { x: 1 });
  const h2 = computeBlockHash("a".repeat(64), { x: 1 });
  assert.notEqual(h1, h2);
});

// ---- verifyChain -----------------------------------------------------------

function buildChain(payloads: unknown[]): ChainBlock[] {
  const blocks: ChainBlock[] = [];
  let prev = GENESIS_PREV_HASH;
  for (const payload of payloads) {
    const hash = computeBlockHash(prev, payload);
    blocks.push({ prevHash: prev, hash, payload });
    prev = hash;
  }
  return blocks;
}

test("verifyChain: verifies a clean chain", () => {
  const chain = buildChain([
    { event: "report.created", id: "r1" },
    { event: "report.created", id: "r2" },
    { event: "report.verified", id: "r1" },
  ]);
  const result = verifyChain(chain);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.blocksChecked, 3);
});

test("verifyChain: detects payload tampering", () => {
  const chain = buildChain([{ a: 1 }, { a: 2 }, { a: 3 }]);
  const tampered = [...chain];
  tampered[1] = { ...tampered[1]!, payload: { a: 999 } };
  const result = verifyChain(tampered);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.brokenAt, 1);
    assert.equal(result.reason, "hash_mismatch");
  }
});

test("verifyChain: detects deletion (broken prev linkage)", () => {
  const chain = buildChain([{ a: 1 }, { a: 2 }, { a: 3 }]);
  const tampered = [chain[0]!, chain[2]!];
  const result = verifyChain(tampered);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.brokenAt, 1);
    assert.equal(result.reason, "prev_mismatch");
  }
});

test("verifyChain: detects reorder", () => {
  const chain = buildChain([{ a: 1 }, { a: 2 }, { a: 3 }]);
  const tampered = [chain[0]!, chain[2]!, chain[1]!];
  const result = verifyChain(tampered);
  assert.equal(result.ok, false);
});

test("verifyChain: accepts empty chain", () => {
  const result = verifyChain([]);
  assert.equal(result.ok, true);
});