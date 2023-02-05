import express from "express";

import { scheduler } from "schedules";

import apis from "./apis";

const app = express();

const PORT = 8080;

app.get("/", (req, res) => {
  const info = {
    usecase: {
      "put webhooks": `https://<domain>/apis/webhooks?webhookurl=<webhookurl>&keyword=<key@when@site>`,
      "delete webhook": `https://<domain>/apis/webhooks/delete?webhookurl=<webhookurl>`,
      "get titles": `https://<domain>/apis/titles`,
    },
  };
  res.json(info);
});
app.use("/apis", apis);

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
  scheduler();
});
