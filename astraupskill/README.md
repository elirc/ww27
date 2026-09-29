# ww27 API versioning and safe patches

This course traces a versioned customer profile PATCH through request context, version adapter, runtime schema, service, repository, audit record, and response headers. API compatibility depends on preserving omission and false values, while authorization depends on trusted session context rather than caller supplied ownership. Run `npm install`, `npm test`, and the finite checks recorded in `VERIFICATION.md` from this project folder. The examples use fake repositories for fast tests; they do not claim a live database. Read each chapter against the actual files under `src/lib/versioning`, `src/services`, and `src/repositories`.

The project demonstrates a bounded repair: v1 and v2 contracts map to one canonical domain shape, rollout chooses a known definition, and profile mutation records effective fields. Exercises are separate extensions. Keep the distinction between a type-level adapter and runtime validation visible while studying.
## Prerequisites, glossary and pacing

**Prerequisites:** one Express or Next route-handler project with Zod validation (the `newcodexJS/07` or `ww37` course), and the difference between a PATCH that omits a field and one that sends `null`.

**Glossary.** *Canonical object*: the one internal shape every API version maps to. *Version adapter*: the code that translates a versioned wire payload to and from the canonical object. *Rollout*: which callers get which version (percentage plus allow-list). *Compensation*: undoing an earlier write after a later one failed, by hand; weaker than a transaction. *Audit row*: the record of who changed what, written next to the change.

**Pacing:** map 45 min, concepts 60 min, worked change 90 min, testing 60 min, practice 3-4 h, solutions 45 min, trace lab 45 min.

## Course map

Each exercise names the actor, version, input, expected canonical object, persisted result, and audit record. That order mirrors the application trust boundaries. When a public schema changes, update its adapter, tests, documentation, and compatibility notes together. A version number is a promise to consumers, so removing a field requires a deliberate migration plan. These examples use fake repositories and a deterministic demo session; they teach contracts without claiming production identity, database atomicity, or live traffic safety.

Follow the nine guides in order: map, concepts, worked change, testing, practice, solutions, trace lab, verification, and this index. The implementation traces a versioned PATCH from request context and rollout selection through version-specific parsing, canonical mapping, service authorization, repository persistence, audit logging, and response adaptation. Existing version documents in `docs/` provide the deeper compatibility history; these guides focus on the completed repair.

The examples use the deterministic demo session and fake repositories. They teach ownership and omission semantics without claiming production identity, database transactions, or live traffic safety. A real deployment still needs connection-level atomicity, concurrency tests, secret management, and an operational rollback procedure.

Navigation: [map](01-CODEBASE-MAP.md), [concepts](02-CONCEPTS.md), [worked change](03-WORKED-CHANGE.md), [testing](04-TESTING-AND-DEBUGGING.md), [practice](05-PRACTICE.md), [solutions](06-SOLUTIONS-AND-REVIEW.md), [trace lab](07-TRACE-LAB.md), and [verification](VERIFICATION.md). The [route regression suite](../tests/routes/version-rollout-route.test.ts) and [original adapter snapshot](snapshots/src__lib__versioning__customer-profile-contracts.ts.original) anchor the exercises to executable behavior and immutable source bytes.
