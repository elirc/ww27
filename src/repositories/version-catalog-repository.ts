/*
 * What this file does:
 * Persists mutable runtime state for API versions, especially rollout percentages and allowlists.
 * What calls it:
 * src/services/api-version-service.ts.
 * What it calls:
 * src/lib/db/prisma.ts.
 * One thing a junior engineer would likely get wrong:
 * Treating version metadata as fully static and forgetting that rollout controls are operational data.
 */

import { prisma } from "@/lib/db/prisma";
import { listVersions } from "@/lib/versioning/version-registry";
import type { ApiVersionId, VersionRolloutPolicy } from "@/types/domain";

export interface VersionRuntimeRecord {
  id: ApiVersionId;
  rollout: VersionRolloutPolicy;
}

export interface VersionCatalogRepository {
  listRuntimeState(): Promise<VersionRuntimeRecord[]>;
  getRuntimeState(versionId: ApiVersionId): Promise<VersionRuntimeRecord | null>;
  updateRollout(versionId: ApiVersionId, rollout: VersionRolloutPolicy): Promise<VersionRuntimeRecord>;
}

export class PrismaVersionCatalogRepository implements VersionCatalogRepository {
  async listRuntimeState(): Promise<VersionRuntimeRecord[]> {
    const versions = await prisma.apiVersion.findMany({
      orderBy: {
        id: "asc"
      }
    });

    return versions.map((version) => ({
      id: version.id as ApiVersionId,
      rollout: {
        percentage: version.rolloutPercentage,
        allowlistClientIds: Array.isArray(version.allowlistJson) ? version.allowlistJson.filter((id): id is string => typeof id === "string") : []
      }
    }));
  }

  async getRuntimeState(versionId: ApiVersionId): Promise<VersionRuntimeRecord | null> {
    const version = await prisma.apiVersion.findUnique({
      where: {
        id: versionId
      }
    });

    if (!version) {
      return null;
    }

    return {
      id: version.id as ApiVersionId,
      rollout: {
        percentage: version.rolloutPercentage,
        allowlistClientIds: Array.isArray(version.allowlistJson) ? version.allowlistJson.filter((id): id is string => typeof id === "string") : []
      }
    };
  }

  async updateRollout(versionId: ApiVersionId, rollout: VersionRolloutPolicy): Promise<VersionRuntimeRecord> {
    // ⚠️ SENIOR NOTE: Rollout state is operational configuration, so it should be writable without redeploying the code registry.
    const version = await prisma.apiVersion.upsert({
      where: {
        id: versionId
      },
      create: {
        id: versionId,
        lifecycle: listVersions().find((item) => item.id === versionId)?.lifecycle ?? "BETA",
        isDefault: false,
        docsPath: listVersions().find((item) => item.id === versionId)?.docsPath ?? `docs/api/${versionId}.md`,
        rolloutPercentage: rollout.percentage,
        allowlistJson: rollout.allowlistClientIds
      },
      update: {
        rolloutPercentage: rollout.percentage,
        allowlistJson: rollout.allowlistClientIds
      }
    });

    return {
      id: version.id as ApiVersionId,
      rollout: {
        percentage: version.rolloutPercentage,
        allowlistClientIds: Array.isArray(version.allowlistJson) ? version.allowlistJson.filter((id): id is string => typeof id === "string") : []
      }
    };
  }
}
