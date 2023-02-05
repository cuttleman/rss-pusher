import { Router } from "express";
import { constants } from "http2";

import { feedPathDir } from "utils/constant";
import { getDir, getFile, makeDir } from "utils/makeFs";

const router = Router();

router.get("/", async (req, res) => {
  try {
    await makeDir(feedPathDir);
    const files = await getDir(feedPathDir);

    const data = [];
    for (const file of files) {
      const buffer = await getFile(feedPathDir, file);
      data.push(JSON.parse(buffer.toString()));
    }

    res.status(constants.HTTP_STATUS_OK).json(data);
  } catch (error) {
    console.log("#FileSystem Error:", error);
    res
      .status(constants.HTTP_STATUS_INTERNAL_SERVER_ERROR)
      .send("Internal Server Error");
  }
});

export default router;
