import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mockGetEffectiveVersionDefinition: vi.fn(),
  mockUpdateRollout: vi.fn(),
  mockRecordUsage: vi.fn()
}));

vi.mock("@/lib/server/container", () => ({
  services: {
    apiVersions: {
      getEffectiveVersionDefinition: mocks.mockGetEffectiveVersionDefinition,
      updateRollout: mocks.mockUpdateRollout,
      recordUsage: mocks.mockRecordUsage
    }
  }
}));

import { PATCH } from "@/app/api/platform/versions/[version]/rollout/route";

describe("PATCH /api/platform/versions/[version]/rollout", () => {
  beforeEach(() => {
    mocks.mockGetEffectiveVersionDefinition.mockReset();
    mocks.mockUpdateRollout.mockReset();
    mocks.mockRecordUsage.mockReset();

    mocks.mockGetEffectiveVersionDefinition.mockResolvedValue({
      id: "v2",
      label: "Customer Profiles v2",
      lifecycle: "CURRENT",
      isDefault: false,
      docsPath: "docs/api/v2.md",
      changelog: [],
      rollout: {
        percentage: 40,
        allowlistClientIds: ["beta-client"]
      }
    });
  });

  it("rejects a non-admin caller from changing rollout policy", async () => {
    // Why this test exists:
    // It catches an authorization regression where external clients could change live rollout configuration for other clients.
    const request = new NextRequest("http://localhost/api/platform/versions/v2/rollout", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-user-id": "user_client_01",
        "x-user-role": "CLIENT",
        "x-client-id": "legacy-mobile-app"
      },
      body: JSON.stringify({
        percentage: 100,
        allowlistClientIds: []
      })
    });

    const response = await PATCH(request, {
      params: Promise.resolve({
        version: "v2"
      })
    });

    expect(response.status).toBe(403);
    expect(mocks.mockUpdateRollout).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body.code).toBe("FORBIDDEN");
  });
});
