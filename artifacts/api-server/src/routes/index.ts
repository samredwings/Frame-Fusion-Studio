import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import projectsRouter from "./projects";
import sourcesRouter from "./sources";
import blurRegionsRouter from "./blur_regions";
import frameEditsRouter from "./frame_edits";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(projectsRouter);
router.use(sourcesRouter);
router.use(blurRegionsRouter);
router.use(frameEditsRouter);

export default router;
