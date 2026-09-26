import { IdeaItem, SubmissionEntry, JobOpportunity, CoachingItinerary, UserProfile } from '@/types';

export const INITIAL_IDEAS: IdeaItem[] = [
  {
    id: 'lpg-route-optimizer',
    title: 'Route Optimizer for Informal LPG Delivery',
    tagline: 'Dynamic clustering and routing for motorcycle cylinder dispatch in dense, unmapped informal settlements.',
    domain: 'logistics',
    difficulty: 'production-grade',
    estimatedHours: 16,
    originStory: 'Sourced from independent LPG depot dispatchers in Alaba Market, Lagos. Deliveries stall because streets lack formal addresses and driver capacities vary wildly by bike load.',
    problemStatement: `Informal delivery fleets operate in areas without formal postal codes or reliable street vector geometries. Orders come in via WhatsApp and USSD with landmarks and fuzzy coordinates.

Build a spatial routing engine that:
1. Accepts real-time orders with coordinate geohashes and cylinder weights (6kg, 12.5kg, 50kg).
2. Computes capacity-constrained vehicle routes with 30-minute arrival SLAs.
3. Provides an idempotent dispatch webhook for drivers to acknowledge pickup without double-assigning cylinders.`,
    technicalRequirements: [
      'Implement Haversine or Vincenty matrix distance calculation with road network penalty factor.',
      'Enforce vehicle capacity limits (max 120kg per motorcycle chassis).',
      'Handle dynamic re-routing when a customer cancels mid-transit.',
      'P95 dispatch endpoint latency < 80ms under 200 concurrent order requests.'
    ],
    mockInfra: {
      baseUrl: 'https://mock-infra.devledgr.xyz/api/v1/lpg',
      starterRepoUrl: 'https://github.com/devledgr-starters/lpg-dispatch-starter',
      curlExample: `curl -X POST https://mock-infra.devledgr.xyz/api/v1/lpg/simulate-fleet \\
  -H "Authorization: Bearer test_key_lpg_99" \\
  -H "Content-Type: application/json" \\
  -d '{"fleet_size": 12, "active_orders": 45, "depot_geohash": "s10m9r"}`,
      endpoints: [
        {
          method: 'GET',
          path: '/depots/active',
          description: 'Fetch current depot stock levels and standby delivery bikes.',
          responseSample: {
            depot_id: 'depot_ikeja_01',
            available_cylinders: { '6kg': 42, '12.5kg': 19, '50kg': 4 },
            riders_available: 7
          }
        },
        {
          method: 'POST',
          path: '/orders/incoming-stream',
          description: 'Emulates random customer orders arriving every 500ms.',
          responseSample: {
            order_id: 'ord_918239',
            lat: 6.5244,
            lng: 3.3792,
            cylinder_type: '12.5kg',
            created_at: '2026-09-24T18:30:00Z'
          }
        },
        {
          method: 'POST',
          path: '/routes/verify-solution',
          description: 'Submission test harness: runs 500 historical order batches through your endpoint.',
          responseSample: {
            passed: true,
            sla_compliance_rate: 0.984,
            fuel_cost_savings_pct: 21.4
          }
        }
      ],
      testCriteria: [
        'Must return valid GeoJSON MultiLineString for all scheduled routes.',
        'Zero overloaded motorcycle violations during peak rush hour sim.',
        'Graceful 422 error response when order is outside depot service polygon.'
      ]
    },
    tags: ['Go', 'FastAPI', 'Spatial Indexing', 'Geohash', 'Algorithms'],
    submissionCount: 43
  },
  {
    id: 'webhook-deduplicator',
    title: 'Idempotent Webhook Replayer & Deduplicator',
    tagline: 'Zero-loss webhook ingest pipe with distributed deduplication and exponential backoff retry semantics.',
    domain: 'fintech',
    difficulty: 'intermediate',
    estimatedHours: 10,
    originStory: 'Reported by senior platform leads at African fintechs: payment gateway outages trigger retries that hammer merchant servers, resulting in double credit alerts.',
    problemStatement: `During partner gateway outages, webhooks arrive out-of-order, duplicated, or in massive burst waves.

Build an ingestion and replay buffer that guarantees:
1. Exactly-once processing semantics using cryptographic idempotency keys.
2. Jittered exponential backoff with dead-letter queue (DLQ) isolation.
3. Cryptographic HMAC signature verification with timing-attack prevention.`,
    technicalRequirements: [
      'Constant-time signature verification (`crypto.timingSafeEqual`).',
      'Sliding window deduplication with Redis TTL or transactional locking.',
      'Graceful backpressure handling during 10,000 req/sec spikes.'
    ],
    mockInfra: {
      baseUrl: 'https://mock-infra.devledgr.xyz/api/v1/webhook-firehose',
      starterRepoUrl: 'https://github.com/devledgr-starters/webhook-replay-starter',
      curlExample: `curl -X POST https://mock-infra.devledgr.xyz/api/v1/webhook-firehose/trigger \\
  -H "Content-Type: application/json" \\
  -d '{"spike_rate": 5000, "duplicate_ratio": 0.35, "target_url": "http://localhost:8080/events"}`,
      endpoints: [
        {
          method: 'POST',
          path: '/trigger',
          description: 'Fires simulated bursts of duplicate, malformed, and valid webhook events.',
          responseSample: {
            events_sent: 1000,
            duplicates_injected: 350,
            signature_algorithm: 'HMAC-SHA256'
          }
        },
        {
          method: 'GET',
          path: '/telemetry',
          description: 'Checks how many duplicates your system mistakenly executed.',
          responseSample: {
            duplicates_processed: 0,
            unhandled_exceptions: 0,
            dlq_count: 14
          }
        }
      ],
      testCriteria: [
        'Deduplication rate must be 100% on identical idempotency keys.',
        'Malformed HMAC signatures must return 401 within 5ms.',
        'Backpressure drop rate must not exceed 0.01% under burst load.'
      ]
    },
    tags: ['Distributed Systems', 'Redis', 'Node.js', 'Go', 'HMAC'],
    submissionCount: 88
  },
  {
    id: 'offline-sync-clinic',
    title: 'Offline-First Sync Engine for Rural Health Posts',
    tagline: 'Conflict-free replicated patient record sync between solar-powered tablet clients and provincial health DBs.',
    domain: 'systems',
    difficulty: 'production-grade',
    estimatedHours: 20,
    originStory: 'Sourced from field epidemiological workers in rural primary healthcare centres with unreliable cell coverage.',
    problemStatement: `Community nurses record vaccinations, antenatal checks, and drug distributions on tablets. Internet is only available when travelling to town once a week.

Build a bi-directional conflict-free sync protocol:
1. Local edits are stored in IndexedDB or SQLite.
2. Sync merges delta records without overwriting contemporaneous nurse notes.
3. Conflict resolution follows Last-Write-Wins with immutable change vectors.`,
    technicalRequirements: [
      'CRDT state-based or delta-based replication protocol.',
      'Vector clock timestamp tracking per patient entity.',
      'Bandwidth-optimized compressed binary or delta-JSON transfer.'
    ],
    mockInfra: {
      baseUrl: 'https://mock-infra.devledgr.xyz/api/v1/clinic-sync',
      starterRepoUrl: 'https://github.com/devledgr-starters/offline-crdt-starter',
      curlExample: `curl -X POST https://mock-infra.devledgr.xyz/api/v1/clinic-sync/replicate \\
  -H "X-Client-Clock: 14:nodeB" \\
  -d '{"deltas": [{"entity": "patient_88", "field": "vaccine_dose_2", "val": true}]}'`,
      endpoints: [
        {
          method: 'GET',
          path: '/provincial-records',
          description: 'Simulates central database state with synthetic concurrent edits.',
          responseSample: { records_count: 500, state_vector: 'v_sync_9941' }
        }
      ],
      testCriteria: [
        'Zero lost update mutations when 3 clients edit the same patient offline.',
        'Sync payload size for 1,000 patient diffs < 150KB gzip.'
      ]
    },
    tags: ['CRDT', 'SQLite', 'TypeScript', 'Offline-First', 'Protobuf'],
    submissionCount: 29
  },
  {
    id: 'schema-migration-guard',
    title: 'Multi-Tenant Schema Migration Verifier',
    tagline: 'Static AST analyzer and dry-run shadow query runner to catch lock-contention DDL before production deploy.',
    domain: 'devtools',
    difficulty: 'intermediate',
    estimatedHours: 12,
    originStory: 'Postgres table locks during accidental non-concurrent index creation caused a 45-minute cascading outage.',
    problemStatement: `Junior devs frequently ship migrations like \`ALTER TABLE ... ADD COLUMN ... DEFAULT ...\` on multi-million row tables, locking customer transactions.

Build a CLI and CI verification tool that:
1. Parses SQL migration files using AST.
2. Identifies dangerous statements (\`CREATE INDEX\` without \`CONCURRENTLY\`, table rewrites, lock escalation).
3. Executes a shadow dry-run against an ephemeral Postgres test container with pg_locks monitoring.`,
    technicalRequirements: [
      'AST parsing for PostgreSQL dialect.',
      'Lock level classification (AccessExclusiveLock vs ShareUpdateExclusiveLock).',
      'CI exit code 1 with remediation advice snippet.'
    ],
    mockInfra: {
      baseUrl: 'https://mock-infra.devledgr.xyz/api/v1/schema-guard',
      starterRepoUrl: 'https://github.com/devledgr-starters/schema-guard-starter',
      curlExample: `curl -X POST https://mock-infra.devledgr.xyz/api/v1/schema-guard/audit-ddl \\
  -d '{"sql": "ALTER TABLE transactions ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT \\'pending\\';"}'`,
      endpoints: [
        {
          method: 'POST',
          path: '/audit-ddl',
          description: 'Submits SQL snippet to receive safety analysis and table lock hazards.',
          responseSample: {
            safe: false,
            hazard_level: 'CRITICAL',
            lock_type: 'AccessExclusiveLock',
            remediation: 'Use nullable column first, backfill in batches, then add NOT NULL constraint.'
          }
        }
      ],
      testCriteria: [
        'Correctly flags 10 out of 10 classic Postgres trap migrations.',
        'Outputs GitHub Actions compatible annotations.'
      ]
    },
    tags: ['PostgreSQL', 'AST', 'Go', 'CLI', 'Database Internals'],
    submissionCount: 52
  }
];

