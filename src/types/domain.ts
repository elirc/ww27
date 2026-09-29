export type UserRole = "ADMIN" | "SUPPORT" | "ANALYST" | "CLIENT";
export type ApiVersionId = "v1" | "v2";
export type VersionLifecycle = "CURRENT" | "DEPRECATED" | "BETA";
export type ProfileLifecycleState = "TRIAL" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";

export interface SessionContext {
  userId: string;
  role: UserRole;
  clientId: string;
  email?: string;
}

export interface CustomerProfileRecord {
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
}

export interface CreateCustomerProfileInput {
  ownerUserId: string;
  externalReference: string;
  givenName: string;
  familyName: string;
  email: string;
  lifecycleState: ProfileLifecycleState;
  marketingOptIn: boolean;
}

export interface UpdateCustomerProfileInput {
  givenName?: string;
  familyName?: string;
  email?: string;
  lifecycleState?: ProfileLifecycleState;
  marketingOptIn?: boolean;
}

export interface VersionRolloutPolicy {
  percentage: number;
  allowlistClientIds: string[];
}

export interface VersionDefinition {
  id: ApiVersionId;
  label: string;
  lifecycle: VersionLifecycle;
  isDefault: boolean;
  deprecationDate?: string;
  sunsetDate?: string;
  docsPath: string;
  changelog: string[];
  rollout: VersionRolloutPolicy;
}

export interface ApiUsageEvent {
  versionId: ApiVersionId;
  actorUserId?: string;
  route: string;
  method: string;
  statusCode: number;
  deprecationFired: boolean;
}
