import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, blurRegionsTable } from "@workspace/db";
import {
  ListBlurRegionsParams,
  CreateBlurRegionParams,
  CreateBlurRegionBody,
  UpdateBlurRegionParams,
  UpdateBlurRegionBody,
  DeleteBlurRegionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/projects/:id/blur-regions", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ListBlurRegionsParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const regions = await db
    .select()
    .from(blurRegionsTable)
    .where(eq(blurRegionsTable.projectId, params.data.id))
    .orderBy(blurRegionsTable.createdAt);
  res.json(regions);
});

router.post("/projects/:id/blur-regions", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = CreateBlurRegionParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateBlurRegionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [region] = await db
    .insert(blurRegionsTable)
    .values({ ...parsed.data, projectId: params.data.id })
    .returning();
  res.status(201).json(region);
});

router.patch("/projects/:id/blur-regions/:regionId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawRid = Array.isArray(req.params.regionId) ? req.params.regionId[0] : req.params.regionId;
  const params = UpdateBlurRegionParams.safeParse({ id: parseInt(rawId, 10), regionId: parseInt(rawRid, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBlurRegionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [region] = await db
    .update(blurRegionsTable)
    .set(parsed.data)
    .where(and(eq(blurRegionsTable.id, params.data.regionId), eq(blurRegionsTable.projectId, params.data.id)))
    .returning();
  if (!region) {
    res.status(404).json({ error: "Blur region not found" });
    return;
  }
  res.json(region);
});

router.delete("/projects/:id/blur-regions/:regionId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawRid = Array.isArray(req.params.regionId) ? req.params.regionId[0] : req.params.regionId;
  const params = DeleteBlurRegionParams.safeParse({ id: parseInt(rawId, 10), regionId: parseInt(rawRid, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .delete(blurRegionsTable)
    .where(and(eq(blurRegionsTable.id, params.data.regionId), eq(blurRegionsTable.projectId, params.data.id)));
  res.sendStatus(204);
});

export default router;
