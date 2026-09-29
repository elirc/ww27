/*
 * What this file does:
 * Exposes operational version-management use cases: listing versions, merging usage metrics, and updating rollouts.
 * What calls it:
 * src/app/api/platform/versions/route.ts and src/app/api/platform/versions/[version]/rollout/route.ts.
 * What it calls:
 * src/lib/auth/permissions.ts, src/lib/versioning/version-registry.ts, src/repositories/version-catalog-repository.ts, src/repositories/usage-metric-repository.ts, and src/repositories/audit-log-repository.ts.
 * One thing a junior engineer would likely get wrong:
 * Returning raw database rows and forgetting to merge the static registry data that clients and docs depend on.
 */

import { assertRole } from "@/lib/auth/permissions";
import { getVersionDefinition, listVersions } from "@/lib/versioning/version-registry";
import type { AuditLogRepository } from "@/repositories/audit-log-repository";
import type { UsageMetricRepository } from "@/repositories/usage-metric-repository";
import type {
  VersionCatalogRepository,
  VersionRuntimeRecord
} from "@/repositories/version-catalog-repository";
import type { ApiUsageEvent, ApiVersionId, SessionContext, VersionRolloutPolicy } from "@/types/domain";

export interface VersionSummary {
  id: ApiVersionId;
  label: string;
  lifecycle: string;
  isDefault: boolean;
  docsPath: string;
  changelog: string[];
  deprecationDate?: string;
  sunsetDate?: string;
  rollout: VersionRolloutPolicy;
  usage: {
    totalRequests: number;
  };
}

function applyRuntimeOverride(versionId: ApiVersionId, runtime: VersionRuntimeRecord | null): VersionSummary {
  const definition = getVersionDefinition(versionId);

  if (!definition) {
    throw new Error(`Version ${versionId} is missing from the registry.`);
  }

  return {
    ...definition,
    rollout: runtime?.rollout ?? definition.rollout,
    usage: {
      totalRequests: 0
    }
  };
}

function assertValidRollout(versionId: string, rollout: VersionRolloutPolicy): asserts versionId is ApiVersionId {
  if (!getVersionDefinition(versionId)) throw new Error(`Version ${versionId} is not supported.`);
  if (!Number.isInteger(rollout?.percentage) || rollout.percentage < 0 || rollout.percentage > 100) {
    throw new Error("Rollout percentage must be an integer from 0 through 100.");
  }
  if (!Array.isArray(rollout.allowlistClientIds) || rollout.allowlistClientIds.some(
    (clientId) => typeof clientId !== "string" || !clientId.trim(),
  )) {
    throw new Error("Rollout allowlist must contain non-empty client ids.");
  }
  if (new Set(rollout.allowlistClientIds).size !== rollout.allowlistClientIds.length) {
    throw new Error("Rollout allowlist client ids must be unique.");
  }
}

export class ApiVersionService {
  constructor(
    private readonly versionCatalogRepository: VersionCatalogRepository,
    private readonly usageMetricRepository: UsageMetricRepository,
    private readonly auditLogRepository: AuditLogRepository
  ) {}

  async listVersionSummaries(): Promise<VersionSummary[]> {
    const [runtimeVersions, usageByVersion] = await Promise.all([
      this.versionCatalogRepository.listRuntimeState(),
      this.usageMetricRepository.summarizeByVersion()
    ]);

    const runtimeMap = new Map(runtimeVersions.map((item) => [item.id, item]));
    const usageMap = new Map(usageByVersion.map((item) => [item.versionId, item.totalRequests]));

    return listVersions().map((definition) => ({
      ...applyRuntimeOverride(definition.id, runtimeMap.get(definition.id) ?? null),
      usage: {
        totalRequests: usageMap.get(definition.id) ?? 0
      }
    }));
  }

  async getEffectiveVersionDefinition(versionId: ApiVersionId) {
    const definition = getVersionDefinition(versionId);

    if (!definition) {
      throw new Error(`Version ${versionId} is missing from the registry.`);
    }

    const runtime = await this.versionCatalogRepository.getRuntimeState(versionId);

    return {
      ...definition,
      rollout: runtime?.rollout ?? definition.rollout
    };
  }

  async updateRollout(
    session: SessionContext,
    versionId: ApiVersionId,
    rollout: VersionRolloutPolicy
  ): Promise<VersionSummary> {
    assertRole(session, ["ADMIN"]);
    assertValidRollout(versionId, rollout);

    // ⚠️ SENIOR NOTE: Operational controls like rollout changes should always emit an audit trail because they change live traffic behavior.
    const previous = await this.versionCatalogRepository.getRuntimeState(versionId);
    const runtime = await this.versionCatalogRepository.updateRollout(versionId, rollout);

    try {
      await this.auditLogRepository.record({
        actorUserId: session.userId,
        action: "api_version.rollout_updated",
        entityType: "ApiVersion",
        entityId: versionId,
        metadata: {
          percentage: rollout.percentage,
          allowlistClientIds: rollout.allowlistClientIds
        }
      });
    } catch (error) {
      // Compensation: the rollout write already committed, so put it back before surfacing the error.
      // This is weaker than a transaction (see chapter 3): a crash between the two writes leaves the
      // rollout changed with no audit row.
      const definition = getVersionDefinition(versionId);
      if (!previous && !definition) {
        throw error;
      }
      await this.versionCatalogRepository.updateRollout(versionId, previous?.rollout ?? definition!.rollout);
      throw error;
    }

    return applyRuntimeOverride(versionId, runtime);
  }

  async recordUsage(event: ApiUsageEvent): Promise<void> {
    await this.usageMetricRepository.record(event);
  }
}
