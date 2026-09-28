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
  -d '{"fleet_size": 12, "active_orders": 45, "depot_geohash": "s10m9r"}'`,
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
            created_at: '2026-09-26T14:30:00Z'
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
    submissionCount: 46
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
  -d '{"spike_rate": 5000, "duplicate_ratio": 0.35, "target_url": "http://localhost:8080/events"}'`,
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
    submissionCount: 92
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
    submissionCount: 34
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
    submissionCount: 58
  },
  {
    id: 'ussd-session-reconciler',
    title: 'High-Volume USSD Session State Machine',
    tagline: '180-second session reconciliation engine handling abrupt telco drops and asynchronous bank responses.',
    domain: 'fintech',
    difficulty: 'production-grade',
    estimatedHours: 14,
    originStory: 'Telco USSD sessions terminate after 180 seconds unconditionally, dropping thousands of transfers mid-input while debiting accounts.',
    problemStatement: `Feature-phone banking relies on ephemeral USSD sessions. When telco timeouts occur during cash transfers, the bank debit executes but the session terminates before crediting the merchant.

Build a resilient state machine that:
1. Tracks multi-hop USSD dialogue state with sub-millisecond Redis lookups.
2. Implements an automatic 2-phase settlement or rollback window if session terminates abruptly.
3. Dispatches SMS confirmation fallback via async queue upon out-of-band transaction resolution.`,
    technicalRequirements: [
      'Finite State Machine (FSM) implementation with deterministic transition rollback.',
      'P99 state transition latency < 15ms under 5,000 active concurrent sessions.',
      'Atomic transaction reconciliation with idempotency protection.'
    ],
    mockInfra: {
      baseUrl: 'https://mock-infra.devledgr.xyz/api/v1/ussd-harness',
      starterRepoUrl: 'https://github.com/devledgr-starters/ussd-fsm-starter',
      curlExample: `curl -X POST https://mock-infra.devledgr.xyz/api/v1/ussd-harness/session/step \\
  -H "Content-Type: application/json" \\
  -d '{"session_id": "ussd_77192", "msisdn": "+2348012345678", "user_input": "1*5000*0123456789#"}'`,
      endpoints: [
        {
          method: 'POST',
          path: '/session/step',
          description: 'Simulates telco USSD step event with configurable radio network drop rates.',
          responseSample: { session_state: 'AWAITING_PIN', timeout_remaining_seconds: 142 }
        }
      ],
      testCriteria: [
        'Zero lost fund states when 25% of sessions drop abruptly after PIN entry.',
        'Immediate dead-session reconciliation execution within 3000ms.'
      ]
    },
    tags: ['Fintech', 'Redis', 'FSM', 'State Machines', 'Go'],
    submissionCount: 41
  },
  {
    id: 'solar-minigrid-timeseries',
    title: 'Bandwidth-Starved Solar Minigrid Telemetry Compactor',
    tagline: 'Edge streaming lossy-to-lossless delta compression for rural 2G IoT solar inverters.',
    domain: 'systems',
    difficulty: 'intermediate',
    estimatedHours: 12,
    originStory: 'Rural solar microgrid controllers in remote communities stream power metrics over metered 2G cellular connections where data costs exceed hardware margins.',
    problemStatement: `IoT solar inverters record voltage, battery temperature, and current every 500ms. Uploading raw JSON over metered 2G costs thousands of dollars monthly.

Build an edge compaction engine that:
1. Implements Gorilla-style XOR floating-point delta compression for time-series streams.
2. Emits compressed binary chunks that decompress losslessly at the cloud collector.
3. Automatically buffers up to 48 hours of telemetry in local circular flash memory during network blackout.`,
    technicalRequirements: [
      'Bit-level stream packing with variable-length Elias delta encoding.',
      'Compression ratio >= 12:1 against raw JSON metric records.',
      'Memory footprint < 8MB RAM for edge deployment.'
    ],
    mockInfra: {
      baseUrl: 'https://mock-infra.devledgr.xyz/api/v1/solar-telemetry',
      starterRepoUrl: 'https://github.com/devledgr-starters/iot-compactor-starter',
      curlExample: `curl -X POST https://mock-infra.devledgr.xyz/api/v1/solar-telemetry/upload \\
  -H "Content-Type: application/octet-stream" \\
  --data-binary @telemetry_chunk.bin`,
      endpoints: [
        {
          method: 'POST',
          path: '/verify-decompression',
          description: 'Cloud harness: decompresses binary chunk and verifies 0.00% precision drift.',
          responseSample: { lossless_verification: true, original_points: 10000, compressed_bytes: 4210 }
        }
      ],
      testCriteria: [
        'Zero float precision loss on 10,000 synthetic voltage sensor readings.',
        'Network bandwidth reduced by > 90% compared to baseline HTTP/JSON.'
      ]
    },
    tags: ['IoT', 'Time-Series', 'Bit Manipulation', 'C/Rust/Go', 'Systems'],
    submissionCount: 27
  },
  {
    id: 'sms-otp-circuitbreaker',
    title: 'Multi-Carrier SMS OTP Circuit Breaker',
    tagline: 'High-availability SMS OTP delivery router with dynamic carrier routing and failover detection.',
    domain: 'devtools',
    difficulty: 'foundational',
    estimatedHours: 8,
    originStory: 'Carrier network degradations cause 60-second OTP delays, blocking user signups and triggering endless resend requests.',
    problemStatement: `When a primary telco aggregator degrades, OTP SMS messages get queued indefinitely. Users click resend multiple times, spamming telco gateways and wasting unit credits.

Build a smart dispatcher that:
1. Tracks delivery acknowledgement latency and failure rate per telco prefix (MTN, Airtel, Safaricom).
2. Trips circuit breaker to secondary aggregator within 3 consecutive delivery failures or > 12s p90 latency.
3. Re-probes primary carrier using synthetic canary probes before closing circuit.`,
    technicalRequirements: [
      'Circuit breaker pattern (Closed, Open, Half-Open) per carrier gateway.',
      'Rolling window statistics (sliding 60 seconds).',
      'Exponential backoff with noise jitter for canary health probes.'
    ],
    mockInfra: {
      baseUrl: 'https://mock-infra.devledgr.xyz/api/v1/sms-router',
      starterRepoUrl: 'https://github.com/devledgr-starters/sms-circuitbreaker-starter',
      curlExample: `curl -X POST https://mock-infra.devledgr.xyz/api/v1/sms-router/dispatch \\
  -d '{"phone": "+254712345678", "otp": "928104"}'`,
      endpoints: [
        {
          method: 'POST',
          path: '/dispatch',
          description: 'Submits SMS for routing across simulated carriers with fluctuating latency.',
          responseSample: { routed_via: 'carrier_backup_b', latency_ms: 180, circuit_status: 'OPEN_FAILOVER' }
        }
      ],
      testCriteria: [
        'Failover to secondary carrier occurs in < 500ms following carrier fault.',
        'Zero duplicate OTP charges to sender account during failover.'
      ]
    },
    tags: ['Circuit Breaker', 'Resilience', 'Node.js', 'Go', 'API Gateway'],
    submissionCount: 65
  },
  {
    id: 'fx-liquidity-hedge-shield',
    title: 'Cross-Border FX Rate Lock & Arbitrage Shield',
    tagline: 'Sliding-window rate cache protecting remittance rails from volatile intra-day currency swings.',
    domain: 'fintech',
    difficulty: 'production-grade',
    estimatedHours: 16,
    originStory: 'Parallel market currency volatility caused remittance operators to execute payments at negative spreads during sudden currency devaluations.',
    problemStatement: `Cross-border payouts give users a guaranteed exchange rate for 10 minutes. If the currency devalues before settlement, the platform absorbs massive losses.

Build an FX protection engine that:
1. Aggregates multi-source currency ticks (Bloomberg, Central Bank, peer-to-peer orderbooks).
2. Computes dynamic risk-weighted spreads based on volatility bands and treasury liquidity.
3. Automatically cancels or hedges forward contracts when volatility breaches safety variance thresholds.`,
    technicalRequirements: [
      'Exponentially Weighted Moving Average (EWMA) volatility estimator.',
      'Atomic rate-lock token issuance with cryptographic expiration claims.',
      'High-throughput orderbook matcher running with zero lock cascades.'
    ],
    mockInfra: {
      baseUrl: 'https://mock-infra.devledgr.xyz/api/v1/fx-shield',
      starterRepoUrl: 'https://github.com/devledgr-starters/fx-hedger-starter',
      curlExample: `curl -X GET https://mock-infra.devledgr.xyz/api/v1/fx-shield/quote?pair=USD_NGN&amount=1000`,
      endpoints: [
        {
          method: 'GET',
          path: '/quote',
          description: 'Returns guaranteed rate lock token with 10-minute validity and volatility score.',
          responseSample: { pair: 'USD_NGN', guaranteed_rate: 1540.50, token: 'fx_lock_99014', expires_in_sec: 600 }
        }
      ],
      testCriteria: [
        'Quote calculation latency < 25ms under 1,000 concurrent FX queries.',
        'Zero quotes issued below cost during simulated 15% flash-devaluation shock.'
      ]
    },
    tags: ['Fintech', 'Financial Engineering', 'Go', 'High Concurrency', 'Redis'],
    submissionCount: 38
  },
  {
    id: 'k8s-canary-ingress',
    title: 'Zero-Downtime Canary Ingress Controller & Traffic Splitter',
    tagline: 'Custom Kubernetes ingress controller with dynamic weight splitting and automated rollback on 5xx bursts.',
    domain: 'systems',
    difficulty: 'production-grade',
    estimatedHours: 14,
    originStory: 'Fintech platforms face outages when deploying new microservices across Kubernetes clusters without progressive traffic shifting and automated health telemetry.',
    problemStatement: `Implement a Kubernetes ingress controller in Go or Python that:
1. Watches Custom Resource Definitions (CRDs) specifying CanaryDeployments (e.g. 95% v1, 5% v2).
2. Dynamically adjusts NGINX/Envoy ingress weights without dropping live TLS connections.
3. Automatically triggers an immediate rollback to baseline version if the canary service registers > 1.5% 5xx errors or latency p99 exceeds 120ms within a 60-second window.`,
    technicalRequirements: [
      'Kubernetes client-go controller with informers and workqueue architecture.',
      'Prometheus telemetry watcher polling live pod request metrics.',
      'Graceful rollback triggering automated Slack/PagerDuty notification and git tag stamp.',
      'Failover actuation latency < 400ms from telemetry threshold breach.'
    ],
    mockInfra: {
      baseUrl: 'https://mock-infra.devledgr.xyz/api/v1/k8s-mesh',
      starterRepoUrl: 'https://github.com/devledgr-starters/k8s-canary-starter',
      curlExample: `curl -X POST https://mock-infra.devledgr.xyz/api/v1/k8s-mesh/deploy-canary \\
  -H "Content-Type: application/json" \\
  -d '{"service": "payments-api", "stable_weight": 90, "canary_weight": 10, "error_threshold_pct": 1.5}'`,
      endpoints: [
        {
          method: 'POST',
          path: '/deploy-canary',
          description: 'Spins up simulated Kubernetes canary deployment and begins traffic injection.',
          responseSample: { status: 'traffic_split_applied', active_pods: 8, ingress_synced: true }
        },
        {
          method: 'POST',
          path: '/inject-fault',
          description: 'Submission test harness: injects synthetic 503 errors to verify automated rollback trigger.',
          responseSample: { rollback_executed: true, rollback_duration_ms: 280, error_spillover_prevented: true }
        }
      ],
      testCriteria: [
        'Rollback successfully executed in under 500ms following fault injection.',
        'Zero traffic routed to dead pods during simulated pod eviction.',
        'Prometheus metrics correctly exported on port 9090.'
      ]
    },
    tags: ['Kubernetes', 'Terraform', 'Go', 'Docker', 'Prometheus', 'DevOps', 'SRE'],
    submissionCount: 29
  },
  {
    id: 'optimistic-ledger-design-system',
    title: 'Optimistic Ledger Token Engine & Accessible Canvas',
    tagline: 'WCAG AAA design system with token synchronization, subgrid layout, and zero-layout-shift data feed.',
    domain: 'devtools',
    difficulty: 'intermediate',
    estimatedHours: 12,
    originStory: 'Design engineering teams needed high-density financial transaction feeds that preserve accessibility contrast, run without Cumulative Layout Shift (CLS), and stay synchronized with Figma design tokens.',
    problemStatement: `Modern enterprise ledgers require dense tabular views with real-time websocket updates.
    
Build an accessible design system and components that:
1. Parses Figma Design Tokens (W3C standard JSON) and emits CSS variable hierarchies for light and dark themes.
2. Implements a responsive tabular matrix using CSS Subgrid with keyboard navigation (Arrow keys, Home, End, Tab) compliant with WCAG AAA standards.
3. Renders optimistic transactions with immediate visual micro-interaction feedback and zero Cumulative Layout Shift (CLS < 0.01).`,
    technicalRequirements: [
      'Strict WCAG 2.2 AAA color contrast compliance (> 7:1 for text).',
      'Zero Cumulative Layout Shift (CLS = 0.000) during live streaming inserts.',
      'Theme-aware design token compiler emitting CSS utility classes.',
      'Screen reader ARIA live region announcing real-time state transitions.'
    ],
    mockInfra: {
      baseUrl: 'https://mock-infra.devledgr.xyz/api/v1/design-tokens',
      starterRepoUrl: 'https://github.com/devledgr-starters/accessible-ledger-starter',
      curlExample: `curl -X GET https://mock-infra.devledgr.xyz/api/v1/design-tokens/sync?theme=dark`,
      endpoints: [
        {
          method: 'GET',
          path: '/sync',
          description: 'Fetches raw token dictionary from simulated Figma API.',
          responseSample: { tokens: { 'color-bg': '#121215', 'color-brass': '#D4AF37', 'radius-md': '6px' } }
        },
        {
          method: 'POST',
          path: '/audit-a11y',
          description: 'Harness testing: runs automated Axe-Core accessibility and contrast compliance test.',
          responseSample: { wcag_aaa_compliant: true, contrast_violations: 0, keyboard_nav_passed: true }
        }
      ],
      testCriteria: [
        'Axe-Core accessibility audit reports 0 violations across all themes.',
        'Keyboard navigation reaches every cell and modal without focus trap.',
        'Renders 1,000 transaction rows without layout stutter.'
      ]
    },
    tags: ['Design Systems', 'Figma Tokens', 'Next.js', 'Tailwind CSS', 'Accessible ARIA', 'Frontend'],
    submissionCount: 41
  }
];

