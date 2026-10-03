import type { ModelPrice, Provider } from "../../types.js";
export interface PriceSource {
  provider: Provider;
  url: string;
  fetch(): Promise<ModelPrice[]>;
}
const now = () => new Date().toISOString();
async function html(url: string) {
  const r = await fetch(url, {
    headers: { "user-agent": "langchain-cost-tracker/0.1 (+pricing refresh)" },
  });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.text();
}
function rows(
  provider: Provider,
  url: string,
  text: string,
  modelPattern: RegExp,
): ModelPrice[] {
  const out: ModelPrice[] = [];
  for (const m of text.matchAll(modelPattern)) {
    const model = m[1],
      input = Number(m[2]),
      cached = m[3] ? Number(m[3]) : undefined,
      output = Number(m[4]);
    if (model && Number.isFinite(input) && Number.isFinite(output))
      out.push({
        provider,
        model,
        currency: "USD",
        perTokens: 1_000_000,
        input,
        output,
        cachedInput: cached,
        sourceUrl: url,
        fetchedAt: now(),
        tier: "standard",
      });
  }
  return out;
}
export const openAIPriceSource: PriceSource = {
  provider: "openai",
  url: "https://developers.openai.com/api/docs/pricing",
  async fetch() {
    const t = (await html(this.url))
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
    const r = rows(
      "openai",
      this.url,
      t,
      /(gpt-[\w.-]+)\s*\$([\d.]+)\s*\$([\d.]+)\s*(?:\$[\d.]+\s*)?\$([\d.]+)/g,
    );
    if (!r.length)
      throw new Error("OpenAI pricing parser found no token-priced models");
    return r;
  },
};
export const googlePriceSource: PriceSource = {
  provider: "google",
  url: "https://ai.google.dev/gemini-api/docs/pricing",
  async fetch() {
    const t = (await html(this.url))
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
    const out: ModelPrice[] = [];
    for (const m of t.matchAll(
      /(gemini-[\w.-]+)[\s\S]{0,1200}?Input price[\s\S]{0,300}?\$([\d.]+)[\s\S]{0,500}?Output price[^$]{0,200}?\$([\d.]+)/g,
    )) {
      out.push({
        provider: "google",
        model: m[1],
        currency: "USD",
        perTokens: 1_000_000,
        input: Number(m[2]),
        output: Number(m[3]),
        sourceUrl: this.url,
        fetchedAt: now(),
        tier: "standard",
      });
    }
    if (!out.length) throw new Error("Gemini pricing parser found no models");
    return out;
  },
};
export const anthropicPriceSource: PriceSource = {
  provider: "anthropic",
  url: "https://docs.anthropic.com/en/docs/about-claude/pricing",
  async fetch() {
    const t = (await html(this.url))
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
    const out: ModelPrice[] = [];
    for (const m of t.matchAll(
      /(Claude\s+(?:Opus|Sonnet|Haiku)\s+[\d.]+)[\s\S]{0,600}?\$([\d.]+)[^$]{0,200}?\$([\d.]+)/gi,
    )) {
      out.push({
        provider: "anthropic",
        model: m[1].toLowerCase().replace(/\s+/g, "-"),
        currency: "USD",
        perTokens: 1_000_000,
        input: Number(m[2]),
        output: Number(m[3]),
        sourceUrl: this.url,
        fetchedAt: now(),
        tier: "standard",
      });
    }
    if (!out.length)
      throw new Error("Anthropic pricing parser found no models");
    return out;
  },
};
export const defaultSources = [
  openAIPriceSource,
  googlePriceSource,
  anthropicPriceSource,
];
