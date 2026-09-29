/*
 * What this file does:
 * Builds the authenticated, version-aware request context used by every route before business logic runs.
 * What calls it:
 * src/app/api/platform/customer-profiles/route.ts, src/app/api/platform/customer-profiles/[profileId]/route.ts, and src/app/api/platform/versions/[version]/rollout/route.ts.
 * What it calls:
 * src/lib/auth/session.ts, src/lib/versioning/version-registry.ts, src/lib/versioning/version-rollout.ts, and src/lib/http/api-errors.ts.
 * One thing a junior engineer would likely get wrong:
 * Resolving version, auth, and rollout independently in each route and forgetting one check on the next endpoint.
 */

import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/session";
import { badRequest } from "@/lib/http/api-errors";
import { services } from "@/lib/server/container";
import { getDefaultVersion, getVersionDefinition } from "@/lib/versioning/version-registry";
import { assertVersionAccess } from "@/lib/versioning/version-rollout";
import type { ApiVersionId, SessionContext, VersionDefinition } from "@/types/domain";

export interface ApiRequestContext {
  session: SessionContext;
  version: VersionDefinition;
}

export function getRequestedVersion(
  request: NextRequest,
  explicitVersion?: string
): VersionDefinition {
  const requestedVersion =
    explicitVersion ??
    request.headers.get("x-api-version") ??
    request.nextUrl.searchParams.get("version") ??
    getDefaultVersion().id;

  const version = getVersionDefinition(requestedVersion);

  if (!version) {
    throw badRequest(`Unsupported API version: ${requestedVersion}`);
  }

  return version;
}

export async function buildApiContext(
  request: NextRequest,
  explicitVersion?: string
): Promise<ApiRequestContext> {
  const session = requireSession(request);
  const requestedVersion = getRequestedVersion(request, explicitVersion);
  const version = await services.apiVersions.getEffectiveVersionDefinition(requestedVersion.id);

  // ⚠️ SENIOR NOTE: Version access must be evaluated after runtime overrides are applied or rollout toggles become non-functional.
  assertVersionAccess(session, version);

  return {
    session,
    version
  };
}

export function toApiVersionId(version: string): ApiVersionId {
  if (version === "v1" || version === "v2") {
    return version;
  }

  throw badRequest(`Version ${version} is not supported.`);
}
