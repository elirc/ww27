/*
 * What this file does:
 * Applies gradual rollout rules so newer versions can be introduced without forcing every client at once.
 * What calls it:
 * src/lib/http/api-context.ts calls assertVersionAccess() while building request context.
 * What it calls:
 * src/lib/http/api-errors.ts for safe 403 responses.
 * One thing a junior engineer would likely get wrong:
 * Using Math.random() per request, which makes version access flicker for the same client.
 */

import { forbidden } from "@/lib/http/api-errors";
import type { SessionContext, VersionDefinition } from "@/types/domain";

function stableBucket(clientId: string): number {
  return [...clientId].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 100;
}

export function assertVersionAccess(session: SessionContext, version: VersionDefinition): void {
  if (session.role === "ADMIN" || session.role === "SUPPORT" || session.role === "ANALYST") {
    return;
  }

  if (version.rollout.allowlistClientIds.includes(session.clientId)) {
    return;
  }

  // ⚠️ SENIOR NOTE: Rollout checks must be stable per client or users will see nondeterministic behavior.
  if (stableBucket(session.clientId) < version.rollout.percentage) {
    return;
  }

  throw forbidden(`Version ${version.id} is not rolled out to client ${session.clientId} yet.`);
}
