from __future__ import annotations

from fastapi import FastAPI

from app.nlp import embedding_similarity, estimate_ai_probability, stylometry_distance_score
from app.schemas import CompareRequest, CompareResponse, StylometryRequest

app = FastAPI(title="FamilyMentor OS AI-Check Service", version="1.0.0")


@app.get("/health")
def health():
    return {"ok": True, "service": "ai-check"}


@app.post("/stylometry", response_model=CompareResponse)
def stylometry(payload: StylometryRequest):
    style_score = stylometry_distance_score(payload.text, payload.references)
    probability = estimate_ai_probability(0.0, style_score, payload.text)

    flags = []
    if style_score >= 70:
        flags.append("stylometry_shift")

    explanation = (
        "Stylometry profile generated using sentence/word structure, lexical diversity, function-word ratio, punctuation, and POS mix. "
        "This is a probabilistic signal and must be reviewed by a human."
    )

    return CompareResponse(
        similarity_score=0.0,
        stylometry_score=style_score,
        ai_generated_probability=probability,
        flags=flags,
        explanation=explanation,
    )


@app.post("/compare", response_model=CompareResponse)
def compare(payload: CompareRequest):
    references = [*payload.prior_submissions, *payload.cohort_submissions]

    similarity = embedding_similarity(payload.text, references)
    stylometry = stylometry_distance_score(payload.text, references)
    ai_probability = estimate_ai_probability(similarity, stylometry, payload.text)

    flags = []
    if similarity >= 92:
        flags.append("high_similarity")
    if stylometry >= 70:
        flags.append("stylometry_shift")
    if ai_probability >= 0.75:
        flags.append("ai_probability_high")

    explanation = (
        f"Similarity signal={similarity:.2f}, stylometry signal={stylometry:.2f}, estimated AI probability={ai_probability:.2f}. "
        "Use this for review workflows only; do not treat as final proof."
    )

    return CompareResponse(
        similarity_score=similarity,
        stylometry_score=stylometry,
        ai_generated_probability=ai_probability,
        flags=flags,
        explanation=explanation,
    )
