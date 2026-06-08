import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const frameEditsTable = pgTable("frame_edits", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  frameIndex: integer("frame_index").notNull(),
  sourceId: integer("source_id"),
  editType: text("edit_type").notNull().default("replace"),
  replacementDataUrl: text("replacement_data_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFrameEditSchema = createInsertSchema(frameEditsTable).omit({ id: true, createdAt: true });
export type InsertFrameEdit = z.infer<typeof insertFrameEditSchema>;
export type FrameEdit = typeof frameEditsTable.$inferSelect;
