import axios from "axios";

import {
  CACHED_HASH_FILENAME,
  feedPathDir,
  staticPathDir,
  webhookPathDir,
} from "../utils/constant";
import { makeDir, makeFile } from "../utils/makeFs";

const SERVICE_DOMAIN = "https://rss-pusher.fly.dev";

const fetchCache = async () => {
  await makeDir(feedPathDir);
  await makeDir(webhookPathDir);
  await makeDir(staticPathDir);

  const cachedData = await axios
    .get(`${SERVICE_DOMAIN}/static/cache.json`)
    .catch(() => null);

  if (cachedData && cachedData.data && Array.isArray(cachedData.data)) {
    await makeFile(
      staticPathDir,
      CACHED_HASH_FILENAME,
      JSON.stringify(cachedData.data)
    );

    for await (const hash of cachedData.data) {
      const feedHash = await axios
        .get(`${SERVICE_DOMAIN}/feeds/${hash}.json`)
        .catch(() => null);
      const webhookHash = await axios
        .get(`${SERVICE_DOMAIN}/webhooks/${hash}.json`)
        .catch(() => null);

      if (feedHash && feedHash.data) {
        await makeFile(
          feedPathDir,
          `${hash}.json`,
          JSON.stringify(feedHash.data)
        );
      }
      if (webhookHash && webhookHash.data) {
        await makeFile(
          webhookPathDir,
          `${hash}.json`,
          JSON.stringify(webhookHash.data)
        );
      }
    }
  }
};

fetchCache();
