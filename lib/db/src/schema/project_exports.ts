import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { videoSourcesTable } from "./video_sources";

export const projectExportsTable = pgTable("project_exports", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  sourceId: integer("source_id").references(() => videoSourcesTable.id, { onDelete: "set null" }),
  filename: text("filename").notNull(),
  format: text("format").notNull(),
  objectPath: text("object_path").notNull(),
  fileSize: integer("file_size").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("project_exports_project_created_at_idx").on(table.projectId, table.createdAt),
  index("project_exports_source_id_idx").on(table.sourceId),
]);

export const insertProjectExportSchema = createInsertSchema(projectExportsTable).omit({ id: true, createdAt: true });
export type InsertProjectExport = z.infer<typeof insertProjectExportSchema>;
export type ProjectExport = typeof projectExportsTable.$inferSelect;
