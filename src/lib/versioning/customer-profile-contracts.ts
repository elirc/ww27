/*
 * What this file does:
 * Transforms version-specific request/response payloads to and from the canonical customer profile model.
 * What calls it:
 * src/app/api/platform/customer-profiles/route.ts and src/app/api/platform/customer-profiles/[profileId]/route.ts.
 * What it calls:
 * src/types/domain.ts for canonical model types.
 * One thing a junior engineer would likely get wrong:
 * Letting version-specific fields leak into service-layer types until the business logic depends on the API contract.
 */

import type {
  ApiVersionId,
  CreateCustomerProfileInput,
  CustomerProfileRecord,
  ProfileLifecycleState,
  UpdateCustomerProfileInput
} from "@/types/domain";

export interface CustomerProfileV1Response {
  id: string;
  externalReference: string;
  fullName: string;
  email: string;
  status: "active" | "inactive";
  createdAt: string;
}

export interface CustomerProfileV2Response {
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
}

type CreateV1Input = {
  externalReference: string;
  fullName: string;
  email: string;
  status: "active" | "inactive";
};

type UpdateV1Input = Partial<CreateV1Input>;

type CreateV2Input = {
  externalReference: string;
  name: {
    givenName: string;
    familyName: string;
  };
  email: string;
  lifecycleState: ProfileLifecycleState;
  marketingOptIn: boolean;
};

type UpdateV2Input = Partial<CreateV2Input>;

function isV1Create(payload: CreateV1Input | CreateV2Input): payload is CreateV1Input {
  return "fullName" in payload;
}

function isV2Create(payload: CreateV1Input | CreateV2Input): payload is CreateV2Input {
  return "name" in payload;
}

function isV1Update(payload: UpdateV1Input | UpdateV2Input): payload is UpdateV1Input {
  return !isV2Update(payload);
}

function isV2Update(payload: UpdateV1Input | UpdateV2Input): payload is UpdateV2Input {
  return "name" in payload || "lifecycleState" in payload || "marketingOptIn" in payload;
}

function assertSupportedVersion(version: string): asserts version is ApiVersionId {
  if (version !== "v1" && version !== "v2") {
    throw new Error(`Version ${version} is not supported.`);
  }
}

function splitFullName(fullName: string): { givenName: string; familyName: string } {
  const [givenName, ...rest] = fullName.trim().split(/\s+/);

  return {
    givenName,
    familyName: rest.join(" ") || "Unknown"
  };
}

function toLegacyStatus(state: ProfileLifecycleState): "active" | "inactive" {
  return state === "ACTIVE" || state === "TRIAL" ? "active" : "inactive";
}

function fromLegacyStatus(status: "active" | "inactive"): ProfileLifecycleState {
  return status === "active" ? "ACTIVE" : "SUSPENDED";
}

export function toCanonicalCreateInput(
  version: string,
  payload: CreateV1Input | CreateV2Input,
  ownerUserId: string
): CreateCustomerProfileInput {
  assertSupportedVersion(version);
  if (version === "v1") {
    if (!isV1Create(payload)) throw new Error("Invalid v1 customer profile payload.");
    const legacyPayload = payload;
    const migrated = splitFullName(legacyPayload.fullName);

    // ⚠️ SENIOR NOTE: This migration is intentionally lossy; v1 cannot represent marketing preferences or the full lifecycle state machine.
    return {
      ownerUserId,
      externalReference: legacyPayload.externalReference,
      givenName: migrated.givenName,
      familyName: migrated.familyName,
      email: legacyPayload.email,
      lifecycleState: fromLegacyStatus(legacyPayload.status),
      marketingOptIn: false
    };
  }

  if (!isV2Create(payload)) throw new Error("Invalid v2 customer profile payload.");
  return {
    ownerUserId,
    externalReference: payload.externalReference,
    givenName: payload.name.givenName,
    familyName: payload.name.familyName,
    email: payload.email,
    lifecycleState: payload.lifecycleState,
    marketingOptIn: payload.marketingOptIn
  };
}

export function toCanonicalUpdateInput(
  version: string,
  payload: UpdateV1Input | UpdateV2Input
): UpdateCustomerProfileInput {
  assertSupportedVersion(version);
  if (version === "v1") {
    if (!isV1Update(payload)) throw new Error("Invalid v1 customer profile patch.");
    const legacyPayload = payload;
    const migrated = legacyPayload.fullName !== undefined ? splitFullName(legacyPayload.fullName) : undefined;
    const canonical: UpdateCustomerProfileInput = {};
    if (migrated) {
      canonical.givenName = migrated.givenName;
      canonical.familyName = migrated.familyName;
    }
    if (legacyPayload.email !== undefined) canonical.email = legacyPayload.email;
    if (legacyPayload.status !== undefined) canonical.lifecycleState = fromLegacyStatus(legacyPayload.status);
    return canonical;
  }
  const canonical: UpdateCustomerProfileInput = {};
  if (!isV2Update(payload)) throw new Error("Invalid v2 customer profile patch.");
  const modernPayload = payload;
  if (modernPayload.name !== undefined) {
    canonical.givenName = modernPayload.name.givenName;
    canonical.familyName = modernPayload.name.familyName;
  }
  if (modernPayload.email !== undefined) canonical.email = modernPayload.email;
  if (modernPayload.lifecycleState !== undefined) canonical.lifecycleState = modernPayload.lifecycleState;
  if (modernPayload.marketingOptIn !== undefined) canonical.marketingOptIn = modernPayload.marketingOptIn;
  return canonical;
}

export function toVersionedCustomerProfile(
  version: ApiVersionId,
  profile: CustomerProfileRecord
): CustomerProfileV1Response | CustomerProfileV2Response {
  assertSupportedVersion(version);
  if (version === "v1") {
    return {
      id: profile.id,
      externalReference: profile.externalReference,
      fullName: `${profile.givenName} ${profile.familyName}`.trim(),
      email: profile.email,
      status: toLegacyStatus(profile.lifecycleState),
      createdAt: profile.createdAt.toISOString()
    };
  }

  return {
    id: profile.id,
    externalReference: profile.externalReference,
    name: {
      givenName: profile.givenName,
      familyName: profile.familyName
    },
    email: profile.email,
    lifecycleState: profile.lifecycleState,
    marketingOptIn: profile.marketingOptIn,
    createdAt: profile.createdAt.toISOString()
  };
}
