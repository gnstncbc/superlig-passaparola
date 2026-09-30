import { beforeEach, describe, expect, it, vi } from "vitest";
import seed from "@/data/seed-questions.json";

// Minimal in-memory stand-in for the Upstash client (keyed like Redis).
const store_ = { kv: new Map<string, unknown>(), hashes: new Map<string, Map<string, unknown>>(), sets: new Map<string, Set<string>>() };
const h = (k: string) => store_.hashes.get(k) ?? store_.hashes.set(k, new Map()).get(k)!;
const st = (k: string) => store_.sets.get(k) ?? store_.sets.set(k, new Set()).get(k)!;
// Shortcuts used by the tests below.
const db = {
  kv: store_.kv,
  get hash() { return h("sl:questions"); },
  get set() { return st("sl:deleted"); },
};
class FakeRedis {
  async get(k: string) { return store_.kv.get(k) ?? null; }
  async set(k: string, v: unknown, opts?: { nx?: boolean }) {
    if (opts?.nx && store_.kv.has(k)) return null;
    store_.kv.set(k, v);
    return "OK";
  }
  async hkeys(k: string) { return [...h(k).keys()]; }
  async hgetall(k: string) { return h(k).size ? Object.fromEntries(h(k)) : null; }
  async hset(k: string, obj: Record<string, unknown>) { for (const [f, v] of Object.entries(obj)) h(k).set(f, v); return 1; }
  async hmget(k: string, ...f: string[]) { return Object.fromEntries(f.map((x) => [x, h(k).get(x) ?? null])); }
  async hdel(k: string, ...f: string[]) { f.forEach((x) => h(k).delete(x)); return f.length; }
  async smembers(k: string) { return [...st(k)]; }
  async sadd(k: string, ...m: string[]) { m.forEach((x) => st(k).add(x)); return m.length; }
  async del(...keys: string[]) { keys.forEach((k) => { store_.kv.delete(k); store_.hashes.delete(k); store_.sets.delete(k); }); return keys.length; }
  multi() {
    const ops: (() => Promise<unknown>)[] = [];
    const tx = new Proxy({}, {
      get: (_t, name: string) => name === "exec"
        ? async () => { for (const op of ops) await op(); return []; }
        : (...args: unknown[]) => { ops.push(() => (this as any)[name](...args)); return tx; },
    });
    return tx;
  }
}
vi.mock("server-only", () => ({}));
vi.mock("@upstash/redis", () => ({ Redis: FakeRedis }));
process.env.KV_REST_API_URL = "http://fake";
process.env.KV_REST_API_TOKEN = "t";

const store = await import("@/lib/store");

describe("redis store seeding", () => {
  beforeEach(() => { store_.kv.clear(); store_.hashes.clear(); store_.sets.clear(); });

  it("seeds an empty database", async () => {
    expect((await store.listQuestions()).length).toBe(seed.length);
  });

  it("adds new seed questions to an old database without touching edits or deletions", async () => {
    // State of a database seeded by the first version (81 questions, old flag).
    const old = seed.slice(0, 81);
    old.forEach((q) => db.hash.set(q.id, q));
    db.kv.set("sl:seeded", "1");
    db.hash.set("a1", { ...seed[0], question: "EDITED" });
    db.hash.set("custom", { ...seed[0], id: "custom", question: "user added" });
    db.hash.delete(old[5].id); // removed before deletions were tracked

    const list = await store.listQuestions();
    const ids = new Set(list.map((q) => q.id));
    expect(list.find((q) => q.id === "a1")?.question).toBe("EDITED");
    expect(ids.has("custom")).toBe(true);
    for (const q of seed.slice(81)) expect(ids.has(q.id)).toBe(true);
  });

  it("tags stored general questions that predate categories", async () => {
    const general = seed.find((q) => q.category === "general")!;
    seed.forEach((q) => {
      const { category, ...rest } = q;
      db.hash.set(q.id, q.id === general.id ? { ...rest, question: "EDITED" } : q);
    });
    db.kv.set("sl:seedVersion", "v1-old");
    const found = (await store.listQuestions()).find((q) => q.id === general.id)!;
    expect(found.category).toBe("general");
    expect(found.question).toBe("EDITED");
  });

  it("does not restore deleted questions on the next seed update", async () => {
    await store.listQuestions();
    await store.deleteQuestion("b1");
    db.kv.set("sl:seedVersion", "older");
    const ids = (await store.listQuestions()).map((q) => q.id);
    expect(ids).not.toContain("b1");
  });

  it("regenerating today's daily picks different questions", async () => {
    const { getDaily, regenerateDaily } = await import("@/lib/daily");
    const qs = await store.listQuestions();
    const first = (await getDaily(qs)).questions.map((q) => q.id);
    expect((await getDaily(qs)).questions.map((q) => q.id)).toEqual(first);
    await regenerateDaily();
    const second = (await getDaily(qs)).questions.map((q) => q.id);
    expect(second).toHaveLength(26);
    expect(second.filter((id) => first.includes(id))).toEqual([]);
  });

  it("import keeps only the imported set even after a seed update", async () => {
    await store.listQuestions();
    await store.replaceAll([seed[0] as never]);
    db.kv.set("sl:seedVersion", "older");
    expect((await store.listQuestions()).map((q) => q.id)).toEqual([seed[0].id]);
  });
});
