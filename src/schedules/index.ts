import { scheduleJob, gracefulShutdown } from "node-schedule";

import { rssSchedule } from "./rss";

export const scheduler = () => {
  console.log("scheduler start");
  // Initial Call
  rssSchedule();

  // Call every 1 minutes
  scheduleJob("*/10 * * * *", () => {
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
