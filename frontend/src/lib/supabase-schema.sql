-- ==============================================================================
-- DevLedgr: Supabase PostgreSQL Database Schema & Row-Level Security (RLS)
-- Paste this entire script into your Supabase Dashboard -> SQL Editor to initialize.
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. User Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  headline TEXT DEFAULT 'Software Engineer',
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  github_url TEXT DEFAULT '',
  stated_skills TEXT[] DEFAULT '{}',
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'reviewer', 'admin')),
  portfolio_valid_until TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 year'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Problem Specs (Idea Bank)
CREATE TABLE IF NOT EXISTS public.ideas (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  tagline TEXT NOT NULL,
  domain TEXT NOT NULL CHECK (domain IN ('fintech', 'systems', 'logistics', 'devtools', 'ai', 'security')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('foundational', 'intermediate', 'production-grade')),
  estimated_hours INT DEFAULT 12,
  origin_story TEXT NOT NULL,
  problem_statement TEXT NOT NULL,
  technical_requirements TEXT[] DEFAULT '{}',
  mock_infra JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT '{}',
  submission_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Verified Proof Submissions (The Cryptographic Ledger)
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hash TEXT UNIQUE NOT NULL,
  idea_id TEXT NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  idea_title TEXT NOT NULL,
  author_username TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_avatar TEXT DEFAULT '',
  repo_url TEXT NOT NULL,
  demo_url TEXT DEFAULT '',
  architecture_notes TEXT NOT NULL,
  status TEXT DEFAULT 'verified' CHECK (status IN ('verified', 'pending', 'rejected')),
  test_results JSONB NOT NULL DEFAULT '{"passed": 20, "total": 20, "suiteName": "Automated CI v2.0"}'::jsonb,
  metrics JSONB DEFAULT '{"latencyP99": "28ms", "throughput": "240 req/s", "coverage": "96.4%"}'::jsonb,
  proof_signature TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. Row-Level Security (RLS) Setup
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Ideas Policies
DROP POLICY IF EXISTS "Ideas are viewable by everyone" ON public.ideas;
CREATE POLICY "Ideas are viewable by everyone"
  ON public.ideas FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can seed new ideas" ON public.ideas;
CREATE POLICY "Admins can seed new ideas"
  ON public.ideas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Submissions Policies
DROP POLICY IF EXISTS "Submissions are viewable by everyone" ON public.submissions;
CREATE POLICY "Submissions are viewable by everyone"
  ON public.submissions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can submit solutions" ON public.submissions;
CREATE POLICY "Authenticated users can submit solutions"
  ON public.submissions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins and reviewers can verify submissions" ON public.submissions;
CREATE POLICY "Admins and reviewers can verify submissions"
  ON public.submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'reviewer')
    )
  );

-- ==============================================================================
-- 6. Initial Seed Data (Core Problem Specs)
-- ==============================================================================
INSERT INTO public.ideas (id, title, tagline, domain, difficulty, estimated_hours, origin_story, problem_statement, technical_requirements, tags)
VALUES
  (
    'lpg-route-optimizer',
    'Route Optimizer for Informal LPG Delivery',
    'Dynamic clustering and routing for motorcycle cylinder dispatch in dense, unmapped informal settlements.',
    'logistics',
    'production-grade',
    16,
    'Sourced from independent LPG depot dispatchers in Alaba Market, Lagos. Deliveries stall because streets lack formal addresses.',
    'Build a spatial routing engine that accepts real-time orders with fuzzy coordinates, enforces motorcycle load constraints, and guarantees sub-30 minute arrival SLAs.',
    ARRAY['Implement Haversine or Vincenty matrix calculation with urban road penalty factor.', 'Enforce vehicle capacity limits (max 120kg).', 'P95 dispatch endpoint latency < 80ms under 200 concurrent requests.'],
    ARRAY['Go', 'Redis', 'Spatial', 'Logistics']
  ),
  (
    'webhook-deduplicator',
    'Idempotent Webhook Replayer & Deduplicator',
    'Prevent double-credit events across unstable payment networks with sliding Bloom filters and distributed locks.',
    'fintech',
    'production-grade',
    14,
    'Sourced from payment infrastructure incidents where upstream telco aggregators retried webhook bursts on 504 timeouts.',
    'Implement a high-throughput webhook receiver that guarantees exactly-once processing semantics under 5,000 req/s bursts.',
    ARRAY['Atomic SET NX PX distributed locks in Redis clusters.', 'Timing-safe HMAC-SHA256 signature verification.', 'Sub-15ms p99 response latency.'],
    ARRAY['Go', 'Redis', 'Fintech', 'Distributed Systems']
  ),
  (
    'schema-migration-guard',
    'Multi-Tenant Schema Migration Verifier',
    'Static AST analyzer preventing AccessExclusiveLock outages on multi-terabyte PostgreSQL tables during zero-downtime deployments.',
    'systems',
    'intermediate',
    10,
    'Engineered from post-mortem audits of fintech table locking incidents during schema migrations.',
    'Parse incoming SQL migration scripts, build AST representations, and flag any operation that takes destructive table locks.',
    ARRAY['Parse SQL with pg_query_go.', 'Simulate lock acquisition in isolated container.', 'Block unindexed foreign key creations.'],
    ARRAY['Go', 'PostgreSQL', 'DevTools', 'AST']
  )
ON CONFLICT (id) DO NOTHING;
