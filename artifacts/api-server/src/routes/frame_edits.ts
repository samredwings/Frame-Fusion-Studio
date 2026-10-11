import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, frameEditsTable, videoSourcesTable } from "@workspace/db";
import {
  ListFrameEditsParams,
  CreateFrameEditParams,
  CreateFrameEditBody,
  DeleteFrameEditParams,
} from "@workspace/api-zod";
import {
  InvalidObjectPathError,
  ObjectNotFoundError,
  ObjectStorageService,
} from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

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
  const [source] = await db
    .select({ id: videoSourcesTable.id })
    .from(videoSourcesTable)
    .where(and(
      eq(videoSourcesTable.id, parsed.data.sourceId),
      eq(videoSourcesTable.projectId, params.data.id),
    ))
    .limit(1);
  if (!source) {
    res.status(400).json({ error: "Source does not belong to this project" });
    return;
  }

  let replacementObjectPath: string | undefined;
  if (parsed.data.replacementObjectPath) {
    try {
      replacementObjectPath = objectStorageService.normalizePrivateObjectEntityPath(
        parsed.data.replacementObjectPath,
      );
      await objectStorageService.getObjectEntityFile(replacementObjectPath);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(400).json({ error: "Replacement image was not found in storage" });
        return;
      }
      if (error instanceof InvalidObjectPathError) {
        res.status(400).json({ error: "Replacement image path is invalid" });
        return;
      }
      req.log.error({ err: error }, "Failed to verify frame replacement object");
      res.status(503).json({ error: "Could not verify the replacement image. Retry the save." });
      return;
    }
  }

  const [edit] = await db
    .insert(frameEditsTable)
    .values({ ...parsed.data, replacementObjectPath, projectId: params.data.id })
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
  const [edit] = await db
    .select()
    .from(frameEditsTable)
    .where(and(
      eq(frameEditsTable.id, params.data.editId),
      eq(frameEditsTable.projectId, params.data.id),
    ))
    .limit(1);
  if (!edit) {
    res.status(404).json({ error: "Frame edit not found" });
    return;
  }

  if (edit.replacementObjectPath) {
    try {
      await objectStorageService.deleteObjectEntity(edit.replacementObjectPath);
    } catch (error) {
      req.log.error({ err: error, editId: edit.id }, "Failed to delete frame replacement object");
      res.status(503).json({ error: "The replacement image could not be removed. Retry the delete." });
      return;
    }
  }

  await db
    .delete(frameEditsTable)
    .where(and(eq(frameEditsTable.id, params.data.editId), eq(frameEditsTable.projectId, params.data.id)));
  res.sendStatus(204);
});

export default router;
