import { VersionDashboard } from "@/components/version-dashboard";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fff6e8_0%,#f4efe6_45%,#e5efe8_100%)] px-6 py-10 text-ink">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[36px] border border-white/70 bg-white/80 p-8 shadow-[0_20px_60px_rgba(16,33,50,0.08)] backdrop-blur">
          <p className="text-sm uppercase tracking-[0.34em] text-sea">Learning Project</p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl leading-tight">
            API Versioning + Backward Compatibility Platform
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-ink/70">
            This project teaches how stronger backend engineers evolve contracts over time:
            version negotiation, per-version validation, migration layers, deprecation handling,
            usage analytics, rollout controls, and explicit authorization all live in code you can
            trace file by file.
          </p>
        </section>

        <div className="mt-8">
          <VersionDashboard />
        </div>
      </div>
    </main>
  );
}
