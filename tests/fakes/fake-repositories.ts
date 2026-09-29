import type { AuditLogRepository } from "@/repositories/audit-log-repository";
import type {
  CustomerProfileRepository,
  ListProfileFilters
} from "@/repositories/customer-profile-repository";
import type { UsageMetricRepository, VersionUsageSummary } from "@/repositories/usage-metric-repository";
import type {
  VersionCatalogRepository,
  VersionRuntimeRecord
} from "@/repositories/version-catalog-repository";
import type {
  ApiUsageEvent,
  ApiVersionId,
  CreateCustomerProfileInput,
  CustomerProfileRecord,
  SessionContext,
  UpdateCustomerProfileInput,
  VersionRolloutPolicy
} from "@/types/domain";

function applyVisibility(
  session: SessionContext,
  profiles: CustomerProfileRecord[]
): CustomerProfileRecord[] {
  if (session.role === "ADMIN" || session.role === "SUPPORT" || session.role === "ANALYST") {
    return profiles;
  }

  return profiles.filter((profile) => profile.ownerUserId === session.userId);
}

export class InMemoryCustomerProfileRepository implements CustomerProfileRepository {
  constructor(private readonly profiles: CustomerProfileRecord[]) {}

  async listForSession(
    session: SessionContext,
    filters: ListProfileFilters
  ): Promise<CustomerProfileRecord[]> {
    return applyVisibility(session, this.profiles).filter((profile) => {
      if (filters.email && profile.email !== filters.email) {
        return false;
      }

      if (filters.lifecycleState && profile.lifecycleState !== filters.lifecycleState) {
        return false;
      }

      return true;
    });
  }

  async findByIdForSession(
    session: SessionContext,
    profileId: string
  ): Promise<CustomerProfileRecord | null> {
    return (
      applyVisibility(session, this.profiles).find((profile) => profile.id === profileId) ?? null
    );
  }

  async create(input: CreateCustomerProfileInput): Promise<CustomerProfileRecord> {
    const created: CustomerProfileRecord = {
      id: `profile_${this.profiles.length + 1}`,
      createdAt: new Date("2026-04-13T00:00:00.000Z"),
      updatedAt: new Date("2026-04-13T00:00:00.000Z"),
      ...input
    };

    this.profiles.unshift(created);
    return created;
  }

  async update(profileId: string, input: UpdateCustomerProfileInput): Promise<CustomerProfileRecord> {
    const index = this.profiles.findIndex((profile) => profile.id === profileId);
    const current = this.profiles[index];
    const updated = {
      ...current,
      ...input,
      updatedAt: new Date("2026-04-13T01:00:00.000Z")
    };

    this.profiles[index] = updated;
    return updated;
  }
}

export class InMemoryAuditLogRepository implements AuditLogRepository {
  entries: Array<{
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
  }> = [];

  async record(entry: {
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    this.entries.push(entry);
  }
}

export class InMemoryUsageMetricRepository implements UsageMetricRepository {
  events: ApiUsageEvent[] = [];

  async record(event: ApiUsageEvent): Promise<void> {
    this.events.push(event);
  }

  async summarizeByVersion(): Promise<VersionUsageSummary[]> {
    return ["v1", "v2"].map((versionId) => ({
      versionId: versionId as ApiVersionId,
      totalRequests: this.events.filter((event) => event.versionId === versionId).length
    }));
  }
}

export class InMemoryVersionCatalogRepository implements VersionCatalogRepository {
  constructor(private readonly runtimeByVersion = new Map<ApiVersionId, VersionRuntimeRecord>()) {}

  async listRuntimeState(): Promise<VersionRuntimeRecord[]> {
    return [...this.runtimeByVersion.values()];
  }

  async getRuntimeState(versionId: ApiVersionId): Promise<VersionRuntimeRecord | null> {
    return this.runtimeByVersion.get(versionId) ?? null;
  }

  async updateRollout(versionId: ApiVersionId, rollout: VersionRolloutPolicy): Promise<VersionRuntimeRecord> {
    const value = { id: versionId, rollout };
    this.runtimeByVersion.set(versionId, value);
    return value;
  }
}
