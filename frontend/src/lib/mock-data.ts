import { IdeaItem, SubmissionEntry, JobOpportunity, CoachingItinerary, UserProfile } from '@/types';

export const INITIAL_IDEAS: IdeaItem[] = [
  {
    "id": "a0000001-0000-4000-8000-000000000001",
    "title": "Idempotent Webhook Replayer & Deduplicator",
    "tagline": "Zero-loss webhook ingest pipe with distributed deduplication and exponential backoff retry semantics.",
    "domain": "fintech",
    "difficulty": "intermediate",
    "estimatedHours": 10,
    "originStory": "Reported by senior platform leads at African fintechs: payment gateway outages trigger retries that hammer merchant servers, resulting in double credit alerts.",
    "problemStatement": "During partner gateway outages, webhooks arrive out-of-order, duplicated, or in massive burst waves.\n\nBuild an ingestion and replay buffer that guarantees:\n1. Exactly-once processing semantics using cryptographic idempotency keys.\n2. Jittered exponential backoff with dead-letter queue (DLQ) isolation.\n3. Cryptographic HMAC signature verification with timing-attack prevention.",
    "technicalRequirements": [
      "Constant-time signature verification (crypto.timingSafeEqual or hmac.Equal).",
      "Sliding window deduplication with Redis TTL or transactional locking.",
      "Graceful backpressure handling during 10,000 req/sec spikes."
    ],
    "mockInfra": {
      "baseUrl": "https://mock-infra.devledgr.xyz/api/v1/webhook-firehose",
      "starterRepoUrl": "https://github.com/devledgr-starters/webhook-replay-starter",
      "curlExample": "curl -X POST https://mock-infra.devledgr.xyz/api/v1/webhook-firehose/trigger \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"spike_rate\": 5000, \"duplicate_ratio\": 0.35, \"target_url\": \"http://localhost:8080/events\"}'",
      "endpoints": [
        {
          "method": "POST",
          "path": "/trigger",
          "description": "Fires simulated bursts of duplicate, malformed, and valid webhook events.",
          "responseSample": {
            "events_sent": 1000,
            "duplicates_injected": 350,
            "signature_algorithm": "HMAC-SHA256"
          }
        },
        {
          "method": "GET",
          "path": "/telemetry",
          "description": "Checks how many duplicates your system mistakenly executed.",
          "responseSample": {
            "duplicates_processed": 0,
            "unhandled_exceptions": 0,
            "dlq_count": 14
          }
        }
      ],
      "testCriteria": [
        "Deduplication rate must be 100% on identical idempotency keys.",
        "Malformed HMAC signatures must return 401 within 5ms.",
        "Backpressure drop rate must not exceed 0.01% under burst load."
      ]
    },
    "tags": [
      "Distributed Systems",
      "Redis",
      "Node.js",
      "Go",
      "HMAC"
    ],
    "submissionCount": 92
  },
  {
    "id": "a0000001-0000-4000-8000-000000000002",
    "title": "Route Optimizer for Informal LPG Delivery",
    "tagline": "Dynamic clustering and routing for motorcycle cylinder dispatch in dense, unmapped informal settlements.",
    "domain": "logistics",
    "difficulty": "production-grade",
    "estimatedHours": 16,
    "originStory": "Sourced from independent LPG depot dispatchers in Alaba Market, Lagos. Deliveries stall because streets lack formal addresses and driver capacities vary wildly by bike load.",
    "problemStatement": "Informal delivery fleets operate in areas without formal postal codes or reliable street vector geometries. Orders come in via WhatsApp and USSD with landmarks and fuzzy coordinates.\n\nBuild a spatial routing engine that:\n1. Accepts real-time orders with coordinate geohashes and cylinder weights (6kg, 12.5kg, 50kg).\n2. Computes capacity-constrained vehicle routes with 30-minute arrival SLAs.\n3. Provides an idempotent dispatch webhook for drivers to acknowledge pickup without double-assigning cylinders.",
    "technicalRequirements": [
      "Implement Haversine or Vincenty matrix distance calculation with road network penalty factor.",
      "Enforce vehicle capacity limits (max 120kg per motorcycle chassis).",
      "Handle dynamic re-routing when a customer cancels mid-transit.",
      "P95 dispatch endpoint latency < 80ms under 200 concurrent order requests."
    ],
    "mockInfra": {
      "baseUrl": "https://mock-infra.devledgr.xyz/api/v1/lpg",
      "starterRepoUrl": "https://github.com/devledgr-starters/lpg-dispatch-starter",
      "curlExample": "curl -X POST https://mock-infra.devledgr.xyz/api/v1/lpg/simulate-fleet \\\n  -H \"Authorization: Bearer test_key_lpg_99\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"fleet_size\": 12, \"active_orders\": 45, \"depot_geohash\": \"s10m9r\"}'",
      "endpoints": [
        {
          "method": "GET",
          "path": "/depots/active",
          "description": "Fetch current depot stock levels and standby delivery bikes.",
          "responseSample": {
            "depot_id": "depot_ikeja_01",
            "available_cylinders": {
              "6kg": 42,
              "12.5kg": 19,
              "50kg": 4
            },
            "riders_available": 7
          }
        },
        {
          "method": "POST",
          "path": "/orders/incoming-stream",
          "description": "Emulates random customer orders arriving every 500ms.",
          "responseSample": {
            "order_id": "ord_918239",
            "lat": 6.5244,
            "lng": 3.3792,
            "cylinder_type": "12.5kg",
            "created_at": "2026-09-24T18:30:00Z"
          }
        },
        {
          "method": "POST",
          "path": "/routes/verify-solution",
          "description": "Submission test harness: runs 500 historical order batches through your endpoint.",
          "responseSample": {
            "passed": true,
            "sla_compliance_rate": 0.984,
            "fuel_cost_savings_pct": 21.4
          }
        }
      ],
      "testCriteria": [
        "Must return valid GeoJSON MultiLineString for all scheduled routes.",
        "Zero overloaded motorcycle violations during peak rush hour sim.",
        "Graceful 422 error response when order is outside depot service polygon."
      ]
    },
    "tags": [
      "Go",
      "FastAPI",
      "Spatial Indexing",
      "Geohash",
      "Algorithms"
    ],
    "submissionCount": 46
  },
  {
    "id": "a0000001-0000-4000-8000-000000000003",
    "title": "Bandwidth-Starved Solar Minigrid Telemetry Compactor",
    "tagline": "Edge streaming lossy-to-lossless delta compression for rural 2G IoT solar inverters.",
    "domain": "systems",
    "difficulty": "intermediate",
    "estimatedHours": 12,
    "originStory": "Rural solar microgrid controllers in remote communities stream power metrics over metered 2G cellular connections where data costs exceed hardware margins.",
    "problemStatement": "IoT solar inverters record voltage, battery temperature, and current every 500ms. Uploading raw JSON over metered 2G costs thousands of dollars monthly.\n\nBuild an edge compaction engine that:\n1. Implements Gorilla-style XOR floating-point delta compression for time-series streams.\n2. Emits compressed binary chunks that decompress losslessly at the cloud collector.\n3. Automatically buffers up to 48 hours of telemetry in local circular flash memory during network blackout.",
    "technicalRequirements": [
      "Bit-level stream packing with variable-length Elias delta encoding.",
      "Compression ratio >= 12:1 against raw JSON metric records.",
      "Memory footprint < 8MB RAM for edge deployment."
    ],
    "mockInfra": {
      "baseUrl": "https://mock-infra.devledgr.xyz/api/v1/solar-telemetry",
      "starterRepoUrl": "https://github.com/devledgr-starters/iot-compactor-starter",
      "curlExample": "curl -X POST https://mock-infra.devledgr.xyz/api/v1/solar-telemetry/upload \\\n  -H \"Content-Type: application/octet-stream\" \\\n  --data-binary @telemetry_chunk.bin",
      "endpoints": [
        {
          "method": "POST",
          "path": "/verify-decompression",
          "description": "Cloud harness: decompresses binary chunk and verifies 0.00% precision drift.",
          "responseSample": {
            "lossless_verification": true,
            "original_points": 10000,
            "compressed_bytes": 4210
          }
        }
      ],
      "testCriteria": [
        "Zero float precision loss on 10,000 synthetic voltage sensor readings.",
        "Network bandwidth reduced by > 90% compared to baseline HTTP/JSON."
      ]
    },
    "tags": [
      "IoT",
      "Time-Series",
      "Bit Manipulation",
      "C/Rust/Go",
      "Systems"
    ],
    "submissionCount": 27
  },
  {
    "id": "a0000001-0000-4000-8000-000000000004",
    "title": "Offline-First Sync Engine for Rural Health Posts",
    "tagline": "Conflict-free replicated patient record sync between solar-powered tablet clients and provincial health DBs.",
    "domain": "systems",
    "difficulty": "production-grade",
    "estimatedHours": 20,
    "originStory": "Sourced from field epidemiological workers in rural primary healthcare centres with unreliable cell coverage.",
    "problemStatement": "Community nurses record vaccinations, antenatal checks, and drug distributions on tablets. Internet is only available when travelling to town once a week.\n\nBuild a bi-directional conflict-free sync protocol:\n1. Local edits are stored in IndexedDB or SQLite.\n2. Sync merges delta records without overwriting contemporaneous nurse notes.\n3. Conflict resolution follows Last-Write-Wins with immutable change vectors.",
    "technicalRequirements": [
      "CRDT state-based or delta-based replication protocol.",
      "Vector clock timestamp tracking per patient entity.",
      "Bandwidth-optimized compressed binary or delta-JSON transfer."
    ],
    "mockInfra": {
      "baseUrl": "https://mock-infra.devledgr.xyz/api/v1/clinic-sync",
      "starterRepoUrl": "https://github.com/devledgr-starters/offline-crdt-starter",
      "curlExample": "curl -X POST https://mock-infra.devledgr.xyz/api/v1/clinic-sync/replicate \\\n  -H \"X-Client-Clock: 14:nodeB\" \\\n  -d '{\"deltas\": [{\"entity\": \"patient_88\", \"field\": \"vaccine_dose_2\", \"val\": true}]}'",
      "endpoints": [
        {
          "method": "GET",
          "path": "/provincial-records",
          "description": "Simulates central database state with synthetic concurrent edits.",
          "responseSample": {
            "records_count": 500,
            "state_vector": "v_sync_9941"
          }
        }
      ],
      "testCriteria": [
        "Zero lost update mutations when 3 clients edit the same patient offline.",
        "Sync payload size for 1,000 patient diffs < 150KB gzip."
      ]
    },
    "tags": [
      "CRDT",
      "SQLite",
      "TypeScript",
      "Offline-First",
      "Protobuf"
    ],
    "submissionCount": 34
  },
  {
    "id": "a0000001-0000-4000-8000-000000000006",
    "title": "High-Volume USSD Session State Machine",
    "tagline": "180-second session reconciliation engine handling abrupt telco drops and asynchronous bank responses.",
    "domain": "fintech",
    "difficulty": "production-grade",
    "estimatedHours": 14,
    "originStory": "Telco USSD sessions terminate after 180 seconds unconditionally, dropping thousands of transfers mid-input while debiting accounts.",
    "problemStatement": "Feature-phone banking relies on ephemeral USSD sessions. When telco timeouts occur during cash transfers, the bank debit executes but the session terminates before crediting the merchant.\n\nBuild a resilient state machine that:\n1. Tracks multi-hop USSD dialogue state with sub-millisecond Redis lookups.\n2. Implements an automatic 2-phase settlement or rollback window if session terminates abruptly.\n3. Dispatches SMS confirmation fallback via async queue upon out-of-band transaction resolution.",
    "technicalRequirements": [
      "Finite State Machine (FSM) implementation with deterministic transition rollback.",
      "P99 state transition latency < 15ms under 5,000 active concurrent sessions.",
      "Atomic transaction reconciliation with idempotency protection."
    ],
    "mockInfra": {
      "baseUrl": "https://mock-infra.devledgr.xyz/api/v1/ussd-harness",
      "starterRepoUrl": "https://github.com/devledgr-starters/ussd-fsm-starter",
      "curlExample": "curl -X POST https://mock-infra.devledgr.xyz/api/v1/ussd-harness/session/step \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"session_id\": \"ussd_77192\", \"msisdn\": \"+2348012345678\", \"user_input\": \"1*5000*0123456789#\"}'",
      "endpoints": [
        {
          "method": "POST",
          "path": "/session/step",
          "description": "Simulates telco USSD step event with configurable radio network drop rates.",
          "responseSample": {
            "session_state": "AWAITING_PIN",
            "timeout_remaining_seconds": 142
          }
        }
      ],
      "testCriteria": [
        "Zero lost fund states when 25% of sessions drop abruptly after PIN entry.",
        "Immediate dead-session reconciliation execution within 3000ms."
      ]
    },
    "tags": [
      "Fintech",
      "Redis",
      "FSM",
      "State Machines",
      "Go"
    ],
    "submissionCount": 41
  },
  {
    "id": "a0000001-0000-4000-8000-000000000007",
    "title": "Cross-Border FX Rate Lock & Arbitrage Shield",
    "tagline": "Sliding-window rate cache protecting remittance rails from volatile intra-day currency swings.",
    "domain": "fintech",
    "difficulty": "production-grade",
    "estimatedHours": 16,
    "originStory": "Parallel market currency volatility caused remittance operators to execute payments at negative spreads during sudden currency devaluations.",
    "problemStatement": "Cross-border payouts give users a guaranteed exchange rate for 10 minutes. If the currency devalues before settlement, the platform absorbs massive losses.\n\nBuild an FX protection engine that:\n1. Aggregates multi-source currency ticks (Bloomberg, Central Bank, peer-to-peer orderbooks).\n2. Computes dynamic risk-weighted spreads based on volatility bands and treasury liquidity.\n3. Automatically cancels or hedges forward contracts when volatility breaches safety variance thresholds.",
    "technicalRequirements": [
      "Exponentially Weighted Moving Average (EWMA) volatility estimator.",
      "Atomic rate-lock token issuance with cryptographic expiration claims.",
      "High-throughput orderbook matcher running with zero lock cascades."
    ],
    "mockInfra": {
      "baseUrl": "https://mock-infra.devledgr.xyz/api/v1/fx-shield",
      "starterRepoUrl": "https://github.com/devledgr-starters/fx-hedger-starter",
      "curlExample": "curl -X GET https://mock-infra.devledgr.xyz/api/v1/fx-shield/quote?pair=USD_NGN&amount=1000",
      "endpoints": [
        {
          "method": "GET",
          "path": "/quote",
          "description": "Returns guaranteed rate lock token with 10-minute validity and volatility score.",
          "responseSample": {
            "pair": "USD_NGN",
            "guaranteed_rate": 1540.5,
            "token": "fx_lock_99014",
            "expires_in_sec": 600
          }
        }
      ],
      "testCriteria": [
        "Quote calculation latency < 25ms under 1,000 concurrent FX queries.",
        "Zero quotes issued below cost during simulated 15% flash-devaluation shock."
      ]
    },
    "tags": [
      "Fintech",
      "Financial Engineering",
      "Go",
      "High Concurrency",
      "Redis"
    ],
    "submissionCount": 38
  },
  {
    "id": "a0000001-0000-4000-8000-000000000008",
    "title": "Multi-Tenant Schema Migration Verifier",
    "tagline": "Static AST analyzer and dry-run shadow query runner to catch lock-contention DDL before production deploy.",
    "domain": "devtools",
    "difficulty": "intermediate",
    "estimatedHours": 12,
    "originStory": "Postgres table locks during accidental non-concurrent index creation caused a 45-minute cascading outage.",
    "problemStatement": "Junior devs frequently ship migrations like `ALTER TABLE ... ADD COLUMN ... DEFAULT ...` on multi-million row tables, locking customer transactions.\n\nBuild a CLI and CI verification tool that:\n1. Parses SQL migration files using AST.\n2. Identifies dangerous statements (`CREATE INDEX` without `CONCURRENTLY`, table rewrites, lock escalation).\n3. Executes a shadow dry-run against an ephemeral Postgres test container with pg_locks monitoring.",
    "technicalRequirements": [
      "AST parsing for PostgreSQL dialect.",
      "Lock level classification (AccessExclusiveLock vs ShareUpdateExclusiveLock).",
      "CI exit code 1 with remediation advice snippet."
    ],
    "mockInfra": {
      "baseUrl": "https://mock-infra.devledgr.xyz/api/v1/schema-guard",
      "starterRepoUrl": "https://github.com/devledgr-starters/schema-guard-starter",
      "curlExample": "curl -X POST https://mock-infra.devledgr.xyz/api/v1/schema-guard/audit-ddl \\\n  -d '{\"sql\": \"ALTER TABLE transactions ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT \\'pending\\';\"}'",
      "endpoints": [
        {
          "method": "POST",
          "path": "/audit-ddl",
          "description": "Submits SQL snippet to receive safety analysis and table lock hazards.",
          "responseSample": {
            "safe": false,
            "hazard_level": "CRITICAL",
            "lock_type": "AccessExclusiveLock",
            "remediation": "Use nullable column first, backfill in batches, then add NOT NULL constraint."
          }
        }
      ],
      "testCriteria": [
        "Correctly flags 10 out of 10 classic Postgres trap migrations.",
        "Outputs GitHub Actions compatible annotations."
      ]
    },
    "tags": [
      "PostgreSQL",
      "AST",
      "Go",
      "CLI",
      "Database Internals"
    ],
    "submissionCount": 58
  },
  {
    "id": "a0000001-0000-4000-8000-000000000009",
    "title": "Zero-Downtime Canary Ingress Controller & Traffic Splitter",
    "tagline": "Custom Kubernetes ingress controller with dynamic weight splitting and automated rollback on 5xx bursts.",
    "domain": "infrastructure",
    "difficulty": "production-grade",
    "estimatedHours": 14,
    "originStory": "Fintech platforms face outages when deploying new microservices across Kubernetes clusters without progressive traffic shifting and automated health telemetry.",
    "problemStatement": "Implement a Kubernetes ingress controller in Go or Python that:\n1. Watches Custom Resource Definitions (CRDs) specifying CanaryDeployments (e.g. 95% v1, 5% v2).\n2. Dynamically adjusts NGINX/Envoy ingress weights without dropping live TLS connections.\n3. Automatically triggers an immediate rollback to baseline version if the canary service registers > 1.5% 5xx errors or latency p99 exceeds 120ms within a 60-second window.",
    "technicalRequirements": [
      "Kubernetes client-go controller with informers and workqueue architecture.",
      "Prometheus telemetry watcher polling live pod request metrics.",
      "Graceful rollback triggering automated Slack/PagerDuty notification and git tag stamp.",
      "Failover actuation latency < 400ms from telemetry threshold breach."
    ],
    "mockInfra": {
      "baseUrl": "https://mock-infra.devledgr.xyz/api/v1/k8s-mesh",
      "starterRepoUrl": "https://github.com/devledgr-starters/k8s-canary-starter",
      "curlExample": "curl -X POST https://mock-infra.devledgr.xyz/api/v1/k8s-mesh/deploy-canary \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"service\": \"payments-api\", \"stable_weight\": 90, \"canary_weight\": 10, \"error_threshold_pct\": 1.5}'",
      "endpoints": [
        {
          "method": "POST",
          "path": "/deploy-canary",
          "description": "Spins up simulated Kubernetes canary deployment and begins traffic injection.",
          "responseSample": {
            "status": "traffic_split_applied",
            "active_pods": 8,
            "ingress_synced": true
          }
        },
        {
          "method": "POST",
          "path": "/inject-fault",
          "description": "Submission test harness: injects synthetic 503 errors to verify automated rollback trigger.",
          "responseSample": {
            "rollback_executed": true,
            "rollback_duration_ms": 280,
            "error_spillover_prevented": true
          }
        }
      ],
      "testCriteria": [
        "Rollback successfully executed in under 500ms following fault injection.",
        "Zero traffic routed to dead pods during simulated pod eviction.",
        "Prometheus metrics correctly exported on port 9090."
      ]
    },
    "tags": [
      "Kubernetes",
      "Terraform",
      "Go",
      "Docker",
      "Prometheus",
      "DevOps",
      "SRE"
    ],
    "submissionCount": 29
  },
  {
    "id": "a0000001-0000-4000-8000-000000000010",
    "title": "Multi-Carrier SMS OTP Circuit Breaker",
    "tagline": "High-availability SMS OTP delivery router with dynamic carrier routing and failover detection.",
    "domain": "devtools",
    "difficulty": "foundational",
    "estimatedHours": 8,
    "originStory": "Carrier network degradations cause 60-second OTP delays, blocking user signups and triggering endless resend requests.",
    "problemStatement": "When a primary telco aggregator degrades, OTP SMS messages get queued indefinitely. Users click resend multiple times, spamming telco gateways and wasting unit credits.\n\nBuild a smart dispatcher that:\n1. Tracks delivery acknowledgement latency and failure rate per telco prefix (MTN, Airtel, Safaricom).\n2. Trips circuit breaker to secondary aggregator within 3 consecutive delivery failures or > 12s p90 latency.\n3. Re-probes primary carrier using synthetic canary probes before closing circuit.",
    "technicalRequirements": [
      "Circuit breaker pattern (Closed, Open, Half-Open) per carrier gateway.",
      "Rolling window statistics (sliding 60 seconds).",
      "Exponential backoff with noise jitter for canary health probes."
    ],
    "mockInfra": {
      "baseUrl": "https://mock-infra.devledgr.xyz/api/v1/sms-router",
      "starterRepoUrl": "https://github.com/devledgr-starters/sms-circuitbreaker-starter",
      "curlExample": "curl -X POST https://mock-infra.devledgr.xyz/api/v1/sms-router/dispatch \\\n  -d '{\"phone\": \"+254712345678\", \"otp\": \"928104\"}'",
      "endpoints": [
        {
          "method": "POST",
          "path": "/dispatch",
          "description": "Submits SMS for routing across simulated carriers with fluctuating latency.",
          "responseSample": {
            "routed_via": "carrier_backup_b",
            "latency_ms": 180,
            "circuit_status": "OPEN_FAILOVER"
          }
        }
      ],
      "testCriteria": [
        "Failover to secondary carrier occurs in < 500ms following carrier fault.",
        "Zero duplicate OTP charges to sender account during failover."
      ]
    },
    "tags": [
      "Circuit Breaker",
      "Resilience",
      "Node.js",
      "Go",
      "API Gateway"
    ],
    "submissionCount": 65
  },
  {
    "id": "a0000001-0000-4000-8000-000000000011",
    "title": "Optimistic Ledger Token Engine & Accessible Canvas",
    "tagline": "WCAG AAA design system with token synchronization, subgrid layout, and zero-layout-shift data feed.",
    "domain": "frontend",
    "difficulty": "intermediate",
    "estimatedHours": 12,
    "originStory": "Design engineering teams needed high-density financial transaction feeds that preserve accessibility contrast, run without Cumulative Layout Shift (CLS), and stay synchronized with Figma design tokens.",
    "problemStatement": "Modern enterprise ledgers require dense tabular views with real-time websocket updates.\n\nBuild an accessible design system and components that:\n1. Parses Figma Design Tokens (W3C standard JSON) and emits CSS variable hierarchies for light and dark themes.\n2. Implements a responsive tabular matrix using CSS Subgrid with keyboard navigation (Arrow keys, Home, End, Tab) compliant with WCAG AAA standards.\n3. Renders optimistic transactions with immediate visual micro-interaction feedback and zero Cumulative Layout Shift (CLS < 0.01).",
    "technicalRequirements": [
      "Strict WCAG 2.2 AAA color contrast compliance (> 7:1 for text).",
      "Zero Cumulative Layout Shift (CLS = 0.000) during live streaming inserts.",
      "Theme-aware design token compiler emitting CSS utility classes.",
      "Screen reader ARIA live region announcing real-time state transitions."
    ],
    "mockInfra": {
      "baseUrl": "https://mock-infra.devledgr.xyz/api/v1/design-tokens",
      "starterRepoUrl": "https://github.com/devledgr-starters/accessible-ledger-starter",
      "curlExample": "curl -X GET https://mock-infra.devledgr.xyz/api/v1/design-tokens/sync?theme=dark",
      "endpoints": [
        {
          "method": "GET",
          "path": "/sync",
          "description": "Fetches raw token dictionary from simulated Figma API.",
          "responseSample": {
            "tokens": {
              "color-bg": "#121215",
              "color-brass": "#D4AF37",
              "radius-md": "6px"
            }
          }
        },
        {
          "method": "POST",
          "path": "/audit-a11y",
          "description": "Harness testing: runs automated Axe-Core accessibility and contrast compliance test.",
          "responseSample": {
            "wcag_aaa_compliant": true,
            "contrast_violations": 0,
            "keyboard_nav_passed": true
          }
        }
      ],
      "testCriteria": [
        "Axe-Core accessibility audit reports 0 violations across all themes.",
        "Keyboard navigation reaches every cell and modal without focus trap.",
        "Renders 1,000 transaction rows without layout stutter."
      ]
    },
    "tags": [
      "Design Systems",
      "Figma Tokens",
      "Next.js",
      "Tailwind CSS",
      "Accessible ARIA",
      "Frontend"
    ],
    "submissionCount": 41
  },
  {
    "id": "a0000001-0000-4000-8000-000000000013",
    "title": "Low-Bandwidth Mobile Checkout Flow with Zero CLS",
    "tagline": "Sub-50ms reactive payment UI resilient to flaky 2G connections and zero layout jitter.",
    "domain": "frontend",
    "difficulty": "production-grade",
    "estimatedHours": 14,
    "originStory": "Ecommerce checkouts in emerging markets drop 35% of conversions due to font flash, layout thrashing, and unhandled offline disconnections.",
    "problemStatement": "Customers on flaky mobile networks abandon checkouts when the payment form jumps (CLS) or freezes without feedback.\n\nBuild a zero-CLS checkout interface that:\n1. Embeds critical layout dimensions with zero layout shift (CLS = 0.000) on dynamic card brand detection.\n2. Provides instant optimistic validation with offline intent persistence in localStorage.\n3. Emits tactile feedback states and works seamlessly with screen readers.",
    "technicalRequirements": [
      "Cumulative Layout Shift CLS < 0.005 during async validation.",
      "Total JavaScript bundle footprint < 35KB gzipped.",
      "Full keyboard and assistive screen reader accessibility (ARIA 1.2 compliant).",
      "Local intent resume when connection restores."
    ],
    "mockInfra": {
      "baseUrl": "https://mock-infra.devledgr.xyz/api/v1/checkout-sim",
      "starterRepoUrl": "https://github.com/devledgr-starters/checkout-zero-cls-starter",
      "curlExample": "curl -X POST https://mock-infra.devledgr.xyz/api/v1/checkout-sim/initiate \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"cart_id\": \"cart_99182\", \"amount\": 2500, \"currency\": \"KES\"}'",
      "endpoints": [
        {
          "method": "POST",
          "path": "/initiate",
          "description": "Simulates edge cart initiation with flaky 2G throttling parameters.",
          "responseSample": {
            "checkout_token": "chk_817293",
            "latency_penalty_ms": 120,
            "ready": true
          }
        },
        {
          "method": "POST",
          "path": "/verify-cls",
          "description": "Runs synthetic Chrome User Experience (CrUX) test to verify zero CLS during font loading.",
          "responseSample": {
            "measured_cls": 0,
            "inp_p75_ms": 22,
            "performance_score": 99
          }
        }
      ],
      "testCriteria": [
        "CrUX verification records 0.000 CLS across all simulated device viewports.",
        "Checkout works when network connection is severed mid-form and reconnected."
      ]
    },
    "tags": [
      "Web Performance",
      "CLS",
      "Next.js",
      "Core Web Vitals",
      "Accessibility",
      "Frontend"
    ],
    "submissionCount": 31
  },
  {
    "id": "a0000001-0000-4000-8000-000000000014",
    "title": "Semantic Cache for LLM Invocations",
    "tagline": "Embedding-based vector similarity cache reducing redundant LLM API spend and latency by 45%.",
    "domain": "ai",
    "difficulty": "intermediate",
    "estimatedHours": 10,
    "originStory": "Customer support and search LLM applications waste tens of thousands in token costs answering semantically identical questions with slight syntactic rephrasings.",
    "problemStatement": "Standard exact-match key-value caches miss identical prompts like 'How do I reset my password?' vs 'Steps to change password'.\n\nBuild a semantic proxy gateway that:\n1. Computes dense vector embeddings of incoming prompts via an onnx runtime or embedding API.\n2. Queries a vector index with cosine similarity threshold (> 0.92).\n3. Returns cached responses with sub-15ms latency when similarity matches, cutting token costs by > 40%.",
    "technicalRequirements": [
      "Vector similarity search with cosine distance metric in Redis or pgvector.",
      "Sub-20ms cache lookup latency at p99.",
      "LRU semantic eviction policy based on access recency and cluster centroid frequency."
    ],
    "mockInfra": {
      "baseUrl": "https://mock-infra.devledgr.xyz/api/v1/llm-cache",
      "starterRepoUrl": "https://github.com/devledgr-starters/semantic-cache-starter",
      "curlExample": "curl -X POST https://mock-infra.devledgr.xyz/api/v1/llm-cache/query \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"prompt\": \"How do I rotate my API keys in DevLedgr?\", \"similarity_threshold\": 0.92}'",
      "endpoints": [
        {
          "method": "POST",
          "path": "/query",
          "description": "Submits prompt for semantic vector match and cached completion return.",
          "responseSample": {
            "hit": true,
            "similarity": 0.964,
            "cached_response": "Navigate to Settings -> API Keys and click Rotate.",
            "latency_ms": 11
          }
        },
        {
          "method": "GET",
          "path": "/metrics",
          "description": "Exports cache hit ratio, token savings, and cluster dispersion metrics.",
          "responseSample": {
            "hit_ratio": 0.442,
            "token_savings_pct": 46.1,
            "total_saved_usd": 1240.5
          }
        }
      ],
      "testCriteria": [
        "Semantic hit rate > 40% on test harness with 1,000 synthetic rephrased queries.",
        "Zero false positive matches on semantically contradictory queries."
      ]
    },
    "tags": [
      "LLM",
      "Embeddings",
      "Vector Search",
      "Redis",
      "pgvector",
      "Python",
      "Go"
    ],
    "submissionCount": 49
  },
  {
    "id": "a0000001-0000-4000-8000-000000000015",
    "title": "Hybrid Vector & Lexical RAG Retrieval Engine",
    "tagline": "Reciprocal Rank Fusion (RRF) search engine combining dense vector embeddings with BM25 keyword matching.",
    "domain": "ai",
    "difficulty": "production-grade",
    "estimatedHours": 16,
    "originStory": "Dense vector search fails on exact keyword identifiers (e.g. error codes, UUIDs, SKU numbers), causing RAG hallucination.",
    "problemStatement": "Pure vector search retrieves semantically relevant context but regularly misses exact SKU numbers, error codes, and technical jargon.\n\nBuild a hybrid RAG retrieval pipeline that:\n1. Executes concurrent BM25 inverted index search and dense HNSW vector search.\n2. Normalizes scores using Reciprocal Rank Fusion (RRF with k=60).\n3. Re-ranks top-5 candidate chunks with a cross-encoder before prompt injection.",
    "technicalRequirements": [
      "Hybrid retrieval: BM25 full-text + dense vector embeddings.",
      "Reciprocal Rank Fusion algorithm implementation.",
      "P95 retrieval latency < 85ms across 100,000 document chunks."
    ],
    "mockInfra": {
      "baseUrl": "https://mock-infra.devledgr.xyz/api/v1/rag-retriever",
      "starterRepoUrl": "https://github.com/devledgr-starters/hybrid-rag-starter",
      "curlExample": "curl -X POST https://mock-infra.devledgr.xyz/api/v1/rag-retriever/search \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"query\": \"ERR_CONNECTION_REFUSED in pg_hba.conf\", \"top_k\": 5}'",
      "endpoints": [
        {
          "method": "POST",
          "path": "/search",
          "description": "Performs hybrid BM25 + dense search with RRF scoring and cross-encoder re-ranking.",
          "responseSample": {
            "results": [
              {
                "chunk_id": "doc_9918",
                "score": 0.941,
                "text": "Ensure listen_addresses includes localhost or subnet CIDR..."
              }
            ]
          }
        },
        {
          "method": "POST",
          "path": "/evaluate-accuracy",
          "description": "Runs automated retrieval benchmark testing Recall@5 on exact error code queries.",
          "responseSample": {
            "recall_at_5": 0.985,
            "mrr": 0.92,
            "latency_p95_ms": 64
          }
        }
      ],
      "testCriteria": [
        "Recall@5 on exact alphanumeric technical error codes must reach >= 95%.",
        "P95 retrieval latency under 85ms with 100 concurrent search streams."
      ]
    },
    "tags": [
      "RAG",
      "Vector Search",
      "BM25",
      "Reciprocal Rank Fusion",
      "NLP",
      "Python"
    ],
    "submissionCount": 36
  },
  {
    "id": "a0000001-0000-4000-8000-000000000016",
    "title": "Deterministic LLM Hallucination Guardrail Gateway",
    "tagline": "Streaming AST grammar constraint validator enforcing valid JSON output schema and preventing prompt injections.",
    "domain": "ai",
    "difficulty": "production-grade",
    "estimatedHours": 14,
    "originStory": "Financial workflows breaking downstream parsers when LLM responses include Markdown backticks or hallucinated fields.",
    "problemStatement": "LLMs frequently produce conversational preambles, malformed JSON, or hallucinated fields during automated ingestion pipelines.\n\nBuild an inline streaming guardrail proxy that:\n1. Enforces strict JSON Schema grammar constraints token-by-token during generation.\n2. Masks sensitive PII (credit cards, phone numbers, API keys) via regex and named entity recognition.\n3. Aborts and rolls back to deterministic fallback if hallucination score exceeds 0.05.",
    "technicalRequirements": [
      "Token-level grammar-guided decoding filter (CFG / BNF parser).",
      "Streaming regex PII sanitizer with zero buffer stalls.",
      "Structured JSON output guaranteed compliant with JSON Schema draft 2020-12."
    ],
    "mockInfra": {
      "baseUrl": "https://mock-infra.devledgr.xyz/api/v1/llm-guardrail",
      "starterRepoUrl": "https://github.com/devledgr-starters/llm-guardrail-starter",
      "curlExample": "curl -X POST https://mock-infra.devledgr.xyz/api/v1/llm-guardrail/validate-stream \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"schema\": {\"type\": \"object\", \"required\": [\"amount\", \"recipient\"], \"properties\": {\"amount\": {\"type\": \"number\"}, \"recipient\": {\"type\": \"string\"}}}}'",
      "endpoints": [
        {
          "method": "POST",
          "path": "/validate-stream",
          "description": "Streams incoming LLM tokens through grammar parser and enforces structural conformance.",
          "responseSample": {
            "valid_json": true,
            "sanitized_pii_count": 0,
            "schema_conformance_score": 1
          }
        },
        {
          "method": "POST",
          "path": "/test-suite",
          "description": "Harness test: sends 500 adversarial jailbreaks and unconstrained JSON inputs.",
          "responseSample": {
            "passed": 500,
            "rejected_jailbreaks": 500,
            "zero_malformed_json": true
          }
        }
      ],
      "testCriteria": [
        "100% of generated responses strictly parseable by standard JSON parsers.",
        "Zero leaks of simulated PII or API tokens in output stream."
      ]
    },
    "tags": [
      "Guardrails",
      "LLM Security",
      "Grammar-Guided Decoding",
      "JSON Schema",
      "AI Systems"
    ],
    "submissionCount": 42
  }
];