export const INITIAL_SUBMISSIONS: SubmissionEntry[] = [
  {
    hash: 'a3f9d21',
    ideaId: 'lpg-route-optimizer',
    ideaTitle: 'Route Optimizer for Informal LPG Delivery',
    authorUsername: 'junior_dev',
    authorName: 'DevLedgr Candidate',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    repoUrl: 'https://github.com/devledgr-examples/lpg-matrix-router',
    demoUrl: 'https://lpg-router.devledgr.xyz',
    architectureNotes: 'Implemented Dijkstra with dynamic Voronoi cell partitioning for Lagos mainland. Integrated custom haversine weight matrix with penalty for unpaved roads. Sustained 120 req/sec at 42ms p99.',
    timestamp: '2026-09-26T14:22:10Z',
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
    },
    proofSignature: '0x8f9c1b3e4d5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c'
  },
  {
    hash: 'c118e07',
    ideaId: 'webhook-deduplicator',
    ideaTitle: 'Idempotent Webhook Replayer & Deduplicator',
    authorUsername: 'junior_dev',
    authorName: 'DevLedgr Candidate',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    repoUrl: 'https://github.com/devledgr-examples/fintech-idempotency-engine',
    demoUrl: 'https://idempotent-hooks.devledgr.xyz',
    architectureNotes: 'Built on Go + Redis sliding Bloom filters for memory-efficient deduping. Prevents replay attacks using HMAC timing-safe verification and jittered exponential retry backoff.',
    timestamp: '2026-09-26T10:14:45Z',
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
    },
    proofSignature: '0x7e2d9a1f4b8c6e3d2a1b9f8e7c6d5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c'
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
    timestamp: '2026-09-25T16:15:00Z',
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
    },
    proofSignature: '0x4c2b9a7f1e8d6c3b2a1f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b'
  },
  {
    hash: 'e49a102',
    ideaId: 'ussd-session-reconciler',
    ideaTitle: 'High-Volume USSD Session State Machine',
    authorUsername: 'chidi_dev',
    authorName: 'Chidi Okonkwo',
    authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
    repoUrl: 'https://github.com/chidi/ussd-fsm-engine',
    architectureNotes: 'Zero-lock FSM backed by Redis cluster shards with Lua script atomic commits. Guaranteed rollback within 3000ms on dropped carrier radio links.',
    timestamp: '2026-09-26T08:30:00Z',
    status: 'verified',
    testResults: {
      passed: 32,
      total: 32,
      suiteName: 'Telco Radio Drop & FSM Invariant Sim'
    },
    metrics: {
      latencyP99: '12ms',
      throughput: '3,200 req/s',
      coverage: '96.8%'
    },
    proofSignature: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b'
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
    matchScore: 72,
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
  },
  {
    id: 'job-chipper-ledger',
    title: 'Junior Core Ledger & Settlement Engineer',
    company: 'Chipper Cash',
    location: 'Remote (Global / Pan-African)',
    type: 'Full-time',
    salary: '$2,200 - $3,200 / mo',
    tags: ['Fintech', 'Go', 'Redis', 'Ledger', 'State Machines'],
    matchScore: 88,
    matchedIdeaIds: ['ussd-session-reconciler', 'webhook-deduplicator'],
    requiredSkills: [
      'State-machine based transaction reconciliation',
      'Cross-border currency corridor settlement',
      'Distributed lock coordination under network partition'
    ],
    description: `Maintain high-speed cross-border settlement switches where timing out without reconciliation results in ledger imbalance. Candidates with verified USSD and webhook deduplication proof get direct interview access.`,
    gapIdeaId: 'ussd-session-reconciler',
    gapReason: 'Proven implementation of state machine rollback under carrier timeouts required.'
  },
  {
    id: 'job-piggyvest-backend',
    title: 'Core Backend & Financial Safety Engineer',
    company: 'Piggyvest',
    location: 'Lagos / Remote',
    type: 'Full-time',
    salary: '₦1,000,000 - ₦1,500,000 / mo',
    tags: ['PostgreSQL', 'Fintech', 'Idempotency', 'Redis'],
    matchScore: 85,
    matchedIdeaIds: ['webhook-deduplicator', 'schema-migration-guard'],
    requiredSkills: [
      'Sliding-window rate limiting & duplicate prevention',
      'Zero-downtime database migrations with table locking prevention',
      'Strict double-entry financial ledger invariants'
    ],
    description: `Scale automated savings and investment infrastructure for millions of active retail customers. We test real-world database locking and payment idempotency upfront.`,
    gapIdeaId: 'schema-migration-guard',
    gapReason: 'Demonstrated proficiency in non-blocking Postgres migrations is essential.'
  },
  {
    id: 'job-kuda-devops',
    title: 'Site Reliability & Cloud Platform Engineer',
    company: 'Kuda Microfinance Bank',
    location: 'Lagos / London (Remote)',
    type: 'Full-time',
    salary: '₦1,200,000 - ₦1,750,000 / mo',
    tags: ['Kubernetes', 'Terraform', 'Prometheus', 'AWS', 'Go', 'Docker'],
    matchScore: 89,
    matchedIdeaIds: ['k8s-canary-ingress', 'schema-migration-guard'],
    requiredSkills: [
      'Zero-downtime canary deployment rollouts and automated rollback triggers',
      'Terraform Infrastructure-as-Code (IaC) modular architecture',
      'Prometheus, Grafana, and OpenTelemetry observability alerting',
      'Multi-region cluster networking and ingress failure recovery'
    ],
    description: `Maintain high availability across core banking microservices and transactional gateways. DevLedgr applicants with verified canary rollout proofs bypass preliminary technical screens.`,
    gapIdeaId: 'k8s-canary-ingress',
    gapReason: 'Hands-on verification of automated rollback under synthetic fault conditions required.'
  },
  {
    id: 'job-paystack-design',
    title: 'Design Systems & UI Performance Engineer',
    company: 'Paystack',
    location: 'Lagos / Remote',
    type: 'Full-time',
    salary: '₦950,000 - ₦1,400,000 / mo',
    tags: ['Design Systems', 'Figma Tokens', 'Next.js', 'Tailwind CSS', 'A11y'],
    matchScore: 91,
    matchedIdeaIds: ['optimistic-ledger-design-system'],
    requiredSkills: [
      'WCAG 2.2 AAA accessibility compliance across high-density financial matrices',
      'Automated Figma design token compilation into responsive CSS variables',
      'Zero Cumulative Layout Shift (CLS) optimization during live streaming updates',
      'Tactile micro-interaction feedback and keyboard-first navigation'
    ],
    description: `Build the unified developer checkout UI and merchant dashboard used by hundreds of thousands of African businesses. We evaluate code and design system implementation directly through verified ledger proofs.`,
    gapIdeaId: 'optimistic-ledger-design-system',
    gapReason: 'Verified implementation of token sync and accessible matrix components required.'
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
        ideaIdRef: 'ussd-session-reconciler',
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
        ideaIdRef: 'sms-otp-circuitbreaker',
        prompts: [
          'How to spin up ephemeral testcontainers in under 800ms for integration runs.',
          'Design a CI exit code reporter that outputs GitHub Actions check run annotations.'
        ]
      },
      {
        week: 3,
        title: 'Zero-Downtime Rollout Orchestration',
        deliverable: 'Implement blue-green shadow schema migrations with automated rollback.',
        ideaIdRef: 'solar-minigrid-timeseries',
        prompts: [
          'Expand and Contract pattern: Safe column rename strategies without downtime.',
          'How to monitor pg_stat_activity to automatically cancel query execution on lock cascades.'
        ]
      }
    ]
  }
];

