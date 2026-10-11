import { pgTable, serial, integer, real, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { videoSourcesTable } from "./video_sources";

export const blurRegionsTable = pgTable("blur_regions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  sourceId: integer("source_id").references(() => videoSourcesTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  blurType: text("blur_type").notNull().default("region"),
  x: real("x").default(0),
  y: real("y").default(0),
  width: real("width").default(0),
  height: real("height").default(0),
  frameStart: integer("frame_start").notNull().default(0),
  frameEnd: integer("frame_end").notNull().default(0),
  trackingEnabled: boolean("tracking_enabled").notNull().default(true),
  masked: boolean("masked").notNull().default(false),
  regionData: text("region_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("blur_regions_source_id_idx").on(table.sourceId),
  index("blur_regions_project_created_at_idx").on(table.projectId, table.createdAt),
]);

export const insertBlurRegionSchema = createInsertSchema(blurRegionsTable).omit({ id: true, createdAt: true });
export type InsertBlurRegion = z.infer<typeof insertBlurRegionSchema>;
export type BlurRegion = typeof blurRegionsTable.$inferSelect;
