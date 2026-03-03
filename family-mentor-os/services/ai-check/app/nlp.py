from __future__ import annotations

from collections import Counter
from functools import lru_cache
from typing import List

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

try:
    from sentence_transformers import SentenceTransformer
except Exception:  # pragma: no cover
    SentenceTransformer = None

try:
    import spacy
except Exception:  # pragma: no cover
    spacy = None


FUNCTION_WORDS = {
    "the", "and", "or", "but", "if", "then", "because", "while", "of", "in", "on", "at", "for", "to", "with"
}


@lru_cache(maxsize=1)
def get_embedding_model():
    if SentenceTransformer is None:
        return None
    try:
        return SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    except Exception:
        return None


@lru_cache(maxsize=1)
def get_nlp():
    if spacy is None:
        return None
    try:
        return spacy.load("en_core_web_sm")
    except Exception:
        return spacy.blank("en")


def _simple_sentences(text: str) -> List[str]:
    chunks = [line.strip() for line in text.replace("?", ".").replace("!", ".").split(".")]
    return [chunk for chunk in chunks if chunk]


def _simple_words(text: str) -> List[str]:
    return [token.strip(" ,;:\n\t\"'()[]{}") for token in text.lower().split() if token.strip()]


def embedding_similarity(text: str, references: List[str]) -> float:
    refs = [ref for ref in references if ref.strip()]
    if not refs:
        return 0.0

    model = get_embedding_model()
    if model is not None:
        vectors = model.encode([text, *refs], normalize_embeddings=True)
        target = vectors[0]
        ref_vectors = vectors[1:]
        sims = np.dot(ref_vectors, target)
        return float(np.max(sims) * 100)

    # Fallback: TF-IDF cosine similarity
    matrix = TfidfVectorizer(ngram_range=(1, 2)).fit_transform([text, *refs])
    scores = cosine_similarity(matrix[0], matrix[1:]).flatten()
    return float(np.max(scores) * 100)


def stylometry_features(text: str) -> np.ndarray:
    words = _simple_words(text)
    sentences = _simple_sentences(text)
    word_lengths = [len(word) for word in words] or [0]

    avg_sentence_len = float(len(words) / max(1, len(sentences)))
    avg_word_len = float(np.mean(word_lengths))
    type_token_ratio = float(len(set(words)) / max(1, len(words)))

    func_count = sum(1 for word in words if word in FUNCTION_WORDS)
    function_freq = float(func_count / max(1, len(words)))

    punctuation_count = sum(text.count(mark) for mark in [",", ";", ":", "!", "?", "(", ")"])
    punctuation_dist = float(punctuation_count / max(1, len(text)))

    nlp = get_nlp()
    pos_dist = np.zeros(5)
    if nlp is not None:
        doc = nlp(text)
        tags = [token.pos_ for token in doc if token.pos_]
        counts = Counter(tags)
        ordered = [counts.get("NOUN", 0), counts.get("VERB", 0), counts.get("ADJ", 0), counts.get("ADV", 0), counts.get("PRON", 0)]
        total = max(1, sum(ordered))
        pos_dist = np.array([value / total for value in ordered], dtype=float)

    return np.concatenate(
        [
            np.array([
                avg_sentence_len,
                avg_word_len,
                type_token_ratio,
                function_freq,
                punctuation_dist,
            ], dtype=float),
            pos_dist,
        ]
    )


def stylometry_distance_score(text: str, references: List[str]) -> float:
    refs = [ref for ref in references if ref.strip()]
    if not refs:
        return 0.0

    source = stylometry_features(text)
    distances = []
    for ref in refs:
        other = stylometry_features(ref)
        dist = np.linalg.norm(source - other)
        distances.append(dist)

    min_distance = float(min(distances))
    # Convert distance into similarity-like 0..100 signal where higher means more suspicious.
    score = max(0.0, min(100.0, 100.0 - min_distance * 25.0))
    return score


def estimate_ai_probability(similarity_score: float, stylometry_score: float, text: str) -> float:
    length_factor = min(1.0, len(_simple_words(text)) / 120.0)
    raw = 0.62 * (similarity_score / 100.0) + 0.38 * (stylometry_score / 100.0)
    adjusted = raw * (0.65 + 0.35 * length_factor)
    return float(max(0.0, min(1.0, adjusted)))
