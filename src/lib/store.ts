import "server-only";
import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import seed from "@/data/seed-questions.json";
import type { Question } from "./types";

const HASH = "sl:questions";
const SEED_VERSION = "sl:seedVersion";
const DELETED = "sl:deleted";

const seedList = seed as Question[];
// Changes whenever questions are added to the seed file, so new defaults get
// merged into an existing database without touching edited or deleted ones.
const seedVersion = `v2-${createHash("sha1")
  .update(seedList.map((q) => `${q.id}:${q.category}`).join(","))
  .digest("hex")}`;

// Entries saved before categories existed count as Süper Lig questions.
function normalizeQuestion(q: Question): Question {
  return { ...q, category: q.category === "general" ? "general" : "superlig" };
}

export type StoreKind = "redis" | "memory";

// Vercel's Upstash integration names the variables after the chosen prefix
// (KV_REST_API_URL by default, e.g. STORAGE_KV_REST_API_URL otherwise).
function envPair(): { url: string; token: string } | null {
  const env = process.env;
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    return { url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN };
  }
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return { url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN };
  }
  for (const key of Object.keys(env)) {
    if (!key.endsWith("_REST_API_URL")) continue;
    const token = env[key.replace(/_URL$/, "_TOKEN")];
    if (env[key] && token) return { url: env[key]!, token };
  }
  return null;
}

let client: Redis | null | undefined;
export function redisClient(): Redis | null {
  if (client !== undefined) return client;
  const pair = envPair();
  client = pair ? new Redis(pair) : null;
  return client;
}

const redis = redisClient();
export const storeKind: StoreKind = redis ? "redis" : "memory";

// Without Redis (local dev) questions live in memory and reset on restart.
const g = globalThis as unknown as { __ppMemory?: Map<string, Question> };
function memory(): Map<string, Question> {
  if (!g.__ppMemory) {
    g.__ppMemory = new Map(seedList.map((q) => [q.id, q]));
  }
  return g.__ppMemory;
}

async function ensureSeeded(r: Redis) {
  if (String(await r.get(SEED_VERSION)) === seedVersion) return;
  const [ids, deleted] = await Promise.all([r.hkeys(HASH), r.smembers(DELETED)]);
  const skip = new Set([...ids, ...deleted]);
  const missing = seedList.filter((q) => !skip.has(q.id));
  if (missing.length) await r.hset(HASH, Object.fromEntries(missing.map((q) => [q.id, q])));
  // Tag default questions stored before categories were introduced.
  const untagged = seedList.filter((q) => q.category === "general" && ids.includes(q.id));
  if (untagged.length) {
    const current = await r.hmget<Record<string, Question | null>>(HASH, ...untagged.map((q) => q.id));
    const patch = Object.fromEntries(
      Object.entries(current ?? {})
        .filter(([, q]) => q && !q.category)
        .map(([id, q]) => [id, { ...q!, category: "general" as const }]),
    );
    if (Object.keys(patch).length) await r.hset(HASH, patch);
  }
  await r.set(SEED_VERSION, seedVersion);
}

function sortQuestions(list: Question[]) {
  return list.sort((a, b) => a.letter.localeCompare(b.letter) || a.id.localeCompare(b.id));
}

export async function listQuestions(): Promise<Question[]> {
  if (!redis) return sortQuestions([...memory().values()].map(normalizeQuestion));
  await ensureSeeded(redis);
  const all = await redis.hgetall<Record<string, Question>>(HASH);
  return sortQuestions(Object.values(all ?? {}).map(normalizeQuestion));
}

export async function saveQuestion(q: Question): Promise<void> {
  if (!redis) {
    memory().set(q.id, q);
    return;
  }
  await ensureSeeded(redis);
  await redis.hset(HASH, { [q.id]: q });
}

export async function deleteQuestion(id: string): Promise<void> {
  if (!redis) {
    memory().delete(id);
    return;
  }
  await redis.hdel(HASH, id);
  // Remember deleted default questions so a seed update does not restore them.
  await redis.sadd(DELETED, id);
}

export async function replaceAll(list: Question[]): Promise<void> {
  if (!redis) {
    g.__ppMemory = new Map(list.map((q) => [q.id, q]));
    return;
  }
  const kept = new Set(list.map((q) => q.id));
  const dropped = seedList.filter((q) => !kept.has(q.id)).map((q) => q.id);
  const tx = redis.multi();
  tx.del(HASH);
  tx.del(DELETED);
  if (list.length) tx.hset(HASH, Object.fromEntries(list.map((q) => [q.id, q])));
  if (dropped.length) tx.sadd(DELETED, dropped[0], ...dropped.slice(1));
  tx.set(SEED_VERSION, seedVersion);
  await tx.exec();
}

export function defaultQuestions(): Question[] {
  return seedList;
}
