"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "../../../../lib/api";
import { ResultsTable } from "../../../../components/ResultsTable";

type ResultResponse = {
  attemptId: string;
  status: string;
  scorePercent: number;
  riskScore: number | null;
  aiCheck: {
    similarityScore: number;
    stylometryScore: number;
    aiGeneratedProbability: number;
    speedingFlag: number;
    tabBlurScore: number;
    pasteEvents: number;
    explanation: string;
  } | null;
  sections: Array<{
    sectionId: string;
    title: string;
    correctCount: number;
    total: number;
    items: Array<{
      itemId: string;
      prompt: string;
      answer: string | null;
      correctAnswer: string;
      isCorrect: boolean;
      timeSpentSec: number;
    }>;
  }>;
};

export default function ResultsPage() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = params.attemptId;

  const [note, setNote] = useState("");
  const [overrideStatus, setOverrideStatus] = useState<string>("");

  const query = useQuery({
    queryKey: ["result", attemptId],
    queryFn: async () => {
      const { data } = await api.get<ResultResponse>(`/api/tests/attempt/${attemptId}/results`);
      return data;
    }
  });

  const role = typeof window !== "undefined" ? window.localStorage.getItem("fm_role") ?? "" : "";
  const canOverride = ["MENTOR", "OWNER", "MANAGER", "ADMIN"].includes(role);

  const topSignals = useMemo(() => {
    if (!query.data?.aiCheck) {
      return [];
    }

    const rows = [
      { label: "Similarity", score: query.data.aiCheck.similarityScore },
      { label: "Stylometry", score: query.data.aiCheck.stylometryScore },
      { label: "Speeding", score: query.data.aiCheck.speedingFlag },
      { label: "Tab Blur", score: query.data.aiCheck.tabBlurScore },
      { label: "Paste Events", score: query.data.aiCheck.pasteEvents * 20 }
    ];

    return rows.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [query.data?.aiCheck]);

  async function override(verdict: "APPROVED" | "FLAGGED" | "CLEARED") {
    if (!note.trim()) {
      setOverrideStatus("Add an audit note before override.");
      return;
    }

    await api.post(`/api/attempts/${attemptId}/override`, {
      verdict,
      note
    });

    setOverrideStatus(`Override recorded: ${verdict}`);
  }

  if (query.isLoading) {
    return (
      <main className="container">
        <section className="panel">Loading results...</section>
      </main>
    );
  }

  if (!query.data) {
    return (
      <main className="container">
        <section className="panel">No result data available.</section>
      </main>
    );
  }

  return (
    <main className="container" style={{ display: "grid", gap: 16 }}>
      <section className="panel" style={{ display: "grid", gap: 8 }}>
        <h1 style={{ margin: 0 }}>Attempt Results</h1>
        <p className="muted">Student review mode is read-only. Correct and incorrect details are visible below.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="tag">Score: {query.data.scorePercent}%</span>
          <span className="tag">Status: {query.data.status}</span>
          <span className="tag">Risk: {query.data.riskScore ?? "N/A"}</span>
        </div>
      </section>

      {query.data.aiCheck ? (
        <section className="panel" style={{ display: "grid", gap: 8 }}>
          <h2 style={{ margin: 0 }}>Integrity Signals</h2>
          <p className="muted" style={{ margin: 0 }}>{query.data.aiCheck.explanation}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="tag">Similarity {query.data.aiCheck.similarityScore.toFixed(1)}</span>
            <span className="tag">Stylometry {query.data.aiCheck.stylometryScore.toFixed(1)}</span>
            <span className="tag">AI Prob {query.data.aiCheck.aiGeneratedProbability.toFixed(2)}</span>
          </div>
          <div>
            <strong>Top contributing signals:</strong>
            <ul>
              {topSignals.map((item) => (
                <li key={item.label}>
                  {item.label}: {item.score.toFixed(1)}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <ResultsTable sections={query.data.sections} />

      {canOverride ? (
        <section className="panel" style={{ display: "grid", gap: 8 }}>
          <h2 style={{ margin: 0 }}>Mentor Override</h2>
          <textarea
            className="textarea"
            rows={3}
            placeholder="Audit note required"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="button" type="button" onClick={() => void override("APPROVED")}>Approve</button>
            <button className="button" type="button" onClick={() => void override("FLAGGED")}>Flag</button>
            <button className="button" type="button" onClick={() => void override("CLEARED")}>Clear</button>
          </div>
          {overrideStatus ? <p className="muted">{overrideStatus}</p> : null}
        </section>
      ) : null}
    </main>
  );
}
