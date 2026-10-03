export type Provider = "openai" | "anthropic" | "google" | (string & {});
export interface ModelPrice {
  provider: Provider;
  model: string;
  currency: "USD" | string;
  perTokens: number;
  input: number;
  output: number;
  cachedInput?: number;
  cacheWrite?: number;
  tier?: string;
  sourceUrl: string;
  fetchedAt: string;
  effectiveFrom?: string;
  metadata?: Record<string, unknown>;
}
export interface PriceStore {
  get(provider: string, model: string): Promise<ModelPrice | undefined>;
  setMany(prices: ModelPrice[]): Promise<void>;
  all(): Promise<ModelPrice[]>;
}
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
}
export interface CallCost {
  provider: string;
  model: string;
  usage: TokenUsage;
  inputCost: number;
  outputCost: number;
  cachedInputCost: number;
  cacheWriteCost: number;
  totalCost: number;
  currency: string;
  pricing: ModelPrice;
}
export interface RunCost {
  calls: CallCost[];
  totals: {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    totalCost: number;
    currency: string;
  };
}
