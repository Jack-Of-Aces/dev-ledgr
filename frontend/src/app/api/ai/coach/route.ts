/**
 * @file route.ts
 * @description Next.js Route Handler for live Socratic AI coaching.
 * Features rate limiting and multi-provider AI Mesh (Gemini 2.5/2.0/1.5, Groq Llama 3.3/3.1, Gemma 2)
 * with graceful failover to high-fidelity deterministic heuristics.
 */

import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limiter';
import { runAIMesh } from '@/lib/ai-mesh';
import { resolveProviderKey } from '@/lib/provider-key';

interface CoachMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CoachRequestBody {
  itineraryTitle: string;
  milestoneTitle: string;
  prompt: string;
  messages?: CoachMessage[];
  candidateContext?: {
    username: string;
    name: string;
    headline?: string;
    statedSkills?: string[];
    verifiedProofCount: number;
    solvedIdeaTitles: string[];
  };
}

export async function POST(req: Request) {
  // 1. Sliding Window Rate Limiting (20 requests per minute per IP)
  const rl = checkRateLimit(req, 'ai-coach', { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `Rate limit exceeded. Please wait ${rl.resetInSeconds} seconds before requesting AI coaching.`,
        limit: rl.limit,
        remaining: 0,
        resetInSeconds: rl.resetInSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.resetInSeconds),
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rl.resetInSeconds),
        },
      }
    );
  }

  try {
    const body: CoachRequestBody = await req.json();
    const { itineraryTitle, milestoneTitle, prompt, messages, candidateContext } = body;
    // BYOK key comes from the backend, never from the browser.
    const userKey = await resolveProviderKey(req);

    const candidateSummary = candidateContext
      ? `You are mentoring @${candidateContext.username} (${candidateContext.name}), who has ${
          candidateContext.verifiedProofCount
        } verified proof(s) on their ledger (${candidateContext.solvedIdeaTitles.join(', ') || 'None yet'}).
Their stated tech stack is: ${candidateContext.statedSkills?.join(', ') || 'Go, TypeScript, PostgreSQL'}.
Directly relate your recommendations to their specific background, tailoring examples to their stack while maintaining rigorous production standards.`
      : `Mentoring a developer on DevLedgr.`;

    const systemInstruction = `You are a Principal Distributed Systems & Staff Infrastructure Architect serving as an authoritative technical mentor on DevLedgr.
${candidateSummary}

Your mission is to guide the engineer in building production-grade solutions for the curriculum "${itineraryTitle}" (Milestone: "${milestoneTitle}").

Standards for your guidance:
1. Deliver exhaustive, comprehensive, complete technical explanations from first principles. DO NOT cut off mid-thought or give half-baked overviews.
2. Structure your reply cleanly using Markdown headers (###, ####), bullet points, and numbered steps.
3. Compare architectural patterns quantitatively (memory footprint, time complexity, network overhead, p99 tail latency, failure semantics).
4. Provide concrete, syntactically correct code snippets tailored to the engineer's stack (${candidateContext?.statedSkills?.join(', ') || 'Go, TypeScript, PostgreSQL'}) when demonstrating implementation patterns.
5. Highlight critical edge cases, network partition failure modes, and production traps (e.g. split-brain, thundering herds, unindexed foreign keys, lock contention).
6. Be direct, authoritative, and deeply practical — like a Staff Engineer doing a rigorous design review.`;

    let activePrompt = prompt;
    if (messages && messages.length > 0) {
      // Keep last 6 messages to provide rich multi-turn context without prompt bloat
      const relevantHistory = messages.slice(-6);
      const historyText = relevantHistory
        .map((m) => `${m.role === 'user' ? 'Developer' : 'Architect Mentor'}: ${m.content}`)
        .join('\n\n');
      activePrompt = `Previous Dialogue:\n${historyText}\n\nDeveloper's latest query: ${prompt}`;
    }

    // 2. Cascade across AI Mesh (Gemini -> Groq -> Heuristics)
    const meshResult = await runAIMesh({
      prompt: activePrompt,
      systemInstruction,
      userApiKey: userKey,
      temperature: 0.35,
      maxTokens: 3500,
    });

    if (meshResult.text) {
      return NextResponse.json(
        {
          success: true,
          source: meshResult.model,
          provider: meshResult.provider,
          advice: meshResult.text,
          attempts: meshResult.attempts,
        },
        {
          headers: {
            'X-RateLimit-Limit': String(rl.limit),
            'X-RateLimit-Remaining': String(rl.remaining),
          },
        }
      );
    }

    // 3. High-Fidelity Heuristic Fallback Engine
    const p = (prompt || '').toLowerCase();
    let advice = '';

    if (p.includes('504') || p.includes('idempotenc') || p.includes('timeout')) {
      advice = `### Architectural Decision: Idempotency Under Gateway Timeouts

When upstream payment gateways return HTTP 504 Gateway Timeout, the transaction state is ambiguous (the charge may have succeeded on the banking network even if the TCP socket was closed prematurely).

\`\`\`go
// Idempotency buffer with Redis sliding window lock
func (b *Buffer) ProcessWebhook(ctx context.Context, hook WebhookPayload) error {
    lockKey := fmt.Sprintf("idempotency:%s", hook.EventID)
    
    // Acquire distributed lock with atomic SET NX PX
    acquired, err := b.redis.SetNX(ctx, lockKey, "PROCESSING", 45*time.Second).Result()
    if err != nil || !acquired {
        return ErrDuplicateDelivery // Gracefully acknowledge HTTP 200 to halt caller retries
    }
    
    // Defer jittered exponential backoff for downstream reconciliation
    return b.dispatchWithCircuitBreaker(ctx, hook)
}
\`\`\`

#### Key Trade-offs:
1. **At-Least-Once Delivery**: Never assume HTTP 200 implies a single delivery. Always store processed event IDs in an immutable Bloom filter or append-only ledger table with a \`UNIQUE(event_id)\` constraint.
2. **Timing-Safe HMAC Verification**: Use \`subtle.ConstantTimeCompare\` to prevent timing attacks when verifying partner webhooks.`;
    } else if (p.includes('uuid') || p.includes('ulid') || p.includes('b-tree')) {
      advice = `### Storage Engine Analysis: UUIDv4 vs ULID B-Tree Fragmentation

Using random \`UUIDv4\` as a primary clustered key in PostgreSQL or MySQL InnoDB causes severe B-Tree page splits and random disk I/O under high write concurrency:

1. **UUIDv4**: Generates uniform entropy across all 128 bits. Consecutive inserts land in random pages throughout the index tree, forcing dirty pages out of buffer cache and requiring frequent random fsync writes.
2. **ULID / UUIDv7**: Encodes a 48-bit millisecond timestamp followed by 80 bits of cryptographic randomness. Inserts are monotonically increasing, appending sequentially to the rightmost leaf page of the B-Tree index.

#### Benchmarked Impact:
- **Index Size**: Sequential keys achieve ~90% page fullness vs ~50-60% for random UUIDv4.
- **Cache Hit Ratio**: ULID maintains >98% buffer pool hit ratio at 10M rows because hot pages stay clustered at the tree edge.`;
    } else if (p.includes('haversine') || p.includes('k-means') || p.includes('route') || p.includes('spatial')) {
      advice = `### Spatial Clustering Heuristics for Informal Fleets

Haversine computes great-circle distance assuming a perfect spherical geoid. In dense informal settlements, this breaks down due to winding alleys, canal blockages, and non-drivable paths.

\`\`\`go
// Penalty-adjusted Haversine for urban courier dispatch
func RoadNetworkDistance(p1, p2 LatLng) float64 {
    const R = 6371.0 // Earth radius in km
    dLat := (p2.Lat - p1.Lat) * (math.Pi / 180.0)
    dLon := (p2.Lng - p1.Lng) * (math.Pi / 180.0)
    
    a := math.Sin(dLat/2)*math.Sin(dLat/2) +
         math.Cos(p1.Lat*(math.Pi/180.0))*math.Cos(p2.Lat*(math.Pi/180.0))*
         math.Sin(dLon/2)*math.Sin(dLon/2)
    c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
    
    directDistance := R * c
    // Urban congestion & detour penalty factor (1.35x typical for informal markets)
    return directDistance * 1.35
}
\`\`\`

#### Heuristic Comparison:
- **K-Means**: Requires fixed $k$ cluster count upfront and is sensitive to outliers.
- **DBSCAN**: Discovers arbitrary cluster shapes based on spatial density thresholds without pre-specifying bike counts.`;
    } else if (p.includes('crdt') || p.includes('offline') || p.includes('sync')) {
      advice = `### Conflict-Free Replicated Data Types (CRDT) for Field Devices

For field operations with intermittent 2G/3G connectivity, state reconciliation must be associative, commutative, and idempotent:

1. **State-based (CvRDT)**: Nodes periodically transmit their full state or state delta. Merging functions compute a monotonic join (lattice upper bound).
2. **Operation-based (CmRDT)**: Nodes transmit individual operations via reliable causal broadcast (costly on lossy connections).

#### Architectural Recommendation:
Implement **PNCounter** or **Observed-Removed Set (OR-Set)** with client-generated ULID causality tags so field updates merge cleanly upon reconnection without server lock contention.`;
    } else if (p.includes('rag') || p.includes('vector') || p.includes('llm') || p.includes('prompt')) {
      advice = `### Production RAG Retrieval & Guardrail Architecture

To prevent hallucination in critical engineering workflows:

1. **Hybrid Retrieval (RRF)**: Combine sparse lexical search (BM25 for exact identifiers like error codes or commit SHAs) with dense vector embeddings (cosine distance for semantic intent) using Reciprocal Rank Fusion.
2. **JSON Schema Constrained Decoding**: Never rely on raw prompt coaxing for structured data. Enforce strict JSON schema grammars at token sampling time (e.g. Guidance, Outlines, or instructor).
3. **Chunking Strategy**: Use hierarchical parent-child chunking (512-token chunks with 64-token overlap linked to full parent documents) to preserve broad document context during citation synthesis.`;
    } else if (p.includes('state machine') || p.includes('virtual') || p.includes('inp') || p.includes('frontend')) {
      advice = `### High-Performance Web UI Architecture & State Isolation

To maintain 60 FPS and <50ms INP during high-frequency data streams:

1. **State Isolation**: Decouple global application state from rapidly updating stream feeds. Use targeted selector subscriptions (e.g. Zustand with shallow equality or Valtio proxies) so high-frequency updates only re-render the individual row component.
2. **Virtualization vs Content-Visibility**:
   - For lists exceeding 500 items with dynamic heights, use a virtualizer (e.g., TanStack Virtual) to maintain a constant DOM node count (~20 nodes).
   - For static long documents, apply \`content-visibility: auto\` with \`contain-intrinsic-size\` to defer off-screen rendering to the browser's layout engine.`;
    } else {
      advice = `### Production Architectural Guidance for ${milestoneTitle}

To satisfy high-concurrency benchmarks for this milestone:

1. **Zero-Allocation Pipelines**: Pre-allocate slice buffers when unmarshaling order streams to avoid garbage collection pressure during burst spikes.
2. **Connection Pooling**: Bound PostgreSQL pool size to \`MaxOpenConns = (CPU_CORES * 2) + DISK_SPINDLES\` to prevent connection thrashing under load.
3. **Resilience Pattern**: Wrap third-party network egress in an exponential jitter backoff with an open-circuit breaker after 5 consecutive timeouts.`;
    }

    return NextResponse.json(
      {
        success: true,
        source: 'heuristic-engine',
        provider: 'heuristic',
        advice,
        attempts: meshResult.attempts,
      },
      {
        headers: {
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': String(rl.remaining),
        },
      }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error processing coaching guidance.' },
      { status: 500 }
    );
  }
}
