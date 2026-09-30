/**
 * @file route.ts
 * @description Next.js Route Handler for automated ATS scrutiny auditing and CV generation.
 * Features rate limiting and multi-provider AI Mesh (Gemini 2.5/2.0/1.5, Groq Llama 3.3/3.1, Gemma 2)
 * with robust heuristic fallback.
 *
 * The candidate is resolved server-side from the session, never from the body.
 */

import { NextResponse } from 'next/server';
import { JobOpportunity } from '@/types';
import { checkRateLimit } from '@/lib/rate-limiter';
import { runAIMesh } from '@/lib/ai-mesh';
import { resolveProviderKey } from '@/lib/provider-key';
import { resolveServerSession } from '@/lib/server-session';
import { envConfig } from '@/lib/config';
import {
  measuredP99,
  recordedMetric,
  recordedSuiteName,
  recordedTestResult,
} from '@/lib/telemetry';

interface ScrutinyRequestBody {
  /**
   * The job being applied for. This is a reference, not an identity claim: the
   * route re-reads it from the backend when it can (see resolveJob).
   *
   * `user` and `userSubmissions` used to be read from here too. They are
   * deliberately ignored now — see resolveServerSession.
   */
  job: JobOpportunity;
  /**
   * Demo controls for the "Simulate Skill Gap Branch" toggle. They choose
   * between two branches of the caller's own data; they cannot introduce another
   * dev's work or a figure that was not measured.
   */
  forceGap?: boolean;
  overrideGap?: boolean;
}

const JOB_LOOKUP_TIMEOUT_MS = 4000;

/**
 * Re-reads the job from the backend so matchScore, gapIdeaId and the company
 * name are the platform's copy rather than the browser's.
 *
 * A caller could otherwise post `{ matchScore: 100, gapIdeaId: undefined }` and
 * have the gap branch skipped. The body copy is still accepted as a fallback for
 * deployments with no backend, and a job listing is public data either way — it
 * is the *dev* half of the request that had to stop being client-supplied.
 */
