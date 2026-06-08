import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const blurRegionsTable = pgTable("blur_regions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  blurType: text("blur_type").notNull().default("face"),
  frameStart: integer("frame_start").notNull().default(0),
  frameEnd: integer("frame_end").notNull().default(0),
  trackingEnabled: boolean("tracking_enabled").notNull().default(true),
  masked: boolean("masked").notNull().default(false),
  regionData: text("region_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBlurRegionSchema = createInsertSchema(blurRegionsTable).omit({ id: true, createdAt: true });
export type InsertBlurRegion = z.infer<typeof insertBlurRegionSchema>;
export type BlurRegion = typeof blurRegionsTable.$inferSelect;
