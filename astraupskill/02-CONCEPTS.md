# Concepts

An API adapter translates an external contract into one canonical input. Presence matters: `{marketingOptIn:false}` means explicitly disable the flag, while `{}` means leave it unchanged. Padding every optional key with `undefined` makes audit and fake persistence behavior misleading even if Prisma later skips undefined values. A discriminated version contract lets TypeScript narrow v1 and v2 safely; a runtime version check rejects unknown strings before an operational write.

Authorization has two parts. The session identifies the actor, and the service checks whether that actor may create or mutate the owner’s profile. A caller supplied `ownerId` is data, not authority. Rollout validation similarly belongs before repository writes: percentages are bounded integers, allowlist IDs are normalized, and an unknown version cannot be written and only fail later during runtime override. Tests should prove omitted, false, zero, unknown, and foreign-owner cases independently.
## Presence, compatibility, and authority

The canonical model is the stable seam: version-specific names and statuses should not leak into repository or service policy. This keeps later versions additive.

Compatibility also includes error behavior. A malformed v1 request should receive the same safe error envelope as a malformed v2 request, while the success body differs by version. An unknown version is a routing error, not a request that should silently fall back. Explicit errors are easier to monitor and safer for clients than undocumented defaults. Write these expectations as examples before changing a schema so the adapter remains an intentional boundary rather than an accidental collection of casts.

Presence is a data contract, not a formatting detail. A caller can intentionally send false, zero, or an empty array, and each has different meaning. Validation should reject only values the contract declares invalid. The adapter should avoid inventing values for fields the caller omitted. This is why canonical patches are assembled field by field. Runtime version checks protect the same boundary for path parameters, which are strings even when the function signature narrows them. Keep these distinctions visible in tests and audit metadata.

An omitted property means “leave the stored value alone.” It is different from an explicit false, empty string, or null. The update adapters therefore construct a fresh object and assign only keys that are present. A v2 `{marketingOptIn: false}` becomes `{marketingOptIn: false}`; a v1 email-only update has no name keys. This is a runtime rule even though TypeScript’s optional properties document the intended shape.

Compatibility is intentionally lossy in v1. The legacy status maps to the canonical lifecycle, and a single full name is split with `Unknown` as a missing family name. The reverse mapping presents ACTIVE and TRIAL as active. That preserves the public contract without pretending v1 can represent every canonical state. Ownership is also authoritative: a CLIENT session may create only a profile owned by that session, regardless of what a direct caller supplies.

Practice: distinguish omitted, false, and blank values in a table, then identify which layer rejects blank strings and which layer preserves omission.
