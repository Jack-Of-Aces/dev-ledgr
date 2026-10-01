# <p align="center"><img src="./assets/brand/devledgr-banner.png" alt="DevLedgr Banner" width="800" onerror="this.src='./devledgr.png'"/><br/><b>DevLedgr</b></p>

<p align="center">
  <strong>Proof of work, not tutorial clones.</strong><br/>
  Real production challenges. Reviewed against live specs. Permanent cryptographic proof that gets developers hired.
</p>

<p align="center">
  <a href="https://dev-ledgr-ten.vercel.app"><img src="https://img.shields.io/badge/Live%20App-dev--ledgr--ten.vercel.app-10b981?style=for-the-badge&logo=vercel" alt="Live Demo"/></a>
  <a href="https://devledgr.onrender.com"><img src="https://img.shields.io/badge/Backend%20API-Render-46E3B7?style=for-the-badge&logo=render" alt="API Status"/></a>
  <a href="https://github.com/Jack-Of-Aces/dev-ledgr"><img src="https://img.shields.io/badge/GitHub-Repository-black?style=for-the-badge&logo=github" alt="GitHub Repo"/></a>
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License"/>
</p>

## 📌 What is DevLedgr?

Junior and career-transitioning software engineers face a compounding crisis: **tutorial purgatory and the portfolio credibility trap**. Hundreds of thousands of applicants submit identical clone projects (Netflix clones, Todo apps, generic e-commerce stores) generated from YouTube tutorials or copy-pasted LLM code. Hiring managers and technical recruiters routinely ignore them because they demonstrate zero architectural discipline, no resilience to real-world network partitions, and no proof of operating under failure constraints.

**DevLedgr replaces the traditional resume with an immutable, cryptographically-stamped ledger of verified engineering proof.**

Instead of building toy apps, developers solve real production bottlenecks (idempotent webhook buffers under 504 retry storms, spatial geohash dispatch routers, sliding Bloom filters, zero-layout-shift UI engines, and grammar-constrained LLM guards). Every submission is verified against public GitHub repositories, tested against automated criteria, peer-reviewed, and minted into an **HMAC-SHA256 signed ledger certificate** with a permanent hash fingerprint.

## What can it do and what are its building blocks?

### 1. 🏗️ The Problem Launchpad
- Curated catalog of battle-tested engineering problems spanning **Backend Platform Systems**, **Fintech Reliability**, **Developer Infrastructure**, **Frontend Architecture & Design Systems**, and **AI Systems Engineering**.
- Every challenge includes:
  - **Real-World Origin Story** (why the system breaks in production).
  - **Technical Invariants & Constraints** (latency SLA, throughput targets, idempotency requirements).
  - **Mock Infrastructure Specs** with runnable `cURL` commands and synthetic endpoints.
  - **Automated Acceptance Test Criteria**.

### 2. 🎓 Career Coaching Itineraries & Visual Masterclasses
- Multi-week structured roadmaps designed around high-demand roles (*Backend Platform Engineer*, *Fintech Infrastructure Lead*, *DevOps/SRE*, *Design Systems Architect*, *AI Systems Engineer*).
- **In-Depth Milestone Masterclasses**:
  - High-contrast, theme-aware **Vector System Architecture Diagrams (SVG)** illustrating data paths, partition boundaries, and failover states.
  - **Non-Negotiable Engineering Invariants**.
  - **Real-World Failure Mode Traps** (*Trap*, *Catastrophic Impact*, and *Production Remediation*).
  - **Reference Implementation Blueprints** with syntax highlighting and architectural rationale.
- **Direct Workspace Submission**: Submit solutions directly inside the coaching itinerary with automated milestone progression.

### 3. 🎯 Proof-Matched Job Board & ATS Scrutiny Engine
- Job postings automatically calculate a **real-time match score** comparing the company's requirements against the developer's **proven skills** (derived from verified ledger proofs, not self-declared buzzwords).
- **ATS Scrutiny Audit**: Candidates upload their CV or profile to receive a rigorous gap analysis highlighting exactly which architectural challenge to build to bridge the qualification gap.

### 4. 🤖 Multi-Provider Socratic AI Coaching Mesh
- Real-time architectural mentor powered by an intelligent failover mesh:
  - **Primary**: Google Gemini (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`).
  - **Secondary**: Groq high-speed Llama models (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`).
  - **Resilient Fallback**: Deterministic heuristic rules engine guaranteeing 100% uptime even in offline or unauthenticated environments.
- Socratic debate engine pushes developers to defend their trade-offs (e.g., *UUIDv4 vs ULID B-tree fragmentation*, *CRDT state sync vs LWW*, *timing-safe HMAC comparison*).

### 5. 🔏 Cryptographic Proof Stamping & Public Ledger
- Submitting a solution triggers a live audit of the developer's public GitHub repository (commit SHA, language distribution, test coverage).
- Verified submissions mint an **HMAC-SHA256 certified ledger entry** with:
  - Permanent content-addressed hash (e.g., `#c118e07`).
  - Recorded telemetry metrics (p99 latency, throughput req/s, test pass rate).
  - 365-day verifiable tamper-proof certificate inspectable at `/p/[username]#[hash]`.

## 🏛️ System Architecture

