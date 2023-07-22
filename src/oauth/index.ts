import { Router } from "express";

import switRouter from "./swit";

const router = Router();

router.use("/swit", switRouter);

export default router;
