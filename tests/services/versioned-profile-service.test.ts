import { describe, expect, it } from "vitest";

import { ApiVersionService } from "@/services/api-version-service";
import { CustomerProfileService } from "@/services/customer-profile-service";
import {
  toCanonicalUpdateInput,
  toVersionedCustomerProfile
} from "@/lib/versioning/customer-profile-contracts";

import {
  InMemoryAuditLogRepository,
  InMemoryCustomerProfileRepository,
  InMemoryUsageMetricRepository,
  InMemoryVersionCatalogRepository
} from "../fakes/fake-repositories";

const clientSession = {
  userId: "user_client_01",
  role: "CLIENT" as const,
  clientId: "client_01"
};

const profile = {
  id: "profile_1",
  ownerUserId: clientSession.userId,
  externalReference: "acct_1",
  givenName: "Ada",
  familyName: "Lovelace",
  email: "ada@example.com",
  lifecycleState: "ACTIVE" as const,
  marketingOptIn: true,
  createdAt: new Date("2026-04-01T00:00:00.000Z"),
  updatedAt: new Date("2026-04-02T00:00:00.000Z")
};

describe("version adapters and profile service", () => {
  it("maps a v1 email-only patch without padded undefined fields", async () => {
    const patch = toCanonicalUpdateInput("v1", { email: "new@example.com" });
    expect(patch).toEqual({ email: "new@example.com" });

    const repository = new InMemoryCustomerProfileRepository([{ ...profile }]);
    const audit = new InMemoryAuditLogRepository();
    const service = new CustomerProfileService(repository, audit);
    const updated = await service.updateProfile(clientSession, profile.id, patch);

    expect(updated.givenName).toBe("Ada");
    expect(updated.familyName).toBe("Lovelace");
    expect(updated.email).toBe("new@example.com");
    expect(audit.entries[0]?.metadata.changedFields).toEqual(["email"]);
  });

  it("preserves an explicit false v2 marketing preference", () => {
    expect(toCanonicalUpdateInput("v2", { marketingOptIn: false })).toEqual({
      marketingOptIn: false
    });
  });

  it("rejects unknown versions instead of selecting the v2 branch", () => {
    expect(() => toCanonicalUpdateInput("v9" as never, {})).toThrow(/not supported/i);
    expect(() => toVersionedCustomerProfile("v9" as never, profile)).toThrow(/not supported/i);
  });

  it("rejects a CLIENT create for another owner before repository persistence", async () => {
    const repository = new InMemoryCustomerProfileRepository([]);
    const service = new CustomerProfileService(repository, new InMemoryAuditLogRepository());

    await expect(service.createProfile(clientSession, {
      ownerUserId: "other-user",
      externalReference: "acct_2",
      givenName: "Grace",
      familyName: "Hopper",
      email: "grace@example.com",
      lifecycleState: "TRIAL",
      marketingOptIn: false
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await repository.listForSession(clientSession, {})).toEqual([]);
  });

  it("rejects archived reactivation and no-op updates", async () => {
    const archived = { ...profile, lifecycleState: "ARCHIVED" as const };
    const service = new CustomerProfileService(
      new InMemoryCustomerProfileRepository([archived]),
      new InMemoryAuditLogRepository()
    );
    await expect(service.updateProfile(clientSession, archived.id, { lifecycleState: "ACTIVE" }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    await expect(service.updateProfile(clientSession, archived.id, {}))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("rollout candidate validation", () => {
  it("rejects invalid version and rollout candidates before fake writes or audit", async () => {
    const repository = new InMemoryVersionCatalogRepository();
    const audit = new InMemoryAuditLogRepository();
    const service = new ApiVersionService(repository, new InMemoryUsageMetricRepository(), audit);
    const admin = { userId: "admin", role: "ADMIN" as const, clientId: "internal" };

    await expect(service.updateRollout(admin, "v9" as never, {
      percentage: 50,
      allowlistClientIds: []
    })).rejects.toThrow(/not supported/i);
    await expect(service.updateRollout(admin, "v2", {
      percentage: 101,
      allowlistClientIds: []
    })).rejects.toThrow(/percentage/i);
    await expect(service.updateRollout(admin, "v2", {
      percentage: 50,
      allowlistClientIds: ["client_1", "client_1"]
    })).rejects.toThrow(/unique/i);

    expect(await repository.listRuntimeState()).toEqual([]);
    expect(audit.entries).toEqual([]);
  });

  it("accepts zero and one-hundred percent boundaries and records the effective rollout", async () => {
    const repository = new InMemoryVersionCatalogRepository();
    const audit = new InMemoryAuditLogRepository();
    const service = new ApiVersionService(repository, new InMemoryUsageMetricRepository(), audit);
    const admin = { userId: "admin", role: "ADMIN" as const, clientId: "internal" };

    await service.updateRollout(admin, "v2", { percentage: 0, allowlistClientIds: [] });
    const full = await service.updateRollout(admin, "v2", {
      percentage: 100,
      allowlistClientIds: ["client_1"]
    });

    expect(full.rollout).toEqual({ percentage: 100, allowlistClientIds: ["client_1"] });
    expect(audit.entries).toHaveLength(2);
  });

  it("compensates the rollout when audit persistence fails", async () => {
    const repository = new InMemoryVersionCatalogRepository(new Map([["v2", {
      id: "v2", rollout: { percentage: 10, allowlistClientIds: ["client_old"] }
    }]]));
    const audit = { record: async () => { throw new Error("audit unavailable"); } };
    const service = new ApiVersionService(repository, new InMemoryUsageMetricRepository(), audit);
    await expect(service.updateRollout({ userId: "admin", role: "ADMIN", clientId: "internal" }, "v2", {
      percentage: 90, allowlistClientIds: ["client_new"]
    })).rejects.toThrow("audit unavailable");
    expect(await repository.getRuntimeState("v2")).toEqual({ id: "v2", rollout: { percentage: 10, allowlistClientIds: ["client_old"] } });
  });
});