export const INITIAL_SUBMISSIONS: SubmissionEntry[] = [
  {
    hash: 'a3f9d21',
    ideaId: 'a0000001-0000-4000-8000-000000000002',
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
    ideaId: 'a0000001-0000-4000-8000-000000000001',
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
    ideaId: 'a0000001-0000-4000-8000-000000000008',
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
    gapIdeaId: 'a0000001-0000-4000-8000-000000000011',
    gapReason: 'Verified implementation of token sync and accessible matrix components required.'
  }
];

export const INITIAL_COACHING: CoachingItinerary[] = [
  {
    "id": "backend-fundamentals",
    "title": "Backend Fundamentals: From REST to Distributed Consistency",
    "subtitle": "A 4-week structured track taking you from simple CRUD to failure-resilient distributed architectures.",
    "targetRole": "Backend Platform Engineer",
    "durationWeeks": 4,
    "milestones": [
      {
        "week": 1,
        "title": "Network Failures & Idempotency",
        "deliverable": "Build an ingestion buffer that guarantees zero-double-credit payment webhook processing.",
        "ideaIdRef": "a0000001-0000-4000-8000-000000000001",
        "prompts": [
          "Design an API that handles HTTP 504 timeouts gracefully.",
          "Explain why UUIDv4 vs ULID impacts B-Tree index fragmentation.",
          "How to implement sliding window deduplication in Redis with atomic SETNX."
        ]
      },
      {
        "week": 2,
        "title": "Logistics Optimization & Spatial Clustering",
        "deliverable": "Ship a real-time dispatch and routing tracker with road network penalty factors.",
        "ideaIdRef": "a0000001-0000-4000-8000-000000000002",
        "prompts": [
          "How does Haversine calculation break down over dense urban paths?",
          "Compare K-means vs DBSCAN for dispatch clustering.",
          "Designing geohash-based spatial indexing in PostgreSQL with PostGIS vs raw float coordinates."
        ]
      },
      {
        "week": 3,
        "title": "Database Locking & Telemetry Compaction",
        "deliverable": "Build high-throughput telemetry aggregation with deadlock-free concurrency.",
        "ideaIdRef": "a0000001-0000-4000-8000-000000000003",
        "prompts": [
          "Why does ALTER TABLE ... ADD COLUMN rewrite the heap in older Postgres versions?",
          "How to run zero-downtime index creation safely without write lockouts.",
          "Analyzing row-level locking: FOR UPDATE vs FOR NO KEY UPDATE."
        ]
      },
      {
        "week": 4,
        "title": "Offline State Synchronization & Local Storage",
        "deliverable": "Implement an offline-resilient inventory synchronization engine.",
        "ideaIdRef": "a0000001-0000-4000-8000-000000000004",
        "prompts": [
          "State-based vs Operation-based CRDT trade-offs.",
          "Vector clock vs Last-Write-Wins in intermittent connectivity environments.",
          "Local SQLite to remote PostgreSQL delta synchronization protocols."
        ]
      }
    ]
  },
  {
    "id": "fintech-reliability",
    "title": "Fintech Systems: High-Throughput Idempotency & Financial Auditing",
    "subtitle": "Focused track tailored for payment processing switches, reconciliation ledgers, and zero-data-loss burst traffic.",
    "targetRole": "Fintech Infrastructure Lead",
    "durationWeeks": 3,
    "milestones": [
      {
        "week": 1,
        "title": "Zero-Loss Ingestion Buffer",
        "deliverable": "Implement a sliding Bloom filter or distributed hash dedup pipe with HMAC signature check.",
        "ideaIdRef": "a0000001-0000-4000-8000-000000000001",
        "prompts": [
          "How do timing attacks breach HMAC signatures and why use crypto.timingSafeEqual?",
          "Structuring exponential backoff with decorrelated full jitter.",
          "Partitioning Redis clusters to prevent hot-key bottlenecks on payment gateway callbacks."
        ]
      },
      {
        "week": 2,
        "title": "High-Volume USSD Session FSM",
        "deliverable": "Build an atomic state machine handling telco timeouts and network drops.",
        "ideaIdRef": "a0000001-0000-4000-8000-000000000006",
        "prompts": [
          "Ensuring atomic ledger transfers during unexpected USSD session termination.",
          "Optimistic locking vs Redis distributed locks for session state persistence.",
          "Handling asynchronous bank credit notifications arriving 10 minutes post session drop."
        ]
      },
      {
        "week": 3,
        "title": "Credit Risk & FX Volatility Shield",
        "deliverable": "Implement real-time micro-lending risk scoring and cryptographic ledger audits.",
        "ideaIdRef": "a0000001-0000-4000-8000-000000000007",
        "prompts": [
          "How to compute moving average volatility bands on parallel foreign exchange orderbooks.",
          "Cryptographic hash chaining for double-entry bookkeeping ledgers.",
          "Mitigating flash arbitrage attacks when local carrier liquidity spreads widen."
        ]
      }
    ]
  },
  {
    "id": "devtools-infrastructure",
    "title": "DevTools & Infrastructure: Compilers, ASTs & Production SRE",
    "subtitle": "Build developer productivity tools, CI static analyzers, zero-downtime controllers, and distributed telemetry buffers.",
    "targetRole": "Infrastructure & Platform Engineer",
    "durationWeeks": 3,
    "milestones": [
      {
        "week": 1,
        "title": "AST & DDL Safety Guard",
        "deliverable": "Build a static SQL analyzer catching table-rewrites and AccessExclusiveLock migrations.",
        "ideaIdRef": "a0000001-0000-4000-8000-000000000008",
        "prompts": [
          "How to parse PostgreSQL AST in Go or TypeScript to detect table lock hazards.",
          "Creating ephemeral shadow databases in Docker for automated migration verification.",
          "Writing GitHub Action annotations directly from CLI exit states."
        ]
      },
      {
        "week": 2,
        "title": "Canary Deployments & Health Probers",
        "deliverable": "Implement automated progressive rollout with automated rollback triggers.",
        "ideaIdRef": "a0000001-0000-4000-8000-000000000009",
        "prompts": [
          "How to programmatically manipulate NGINX/Envoy traffic weights via Kubernetes CRDs.",
          "Defining statistically valid error-rate thresholds for automated rollbacks.",
          "Handling persistent WebSocket connection draining during pod evictions."
        ]
      },
      {
        "week": 3,
        "title": "Multi-Carrier Circuit Breaker & Tracing",
        "deliverable": "Build a high-availability SMS router with rolling window latency telemetry.",
        "ideaIdRef": "a0000001-0000-4000-8000-000000000010",
        "prompts": [
          "Implementing sliding-window statistics in memory without lock contention.",
          "Circuit breaker state machine: moving from Open to Half-Open with canary traffic.",
          "Designing OpenTelemetry distributed tracing spans across external telecom boundaries."
        ]
      }
    ]
  },
  {
    "id": "frontend-architecture",
    "title": "Frontend Architecture: Design Systems, Offline Stores & Zero-Jank UI",
    "subtitle": "Design high-density data matrices, token sync pipelines, offline IndexedDB sync, and zero-CLS web applications.",
    "targetRole": "Principal Frontend Architect",
    "durationWeeks": 3,
    "milestones": [
      {
        "week": 1,
        "title": "Design Token Engine & Figma Synchronization",
        "deliverable": "Build an automated CSS variable generator with strict accessibility audit.",
        "ideaIdRef": "a0000001-0000-4000-8000-000000000011",
        "prompts": [
          "Structuring design tokens according to the W3C Design Tokens Community Group format.",
          "Enforcing WCAG 2.2 AAA contrast ratios in dynamic dark and light mode themes.",
          "Implementing accessible keyboard navigation with roving tabindex across complex tables."
        ]
      },
      {
        "week": 2,
        "title": "Offline-First Local Database & Conflict Resolution",
        "deliverable": "Implement bi-directional sync between IndexedDB and PostgreSQL using CRDTs.",
        "ideaIdRef": "a0000001-0000-4000-8000-000000000004",
        "prompts": [
          "IndexedDB transaction lifetimes and connection recovery strategies.",
          "Vector clock tracking on low-power mobile browser devices.",
          "Delta compression for sync payloads over intermittent 2G/3G connections."
        ]
      },
      {
        "week": 3,
        "title": "Zero Cumulative Layout Shift (CLS) Checkout Flow",
        "deliverable": "Ship an ultra-low latency checkout flow verified on 2G throttled connections.",
        "ideaIdRef": "a0000001-0000-4000-8000-000000000013",
        "prompts": [
          "Eliminating font layout shift with font-display: optional and size-adjust descriptors.",
          "Preventing layout thrashing during dynamic credit card brand detection.",
          "Benchmarking Interaction to Next Paint (INP) under high CPU load on low-end Android."
        ]
      }
    ]
  },
  {
    "id": "ai-systems-engineering",
    "title": "AI Systems: Deterministic Constraints, Agent Memory & Production RAG",
    "subtitle": "Engineer production LLM systems with structured schema validation, vector grounding, and low-latency streaming.",
    "targetRole": "AI Systems & Inference Engineer",
    "durationWeeks": 3,
    "milestones": [
      {
        "week": 1,
        "title": "Semantic Caching for LLM Invocations",
        "deliverable": "Build an embedding-based similarity cache reducing redundant LLM API spend by 40%.",
        "ideaIdRef": "a0000001-0000-4000-8000-000000000014",
        "prompts": [
          "Cosine similarity vs Euclidean distance for dense embedding semantic matching.",
          "Structuring semantic eviction policies when cluster centroids shift over time.",
          "Handling streaming token playback from cached vector completions."
        ]
      },
      {
        "week": 2,
        "title": "Hybrid Vector & Keyword RAG Engine",
        "deliverable": "Implement Reciprocal Rank Fusion (RRF) combining BM25 lexical search with vector embeddings.",
        "ideaIdRef": "a0000001-0000-4000-8000-000000000015",
        "prompts": [
          "Why dense vector search alone misses specific error codes, SKU numbers, and UUIDs.",
          "Tuning Reciprocal Rank Fusion (RRF) constant k across disparate score distributions.",
          "Cross-encoder re-ranking vs bi-encoder retrieval latency trade-offs."
        ]
      },
      {
        "week": 3,
        "title": "Deterministic Hallucination Guardrail Gateway",
        "deliverable": "Build an AST-guided constraint validator verifying JSON output schema conformance.",
        "ideaIdRef": "a0000001-0000-4000-8000-000000000016",
        "prompts": [
          "Grammar-guided decoding using Context-Free Grammars (CFGs) at the token sampling level.",
          "High-throughput streaming PII redaction without breaking JSON token streams.",
          "Designing circuit-breaker fallbacks when LLM reasoning confidence drops below safety margins."
        ]
      }
    ]
  }
];

export const DEFAULT_USER: UserProfile = {
  username: '',
  name: '',
  avatarUrl: '',
  // No invented content. This is spread as the base of a signed-in profile in
  // several places, so a headline here would be inherited by anything that did
  // not set its own and could be saved to the backend as if the dev wrote it.
  // Pages that want a placeholder render it with `user.headline || '...'`, which
  // stays on screen without ever becoming stored data.
  headline: '',
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
