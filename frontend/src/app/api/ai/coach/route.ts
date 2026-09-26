/**
 * @file route.ts
 * @description Next.js Route Handler for live Socratic AI coaching.
 * Connects to Google Gemini 2.5 Flash via REST with BYOK support and graceful fallback.
 */

import { NextResponse } from 'next/server';

interface CoachRequestBody {
  itineraryTitle: string;
  milestoneTitle: string;
  prompt: string;
  apiKey?: string;
}

export async function POST(req: Request) {
  try {
    const body: CoachRequestBody = await req.json();
    const { itineraryTitle, milestoneTitle, prompt, apiKey: userKey } = body;

    const apiKey = userKey?.trim() || process.env.GEMINI_API_KEY || '';

    // If Gemini API Key is available, call live Gemini 2.5 Flash
    if (apiKey) {
      try {
        const systemInstruction = `You are a Principal Distributed Systems & Infrastructure Architect serving as a technical mentor on DevLedgr.
Your goal is to guide software engineers building production-grade solutions for: "${itineraryTitle}" (Milestone: "${milestoneTitle}").
Adopt a Socratic, deeply technical mindset:
1. Explain the underlying system mechanisms (concurrency locks, cache stampedes, B-Tree fragmentation, network partitions, TCP resets, tail latency).
2. Contrast 2-3 architectural approaches with quantitative trade-offs (e.g. Redis sliding window vs Token bucket, K-means vs DBSCAN).
3. Provide crisp, production-grade Go/Python code snippets when helpful.
4. Keep answers focused, dense with technical insights, and formatted with markdown headers and code blocks.`;

        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const geminiRes = await fetch(geminiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: `${systemInstruction}\n\nCandidate Question: "${prompt}"`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 1200,
            },
          }),
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const candidateText =
            geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

          if (candidateText) {
            return NextResponse.json({
              success: true,
              source: 'gemini-2.5-flash',
              advice: candidateText,
            });
          }
        }
      } catch (geminiError) {
        console.warn('[CoachRoute] Live Gemini call failed, using heuristic guidance:', geminiError);
      }
    }

    // High-Fidelity Heuristic Fallback Engine
    const p = prompt.toLowerCase();
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
    } else if (p.includes('haversine') || p.includes('k-means') || p.includes('route')) {
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
    } else {
      advice = `### Production Architectural Guidance for ${milestoneTitle}

To satisfy high-concurrency benchmarks for this milestone:

1. **Zero-Allocation Pipelines**: Pre-allocate slice buffers when unmarshaling order streams to avoid garbage collection pressure during burst spikes.
2. **Connection Pooling**: Bound PostgreSQL pool size to \`MaxOpenConns = (CPU_CORES * 2) + DISK_SPINDLES\` to prevent connection thrashing under load.
3. **Resilience Pattern**: Wrap third-party network egress in an exponential jitter backoff with an open-circuit breaker after 5 consecutive timeouts.`;
    }

    return NextResponse.json({
      success: true,
      source: 'heuristic-engine',
      advice,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error processing coaching guidance.' },
      { status: 500 }
    );
  }
}
