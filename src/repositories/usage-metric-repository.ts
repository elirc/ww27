/*
 * What this file does:
 * Records per-request version usage and aggregates counts for operational visibility.
 * What calls it:
 * src/services/api-version-service.ts and route handlers after they produce responses.
 * What it calls:
 * src/lib/db/prisma.ts.
 * One thing a junior engineer would likely get wrong:
 * Logging only success paths, which hides how much deprecated traffic is failing in production.
 */

import { prisma } from "@/lib/db/prisma";
import type { ApiUsageEvent, ApiVersionId } from "@/types/domain";

export interface VersionUsageSummary {
  versionId: ApiVersionId;
  totalRequests: number;
}

export interface UsageMetricRepository {
  record(event: ApiUsageEvent): Promise<void>;
  summarizeByVersion(): Promise<VersionUsageSummary[]>;
}

export class PrismaUsageMetricRepository implements UsageMetricRepository {
  async record(event: ApiUsageEvent): Promise<void> {
    // ⚠️ SENIOR NOTE: High-cardinality telemetry fields should be reviewed carefully or logging volume can explode in production.
    await prisma.apiUsageLog.create({
      data: {
        versionId: event.versionId,
        actorUserId: event.actorUserId,
        route: event.route,
        method: event.method,
        statusCode: event.statusCode,
        deprecationFired: event.deprecationFired
      }
    });
  }

  async summarizeByVersion(): Promise<VersionUsageSummary[]> {
    const grouped = await prisma.apiUsageLog.groupBy({
      by: ["versionId"],
      _count: {
        _all: true
      }
    });

    return grouped.map((row) => ({
      versionId: row.versionId as ApiVersionId,
      totalRequests: row._count._all
    }));
  }
}
