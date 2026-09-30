/**
 * @file route.ts
 * @description API route to handle resume file upload parsing (PDF, DOCX, TXT/MD),
 * ATS compliance auditing, and tailored CV curation via AI Mesh.
 *
 * Every number this route returns is either produced by a model that was given
 * the CV, or counted by the rule-based scorer below. It never invents one.
 */

import { NextResponse } from 'next/server';
import { runAIMesh } from '@/lib/ai-mesh';
import { checkRateLimit } from '@/lib/rate-limiter';
import { resolveProviderKey } from '@/lib/provider-key';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * The modal caps document selection at 5MB, so the route caps the request at
 * 5MB plus the multipart envelope. `await req.formData()` materialises the whole
 * body in memory before a single field is inspected, so an unbounded reader here
 * is an unbounded allocation driven by whoever is calling.
 */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /\+?\d[\d\s().-]{7,}\d/;
const PROFILE_RE = /(?:github\.com|linkedin\.com|gitlab\.com)\/\S+/i;
const QUANTIFIED_RE =
  /\d+(?:\.\d+)?\s*(?:%|x\b|ms\b|k\b|m\b|req\/s|users|customers|hours|days)|\$\s?\d/;

const SECTION_CHECKS: { name: string; re: RegExp }[] = [
  {
    name: 'Experience',
    re: /^\s*(?:work\s+)?(?:experience|employment|work history|professional experience)\b/im,
  },
  { name: 'Education', re: /^\s*(?:education|academic)\b/im },
  { name: 'Skills', re: /^\s*(?:technical\s+)?skills\b/im },
  { name: 'Projects', re: /^\s*(?:projects|personal projects|open source)\b/im },
];

/**
 * Whole-term containment, mirroring backend/internal/skills.InText so both
 * sides of the platform agree on what counts as "the CV mentions this skill".
 */
function termInText(haystack: string, term: string): boolean {
  const needle = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9+#])${needle}($|[^a-z0-9+#])`, 'i').test(haystack);
}

/**
 * The vocabulary the ATS keyword check runs against.
 *
 * The keywords a CV is measured on have to be named by the *role*, not chosen
 * after the fact to flatter the CV, so this is a fixed list and the subset that
 * applies is picked by what the target role text actually mentions.
 */
const ATS_KEYWORD_VOCABULARY = [
  'Go',
  'TypeScript',
  'JavaScript',
  'Python',
  'Java',
  'Rust',
  'Node',
  'React',
  'PostgreSQL',
  'MySQL',
  'Redis',
  'Kafka',
  'RabbitMQ',
  'gRPC',
  'REST',
  'GraphQL',
  'Docker',
  'Kubernetes',
  'Terraform',
  'AWS',
  'GCP',
  'CI/CD',
  'Linux',
  'Microservices',
  'Distributed Systems',
  'Concurrency',
  'Observability',
  'Prometheus',
  'Grafana',
  'Testing',
  'Security',
  'OAuth',
  'TLS',
];

