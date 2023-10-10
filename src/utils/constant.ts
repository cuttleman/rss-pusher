import path from "path";

export const staticPathDir = path.join(process.cwd(), "static");

export const feedPathDir = path.join(process.cwd(), "feeds");

export const webhookPathDir = path.join(process.cwd(), "webhooks");

export const CACHED_HASH_FILENAME = "cache.json";

export const scrapFeedConfig = {
  when: "1h",
  limit: 1,
};

export const delayTimeMs = {
  send: 5000,
  scrap: 2000,
};

export const storedFeedTTL = 21600000; // 6시간

export const excludeTitleRegex = /[.|,\\\-:'"‘’·]/g;
