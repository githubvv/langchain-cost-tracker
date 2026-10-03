import assert from "node:assert/strict";
import test from "node:test";
import { LangChainCostTracker, MemoryPriceStore } from "../dist/index.js";

const prices = [
  {
    provider: "openai",
    model: "gpt-4o-mini",
    currency: "USD",
    perTokens: 1_000_000,
    input: 2,
    output: 10,
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
  {
    provider: "google",
    model: "gemini-2.5-flash",
    currency: "USD",
    perTokens: 1_000_000,
    input: 0.5,
    output: 1.5,
    sourceUrl: "test",
    fetchedAt: "2026-01-01T00:00:00.000Z",
  },
];

test("getRunCost calculates calls and totals across inferred providers", async () => {
  const store = new MemoryPriceStore();
  await store.setMany(prices);
  const tracker = new LangChainCostTracker(store);
  const callback = tracker.callback();

  await callback.handleLLMEnd({
    generations: prices.map(({ model }) => [
      {
        message: {
          usage_metadata: { input_tokens: 100, output_tokens: 50 },
          response_metadata: { model_name: model },
        },
      },
    ]),
  });

  const result = tracker.getRunCost();
  assert.deepEqual(
    result.calls.map(({ provider, model }) => ({ provider, model })),
    [
      { provider: "openai", model: "gpt-4o-mini" },
      { provider: "anthropic", model: "claude-3-5-sonnet" },
      { provider: "google", model: "gemini-2.5-flash" },
    ],
  );
  const expectedCallCosts = [0.0007, 0.00105, 0.000125];
  for (const [index, expected] of expectedCallCosts.entries())
    assert.ok(Math.abs(result.calls[index].totalCost - expected) < 1e-12);
  assert.deepEqual(result.totals, {
    calls: 3,
    inputTokens: 300,
    outputTokens: 150,
    totalTokens: 450,
    totalCost: result.totals.totalCost,
    currency: "USD",
  });
  assert.ok(Math.abs(result.totals.totalCost - 0.001875) < 1e-12);
});

test("getRunCost returns empty totals and reset clears recorded calls", async () => {
  const store = new MemoryPriceStore();
  await store.setMany([prices[0]]);
  const tracker = new LangChainCostTracker(store);
  await tracker.callback().handleLLMEnd({
    generations: [
      [
        {
          message: {
            usage_metadata: { input_tokens: 10, output_tokens: 5 },
            response_metadata: { model_name: prices[0].model },
          },
        },
      ],
    ],
  });

  tracker.reset();
  assert.deepEqual(tracker.getRunCost(), {
    calls: [],
    totals: {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      totalCost: 0,
      currency: "USD",
    },
  });
});
