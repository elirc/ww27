/*
 * What this file does:
 * Renders a small operational dashboard that lets a learner inspect versions, rollout state, and contract differences.
 * What calls it:
 * src/app/page.tsx.
 * What it calls:
 * src/hooks/use-api-versions.ts and src/hooks/use-customer-profiles.ts.
 * One thing a junior engineer would likely get wrong:
 * Letting dashboard components own business logic instead of treating them as a thin read/write shell over the API.
 */

"use client";

import { startTransition, useState } from "react";

import { useApiVersions, useUpdateVersionRollout } from "@/hooks/use-api-versions";
import { useCustomerProfiles } from "@/hooks/use-customer-profiles";
import type { ApiVersionId } from "@/types/domain";

const versionLabels: ApiVersionId[] = ["v1", "v2"];

export function VersionDashboard() {
  const [selectedVersion, setSelectedVersion] = useState<ApiVersionId>("v1");
  const versionsQuery = useApiVersions();
  const profilesQuery = useCustomerProfiles(selectedVersion);
  const rolloutMutation = useUpdateVersionRollout();

  const versions = versionsQuery.data?.versions ?? [];

  return (
    <div className="space-y-8">
      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_50px_rgba(16,33,50,0.08)]">
          <p className="text-sm uppercase tracking-[0.28em] text-sea">Versioning Studio</p>
          <h2 className="mt-3 font-display text-3xl text-ink">
            One route surface, two contracts, and a controlled migration path.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/70">
            The UI is intentionally thin. It calls the real `/api/platform/*` endpoints using demo
            headers so you can trace the same auth, validation, rollout, migration, and telemetry
            path a real client would use.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {versionLabels.map((version) => (
              <button
                key={version}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  selectedVersion === version
                    ? "bg-ink text-white"
                    : "bg-mist text-ink hover:bg-sea hover:text-white"
                }`}
                onClick={() => {
                  startTransition(() => {
                    setSelectedVersion(version);
                  });
                }}
                type="button"
              >
                Explore {version}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-coral/20 bg-coral p-6 text-white shadow-[0_18px_50px_rgba(190,75,73,0.18)]">
          <p className="text-sm uppercase tracking-[0.28em] text-white/70">Backward Compatibility</p>
          <h3 className="mt-3 text-2xl font-semibold">What changes between v1 and v2?</h3>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-white/90">
            <li>`v1` returns `fullName` and a coarse `active/inactive` status.</li>
            <li>`v2` returns a structured `name` object and explicit lifecycle states.</li>
            <li>The service layer never sees either contract directly; it receives canonical DTOs.</li>
          </ul>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {versions.map((version) => (
          <article
            key={version.id}
            className="rounded-[24px] border border-ink/10 bg-white p-5 shadow-[0_12px_32px_rgba(16,33,50,0.06)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-ink">{version.label}</h3>
                <p className="mt-1 text-sm text-ink/60">
                  Lifecycle: <span className="font-medium text-ink">{version.lifecycle}</span>
                </p>
              </div>
              <span className="text-sm font-medium text-sea">{version.docsPath}</span>
            </div>
            <div className="mt-4 space-y-2 text-sm text-ink/75">
              <p>Usage count: {version.usage.totalRequests}</p>
              <p>Rollout: {version.rollout.percentage}%</p>
              <p>Allowlist: {version.rollout.allowlistClientIds.join(", ") || "none"}</p>
              {version.sunsetDate ? <p>Sunset: {version.sunsetDate}</p> : null}
            </div>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-ink/70">
              {version.changelog.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {version.id === "v2" ? (
              <button
                className="mt-5 rounded-full bg-sea px-4 py-2 text-sm font-medium text-white hover:bg-ink"
                disabled={rolloutMutation.isPending}
                onClick={() =>
                  rolloutMutation.mutate({
                    versionId: "v2",
                    percentage: 75,
                    allowlistClientIds: ["beta-client", "internal-admin", "legacy-mobile-app"]
                  })
                }
                type="button"
              >
                Roll v2 out to 75%
              </button>
            ) : null}
          </article>
        ))}
      </section>

      <section className="rounded-[28px] border border-ink/10 bg-white p-6 shadow-[0_18px_50px_rgba(16,33,50,0.08)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-ember">Live Contract Sample</p>
            <h3 className="mt-2 text-2xl font-semibold text-ink">
              Profiles returned through `{selectedVersion}`
            </h3>
          </div>
          {profilesQuery.isFetching ? <span className="text-sm text-ink/50">Refreshing…</span> : null}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {(profilesQuery.data?.profiles ?? []).map((profile) => (
            <pre
              key={profile.id}
              className="overflow-x-auto rounded-[20px] bg-ink p-4 text-xs leading-6 text-mist"
            >
              {JSON.stringify(profile, null, 2)}
            </pre>
          ))}
        </div>

        {profilesQuery.error ? (
          <p className="mt-4 text-sm text-coral">
            {profilesQuery.error instanceof Error ? profilesQuery.error.message : "Failed to load"}
          </p>
        ) : null}
      </section>
    </div>
  );
}
