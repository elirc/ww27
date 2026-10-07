# Architecture Overview

This project is a production-style learning app for evolving a public REST API over time without freezing the system in place. Requests enter through Next.js route handlers like `src/app/api/platform/customer-profiles/route.ts`, move through shared request context in `src/lib/http/api-context.ts`, hit validation in `src/lib/validation/customer-profile-schemas.ts`, then flow into services such as `src/services/customer-profile-service.ts` and repositories such as `src/repositories/customer-profile-repository.ts`.

Top-level folder map:
- `src/app` contains the HTTP surface and UI entry points. The versioned API lives under `src/app/api/platform/**`, while the dashboard shell starts in `src/app/page.tsx`.
- `src/lib` contains cross-cutting boundaries. Auth lives in `src/lib/auth/session.ts` and `src/lib/auth/permissions.ts`; request setup lives in `src/lib/http/api-context.ts`; version metadata and rollout logic live in `src/lib/versioning/version-registry.ts` and `src/lib/versioning/version-rollout.ts`.
- `src/services` contains business logic. `src/services/customer-profile-service.ts` owns profile rules like invalid lifecycle transitions, and `src/services/api-version-service.ts` owns rollout updates and usage summaries.
- `src/repositories` contains database access. `src/repositories/customer-profile-repository.ts` scopes profile reads by owner, `src/repositories/version-catalog-repository.ts` persists rollout overrides, and `src/repositories/usage-metric-repository.ts` records per-version usage.
- `prisma` contains the relational model in `prisma/schema.prisma`.
- `docs` contains architecture and learning guides that point back to concrete code paths such as `docs/architecture/request-lifecycle.md` and `docs/learning/flow-traces.md`.
- `tests` contains focused examples of the system boundaries: route auth in `tests/routes/version-rollout-route.test.ts`, validation in `tests/validation/customer-profile-schemas.test.ts`, and service-layer invariants in `tests/services/customer-profile-service.test.ts`.

The central architectural idea is that the canonical domain model stays version-agnostic. `src/lib/versioning/customer-profile-contracts.ts` translates `v1` and `v2` payloads at the HTTP edge, so `CustomerProfileService` only sees canonical fields such as `givenName`, `familyName`, `lifecycleState`, and `marketingOptIn`.

## Request pipeline, with line references

Every profile route repeats the same pattern (`src/app/api/platform/customer-profiles/route.ts:72-120`):

1. `buildApiContext(request)` (`src/lib/http/api-context.ts:45-60`) runs `requireSession`, then resolves the requested version, then applies any runtime rollout override (`getEffectiveVersionDefinition`), then checks `assertVersionAccess`.
2. The route picks the schema for that version and parses the body. Both versions' schemas are strict.
3. The edge adapter turns the payload into canonical input.
4. The service enforces ownership, role, lifecycle, and no-op rules, then writes through the repositories and audit log.
5. `jsonWithVersionHeaders` serializes the versioned response and adds lifecycle headers.
6. `recordVersionUsage` writes a usage row, for errors as well as successes.

## Tests

Four Vitest files hold 13 `it(...)` cases in this clone. `astraupskill/VERIFICATION.md` explains how that relates to the recorded count of 12.

The route test exercises the rollout endpoint's admin guard. The service tests cover:

- archived reactivation
- cross-client reads
- v1 patch mapping
- explicit `false` preservation
- unknown versions
- owner checks on create
- rollout validation and compensation

None of the tests exercises the unsupported-version error path in the profile routes. That path is described under "Known edge case" in `docs/api/v2.md`.
