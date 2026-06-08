import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, frameEditsTable } from "@workspace/db";
import {
  ListFrameEditsParams,
  CreateFrameEditParams,
  CreateFrameEditBody,
  DeleteFrameEditParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/projects/:id/frame-edits", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ListFrameEditsParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const edits = await db
    .select()
    .from(frameEditsTable)
    .where(eq(frameEditsTable.projectId, params.data.id))
    .orderBy(frameEditsTable.frameIndex);
  res.json(edits);
});

router.post("/projects/:id/frame-edits", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = CreateFrameEditParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateFrameEditBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [edit] = await db
    .insert(frameEditsTable)
    .values({ ...parsed.data, projectId: params.data.id })
    .returning();
  res.status(201).json(edit);
});

router.delete("/projects/:id/frame-edits/:editId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawEid = Array.isArray(req.params.editId) ? req.params.editId[0] : req.params.editId;
  const params = DeleteFrameEditParams.safeParse({ id: parseInt(rawId, 10), editId: parseInt(rawEid, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .delete(frameEditsTable)
    .where(and(eq(frameEditsTable.id, params.data.editId), eq(frameEditsTable.projectId, params.data.id)));
  res.sendStatus(204);
});

export default router;
