import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  CreateProjectExportBody,
  CreateProjectExportParams,
  DeleteProjectExportParams,
  ListProjectExportsParams,
} from "@workspace/api-zod";
import { db, projectExportsTable, videoSourcesTable } from "@workspace/db";
import {
  InvalidObjectPathError,
  ObjectNotFoundError,
  ObjectStorageService,
} from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

router.get("/projects/:id/exports", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ListProjectExportsParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const exports = await db
    .select()
    .from(projectExportsTable)
    .where(eq(projectExportsTable.projectId, params.data.id))
    .orderBy(desc(projectExportsTable.createdAt), desc(projectExportsTable.id));
  res.json(exports);
});

router.post("/projects/:id/exports", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = CreateProjectExportParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateProjectExportBody.safeParse(req.body);
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

  let objectPath: string;
  try {
    objectPath = objectStorageService.normalizePrivateObjectEntityPath(parsed.data.objectPath);
    await objectStorageService.getObjectEntityFile(objectPath);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(400).json({ error: "Export file was not found in storage" });
      return;
    }
    if (error instanceof InvalidObjectPathError) {
      res.status(400).json({ error: "Export file path is invalid" });
      return;
    }
    req.log.error({ err: error }, "Failed to verify export object");
    res.status(503).json({ error: "Could not verify the export file. Retry saving it." });
    return;
  }

  const [projectExport] = await db
    .insert(projectExportsTable)
    .values({ ...parsed.data, objectPath, projectId: params.data.id })
    .returning();
  res.status(201).json(projectExport);
});

router.delete("/projects/:id/exports/:exportId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rawExportId = Array.isArray(req.params.exportId) ? req.params.exportId[0] : req.params.exportId;
  const params = DeleteProjectExportParams.safeParse({
    id: parseInt(rawId, 10),
    exportId: parseInt(rawExportId, 10),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [projectExport] = await db
    .select()
    .from(projectExportsTable)
    .where(and(
      eq(projectExportsTable.id, params.data.exportId),
      eq(projectExportsTable.projectId, params.data.id),
    ))
    .limit(1);
  if (!projectExport) {
    res.status(404).json({ error: "Export not found" });
    return;
  }

  try {
    await objectStorageService.deleteObjectEntity(projectExport.objectPath);
  } catch (error) {
    req.log.error({ err: error, exportId: projectExport.id }, "Failed to delete export object");
    res.status(503).json({ error: "The export file could not be removed. Retry the delete." });
    return;
  }

  await db
    .delete(projectExportsTable)
    .where(and(
      eq(projectExportsTable.id, params.data.exportId),
      eq(projectExportsTable.projectId, params.data.id),
    ));
  res.sendStatus(204);
});

export default router;
