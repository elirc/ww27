# Auth And Permissions

Authentication flow:
- Session extraction happens in `src/lib/auth/session.ts` inside `requireSession()`. The check is at the top of the file and throws `UNAUTHORIZED` before routes proceed if `x-user-id`, `x-user-role`, or `x-client-id` are missing.
- Request setup happens in `src/lib/http/api-context.ts` inside `buildApiContext()`. The middle of that file calls `requireSession()`, resolves the requested version, merges rollout overrides through `services.apiVersions.getEffectiveVersionDefinition()`, and then applies `assertVersionAccess()`.

Authorization flow:
- Role checks are centralized in `src/lib/auth/permissions.ts`. `assertRole()` is the generic guard used by `CustomerProfileService.listProfiles()`, `CustomerProfileService.createProfile()`, and `ApiVersionService.updateRollout()`.
- Ownership checks are also centralized in `src/lib/auth/permissions.ts`. `assertCanMutateProfile()` enforces that only `ADMIN`, `SUPPORT`, or the owning `CLIENT` can modify a profile.
- Read isolation is enforced lower in the stack in `src/repositories/customer-profile-repository.ts`. `buildVisibilityWhere()` scopes client reads by `ownerUserId`, so `findByIdForSession()` and `listForSession()` never fetch another client's rows in the first place.

Role matrix in this codebase:
- `ADMIN`
  Can list profiles, read any profile, create profiles, update profiles, and change rollout state through `ApiVersionService.updateRollout()` in `src/services/api-version-service.ts`.
- `SUPPORT`
  Can list profiles, read any profile, create profiles, and update profiles through `src/services/customer-profile-service.ts`, but cannot change rollout because `ApiVersionService.updateRollout()` only accepts `ADMIN`.
- `ANALYST`
  Can list and read profiles through `CustomerProfileService.listProfiles()` and `CustomerProfileService.getProfile()`, but cannot mutate profiles or rollout.
- `CLIENT`
  Can list and read only owned profiles because `src/repositories/customer-profile-repository.ts` scopes queries by `ownerUserId`.
  Can update only owned profiles because `assertCanMutateProfile()` checks `profile.ownerUserId === session.userId`.
  Cannot change rollout because `assertRole(session, ["ADMIN"])` rejects inside `ApiVersionService.updateRollout()`.

Version access:
- `src/lib/versioning/version-rollout.ts` contains `assertVersionAccess()`. This runs before validation or service logic and gates `CLIENT` access by percentage rollout and allowlist.
- Internal roles bypass rollout checks in that file so support and admin tooling can inspect versions that are not fully rolled out yet.

Audit and operational safety:
- `src/services/customer-profile-service.ts` writes audit records through `PrismaAuditLogRepository.record()` after create and update.
- `src/services/api-version-service.ts` writes an audit record after rollout changes so operational changes are traceable.

Multi-tenancy status:
- Multi-tenancy is not included. The realistic boundary in this project is user ownership rather than tenant membership.
- To add multi-tenancy later, `tenantId` would need to be added to `User`, `CustomerProfile`, `ApiUsageLog`, and `AuditLog` in `prisma/schema.prisma`.
- `buildVisibilityWhere()` in `src/repositories/customer-profile-repository.ts` would need to scope every query by `tenantId`, not just `ownerUserId`.
- `SessionContext` in `src/types/domain.ts` and `requireSession()` in `src/lib/auth/session.ts` would need to carry `tenantId`.
- `assertCanMutateProfile()` in `src/lib/auth/permissions.ts` would need a separate tenant-level rule so platform roles and org roles stay distinct.
