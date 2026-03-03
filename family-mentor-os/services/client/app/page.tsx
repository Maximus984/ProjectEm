import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container" style={{ display: "grid", gap: 16 }}>
      <section className="panel">
        <h1>FamilyMentor OS</h1>
        <p className="muted">Adaptive diagnostic runner with AI risk scoring, break control, and mentor review.</p>
      </section>

      <section className="panel" style={{ display: "grid", gap: 8 }}>
        <Link className="button primary" href="/tests/sample-test-id">
          Start Sample Test
        </Link>
      </section>
    </main>
  );
}
