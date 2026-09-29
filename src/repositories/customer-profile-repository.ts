/*
 * What this file does:
 * Owns database access for customer profiles, including the read-scope rules that prevent ownership leaks.
 * What calls it:
 * src/services/customer-profile-service.ts.
 * What it calls:
 * src/lib/db/prisma.ts and src/types/domain.ts.
 * One thing a junior engineer would likely get wrong:
 * Fetching the row by id first and applying ownership checks afterwards, which can leak existence information.
 */

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type {
  CreateCustomerProfileInput,
  CustomerProfileRecord,
  ProfileLifecycleState,
  SessionContext,
  UpdateCustomerProfileInput
} from "@/types/domain";

export interface ListProfileFilters {
  email?: string;
  lifecycleState?: ProfileLifecycleState;
}

export interface CustomerProfileRepository {
  listForSession(
    session: SessionContext,
    filters: ListProfileFilters
  ): Promise<CustomerProfileRecord[]>;
  findByIdForSession(
    session: SessionContext,
    profileId: string
  ): Promise<CustomerProfileRecord | null>;
  create(input: CreateCustomerProfileInput): Promise<CustomerProfileRecord>;
  update(profileId: string, input: UpdateCustomerProfileInput): Promise<CustomerProfileRecord>;
}

function buildVisibilityWhere(session: SessionContext): Prisma.CustomerProfileWhereInput {
  if (session.role === "ADMIN" || session.role === "SUPPORT" || session.role === "ANALYST") {
    return {};
  }

  // Client-owned scoping lives here so every query path shares the same isolation rule.
  // ⚠️ SENIOR NOTE: If this filter moves out of the repository, one forgotten query can become a cross-account data leak.
  return { ownerUserId: session.userId };
}

function mapProfile(record: {
  id: string;
  ownerUserId: string;
  externalReference: string;
  givenName: string;
  familyName: string;
  email: string;
  lifecycleState: ProfileLifecycleState;
  marketingOptIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CustomerProfileRecord {
  return {
    id: record.id,
    ownerUserId: record.ownerUserId,
    externalReference: record.externalReference,
    givenName: record.givenName,
    familyName: record.familyName,
    email: record.email,
    lifecycleState: record.lifecycleState,
    marketingOptIn: record.marketingOptIn,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export class PrismaCustomerProfileRepository implements CustomerProfileRepository {
  async listForSession(
    session: SessionContext,
    filters: ListProfileFilters
  ): Promise<CustomerProfileRecord[]> {
    const records = await prisma.customerProfile.findMany({
      where: {
        ...buildVisibilityWhere(session),
        email: filters.email,
        lifecycleState: filters.lifecycleState
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return records.map(mapProfile);
  }

  async findByIdForSession(
    session: SessionContext,
    profileId: string
  ): Promise<CustomerProfileRecord | null> {
    const record = await prisma.customerProfile.findFirst({
      where: {
        id: profileId,
        ...buildVisibilityWhere(session)
      }
    });

    return record ? mapProfile(record) : null;
  }

  async create(input: CreateCustomerProfileInput): Promise<CustomerProfileRecord> {
    const record = await prisma.customerProfile.create({
      data: input
    });

    return mapProfile(record);
  }

  async update(profileId: string, input: UpdateCustomerProfileInput): Promise<CustomerProfileRecord> {
    const record = await prisma.customerProfile.update({
      where: {
        id: profileId
      },
      data: input
    });

    return mapProfile(record);
  }
}
