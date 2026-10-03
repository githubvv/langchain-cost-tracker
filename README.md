# langchain-cost-tracker

Runtime cost observability for LangChain.js. It reads provider-reported usage from completed LLM calls, looks up cached model prices, calculates per-call cost, and aggregates an entire agent run.

## Features

- OpenAI, Anthropic and Gemini pricing sources
- Daily pricing refresh by default
- In-process memory storage by default
- Optional Redis-compatible storage
- Per-LLM-call and whole-agent-run totals
- Uses LangChain `usage_metadata`; does not tokenize prompts itself
- Does not mutate LangChain responses
- Failed pricing refreshes keep the last successfully cached prices

## Install

```bash
npm install langchain-cost-tracker @langchain/core
```

Redis is optional. Install your preferred Redis client only when needed.

## Local memory (default)

```ts
import {
  MemoryPriceStore,
  PricingService,
  LangChainCostTracker,
} from "langchain-cost-tracker";

const store = new MemoryPriceStore();
const pricing = new PricingService(store);

// Fetch now, then every 24 hours.
pricing.start();

const tracker = new LangChainCostTracker(store);

const result = await agent.invoke(
  { messages },
  { callbacks: [tracker.callback()] },
);

console.log(tracker.getRunCost());
tracker.reset();
```

For deterministic startup, call `await pricing.refresh()` before accepting traffic.

## Redis

`RedisPriceStore` accepts a small Redis-like interface, so the package is not tied to one Redis library.

```ts
import Redis from "ioredis";
import {
  RedisPriceStore,
  PricingService,
  LangChainCostTracker,
} from "langchain-cost-tracker";

const redis = new Redis(process.env.REDIS_URL!);
const store = new RedisPriceStore(redis);
const pricing = new PricingService(store);

await pricing.refresh();
pricing.start(24 * 60 * 60 * 1000, { refreshImmediately: false });

const tracker = new LangChainCostTracker(store);
```

## Agent-run result

```ts
{
  calls: [
    {
      provider: "openai",
      model: "...",
      usage: {
        inputTokens: 4200,
        outputTokens: 300,
        totalTokens: 4500
      },
      totalCost: 0.0123,
      currency: "USD"
    }
  ],
  totals: {
    calls: 1,
    inputTokens: 4200,
    outputTokens: 300,
    totalTokens: 4500,
    totalCost: 0.0123,
    currency: "USD"
  }
}
```

## Model resolution

LangChain/provider integrations do not always expose model/provider metadata in exactly the same place. The tracker has basic inference and also accepts an explicit resolver:

```ts
const tracker = new LangChainCostTracker(store, (message, output) => ({
  provider: "openai",
  model: message.response_metadata.model_name,
}));
```

Use an explicit resolver if your integration wraps or renames model metadata.

## Pricing refresh

The built-in sources fetch official pricing pages for:

- OpenAI
- Google Gemini
- Anthropic Claude

Provider pricing pages are HTML and can change without notice. A parser failure does not erase previously cached pricing. For production, monitor refresh failures and consider pinning/overriding prices for billing-critical workflows.

The default interval is `86_400_000` ms (24 hours):

```ts
pricing.start();
```

Custom interval:

```ts
pricing.start(6 * 60 * 60 * 1000); // every 6 hours
```

Manual refresh:

```ts
const report = await pricing.refresh();
```

## Important billing note

Token counts come from provider-reported LangChain usage metadata. The calculated dollar amount uses this package's cached public pricing. It should be treated as calculated/observability cost, not as a replacement for a provider invoice. Contract pricing, service tiers, long-context thresholds, batch/flex modes, tools, modalities and other billing rules can differ.
