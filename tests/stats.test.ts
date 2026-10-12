import assert from "node:assert/strict";
import test from "node:test";
import { clock, summarize } from "../lib/stats.ts";

test("summarize counts attempts, successes, and misses", () => {
  const stats = summarize([
    { action: "simple attack", result: "success" },
    { action: "simple attack", result: "failed" },
    { action: "simple attack", result: "neither" },
    { action: "counterattack", result: "success" },
  ]);
  const simple = stats.find((row) => row.action === "simple attack");
  assert.ok(simple);
  assert.equal(simple.attempts, 3);
  assert.equal(simple.successful, 1);
  assert.equal(simple.failed, 1);
  assert.equal(simple.neither, 1);
  assert.equal(simple.successRate, 1 / 3);
  const counter = stats.find((row) => row.action === "counterattack");
  assert.equal(counter?.successful, 1);
  assert.equal(stats.length, 9);
});

test("clock formats an exchange time", () => {
  assert.equal(clock(42), "0:42");
  assert.equal(clock(65), "1:05");
});
