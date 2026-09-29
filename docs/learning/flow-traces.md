# Flow Traces

## Flow: List profiles through v1
1. `src/components/version-dashboard.tsx` — user selects `v1`, which changes `selectedVersion`.
2. `src/hooks/use-customer-profiles.ts` — `useCustomerProfiles("v1")` fires `GET /api/platform/customer-profiles?version=v1`.
3. `src/app/api/platform/customer-profiles/route.ts` — `GET()` route handler starts orchestration.
4. `src/lib/http/api-context.ts` — `buildApiContext()` authenticates and resolves the effective version.
5. `src/lib/auth/session.ts` — `requireSession()` creates `SessionContext`.
6. `src/services/api-version-service.ts` — `getEffectiveVersionDefinition()` merges registry and runtime rollout state.
7. `src/lib/versioning/version-rollout.ts` — `assertVersionAccess()` checks rollout eligibility.
8. `src/lib/validation/customer-profile-schemas.ts` — `listProfilesQuerySchema.parse()` validates filters.
9. `src/services/customer-profile-service.ts` — `listProfiles()` checks read permissions.
10. `src/repositories/customer-profile-repository.ts` — `listForSession()` applies ownership-aware query scope.
11. `src/lib/versioning/customer-profile-contracts.ts` — `toVersionedCustomerProfile()` formats canonical rows as `v1`.
12. `src/lib/http/route-utils.ts` — `recordVersionUsage()` logs the request.
13. Returns `200` with `v1` profile payloads.

## Flow: Create profile through v2
1. External client or test caller sends `POST /api/platform/customer-profiles` with `x-api-version: v2`.
2. `src/app/api/platform/customer-profiles/route.ts` — `POST()` receives the request.
3. `src/lib/http/api-context.ts` — `buildApiContext()` resolves session and version.
4. `src/lib/validation/customer-profile-schemas.ts` — `getCreateProfileSchema("v2").parse()` validates the body.
5. `src/lib/versioning/customer-profile-contracts.ts` — `toCanonicalCreateInput()` migrates the `v2` contract to canonical DTOs.
6. `src/services/customer-profile-service.ts` — `createProfile()` checks roles and decides audit metadata.
7. `src/repositories/customer-profile-repository.ts` — `create()` inserts the canonical row.
8. `src/repositories/audit-log-repository.ts` — `record()` writes `customer_profile.created`.
9. `src/lib/versioning/customer-profile-contracts.ts` — `toVersionedCustomerProfile()` converts the canonical record back into `v2`.
10. `src/lib/http/api-response.ts` — `jsonWithVersionHeaders()` attaches version headers.
11. `src/lib/http/route-utils.ts` — `recordVersionUsage()` stores usage telemetry.
12. Returns `201` with the `v2` profile payload.

## Flow: Reject invalid archived-to-active transition
1. Caller sends `PATCH /api/platform/customer-profiles/[profileId]` for an archived record.
2. `src/app/api/platform/customer-profiles/[profileId]/route.ts` — `PATCH()` parses the versioned patch body.
3. `src/lib/http/api-context.ts` — `buildApiContext()` authenticates and resolves version.
4. `src/lib/versioning/customer-profile-contracts.ts` — `toCanonicalUpdateInput()` converts the versioned patch into canonical fields.
5. `src/services/customer-profile-service.ts` — `updateProfile()` loads the visible record with `getProfile()`.
6. `src/repositories/customer-profile-repository.ts` — `findByIdForSession()` fetches only records visible to the caller.
7. `src/lib/auth/permissions.ts` — `assertCanMutateProfile()` verifies mutation rights.
8. `src/services/customer-profile-service.ts` — `assertValidLifecycleTransition()` throws `CONFLICT` because archived records are immutable.
9. `src/lib/http/route-utils.ts` — `toErrorResponse()` converts the error and `recordVersionUsage()` logs the failure.
10. Returns `409` with `code: "CONFLICT"`.

## Flow: Admin updates v2 rollout percentage
1. `src/components/version-dashboard.tsx` — user clicks `Roll v2 out to 75%`.
2. `src/hooks/use-api-versions.ts` — `useUpdateVersionRollout()` fires `PATCH /api/platform/versions/v2/rollout`.
3. `src/app/api/platform/versions/[version]/rollout/route.ts` — `PATCH()` resolves `versionId` from the path.
4. `src/lib/http/api-context.ts` — `buildApiContext()` authenticates the admin and resolves the effective version definition.
5. `src/lib/validation/customer-profile-schemas.ts` — `rolloutUpdateSchema.parse()` validates the operational payload.
6. `src/services/api-version-service.ts` — `updateRollout()` enforces `ADMIN` role and writes the audit event.
7. `src/repositories/version-catalog-repository.ts` — `updateRollout()` persists runtime rollout state.
8. `src/repositories/audit-log-repository.ts` — `record()` writes `api_version.rollout_updated`.
9. `src/lib/http/route-utils.ts` — `recordVersionUsage()` logs the operational request.
10. Returns `200` with the merged version summary.

## Flow: Reject client rollout change
1. `tests/routes/version-rollout-route.test.ts` — the test calls the route with a `CLIENT` session.
2. `src/app/api/platform/versions/[version]/rollout/route.ts` — `PATCH()` parses the path and builds context.
3. `src/lib/http/api-context.ts` — `buildApiContext()` authenticates the caller.
4. `src/lib/validation/customer-profile-schemas.ts` — `rolloutUpdateSchema.parse()` accepts the body shape.
5. `src/services/api-version-service.ts` — `updateRollout()` calls `assertRole(session, ["ADMIN"])`.
6. `src/lib/auth/permissions.ts` — `assertRole()` throws `FORBIDDEN`.
7. `src/lib/http/route-utils.ts` — `toErrorResponse()` creates the rejection body and `recordVersionUsage()` logs the failed attempt.
8. Returns `403` with `code: "FORBIDDEN"`.
