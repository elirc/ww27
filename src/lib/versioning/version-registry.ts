/*
 * What this file does:
 * Declares the authoritative metadata for every supported API version, including rollout and deprecation rules.
 * What calls it:
 * src/lib/http/api-context.ts, src/services/api-version-service.ts, and scripts/generate-version-docs.ts.
 * What it calls:
 * No local modules; it exports static version definitions.
 * One thing a junior engineer would likely get wrong:
 * Duplicating version metadata across routes, docs, and UI until the rollout policy drifts in three places.
 */

import type { ApiVersionId, VersionDefinition } from "@/types/domain";

export const versionRegistry: Record<ApiVersionId, VersionDefinition> = {
  v1: {
    id: "v1",
    label: "Customer Profiles v1",
    lifecycle: "DEPRECATED",
    isDefault: true,
    deprecationDate: "2026-02-01",
    sunsetDate: "2026-12-31",
    docsPath: "docs/api/v1.md",
    changelog: [
      "Legacy contract returning fullName instead of structured name fields.",
      "Maps the internal lifecycle model down to the older active/inactive vocabulary.",
      "Emits deprecation warnings on every response."
    ],
    rollout: {
      percentage: 100,
      allowlistClientIds: []
    }
  },
  v2: {
    id: "v2",
    label: "Customer Profiles v2",
    lifecycle: "CURRENT",
    isDefault: false,
    docsPath: "docs/api/v2.md",
    changelog: [
      "Structured name object replaces fullName.",
      "Lifecycle state is now explicit: TRIAL, ACTIVE, SUSPENDED, ARCHIVED.",
      "Marketing preferences are now part of the public contract."
    ],
    rollout: {
      percentage: 40,
      allowlistClientIds: ["beta-client", "internal-admin"]
    }
  }
};

// ⚠️ SENIOR NOTE: Keeping docsPath in the registry makes version docs deploy-reviewable, but forgetting to update it will mislead operators fast.

export function listVersions(): VersionDefinition[] {
  return Object.values(versionRegistry);
}

export function getVersionDefinition(version: string): VersionDefinition | undefined {
  return versionRegistry[version as ApiVersionId];
}

export function getDefaultVersion(): VersionDefinition {
  const fallback = Object.values(versionRegistry).find((definition) => definition.isDefault);

  if (!fallback) {
    throw new Error("No default API version configured.");
  }

  return fallback;
}
