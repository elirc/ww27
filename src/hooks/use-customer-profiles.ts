/*
 * What this file does:
 * Fetches customer profiles through the versioned public API so the UI exercises the same contract clients use.
 * What calls it:
 * src/components/version-dashboard.tsx.
 * What it calls:
 * @tanstack/react-query and src/app/api/platform/customer-profiles/route.ts.
 * One thing a junior engineer would likely get wrong:
 * Hitting a service function directly from the client and accidentally skipping the validation and version boundary.
 */

"use client";

import { useQuery } from "@tanstack/react-query";

import { demoClientHeaders } from "@/lib/http/demo-session";
import type { ApiVersionId, ProfileLifecycleState } from "@/types/domain";

type ProfileV1View = {
  id: string;
  externalReference: string;
  fullName: string;
  email: string;
  status: "active" | "inactive";
  createdAt: string;
};

type ProfileV2View = {
  id: string;
  externalReference: string;
  name: {
    givenName: string;
    familyName: string;
  };
  email: string;
  lifecycleState: ProfileLifecycleState;
  marketingOptIn: boolean;
  createdAt: string;
};

async function fetchProfiles(version: ApiVersionId) {
  const response = await fetch(`/api/platform/customer-profiles?version=${version}`, {
    headers: {
      ...demoClientHeaders,
      "x-api-version": version
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to load profiles");
  }

  return response.json() as Promise<{ profiles: Array<ProfileV1View | ProfileV2View> }>;
}

export function useCustomerProfiles(version: ApiVersionId) {
  return useQuery({
    queryKey: ["customer-profiles", version],
    queryFn: () => fetchProfiles(version)
  });
}
