/*
 * What this file does:
 * Handles versioned read/update operations for a single customer profile.
 * What calls it:
 * src/hooks/use-customer-profiles.ts and external API consumers.
 * What it calls:
 * src/lib/http/api-context.ts, src/lib/validation/customer-profile-schemas.ts, src/lib/versioning/customer-profile-contracts.ts, src/services/customer-profile-service.ts, and src/lib/http/route-utils.ts.
 * One thing a junior engineer would likely get wrong:
 * Reusing the list-route visibility assumptions and forgetting that single-record updates need separate permission checks.
 */

import { NextRequest } from "next/server";

import { buildApiContext, getRequestedVersion } from "@/lib/http/api-context";
import { jsonWithVersionHeaders } from "@/lib/http/api-response";
import { recordVersionUsage, toErrorResponse } from "@/lib/http/route-utils";
import { services } from "@/lib/server/container";
import { getUpdateProfileSchema } from "@/lib/validation/customer-profile-schemas";
import {
  toCanonicalUpdateInput,
  toVersionedCustomerProfile
} from "@/lib/versioning/customer-profile-contracts";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ profileId: string }> }
) {
  let apiContext: Awaited<ReturnType<typeof buildApiContext>> | undefined;

  try {
    const { profileId } = await context.params;
    apiContext = await buildApiContext(request);
    const profile = await services.customerProfiles.getProfile(apiContext.session, profileId);

    const response = jsonWithVersionHeaders(
      {
        profile: toVersionedCustomerProfile(apiContext.version.id, profile)
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
    const fallbackVersion = apiContext?.version ?? getRequestedVersion(request);
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ profileId: string }> }
) {
  let apiContext: Awaited<ReturnType<typeof buildApiContext>> | undefined;

  try {
    const { profileId } = await context.params;
    apiContext = await buildApiContext(request);
    const schema = getUpdateProfileSchema(apiContext.version.id);
    const body = schema.parse(await request.json());

    // ⚠️ SENIOR NOTE: Partial updates are easy places to accidentally skip version translation and mutate canonical fields incorrectly.
    const input = toCanonicalUpdateInput(apiContext.version.id, body);
    const profile = await services.customerProfiles.updateProfile(
      apiContext.session,
      profileId,
      input
    );

    const response = jsonWithVersionHeaders(
      {
        profile: toVersionedCustomerProfile(apiContext.version.id, profile)
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
    const fallbackVersion = apiContext?.version ?? getRequestedVersion(request);
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
