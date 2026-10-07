# Solutions and review

A strong solution uses a discriminated or validated version branch, constructs patches from present keys, and preserves false values. It obtains profile ownership from the trusted actor context and checks lifecycle before persistence. Rollout validation rejects unknown versions and invalid bounds before operational configuration or audit. The route test must use the real `PATCH` handler and a hoisted mock factory so the module graph is valid.

Reviewers should inspect whether changed fields describe effective input, whether repository arguments omit undefined properties, and whether a foreign owner can be supplied directly to the service. They should compare independent before and after snapshots and verify a positive result. Sequential fake calls are not evidence of real transaction atomicity. The demo session, fake repositories, and local rollout configuration must remain labeled as teaching limits.
## The order the review keeps asking about

`src/services/customer-profile-service.ts:122` is where "validate before each side effect" is either true or not. Every guard runs before `repository.update`, and the audit record is written after it — with `Object.keys(input)`, which is why the review question about changed fields describing *effective input* matters.

```ts
  async updateProfile(
    session: SessionContext,
    profileId: string,
    input: UpdateCustomerProfileInput
  ): Promise<CustomerProfileRecord> {
    const existing = await this.getProfile(session, profileId);

    assertCanMutateProfile(session, existing);
    assertValidUpdateInput(input);
    assertValidLifecycleTransition(existing, input.lifecycleState);

    const updated = await this.repository.update(profileId, input);

    await this.auditLogRepository.record({
      actorUserId: session.userId,
      action: "customer_profile.updated",
      entityType: "CustomerProfile",
      entityId: profileId,
      metadata: {
        changedFields: Object.keys(input)
      }
    });

    return updated;
  }
```

## Review answers

State limits in the handoff so reviewers know exactly what fake repositories and unit tests prove.

For a senior review, inspect whether the validation happens before each side effect, whether the session supplies ownership, and whether the repository receives a whitelist of mutable fields. Then inspect the route’s response adapter for accidental canonical leakage. A good patch is small because it strengthens existing seams: explicit guards, presence-aware mapping, exact audit fields, and known registry versions. A broad type assertion or fallback branch may reduce visible errors while making the contract less reliable.

The solution favors explicit guards because their failure modes are reviewable. Broad casts make TypeScript quiet while allowing runtime shapes to drift. A discriminated branch or validated predicate documents why a payload is safe. Audit fields should describe effective canonical changes, not the public request’s container shape. The reviewer should also confirm that unknown versions fail before repository writes and that false consent survives every layer. Limitations belong in the handoff rather than hidden behind green unit tests.

The adapter is the right place to translate names and statuses because the service should consume one canonical model. The service is the right place to enforce ownership, role, lifecycle, and no-op policy because direct callers must receive the same protections as routes. The repository is the right place to apply session read scope, while audit metadata belongs after a successful repository operation.

Review the changed-fields array against the input object, not the full profile. Object.keys on a padded object is evidence of a compatibility bug. Review false values explicitly. Review unknown versions at runtime even if the function parameter is typed as `ApiVersionId`, because route params and JSON are untrusted strings. For rollout, reject before writes and retain the admin-only guard.

A remaining limitation is sequential profile and audit persistence: fake repositories demonstrate call ordering, not cross-connection atomicity. Document that honestly and require a transaction-capable repository before claiming stronger guarantees.

## Senior review: findings beyond the PATCH path

These were found by reading this clone. None was reproduced by a test.

| # | Severity | Location | Finding |
|---|---|---|---|
| 1 | High (demo) | `src/lib/auth/session.ts:19-38` | Identity, role, and `clientId` all come from request headers. Any caller can claim `ADMIN`, which makes every authorization rule in the services advisory until a signed session replaces this adapter. |
| 2 | Medium | `src/app/api/platform/customer-profiles/route.ts:57-69` (and the same pattern in the `[profileId]` route) | An unknown `x-api-version` throws `badRequest` in `buildApiContext`. The `catch` block then calls `getRequestedVersion(request)` again, which throws outside the `try`, so the caller sees a framework 500 instead of 400. |
| 3 | Medium | `customer-profiles/route.ts:99-104` | Usage recording is awaited on the success path. A metrics failure after a successful create or update returns an error to the client, and a retry may then duplicate the write. |
| 4 | Medium | `src/lib/versioning/version-rollout.ts:15-17, 24-31` | Rollout bucketing sums character codes mod 100, and `clientId` is caller-chosen, so the rollout gate is trivially bypassable and poorly distributed. |
| 5 | Low | `src/lib/versioning/customer-profile-contracts.ts:86-101` | v1 round-trips are lossy. Single-word names gain the family name "Unknown". `TRIAL` reads as `active`, and writing `active` back turns it into `ACTIVE`. |
| 6 | Low | `src/lib/http/api-response.ts:36-38` | `Sunset` is a bare date rather than an HTTP-date. `deprecationDate` from the registry is never emitted. |
| 7 | Low | `src/lib/versioning/version-registry.ts:15-19` | The default version is the deprecated one, so clients that send no version keep landing on v1 until the default is switched. |
