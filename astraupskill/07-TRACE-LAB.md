# Trace lab

Compare each trace with a matching assertion so claims have executable evidence rather than prose alone.

Record a rejected trace as carefully as a successful one. Include the actor role, tenant, version string, payload, first failing guard, repository call count, audit count, and public error. This demonstrates fail-before-write behavior. For a successful trace, include the canonical patch keys and the effective response. For rollout, include the prior runtime state and the resulting definition. These traces become useful review artifacts because they show both authorization and compatibility at the point where they interact.

Capture the route context before reading the body. Version selection affects both schema choice and response headers, but it must not affect tenant authorization. Trace a client update to another owner and identify the repository call that returns no row. Trace an admin rollout change and compare the static registry definition with the runtime override. For both flows, note which failures happen before persistence. A useful trace has input JSON, canonical DTO, repository arguments, audit metadata, response body, and status code.

Trace a PATCH with `{email:"new@example.test"}`. Request context resolves the version and actor, the v1 adapter maps the payload, runtime validation accepts the email, the service loads the profile and computes an effective patch, and the repository receives only email. The response adapter adds version headers. Repeat with `{marketingOptIn:false}` and track the false value at every boundary. Repeat with an omitted consent field and confirm it is absent rather than converted to false.

Trace a rejected rollout. The route authenticates an administrator, the service parses percentage and allowlist, unknown or out-of-range input fails, and neither configuration nor audit changes. Trace a foreign-owner direct service call and mark where a trusted actor should override caller data. Finally compare this fake flow with a real database deployment: sequential awaits do not themselves prove one atomic transaction or stable concurrent rollout versions.

Trace a v2 PATCH containing `{name:{givenName:"Ada",familyName:"Lovelace"}, marketingOptIn:false}`. The route resolves version context, the adapter emits four canonical keys, the service loads the session-scoped record, validates each value, and the repository receives the exact effective patch. The audit event lists `name`-mapped canonical fields and `marketingOptIn`; the response adapter restores the nested v2 shape.

Now remove `marketingOptIn`. Confirm the repository argument has no consent key. Send an unknown route version and verify failure occurs before adapter selection or repository activity. Send a v1 payload with `fullName` and status and observe the intentionally lossy mapping. Finally trace rollout update: admin authorization, candidate validation, repository runtime write, audit, and effective summary. A failed candidate must have no runtime or audit side effect.

Write down where static narrowing ends and runtime validation begins. That boundary is the reason `assertSupportedVersion` exists.

## Where static narrowing ends

The last paragraph of this lab points at `src/lib/versioning/customer-profile-contracts.ts:80`. It is an assertion function, so TypeScript narrows a `string` to `ApiVersionId` only because a runtime check ran — which is exactly the boundary your unknown-version trace crosses.

```ts
function assertSupportedVersion(version: string): asserts version is ApiVersionId {
  if (version !== "v1" && version !== "v2") {
    throw new Error(`Version ${version} is not supported.`);
  }
}
```

