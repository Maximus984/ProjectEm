import { projectTiers } from "@projectm/contracts";

const tierNotes: Record<keyof typeof projectTiers, string> = {
  PREMIUM_GENIUS:
    "Studio hardware reserved for your child. Advanced projects and premium 1:1 mentorship.",
  BYOD_MENTORSHIP:
    "Bring-your-own-device sessions with focused technical and business logic coaching.",
  STANDARD_CARE:
    "Structured childcare with mentorship touchpoints and foundational learning support."
};

export function TiersPage() {
  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-white md:text-4xl">ProjectM Tiers</h1>
        <p className="mt-2 text-mist">Flexible mentorship modes for every family rhythm.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(projectTiers).map(([key, tier]) => (
          <article key={key} className="panel rounded-2xl p-5 shadow-glow">
            <p className="text-xs uppercase tracking-[0.22em] text-aurora">{key.replaceAll("_", " ")}</p>
            <h2 className="mt-2 font-display text-xl text-white">{tier.label}</h2>
            <p className="mt-1 text-2xl font-semibold text-flare">${tier.pricePerHour}/hr</p>
            <p className="mt-3 text-sm leading-relaxed text-mist">{tierNotes[key as keyof typeof projectTiers]}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
