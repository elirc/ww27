# Guided Reading Path

## Step 1 — src/lib/versioning/version-registry.ts
**Why read this:** It is the source of truth for supported versions, deprecation state, docs paths, and default-version behavior.
**What to look for:** How `versionRegistry`, `listVersions()`, and `getDefaultVersion()` keep version metadata centralized.
**What to trace:** Read next into `src/services/api-version-service.ts` and `src/lib/http/api-context.ts`, which consume this registry.
**What a junior would likely miss:** The registry is not just documentation; it is runtime policy.

## Step 2 — src/lib/http/api-context.ts
**Why read this:** Every protected route passes through this file before validation or business logic.
**What to look for:** `buildApiContext()` composes auth, version negotiation, rollout checks, and runtime overrides.
**What to trace:** It calls `src/lib/auth/session.ts`, `src/services/api-version-service.ts`, and `src/lib/versioning/version-rollout.ts`; routes under `src/app/api/platform/**` call it.
**What a junior would likely miss:** Runtime rollout overrides have to be applied before access checks.

## Step 3 — src/lib/auth/session.ts
**Why read this:** It is the authentication boundary for the demo API.
**What to look for:** The exact headers required by `requireSession()`.
**What to trace:** `src/lib/http/api-context.ts` calls it; failures become `401` through `src/lib/http/api-errors.ts`.
**What a junior would likely miss:** Reading auth directly in routes leads to inconsistent protection.

## Step 4 — src/lib/auth/permissions.ts
**Why read this:** This file defines the reusable authorization rules the services rely on.
**What to look for:** `assertRole()` versus `assertCanMutateProfile()`, and why they are separate.
**What to trace:** `src/services/customer-profile-service.ts` and `src/services/api-version-service.ts` both call into it.
**What a junior would likely miss:** Ownership checks must target the exact record, not just the surrounding screen.

## Step 5 — src/lib/validation/customer-profile-schemas.ts
**Why read this:** It shows where the API contract is enforced before the service layer.
**What to look for:** `getCreateProfileSchema()` and `getUpdateProfileSchema()` returning different schemas per version.
**What to trace:** `src/app/api/platform/customer-profiles/route.ts`, `src/app/api/platform/customer-profiles/[profileId]/route.ts`, and `src/app/api/platform/versions/[version]/rollout/route.ts`.
**What a junior would likely miss:** Strict schemas are crucial when two versions coexist.

## Step 6 — src/lib/versioning/customer-profile-contracts.ts
**Why read this:** This is the migration layer between public contracts and canonical storage.
**What to look for:** `toCanonicalCreateInput()`, `toCanonicalUpdateInput()`, and `toVersionedCustomerProfile()`.
**What to trace:** The profile routes call it before and after `src/services/customer-profile-service.ts`.
**What a junior would likely miss:** Lossy backwards mappings should stay isolated here instead of leaking into services.

## Step 7 — src/services/customer-profile-service.ts
**Why read this:** It is the core business-logic owner for profile flows.
**What to look for:** `createProfile()`, `getProfile()`, `listProfiles()`, and `updateProfile()`, especially `assertValidLifecycleTransition()`.
**What to trace:** It is called by both profile route files and calls `src/repositories/customer-profile-repository.ts` plus `src/repositories/audit-log-repository.ts`.
**What a junior would likely miss:** State-transition rules belong here, not in the route.

## Step 8 — src/repositories/customer-profile-repository.ts
**Why read this:** It shows the real data boundary and the ownership isolation query.
**What to look for:** `buildVisibilityWhere()`, `listForSession()`, and `findByIdForSession()`.
**What to trace:** Called only by `src/services/customer-profile-service.ts`; it calls `src/lib/db/prisma.ts`.
**What a junior would likely miss:** Filtering after fetching is too late for security.

## Step 9 — src/services/api-version-service.ts
**Why read this:** It owns the operational side of versioning: rollout updates, usage summaries, and runtime definition resolution.
**What to look for:** `listVersionSummaries()`, `getEffectiveVersionDefinition()`, `updateRollout()`, and `recordUsage()`.
**What to trace:** Routes under `src/app/api/platform/versions/**` call it, and `src/lib/http/api-context.ts` depends on it during every request.
**What a junior would likely miss:** Version rollout is operational state, not just static metadata.

## Step 10 — src/repositories/version-catalog-repository.ts
**Why read this:** It persists the mutable rollout data that the registry alone cannot express.
**What to look for:** `getRuntimeState()` and `updateRollout()`.
**What to trace:** Only `src/services/api-version-service.ts` calls it; it calls `src/lib/db/prisma.ts`.
**What a junior would likely miss:** Mutable runtime state should not require a code redeploy.

## Step 11 — src/app/api/platform/customer-profiles/route.ts
**Why read this:** It demonstrates the intended route-handler shape for versioned REST endpoints.
**What to look for:** Thin orchestration: `buildApiContext()`, schema parse, contract migration, service call, response mapping, telemetry.
**What to trace:** It calls `src/lib/http/api-context.ts`, `src/lib/validation/customer-profile-schemas.ts`, `src/lib/versioning/customer-profile-contracts.ts`, `src/services/customer-profile-service.ts`, and `src/lib/http/route-utils.ts`.
**What a junior would likely miss:** Routes should orchestrate boundaries, not own business rules.

## Step 12 — src/app/api/platform/versions/[version]/rollout/route.ts
**Why read this:** It is the clearest example of an operational endpoint with strong permissions.
**What to look for:** How version parsing, auth, validation, admin-only service logic, and telemetry fit together.
**What to trace:** It calls `src/lib/http/api-context.ts`, `src/lib/validation/customer-profile-schemas.ts`, `src/services/api-version-service.ts`, and `src/lib/http/route-utils.ts`.
**What a junior would likely miss:** Operational endpoints often deserve stricter review than CRUD because they change live traffic behavior.

## Step 13 — tests/routes/version-rollout-route.test.ts
**Why read this:** It shows the API boundary being tested where auth mistakes actually matter.
**What to look for:** A route-level permission rejection without booting the full app.
**What to trace:** The test hits `src/app/api/platform/versions/[version]/rollout/route.ts`, which in turn exercises `src/lib/http/api-context.ts` and `src/services/api-version-service.ts`.
**What a junior would likely miss:** Good tests isolate the failure mode instead of trying to stand up everything.
