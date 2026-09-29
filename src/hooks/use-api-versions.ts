/*
 * What this file does:
 * Fetches version catalog data and exposes rollout mutation hooks for the dashboard.
 * What calls it:
 * src/components/version-dashboard.tsx.
 * What it calls:
 * @tanstack/react-query and the route handlers under src/app/api/platform/versions.
 * One thing a junior engineer would likely get wrong:
 * Bypassing the shared fetch helper and forgetting to include the same session headers across requests.
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { demoAdminHeaders } from "@/lib/http/demo-session";
import type { ApiVersionId, VersionLifecycle, VersionRolloutPolicy } from "@/types/domain";

export interface VersionSummaryView {
  id: ApiVersionId;
  label: string;
  lifecycle: VersionLifecycle;
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

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Request failed");
  }

  return response.json() as Promise<T>;
}

export function useApiVersions() {
  return useQuery({
    queryKey: ["api-versions"],
    queryFn: () =>
      fetchJson<{ versions: VersionSummaryView[] }>("/api/platform/versions", {
        headers: demoAdminHeaders
      })
  });
}

export function useUpdateVersionRollout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: { versionId: ApiVersionId; percentage: number; allowlistClientIds: string[] }) =>
      fetchJson<{ version: VersionSummaryView }>(`/api/platform/versions/${args.versionId}/rollout`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...demoAdminHeaders
        },
        body: JSON.stringify({
          percentage: args.percentage,
          allowlistClientIds: args.allowlistClientIds
        })
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["api-versions"]
      });
    }
  });
}
