# Domain Model

```mermaid
erDiagram
  User ||--o{ CustomerProfile : owns
  User ||--o{ AuditLog : authors
  User ||--o{ ApiUsageLog : triggers
  ApiVersion ||--o{ ApiUsageLog : records

  User {
    string id
    string email
    string name
    UserRole role
    string clientId
  }

  CustomerProfile {
    string id
    string ownerUserId
    string externalReference
    string givenName
    string familyName
    string email
    ProfileLifecycleState lifecycleState
    boolean marketingOptIn
  }

  ApiVersion {
    string id
    VersionLifecycle lifecycle
    boolean isDefault
    int rolloutPercentage
    json allowlistJson
  }

  ApiUsageLog {
    string id
    string versionId
    string actorUserId
    string route
    string method
    int statusCode
  }

  AuditLog {
    string id
    string actorUserId
    string action
    string entityType
    string entityId
  }
```

Entities:
- `User`
  Schema/model: `prisma/schema.prisma` in the `model User` block.
  Primary service owner: `src/services/api-version-service.ts` for operational actions and `src/services/customer-profile-service.ts` for ownership-sensitive profile flows.
- `CustomerProfile`
  Schema/model: `prisma/schema.prisma` in the `model CustomerProfile` block.
  Primary service owner: `src/services/customer-profile-service.ts`.
- `ApiVersion`
  Schema/model: `prisma/schema.prisma` in the `model ApiVersion` block.
  Primary service owner: `src/services/api-version-service.ts`.
- `ApiUsageLog`
  Schema/model: `prisma/schema.prisma` in the `model ApiUsageLog` block.
  Primary service owner: `src/services/api-version-service.ts`, which calls `recordUsage()`.
- `AuditLog`
  Schema/model: `prisma/schema.prisma` in the `model AuditLog` block.
  Primary service owner: both `src/services/customer-profile-service.ts` and `src/services/api-version-service.ts` write through `src/repositories/audit-log-repository.ts`.

Contract note:
- `CustomerProfile` is the canonical storage model. `src/lib/versioning/customer-profile-contracts.ts` derives the `v1` and `v2` API contracts from it rather than storing version-specific tables.
