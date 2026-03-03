from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_compare_endpoint():
    response = client.post(
        "/compare",
        json={
            "text": "Students build apps with mentors and document outcomes.",
            "prior_submissions": ["Students build apps with mentors and document outcomes."],
            "cohort_submissions": ["Learning outcomes are documented weekly by mentors."]
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert "similarity_score" in payload
    assert "stylometry_score" in payload
    assert "ai_generated_probability" in payload
