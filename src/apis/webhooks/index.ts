import { Router } from "express";
import { constants } from "http2";

import { webhookPathDir } from "utils/constant";
import { deleteFile, getFile, makeDir, makeFile } from "utils/makeFs";
import makeHash from "utils/makeHash";

import { cacheHashFile } from "./webhook.service";

const router = Router();

router.get("/", async (req, res) => {
  // keyword: key@lang
  const query = req.query as {
    webhookurl: string;
    keyword: string;
  };

  const filename = makeHash(query.webhookurl);
  const data = JSON.stringify({
    id: filename,
    webhookurl: query.webhookurl,
    keywords: query?.keyword?.split(","),
  });

  try {
    await makeDir(webhookPathDir);
    await makeFile(webhookPathDir, `${filename}.json`, data);

    await cacheHashFile(filename, "store");

    const file = await getFile(webhookPathDir, `${filename}.json`);

    res.status(constants.HTTP_STATUS_OK).json(JSON.parse(file.toString()));
  } catch (error) {
    console.log("#FileSystem Error:", error);
    res
      .status(constants.HTTP_STATUS_INTERNAL_SERVER_ERROR)
      .send("Internal Server Error");
  }
});

router.get("/delete", async (req, res) => {
  const query = req.query as { webhookurl: string };

  const filename = makeHash(query.webhookurl);

  try {
    await makeDir(webhookPathDir);
    await deleteFile(webhookPathDir, `${filename}.json`);

    await cacheHashFile(filename, "unstore");

    res
      .status(constants.HTTP_STATUS_OK)
      .send(`${query.webhookurl} is unsubscription`);
  } catch (error) {
    console.log("#FileSystem Error:", error);
    res
      .status(constants.HTTP_STATUS_INTERNAL_SERVER_ERROR)
      .send("Internal Server Error");
  }
});

export default router;
