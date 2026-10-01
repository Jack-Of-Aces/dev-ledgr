# <p align="center"><b>DevLedgr Frontend Web Client</b></p>

<p align="center">
  <strong>The Next.js 16 Web Application for DevLedgr.</strong><br/>
  Featuring the Problem Launchpad, Career Coaching Itineraries, Multi-Provider AI Architecture Console, and Cryptographic Public Ledger.
</p>

<p align="center">
  <a href="https://devledgr.vercel.app"><img src="https://img.shields.io/badge/Production%20Deployment-Vercel-black?style=for-the-badge&logo=vercel" alt="Vercel App"/></a>
  <img src="https://img.shields.io/badge/Next.js-16.3.6%20(Turbopack)-black?style=for-the-badge&logo=next.js" alt="Next.js"/>
  <img src="https://img.shields.io/badge/React-19.2-blue?style=for-the-badge&logo=react" alt="React 19"/>
  <img src="https://img.shields.io/badge/Tailwind%20CSS-v4-38bdf8?style=for-the-badge&logo=tailwindcss" alt="Tailwind CSS"/>
</p>

---

## 📖 Overview

The DevLedgr frontend is a production-grade web application built on **Next.js 16 (App Router)** and **React 19**, engineered with **Tailwind CSS v4** for an editorial, high-density dark/light theme.

It provides developers with:
1. **Interactive Problem Launchpad (`/ideas`)**: Search, filter, inspect mock infrastructure endpoints, copy runnable `cURL` commands, and claim challenges.
2. **Career Coaching Workspaces (`/coaching` & `/coaching/[id]`)**: Structured career tracks featuring in-depth milestone briefings, high-contrast vector system architecture diagrams (SVG), non-negotiable invariants, production failure mode postmortems, and reference blueprints.
3. **Socratic AI Systems Mentor (`/coaching/[id]`)**: Real-time architectural debate console powered by an edge AI mesh (Gemini 2.5/2.0, Groq Llama 3.3/3.1) with heuristic fallback.
4. **Direct Milestone Submission & Auto-Progression**: Validate public GitHub repositories live, submit solutions directly on the milestone card, and automatically advance to the next week's deliverable.
5. **Verified Cryptographic Portfolio (`/p/[username]`)**: Immutable portfolio displaying HMAC-signed certificates, measured p99 latencies, test pass rates, and SHA-256 commit stamps.
6. **Proof-Matched Job Board & ATS Scrutiny (`/jobs`)**: Real-time match scores driven by verified ledger proofs, with ATS CV gap analysis.
7. **Admin Moderation Console (`/admin`)**: Problem ingestion, approval workflow, and reviewer stamping suite.

---

## ⚡ Tech Stack & Architecture

- **Framework**: Next.js 16.3.6 (Turbopack, Server & Client Components)
- **Language**: TypeScript 5.x (Strict mode)
- **UI & Styling**: Tailwind CSS v4, Lucide React icons, Canvas Confetti
- **State & Stores**: Zustand with persistent client hydration and graceful offline fallbacks
- **Validation**: Zod 4 schemas for end-to-end type safety
- **Authentication**: `@supabase/ssr` & `@supabase/supabase-js` (GitHub OAuth, email magic links, and local dev persona)
- **AI Mesh Client**: Dual-engine connector supporting Google Gemini API & Groq Cloud API with rate limiting and deterministic fallback

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** >= 20.x (Node 22 recommended)
- **npm** or **pnpm**

### 2. Installation
```bash
cd frontend
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Configure your `.env.local` keys:
```env
# Point to local Go backend or leave empty for automatic offline mock mode
NEXT_PUBLIC_API_URL=http://localhost:8080

# Supabase Auth & Storage keys
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Live AI Mesh keys (for real-time Gemini & Groq LLMs)
GEMINI_API_KEY=AIzaSy...
GROQ_API_KEY=gsk_...

# Optional: GitHub API Token (boosts rate limit from 60 req/hr to 5,000 req/hr)
GITHUB_TOKEN=ghp_...
```

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🧪 Testing & Code Quality

Run static analysis and production build:

```bash
# Lint code with ESLint 9 (0 errors, 0 warnings policy)
npm run lint

# Check TypeScript types
npx tsc --noEmit

# Compile production build with Turbopack (all 34 routes)
npm run build
```

---

## 📁 Key File Structure

```
frontend/src/
├── app/
│   ├── coaching/          # Coaching track directory and [id] interactive workspace
│   ├── ideas/             # Problem Launchpad, problem detail, and claim flow
│   ├── jobs/              # Proof-matched job board and ATS scrutiny engine
│   ├── p/[slug]/          # Cryptographic public portfolio and proof certificates
│   ├── admin/             # Platform admin moderation console
│   └── api/               # Next.js Route Handlers (AI mesh, GitHub inspect, CV audit)
├── components/
│   ├── auth/              # AuthGuard, LoginModal, and Session providers
│   ├── brand/             # BrandMark, vector logos, and design assets
│   ├── ui/                # SubmitSolutionModal, LedgerEntryRow, Skeletons
│   └── layout/            # Navbar, Footer, and theme container
├── lib/
│   ├── coaching-content.ts# Milestone concepts, vector SVG diagrams, and failure modes
│   ├── ai-mesh.ts         # Multi-model Gemini & Groq streaming execution engine
│   └── store.ts           # Zustand global store (User, Submissions, Ideas, Jobs)
└── services/              # Unified API adapters with resilient mock fallbacks
```

---

## 🤝 Contributing

1. Check existing open issues or submit a proposal.
2. Follow strict TypeScript conventions and avoid `any` types.
3. Test theme compatibility (ensure all components look clean in dark and light modes).
4. Run `npm run lint && npm run build` before submitting PRs.
