import { describe, expect, it } from "vitest";

import { CustomerProfileService } from "@/services/customer-profile-service";

import {
  InMemoryAuditLogRepository,
  InMemoryCustomerProfileRepository
} from "../fakes/fake-repositories";

const archivedProfile = {
  id: "profile_archived",
  ownerUserId: "user_client_01",
  externalReference: "acct_legacy",
  givenName: "Ada",
  familyName: "Lovelace",
  email: "ada@example.com",
  lifecycleState: "ARCHIVED" as const,
  marketingOptIn: false,
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  updatedAt: new Date("2026-04-02T00:00:00.000Z")
};

const activeProfile = {
  id: "profile_active",
  ownerUserId: "user_client_02",
  externalReference: "acct_live",
  givenName: "Grace",
  familyName: "Hopper",
  email: "grace@example.com",
  lifecycleState: "ACTIVE" as const,
  marketingOptIn: true,
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  updatedAt: new Date("2026-04-02T00:00:00.000Z")
};

describe("CustomerProfileService", () => {
  it("blocks invalid lifecycle transitions from ARCHIVED back to ACTIVE", async () => {
    // Why this test exists:
    // It catches the production bug where archived entities get reactivated and downstream systems treat them as immutable history.
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

  it("does not return another client's profile to a regular client session", async () => {
    // Why this test exists:
    // It catches data-leak regressions where a missing ownership filter exposes records across accounts.
    const service = new CustomerProfileService(
      new InMemoryCustomerProfileRepository([activeProfile]),
      new InMemoryAuditLogRepository()
    );

    await expect(
      service.getProfile(
        {
          userId: "user_client_01",
          role: "CLIENT",
          clientId: "legacy-mobile-app"
        },
        "profile_active"
      )
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404
    });
  });
});
