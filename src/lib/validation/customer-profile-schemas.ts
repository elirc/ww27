/*
 * What this file does:
 * Holds the version-aware Zod schemas for request validation at the API boundary.
 * What calls it:
 * src/app/api/platform/customer-profiles/route.ts and src/app/api/platform/customer-profiles/[profileId]/route.ts.
 * What it calls:
 * zod only; it is intentionally isolated from services.
 * One thing a junior engineer would likely get wrong:
 * Reusing one schema for every version and silently accepting fields older clients should never send.
 */

import { z } from "zod";

import type { ApiVersionId } from "@/types/domain";

export const lifecycleStateSchema = z.enum(["TRIAL", "ACTIVE", "SUSPENDED", "ARCHIVED"]);

const createProfileV1Schema = z.object({
  externalReference: z.string().min(3).max(50),
  fullName: z.string().min(3).max(120),
  email: z.string().email(),
  status: z.enum(["active", "inactive"])
}).strict();

const updateProfileV1Schema = createProfileV1Schema.partial().strict();

const createProfileV2Schema = z.object({
  externalReference: z.string().min(3).max(50),
  name: z.object({
    givenName: z.string().min(2).max(60),
    familyName: z.string().min(2).max(60)
  }).strict(),
  email: z.string().email(),
  lifecycleState: lifecycleStateSchema,
  marketingOptIn: z.boolean()
}).strict();

const updateProfileV2Schema = createProfileV2Schema.partial().strict();

export const listProfilesQuerySchema = z.object({
  email: z.string().email().optional(),
  lifecycleState: lifecycleStateSchema.optional()
});

export const rolloutUpdateSchema = z.object({
  percentage: z.number().int().min(0).max(100),
  allowlistClientIds: z.array(z.string().min(1)).max(20)
}).strict();

// ⚠️ SENIOR NOTE: Strict schemas are important in versioned APIs because "ignored extra fields" can hide breaking changes during migrations.

export function getCreateProfileSchema(version: ApiVersionId) {
  return version === "v1" ? createProfileV1Schema : createProfileV2Schema;
}

export function getUpdateProfileSchema(version: ApiVersionId) {
  return version === "v1" ? updateProfileV1Schema : updateProfileV2Schema;
}
