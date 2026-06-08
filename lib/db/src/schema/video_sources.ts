import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const videoSourcesTable = pgTable("video_sources", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  role: text("role").notNull().default("primary"),
  fps: real("fps"),
  totalFrames: integer("total_frames"),
  durationMs: integer("duration_ms"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVideoSourceSchema = createInsertSchema(videoSourcesTable).omit({ id: true, createdAt: true });
export type InsertVideoSource = z.infer<typeof insertVideoSourceSchema>;
export type VideoSource = typeof videoSourcesTable.$inferSelect;
