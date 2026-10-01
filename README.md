# 🚀 FluxGate: SaaS API Gateway with Redis Rate Limiting

FluxGate is a full-stack, cloud-deployed API gateway. It sits in front of a protected endpoint, handles developer sign-up and login, issues securely hashed API keys, and enforces real-time rate limits using a **Token Bucket algorithm running atomically inside Redis (Lua script)**.

🌐 **Live demo:** https://fluxgate-api.vercel.app/

> ⏳ The backend runs on a free Render instance, so the first request may take 30-50 seconds while it wakes up.

<!-- Add a screenshot or GIF of the dashboard here:
![FluxGate dashboard](docs/dashboard.png)
-->

---

## ✨ Features

- **Real-time rate limiting:** a per-API-key quota (e.g. 5 requests/minute) enforced with a Token Bucket implemented as a Redis Lua script, so check-and-deduct is atomic and safe under concurrent requests.
- **Secure credential storage:** passwords and generated API keys are hashed with bcrypt. Raw API keys are shown to the user exactly once and never stored.
- **Stateless authentication:** login sessions use JSON Web Tokens (JWT).
- **Async backend:** built with FastAPI to handle concurrent requests without blocking.
- **Live usage dashboard:** responsive React + Tailwind UI with progress bars showing remaining API quota.
- **Fully deployed:** frontend on Vercel, backend and Redis on Render, PostgreSQL on Neon.

---

## 🏗️ Architecture

```
┌──────────────┐      JWT       ┌───────────────────┐
│ React + Vite │ ─────────────► │  FastAPI backend  │
│  (Vercel)    │                │     (Render)      │
└──────────────┘                └───────┬───────┬───┘
                                        │       │
                         users + hashed │       │ rate-limit tokens
                             API keys   ▼       ▼
                              ┌────────────┐ ┌────────────┐
                              │ PostgreSQL │ │   Redis    │
                              │   (Neon)   │ │  (Render)  │
                              └────────────┘ └────────────┘
```

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | React 18, Vite, Axios, Tailwind CSS | Vercel |
| Backend | Python 3, FastAPI, SQLAlchemy, PyJWT, passlib | Render |
| Database | PostgreSQL (users and hashed API keys) | Neon.tech |
| Cache | Redis (rate-limit buckets) | Render |

**Why Redis?** Rate-limit checks happen on every request. Keeping the token buckets in memory gives sub-millisecond reads and writes and keeps that traffic off PostgreSQL.

---

## 🚦 How a Request Flows

1. A user signs up on the React frontend. The password is hashed and stored in PostgreSQL.
2. On login, the backend returns a JWT.
3. The user requests an API key. The backend generates a secure 32-byte key, stores only its **hash**, and shows the raw key once.
4. The user calls the protected `/secure-data` endpoint with the key in the `x-api-key` header.
5. The gateway then:
   1. Verifies the key against its stored hash in PostgreSQL.
   2. Runs the Token Bucket Lua script in Redis.
   3. **Tokens available:** deducts one and returns the data (`200 OK`).
   4. **Bucket empty:** rejects the request immediately (`429 Too Many Requests`).

### Example

```bash
curl -H "x-api-key: YOUR_API_KEY" https://<your-backend-url>/secure-data
```

| Response | Meaning |
|---|---|
| `200 OK` | Valid key, tokens remaining |
| `401 / 403` | Missing or invalid API key |
| `429 Too Many Requests` | Rate limit exceeded, retry after the bucket refills |

---

## 💻 Run Locally

### Prerequisites

| For | You need |
|---|---|
| Backend | Python 3.8+, PostgreSQL, Redis (local or cloud) |
| Frontend | Node.js 18+ and npm |

### 1. Clone

```bash
git clone https://github.com/ana61012/fluxgate-api
cd fluxgate-api
```

### 2. Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/your_db
REDIS_URL=redis://localhost:6379
```

Start the server:

```bash
uvicorn main:app --reload
```

The API runs at `http://localhost:8000`, and FastAPI's interactive docs are at `http://localhost:8000/docs`.

### 3. Frontend (React + Vite)

Open a new terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

Start the dev server:

```bash
npm run dev
```

---

## 🔐 Security Notes

- Passwords and API keys are never stored in plain text (bcrypt hashing).
- Raw API keys are displayed once at creation and cannot be retrieved later.
- Secrets live in `.env` files, which are git-ignored.
- Rate limiting runs in Redis, so a spike of abusive traffic never reaches the database.

---

## 🗺️ Roadmap

- [ ] Configurable per-key limits and plans (free / pro)
- [ ] Usage analytics and request history per key
- [ ] API key rotation and revocation
- [ ] Automated tests and CI pipeline
- [ ] Docker-based one-command local setup

---

## 🧰 Tech Stack

`FastAPI` · `Python` · `PostgreSQL` · `Redis` · `Lua` · `SQLAlchemy` · `JWT` · `bcrypt` · `React` · `Vite` · `Tailwind CSS` · `Vercel` · `Render` · `Neon`

---

## 👤 Author

**Ana** · [GitHub](https://github.com/ana61012)


