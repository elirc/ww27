# Request Lifecycle

Request: Create a customer profile through the deprecated `v1` contract
1. `src/app/api/platform/customer-profiles/route.ts` — `POST()` receives the request, calls `buildApiContext()`, parses the `v1` body with `getCreateProfileSchema()`, and migrates it with `toCanonicalCreateInput()`.
2. `src/lib/http/api-context.ts` — `buildApiContext()` verifies auth and resolves the effective version definition.
3. `src/lib/auth/session.ts` — `requireSession()` reads session headers and rejects missing auth.
4. `src/services/api-version-service.ts` — `getEffectiveVersionDefinition()` merges static registry data with runtime rollout state.
5. `src/lib/versioning/version-rollout.ts` — `assertVersionAccess()` checks whether the caller can use the requested version.
6. `src/lib/validation/customer-profile-schemas.ts` — `getCreateProfileSchema("v1").parse()` enforces the legacy request shape.
7. `src/lib/versioning/customer-profile-contracts.ts` — `toCanonicalCreateInput()` converts `fullName` and `status` into canonical fields.
8. `src/services/customer-profile-service.ts` — `createProfile()` enforces mutation permissions and writes the audit event.
9. `src/repositories/customer-profile-repository.ts` — `create()` inserts the canonical profile record.
10. `src/repositories/audit-log-repository.ts` — `record()` writes `customer_profile.created`.
11. `src/lib/http/api-response.ts` — `jsonWithVersionHeaders()` adds `Deprecation`, `Warning`, and `Sunset` headers for `v1`.
12. Returns `201` with `{ profile: { id, externalReference, fullName, email, status, createdAt } }`

Request: List customer profiles through the `v2` contract
1. `src/app/api/platform/customer-profiles/route.ts` — `GET()` receives the request, builds the API context, parses query filters with `listProfilesQuerySchema`, and maps results with `toVersionedCustomerProfile()`.
2. `src/lib/http/api-context.ts` — `buildApiContext()` authenticates the request and resolves rollout-aware version metadata.
3. `src/lib/auth/session.ts` — `requireSession()` creates `SessionContext`.
4. `src/services/api-version-service.ts` — `getEffectiveVersionDefinition()` applies runtime rollout overrides.
5. `src/lib/versioning/version-rollout.ts` — `assertVersionAccess()` blocks callers that are outside the rollout window.
6. `src/lib/validation/customer-profile-schemas.ts` — `listProfilesQuerySchema.parse()` validates optional filters.
7. `src/services/customer-profile-service.ts` — `listProfiles()` enforces allowed read roles.
8. `src/repositories/customer-profile-repository.ts` — `listForSession()` applies the ownership-aware query scope through `buildVisibilityWhere()`.
9. `src/lib/versioning/customer-profile-contracts.ts` — `toVersionedCustomerProfile()` formats the canonical record as `v2`.
10. `src/lib/http/route-utils.ts` — `recordVersionUsage()` logs the request outcome.
11. Returns `200` with `{ profiles: [...] }`

Request: Client attempts to change rollout for `v2`
1. `src/app/api/platform/versions/[version]/rollout/route.ts` — `PATCH()` resolves the path version, builds API context, and validates the rollout payload.
2. `src/lib/http/api-context.ts` — `buildApiContext()` authenticates the caller and resolves the effective version.
3. `src/lib/auth/session.ts` — `requireSession()` reads the caller role.
4. `src/services/api-version-service.ts` — `getEffectiveVersionDefinition()` resolves the target version metadata.
5. `src/lib/validation/customer-profile-schemas.ts` — `rolloutUpdateSchema.parse()` validates `percentage` and `allowlistClientIds`.
6. `src/services/api-version-service.ts` — `updateRollout()` calls `assertRole(session, ["ADMIN"])`.
7. `src/lib/auth/permissions.ts` — `assertRole()` rejects the client with `FORBIDDEN`.
8. `src/lib/http/route-utils.ts` — `toErrorResponse()` translates the thrown `ApiError` and `recordVersionUsage()` records the failed attempt.
9. Returns `403` with `{ error, code: "FORBIDDEN" }`
