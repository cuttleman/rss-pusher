import express, { static as _static } from "express";

import { scheduler } from "schedules";

import apis from "./apis";
import oauth from "./oauth";

const app = express();

const PORT = process.env.PORT || 8080;

app.use("/static", _static("static"));
app.use("/feeds", _static("feeds"));
app.use("/webhooks", _static("webhooks"));

// initial page
app.get("/", (req, res) => {
  const domain =
    req.protocol +
    "://" +
    (req.hostname.includes("localhost")
      ? `${req.hostname}:${PORT}`
      : req.hostname);

  const info = {
    usecase: {
      "put webhooks": `${domain}/apis/webhooks?webhookurl=<webhookurl>&keyword=[key@lang, key@lang, ...]`,
      "delete webhook": `${domain}/apis/webhooks/delete?webhookurl=<webhookurl>`,
      "get titles": `${domain}/apis/titles`,
    },
  };

  res.json(info);
});

app.use("/apis", apis);
app.use("/oauth", oauth);

app.listen(PORT, () => {
  scheduler();
  console.log("Server & Scheduler is Running 🥳");
});
