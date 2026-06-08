import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, videoSourcesTable } from "@workspace/db";
import {
  ListSourcesParams,
  AddSourceParams,
  AddSourceBody,
  RemoveSourceParams,
  UpdateSourceParams,
  UpdateSourceBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/projects/:id/sources", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ListSourcesParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const sources = await db
    .select()
    .from(videoSourcesTable)
    .where(eq(videoSourcesTable.projectId, params.data.id))
    .orderBy(videoSourcesTable.createdAt);
  res.json(sources);
});

router.post("/projects/:id/sources", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AddSourceParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AddSourceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [source] = await db
    .insert(videoSourcesTable)
    .values({ ...parsed.data, projectId: params.data.id })
    .returning();
  res.status(201).json(source);
});

router.delete("/projects/:id/sources/:sourceId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawSid = Array.isArray(req.params.sourceId) ? req.params.sourceId[0] : req.params.sourceId;
  const params = RemoveSourceParams.safeParse({ id: parseInt(rawId, 10), sourceId: parseInt(rawSid, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .delete(videoSourcesTable)
    .where(and(eq(videoSourcesTable.id, params.data.sourceId), eq(videoSourcesTable.projectId, params.data.id)));
  res.sendStatus(204);
});

router.patch("/projects/:id/sources/:sourceId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawSid = Array.isArray(req.params.sourceId) ? req.params.sourceId[0] : req.params.sourceId;
  const params = UpdateSourceParams.safeParse({ id: parseInt(rawId, 10), sourceId: parseInt(rawSid, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSourceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [source] = await db
    .update(videoSourcesTable)
    .set(parsed.data)
    .where(and(eq(videoSourcesTable.id, params.data.sourceId), eq(videoSourcesTable.projectId, params.data.id)))
    .returning();
  if (!source) {
    res.status(404).json({ error: "Source not found" });
    return;
  }
  res.json(source);
});

export default router;
