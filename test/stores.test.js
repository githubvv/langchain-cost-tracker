import assert from "node:assert/strict";
import test from "node:test";
import { MemoryPriceStore, RedisPriceStore } from "../dist/index.js";

const prices = [
  {
    provider: "openai",
    model: "gpt-4o-mini",
    currency: "USD",
    perTokens: 1_000_000,
    input: 0.15,
    output: 0.6,
    sourceUrl: "test",
    fetchedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    provider: "anthropic",
    model: "claude-3-5-sonnet",
    currency: "USD",
    perTokens: 1_000_000,
    input: 3,
    output: 15,
    sourceUrl: "test",
    fetchedAt: "2026-01-01T00:00:00.000Z",
  },
];

test("MemoryPriceStore stores, replaces, and lists prices", async () => {
  const store = new MemoryPriceStore();
  assert.equal(await store.get("openai", "gpt-4o-mini"), undefined);

  await store.setMany(prices);
  assert.deepEqual(await store.get("openai", "gpt-4o-mini"), prices[0]);
  assert.deepEqual(await store.all(), prices);

  const replacement = { ...prices[0], input: 0.2 };
  await store.setMany([replacement]);
  assert.deepEqual(await store.get("openai", "gpt-4o-mini"), replacement);
  assert.deepEqual(await store.all(), [replacement, prices[1]]);
});

test("RedisPriceStore serializes prices and reads by its configured prefix", async () => {
  const data = new Map();
  const redis = {
    async get(key) {
      return data.get(key) ?? null;
    },
    async set(key, value) {
      data.set(key, value);
    },
    async keys(pattern) {
      const prefix = pattern.slice(0, -1);
      return [...data.keys()].filter((key) => key.startsWith(prefix));
    },
  };
  const store = new RedisPriceStore(redis, "test:prices:");

  assert.equal(await store.get("openai", "gpt-4o-mini"), undefined);
  await store.setMany(prices);

  assert.equal(
    data.get("test:prices:openai:gpt-4o-mini"),
    JSON.stringify(prices[0]),
  );
  assert.deepEqual(await store.get("openai", "gpt-4o-mini"), prices[0]);
  assert.deepEqual(await store.all(), prices);
});
