/*
 * What this file does:
 * Owns business rules for customer profiles: permissions, invalid state transitions, and audit logging.
 * What calls it:
 * src/app/api/platform/customer-profiles/route.ts and src/app/api/platform/customer-profiles/[profileId]/route.ts.
 * What it calls:
 * src/repositories/customer-profile-repository.ts, src/repositories/audit-log-repository.ts, src/lib/auth/permissions.ts, and src/lib/http/api-errors.ts.
 * One thing a junior engineer would likely get wrong:
 * Performing state-transition checks in the route, which makes every new entry point a chance to bypass the rule.
 */

import { lifecycleStateSchema } from "@/lib/validation/customer-profile-schemas";
import { assertCanMutateProfile, assertRole } from "@/lib/auth/permissions";
import { badRequest, conflict, forbidden, notFound } from "@/lib/http/api-errors";
import type { CustomerProfileRepository, ListProfileFilters } from "@/repositories/customer-profile-repository";
import type { AuditLogRepository } from "@/repositories/audit-log-repository";
import type {
  CreateCustomerProfileInput,
  CustomerProfileRecord,
  SessionContext,
  UpdateCustomerProfileInput
} from "@/types/domain";

function assertValidLifecycleTransition(
  current: CustomerProfileRecord,
  nextLifecycleState: UpdateCustomerProfileInput["lifecycleState"]
): void {
  if (!nextLifecycleState || nextLifecycleState === current.lifecycleState) {
    return;
  }

  // ⚠️ SENIOR NOTE: Archived records are often treated as immutable in downstream systems, so reactivating them can corrupt audit assumptions.
  if (current.lifecycleState === "ARCHIVED") {
    throw conflict("Archived profiles cannot transition back to an active state.");
  }
}

function assertValidCreateInput(input: CreateCustomerProfileInput): void {
  for (const [field, value] of Object.entries(input)) {
    if (typeof value === "string" && !value.trim()) {
      throw badRequest(`${field} cannot be blank.`);
    }
  }
  if (!/^\S+@\S+\.\S+$/.test(input.email)) throw badRequest("Email is invalid.");
  if (!lifecycleStateSchema.safeParse(input.lifecycleState).success) {
    throw badRequest("Lifecycle state is invalid.");
  }
  if (typeof input.marketingOptIn !== "boolean") throw badRequest("Marketing preference is invalid.");
}

function assertValidUpdateInput(input: UpdateCustomerProfileInput): void {
  if (Object.keys(input).length === 0) throw badRequest("At least one profile field is required.");
  for (const [field, value] of Object.entries(input)) {
    if (typeof value === "string" && !value.trim()) throw badRequest(`${field} cannot be blank.`);
  }
  if (input.email !== undefined && !/^\S+@\S+\.\S+$/.test(input.email)) {
    throw badRequest("Email is invalid.");
  }
  if (input.lifecycleState !== undefined &&
    !lifecycleStateSchema.safeParse(input.lifecycleState).success) {
    throw badRequest("Lifecycle state is invalid.");
  }
  if (input.marketingOptIn !== undefined && typeof input.marketingOptIn !== "boolean") {
    throw badRequest("Marketing preference is invalid.");
  }
}

export class CustomerProfileService {
  constructor(
    private readonly repository: CustomerProfileRepository,
    private readonly auditLogRepository: AuditLogRepository
  ) {}

  async listProfiles(
    session: SessionContext,
    filters: ListProfileFilters
  ): Promise<CustomerProfileRecord[]> {
    assertRole(session, ["ADMIN", "SUPPORT", "ANALYST", "CLIENT"]);
    return this.repository.listForSession(session, filters);
  }

  async getProfile(session: SessionContext, profileId: string): Promise<CustomerProfileRecord> {
    assertRole(session, ["ADMIN", "SUPPORT", "ANALYST", "CLIENT"]);

    const profile = await this.repository.findByIdForSession(session, profileId);

    if (!profile) {
      throw notFound("Customer profile was not found for this session.");
    }

    return profile;
  }

  async createProfile(
    session: SessionContext,
    input: CreateCustomerProfileInput
  ): Promise<CustomerProfileRecord> {
    assertRole(session, ["ADMIN", "SUPPORT", "CLIENT"]);
    assertValidCreateInput(input);
    if (session.role === "CLIENT" && input.ownerUserId !== session.userId) {
      throw forbidden("Client profiles must be owned by the authenticated client.");
    }

    const profile = await this.repository.create(input);

    await this.auditLogRepository.record({
      actorUserId: session.userId,
      action: "customer_profile.created",
      entityType: "CustomerProfile",
      entityId: profile.id,
      metadata: {
        lifecycleState: profile.lifecycleState,
        ownerUserId: profile.ownerUserId
      }
    });

    return profile;
  }

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
}
