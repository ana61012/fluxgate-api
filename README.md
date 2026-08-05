
# 🚀 FluxGate: Enterprise SaaS API Gateway


FluxGate is a full-stack, cloud-deployed SaaS API Gateway. It serves as a protective proxy layer that manages developer authentication, issues cryptographically secure API keys, and enforces strict real-time rate limiting using an in-memory Redis cache.

🌐 Live Demo: https://fluxgate-api.vercel.app/
Note: The backend is hosted on a free Render instance and may take 30-50 seconds to wake up upon your first request.


## ✨ Key Features


- Real-Time Rate Limiting: Enforces a strict quota (e.g., 5 requests/minute) per API key using the Token Bucket Algorithm running natively inside Redis via a Lua script.
- Enterprise Security: User passwords and generated API keys are heavily salted and mathematically hashed using bcrypt before database insertion.
- Stateless Authentication: Secure login sessions managed via JSON Web Tokens (JWT).
- High-Performance Backend: Built with asynchronous Python (FastAPI) to handle rapid concurrent requests without blocking.
- Modern Glassmorphism UI: A sleek, responsive frontend built with React and Tailwind CSS, featuring live progress bars for API usage.


## 🏗️Architecture and Tech Stack

**Frontend:** React18, Vite, Axios, TailwindCSS(Deployed on Vercel)

**Backend:**  Python 3, FastAPI, SQLAlchemy, PyJWT, passlib (Deployed on Render)

**Database:** PostgreSQL (Hosted on Neon.tech) - Stores users and hashed API keys.

**Caching Layer:**  Redis (Hosted on Render) - Stores temporary rate-limiting tokens for sub-millisecond read/write speeds, protecting the Postgres DB from high-volume traffic spikes.




## 🚦 How It Works (The Request Flow)


- A user signs up on the React frontend. Their password is hashed and stored in Postgres.
- Upon login, the user receives a JWT.
- The user requests an API Key. The backend generates a secure 32-byte string, hashes it, stores the hash in Postgres, and displays the raw key to the user exactly once.
- The user sends a request to the protected /secure-data endpoint with their key in the x-api-key header.
- The Gateway acts:
        1)FastAPI verifies the key against the hashed version in Postgres.
            2) FastAPI checks the Redis cache. If tokens remain in the user's bucket, 1 token is deducted and the data is served (HTTP 200).
3)If the bucket is empty, the request is instantly intercepted and rejected (HTTP 429 Too Many Requests).


## 💻Run Locally
Prerequisites-
Node.js & npm

Python 3.8+

A local or cloud instance of PostgreSQL & Redis

Clone the project

```bash
  git clone https://github.com/ana61012/fluxgate-api
```

Set up the Backend

```bash
  cd backend
  python -m venv venv
  source venv/bin/activate  # On Windows use: venv\Scripts\activate
  pip install -r requirements.txt
```

Create a .env file in the backend directory:

```bash
  DATABASE_URL=postgresql://user:password@localhost:5432/your_db
  REDIS_URL=redis://localhost:6379
```

Start the FastAPI server:

```bash
  uvicorn main:app --reload
```
Set up the Frontend

Open a new terminal window.

```bash
  cd frontend
  npm install
```
Create a .env file in the frontend directory:

```bash
  VITE_API_URL=http://localhost:8000
```
Start the Vite development server:

```bash
  npm run dev
```




