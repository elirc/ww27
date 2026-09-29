# Testing Rationale

`tests/routes/version-rollout-route.test.ts` — `rejects a non-admin caller from changing rollout policy`
- This matters because rollout configuration changes live traffic behavior immediately. If this endpoint loses its admin-only guard, an external client could expand or shut down version access for everyone else.
- The test specifically guards against a production bug where route wiring still validates the payload but forgets the role check in `ApiVersionService.updateRollout()`.
- A more thorough production suite would add audit-log assertions, malformed payload cases, and coverage for internal roles like `SUPPORT` and `ANALYST`.

`tests/validation/customer-profile-schemas.test.ts` — `rejects a malformed v2 payload before it reaches the service layer`
- This matters because version migration work often introduces partial client payloads during rollout. The API needs to fail fast at the boundary instead of letting half-shaped objects hit the domain layer.
- The test guards against a regression where `getCreateProfileSchema("v2")` becomes too permissive and accepts a missing `familyName`.
- A stronger suite would add explicit unknown-key checks, bad enum values, and cross-version tests proving that `v1` and `v2` reject each other’s shapes.

`tests/services/customer-profile-service.test.ts` — `blocks invalid lifecycle transitions from ARCHIVED back to ACTIVE`
- This matters because archived records often represent final or immutable states in downstream systems. If that invariant slips, reactivation can corrupt reporting, audit expectations, or external syncs.
- The test guards against someone moving the transition rule out of `CustomerProfileService` or weakening it during a future feature change.
- A more complete suite would exercise every allowed and disallowed lifecycle transition, plus concurrent update scenarios if the project later adds optimistic locking.

`tests/services/customer-profile-service.test.ts` — `does not return another client's profile to a regular client session`
- This matters because ownership scoping bugs are the fastest way to create a real security incident in CRUD systems.
- The test guards against a regression where `findByIdForSession()` or the service call path stops honoring owner-based visibility.
- A more complete suite would add list-query isolation, admin/support visibility checks, and repository-level integration tests against a real database.
