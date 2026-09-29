# Practice

Create a fake profile with name, email, and marketing consent. Call the v1 adapter with an email-only patch and assert the resulting object has no name key. Call v2 with `marketingOptIn:false` and assert `Object.hasOwn` is true and the value remains false. Call the service directly with another owner’s ID and verify zero repository writes. Call rollout update with percentage 101, a fractional percentage, duplicate allowlist IDs, and an unknown version; assert each fails before upsert or audit.

Next, add a test for an archived profile transition and one for an empty patch. Decide whether the contract rejects or treats the empty patch as a no-op, then document that decision in the service test. Inspect the route caller after any schema change. Use the installed stage only, and record each command with a fresh label. Do not use live traffic, personal databases, seeded credentials, or an external provider.
## Practice fixtures

The v1 response hides consent while v2 exposes it, yet both originate from one canonical stored record. That is the compatibility promise under test.

Add a property-based variation mentally: reorder JSON keys, omit optional values, change false to true, and vary the rollout boundary. The canonical result should depend on values and presence, never key order. Then submit the same request twice and inspect whether the repository and audit semantics are idempotent or intentionally append-only. If the system lacks an idempotency key, document that as a limit rather than inventing one in a teaching fixture. Exercises should reveal contracts and limitations together.

Use dates with an explicit UTC interpretation so the exercise does not change by machine timezone. Try a boundary amount at the safe integer limit and one beyond it. The service should reject unsafe money values before creating a draft. Do the same with a lowercase currency and an invalid calendar date. Then inspect the fake repository’s stored object: identity fields come from the session or canonical input, never from arbitrary route metadata. Repeat the fixture through a route request and compare the public response with the internal record.

Create three records: one owned by the client, one owned by another client, and one archived record owned by the client. Run v1 email-only and v2 false-consent updates against the first. Attempt the foreign-owner create and archived reactivation. Record repository row counts and audit entries after every operation. Rejected operations should leave both unchanged.

For rollout, start with an empty runtime repository. Submit percentage zero, then one hundred with one allowlisted client. Ask the fake repository for its runtime state and compare the service response. Submit a fractional value, a duplicate allowlist, and an unknown version; after each rejection assert the previous runtime record and audit count are unchanged. Finally call the rollout decision function twice with the same client identity and verify a stable result.

The goal is to observe omission and authority in persisted arguments, not merely HTTP status codes. Include the exact JSON fixture in your lab notes so another learner can repeat the exercise.