export const INITIAL_SUBMISSIONS: SubmissionEntry[] = [
  {
    hash: 'a3f9d21',
    ideaId: 'lpg-route-optimizer',
    ideaTitle: 'Route Optimizer for Informal LPG Delivery',
    authorUsername: 'junior_dev',
    authorName: 'Alex Okafor',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    repoUrl: 'https://github.com/alexokafor/lpg-matrix-router',
    demoUrl: 'https://lpg-router-alex.devledgr.app',
    architectureNotes: 'Implemented Dijkstra with dynamic Voronoi cell partitioning for Lagos mainland. Integrated custom haversine weight matrix with penalty for unpaved roads. Sustained 120 req/sec at 42ms p99.',
    timestamp: '2026-09-24T14:22:10Z',
    status: 'verified',
    testResults: {
      passed: 24,
      total: 24,
      suiteName: 'LPG Dispatch Fleet Sim v1.2'
    },
    metrics: {
      latencyP99: '42ms',
      throughput: '120 req/s',
      coverage: '94.2%'
    }
  },
  {
    hash: 'c118e07',
    ideaId: 'webhook-deduplicator',
    ideaTitle: 'Idempotent Webhook Replayer & Deduplicator',
    authorUsername: 'junior_dev',
    authorName: 'Alex Okafor',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    repoUrl: 'https://github.com/alexokafor/fintech-idempotency-engine',
    demoUrl: 'https://idempotent-hooks.devledgr.app',
    architectureNotes: 'Built on Go + Redis sliding Bloom filters for memory-efficient deduping. Prevents replay attacks using HMAC timing-safe verification and jittered exponential retry backoff.',
    timestamp: '2026-09-22T19:04:45Z',
    status: 'verified',
    testResults: {
      passed: 18,
      total: 18,
      suiteName: 'Burst Spike Ingestion Harness'
    },
    metrics: {
      latencyP99: '18ms',
      throughput: '4,800 req/s',
      coverage: '98.5%'
    }
  },
  {
    hash: '8f72b94',
    ideaId: 'schema-migration-guard',
    ideaTitle: 'Multi-Tenant Schema Migration Verifier',
    authorUsername: 'tomiwa_code',
    authorName: 'Tomiwa Adeyemi',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    repoUrl: 'https://github.com/tomiwa/pg-lock-guard',
    architectureNotes: 'Go AST parser for pg_query_go. Emulates lock acquisition against Dockerized PostgreSQL 16 before issuing GitHub PR comments.',
    timestamp: '2026-09-21T11:15:00Z',
    status: 'verified',
    testResults: {
      passed: 30,
      total: 30,
      suiteName: 'DDL Safety Matrix Test'
    },
    metrics: {
      latencyP99: '95ms',
      throughput: 'CLI Native',
      coverage: '91.0%'
    }
  }
];

