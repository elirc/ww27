# Codebase map

Start at `src/app/api/platform/customer-profiles/route.ts` and its profile ID route. `src/lib/http/api-context.ts` builds version-aware request context, while `api-response.ts` adds version and deprecation headers. `src/lib/versioning/customer-profile-contracts.ts` adapts v1 and v2 payloads. `src/lib/validation/customer-profile-schemas.ts` owns runtime input checks. `customer-profile-service.ts` enforces actor scope and lifecycle rules. `api-version-service.ts` evaluates rollout configuration and writes audit records. Repository files under `src/repositories` are the persistence seam; `tests/fakes/fake-repositories.ts` supplies controlled doubles.

The test folders mirror these boundaries: validation tests check malformed values, service tests exercise ownership and patch semantics, and the route test checks admin authorization. Read callers before changing a response shape. A required field in a backend schema must appear in the client request type, and a 204 response must not be parsed as JSON. The map is project-relative so learners can run examples after delivery.
## Trace map

Usage telemetry is recorded after a response exists, so metrics reflect the selected version and status. Keep this side effect distinct from profile persistence.

When following a call, mark each boundary as trusted session data, validated public data, canonical data, or persistence output. Bugs often appear when one category is silently treated as another. The route may choose a schema, but it cannot grant a role. The adapter may translate names, but it cannot decide whether an archived profile is mutable. The repository may scope reads, but it should not invent API response shapes. This map gives reviewers a repeatable vocabulary for those decisions.

Reviewers should follow both success and failure paths. A rejected version must stop before service calls, and a rejected profile mutation must leave repository and audit records untouched. The route utility converts domain errors to public responses while preserving version metadata. This separation keeps the service reusable by jobs and tests. Start from the route, then inspect the canonical adapter, service, repository, and response adapter in that order. Record which values came from the session and which came from JSON; only the session is authoritative for ownership and tenant scope.

The route obtains a version context, validates the request, and calls an adapter. `customer-profile-contracts.ts` is the boundary: v1 `fullName` and `status` become canonical names and lifecycle state, while v2 nested `name`, lifecycle, and consent remain explicit. The service owns role checks, owner scope, lifecycle transitions, repository calls, and effective audit fields. The repository applies owner filtering before returning data. A response adapter translates the canonical record back to the selected public version.

The rollout route follows a parallel path. The API version service checks that the version exists in the registry, validates an integer percentage and unique nonblank allowlist IDs, then writes runtime state and audit. `applyRuntimeOverride` is only called after validation, so an unknown version cannot write operational state and fail later. Read the source in that order and annotate every boundary where static TypeScript types become runtime data.

Exercise: for a v1 email-only PATCH, list which files execute and which canonical fields must remain untouched.
