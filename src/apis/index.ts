import { Router } from "express";

import titleRouter from "./titles";
import webhookRouter from "./webhooks";

const router = Router();

router.use("/webhooks", webhookRouter);
router.use("/titles", titleRouter);

export default router;
