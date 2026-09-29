/*
 * What this file does:
 * Lets admins update the rollout policy for a specific API version.
 * What calls it:
 * src/components/version-dashboard.tsx via useUpdateVersionRollout().
 * What it calls:
 * src/lib/http/api-context.ts, src/lib/validation/customer-profile-schemas.ts, src/services/api-version-service.ts, and src/lib/http/route-utils.ts.
 * One thing a junior engineer would likely get wrong:
 * Trusting the URL version alone without validating the body or enforcing the ADMIN-only permission here.
 */

import { NextRequest } from "next/server";

import { buildApiContext, toApiVersionId } from "@/lib/http/api-context";
import { jsonWithVersionHeaders } from "@/lib/http/api-response";
import { recordVersionUsage, toErrorResponse } from "@/lib/http/route-utils";
import { services } from "@/lib/server/container";
import { rolloutUpdateSchema } from "@/lib/validation/customer-profile-schemas";
import { getDefaultVersion } from "@/lib/versioning/version-registry";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ version: string }> }
) {
  let apiContext: Awaited<ReturnType<typeof buildApiContext>> | undefined;

  try {
    const { version: rawVersion } = await context.params;
    const versionId = toApiVersionId(rawVersion);
    apiContext = await buildApiContext(request, versionId);
    const body = rolloutUpdateSchema.parse(await request.json());

    // ⚠️ SENIOR NOTE: Admin-only operational endpoints should validate both identity and payload before touching live rollout state.
    const updated = await services.apiVersions.updateRollout(
      apiContext.session,
      versionId,
      body
    );

    const response = jsonWithVersionHeaders(
      {
        version: updated
      },
      { status: 200 },
      apiContext.version
    );

    await recordVersionUsage({
      request,
      version: apiContext.version,
      session: apiContext.session,
      responseStatus: response.status
    });

    return response;
  } catch (error) {
    const fallbackVersion = apiContext?.version ?? getDefaultVersion();
    const response = toErrorResponse(error, fallbackVersion);

    await recordVersionUsage({
      request,
      version: fallbackVersion,
      session: apiContext?.session,
      responseStatus: response.status
    });

    return response;
  }
}
