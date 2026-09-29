/*
 * What this file does:
 * Handles versioned list/create operations for customer profiles while keeping the core service contract canonical.
 * What calls it:
 * src/hooks/use-customer-profiles.ts and external API consumers.
 * What it calls:
 * src/lib/http/api-context.ts, src/lib/validation/customer-profile-schemas.ts, src/lib/versioning/customer-profile-contracts.ts, src/services/customer-profile-service.ts, and src/lib/http/route-utils.ts.
 * One thing a junior engineer would likely get wrong:
 * Passing raw request bodies directly into the service layer instead of migrating them to a canonical DTO first.
 */

import { NextRequest } from "next/server";

import { buildApiContext, getRequestedVersion } from "@/lib/http/api-context";
import { jsonWithVersionHeaders } from "@/lib/http/api-response";
import { recordVersionUsage, toErrorResponse } from "@/lib/http/route-utils";
import { services } from "@/lib/server/container";
import {
  getCreateProfileSchema,
  listProfilesQuerySchema
} from "@/lib/validation/customer-profile-schemas";
import {
  toCanonicalCreateInput,
  toVersionedCustomerProfile
} from "@/lib/versioning/customer-profile-contracts";

export async function GET(request: NextRequest) {
  let apiContext: Awaited<ReturnType<typeof buildApiContext>> | undefined;

  try {
    apiContext = await buildApiContext(request);
    const context = apiContext;
    const filters = listProfilesQuerySchema.parse({
      email: request.nextUrl.searchParams.get("email") ?? undefined,
      lifecycleState: request.nextUrl.searchParams.get("lifecycleState") ?? undefined
    });
    const profiles = await services.customerProfiles.listProfiles(context.session, filters);

    const response = jsonWithVersionHeaders(
      {
        profiles: profiles.map((profile) =>
          toVersionedCustomerProfile(context.version.id, profile)
        )
      },
      { status: 200 },
      context.version
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

export async function POST(request: NextRequest) {
  let apiContext: Awaited<ReturnType<typeof buildApiContext>> | undefined;

  try {
    apiContext = await buildApiContext(request);
    const schema = getCreateProfileSchema(apiContext.version.id);
    const body = schema.parse(await request.json());

    // ⚠️ SENIOR NOTE: Contract migration belongs at the edge so version-specific fields never leak into service-layer rules.
    const canonicalInput = toCanonicalCreateInput(
      apiContext.version.id,
      body,
      apiContext.session.userId
    );
    const profile = await services.customerProfiles.createProfile(
      apiContext.session,
      canonicalInput
    );

    const response = jsonWithVersionHeaders(
      {
        profile: toVersionedCustomerProfile(apiContext.version.id, profile)
      },
      { status: 201 },
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
