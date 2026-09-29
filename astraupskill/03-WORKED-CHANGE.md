# Worked change

The adapter now creates a patch from keys actually present in the request. That preserves `false` marketing consent and prevents an audit list from claiming that omitted fields changed. The canonical service validates the effective patch, resolves the owner from trusted session context, and rejects archived reactivation before calling the repository. The rollout service validates the version and percentage before upserting operational configuration or recording audit.

Trace a v1 email-only PATCH: the route resolves version v1, the adapter returns an object containing only `email`, the service retains the stored name, and the repository receives an effective changed-field set with one key. Trace v2 with `marketingOptIn:false`: the false value remains present through adapter, service, fake repository, and audit. Then send an unknown version and confirm no repository or audit call occurs. These examples use the production adapter and service functions, not a toy algorithm.
## The shapes, in code

The v1 contract carries `{ email }` and the v2 contract adds `marketingOptIn`; both map to one canonical object. `assertSupportedVersion` (`src/lib/versioning/customer-profile-contracts.ts:80`) is the guard that turns an unknown version header into a 400 instead of a silent default:

```typescript
function assertSupportedVersion(version: string): asserts version is ApiVersionId {
  if (version !== "v1" && version !== "v2") {
    throw new Error(`Version ${version} is not supported.`);
  }
}

function splitFullName(fullName: string): { givenName: string; familyName: string } {
  const [givenName, ...rest] = fullName.trim().split(/\s+/);
```

A v1 PATCH that omits `marketingOptIn` must not flip an existing `true` to `false`; the canonical object records only the fields the version can express, and `marketingOptIn: false` is written only when v2 sent it explicitly (see `customer-profile-contracts.ts:77` for the presence test).

The rollout service's compensation block (`src/services/api-version-service.ts:119`):

```typescript
    try {
      await this.auditLogRepository.record({
        actorUserId: session.userId,
        action: "api_version.rollout_updated",
        entityType: "ApiVersion",
        entityId: versionId,
        metadata: {
          percentage: rollout.percentage,
          allowlistClientIds: rollout.allowlistClientIds
        }
      });
    } catch (error) {
      // Compensation: the rollout write already committed, so put it back before surfacing the error.
      // This is weaker than a transaction (see chapter 3): a crash between the two writes leaves the
      // rollout changed with no audit row.
      const definition = getVersionDefinition(versionId);
      if (!previous && !definition) {
        throw error;
      }
      await this.versionCatalogRepository.updateRollout(versionId, previous?.rollout ?? definition!.rollout);
      throw error;
    }
```

## The transaction lesson the limits point to

The compensation above is not a transaction. If the process dies after `updateRollout` and before `record`, the rollout is changed and no audit row exists; if `record` fails, the compensating `updateRollout` can itself fail. With Prisma the two writes belong in one interactive transaction:

```typescript
await prisma.$transaction(async (tx) => {
  await tx.apiVersion.update({ where: { id: versionId }, data: { rolloutPercentage: rollout.percentage, allowlist: rollout.allowlistClientIds } });
  await tx.auditLog.create({ data: { actorUserId: session.userId, action: "api_version.rollout_updated", entityType: "ApiVersion", entityId: versionId, metadata: rollout } });
});
```

Both rows appear or neither does, and there is no compensation code to get wrong. The fake repositories in this course cannot demonstrate it; the Prisma projects in this batch (`ww17`, `master 6`) do.

## Worked PATCH

The returned rollout definition combines registry documentation with operational state, preventing a database row from becoming an unsupported public version.

The effective changed-fields list should be built after canonical translation. If a caller sends a v1 full name, two canonical name fields changed even though one public property appeared. If the caller sends only email, no name field belongs in the audit. This distinction helps incident responders understand actual data movement and prevents later maintainers from mistaking undefined padding for an intentional reset. The same rule applies to allowlists: preserve a valid empty list and reject absent or malformed values according to the declared contract.

An adapter test should inspect the exact object handed to the service. For v1 `{email}` the object has one key; it is not a full profile-shaped object. The service then applies role and ownership rules independent of version. This prevents a new API version from accidentally bypassing existing policy. The response adapter may hide canonical fields for compatibility, but it must never mutate the canonical record while doing so. A rollout update follows the same sequence: authorize, validate, persist, audit, return the effective definition.

Suppose v1 sends `{email: "new@example.com"}`. The adapter emits exactly one canonical key. The service finds the profile through the session-scoped repository, confirms the client can mutate it, validates the email, persists the patch, and records `changedFields: ["email"]`. Names and consent survive because they were never placed in the repository update object.

For v2, `{marketingOptIn: false}` must remain false through parsing, service validation, fake repository persistence, audit metadata, and response mapping. Truthiness checks are wrong here: `if (input.marketingOptIn)` would erase the explicit change. An archived profile rejects a lifecycle transition before repository writes. An empty object is rejected as a no-op so callers receive a clear contract instead of an audit event with no effective change.

The rollout version follows the same fail-before-write pattern. Unknown versions, 101 percent, fractional percentages, blank IDs, and duplicate IDs are rejected before the fake repository or audit log changes.