export const INITIAL_JOBS: JobOpportunity[] = [
  {
    id: 'job-moniepoint-backend',
    title: 'Junior Platform Backend Engineer',
    company: 'Moniepoint',
    location: 'Lagos / Hybrid',
    type: 'Full-time',
    salary: '₦850,000 - ₦1,200,000 / mo',
    tags: ['Go', 'Redis', 'Distributed Systems', 'PostgreSQL'],
    matchScore: 94,
    matchedIdeaIds: ['webhook-deduplicator', 'lpg-route-optimizer'],
    requiredSkills: [
      'Idempotency and distributed transaction handling',
      'Real-time webhook and event stream ingestion',
      'Low latency API design (p99 < 50ms)'
    ],
    description: `We are looking for early-career engineers who don't just know syntax, but understand what happens when a banking network times out under pressure.

You will maintain high-volume merchant processing switches where duplicate requests cause real money losses. Candidates with verified proof in event deduplication and spatial dispatch will be fast-tracked to technical interview.`,
    gapIdeaId: 'webhook-deduplicator',
    gapReason: 'Role requires proven experience handling high-concurrency duplicate webhook spikes.'
  },
  {
    id: 'job-paystack-infra',
    title: 'Associate Infrastructure & Tooling Engineer',
    company: 'Paystack',
    location: 'Remote (Africa / GMT+1)',
    type: 'Full-time',
    salary: '₦900,000 - ₦1,400,000 / mo',
    tags: ['PostgreSQL', 'DevTools', 'Go', 'Docker', 'CI/CD'],
    matchScore: 68,
    matchedIdeaIds: ['schema-migration-guard'],
    requiredSkills: [
      'Database internals and lock analysis',
      'Developer tooling & static analysis',
      'Zero-downtime database deployment'
    ],
    description: `Join the developer experience team building internal guards that prevent developers from breaking production databases.`,
    gapIdeaId: 'schema-migration-guard',
    gapReason: 'You need demonstrated proof in PostgreSQL lock analysis to qualify for immediate CV generation.'
  },
  {
    id: 'job-kobo360-routing',
    title: 'Junior Dispatch & Operations Systems Engineer',
    company: 'Kobo360',
    location: 'Nairobi / Remote',
    type: 'Full-time',
    salary: '$1,800 - $2,500 / mo',
    tags: ['Python', 'FastAPI', 'Logistics', 'Spatial'],
    matchScore: 91,
    matchedIdeaIds: ['lpg-route-optimizer'],
    requiredSkills: [
      'Spatial routing algorithms and distance heuristics',
      'Constraint optimization for freight delivery',
      'API performance profiling'
    ],
    description: `Building the nervous system for inter-African logistics. We value real operational proof over Leetcode ratings.`,
    gapIdeaId: 'lpg-route-optimizer',
    gapReason: 'Requires spatial routing and constraint handling proof.'
  }
];

