import { scheduleJob, gracefulShutdown } from "node-schedule";

import { rssSchedule } from "./rss";

export const scheduler = () => {
  // Initial Call
  rssSchedule();

  // Call every 3 hours
  scheduleJob("0 3,6,9,12,15,18,21,0 * * * ?", () => {
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