async function resolveJob(clientJob: JobOpportunity | undefined): Promise<JobOpportunity | null> {
  if (!clientJob || typeof clientJob.id !== 'string' || !clientJob.id) return null;

  const base = (process.env.API_URL || envConfig.apiUrl || '').replace(/\/$/, '');
  if (base) {
    try {
      const res = await fetch(`${base}/api/v1/jobs/${encodeURIComponent(clientJob.id)}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(JOB_LOOKUP_TIMEOUT_MS),
      });
      if (res.ok) {
        const data = (await res.json()) as JobOpportunity;
        if (data && typeof data.title === 'string' && typeof data.company === 'string') {
          return data;
        }
      }
    } catch (err) {
      console.warn('[ScrutinyRoute] Job lookup failed; using the referenced job as sent:', err);
    }
  }

  return clientJob;
}

export async function POST(req: Request) {
  // 1. Sliding Window Rate Limiting (15 requests per minute per IP)
  const rl = checkRateLimit(req, 'ai-scrutiny', { limit: 15, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        status: 'gap',
        error: `Rate limit exceeded. Please wait ${rl.resetInSeconds} seconds before requesting ATS scrutiny.`,
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

  // 2. Authenticate. This route used to read the candidate's profile and their
  // whole ledger out of the request body, so anyone who could reach it — with no
  // session at all — got back a finished, ATS-shaped CV and cover letter
  // asserting proof of work. It also substituted "28ms p99" and "240 req/s" for
  // any submission without recorded telemetry, so the document a recruiter read
  // described performance nobody had measured. The identity now comes from the
  // session cookie and the backend, and only reviewed entries are described.
  const session = await resolveServerSession(req);
  if (!session.ok) {
    return NextResponse.json(
      { status: 'error', error: session.error, code: session.code },
      { status: session.status }
    );
  }

  try {
    const { profile: user, submissions: userSubmissions, ledger } = session.session;
    const body: ScrutinyRequestBody = await req.json();
    const { forceGap, overrideGap } = body;
    const job = await resolveJob(body.job);
    if (!job) {
      return NextResponse.json(
        { status: 'error', error: 'A job reference is required to run an ATS audit.' },
        { status: 400 }
      );
    }
    // BYOK key comes from the backend, never from the browser.
    const userKey = await resolveProviderKey(req);

    // 3. Decision Logic
    const solvedIdeaIds = new Set(userSubmissions.map((s) => s.ideaId));
    const hasSolvedGap = job.gapIdeaId ? solvedIdeaIds.has(job.gapIdeaId) : true;
    // overrideGap is the dev choosing to generate the package despite the gap.
    // forceGap stays a hard switch so the "Simulate Skill Gap Branch" control
    // still demonstrates the gap path.
    const hasGap = !overrideGap && (forceGap || (!hasSolvedGap && job.matchScore < 80));

    // Count what was actually measured. A gap branch fired on a fabricated
    // number would report a passing SLA proof for a submission that has none.
    const measuredCount = userSubmissions.filter(
      (s) => recordedMetric(s.metrics?.latencyP99) || recordedTestResult(s.testResults)
    ).length;

    const auditLogs = [
      `Fetching verified commits for @${user.username} from DevLedgr consensus network...`,
      // Distinguish "this dev has no proofs" from "the ledger could not be
      // read". Reporting one as the other puts a number in front of a recruiter
      // that nothing stands behind.
      ledger === 'ok'
        ? `Found ${userSubmissions.length} reviewed and stamped ledger entries.`
        : 'The DevLedgr ledger could not be read just now, so no proof points are included in this package.',
      `Cross-referencing technical requirements for ${job.company} (${job.title})...`,
      `Auditing recorded test results against job spec (${measuredCount} of ${userSubmissions.length} entries carry measurements)...`,
      hasGap
        ? `Identified skill gap: requires demonstrated proof for ${job.gapReason || 'specialized domain problem'}.`
        : `Verified all required proof points for ${job.company}. Synthesizing ATS-safe package...`,
    ];

    if (hasGap) {
      return NextResponse.json(
        {
          status: 'gap',
          auditLogs,
          gapIdeaId: job.gapIdeaId,
          gapReason: job.gapReason,
          matchScore: job.matchScore,
        },
        {
          headers: {
            'X-RateLimit-Limit': String(rl.limit),
            'X-RateLimit-Remaining': String(rl.remaining),
          },
        }
      );
    }

    // 4. Multi-Provider AI Mesh Generation
    const promptText = `You are an expert Technical Recruiter & ATS Optimization Engine for software engineers.
Generate a high-converting, ATS-compliant Markdown Resume (CV) and a tailored Cover Letter for this candidate applying to ${job.company} for the role "${job.title}".

Candidate Information:
Name: ${user.name} (@${user.username})
Headline: ${user.headline}
Bio: ${user.bio}
Skills: ${user.statedSkills.join(', ')}

Verified Ledger Commits (Proof of Work):
${userSubmissions
  .map((s) => {
    // Report only measured values. A missing metric is omitted from the
    // prompt entirely rather than filled with a plausible number, so the
    // model cannot describe performance the candidate never demonstrated. This
    // used to read "p99 latency ${... || '32ms'}, throughput ${... || '240
    // req/s'}", which put invented SLAs into a document sent to an employer.
    const measured = measuredP99(s.metrics?.latencyP99, s.metrics?.throughput);
    const tests = recordedTestResult(s.testResults);
    const telemetry = [measured, tests ? `${tests} tests passed` : null]
      .filter(Boolean)
      .join(', ');
    return `- Problem: ${s.ideaTitle} (Commit #${s.hash})
  Architecture: ${s.architectureNotes}
  ${telemetry ? `Measured: ${telemetry}.\n  ` : ''}Repository: ${s.repoUrl}`;
  })
  .join('\n')}

Report only the measurements listed above. Do not estimate, infer, or invent
latency, throughput, coverage, or test results for any entry that omits them.
If an entry has no measured figures, describe only the architecture and the
repository.

Format your output strictly as a JSON object with two string fields:
{
  "cvMarkdown": "...markdown text...",
  "coverLetter": "...cover letter text..."
}`;

    const systemInstruction =
      'You are an automated ATS CV tailoring engine. You must output valid JSON with keys cvMarkdown and coverLetter.';

    const meshResult = await runAIMesh({
      prompt: promptText,
      systemInstruction,
      jsonMode: true,
      userApiKey: userKey,
      temperature: 0.3,
      maxTokens: 1600,
    });

    if (meshResult.text) {
      try {
        // Strip markdown backticks if returned inside code block
        const cleaned = meshResult.text.replace(/```json\s*|\s*```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        if (parsed.cvMarkdown && parsed.coverLetter) {
          return NextResponse.json(
            {
              status: 'ready',
              auditLogs,
              cvMarkdown: parsed.cvMarkdown,
              coverLetter: parsed.coverLetter,
              source: meshResult.model,
              provider: meshResult.provider,
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
      } catch (parseErr) {
        console.warn('[ScrutinyRoute] JSON parse failed on LLM output, falling back to heuristic engine:', parseErr);
      }
    }

    // 5. Heuristic Fallback Engine
    const cvMarkdown = `# ${user.name}
${user.headline}
Email: ${user.email || `${user.username}@devledgr.xyz`} | Portfolio: https://${user.username}.devledgr.xyz
GitHub: ${user.githubUrl} | Verification: Stamped on DevLedgr (1-Year Certificate)

---

## EXECUTIVE SUMMARY
Early-career backend engineer with proven track record building resilient microservices and distributed data pipelines. Every competency listed below is backed by a cryptographically signed ledger entry, and any performance figure shown is one a reviewer actually measured.

---

## VERIFIED ENGINEERING PROOF (DEVLEDGR COMMITS)

${userSubmissions
  .map((sub) => {
    // This engine is the fallback when no LLM is available, and it is read by
    // recruiters. It previously hardcoded 28ms p99 at 240 req/s and "100% of
    // automated test vectors" for every entry. Each line below is now
    // conditional on a value having actually been recorded.
    const perf = measuredP99(sub.metrics?.latencyP99, sub.metrics?.throughput);
    const tests = recordedTestResult(sub.testResults);
    const suite = recordedSuiteName(sub.testResults);
    return `### ${sub.ideaTitle}
**Commit #${sub.hash}** · Verified Proof of Work | Code: ${sub.repoUrl}
- **Architecture & Implementation:** ${sub.architectureNotes}
${perf ? `- **Measured Performance:** Sustained ${perf}.\n` : ''}${
      tests
        ? `- **Verification Suite:** ${tests} tests passed${
            suite ? ` in ${suite}` : ''
          }.\n`
        : ''
    }- **Permanent Ledger Link:** https://${user.username}.devledgr.xyz/p/${sub.hash}`;
  })
  .join('\n\n')}

---

## TECHNICAL CAPABILITIES
- **Languages:** ${user.statedSkills.slice(0, 4).join(', ')}
- **Databases & Cache:** PostgreSQL, Redis, Distributed Queues
- **Infrastructure:** Docker, Linux, CI/CD, service mock development
- **Verification Guarantee:** 1-Year Verifiable Ledger Certificate through Sep 2027
`;

    const coverLetter = `Dear Hiring Team at ${job.company},

I am writing to express my strong interest in the ${job.title} position.

Unlike traditional applicants submitting unverified claims or tutorial clones, my experience is backed by verifiable proof-of-work recorded on DevLedgr (https://${user.username}.devledgr.xyz).

For instance, to demonstrate the distributed transaction and concurrency requirements essential for ${job.company}, I engineered:
${userSubmissions
  .slice(0, 2)
  .map((s) => {
    // Same rule as the CV: the latency clause is only written when a latency
    // was measured, and it is not dressed up as a production-load result
    // unless the throughput was measured alongside it.
    const latency = recordedMetric(s.metrics?.latencyP99);
    const tp = recordedMetric(s.metrics?.throughput);
    const clause = latency
      ? tp
        ? `, achieving a measured p99 latency of ${latency} at ${tp}`
        : `, with a measured p99 latency of ${latency}`
      : '';
    return `• ${s.ideaTitle} (Commit #${s.hash})${clause}.`;
  })
  .join('\n')}

I welcome the opportunity to discuss how my verified technical problem-solving translates to high reliability on your team.

Sincerely,
${user.name}
${user.githubUrl}`;

    return NextResponse.json(
      {
        status: 'ready',
        auditLogs,
        cvMarkdown,
        coverLetter,
        source: 'heuristic-engine',
        provider: 'heuristic',
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
      { status: 'gap', error: 'Internal server error processing scrutiny audit.' },
      { status: 500 }
    );
  }
}
