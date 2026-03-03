from app.nlp import embedding_similarity, stylometry_features


def test_embedding_similarity_returns_percentage():
    score = embedding_similarity("hello world", ["hello world", "another sample"])
    assert 0 <= score <= 100


def test_stylometry_feature_shape():
    vec = stylometry_features("This is a short sentence. Here is another one.")
    assert vec.shape[0] == 10
