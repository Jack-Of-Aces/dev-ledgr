/**
 * @file coaching-content.ts
 * @description Educational concept briefings, visual architecture diagrams (SVG),
 * production failure modes, and reference blueprints for each coaching milestone.
 */

export interface MilestoneConcept {
  itineraryId: string;
  week: number;
  conceptTitle: string;
  executiveSummary: string;
  diagramTitle: string;
  diagramSvg: string;
  coreConcepts: {
    title: string;
    description: string;
    invariants: string[];
  }[];
  failureModes: {
    trap: string;
    impact: string;
    remediation: string;
  }[];
  codeSnippet: {
    language: string;
    filename: string;
    code: string;
    explanation: string;
  };
}

export const MILESTONE_CONCEPTS: Record<string, MilestoneConcept> = {
  // =========================================================================
  // TRACK 1: BACKEND PLATFORM ENGINEERING
  // =========================================================================
  'backend-fundamentals-1': {
    itineraryId: 'backend-fundamentals',
    week: 1,
    conceptTitle: 'Network Partitions, Webhook Ingestion & Idempotency Key Semantics',
    executiveSummary:
      'In distributed payment architectures, network timeouts are never proof of failure: a dropped TCP socket often occurs after the remote server has already debited the customer. Without strict idempotency keys and timing-safe signature checks, gateway retries trigger double credits and silent financial leakage.',
    diagramTitle: 'Idempotent Ingestion Buffer & Sliding Deduplication Pipeline',
    diagramSvg: `<svg viewBox="0 0 820 260" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto text-text-0 font-mono">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" opacity="0.6"/>
    </marker>
    <marker id="arrow-emerald" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981"/>
    </marker>
  </defs>
  <!-- Background Grid -->
  <rect x="0" y="0" width="820" height="260" rx="10" fill="currentColor" fill-opacity="0.02" stroke="currentColor" stroke-opacity="0.1"/>
  
  <!-- Step 1: External Gateway -->
  <rect x="25" y="40" width="130" height="70" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.3"/>
  <text x="90" y="68" font-size="11" font-weight="700" text-anchor="middle" fill="currentColor">Payment Gateway</text>
  <text x="90" y="85" font-size="10" text-anchor="middle" fill="currentColor" opacity="0.6">Retry Storm (504)</text>

  <!-- Arrow 1 to 2 -->
  <path d="M 155 75 L 195 75" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="175" y="68" font-size="9" text-anchor="middle" fill="#10b981">HTTP POST</text>

  <!-- Step 2: Ingestion & HMAC Verify -->
  <rect x="200" y="40" width="150" height="70" rx="6" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="1.5"/>
  <text x="275" y="66" font-size="11" font-weight="700" text-anchor="middle" fill="#10b981">HMAC Authenticator</text>
  <text x="275" y="84" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.8">crypto.timingSafeEqual</text>
  <text x="275" y="97" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.6">Prevents Timing Attacks</text>

  <!-- Arrow 2 to 3 -->
  <path d="M 350 75 L 390 75" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="370" y="68" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.7">Signed</text>

  <!-- Step 3: Redis Sliding Dedup -->
  <rect x="395" y="40" width="160" height="70" rx="6" fill="#38bdf8" fill-opacity="0.1" stroke="#38bdf8" stroke-width="1.5"/>
  <text x="475" y="66" font-size="11" font-weight="700" text-anchor="middle" fill="#38bdf8">Sliding Bloom / TTL</text>
  <text x="475" y="84" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.8">Atomic SETNX key</text>
  <text x="475" y="97" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.6">TTL: 86400s Window</text>

  <!-- Branch: Duplicate Detected -->
  <path d="M 475 110 L 475 160" stroke="#f59e0b" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="400" y="165" width="150" height="55" rx="6" fill="#f59e0b" fill-opacity="0.1" stroke="#f59e0b" stroke-dasharray="3 3"/>
  <text x="475" y="188" font-size="10" font-weight="700" text-anchor="middle" fill="#f59e0b">Duplicate Event</text>
  <text x="475" y="204" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.7">Fast HTTP 200 (Cached Ack)</text>

  <!-- Arrow 3 to 4 -->
  <path d="M 555 75 L 600 75" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow-emerald)"/>
  <text x="578" y="68" font-size="9" text-anchor="middle" fill="#10b981">New</text>

  <!-- Step 4: Ledger Execution -->
  <rect x="605" y="40" width="180" height="70" rx="6" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="1.5"/>
  <text x="695" y="66" font-size="11" font-weight="700" text-anchor="middle" fill="#10b981">Double-Entry Ledger</text>
  <text x="695" y="84" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.8">BEGIN ... FOR UPDATE</text>
  <text x="695" y="97" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.6">Atomic Settlement</text>

  <!-- DLQ Branch -->
  <path d="M 695 110 L 695 165" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4 2" marker-end="url(#arrow)"/>
  <rect x="625" y="170" width="140" height="50" rx="6" fill="#ef4444" fill-opacity="0.1" stroke="#ef4444"/>
  <text x="695" y="191" font-size="10" font-weight="700" text-anchor="middle" fill="#ef4444">Dead Letter Queue</text>
  <text x="695" y="206" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.6">Backoff with Jitter</text>
</svg>`,
    coreConcepts: [
      {
        title: 'Timing-Safe Cryptographic Signature Verification',
        description:
          'Standard string equality operators (==) short-circuit on the first mismatched byte, creating microsecond-level timing leaks that allow attackers to forge valid signatures by measuring response latencies.',
        invariants: [
          'Always use constant-time equality check (crypto.timingSafeEqual in Node.js or subtle.ConstantTimeCompare in Go).',
          'Enforce strict expiration timestamps inside HMAC payloads (prevent replay of valid historical webhooks).',
        ],
      },
      {
        title: 'Two-Phase Idempotency Keys (Reserve → Execute → Finalize)',
        description:
          'An idempotency key must not be marked "completed" until the underlying transaction commits. If the worker crashes mid-mutation, the key must transition into a recovery state rather than blocking forever.',
        invariants: [
          'Redis atomic SETNX with a lease duration (e.g. 60 seconds).',
          'Upon database transaction commit, update key state to COMPLETED with cached response payload.',
        ],
      },
    ],
    failureModes: [
      {
        trap: 'Acknowledging webhooks before persisting idempotency record',
        impact: 'If the service crashes during the processing loop, the gateway never retries and transactions are permanently lost.',
        remediation: 'Persist the idempotency intent in Redis or PostgreSQL WAL before emitting HTTP 200/202 status codes.',
      },
    ],
    codeSnippet: {
      language: 'go',
      filename: 'idempotency_guard.go',
      code: `func ProcessWebhook(ctx context.Context, rdb *redis.Client, key string, payload []byte) (bool, error) {
    // 1. Acquire atomic lease (10s lease prevents deadlocks on crash)
    ok, err := rdb.SetNX(ctx, "idemp:lease:"+key, "LOCKED", 10*time.Second).Result()
    if err != nil || !ok {
        return false, ErrDuplicateOrInFlight
    }
    // 2. Check if already permanently processed
    if rdb.Exists(ctx, "idemp:done:"+key).Val() > 0 {
        return false, ErrAlreadyProcessed
    }
    return true, nil
}`,
      explanation: 'Uses atomic Redis SETNX with a short expiry to handle concurrent burst webhooks without split-brain double crediting.',
    },
  },

  'backend-fundamentals-2': {
    itineraryId: 'backend-fundamentals',
    week: 2,
    conceptTitle: 'Spatial Indexing, Capacity-Constrained VRP & Road Network Penalties',
    executiveSummary:
      'Calculating distance using raw Euclidean geometry fails in emerging markets where unpaved terrain, canal barriers, and one-way bottlenecks distort travel time by 300%. A production dispatch engine combines Haversine matrices with road network penalty coefficients and vehicle load constraints.',
    diagramTitle: 'Spatial Geohash Clustering & Vehicle Capacity Dispatch Architecture',
    diagramSvg: `<svg viewBox="0 0 820 260" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto text-text-0 font-mono">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" opacity="0.6"/>
    </marker>
  </defs>
  <rect x="0" y="0" width="820" height="260" rx="10" fill="currentColor" fill-opacity="0.02" stroke="currentColor" stroke-opacity="0.1"/>

  <!-- Left: Raw Coordinates -->
  <rect x="25" y="40" width="150" height="70" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.3"/>
  <text x="100" y="65" font-size="11" font-weight="700" text-anchor="middle" fill="currentColor">Stream Orders</text>
  <text x="100" y="82" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.7">Lat/Lng + Weights</text>
  <text x="100" y="96" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.5">WhatsApp / USSD</text>

  <!-- Arrow -->
  <path d="M 175 75 L 215 75" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>

  <!-- Center-Left: Geohash Grid -->
  <rect x="220" y="40" width="160" height="70" rx="6" fill="#38bdf8" fill-opacity="0.1" stroke="#38bdf8" stroke-width="1.5"/>
  <text x="300" y="65" font-size="11" font-weight="700" text-anchor="middle" fill="#38bdf8">Geohash Clustering</text>
  <text x="300" y="82" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.8">Precision 6 (1.2km)</text>
  <text x="300" y="96" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.6">Spatial Inverted Index</text>

  <!-- Arrow -->
  <path d="M 380 75 L 420 75" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>

  <!-- Center-Right: Penalty Matrix -->
  <rect x="425" y="40" width="170" height="70" rx="6" fill="#f59e0b" fill-opacity="0.1" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="510" y="65" font-size="11" font-weight="700" text-anchor="middle" fill="#f59e0b">Distance Matrix</text>
  <text x="510" y="82" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.8">Haversine * RoadFactor</text>
  <text x="510" y="96" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.6">Unpaved Road Penalty (x2.4)</text>

  <!-- Arrow -->
  <path d="M 595 75 L 635 75" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>

  <!-- Right: Knapsack Vehicle Sieve -->
  <rect x="640" y="40" width="155" height="70" rx="6" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="1.5"/>
  <text x="717" y="65" font-size="11" font-weight="700" text-anchor="middle" fill="#10b981">Capacity Sieve</text>
  <text x="717" y="82" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.8">Max 120kg / Motorcycle</text>
  <text x="717" y="96" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.6">30-min SLA Optimizer</text>

  <!-- Output Box -->
  <rect x="220" y="150" width="380" height="65" rx="6" fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-opacity="0.2"/>
  <text x="410" y="176" font-size="11" font-weight="700" text-anchor="middle" fill="currentColor">GeoJSON MultiLineString Dispatch Manifest</text>
  <text x="410" y="196" font-size="10" text-anchor="middle" fill="#10b981">Idempotent Driver Dispatch Webhook (p95 &lt; 80ms)</text>
</svg>`,
    coreConcepts: [
      {
        title: 'Spatial Indexing with Geohash Hierarchies',
        description:
          'Geohashing encodes 2D latitude and longitude into an alphanumeric string where shared prefixes indicate spatial proximity. This turns expensive $O(N^2)$ distance scans into sub-millisecond B-Tree range queries.',
        invariants: [
          'Geohash length 6 isolates deliveries to ~1.2km x 0.6km neighborhood bounding boxes.',
          'PostGIS ST_DWithin uses spatial R-Tree indexing to eliminate full-table sequential scans.',
        ],
      },
    ],
    failureModes: [
      {
        trap: 'Assuming Haversine distance matches real-world driving distance',
        impact: 'Drivers miss 30-minute delivery SLAs by 45 minutes because expressways lack crossings.',
        remediation: 'Apply topology road-network penalty multipliers (e.g. 1.8x for unpaved roads, 2.5x during rush-hour windows).',
      },
    ],
    codeSnippet: {
      language: 'go',
      filename: 'haversine_matrix.go',
      code: `func HaversineWithPenalty(lat1, lon1, lat2, lon2 float64, isUnpaved bool) float64 {
    const R = 6371.0 // Earth radius in km
    dLat := (lat2 - lat1) * (math.Pi / 180.0)
    dLon := (lon2 - lon1) * (math.Pi / 180.0)
    a := math.Sin(dLat/2)*math.Sin(dLat/2) +
         math.Cos(lat1*(math.Pi/180.0))*math.Cos(lat2*(math.Pi/180.0))*
         math.Sin(dLon/2)*math.Sin(dLon/2)
    distKm := R * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
    if isUnpaved { return distKm * 2.4 }
    return distKm * 1.3
}`,
      explanation: 'Calculates geodesic distance scaled by road surface penalty factors.',
    },
  },

  'backend-fundamentals-3': {
    itineraryId: 'backend-fundamentals',
    week: 3,
    conceptTitle: 'High-Density Time-Series Compression: Gorilla XOR Delta Encoding',
    executiveSummary:
      'Streaming raw JSON telemetry from thousands of IoT solar inverters over metered 2G cellular connections drains bandwidth and costs thousands in telecom charges. Gorilla-style floating-point XOR compaction achieves 12:1 lossless compression by encoding bitwise differences against preceding timestamps.',
    diagramTitle: 'Gorilla XOR Floating-Point Bit-Packing Architecture',
    diagramSvg: `<svg viewBox="0 0 820 260" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto text-text-0 font-mono">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" opacity="0.6"/>
    </marker>
  </defs>
  <rect x="0" y="0" width="820" height="260" rx="10" fill="currentColor" fill-opacity="0.02" stroke="currentColor" stroke-opacity="0.1"/>

  <rect x="30" y="45" width="160" height="65" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.3"/>
  <text x="110" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="currentColor">Raw Float64 Ticks</text>
  <text x="110" y="88" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.6">Voltage: 230.45, 230.48...</text>

  <path d="M 190 77 L 230 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>

  <rect x="235" y="45" width="160" height="65" rx="6" fill="#38bdf8" fill-opacity="0.1" stroke="#38bdf8" stroke-width="1.5"/>
  <text x="315" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#38bdf8">XOR Difference</text>
  <text x="315" y="88" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.8">val[t] XOR val[t-1]</text>

  <path d="M 395 77 L 435 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>

  <rect x="440" y="45" width="165" height="65" rx="6" fill="#f59e0b" fill-opacity="0.1" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="522" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#f59e0b">Variable Elias Bits</text>
  <text x="522" y="88" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.8">Trim Leading/Trailing 0s</text>

  <path d="M 605 77 L 645 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>

  <rect x="650" y="45" width="140" height="65" rx="6" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="1.5"/>
  <text x="720" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#10b981">12:1 Binary Chunk</text>
  <text x="720" y="88" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.8">&lt; 8MB RAM Footprint</text>

  <rect x="180" y="150" width="460" height="60" rx="6" fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-opacity="0.2"/>
  <text x="410" y="174" font-size="11" font-weight="700" text-anchor="middle" fill="currentColor">Circular Flash Memory Buffer (48h Blackout Endurance)</text>
  <text x="410" y="192" font-size="10" text-anchor="middle" fill="#10b981">Lossless Reconstitution at Cloud Ingest Collector</text>
</svg>`,
    coreConcepts: [
      {
        title: 'Gorilla Compression Mechanics',
        description:
          'Adjacent sensor readings in physical systems (temperature, voltage) share the vast majority of their IEEE 754 floating-point exponent bits. XORing consecutive values yields extensive sequences of leading and trailing zeroes.',
        invariants: [
          'If XOR is zero, output a single 0 bit (value is unchanged).',
          'If XOR is non-zero, output a 1 bit followed by the length and variable bits of significant changes.',
        ],
      },
    ],
    failureModes: [
      {
        trap: 'Buffering unbounded telemetry in RAM during cellular network blackouts',
        impact: 'Out-of-memory kernel panic (OOM) on edge embedded controllers, wiping uncommitted historical data.',
        remediation: 'Implement circular ring buffers committed to non-volatile flash storage with FIFO overwrite bounds.',
      },
    ],
    codeSnippet: {
      language: 'go',
      filename: 'gorilla_xor.go',
      code: `func CompressFloat(prev, curr uint64) []byte {
    xor := prev ^ curr
    if xor == 0 {
        return []byte{0x00} // single zero bit
    }
    // variable-length encoding of significant bits
    return encodeSignificantBits(xor)
}`,
      explanation: 'Bit-level compaction leveraging temporal locality in continuous sensor feeds.',
    },
  },

  'backend-fundamentals-4': {
    itineraryId: 'backend-fundamentals',
    week: 4,
    conceptTitle: 'Offline-First Synchronization, CRDTs & Vector Clock Reconciliation',
    executiveSummary:
      'In disconnected health clinics and remote depots, waiting for synchronous cloud responses guarantees broken workflows. Conflict-free Replicated Data Types (CRDTs) allow concurrent local mutations on edge tablets that merge deterministically into central databases without data loss.',
    diagramTitle: 'Bi-Directional CRDT State-Based Synchronization Protocol',
    diagramSvg: `<svg viewBox="0 0 820 260" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto text-text-0 font-mono">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" opacity="0.6"/>
    </marker>
  </defs>
  <rect x="0" y="0" width="820" height="260" rx="10" fill="currentColor" fill-opacity="0.02" stroke="currentColor" stroke-opacity="0.1"/>

  <rect x="30" y="40" width="180" height="80" rx="6" fill="#38bdf8" fill-opacity="0.1" stroke="#38bdf8" stroke-width="1.5"/>
  <text x="120" y="65" font-size="11" font-weight="700" text-anchor="middle" fill="#38bdf8">Clinic Tablet A</text>
  <text x="120" y="82" font-size="9" text-anchor="middle" fill="currentColor">Local SQLite / IndexedDB</text>
  <text x="120" y="98" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.6">Clock: [A:3, B:0]</text>

  <rect x="610" y="40" width="180" height="80" rx="6" fill="#f59e0b" fill-opacity="0.1" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="700" y="65" font-size="11" font-weight="700" text-anchor="middle" fill="#f59e0b">Clinic Tablet B</text>
  <text x="700" y="82" font-size="9" text-anchor="middle" fill="currentColor">Local SQLite / IndexedDB</text>
  <text x="700" y="98" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.6">Clock: [A:0, B:2]</text>

  <rect x="310" y="130" width="200" height="90" rx="6" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="1.5"/>
  <text x="410" y="155" font-size="11" font-weight="700" text-anchor="middle" fill="#10b981">Central Provincial DB</text>
  <text x="410" y="172" font-size="9" text-anchor="middle" fill="currentColor">Deterministic CRDT Merge</text>
  <text x="410" y="188" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.8">Max Clock: [A:3, B:2]</text>
  <text x="410" y="202" font-size="9" text-anchor="middle" fill="#10b981">Zero Lost Patient Notes</text>

  <path d="M 120 120 L 310 160" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <path d="M 700 120 L 510 160" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
</svg>`,
    coreConcepts: [
      {
        title: 'State-based vs Delta-based CRDTs',
        description:
          'State-based replication sends the full state vector over the wire, which is resilient to packet loss but bandwidth-heavy. Delta CRDTs only ship mutation diffs, minimizing payload size on 2G connections.',
        invariants: [
          'Join-semilattice properties: associative, commutative, and idempotent merges.',
          'Vector clocks track causal history to distinguish concurrent edits from sequential overwrites.',
        ],
      },
    ],
    failureModes: [
      {
        trap: 'Using wall-clock timestamps for conflict resolution',
        impact: 'Client clock skew causes historical records to overwrite newer edits silently.',
        remediation: 'Use logical vector clocks or Hybrid Logical Clocks (HLC) with immutable change vectors.',
      },
    ],
    codeSnippet: {
      language: 'typescript',
      filename: 'crdt_merge.ts',
      code: `interface Delta<T> {
  entityId: string;
  vectorClock: Record<string, number>;
  value: T;
}
function mergeLWW<T>(local: Delta<T>, incoming: Delta<T>): Delta<T> {
  // Compare vector dominance
  const incomingDominates = Object.keys(incoming.vectorClock).every(
    k => (incoming.vectorClock[k] || 0) >= (local.vectorClock[k] || 0)
  );
  return incomingDominates ? incoming : local;
}`,
      explanation: 'Mathematically deterministic conflict resolution ensuring identical state across replicas.',
    },
  },

  // =========================================================================
  // TRACK 2: FINTECH RELIABILITY & AUDITING
  // =========================================================================
  'fintech-reliability-1': {
    itineraryId: 'fintech-reliability',
    week: 1,
    conceptTitle: 'Zero-Loss Ingestion Buffers, Sliding Bloom Filters & Timing Protection',
    executiveSummary:
      'Payment webhooks arrive out-of-order and duplicated during upstream gateway outages. A resilient switch decouples authentication, deduplication, and ledger commitment using sliding Bloom filters and timing-safe crypto comparison.',
    diagramTitle: 'Fintech Webhook Ingestion & Dead-Letter Isolation Architecture',
    diagramSvg: `<svg viewBox="0 0 820 260" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto text-text-0 font-mono">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" opacity="0.6"/>
    </marker>
  </defs>
  <rect x="0" y="0" width="820" height="260" rx="10" fill="currentColor" fill-opacity="0.02" stroke="currentColor" stroke-opacity="0.1"/>

  <rect x="25" y="40" width="130" height="70" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.3"/>
  <text x="90" y="68" font-size="11" font-weight="700" text-anchor="middle" fill="currentColor">Bank Switch</text>
  <text x="90" y="85" font-size="10" text-anchor="middle" fill="currentColor" opacity="0.6">10,000 req/s</text>

  <path d="M 155 75 L 195 75" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>

  <rect x="200" y="40" width="150" height="70" rx="6" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="1.5"/>
  <text x="275" y="66" font-size="11" font-weight="700" text-anchor="middle" fill="#10b981">HMAC Ingest</text>
  <text x="275" y="84" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.8">Timing-Safe Eq</text>

  <path d="M 350 75 L 390 75" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>

  <rect x="395" y="40" width="160" height="70" rx="6" fill="#38bdf8" fill-opacity="0.1" stroke="#38bdf8" stroke-width="1.5"/>
  <text x="475" y="66" font-size="11" font-weight="700" text-anchor="middle" fill="#38bdf8">Bloom Dedup</text>
  <text x="475" y="84" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.8">0.00% False Neg</text>

  <path d="M 555 75 L 600 75" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>

  <rect x="605" y="40" width="180" height="70" rx="6" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="1.5"/>
  <text x="695" y="66" font-size="11" font-weight="700" text-anchor="middle" fill="#10b981">Replay Buffer</text>
  <text x="695" y="84" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.8">Kafka / Redis Shards</text>
</svg>`,
    coreConcepts: [
      {
        title: 'Bloom Filter Sliding Windows',
        description:
          'Standard set lookups consume gigabytes of RAM during 10,000 req/s retry storms. Rotating Bloom filter buffers reduce memory consumption by 90% while guaranteeing zero false negatives on identical keys.',
        invariants: ['Zero false negatives on identical keys.', 'Memory consumption capped under 16MB.'],
      },
    ],
    failureModes: [
      {
        trap: 'Allowing unauthenticated requests to reach deduplication storage',
        impact: 'Denial-of-service attack filling cache keys with forged identifiers.',
        remediation: 'Verify cryptographic signatures in memory before running database lookups.',
      },
    ],
    codeSnippet: {
      language: 'go',
      filename: 'hmac_verify.go',
      code: `func VerifySignature(secret, payload, signature []byte) bool {
    mac := hmac.New(sha256.New, secret)
    mac.Write(payload)
    expected := mac.Sum(nil)
    return hmac.Equal(signature, expected)
}`,
      explanation: 'Uses subtle constant-time comparison to prevent byte-by-byte timing attacks.',
    },
  },

  'fintech-reliability-2': {
    itineraryId: 'fintech-reliability',
    week: 2,
    conceptTitle: 'High-Volume USSD Session FSMs & Two-Phase Settlement Rollback',
    executiveSummary:
      'Feature phone banking relies on ephemeral USSD radio sessions that hard-terminate after 180 seconds. A reliable state machine manages asynchronous bank debits, atomic hold reservations, and automated rollbacks on dropped carrier links.',
    diagramTitle: '180-Second Ephemeral USSD State Machine & Rollback FSM',
    diagramSvg: `<svg viewBox="0 0 820 260" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto text-text-0 font-mono">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" opacity="0.6"/>
    </marker>
  </defs>
  <rect x="0" y="0" width="820" height="260" rx="10" fill="currentColor" fill-opacity="0.02" stroke="currentColor" stroke-opacity="0.1"/>

  <circle cx="90" cy="75" r="45" fill="#38bdf8" fill-opacity="0.1" stroke="#38bdf8" stroke-width="1.5"/>
  <text x="90" y="73" font-size="10" font-weight="700" text-anchor="middle" fill="#38bdf8">INIT_SESSION</text>
  <text x="90" y="87" font-size="8" text-anchor="middle" fill="currentColor" opacity="0.6">180s Timer</text>

  <path d="M 135 75 L 210 75" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="172" y="67" font-size="9" text-anchor="middle" fill="currentColor">*389#</text>

  <circle cx="255" cy="75" r="45" fill="#f59e0b" fill-opacity="0.1" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="255" y="73" font-size="10" font-weight="700" text-anchor="middle" fill="#f59e0b">AWAIT_PIN</text>
  <text x="255" y="87" font-size="8" text-anchor="middle" fill="currentColor" opacity="0.6">Fast Lookup</text>

  <path d="M 300 75 L 375 75" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="337" y="67" font-size="9" text-anchor="middle" fill="currentColor">PIN Ok</text>

  <circle cx="420" cy="75" r="45" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="1.5"/>
  <text x="420" y="73" font-size="10" font-weight="700" text-anchor="middle" fill="#10b981">HOLD_RESERVED</text>
  <text x="420" y="87" font-size="8" text-anchor="middle" fill="currentColor" opacity="0.6">2-Phase Lock</text>

  <path d="M 465 75 L 540 75" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>

  <circle cx="585" cy="75" r="45" fill="#10b981" fill-opacity="0.2" stroke="#10b981" stroke-width="2"/>
  <text x="585" y="73" font-size="10" font-weight="700" text-anchor="middle" fill="#10b981">SETTLED</text>
  <text x="585" y="87" font-size="8" text-anchor="middle" fill="currentColor" opacity="0.6">SMS Sent</text>

  <!-- Rollback Path on Drop -->
  <path d="M 420 120 L 420 180 L 680 180" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="3 3" marker-end="url(#arrow)"/>
  <text x="490" y="172" font-size="9" fill="#ef4444">Radio Drop (&gt; 180s)</text>

  <rect x="685" y="155" width="115" height="50" rx="6" fill="#ef4444" fill-opacity="0.1" stroke="#ef4444"/>
  <text x="742" y="177" font-size="9" font-weight="700" text-anchor="middle" fill="#ef4444">ROLLBACK HOLD</text>
  <text x="742" y="192" font-size="8" text-anchor="middle" fill="currentColor" opacity="0.6">Zero Lost Funds</text>
</svg>`,
    coreConcepts: [
      {
        title: 'Two-Phase Session Holds',
        description:
          'Funds must never be debited on step inputs. Instead, place an atomic ledger hold with a 180-second TTL. If the session expires without client confirmation, the hold expires without manual reconciliation.',
        invariants: ['Atomic settlement execution.', 'Immediate release of held funds upon session drop.'],
      },
    ],
    failureModes: [
      {
        trap: 'Committing debits immediately when users submit transfers',
        impact: 'Telco timeout terminates connection before credit response arrives, causing user panic and fund loss.',
        remediation: 'Use two-phase hold reservations with asynchronous SMS reconciliation fallback.',
      },
    ],
    codeSnippet: {
      language: 'go',
      filename: 'ussd_fsm.go',
      code: `func HandleDrop(ctx context.Context, sessionID string) error {
    // Atomic rollback of unconfirmed reservations
    return db.Exec(ctx, \`
        UPDATE ledger_holds SET status = 'RELEASED', released_at = now()
        WHERE session_id = $1 AND status = 'PENDING'\`, sessionID)
}`,
      explanation: 'Guaranteed deadlock-free hold release when carrier signals session termination.',
    },
  },

  'fintech-reliability-3': {
    itineraryId: 'fintech-reliability',
    week: 3,
    conceptTitle: 'Cross-Border FX Rate Locks, EWMA Volatility Bands & Arbitrage Defense',
    executiveSummary:
      'Volatile currency markets can wipe out platform margins during intra-day flash devaluations. A resilient FX engine computes Exponentially Weighted Moving Average (EWMA) volatility bands and issues cryptographic rate-lock tokens.',
    diagramTitle: 'EWMA Volatility Band & Rate Lock Protection Pipeline',
    diagramSvg: `<svg viewBox="0 0 820 260" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto text-text-0 font-mono">
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" opacity="0.6"/></marker></defs>
  <rect x="0" y="0" width="820" height="260" rx="10" fill="currentColor" fill-opacity="0.02" stroke="currentColor" stroke-opacity="0.1"/>
  <rect x="30" y="45" width="160" height="65" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.3"/>
  <text x="110" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="currentColor">Parallel FX Feeds</text>
  <text x="110" y="88" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.6">P2P Orderbook Ticks</text>
  <path d="M 190 77 L 230 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="235" y="45" width="165" height="65" rx="6" fill="#38bdf8" fill-opacity="0.1" stroke="#38bdf8" stroke-width="1.5"/>
  <text x="317" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#38bdf8">EWMA Volatility</text>
  <text x="317" y="88" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.8">Sliding Variance Bands</text>
  <path d="M 400 77 L 440 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="445" y="45" width="170" height="65" rx="6" fill="#f59e0b" fill-opacity="0.1" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="530" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#f59e0b">Dynamic Spread</text>
  <text x="530" y="88" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.8">Liquidity Risk Weighting</text>
  <path d="M 615 77 L 655 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="660" y="45" width="135" height="65" rx="6" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="1.5"/>
  <text x="727" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#10b981">10-Min Token</text>
  <text x="727" y="88" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.8">Crypto Expiration</text>
</svg>`,
    coreConcepts: [
      {
        title: 'EWMA Volatility Estimation',
        description:
          'Exponentially Weighted Moving Average assigns exponentially decreasing weights to older price ticks, reacting rapidly to sudden liquidity evaporations while damping high-frequency noise.',
        invariants: ['Quote latency < 25ms under 1,000 concurrent queries.', 'Zero contracts executed below cost.'],
      },
    ],
    failureModes: [
      {
        trap: 'Offering fixed static exchange rates without volatility guards',
        impact: 'Arbitrage traders drain liquidity pool within minutes during currency devaluation.',
        remediation: 'Automatically widen spreads or suspend forward contract issuance when volatility exceeds variance threshold.',
      },
    ],
    codeSnippet: {
      language: 'go',
      filename: 'fx_ewma.go',
      code: `func UpdateEWMA(prevEWMA, currentPrice, alpha float64) float64 {
    return (alpha * currentPrice) + ((1.0 - alpha) * prevEWMA)
}`,
      explanation: 'Calculates dynamic exchange rate baseline with rapid market shock detection.',
    },
  },

  // =========================================================================
  // TRACK 3: DEVTOOLS & INFRASTRUCTURE
  // =========================================================================
  'devtools-infrastructure-1': {
    itineraryId: 'devtools-infrastructure',
    week: 1,
    conceptTitle: 'PostgreSQL AST Static Analysis & Lock Escalation Trap Detection',
    executiveSummary:
      'A single ALTER TABLE ... ADD COLUMN ... DEFAULT ... on a multi-million row table acquires an AccessExclusiveLock, blocking all concurrent reads and writes and taking down customer services. Static AST analysis catches table-rewrite migrations before deployment.',
    diagramTitle: 'PostgreSQL DDL AST Analyzer & Lock Escalation Detection',
    diagramSvg: `<svg viewBox="0 0 820 260" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto text-text-0 font-mono">
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" opacity="0.6"/></marker></defs>
  <rect x="0" y="0" width="820" height="260" rx="10" fill="currentColor" fill-opacity="0.02" stroke="currentColor" stroke-opacity="0.1"/>
  <rect x="25" y="45" width="140" height="65" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.3"/>
  <text x="95" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="currentColor">SQL Migration</text>
  <text x="95" y="88" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.6">Pull Request DDL</text>
  <path d="M 165 77 L 205 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="210" y="45" width="150" height="65" rx="6" fill="#38bdf8" fill-opacity="0.1" stroke="#38bdf8" stroke-width="1.5"/>
  <text x="285" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#38bdf8">pg_query AST</text>
  <text x="285" y="88" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.8">Lock Level Classifier</text>
  <path d="M 360 77 L 400 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="405" y="45" width="170" height="65" rx="6" fill="#f59e0b" fill-opacity="0.1" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="490" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#f59e0b">Docker Shadow Run</text>
  <text x="490" y="88" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.8">pg_locks Monitoring</text>
  <path d="M 575 77 L 615 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="620" y="45" width="170" height="65" rx="6" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="1.5"/>
  <text x="705" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#10b981">CI Annotations</text>
  <text x="705" y="88" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.8">Safe Migration Advice</text>
</svg>`,
    coreConcepts: [
      {
        title: 'PostgreSQL Lock Modes',
        description:
          'AccessExclusiveLock blocks even SELECT statements. Safe zero-downtime migrations require CONCURRENTLY modifiers on indices and separate column creation from backfilling.',
        invariants: ['Never run CREATE INDEX without CONCURRENTLY.', 'Add nullable column first, backfill in chunks.'],
      },
    ],
    failureModes: [
      {
        trap: 'Adding NOT NULL column with non-constant default on older Postgres versions',
        impact: 'Rewrites millions of table heap rows holding exclusive table lock, causing cascading timeouts.',
        remediation: 'Use NULL column first, backfill asynchronously in batches, then add NOT NULL constraint with VALIDATE.',
      },
    ],
    codeSnippet: {
      language: 'sql',
      filename: 'safe_migration.sql',
      code: `-- Dangerous: ALTER TABLE orders ADD COLUMN status VARCHAR NOT NULL DEFAULT 'open';
-- Safe Pattern:
ALTER TABLE orders ADD COLUMN status VARCHAR;
ALTER TABLE orders ADD CONSTRAINT check_status_valid CHECK (status IS NOT NULL) NOT VALID;
-- Backfill in batches then:
ALTER TABLE orders VALIDATE CONSTRAINT check_status_valid;`,
      explanation: 'Zero-lock table expansion preserving live read/write traffic during schema evolution.',
    },
  },

  'devtools-infrastructure-2': {
    itineraryId: 'devtools-infrastructure',
    week: 2,
    conceptTitle: 'Kubernetes Canary Controllers, Informers & Sub-Second Rollback',
    executiveSummary:
      'Rolling updates expose 100% of users to undetected regression bugs. A custom Kubernetes Canary Controller watches Custom Resource Definitions, dynamically shifts ingress traffic weights, and triggers immediate automated rollbacks on telemetry threshold breaches.',
    diagramTitle: 'Kubernetes Canary Controller & Telemetry Feedback Loop',
    diagramSvg: `<svg viewBox="0 0 820 260" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto text-text-0 font-mono">
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" opacity="0.6"/></marker></defs>
  <rect x="0" y="0" width="820" height="260" rx="10" fill="currentColor" fill-opacity="0.02" stroke="currentColor" stroke-opacity="0.1"/>
  <rect x="30" y="45" width="150" height="65" rx="6" fill="#38bdf8" fill-opacity="0.1" stroke="#38bdf8" stroke-width="1.5"/>
  <text x="105" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#38bdf8">Canary CRD (5%)</text>
  <text x="105" y="88" font-size="9" text-anchor="middle" fill="currentColor">Client-Go Informer</text>
  <path d="M 180 77 L 225 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="230" y="45" width="165" height="65" rx="6" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="1.5"/>
  <text x="312" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#10b981">Envoy/NGINX Ingress</text>
  <text x="312" y="88" font-size="9" text-anchor="middle" fill="currentColor">Dynamic Weight Split</text>
  <path d="M 395 77 L 440 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="445" y="45" width="160" height="65" rx="6" fill="#f59e0b" fill-opacity="0.1" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="525" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#f59e0b">Prometheus Prober</text>
  <text x="525" y="88" font-size="9" text-anchor="middle" fill="currentColor">5xx &gt; 1.5% Threshold</text>
  <path d="M 605 77 L 650 77" stroke="#ef4444" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="655" y="45" width="140" height="65" rx="6" fill="#ef4444" fill-opacity="0.1" stroke="#ef4444" stroke-width="1.5"/>
  <text x="725" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#ef4444">Auto-Rollback</text>
  <text x="725" y="88" font-size="9" text-anchor="middle" fill="currentColor">&lt; 400ms Actuation</text>
</svg>`,
    coreConcepts: [
      {
        title: 'Kubernetes Informer & Workqueue Pattern',
        description:
          'Controllers use Informers with SharedIndexInformer caches instead of polling the Kubernetes API server directly, reducing cluster control-plane load by 99%.',
        invariants: ['Zero dropped TLS connections during dynamic reload.', 'Rollback actuation under 500ms.'],
      },
    ],
    failureModes: [
      {
        trap: 'Immediate pod termination without graceful HTTP draining',
        impact: 'Users in active checkout sessions experience broken pipe network drops.',
        remediation: 'Configure preStop lifecycle hooks and terminationGracePeriodSeconds for connection draining.',
      },
    ],
    codeSnippet: {
      language: 'go',
      filename: 'controller.go',
      code: `func (c *Controller) checkHealthAndRollback(svc string, errRate float64) {
    if errRate > 0.015 { // > 1.5% errors
        c.setIngressWeight(svc, 0) // immediate zero-routing
        c.recordEvent("CANARY_ABORTED", "Threshold breached")
    }
}`,
      explanation: 'Automated progressive traffic shifting with telemetry-actuated emergency rollback.',
    },
  },

  'devtools-infrastructure-3': {
    itineraryId: 'devtools-infrastructure',
    week: 3,
    conceptTitle: 'Multi-Carrier Circuit Breakers & Sliding-Window Latency Telemetry',
    executiveSummary:
      'Carrier SMS and banking gateways regularly degrade without returning 500 errors—leaving HTTP requests hanging for 60 seconds. A finite-state circuit breaker tracks sliding-window latency and trips to backup providers before users experience timeouts.',
    diagramTitle: 'Three-State Circuit Breaker (Closed, Open, Half-Open) Router',
    diagramSvg: `<svg viewBox="0 0 820 260" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto text-text-0 font-mono">
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" opacity="0.6"/></marker></defs>
  <rect x="0" y="0" width="820" height="260" rx="10" fill="currentColor" fill-opacity="0.02" stroke="currentColor" stroke-opacity="0.1"/>
  <rect x="40" y="55" width="160" height="65" rx="6" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="1.5"/>
  <text x="120" y="80" font-size="11" font-weight="700" text-anchor="middle" fill="#10b981">CLOSED (Normal)</text>
  <text x="120" y="98" font-size="9" text-anchor="middle" fill="currentColor">All Traffic to Primary</text>
  <path d="M 200 87 L 300 87" stroke="#ef4444" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="250" y="78" font-size="9" text-anchor="middle" fill="#ef4444">&gt; 3 Failures</text>
  <rect x="305" y="55" width="180" height="65" rx="6" fill="#ef4444" fill-opacity="0.1" stroke="#ef4444" stroke-width="1.5"/>
  <text x="395" y="80" font-size="11" font-weight="700" text-anchor="middle" fill="#ef4444">OPEN (Failover)</text>
  <text x="395" y="98" font-size="9" text-anchor="middle" fill="currentColor">Routes via Secondary</text>
  <path d="M 485 87 L 585 87" stroke="#f59e0b" stroke-width="1.5" marker-end="url(#arrow)"/>
  <text x="535" y="78" font-size="9" text-anchor="middle" fill="#f59e0b">Backoff Expired</text>
  <rect x="590" y="55" width="190" height="65" rx="6" fill="#f59e0b" fill-opacity="0.1" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="685" y="80" font-size="11" font-weight="700" text-anchor="middle" fill="#f59e0b">HALF-OPEN (Canary)</text>
  <text x="685" y="98" font-size="9" text-anchor="middle" fill="currentColor">Synthetic Probe Traffic</text>
</svg>`,
    coreConcepts: [
      {
        title: 'Sliding-Window Failure Quantiles',
        description:
          'Static counters fail because older historical errors trigger false alarms. A sliding-window ring buffer tracks only requests within the last 60 seconds.',
        invariants: ['Trip within 500ms of carrier degradation.', 'Zero duplicate billing on failover.'],
      },
    ],
    failureModes: [
      {
        trap: 'Immediate thundering herd probe after circuit opening',
        impact: 'The degraded carrier gets hit with millions of requests simultaneously, re-crashing the gateway.',
        remediation: 'Implement jittered exponential backoff for canary health probes in Half-Open state.',
      },
    ],
    codeSnippet: {
      language: 'go',
      filename: 'circuit_breaker.go',
      code: `func (cb *CircuitBreaker) Execute(req Request) (Response, error) {
    if cb.state == StateOpen {
        if time.Since(cb.lastTripped) > cb.cooldown {
            cb.state = StateHalfOpen // test probe
        } else {
            return cb.fallbackProvider.Execute(req)
        }
    }
    return cb.primaryProvider.Execute(req)
}`,
      explanation: 'Three-state circuit breaker preventing timeout storms against degraded upstream providers.',
    },
  },

  // =========================================================================
  // TRACK 4: FRONTEND ARCHITECTURE
  // =========================================================================
  'frontend-architecture-1': {
    itineraryId: 'frontend-architecture',
    week: 1,
    conceptTitle: 'W3C Design Token Compilation, CSS Subgrid & Zero-CLS Financial Ledgers',
    executiveSummary:
      'High-density financial transaction dashboards require pixel-perfect tabular alignment, accessible keyboard navigation, and theme synchronization from Figma tokens without layout jank or contrast violations.',
    diagramTitle: 'Design Token Compilation & Accessible Canvas Architecture',
    diagramSvg: `<svg viewBox="0 0 820 260" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto text-text-0 font-mono">
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" opacity="0.6"/></marker></defs>
  <rect x="0" y="0" width="820" height="260" rx="10" fill="currentColor" fill-opacity="0.02" stroke="currentColor" stroke-opacity="0.1"/>
  <rect x="30" y="45" width="160" height="65" rx="6" fill="#38bdf8" fill-opacity="0.1" stroke="#38bdf8" stroke-width="1.5"/>
  <text x="110" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#38bdf8">Figma W3C Tokens</text>
  <text x="110" y="88" font-size="9" text-anchor="middle" fill="currentColor">JSON Token Hierarchy</text>
  <path d="M 190 77 L 235 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="240" y="45" width="165" height="65" rx="6" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="1.5"/>
  <text x="322" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#10b981">Token AST Compiler</text>
  <text x="322" y="88" font-size="9" text-anchor="middle" fill="currentColor">CSS Variables + Themes</text>
  <path d="M 405 77 L 450 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="455" y="45" width="160" height="65" rx="6" fill="#f59e0b" fill-opacity="0.1" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="535" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#f59e0b">Subgrid Matrix</text>
  <text x="535" y="88" font-size="9" text-anchor="middle" fill="currentColor">WCAG AAA Contrast</text>
  <path d="M 615 77 L 660 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="665" y="45" width="130" height="65" rx="6" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="1.5"/>
  <text x="730" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#10b981">Zero CLS Feed</text>
  <text x="730" y="88" font-size="9" text-anchor="middle" fill="currentColor">Live WebSockets</text>
</svg>`,
    coreConcepts: [
      {
        title: 'W3C Design Token Community Group Specification',
        description:
          'Tokens define semantic roles ($color.surface.primary) rather than literal values (#121215), allowing seamless dark mode transitions and automated accessibility contrast audits.',
        invariants: ['Text contrast > 7:1 for WCAG AAA.', 'Zero Cumulative Layout Shift (CLS = 0.000).'],
      },
    ],
    failureModes: [
      {
        trap: 'Using hardcoded hexadecimal color values in components',
        impact: 'Dark mode inversions fail contrast guidelines and break branded partner white-labeling.',
        remediation: 'Compile all design tokens into responsive CSS custom properties with fallback defaults.',
      },
    ],
    codeSnippet: {
      language: 'css',
      filename: 'subgrid_table.css',
      code: `.ledger-grid {
  display: grid;
  grid-template-columns: 80px 1fr 140px 100px;
}
.ledger-row {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  contain: layout style paint; /* Prevents CLS */
}`,
      explanation: 'CSS Subgrid preserves column alignment across rows with zero layout shifting.',
    },
  },

  'frontend-architecture-2': {
    itineraryId: 'frontend-architecture',
    week: 2,
    conceptTitle: 'Client-Side IndexedDB Stores & Service Worker Background Sync',
    executiveSummary:
      'Mobile web applications lose state when users enter basements or elevators. Architecting an offline-first client store with IndexedDB transactions and Service Worker sync guarantees uninterrupted user interactions.',
    diagramTitle: 'Client-Side IndexedDB & Service Worker Background Sync Pipeline',
    diagramSvg: `<svg viewBox="0 0 820 260" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto text-text-0 font-mono">
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" opacity="0.6"/></marker></defs>
  <rect x="0" y="0" width="820" height="260" rx="10" fill="currentColor" fill-opacity="0.02" stroke="currentColor" stroke-opacity="0.1"/>
  <rect x="30" y="45" width="160" height="65" rx="6" fill="#38bdf8" fill-opacity="0.1" stroke="#38bdf8" stroke-width="1.5"/>
  <text x="110" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#38bdf8">UI User Action</text>
  <text x="110" y="88" font-size="9" text-anchor="middle" fill="currentColor">Optimistic State</text>
  <path d="M 190 77 L 235 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="240" y="45" width="165" height="65" rx="6" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="1.5"/>
  <text x="322" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#10b981">IndexedDB Store</text>
  <text x="322" y="88" font-size="9" text-anchor="middle" fill="currentColor">Atomic Mutation WAL</text>
  <path d="M 405 77 L 450 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="455" y="45" width="165" height="65" rx="6" fill="#f59e0b" fill-opacity="0.1" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="537" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#f59e0b">Service Worker</text>
  <text x="537" y="88" font-size="9" text-anchor="middle" fill="currentColor">Background Sync Hook</text>
  <path d="M 620 77 L 665 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="670" y="45" width="125" height="65" rx="6" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="1.5"/>
  <text x="732" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#10b981">Cloud Reconcile</text>
  <text x="732" y="88" font-size="9" text-anchor="middle" fill="currentColor">Delta POST</text>
</svg>`,
    coreConcepts: [
      {
        title: 'Optimistic UI with Transactional Revert',
        description:
          'Update UI components immediately upon click; if the IndexedDB transaction or network sync permanently errors out, roll back state gracefully with user notification.',
        invariants: ['Zero blocking UI threads.', 'All offline mutations ordered by logical sequence.'],
      },
    ],
    failureModes: [
      {
        trap: 'Relying exclusively on localStorage for offline queues',
        impact: 'LocalStorage is synchronous, blocks the main UI thread during JSON serialization, and has a 5MB limit.',
        remediation: 'Use asynchronous IndexedDB with transaction stores and Service Worker background sync.',
      },
    ],
    codeSnippet: {
      language: 'typescript',
      filename: 'offline_store.ts',
      code: `async function saveOfflineMutation(db: IDBDatabase, mutation: Mutation) {
  const tx = db.transaction('mutations', 'readwrite');
  tx.objectStore('mutations').add(mutation);
  await new Promise(res => tx.oncomplete = res);
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready;
    await reg.sync.register('replay-mutations');
  }
}`,
      explanation: 'Asynchronous offline queue with Service Worker sync registration.',
    },
  },

  'frontend-architecture-3': {
    itineraryId: 'frontend-architecture',
    week: 3,
    conceptTitle: 'Zero-CLS Mobile Checkout Flows on Metered 2G Connections',
    executiveSummary:
      'Ecommerce checkouts in emerging markets abandon 35% of conversions due to font shifts, layout jumping during card type detection, and heavy JavaScript bundles. A resilient checkout loads under 35KB and achieves a 0.000 Cumulative Layout Shift score.',
    diagramTitle: 'Zero-CLS & Sub-50ms Reactive Checkout Flow',
    diagramSvg: `<svg viewBox="0 0 820 260" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto text-text-0 font-mono">
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" opacity="0.6"/></marker></defs>
  <rect x="0" y="0" width="820" height="260" rx="10" fill="currentColor" fill-opacity="0.02" stroke="currentColor" stroke-opacity="0.1"/>
  <rect x="30" y="45" width="160" height="65" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.3"/>
  <text x="110" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="currentColor">Throttled 2G Link</text>
  <text x="110" y="88" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.6">&lt; 35KB Gzip JS</text>
  <path d="M 190 77 L 235 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="240" y="45" width="165" height="65" rx="6" fill="#38bdf8" fill-opacity="0.1" stroke="#38bdf8" stroke-width="1.5"/>
  <text x="322" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#38bdf8">Fixed Dimensions</text>
  <text x="322" y="88" font-size="9" text-anchor="middle" fill="currentColor">Zero Reflow Skeletons</text>
  <path d="M 405 77 L 450 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="455" y="45" width="165" height="65" rx="6" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="1.5"/>
  <text x="537" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#10b981">Card Detection</text>
  <text x="537" y="88" font-size="9" text-anchor="middle" fill="currentColor">GPU Transform Icon</text>
  <path d="M 620 77 L 665 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="670" y="45" width="125" height="65" rx="6" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="1.5"/>
  <text x="732" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#10b981">CrUX 0.000 CLS</text>
  <text x="732" y="88" font-size="9" text-anchor="middle" fill="currentColor">INP &lt; 50ms</text>
</svg>`,
    coreConcepts: [
      {
        title: 'Core Web Vitals Optimization on Low-End Devices',
        description:
          'Eliminating layout shift requires reserved aspect-ratio boxes and font-display: optional with fallback size-adjust CSS descriptors.',
        invariants: ['CLS score must remain < 0.005.', 'Total JS payload under 35KB.'],
      },
    ],
    failureModes: [
      {
        trap: 'Injecting dynamic validation banners that push payment buttons downward',
        impact: 'Users accidentally click the wrong button or misclick due to Cumulative Layout Shift.',
        remediation: 'Reserve fixed heights for validation message boxes using min-height and opacity transitions.',
      },
    ],
    codeSnippet: {
      language: 'css',
      filename: 'zero_cls.css',
      code: `@font-face {
  font-family: 'Inter';
  font-display: optional;
  size-adjust: 100.5%; /* Matches fallback system font dimensions */
}`,
      explanation: 'Prevents text layout reflow when custom fonts finish downloading on slow links.',
    },
  },

  // =========================================================================
  // TRACK 5: AI SYSTEMS & LLM PLATFORM ENGINEERING
  // =========================================================================
  'ai-systems-engineering-1': {
    itineraryId: 'ai-systems-engineering',
    week: 1,
    conceptTitle: 'Semantic Vector Caching, Cosine Similarity & LLM Cost Reduction',
    executiveSummary:
      'Exact-match key-value caches fail on natural language because users rephrase identical intents. A semantic proxy computes dense vector embeddings, executes cosine nearest-neighbor search, and returns cached completions with sub-15ms latency.',
    diagramTitle: 'Semantic Vector Caching & Cosine Nearest-Neighbor Gateway',
    diagramSvg: `<svg viewBox="0 0 820 260" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto text-text-0 font-mono">
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" opacity="0.6"/></marker></defs>
  <rect x="0" y="0" width="820" height="260" rx="10" fill="currentColor" fill-opacity="0.02" stroke="currentColor" stroke-opacity="0.1"/>
  <rect x="30" y="45" width="150" height="65" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.3"/>
  <text x="105" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="currentColor">User Prompt</text>
  <text x="105" y="88" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.6">"How to reset key?"</text>
  <path d="M 180 77 L 225 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="230" y="45" width="165" height="65" rx="6" fill="#38bdf8" fill-opacity="0.1" stroke="#38bdf8" stroke-width="1.5"/>
  <text x="312" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#38bdf8">Embedding Engine</text>
  <text x="312" y="88" font-size="9" text-anchor="middle" fill="currentColor">Onnx / Local Vector</text>
  <path d="M 395 77 L 440 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="445" y="45" width="170" height="65" rx="6" fill="#f59e0b" fill-opacity="0.1" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="530" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#f59e0b">Cosine Index (&gt; 0.92)</text>
  <text x="530" y="88" font-size="9" text-anchor="middle" fill="currentColor">Redis / pgvector Search</text>
  <path d="M 615 77 L 660 77" stroke="#10b981" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="665" y="45" width="130" height="65" rx="6" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="1.5"/>
  <text x="730" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#10b981">Sub-15ms Hit</text>
  <text x="730" y="88" font-size="9" text-anchor="middle" fill="currentColor">45% Cost Saved</text>
</svg>`,
    coreConcepts: [
      {
        title: 'Cosine Distance vs Euclidean Space in Embeddings',
        description:
          'Normalized embedding vectors represent semantic direction rather than magnitude. Cosine similarity ranges from -1 to 1, where values above 0.92 represent identical semantic intent regardless of phrasing.',
        invariants: ['Cosine threshold calibrated at 0.92.', 'P99 lookup latency < 20ms.'],
      },
    ],
    failureModes: [
      {
        trap: 'Using low similarity thresholds (< 0.85) on customer support queries',
        impact: 'Returns cached answers for completely different questions, misinforming users.',
        remediation: 'Require strict cosine similarity thresholds and semantic centroid eviction policies.',
      },
    ],
    codeSnippet: {
      language: 'python',
      filename: 'semantic_cache.py',
      code: `def get_semantic_match(prompt_vec, index, threshold=0.92):
    # Cosine nearest neighbor search in vector space
    match, distance = index.query(prompt_vec, top_k=1)
    similarity = 1.0 - distance
    if similarity >= threshold:
        return match.cached_response
    return None`,
      explanation: 'High-speed vector similarity match avoiding redundant LLM API invocations.',
    },
  },

  'ai-systems-engineering-2': {
    itineraryId: 'ai-systems-engineering',
    week: 2,
    conceptTitle: 'Hybrid RAG: Reciprocal Rank Fusion (BM25 + Dense Vectors)',
    executiveSummary:
      'Dense vector search alone fails on exact keyword identifiers, error codes, and SKU numbers. A production RAG pipeline executes parallel BM25 lexical inverted index search and dense HNSW vector search, merging results using Reciprocal Rank Fusion (RRF).',
    diagramTitle: 'Reciprocal Rank Fusion (RRF) Hybrid Search Pipeline',
    diagramSvg: `<svg viewBox="0 0 820 260" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto text-text-0 font-mono">
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" opacity="0.6"/></marker></defs>
  <rect x="0" y="0" width="820" height="260" rx="10" fill="currentColor" fill-opacity="0.02" stroke="currentColor" stroke-opacity="0.1"/>
  <rect x="30" y="75" width="130" height="60" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.3"/>
  <text x="95" y="100" font-size="11" font-weight="700" text-anchor="middle" fill="currentColor">User Query</text>
  <text x="95" y="118" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.6">Error: ERR_PG_01</text>
  <path d="M 160 90 L 220 55" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="225" y="25" width="165" height="55" rx="6" fill="#38bdf8" fill-opacity="0.1" stroke="#38bdf8" stroke-width="1.5"/>
  <text x="307" y="48" font-size="10" font-weight="700" text-anchor="middle" fill="#38bdf8">Branch A: BM25 Lexical</text>
  <text x="307" y="64" font-size="8" text-anchor="middle" fill="currentColor">Exact Keyword Search</text>
  <path d="M 160 120 L 220 155" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="225" y="130" width="165" height="55" rx="6" fill="#f59e0b" fill-opacity="0.1" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="307" y="153" font-size="10" font-weight="700" text-anchor="middle" fill="#f59e0b">Branch B: HNSW Dense</text>
  <text x="307" y="169" font-size="8" text-anchor="middle" fill="currentColor">Semantic Vector Search</text>
  <path d="M 390 55 L 450 90" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <path d="M 390 155 L 450 120" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="455" y="75" width="180" height="65" rx="6" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="1.5"/>
  <text x="545" y="100" font-size="11" font-weight="700" text-anchor="middle" fill="#10b981">RRF Scoring (k=60)</text>
  <text x="545" y="118" font-size="9" text-anchor="middle" fill="currentColor">Normalized Rank Fusion</text>
  <path d="M 635 107 L 675 107" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="680" y="75" width="120" height="65" rx="6" fill="#10b981" fill-opacity="0.2" stroke="#10b981" stroke-width="2"/>
  <text x="740" y="100" font-size="11" font-weight="700" text-anchor="middle" fill="#10b981">Grounded RAG</text>
  <text x="740" y="118" font-size="9" text-anchor="middle" fill="currentColor">Recall@5 &gt; 95%</text>
</svg>`,
    coreConcepts: [
      {
        title: 'Reciprocal Rank Fusion Formula',
        description:
          'RRF normalizes ranks across disparate scoring distributions by summing reciprocal ranks: $RRF(d) = \\sum_{m \\in M} \\frac{1}{k + r_m(d)}$. The constant $k=60$ mitigates rank outliers from either retrieval method.',
        invariants: ['Recall@5 >= 95% on alphanumeric technical identifiers.', 'P95 latency < 85ms.'],
      },
    ],
    failureModes: [
      {
        trap: 'Relying exclusively on dense embeddings for code search and documentation',
        impact: 'Vector search retrieves related concepts but misses the exact configuration flag or error code.',
        remediation: 'Combine BM25 inverted indexes with vector search and cross-encoder re-ranking.',
      },
    ],
    codeSnippet: {
      language: 'python',
      filename: 'rrf_fusion.py',
      code: `def rrf_score(bm25_ranks, vector_ranks, k=60):
    scores = {}
    for rank, doc_id in enumerate(bm25_ranks):
        scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank)
    for rank, doc_id in enumerate(vector_ranks):
        scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank)
    return sorted(scores.items(), key=lambda x: x[1], reverse=True)`,
      explanation: 'Reciprocal Rank Fusion combining disparate lexical and vector retrieval scores.',
    },
  },

  'ai-systems-engineering-3': {
    itineraryId: 'ai-systems-engineering',
    week: 3,
    conceptTitle: 'Deterministic Grammar-Guided Decoding & PII Redaction Gateways',
    executiveSummary:
      'LLMs cannot be trusted to emit valid JSON purely through prompt engineering: token sampling drift frequently introduces conversational preambles or malformed JSON that breaks downstream automated parsers. Context-Free Grammar (CFG) decoding filters enforce 100% schema conformance at the token level.',
    diagramTitle: 'Token-Level Context-Free Grammar (CFG) Decoding Gateway',
    diagramSvg: `<svg viewBox="0 0 820 260" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto text-text-0 font-mono">
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" opacity="0.6"/></marker></defs>
  <rect x="0" y="0" width="820" height="260" rx="10" fill="currentColor" fill-opacity="0.02" stroke="currentColor" stroke-opacity="0.1"/>
  <rect x="30" y="45" width="150" height="65" rx="6" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.3"/>
  <text x="105" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="currentColor">LLM Token Stream</text>
  <text x="105" y="88" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.6">Raw Next-Token Logits</text>
  <path d="M 180 77 L 225 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="230" y="45" width="165" height="65" rx="6" fill="#38bdf8" fill-opacity="0.1" stroke="#38bdf8" stroke-width="1.5"/>
  <text x="312" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#38bdf8">CFG Grammar Filter</text>
  <text x="312" y="88" font-size="9" text-anchor="middle" fill="currentColor">Masks Invalid Tokens</text>
  <path d="M 395 77 L 440 77" stroke="currentColor" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="445" y="45" width="165" height="65" rx="6" fill="#f59e0b" fill-opacity="0.1" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="527" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#f59e0b">Streaming PII Scrub</text>
  <text x="527" y="88" font-size="9" text-anchor="middle" fill="currentColor">Redacts Cards &amp; Keys</text>
  <path d="M 610 77 L 655 77" stroke="#10b981" stroke-width="1.5" marker-end="url(#arrow)"/>
  <rect x="660" y="45" width="135" height="65" rx="6" fill="#10b981" fill-opacity="0.1" stroke="#10b981" stroke-width="1.5"/>
  <text x="727" y="70" font-size="11" font-weight="700" text-anchor="middle" fill="#10b981">100% Valid JSON</text>
  <text x="727" y="88" font-size="9" text-anchor="middle" fill="currentColor">Schema Guaranteed</text>
</svg>`,
    coreConcepts: [
      {
        title: 'Grammar-Guided Decoding at the Logit Masking Level',
        description:
          'Rather than parsing output after generation, grammar-guided decoding masks out all vocabulary tokens that would violate the JSON Schema grammar before the sampling step occurs.',
        invariants: ['100% guaranteed JSON Schema compliance.', 'Zero leaks of API keys or phone numbers.'],
      },
    ],
    failureModes: [
      {
        trap: 'Using post-generation regex to extract JSON from conversational markdown blocks',
        impact: 'Breaks in production when the LLM truncates output or responds with explanatory chat text.',
        remediation: 'Use token-level grammar-constrained decoding (e.g. Outlines, Guidance, or JSON mode).',
      },
    ],
    codeSnippet: {
      language: 'python',
      filename: 'grammar_guard.py',
      code: `from pydantic import BaseModel

class SettlementReceipt(BaseModel):
    transaction_id: str
    amount: float
    status: str

# Grammar-enforced generation ensures 0 syntax errors
response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents=prompt,
    config={"response_mime_type": "application/json", "response_schema": SettlementReceipt}
)`,
      explanation: 'Constrains model token logits to strictly match the Pydantic schema.',
    },
  },
};

export function getMilestoneConcept(itineraryId: string, week: number): MilestoneConcept | undefined {
  return MILESTONE_CONCEPTS[`${itineraryId}-${week}`];
}