export const INITIAL_COACHING: CoachingItinerary[] = [
  {
    id: 'backend-fundamentals',
    title: 'Backend Fundamentals: From REST to Distributed Consistency',
    subtitle: 'A 4-week structured track taking you from simple CRUD to failure-resilient distributed architectures.',
    targetRole: 'Junior Platform Backend Engineer',
    durationWeeks: 4,
    milestones: [
      {
        week: 1,
        title: 'Network Failures & Idempotency',
        deliverable: 'Build a zero-double-credit payment webhook buffer.',
        ideaIdRef: 'webhook-deduplicator',
        prompts: [
          'Design an API that handles HTTP 504 timeouts gracefully.',
          'Explain why UUIDv4 vs ULID impacts B-Tree index fragmentation.'
        ]
      },
      {
        week: 2,
        title: 'Spatial Calculations & Greedy Heuristics',
        deliverable: 'Ship an informal courier route clusterer.',
        ideaIdRef: 'lpg-route-optimizer',
        prompts: [
          'How does Haversine calculation break down over dense urban paths?',
          'Compare K-means vs DBSCAN for dispatch clustering.'
        ]
      },
      {
        week: 3,
        title: 'Database Locking & Concurrent DDL',
        deliverable: 'Build a migration guard that intercepts AccessExclusiveLock.',
        ideaIdRef: 'schema-migration-guard',
        prompts: [
          'Why does ALTER TABLE ... ADD COLUMN rewrite the heap in older Postgres?',
          'How to run zero-downtime index creation safely.'
        ]
      },
      {
        week: 4,
        title: 'Offline Replicated States & CRDTs',
        deliverable: 'Implement a state-based sync engine for field nurses.',
        ideaIdRef: 'offline-sync-clinic',
        prompts: [
          'State-based vs Operation-based CRDT trade-offs.',
          'Vector clock vs LWW in intermittent connectivity.'
        ]
      }
    ]
  },
  {
    id: 'fintech-reliability',
    title: 'Fintech Systems: High-Throughput Idempotency & Financial Auditing',
    subtitle: 'Focused track tailored for payment processing switches, reconciliation ledgers, and zero-data-loss burst traffic.',
    targetRole: 'Junior Fintech Infrastructure Engineer',
    durationWeeks: 3,
    milestones: [
      {
        week: 1,
        title: 'Sliding Bloom Filters & Timing-Safe HMAC',
        deliverable: 'Deduplicate 10,000 req/s burst payloads with zero memory leak.',
        ideaIdRef: 'webhook-deduplicator',
        prompts: [
          'How to prevent timing attacks in HMAC signature comparison with constant-time equality.',
          'Design a Redis sliding window lock with jittered retry to avoid thundering herds.'
        ]
      },
      {
        week: 2,
        title: 'High-Volume Transaction Isolation & Locks',
        deliverable: 'Prevent deadlocks during peak flash-sale balance deductions.',
        ideaIdRef: 'schema-migration-guard',
        prompts: [
          'Compare PostgreSQL row-level locks (FOR UPDATE NOWAIT vs FOR NO KEY UPDATE) in banking ledgers.',
          'How to implement two-phase commit without microservice transaction coordinator bloat.'
        ]
      },
      {
        week: 3,
        title: 'Double-Entry Ledger Invariants & Audit Seals',
        deliverable: 'Stamp immutable cryptographic proofs of account reconciliation balance.',
        ideaIdRef: 'offline-sync-clinic',
        prompts: [
          'How to design append-only ledger entries that guarantee balance zero-sum integrity.',
          'Explain deterministic state machine replication across partitioned nodes.'
        ]
      }
    ]
  },
  {
    id: 'devtools-infrastructure',
    title: 'Developer Infrastructure: Static Analysis & Safe Migrations',
    subtitle: 'Master database internals, AST query interception, and automated CI safety guards.',
    targetRole: 'Associate Tooling & Database Engineer',
    durationWeeks: 3,
    milestones: [
      {
        week: 1,
        title: 'AST Parsing & Postgres DDL Traps',
        deliverable: 'Build a shadow query parser that flags dangerous non-concurrent indexes.',
        ideaIdRef: 'schema-migration-guard',
        prompts: [
          'Why does CREATE INDEX without CONCURRENTLY lock table writes in production?',
          'How to parse SQL AST trees in Go/TypeScript to flag unindexed foreign key lookups.'
        ]
      },
      {
        week: 2,
        title: 'Ephemeral Container Test Harnesses',
        deliverable: 'Automate Dockerized PostgreSQL lock matrix verification in CI pipelines.',
        ideaIdRef: 'lpg-route-optimizer',
        prompts: [
          'How to spin up ephemeral testcontainers in under 800ms for integration runs.',
          'Design a CI exit code reporter that outputs GitHub Actions check run annotations.'
        ]
      },
      {
        week: 3,
        title: 'Zero-Downtime Rollout Orchestration',
        deliverable: 'Implement blue-green shadow schema migrations with automated rollback.',
        ideaIdRef: 'offline-sync-clinic',
        prompts: [
          'Expand and Contract pattern: Safe column rename strategies without downtime.',
          'How to monitor pg_stat_activity to automatically cancel query execution on lock cascades.'
        ]
      }
    ]
  }
];

