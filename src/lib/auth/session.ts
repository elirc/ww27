/*
 * What this file does:
 * Builds a request-scoped session object from incoming headers so routes can enforce auth centrally.
 * What calls it:
 * src/lib/http/api-context.ts calls requireSession() for every protected API route.
 * What it calls:
 * src/lib/http/api-errors.ts for consistent 401 responses.
 * One thing a junior engineer would likely get wrong:
 * Reading auth headers directly in each route and accidentally letting one route skip authentication.
 */

import { NextRequest } from "next/server";

import { unauthorized } from "@/lib/http/api-errors";
import type { SessionContext, UserRole } from "@/types/domain";

const validRoles = new Set<UserRole>(["ADMIN", "SUPPORT", "ANALYST", "CLIENT"]);

export function requireSession(request: NextRequest): SessionContext {
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role") as UserRole | null;
  const clientId = request.headers.get("x-client-id");
  const email = request.headers.get("x-user-email") ?? undefined;

  if (!userId || !role || !clientId || !validRoles.has(role)) {
    throw unauthorized(
      "Missing demo session headers. Provide x-user-id, x-user-role, and x-client-id."
    );
  }

  // ⚠️ SENIOR NOTE: This header-based adapter is for learning only; production code should derive identity from a signed session or token.
  return {
    userId,
    role,
    clientId,
    email
  };
}