interface HeuristicAudit {
  score: number;
  summary: string;
  breakdown: { category: string; score: number; notes: string }[];
  recommendations: {
    category: string;
    priority: 'high' | 'medium' | 'low';
    issue: string;
    suggestion: string;
  }[];
  matchedKeywords: string[];
  missingKeywords: string[];
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Deterministic, transparent ATS scorer.
 *
 * This is the port of heuristicATS in backend/internal/ai/ats.go, kept in step
 * with it deliberately: the same weights, the same regexes, the same summary
 * wording. It replaced a hardcoded `score: 82` with a flattering three-line
 * breakdown and a matched-keyword list naming Go, TypeScript, PostgreSQL and
 * REST APIs for a CV that had never been read. That response rendered under a
 * green "AI Tailoring Engine" badge, so every failure mode of the mesh — no key,
 * all providers down, unparseable JSON — produced a confident pass for an
 * arbitrary resume.
 *
 * Every score here is a count of something observable in the text, and every
 * recommendation is triggered by a rule that fired. The weights sum to 100, so
 * the overall figure is a weighted mean of the five sub-scores.
 */
function heuristicATSAudit(cvText: string, targetText: string): HeuristicAudit {
  const text = cvText;
  const words = text.trim().split(/\s+/).filter(Boolean).length;

  const breakdown: HeuristicAudit['breakdown'] = [];
  const recommendations: HeuristicAudit['recommendations'] = [];
  const add = (category: string, score: number, notes: string) =>
    breakdown.push({ category, score: clamp(score), notes });
  const rec = (
    category: string,
    priority: 'high' | 'medium' | 'low',
    issue: string,
    suggestion: string
  ) => recommendations.push({ category, priority, issue, suggestion });

  // Contact details (weight 10).
  let contact = 0;
  if (EMAIL_RE.test(text)) contact += 50;
  else rec('contact', 'high', 'No email address was found.', 'Add a professional email address in the header, as plain text.');
  if (PHONE_RE.test(text)) contact += 25;
  else rec('contact', 'medium', 'No phone number was found.', 'Add a phone number with country code in the header.');
  if (PROFILE_RE.test(text)) contact += 25;
  else rec('contact', 'medium', 'No GitHub or LinkedIn link was found.', 'Add your GitHub and DevLedgr portfolio URLs so reviewers can verify your work.');
  add('contact', contact, 'Email, phone and profile links');

  // Standard sections (weight 25).
  let found = 0;
  for (const section of SECTION_CHECKS) {
    if (section.re.test(text)) found += 1;
    else
      rec(
        'formatting',
        'high',
        `No "${section.name}" section heading was detected.`,
        `Add a plain-text heading named "${section.name}" on its own line; ATS parsers map content by standard headings.`
      );
  }
  add('formatting', found * 25, `${found} of ${SECTION_CHECKS.length} standard sections detected`);

  // Keyword coverage (weight 30), measured against the target role.
  const targetKeywords = ATS_KEYWORD_VOCABULARY.filter((k) => termInText(targetText, k));
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];
  for (const keyword of targetKeywords) {
    if (termInText(text, keyword)) matchedKeywords.push(keyword);
    else missingKeywords.push(keyword);
  }
  let keywords = 60;
  if (targetKeywords.length > 0) {
    keywords = Math.round((matchedKeywords.length / targetKeywords.length) * 100);
    if (missingKeywords.length > 0) {
      rec(
        'keywords',
        'high',
        `Keywords expected for the target role are missing: ${missingKeywords.slice(0, 8).join(', ')}.`,
        'Where you genuinely have the skill, name it explicitly in your skills section and in the bullet that proves it.'
      );
    }
  }
  add('keywords', keywords, `${matchedKeywords.length} of ${targetKeywords.length} target keywords present`);

  // Quantified achievements (weight 20).
  const quantified = (text.match(new RegExp(QUANTIFIED_RE.source, 'gi')) || []).length;
  add('achievements', quantified * 20, `${quantified} quantified results found`);
  if (quantified < 5) {
    rec(
      'achievements',
      'high',
      `Only ${quantified} quantified results were found.`,
      'Rewrite bullets as action + result with numbers, e.g. p99 latency, throughput, test coverage or users served.'
    );
  }

  // Length and readability (weight 15).
  let readability = 100;
  if (words < 250) {
    readability = 40;
    rec('readability', 'medium', `The CV is short (${words} words).`, 'Aim for 400-900 words: describe what you built, how, and the measured outcome.');
  } else if (words > 1200) {
    readability = 50;
    rec('readability', 'medium', `The CV is long (${words} words).`, 'Trim to one or two pages; keep the most relevant, recent and quantified work.');
  }
  const pipeCount = (text.match(/\|/g) || []).length;
  const tabCount = (text.match(/\t/g) || []).length;
  if (pipeCount > 10 || tabCount > 20) {
    readability -= 30;
    rec(
      'formatting',
      'high',
      'The text looks like it came from tables or multi-column layout.',
      'Use a single-column layout without tables or text boxes; many ATS parsers scramble them.'
    );
  }
  add('readability', readability, `${words} words`);

  // Weights: contact 10, sections 25, keywords 30, achievements 20, readability 15.
  const score = clamp(
    (contact * 10 +
      found * 25 * 25 +
      keywords * 30 +
      clamp(quantified * 20) * 20 +
      clamp(readability) * 15) /
      100
  );

  const rank = { high: 0, medium: 1, low: 2 } as const;
  recommendations.sort((a, b) => rank[a.priority] - rank[b.priority]);

  return {
    score,
    summary:
      `Rule-based ATS check of the text that was actually parsed: ${score}/100. ` +
      'No AI model produced this figure, so no wording or intent was judged — the sub-scores below are counts of ' +
      'contact details, standard section headings, target keywords, quantified results and length.',
    breakdown,
    recommendations,
    matchedKeywords: matchedKeywords.slice(0, 50),
    missingKeywords: missingKeywords.slice(0, 50),
  };
}

