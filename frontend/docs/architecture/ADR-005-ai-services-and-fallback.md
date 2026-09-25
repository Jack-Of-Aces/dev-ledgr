# ADR-005: AI Services & Graceful Degradation

**Date:** 2026-09-25  
**Status:** Accepted  
**Deciders:** DevLedgr Core Team

---

## Context

The AI capabilities (ATS scrutiny, cover letter generation, socratic coaching) are core product
differentiators. However, during the MVP phase:
- No AI gateway is deployed yet.
- Users may not have API keys.
- We still needed the features to work end-to-end for demos and evaluation.

We needed a strategy that:
- **Delights with real AI** when the gateway is available.
- **Degrades gracefully** — not silently — when it's not.
- **Provides real-time streaming feedback** (not a 10-second blank wait).
- **Never stores user API keys** in localStorage or global state.

---

## Decision

### `IAIService` with single `AIService` implementation (no separate mock class):

Unlike the other services, AI uses **inline heuristic fallback** rather than a separate mock adapter.
Reason: AI output is inherently generative — a "mock" AI response is actually a deterministic
rule-based engine that produces correct output based on real data (submission hashes, job match
scores, user skills), not hardcoded strings.

**Fallback trigger order for `runScrutinyAudit()`:**
1. If `NEXT_PUBLIC_AI_GATEWAY_URL` is set → call live gateway.
2. If live gateway fails or is not set → run local **Heuristic Reasoning Engine** (HRE).
3. HRE uses real user submission data to produce:
   - Deterministic `hasGap` decision (based on `job.matchScore` and solved idea IDs).
   - Dynamically generated CV markdown pre-populated with real commit hashes and metrics.
   - Tailored cover letter referencing real submission performance data.

### Streaming:

The `onLog` callback parameter provides real-time feedback as audit steps complete,
regardless of whether the live gateway or HRE is running:

```ts
aiService.runScrutinyAudit(params, (log) => setScanLog(prev => [...prev, log]))
```

### BYOK Key Security:

When a user provides an API key (Gemini / OpenAI), it is routed through a server-side
Next.js Route Handler (`/api/ai/stream`), not exposed to other client-side code or
stored in any persistent state.

---

## Tools Used

| Concern | Choice |
|---|---|
| AI interface | `IAIService` with `runScrutinyAudit()` + `getCoachingAdvice()` |
| Real-time logs | `onLog: (log: string) => void` callback |
| Content generation | HRE (Heuristic Reasoning Engine) with template literals + real data |
| Key security | Server Route Handler (future) — never `localStorage` |

---

## Rejected Alternatives

| Option | Reason Rejected |
|---|---|
| Hardcoded `setTimeout` simulation | Already existed; rejected because output is static (same every run), unrelated to real user data |
| Separate `MockAIService` class | Unnecessary — HRE already produces real-data-driven output; a second class would just duplicate it |
| Storing API key in Zustand | XSS risk; key would persist beyond session |
| Waiting for gateway before building UI | Would have blocked the entire AI feature until backend is ready |

---

## Consequences

- Any new AI feature must be added to `IAIService` first, then implemented in `AIService`.
- HRE output quality will improve as more real submission data is available.
- When the AI gateway is deployed, only `AIService.callLiveGateway()` needs updating.
- AI responses are never cached — they are context-specific to the user's current portfolio state.
