import { describe, expect, it } from "vitest";

import { getCreateProfileSchema } from "@/lib/validation/customer-profile-schemas";

describe("customer-profile validation boundary", () => {
  it("rejects a malformed v2 payload before it reaches the service layer", () => {
    // Why this test exists:
    // It catches contract drift where the API would otherwise accept a half-migrated v2 payload and persist bad data.
    expect(() =>
      getCreateProfileSchema("v2").parse({
        externalReference: "acct_123",
        name: {
          givenName: "Ada"
        },
        email: "ada@example.com",
        lifecycleState: "ACTIVE",
        marketingOptIn: true
      })
    ).toThrow();
  });
});

import { lifecycleStateSchema } from "@/lib/validation/customer-profile-schemas";

describe("lifecycle vocabulary has one definition", () => {
  it("the schema enum is the list the service accepts", () => {
    expect(lifecycleStateSchema.options).toEqual(["TRIAL", "ACTIVE", "SUSPENDED", "ARCHIVED"]);
    expect(lifecycleStateSchema.safeParse("PAUSED").success).toBe(false);
  });
});
