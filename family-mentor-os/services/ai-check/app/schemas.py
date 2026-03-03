from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class CompareRequest(BaseModel):
    text: str = Field(min_length=1)
    prior_submissions: List[str] = Field(default_factory=list)
    cohort_submissions: List[str] = Field(default_factory=list)


class StylometryRequest(BaseModel):
    text: str = Field(min_length=1)
    references: List[str] = Field(default_factory=list)


class CompareResponse(BaseModel):
    similarity_score: float
    stylometry_score: float
    ai_generated_probability: float
    flags: List[str]
    explanation: str
    debug: Optional[Dict[str, Any]] = None
