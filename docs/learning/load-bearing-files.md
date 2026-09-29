# Load-Bearing Files

## src/lib/http/api-context.ts
- What it does: Builds the authenticated, version-aware request context for every protected route.
- What calls it: `src/app/api/platform/customer-profiles/route.ts`, `src/app/api/platform/customer-profiles/[profileId]/route.ts`, and `src/app/api/platform/versions/[version]/rollout/route.ts`.
- What it calls: `src/lib/auth/session.ts`, `src/services/api-version-service.ts`, and `src/lib/versioning/version-rollout.ts`.
- What would break or become insecure if this file were wrong: Routes could skip auth, ignore rollout controls, or resolve the wrong version.
- What a junior engineer would likely miswrite here: Applying rollout checks before loading runtime overrides.

## src/lib/versioning/customer-profile-contracts.ts
- What it does: Converts `v1` and `v2` payloads to canonical DTOs and back into version-specific responses.
- What calls it: Both profile route files under `src/app/api/platform/customer-profiles/**`.
- What it calls: `src/types/domain.ts`.
- What would break or become insecure if this file were wrong: Older clients could stop working, or the service layer could start depending on public-contract quirks.
- What a junior engineer would likely miswrite here: Mixing public API field names directly into service-layer types.

## src/services/customer-profile-service.ts
- What it does: Owns profile business rules, mutation permissions, and invalid lifecycle transitions.
- What calls it: `src/app/api/platform/customer-profiles/route.ts` and `src/app/api/platform/customer-profiles/[profileId]/route.ts`.
- What it calls: `src/lib/auth/permissions.ts`, `src/repositories/customer-profile-repository.ts`, and `src/repositories/audit-log-repository.ts`.
- What would break or become insecure if this file were wrong: Unauthorized profile changes, invalid archived-state transitions, or missing audit trails.
- What a junior engineer would likely miswrite here: Enforcing lifecycle rules only on one route instead of all mutation entry points.

## src/repositories/customer-profile-repository.ts
- What it does: Reads and writes customer profiles, including ownership-aware visibility filters.
- What calls it: `src/services/customer-profile-service.ts`.
- What it calls: `src/lib/db/prisma.ts`.
- What would break or become insecure if this file were wrong: A missing visibility filter would cause a cross-account data leak.
- What a junior engineer would likely miswrite here: Fetching by id and filtering in memory afterwards.

## src/services/api-version-service.ts
- What it does: Lists version summaries, applies runtime rollout overrides, updates rollout state, and records usage.
- What calls it: `src/app/api/platform/versions/route.ts`, `src/app/api/platform/versions/[version]/rollout/route.ts`, and `src/lib/http/api-context.ts`.
- What it calls: `src/repositories/version-catalog-repository.ts`, `src/repositories/usage-metric-repository.ts`, and `src/repositories/audit-log-repository.ts`.
- What would break or become insecure if this file were wrong: Rollout changes would not affect traffic correctly, or operational changes would go unaudited.
- What a junior engineer would likely miswrite here: Returning only database state and forgetting the registry-backed metadata.

## src/lib/validation/customer-profile-schemas.ts
- What it does: Defines the version-aware Zod validation boundary.
- What calls it: The profile routes and the rollout route.
- What it calls: `zod`.
- What would break or become insecure if this file were wrong: Invalid or future-only fields could bypass contract checks and corrupt downstream assumptions.
- What a junior engineer would likely miswrite here: Sharing one permissive schema between `v1` and `v2`.

## src/app/api/platform/customer-profiles/route.ts
- What it does: Orchestrates list and create requests for customer profiles.
- What calls it: Browser hooks in `src/hooks/use-customer-profiles.ts` and external clients.
- What it calls: `src/lib/http/api-context.ts`, `src/lib/validation/customer-profile-schemas.ts`, `src/lib/versioning/customer-profile-contracts.ts`, `src/services/customer-profile-service.ts`, and `src/lib/http/route-utils.ts`.
- What would break or become insecure if this file were wrong: Requests could skip validation, bypass migration, or miss telemetry/deprecation headers.
- What a junior engineer would likely miswrite here: Pushing business rules down into the handler.

## src/app/api/platform/versions/[version]/rollout/route.ts
- What it does: Exposes an admin-only operational endpoint for rollout control.
- What calls it: `src/components/version-dashboard.tsx` via `src/hooks/use-api-versions.ts`.
- What it calls: `src/lib/http/api-context.ts`, `src/lib/validation/customer-profile-schemas.ts`, `src/services/api-version-service.ts`, and `src/lib/http/route-utils.ts`.
- What would break or become insecure if this file were wrong: Non-admin callers could change live rollout state or invalid rollout configs could be persisted.
- What a junior engineer would likely miswrite here: Assuming the path segment `v2` is enough validation for the target version.