export const DEFAULT_USER: UserProfile = {
  username: 'junior_dev',
  name: 'Alex Okafor',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  headline: 'Junior Backend Engineer · 2 Verified Proof-of-Work Entries',
  bio: 'Self-taught engineer transitioning from web basics to resilient distributed backends. Focused on real-world fintech deduplication and logistics optimization.',
  githubUrl: 'https://github.com/alexokafor',
  portfolioValidUntil: '2027-09-24T20:00:00Z',
  plan: 'free',
  statedSkills: ['Go', 'TypeScript', 'PostgreSQL', 'Redis', 'Docker', 'FastAPI'],
  role: 'user',
  email: 'alex@devledgr.me',
  updatedAt: '2026-09-24T20:00:00Z',
};

export const ADMIN_USER: UserProfile = {
  username: 'lead_auditor',
  name: 'Sarah Chen (Platform Auditor)',
  avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
  headline: 'Principal Verifier & Platform Administrator · DevLedgr Core',
  bio: 'Verifying distributed systems submissions, auditing automated test runners, and curating real-world failure mode specs for junior engineers.',
  githubUrl: 'https://github.com/sarahchen-auditor',
  portfolioValidUntil: '2028-01-01T00:00:00Z',
  plan: 'full-service',
  statedSkills: ['Go', 'Rust', 'PostgreSQL', 'Distributed Systems', 'Security Audit'],
  role: 'admin',
  email: 'sarah.chen@devledgr.org',
  updatedAt: '2026-09-25T00:00:00Z',
};

