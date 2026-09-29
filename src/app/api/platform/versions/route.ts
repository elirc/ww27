/*
 * What this file does:
 * Lists supported API versions, their rollout state, and usage counts for the dashboard.
 * What calls it:
 * src/hooks/use-api-versions.ts and operational clients.
 * What it calls:
 * src/lib/auth/session.ts, src/lib/http/api-response.ts, src/lib/http/route-utils.ts, and src/lib/server/container.ts.
 * One thing a junior engineer would likely get wrong:
 * Exposing version metadata anonymously and leaking internal rollout plans to unauthenticated callers.
 */

import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/session";
import { jsonWithVersionHeaders } from "@/lib/http/api-response";
import { toErrorResponse } from "@/lib/http/route-utils";
import { services } from "@/lib/server/container";
import { getDefaultVersion } from "@/lib/versioning/version-registry";

export async function GET(request: NextRequest) {
  try {
    requireSession(request);

    const versions = await services.apiVersions.listVersionSummaries();

    return jsonWithVersionHeaders(
      {
        versions
      },
      { status: 200 },
      getDefaultVersion()
    );
  } catch (error) {
    return toErrorResponse(error, getDefaultVersion());
  }
}
