# Concepts Demonstrated

## Service layer
Where to look: `src/services/customer-profile-service.ts` — `createProfile()`, `getProfile()`, `listProfiles()`, and `updateProfile()` own business rules instead of the routes.
Also see: `src/app/api/platform/customer-profiles/route.ts` for the thin orchestration layer above it.
Risk if wrong: Business rules drift across endpoints and become impossible to review consistently.

## Repository pattern
Where to look: `src/repositories/customer-profile-repository.ts` — `listForSession()` and `findByIdForSession()` own the actual Prisma query shapes.
Also see: `src/services/customer-profile-service.ts` for how services depend on repository interfaces instead of Prisma directly.
Risk if wrong: Data access and business logic get tangled, making scoping bugs harder to spot.

## Zod validation boundary
Where to look: `src/lib/validation/customer-profile-schemas.ts` — `getCreateProfileSchema()` and `getUpdateProfileSchema()` enforce contract-specific validation.
Also see: `src/app/api/platform/customer-profiles/route.ts` where `.parse()` is called before any service logic.
Risk if wrong: Invalid payloads make it into the service layer and create inconsistent persisted data.

## Auth/session flow
Where to look: `src/lib/auth/session.ts` — `requireSession()` creates `SessionContext` from headers.
Also see: `src/lib/http/api-context.ts` where auth is composed with version negotiation.
Risk if wrong: Protected routes can accidentally become anonymous or rely on inconsistent session shapes.

## Role-based access control
Where to look: `src/lib/auth/permissions.ts` — `assertRole()` and `assertCanMutateProfile()` contain reusable permission checks.
Also see: `src/services/api-version-service.ts` where `updateRollout()` uses `assertRole(session, ["ADMIN"])`.
Risk if wrong: Clients could mutate profile data or rollout configuration they should never control.

## State transitions
Where to look: `src/services/customer-profile-service.ts` — `assertValidLifecycleTransition()` blocks archived profiles from becoming active again.
Also see: `tests/services/customer-profile-service.test.ts` for the focused test that locks the rule down.
Risk if wrong: Archived records can be resurrected and break downstream assumptions about immutable history.

## Audit logging
Where to look: `src/repositories/audit-log-repository.ts` — `record()` persists structured audit entries.
Also see: `src/services/customer-profile-service.ts` and `src/services/api-version-service.ts` for the business events that trigger audit writes.
Risk if wrong: Incident review loses the ability to answer who changed production behavior and when.

## Version registry
Where to look: `src/lib/versioning/version-registry.ts` — `versionRegistry` defines supported versions, lifecycle, default behavior, docs paths, and baseline rollout.
Also see: `scripts/generate-version-docs.ts` for how docs are generated from the registry.
Risk if wrong: Routes, docs, and rollout behavior drift apart.

## Backward compatibility migration layer
Where to look: `src/lib/versioning/customer-profile-contracts.ts` — `toCanonicalCreateInput()` and `toCanonicalUpdateInput()` migrate legacy and modern contracts into one canonical model.
Also see: `docs/api/v1.md` and `docs/api/v2.md` for the rendered public contract differences.
Risk if wrong: The service layer becomes polluted with version-specific branches.

## Gradual rollout
Where to look: `src/lib/versioning/version-rollout.ts` — `assertVersionAccess()` enforces allowlist and percentage gates.
Also see: `src/services/api-version-service.ts` and `src/repositories/version-catalog-repository.ts` for the operational path that updates rollout state.
Risk if wrong: Version access becomes nondeterministic or rollout changes do not affect live traffic.

## Usage telemetry
Where to look: `src/lib/http/route-utils.ts` — `recordVersionUsage()` logs the request outcome after both success and failure.
Also see: `src/repositories/usage-metric-repository.ts` for persistence and `src/services/api-version-service.ts` for summaries.
Risk if wrong: Deprecated traffic looks smaller than it really is, which makes sunset decisions dangerous.
