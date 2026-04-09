import { Router, type IRouter } from "express";
import healthRouter from "./health";
import bikeSubsidyRouter from "./bikeSubsidy";

const router: IRouter = Router();

router.use(healthRouter);
router.use(bikeSubsidyRouter);

export default router;
