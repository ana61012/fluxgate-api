import pytest
from fastapi.testclient import TestClient
from main import app

# Create a test client that can make fake HTTP requests to our app
client = TestClient(app)

def test_read_root():
    """Test that the root endpoint is online."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"

def test_generate_key():
    """Test that we can successfully generate an API key."""
    response = client.post("/generate-key?email=test_user@example.com")
    assert response.status_code == 200
    assert "api_key" in response.json()
    
def test_secure_data_missing_key():
    """Test that missing API key returns 401."""
    response = client.get("/secure-data")
    assert response.status_code == 401
    assert response.json()["detail"] == "Missing x-api-key in headers"

def test_secure_data_invalid_key():
    """Test that an invalid API key returns 401."""
    response = client.get("/secure-data", headers={"x-api-key": "fake_bad_key"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid API Key"

def test_rate_limiter_exceeded():
    """
    Test that the rate limiter blocks after 5 requests.
    We assume the default rate limit set in the database is 5.
    """
    # 1. Generate a valid key
    gen_response = client.post("/generate-key?email=ratelimit@example.com")
    valid_key = gen_response.json()["api_key"]
    
    headers = {"x-api-key": valid_key}
    
    # 2. Consume all 5 tokens
    for _ in range(5):
        res = client.get("/secure-data", headers=headers)
        assert res.status_code == 200
        
    # 3. The 6th request should hit the 429 Too Many Requests error
    blocked_res = client.get("/secure-data", headers=headers)
    assert blocked_res.status_code == 429
    assert "Rate limit exceeded" in blocked_res.json()["detail"]