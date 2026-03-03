"use client";

type ItemResult = {
  itemId: string;
  prompt: string;
  answer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
  timeSpentSec: number;
};

type SectionResult = {
  sectionId: string;
  title: string;
  correctCount: number;
  total: number;
  items: ItemResult[];
};

export function ResultsTable({ sections }: { sections: SectionResult[] }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {sections.map((section) => (
        <section className="panel" key={section.sectionId}>
          <h3 style={{ marginTop: 0 }}>{section.title}</h3>
          <p className="muted">
            {section.correctCount}/{section.total} correct
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {section.items.map((item) => (
              <article key={item.itemId} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10 }}>
                <p style={{ marginTop: 0 }}>{item.prompt}</p>
                <p className={item.isCorrect ? "ok" : "bad"} data-testid={`result-${item.itemId}`}>
                  {item.isCorrect ? "Correct" : "Incorrect"}
                </p>
                <p className="muted" style={{ marginBottom: 4 }}>
                  Your answer: {item.answer ?? "(blank)"}
                </p>
                <p className="muted" style={{ marginBottom: 4 }}>
                  Correct answer: {item.correctAnswer}
                </p>
                <p className="muted" style={{ marginBottom: 0 }}>
                  Time spent: {item.timeSpentSec}s
                </p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
