import time
import requests
from concurrent.futures import ThreadPoolExecutor

# Configuration
API_URL = "http://127.0.0.1:8000/secure-data"
BASE_URL = "http://127.0.0.1:8000"
NUM_REQUESTS = 50 

def fetch(api_key):
    """
    This function represents a single request to our API.
    It will be run on multiple threads simultaneously.
    """
    headers = {"x-api-key": api_key}
    try:
        r = requests.get(API_URL, headers=headers, timeout=5)
        return r.status_code
    except Exception:
        return "Error"

def run_test():
    print("Authenticating and generating test API key...")
    try:
        # 1. Create a test user (we ignore errors if they already exist)
        requests.post(f"{BASE_URL}/signup?email=loadtest@test.com&password=loadtestpass")
        
        # 2. Log in to get the JWT token (OAuth2 requires form data)
        login_res = requests.post(f"{BASE_URL}/login", data={"username": "loadtest@test.com", "password": "loadtestpass"})
        if login_res.status_code != 200:
            print("Failed to login. Is the FastAPI server running?")
            return
        
        token = login_res.json()["access_token"]
        
        # 3. Use the Bearer token to get a fresh API key
        headers = {"Authorization": f"Bearer {token}"}
        res = requests.post(f"{BASE_URL}/generate-key", headers=headers, timeout=10)
        api_key = res.json()["api_key"]
        print("API Key generated successfully!")
        
    except Exception as e:
        print(f"Failed to authenticate or get API key: {e}")
        return

    print(f"\nFiring {NUM_REQUESTS} requests simultaneously using Threads...")
    
    start_time = time.time()
    results = []
    
    # We use a ThreadPool to safely simulate multiple users hitting the server at once 
    # without crashing the Windows networking stack (which asyncio sometimes does).
    with ThreadPoolExecutor(max_workers=10) as executor:
        # Submit all tasks to the thread pool
        futures = [executor.submit(fetch, api_key) for _ in range(NUM_REQUESTS)]
        
        # Collect the results (status codes) as they finish
        for future in futures:
            results.append(future.result())
            
    end_time = time.time()
    
    # 4. Calculate metrics
    duration = end_time - start_time
    req_per_sec = NUM_REQUESTS / duration
    
    successes = results.count(200)
    blocks = results.count(429)
    errors = len([r for r in results if r != 200 and r != 429])
    
    print("\n=== LOAD TEST RESULTS ===")
    print(f"Total Time:     {duration:.2f} seconds")
    print(f"Requests/Sec:   {req_per_sec:.2f} RPS")
    print(f"Allowed (200s): {successes} (Should be around 5 or 6)")
    print(f"Blocked (429s): {blocks}")
    if errors > 0:
        print(f"Errors:         {errors}")
    print("=========================\n")

if __name__ == "__main__":
    run_test()