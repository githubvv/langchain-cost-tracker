import type { ModelPrice, PriceStore } from "../types.js";
export interface RedisLike {
  get(k: string): Promise<string | null>;
  set(k: string, v: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
}
export class RedisPriceStore implements PriceStore {
  constructor(
    private redis: RedisLike,
    private prefix = "llm-cost:price:",
  ) {}
  private k(p: string, m: string) {
    return `${this.prefix}${p}:${m}`;
  }
  async get(p: string, m: string) {
    const v = await this.redis.get(this.k(p, m));
    return v ? JSON.parse(v) : undefined;
  }
  async setMany(xs: ModelPrice[]) {
    await Promise.all(
      xs.map((x) =>
        this.redis.set(this.k(x.provider, x.model), JSON.stringify(x)),
      ),
    );
  }
  async all() {
    const ks = await this.redis.keys(`${this.prefix}*`);
    const vs = await Promise.all(ks.map((k) => this.redis.get(k)));
    return vs.filter(Boolean).map((v) => JSON.parse(v!));
  }
}
