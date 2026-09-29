/*
 * What this file does:
 * Centralizes role checks and profile ownership rules so authorization stays reviewable.
 * What calls it:
 * src/services/customer-profile-service.ts and src/services/api-version-service.ts.
 * What it calls:
 * src/lib/http/api-errors.ts for 403 failures.
 * One thing a junior engineer would likely get wrong:
 * Checking roles in UI code only and assuming the API is protected because the button is hidden.
 */

import { forbidden } from "@/lib/http/api-errors";
import type { CustomerProfileRecord, SessionContext, UserRole } from "@/types/domain";

export function assertRole(session: SessionContext, allowedRoles: UserRole[]): void {
  if (!allowedRoles.includes(session.role)) {
    throw forbidden(`Role ${session.role} cannot perform this action.`);
  }
}

export function canViewProfile(session: SessionContext, profile: CustomerProfileRecord): boolean {
  if (session.role === "ADMIN" || session.role === "SUPPORT" || session.role === "ANALYST") {
    return true;
  }

  // A future tenant-aware version would replace this with tenantId scoping at the repository boundary.
  return profile.ownerUserId === session.userId;
}

export function assertCanViewProfile(
  session: SessionContext,
  profile: CustomerProfileRecord
): void {
  if (!canViewProfile(session, profile)) {
    throw forbidden("You can only access profiles you own.");
  }
}

export function assertCanMutateProfile(session: SessionContext, profile: CustomerProfileRecord): void {
  if (session.role === "ADMIN" || session.role === "SUPPORT") {
    return;
  }

  // ⚠️ SENIOR NOTE: Ownership checks must be evaluated on the exact child record being changed, not just on a parent list fetch.
  if (session.role === "CLIENT" && profile.ownerUserId === session.userId) {
    return;
  }

  throw forbidden("Only admins, support, or the owning client can mutate this profile.");
}
