# Verification

Dependencies were installed in the isolated stage with `npm install --ignore-scripts --no-audit --no-fund`; the result is recorded as `checks/2c7ac2b52738/ww27-install-03.json`. The final finite command was `npm.cmd test -- --testTimeout=30000`, recorded as `checks/2c7ac2b52738/ww27-test-18.json`, and passed 12 tests in four suites (`ww27-test-08` was an earlier run with 11 tests; the intermediate `ww27-test-09` run had one failure that was fixed before the final run). The route test’s hoisted mock and syntax-safe source comments are included in the staged source.

This handoff does not claim lint, typecheck, build, live database, browser, deployed authentication, or concurrent rollout verification. The stage uses fake repositories and a local demo session. The immutable baseline comparison identifies the seven changed source/test files listed in the delivery spec. The original project folder and personal data were not modified. Reviewer follow-up should add adapter-to-service persistence argument assertions and run the remaining portable checks before applying.

## Run it yourself

```powershell
node --version            # 22.16.x was used for the recorded run
npm install
npx prisma generate       # only needed if the client is missing; tests use fake repositories
npm test                  # vitest run
```

Expected summary line: `Test Files  4 passed (4)` and `Tests  12 passed (12)`. The four files are `tests/routes/version-rollout-route.test.ts`, `tests/services/customer-profile-service.test.ts`, `tests/services/versioned-profile-service.test.ts` and `tests/validation/customer-profile-schemas.test.ts`. `npm run typecheck` is not defined; use `npx tsc --noEmit` (its result for the fix pass is in `evidence/`).

## Limits

The suites use fake repositories and a demo session: they prove the service and route contracts, not database transactions, live authentication or concurrent rollout behavior. Chapter 3 shows what a real `prisma.$transaction` around rollout and audit would look like and why the current in-process compensation is weaker.