```
                                  ┌────────────────────────┐
                                  │   DevLedgr Frontend    │
                                  │   Next.js 16 (App Router) │
                                  │   Tailwind CSS v4 + Zod │
                                  └───────────┬────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      │                                               │
                      ▼                                               ▼
       ┌──────────────────────────────┐                ┌──────────────────────────────┐
       │   Edge AI & GitHub Mesh      │                │    Core REST Backend API     │
       │   - Socratic AI Coach        │                │    Go 1.25 + net/http        │
       │   - ATS Scrutiny Route       │                │    pgx/v5 + JWT auth         │
       │   - Live GitHub Inspector    │                │    HMAC Stamping Engine      │
       │   - Gemini / Groq Mesh       │                │    Deployed on Render        │
       └──────────────────────────────┘                └──────────────┬───────────────┘
                                                                      │
                                                       ┌──────────────┴──────────────┐
                                                       │                             │
                                                       ▼                             ▼
                                        ┌────────────────────────────┐ ┌───────────────────────────┐
                                        │    Supabase PostgreSQL     │ │       Supabase Auth       │
                                        │    - Row Level Security    │ │    - GitHub OAuth         │
                                        │    - Migration Engine      │ │    - Email & Magic Link   │
                                        │    - Proof Ledger Records  │ │    - Session JWTs         │
                                        └────────────────────────────┘ └───────────────────────────┘
```


## 💻 Tech Stack

| Domain | Technology / Tool | Purpose |
|---|---|---|
| **Frontend Framework** | **Next.js 16 (Turbopack)** | React 19, Server & Client Components, Route Handlers |
| **Styling & Design** | **Tailwind CSS v4**, Lucide React, Motion | Responsive high-contrast editorial theme (Dark/Light) |
| **State Management** | **Zustand** (with persistent client sync) | Reactive auth, submissions, and problem filters |
| **Backend API** | **Go 1.25** | High-performance standard-library `net/http` REST router |
| **Database** | **Supabase Postgres (pgx/v5)** | Hardened relational database with strict RLS policies |
| **Authentication** | **Supabase Auth** + GitHub OAuth | Secure session management, JWKS token verification |
| **AI Intelligence Mesh** | **Google Gemini** & **Groq (Llama 3.3/3.1)** | Socratic architectural mentor, CV gap audit |
| **Cryptography** | **HMAC-SHA256 & AES-GCM** | Tamper-proof certificate issuance and BYOK security |
| **Hosting & CI/CD** | **Vercel** (Frontend) & **Render** (Backend) | Production edge CDN and containerized API hosting |


## 📂 Repository Structure

```
.
├── frontend/                   # Next.js 16 web application
│   ├── src/
│   │   ├── app/                # App Router (34 optimized production routes)
│   │   │   ├── coaching/       # Career coaching roadmaps & milestone masterclasses
│   │   │   ├── ideas/          # Problem Launchpad and mock infra specs
│   │   │   ├── jobs/           # Proof-matched job board and ATS scrutiny
│   │   │   ├── p/[slug]/       # Public cryptographic portfolio & ledger
│   │   │   ├── admin/          # Admin moderation & problem approval console
│   │   │   └── api/            # Server-side AI mesh & GitHub inspection endpoints
│   │   ├── components/         # Accessible UI components (AuthGuard, BrandMark, Modals)
│   │   ├── lib/                # Coaching content, SVG diagrams, AI mesh, and store
│   │   └── services/           # Service layer adapters (API + graceful offline fallbacks)
│   └── package.json
│
├── backend/                    # Go 1.25 REST API
│   ├── cmd/api/                # Main server entrypoint (serve, migrate, seed)
│   ├── internal/
│   │   ├── api/                # HTTP handlers, auth middleware, and validation
│   │   ├── ai/                 # Claude/Gemini ATS audit & heuristic scorer
│   │   ├── db/                 # Embedded SQL migrations & pgx connection pool
│   │   ├── model/              # Domain entities and JSON wire contracts
│   │   ├── security/           # HMAC certificate stamping & AES-GCM encryption
│   │   ├── skills/             # Skill taxonomy normalization and matching
│   │   ├── store/              # SQL data access queries
│   │   └── supabase/           # JWKS verification & Supabase client
│   └── go.mod
│
└── assets/                     # Architectural diagrams, banners, and screenshots
```


## 🛠️ Local Development & Quick Start

### Prerequisites
- **Node.js** >= 20.x
- **Go** >= 1.22
- **pnpm** or **npm**
- A free **Supabase** project (or run with local mock fallback)

### 1. Backend Setup

```bash
cd backend

# Create your local environment configuration
cp .env.example .env

# Edit .env with your Supabase credentials:
# DATABASE_URL=postgresql://postgres:...@...:6543/postgres
# SUPABASE_URL=https://<your-project>.supabase.co
# SUPABASE_ANON_KEY=...
# LEDGER_SIGNING_SECRET=your-32-char-random-secret-here

# Run embedded migrations and seed initial coaching & problem catalog
go run ./cmd/api seed

# Start the Go API server on :8080
go run ./cmd/api
```

Verify backend test suite:
```bash
go test -count=1 ./...
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local

# Key variables in .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:8080
# NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# GEMINI_API_KEY=... (optional for live AI Studio key)
# GROQ_API_KEY=...   (optional for live Groq key)

# Start the Next.js development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Verify frontend build and linter:
```bash
npm run lint
npm run build
```

## 🤝 Contributing & Community Guidelines

We welcome contributions from developers worldwide! DevLedgr is built by engineers, for engineers.

1. **Fork the Repository**:
   ```bash
   git clone https://github.com/Jack-Of-Aces/dev-ledgr.git
   cd dev-ledgr
   ```
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. **Ensure Zero Regressions**:
   - Backend: `cd backend && go test ./...`
   - Frontend: `cd frontend && npm run lint && npm run build`
4. **Commit with Conventional Commits**:
   ```bash
   git commit -m "feat(launchpad): add distributed rate-limiter challenge"
   ```
5. **Open a Pull Request**: Submit your PR with a concise description of your changes and test coverage.

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for details. Built with architectural discipline by the **DevLedgr Team**.
