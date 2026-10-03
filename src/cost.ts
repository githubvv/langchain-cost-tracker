import type { CallCost, PriceStore, TokenUsage } from "./types.js";
export async function calculateCost(
  store: PriceStore,
  provider: string,
  model: string,
  u: TokenUsage,
): Promise<CallCost> {
  const p = await store.get(provider, model);
  if (!p) throw new Error(`No pricing for ${provider}/${model}`);
  const cached = u.cachedInputTokens ?? 0,
    write = u.cacheWriteTokens ?? 0,
    normal = Math.max(0, u.inputTokens - cached - write);
  const inputCost = (normal / p.perTokens) * p.input,
    cachedInputCost = (cached / p.perTokens) * (p.cachedInput ?? p.input),
    cacheWriteCost = (write / p.perTokens) * (p.cacheWrite ?? p.input),
    outputCost = (u.outputTokens / p.perTokens) * p.output;
  return {
    provider,
    model,
    usage: u,
    inputCost,
    outputCost,
    cachedInputCost,
    cacheWriteCost,
    totalCost: inputCost + cachedInputCost + cacheWriteCost + outputCost,
    currency: p.currency,
    pricing: p,
  };
}
