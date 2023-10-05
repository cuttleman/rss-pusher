import { scheduleJob, gracefulShutdown } from "node-schedule";

import { rssSchedule } from "./rss";

export const scheduler = () => {
  // Initial Call
  rssSchedule();

  // Call every 30 minutes
  scheduleJob("*/30 * * * *", () => {
    rssSchedule();
  });

  // Graceful Shutdown
  process.on("SIGINT", function () {
    gracefulShutdown().then(() => {
      console.log("succeed graceful shutdown 😎");
      process.exit(0);
    });
  });
};
