# Testing and debugging

The staged project initially lacked installed dependencies, so `npm install --ignore-scripts --no-audit --no-fund` was run in the isolated stage. The first test run then exposed a hoisted Vitest mock variable; replacing it with `vi.hoisted` fixed test collection. A second source startup issue came from `**/route.ts` inside a block comment, where `*/` terminated the comment; the affected comments were made syntax-safe. The final finite run is `checks/2c7ac2b52738/ww27-test-08.log`.

The final run passed 10 tests across four suites. This proves the tested adapters, services, validation, and route authorization. It does not prove Prisma durability, transaction rollback, live HTTP, or concurrent rollout writes. When adding a regression, assert a positive nonempty returned record and exact repository arguments. Reset persistent mocks between cases; clearing call history alone does not reset implementations.
## One of the ten tests, in full

The archived-reactivation case named above lives in `tests/services/customer-profile-service.test.ts:37`. It builds the service over in-memory fakes and asserts the exact error code and status, not merely that something was thrown.

```ts
  it("blocks invalid lifecycle transitions from ARCHIVED back to ACTIVE", async () => {
    const service = new CustomerProfileService(
      new InMemoryCustomerProfileRepository([archivedProfile]),
      new InMemoryAuditLogRepository()
    );

    await expect(
      service.updateProfile(
        {
          userId: "user_admin_01",
          role: "ADMIN",
          clientId: "internal-admin"
        },
        "profile_archived",
        {
          lifecycleState: "ACTIVE"
        }
      )
    ).rejects.toMatchObject({
      code: "CONFLICT",
      statusCode: 409
    });
  });
```

## Regression strategy

Use fresh evidence labels for every rerun. A stale green record cannot prove a later source edit.

After a code edit, run the focused service suite first, then the complete test command. Read the generated JSON evidence and log, not merely terminal silence. Typecheck catches framework signatures and union narrowing; lint catches maintainability problems; the Next build catches generated route validators. Prisma validation and generation should use the stage project and must never depend on a canonical database. Keep failures visible in the handoff until a fresh rerun passes.

Use separate fixtures for admin, support, analyst, and client. A client may read and mutate only its own profile, while support and admin may work across owners according to the permission matrix. Assert that a rejected foreign-owner create does not call `create`. For rollout, verify repository state and audit entries before and after invalid requests. Typecheck and build validate framework integration; Vitest validates behavioral contracts. Keep the command record with its exact working directory so independent reviewers can repeat it.

Tests must cross the adapter and service boundary. Assert the actual canonical object passed to a fake repository, then inspect the stored record and audit metadata. Required cases include v1 email-only omission, v2 false consent, unknown version rejection, CLIENT foreign-owner creation, archived reactivation, no-op update, and exact changedFields. For rollout, test unknown versions, invalid bounds, duplicates, zero, one hundred, and unchanged repository/audit state after rejection.

The route suite should also verify PATCH parsing and response status because a correct service can still be bypassed by a permissive route. Use a named fixture for each actor role and avoid relying on a single happy-path admin. Typecheck catches adapter union mistakes, while runtime tests catch unknown strings that TypeScript callers cannot express. Lint and Next build provide separate evidence that the code is consumable by the application.

When a test fails, capture the input, canonical payload, repository calls, audit entries, and process exit code. A green adapter unit test alone cannot prove service ownership enforcement.
