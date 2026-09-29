# Build Journal

## Stage 1 — Chose the API style
- Built: the initial architectural decision around versioned REST routes and a central registry.
- Decision: use REST with a code-owned version registry instead of tRPC or separate route trees per version.
- Why: `src/lib/versioning/version-registry.ts` keeps deprecation metadata, docs paths, and default-version behavior in one place, while `src/app/api/platform/customer-profiles/route.ts` keeps one route surface for both contracts.

## Stage 2 — Defined the canonical domain model
- Built: `prisma/schema.prisma` and `src/types/domain.ts`.
- Decision: store one canonical `CustomerProfile` model and translate contracts at the edge.
- Why: `src/lib/versioning/customer-profile-contracts.ts` can evolve `v1` and `v2` independently while `src/services/customer-profile-service.ts` stays free of version-specific fields.

## Stage 3 — Added auth, permissions, and data boundaries
- Built: `src/lib/auth/session.ts`, `src/lib/auth/permissions.ts`, and `src/repositories/customer-profile-repository.ts`.
- Decision: keep authentication in request setup, role checks in permission utilities, and ownership scoping in the repository.
- Why: `src/lib/http/api-context.ts` authenticates once per request, while `buildVisibilityWhere()` in `src/repositories/customer-profile-repository.ts` prevents cross-account reads at the query layer.

## Stage 4 — Added rollout and deprecation operations
- Built: `src/services/api-version-service.ts`, `src/repositories/version-catalog-repository.ts`, and `src/app/api/platform/versions/[version]/rollout/route.ts`.
- Decision: split static version metadata from mutable rollout state.
- Why: the registry in `src/lib/versioning/version-registry.ts` defines what versions exist, while `updateRollout()` in `src/repositories/version-catalog-repository.ts` changes live traffic behavior without a code edit.

## Stage 5 — Added usage telemetry and audit logging
- Built: `src/repositories/usage-metric-repository.ts`, `src/repositories/audit-log-repository.ts`, and `src/lib/http/route-utils.ts`.
- Decision: log both successful and failed requests.
- Why: deprecation work depends on knowing who is still calling old versions, and failures matter just as much as successes for that decision.

## Stage 6 — Added focused tests and learning docs
- Built: `tests/**`, `docs/architecture/**`, and `docs/learning/**`.
- Decision: prefer a small suite that locks down the riskiest boundaries over broad but shallow coverage.
- Why: the route auth test, validation test, transition test, and ownership test each target a class of failure that would matter in production.

## Major Decisions

### Decision 1 — REST + central version registry
- Why this matters: Versioning touches routing, docs, telemetry, rollout, and deprecation warnings. If those concerns scatter, the system becomes hard to change safely.
- Options:
  - Separate route trees like `/api/v1/*`
    - Pros: easy to reason about per version.
    - Cons: duplicated business orchestration and higher drift risk.
    - Future pain: each new version multiplies handlers and docs.
  - One route surface with ad hoc `if (version)` branching
    - Pros: fewer files at first.
    - Cons: version rules become invisible and hard to review.
    - Future pain: deprecation behavior hides in conditionals.
  - REST with a central registry and edge translators
    - Pros: version policy is explicit and contract translation is isolated.
    - Cons: requires discipline around canonical DTOs.
    - Future pain: registry growth needs strong naming conventions.
- Choice: REST with `src/lib/versioning/version-registry.ts` plus translators in `src/lib/versioning/customer-profile-contracts.ts`.
- Why this won: it gives one inspectable place for policy and keeps core business logic out of version branches.
- What different levels notice:
  - Junior: “there are more files than necessary.”
  - Mid-level: validation and rollout are easier to trace.
  - Senior: contract evolution is now auditable instead of implicit.

### Decision 2 — Canonical storage model with migration at the edge
- Why this matters: Backward compatibility gets expensive if storage starts mirroring public API quirks.
- Options:
  - Separate tables or models per version
    - Pros: simple mapping from endpoint to storage.
    - Cons: duplicate state and migration pain.
    - Future pain: every write path must keep versions in sync.
  - Canonical model with translation in routes
    - Pros: one domain model, versioned contracts stay at the edge.
    - Cons: requires a deliberate migration layer.
    - Future pain: lossy mappings must be documented carefully.
  - Canonical model with version-aware business logic inside services
    - Pros: fewer translation helpers.
    - Cons: services become polluted with contract details.
    - Future pain: every rule change risks breaking an old client.
- Choice: canonical model plus `toCanonicalCreateInput()` and `toVersionedCustomerProfile()`.
- Why this won: the service layer in `src/services/customer-profile-service.ts` stays stable while contracts evolve.
- What different levels notice:
  - Junior: translation feels like extra work.
  - Mid-level: version-specific validation becomes cleaner.
  - Senior: storage remains durable even as contracts churn.

### Decision 3 — Runtime rollout state stored separately from code registry
- Why this matters: version rollout is an operational concern, not just an engineering one.
- Options:
  - Hard-code rollout percentages in the registry only
    - Pros: simplest implementation.
    - Cons: every rollout needs a redeploy.
    - Future pain: operational teams lose agility.
  - In-memory runtime overrides only
    - Pros: easy to demo.
    - Cons: not durable across instances.
    - Future pain: rollout state drifts between processes.
  - Persist runtime rollout in a repository and merge it into the registry
    - Pros: durable operational control with explicit static metadata.
    - Cons: slightly more moving pieces.
    - Future pain: requires thought about cache invalidation at scale.
