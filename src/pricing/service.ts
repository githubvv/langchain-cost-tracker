import type { ModelPrice, PriceStore } from "../types.js";
import { defaultSources, type PriceSource } from "./providers/sources.js";
export class PricingService {
  private timer?: NodeJS.Timeout;
  constructor(
    public store: PriceStore,
    private sources: PriceSource[] = defaultSources,
  ) {}
  async refresh() {
    const results = await Promise.allSettled(
      this.sources.map(async (s) => ({ s, prices: await s.fetch() })),
    );
    const updated: ModelPrice[] = [];
    const errors: Record<string, string> = {};
    for (const r of results) {
      if (r.status === "fulfilled") {
        await this.store.setMany(r.value.prices);
        updated.push(...r.value.prices);
      } else errors.unknown = String(r.reason);
    }
    return { updated: updated.length, errors };
  }
  start(intervalMs = 86_400_000, { refreshImmediately = true } = {}) {
    if (this.timer) return;
    if (refreshImmediately) this.refresh().catch(() => {});
    this.timer = setInterval(() => this.refresh().catch(() => {}), intervalMs);
    this.timer.unref?.();
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