export const DEFAULT_USER: UserProfile = {
  username: '',
  name: '',
  avatarUrl: '',
  headline: 'Software Engineer · DevLedgr',
  bio: '',
  githubUrl: '',
  portfolioValidUntil: '2027-09-26T20:00:00Z',
  plan: 'free',
  statedSkills: [],
  role: 'user',
  email: '',
  updatedAt: '2026-09-26T20:00:00Z',
  engineeringTrack: undefined,
  targetRole: undefined,
  experienceLevel: 'junior',
  onboardingCompleted: false,
  githubConnected: false,
  githubUsername: undefined,
  authProvider: undefined,
  githubVerifiedAt: undefined,
};

export const DEMO_CANDIDATE_USER: UserProfile = {
  username: 'junior_dev',
  name: 'Candidate Engineer',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  headline: 'Junior Backend Engineer · 2 Verified Proof-of-Work Entries',
  bio: 'Self-taught engineer transitioning from web basics to resilient distributed backends. Focused on real-world fintech deduplication and logistics optimization.',
  githubUrl: 'https://github.com/junior-dev',
  portfolioValidUntil: '2027-09-26T20:00:00Z',
  plan: 'free',
  statedSkills: ['Go', 'TypeScript', 'PostgreSQL', 'Redis', 'Docker', 'FastAPI'],
  role: 'user',
  email: 'candidate@devledgr.xyz',
  updatedAt: '2026-09-26T20:00:00Z',
  engineeringTrack: 'backend-systems',
  targetRole: 'Backend Engineer',
  experienceLevel: 'junior',
  onboardingCompleted: true,
  githubConnected: true,
  githubUsername: 'junior-dev',
  authProvider: 'github',
  githubVerifiedAt: '2026-09-26T20:00:00Z',
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
  updatedAt: '2026-09-26T00:00:00Z',
  engineeringTrack: 'devops-infra',
  targetRole: 'Infrastructure Architect & Auditor',
  experienceLevel: 'lead',
  onboardingCompleted: true,
  githubConnected: true,
  githubUsername: 'sarahchen-auditor',
  authProvider: 'github',
  githubVerifiedAt: '2026-09-26T00:00:00Z',
};
