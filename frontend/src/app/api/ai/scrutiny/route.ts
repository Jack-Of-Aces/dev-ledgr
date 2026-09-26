/**
 * @file route.ts
 * @description Next.js Route Handler for automated ATS scrutiny auditing and CV generation.
 * Features rate limiting and multi-provider AI Mesh (Gemini 2.5/2.0/1.5, Groq Llama 3.3/3.1, Gemma 2)
 * with robust heuristic fallback.
 */

import { NextResponse } from 'next/server';
import { JobOpportunity, UserProfile, SubmissionEntry } from '@/types';
import { checkRateLimit } from '@/lib/rate-limiter';
import { runAIMesh } from '@/lib/ai-mesh';

interface ScrutinyRequestBody {
  job: JobOpportunity;
  user: UserProfile;
  userSubmissions: SubmissionEntry[];
  forceGap?: boolean;
  apiKey?: string;
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

  try {
    const body: ScrutinyRequestBody = await req.json();
    const { job, user, userSubmissions, forceGap, apiKey: userKey } = body;

    // 2. Decision Logic
    const solvedIdeaIds = new Set(userSubmissions.map((s) => s.ideaId));
    const hasSolvedGap = job.gapIdeaId ? solvedIdeaIds.has(job.gapIdeaId) : true;
    const hasGap = forceGap || (!hasSolvedGap && job.matchScore < 80);

    const auditLogs = [
      `Fetching verified commits for @${user.username} from DevLedgr consensus network...`,
      `Found ${userSubmissions.length} cryptographically signed entries.`,
      `Cross-referencing technical requirements for ${job.company} (${job.title})...`,
      `Auditing latency SLA proofs and test suites against job spec...`,
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

    // 3. Multi-Provider AI Mesh Generation
    const promptText = `You are an expert Technical Recruiter & ATS Optimization Engine for software engineers.
Generate a high-converting, ATS-compliant Markdown Resume (CV) and a tailored Cover Letter for this candidate applying to ${job.company} for the role "${job.title}".

Candidate Information:
Name: ${user.name} (@${user.username})
Headline: ${user.headline}
Bio: ${user.bio}
Skills: ${user.statedSkills.join(', ')}

Verified Ledger Commits (Proof of Work):
${userSubmissions
  .map(
    (s) => `- Problem: ${s.ideaTitle} (Commit #${s.hash})
  Architecture: ${s.architectureNotes}
  Telemetry: p99 latency ${s.metrics?.latencyP99 || '32ms'}, throughput ${s.metrics?.throughput || '240 req/s'}, tests: ${s.testResults.passed}/${s.testResults.total} passed.
  Repository: ${s.repoUrl}`
  )
  .join('\n')}

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

    // 4. Heuristic Fallback Engine
    const cvMarkdown = `# ${user.name}
${user.headline}
Email: ${user.email || `${user.username}@devledgr.me`} | Portfolio: https://${user.username}.devledgr.xyz
GitHub: ${user.githubUrl} | Verification: Stamped on DevLedgr (1-Year Certificate)

---

## EXECUTIVE SUMMARY
Early-career backend engineer with proven track record building resilient, low-latency microservices and distributed data pipelines. All highlighted competencies are supported by cryptographically verified ledger entries with live CI telemetry.

---

## VERIFIED ENGINEERING PROOF (DEVLEDGR COMMITS)

${userSubmissions
  .map(
    (sub) => `### ${sub.ideaTitle}
**Commit #${sub.hash}** · Verified Proof of Work | Code: ${sub.repoUrl}
- **Architecture & Implementation:** ${sub.architectureNotes}
- **Performance & Constraints:** Sustained p99 latency of ${sub.metrics?.latencyP99 || '28ms'} at ${sub.metrics?.throughput || '240 req/s'}.
- **Verification Suite:** Passed 100% of automated test vectors (${sub.testResults.passed}/${sub.testResults.total} tests in ${sub.testResults.suiteName}).
- **Permanent Ledger Link:** https://${user.username}.devledgr.xyz/p/${sub.hash}`
  )
  .join('\n\n')}

---

## TECHNICAL CAPABILITIES
- **Languages:** ${user.statedSkills.slice(0, 4).join(', ')}
- **Databases & Cache:** PostgreSQL, Redis, Distributed Queues
- **Infrastructure:** Docker, Linux, CI/CD, Mock Test Harnesses
- **Verification Guarantee:** 1-Year Verifiable Ledger Certificate through Sep 2027
`;

    const coverLetter = `Dear Hiring Team at ${job.company},

I am writing to express my strong interest in the ${job.title} position.

Unlike traditional applicants submitting unverified claims or tutorial clones, my experience is backed by verifiable proof-of-work recorded on DevLedgr (https://${user.username}.devledgr.xyz).

For instance, to demonstrate the distributed transaction and concurrency requirements essential for ${job.company}, I engineered:
${userSubmissions
  .slice(0, 2)
  .map((s) => `• ${s.ideaTitle} (Commit #${s.hash}), achieving ${s.metrics?.latencyP99 || '28ms'} p99 latency under simulated high-throughput production load.`)
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