export async function POST(req: Request) {
  const rl = checkRateLimit(req, 'cv-audit-parse', { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rl.resetInSeconds}s.` },
      { status: 429 }
    );
  }

  try {
    // Reject an oversized body before anything is buffered. Content-Length is
    // client-supplied, so this is a cheap first pass; the post-read check below
    // is the one that actually holds.
    const declaredLength = Number(req.headers.get('content-length') || '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
      return NextResponse.json(
        {
          error: `Upload is too large. The maximum document size is ${Math.floor(
            MAX_UPLOAD_BYTES / (1024 * 1024)
          )}MB.`,
        },
        { status: 413 }
      );
    }

    const contentType = req.headers.get('content-type') || '';
    let cvText = '';
    let targetJobTitle = 'Software Engineer';
    let targetCompany = 'Target Company';
    let targetJobDescription = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const rawText = formData.get('cvText') as string | null;
      targetJobTitle = (formData.get('jobTitle') as string) || targetJobTitle;
      targetCompany = (formData.get('company') as string) || targetCompany;
      targetJobDescription = (formData.get('jobDescription') as string) || targetJobDescription;

      if (file) {
        // formData() has already materialised the body, so the size has to be
        // checked here as well as on the declared length above.
        if (file.size > MAX_UPLOAD_BYTES) {
          return NextResponse.json(
            {
              error: `Upload is too large. The maximum document size is ${Math.floor(
                MAX_UPLOAD_BYTES / (1024 * 1024)
              )}MB.`,
            },
            { status: 413 }
          );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.pdf')) {
          try {
            const parser = new PDFParse({ data: buffer });
            const parsed = await parser.getText();
            cvText = parsed?.text?.trim() || '';

            // If parser returns empty string (e.g. scanned image-only PDF), attempt regex extraction fallback
            if (!cvText) {
              const rawStr = buffer.toString('binary');
              const textMatches = rawStr.match(/\(([^)]+)\)\s*T[jJ]/g);
              if (textMatches && textMatches.length > 0) {
                cvText = textMatches.map((m) => m.replace(/^\(/, '').replace(/\)\s*T[jJ]$/, '')).join(' ');
              }
            }
          } catch (pdfErr) {
            console.warn('[Audit CV Route] PDF text extraction notice:', pdfErr);
            // Fallback raw stream extract
            const rawStr = buffer.toString('binary');
            const textMatches = rawStr.match(/\(([^)]+)\)\s*T[jJ]/g);
            if (textMatches && textMatches.length > 0) {
              cvText = textMatches.map((m) => m.replace(/^\(/, '').replace(/\)\s*T[jJ]$/, '')).join(' ');
            }
          }

          if (!cvText || cvText.length < 20) {
            return NextResponse.json(
              {
                error:
                  'Could not extract text from this PDF file. It may be a scanned image-only PDF or password protected. Please copy and paste your resume text directly into the box.',
              },
              { status: 400 }
            );
          }
        } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
          try {
            const parsed = await mammoth.extractRawText({ buffer });
            cvText = parsed.value || '';
          } catch {
            return NextResponse.json(
              { error: 'Failed to extract text from Word document.' },
              { status: 400 }
            );
          }
        } else {
          cvText = buffer.toString('utf-8');
        }
      } else if (rawText) {
        cvText = rawText;
      }
    } else {
      const body = await req.json();
      cvText = body.cvText || '';
      targetJobTitle = body.jobTitle || targetJobTitle;
      targetCompany = body.company || targetCompany;
      targetJobDescription = body.jobDescription || targetJobDescription;
    }

    cvText = cvText.trim();
    if (cvText.length < 30) {
      return NextResponse.json(
        { error: 'CV content is empty or contains insufficient text (minimum 30 characters).' },
        { status: 400 }
      );
    }

    const targetText = `${targetJobTitle} ${targetCompany} ${targetJobDescription}`;

    const promptText = `You are a Principal Talent Acquisition Lead & ATS Compliance Officer for Top Tech Companies.
Analyze this developer resume against the target role (${targetJobTitle} at ${targetCompany}).

Target Job Description (if provided):
${targetJobDescription || 'Standard high-concurrency Backend / Distributed Systems Engineer requirements.'}

Candidate Raw Resume Text:
"""
${cvText.slice(0, 12000)}
"""

Tasks:
1. Score the resume (0-100) for ATS compatibility and alignment.
2. Provide a brief overall assessment summary (2-3 sentences).
3. Provide breakdown scores (0-100) and brief notes for:
   - "Technical Keywords"
   - "Quantified Impact & Metrics"
   - "Formatting & ATS Structure"
4. Identify 4-8 matched technical keywords found in the resume.
5. Identify 3-6 critical missing keywords or skills recommended for this role.
6. Provide 2-4 prioritized actionable suggestions to increase recruiter conversion.
7. CURATE A FULLY REFINED, ATS-OPTIMIZED MARKDOWN RESUME ("curatedCvMarkdown") based on the candidate's experience. Standardize headers (SUMMARY, VERIFIED EXPERIENCE, TECHNICAL SKILLS, EDUCATION) and replace weak verbs with high-impact action verbs.

Report only what the resume text above actually contains. The prompt used to
instruct the model to "add placeholder metrics if missing", which is a request
to write numbers nobody measured into a document that goes to a recruiter. Do
not add placeholder metrics, and do not state a figure, employer or outcome the
text does not give you. Where something is missing, leave it out and say so in
the recommendations instead.

Output format MUST be strict JSON:
{
  "score": 85,
  "summary": "...",
  "breakdown": [
    { "category": "Technical Keywords", "score": 88, "notes": "..." },
    { "category": "Quantified Impact & Metrics", "score": 75, "notes": "..." },
    { "category": "Formatting & ATS Structure", "score": 90, "notes": "..." }
  ],
  "matchedKeywords": ["Go", "PostgreSQL", "REST APIs"],
  "missingKeywords": ["Docker", "Kubernetes", "Redis"],
  "recommendations": [
    { "category": "Metrics", "priority": "high", "issue": "...", "suggestion": "..." }
  ],
  "curatedCvMarkdown": "# Full Refined Markdown Resume..."
}`;

    const systemInstruction =
      'You are an ATS CV parser and editor. Output valid JSON only matching the exact specified schema.';

    const meshResult = await runAIMesh({
      prompt: promptText,
      systemInstruction,
      jsonMode: true,
      // The caller's own BYOK key. Without this, a BYOK user's resume was
      // billed to the server's provider key — a cost, and a privacy problem
      // too, because their text went to a provider they did not choose.
      userApiKey: await resolveProviderKey(req),
      temperature: 0.2,
      maxTokens: 3000,
    });

    if (meshResult.text) {
      try {
        const cleaned = meshResult.text.replace(/```json\s*|\s*```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        // A missing or non-numeric score is not "close enough to 80". Defaulting
        // put a number on the score banner that no model produced, so an
        // incomplete response is treated as a failure and the rule-based scorer
        // below runs instead.
        if (typeof parsed.score === 'number' && Number.isFinite(parsed.score)) {
          return NextResponse.json({
            id: `audit_${Date.now()}`,
            score: clamp(parsed.score),
            summary:
              typeof parsed.summary === 'string' && parsed.summary
                ? parsed.summary
                : 'Audit completed; the model returned no summary text.',
            breakdown: Array.isArray(parsed.breakdown) ? parsed.breakdown : [],
            matchedKeywords: Array.isArray(parsed.matchedKeywords) ? parsed.matchedKeywords : [],
            missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [],
            recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
            curatedCvMarkdown: parsed.curatedCvMarkdown || '',
            // The provider that actually answered. This was the literal string
            // 'claude' on a mesh that only speaks to Gemini and Groq, so the
            // badge named an engine that never ran. The CVAudit type still says
            // 'claude' | 'heuristic'; widening it lives outside this route.
            engine: meshResult.provider,
            model: meshResult.model,
            cvChars: cvText.length,
            createdAt: new Date().toISOString(),
          });
        }
        console.warn('[CV Audit Route] Model output had no usable score; using the rule-based scorer.');
      } catch (jsonErr) {
        console.warn('[CV Audit Route] JSON parse failed, using the rule-based scorer:', jsonErr);
      }
    }

    // No model answered, or none of them answered with a score. Score the text
    // that was actually extracted, with rules that can be checked by reading
    // them, and say plainly in the response that this is what happened.
    const heuristic = heuristicATSAudit(cvText, targetText);
    return NextResponse.json({
      id: `audit_${Date.now()}`,
      ...heuristic,
      // No curatedCvMarkdown: a rule-based scorer cannot rewrite prose, and the
      // "AI-Curated Resume" tab would otherwise be claiming a rewrite that never
      // happened. This path used to echo the source text back under a
      // "*Curated by DevLedgr ATS Intelligence engine*" footer. The modal
      // renders an explicit empty state instead.
      curatedCvMarkdown: '',
      engine: 'heuristic',
      model: 'heuristic-rules-v1',
      cvChars: cvText.length,
      createdAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error processing CV audit.' },
      { status: 500 }
    );
  }
}
