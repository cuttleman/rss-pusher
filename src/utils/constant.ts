import path from "path";

export const staticPathDir = path.join(process.cwd(), "static");

export const feedPathDir = path.join(process.cwd(), "feeds");

export const webhookPathDir = path.join(process.cwd(), "webhooks");

export const CACHED_HASH_FILENAME = "cache.json";

export const scrapFeedConfig = {
  when: "1h",
  limit: 5,
};

export const delayTimeMs = {
  send: 10000,
  scrap: 2000,
};

export const storedFeedTTL = 7200000; // 2시간
