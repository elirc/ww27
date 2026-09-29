/*
 * What this file does:
 * Converts thrown errors into consistent HTTP responses and records version usage after each request.
 * What calls it:
 * Route handlers under src/app/api/platform.
 * What it calls:
 * src/lib/http/api-errors.ts, src/lib/http/api-response.ts, and src/lib/server/container.ts.
 * One thing a junior engineer would likely get wrong:
 * Returning early on errors without recording telemetry, which makes incident dashboards lie.
 */

import { ZodError } from "zod";

import { isApiError } from "@/lib/http/api-errors";
import { jsonWithVersionHeaders } from "@/lib/http/api-response";
import { services } from "@/lib/server/container";
import { getDefaultVersion } from "@/lib/versioning/version-registry";
import type { NextRequest } from "next/server";
import type { SessionContext, VersionDefinition } from "@/types/domain";

export function toErrorResponse(error: unknown, version?: VersionDefinition) {
  if (error instanceof ZodError) {
    return jsonWithVersionHeaders(
      {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        issues: error.issues
      },
      { status: 400 },
      version ?? getDefaultVersion()
    );
  }

  if (isApiError(error)) {
    return jsonWithVersionHeaders(
      {
        error: error.message,
        code: error.code,
        details: error.details
      },
      { status: error.statusCode },
      version ?? getDefaultVersion()
    );
  }

  return jsonWithVersionHeaders(
    {
      error: "Unexpected server error",
      code: "INTERNAL_SERVER_ERROR"
    },
    { status: 500 },
    version ?? getDefaultVersion()
  );
}

export async function recordVersionUsage(args: {
  request: NextRequest;
  version: VersionDefinition;
  session?: SessionContext;
  responseStatus: number;
}): Promise<void> {
  // ⚠️ SENIOR NOTE: Recording failures is just as important as successes when you're trying to safely deprecate a version.
  await services.apiVersions.recordUsage({
    versionId: args.version.id,
    actorUserId: args.session?.userId,
    route: args.request.nextUrl.pathname,
    method: args.request.method,
    statusCode: args.responseStatus,
    deprecationFired: args.version.lifecycle === "DEPRECATED"
  });
}
