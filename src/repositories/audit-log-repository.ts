/*
 * What this file does:
 * Writes a durable audit trail for operational actions such as rollout changes and profile updates.
 * What calls it:
 * src/services/customer-profile-service.ts and src/services/api-version-service.ts.
 * What it calls:
 * src/lib/db/prisma.ts.
 * One thing a junior engineer would likely get wrong:
 * Logging only the happy-path message string instead of storing enough metadata to investigate incidents.
 */

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

export interface AuditLogRepository {
  record(entry: {
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
  }): Promise<void>;
}

export class PrismaAuditLogRepository implements AuditLogRepository {
  async record(entry: {
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    // ⚠️ SENIOR NOTE: Audit logs need enough structured metadata to answer "who changed what and why" during an incident review.
    await prisma.auditLog.create({
      data: { ...entry, metadata: entry.metadata as Prisma.InputJsonObject }
    });
  }
}
