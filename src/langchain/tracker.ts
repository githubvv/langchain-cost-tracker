import { calculateCost } from "../cost.js";
import type { CallCost, PriceStore, RunCost, TokenUsage } from "../types.js";
type AnyRecord = Record<string, any>;
function usageFrom(x: AnyRecord): TokenUsage | undefined {
  const u = x?.usage_metadata ?? x?.usageMetadata;
  if (!u) return;
  const input = u.input_tokens ?? u.promptTokenCount ?? 0,
    output = u.output_tokens ?? u.candidatesTokenCount ?? 0,
    total = u.total_tokens ?? u.totalTokenCount ?? input + output;
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: total,
    cachedInputTokens:
      u.input_token_details?.cache_read ?? u.cachedContentTokenCount,
    cacheWriteTokens: u.input_token_details?.cache_creation,
    reasoningTokens: u.output_token_details?.reasoning ?? u.thoughtsTokenCount,
  };
}
export class LangChainCostTracker {
  private calls: CallCost[] = [];
  constructor(
    private store: PriceStore,
    private resolveModel?: (
      message: AnyRecord,
      output: AnyRecord,
    ) => { provider: string; model: string } | undefined,
  ) {}
  callback() {
    return {
      handleLLMEnd: async (output: AnyRecord) => {
        for (const gs of output?.generations ?? [])
          for (const g of gs ?? []) {
            const msg = g?.message ?? g;
            const u = usageFrom(msg);
            if (!u) continue;
            const resolved =
              this.resolveModel?.(msg, output) ?? infer(msg, output);
            if (!resolved) continue;
            try {
              this.calls.push(
                await calculateCost(
                  this.store,
                  resolved.provider,
                  resolved.model,
                  u,
                ),
              );
            } catch {}
          }
      },
    };
  }
  getRunCost(): RunCost {
    const currency = this.calls[0]?.currency ?? "USD";
    return {
      calls: [...this.calls],
      totals: {
        calls: this.calls.length,
        inputTokens: this.calls.reduce((a, c) => a + c.usage.inputTokens, 0),
        outputTokens: this.calls.reduce((a, c) => a + c.usage.outputTokens, 0),
        totalTokens: this.calls.reduce((a, c) => a + c.usage.totalTokens, 0),
        totalCost: this.calls.reduce((a, c) => a + c.totalCost, 0),
        currency,
      },
    };
  }
  reset() {
    this.calls = [];
  }
}
function infer(m: AnyRecord, o: AnyRecord) {
  const model =
    m?.response_metadata?.model_name ??
    m?.response_metadata?.model ??
    o?.llmOutput?.modelName ??
    o?.llmOutput?.model;
  const p = String(
    m?.response_metadata?.provider ?? o?.llmOutput?.provider ?? "",
  ).toLowerCase();
  if (!model) return;
  const provider =
    p ||
    (/^gpt-|^o\d/.test(model)
      ? "openai"
      : /^claude-/.test(model)
        ? "anthropic"
        : /^gemini-/.test(model)
          ? "google"
          : undefined);
  return provider ? { provider, model } : undefined;
}
