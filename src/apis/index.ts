import { Router } from "express";

import actionRouter from "./actions";
import titleRouter from "./titles";
import webhookRouter from "./webhooks";

const router = Router();

router.use("/webhooks", webhookRouter);
router.use("/titles", titleRouter);
router.use("/actions", actionRouter);

export default router;
