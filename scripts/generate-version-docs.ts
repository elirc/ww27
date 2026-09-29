import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { listVersions } from "../src/lib/versioning/version-registry";

function renderVersionDoc(versionId: "v1" | "v2") {
  if (versionId === "v1") {
    return `# Customer Profiles API v1

Source of truth:
- Registry: \`src/lib/versioning/version-registry.ts\`
- Schemas: \`src/lib/validation/customer-profile-schemas.ts\`
- Mappers: \`src/lib/versioning/customer-profile-contracts.ts\`
- Routes: \`src/app/api/platform/customer-profiles/route.ts\` and \`src/app/api/platform/customer-profiles/[profileId]/route.ts\`

Lifecycle:
- Status: DEPRECATED
- Default version: yes
- Sunset: 2026-12-31

Shape:
\`\`\`json
{
  "id": "profile_123",
  "externalReference": "acct_legacy",
  "fullName": "Ada Lovelace",
  "email": "ada@example.com",
  "status": "active",
  "createdAt": "2026-04-13T00:00:00.000Z"
}
\`\`\`

Migration notes:
- \`fullName\` is split by \`toCanonicalCreateInput()\` in \`src/lib/versioning/customer-profile-contracts.ts\`.
- Legacy \`status\` maps into the canonical lifecycle state machine before the service layer runs.
- Responses emit \`Deprecation\`, \`Warning\`, and \`Sunset\` headers in \`jsonWithVersionHeaders()\` inside \`src/lib/http/api-response.ts\`.
`;
  }

  return `# Customer Profiles API v2

Source of truth:
- Registry: \`src/lib/versioning/version-registry.ts\`
- Schemas: \`src/lib/validation/customer-profile-schemas.ts\`
- Mappers: \`src/lib/versioning/customer-profile-contracts.ts\`
- Routes: \`src/app/api/platform/customer-profiles/route.ts\` and \`src/app/api/platform/customer-profiles/[profileId]/route.ts\`

Lifecycle:
- Status: CURRENT
- Default version: no
- Rollout: controlled by \`updateRollout()\` in \`src/services/api-version-service.ts\`

Shape:
\`\`\`json
{
  "id": "profile_123",
  "externalReference": "acct_modern",
  "name": {
    "givenName": "Ada",
    "familyName": "Lovelace"
  },
  "email": "ada@example.com",
  "lifecycleState": "ACTIVE",
  "marketingOptIn": true,
  "createdAt": "2026-04-13T00:00:00.000Z"
}
\`\`\`

Migration notes:
- v2 exposes the canonical lifecycle state directly.
- \`marketingOptIn\` is now first-class in the public contract.
- Gradual rollout is enforced in \`assertVersionAccess()\` inside \`src/lib/versioning/version-rollout.ts\`.
`;
}

async function main() {
  for (const version of listVersions()) {
    const outputPath = resolve(process.cwd(), version.docsPath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, renderVersionDoc(version.id), "utf8");
  }
}

void main();
