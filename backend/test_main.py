from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_read_root():
    """Test that the root endpoint is online."""
    response = client.get("/")
    assert response.status_code == 200

def test_generate_key():
    """Test that we can successfully generate an API key after authenticating."""
    email = "test_user_key@example.com"
    password = "securepassword"
    
    # 1. Register the user
    client.post(f"/signup?email={email}&password={password}")
    
    # 2. Login to get the JWT token
    login_response = client.post("/login", data={"username": email, "password": password})
    token = login_response.json()["access_token"]
    
    # 3. Generate the key using the Bearer token in the headers
    response = client.post(
        "/generate-key", 
        headers={"Authorization": f"Bearer {token}"}
    )
    
    assert response.status_code == 200
    assert "api_key" in response.json()

def test_rate_limiter_exceeded():
    """Test that the rate limiter blocks after 5 requests."""
    email = "ratelimit@example.com"
    password = "securepassword"
    
    # 1. Register and Login
    client.post(f"/signup?email={email}&password={password}")
    login_response = client.post("/login", data={"username": email, "password": password})
    token = login_response.json()["access_token"]
    
    # 2. Generate a valid API key
    gen_response = client.post(
        "/generate-key", 
        headers={"Authorization": f"Bearer {token}"}
    )
    valid_key = gen_response.json()["api_key"]
    
    # 3. Hit the secure endpoint to test rate limiting
    headers = {"x-api-key": valid_key}
    
    # Make 5 successful requests
    for _ in range(5):
        res = client.get("/secure-data", headers=headers)
        assert res.status_code == 200
        
    # The 6th request should be blocked (429 Too Many Requests)
    blocked_res = client.get("/secure-data", headers=headers)
    assert blocked_res.status_code == 429
