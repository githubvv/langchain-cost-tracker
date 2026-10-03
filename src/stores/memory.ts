import type { ModelPrice, PriceStore } from "../types.js";
export class MemoryPriceStore implements PriceStore {
  private m = new Map<string, ModelPrice>();
  private k(p: string, m: string) {
    return `${p}:${m}`;
  }
  async get(p: string, m: string) {
    return this.m.get(this.k(p, m));
  }
  async setMany(xs: ModelPrice[]) {
    for (const x of xs) this.m.set(this.k(x.provider, x.model), x);
  }
  async all() {
    return [...this.m.values()];
  }
}