- Choice: `src/repositories/version-catalog-repository.ts` persists mutable rollout state, and `src/services/api-version-service.ts` merges it with the static registry.
- Why this won: it keeps runtime operations flexible without making the version registry opaque.
- What different levels notice:
  - Junior: “why not just edit the constant?”
  - Mid-level: runtime behavior now matches the admin endpoint.
  - Senior: rollout operations no longer require code deployment.

## PR Slices

### Slice 1 — Version registry, canonical model, and Prisma schema
- Purpose in one sentence: Establish the domain model and central version metadata before adding behavior.
- Novel logic files:
  - `prisma/schema.prisma`
  - `src/types/domain.ts`
  - `src/lib/versioning/version-registry.ts`
  - `src/lib/versioning/customer-profile-contracts.ts`
- Reviewer focus:
  - `src/lib/versioning/version-registry.ts`: verify lifecycle/default-version flags and docs paths near `versionRegistry`.
  - `src/lib/versioning/customer-profile-contracts.ts`: verify the `v1` to canonical migration near `toCanonicalCreateInput()`.
  - `prisma/schema.prisma`: verify the canonical `CustomerProfile` shape and the audit/usage tables.
- Strong reviewer flag: a junior reviewer might accept lossy `v1` mappings without calling out the missing `marketingOptIn` representation.

### Slice 2 — Auth, permissions, and repository scoping
- Purpose in one sentence: Add explicit auth and ownership boundaries before CRUD routes exist.
- Novel logic files:
  - `src/lib/auth/session.ts`
  - `src/lib/auth/permissions.ts`
  - `src/repositories/customer-profile-repository.ts`
  - `src/lib/http/api-context.ts`
- Reviewer focus:
  - `src/lib/auth/permissions.ts`: verify `CLIENT` ownership logic in `assertCanMutateProfile()`.
  - `src/repositories/customer-profile-repository.ts`: verify `buildVisibilityWhere()` and every query that uses it.
  - `src/lib/http/api-context.ts`: verify runtime version resolution happens before rollout checks.
- Strong reviewer flag: a junior reviewer might approve read scoping at the service layer instead of insisting on query-layer scoping.

### Slice 3 — Profile CRUD and lifecycle rules
- Purpose in one sentence: Add the real business behavior for listing, creating, and updating profiles.
- Novel logic files:
  - `src/services/customer-profile-service.ts`
  - `src/app/api/platform/customer-profiles/route.ts`
  - `src/app/api/platform/customer-profiles/[profileId]/route.ts`
  - `src/lib/validation/customer-profile-schemas.ts`
- Reviewer focus:
  - `src/services/customer-profile-service.ts`: verify `assertValidLifecycleTransition()` and audit writes.
  - `src/app/api/platform/customer-profiles/route.ts`: verify edge migration from versioned payloads to canonical DTOs.
  - `src/lib/validation/customer-profile-schemas.ts`: verify strict version-specific schemas.
- Strong reviewer flag: a junior reviewer might accept business rules inside the route because the route is “small enough.”

### Slice 4 — Rollout operations, telemetry, and usage tracking
- Purpose in one sentence: Make version management observable and operationally controllable.
- Novel logic files:
  - `src/services/api-version-service.ts`
  - `src/repositories/version-catalog-repository.ts`
  - `src/repositories/usage-metric-repository.ts`
  - `src/repositories/audit-log-repository.ts`
  - `src/app/api/platform/versions/[version]/rollout/route.ts`
- Reviewer focus:
  - `src/services/api-version-service.ts`: verify `updateRollout()` audits changes and `getEffectiveVersionDefinition()` merges runtime overrides.
  - `src/app/api/platform/versions/[version]/rollout/route.ts`: verify only `ADMIN` can reach the operational write path.
  - `src/repositories/usage-metric-repository.ts`: verify failures and successes are both recordable.
- Strong reviewer flag: a junior reviewer might ignore missing telemetry on error paths because the endpoint “already returns the right status.”

### Slice 5 — Frontend learning shell, tests, and docs
- Purpose in one sentence: Add a thin UI plus the code-anchored guides and focused tests that make the project teachable.
- Novel logic files:
  - `src/components/version-dashboard.tsx`
  - `src/hooks/use-api-versions.ts`
  - `src/hooks/use-customer-profiles.ts`
  - `tests/routes/version-rollout-route.test.ts`
  - `tests/services/customer-profile-service.test.ts`
  - `tests/validation/customer-profile-schemas.test.ts`
- Reviewer focus:
  - `src/components/version-dashboard.tsx`: verify the UI calls the API instead of bypassing it.
  - `tests/routes/version-rollout-route.test.ts`: verify the test fails for the intended security reason.
  - `docs/learning/flow-traces.md`: verify every trace names real files and functions from the codebase.
- Strong reviewer flag: a junior reviewer might approve docs that describe abstractions without checking whether the file paths and function names are real.
