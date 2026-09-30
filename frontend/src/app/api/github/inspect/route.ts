/**
 * @file route.ts
 * @description Next.js Route Handler for live GitHub repository inspection and verification.
 * Verifies public availability, extracts latest commit SHA, language distribution, and metadata.
 */

import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limiter';

interface GitHubRepoResponse {
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  default_branch: string;
  private: boolean;
  html_url: string;
}

interface GitHubCommitResponse {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
}

export async function POST(req: Request) {
  // Sliding Window Rate Limiting (30 requests per minute per IP)
  const rl = checkRateLimit(req, 'github-inspect', { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        valid: false,
        error: `Rate limit exceeded. Please wait ${rl.resetInSeconds} seconds before re-inspecting repositories.`,
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
    const body = await req.json();
    const repoUrl = body.repoUrl?.trim();

    if (!repoUrl) {
      return NextResponse.json(
        { valid: false, error: 'Repository URL is required.' },
        { status: 400 }
      );
    }

    // Match patterns:
    // https://github.com/owner/repo or github.com/owner/repo or owner/repo
    const match = repoUrl.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)/) ||
                  repoUrl.match(/^([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)$/);

    if (!match) {
      return NextResponse.json(
        { valid: false, error: 'Invalid GitHub repository URL format. Expected: https://github.com/owner/repo' },
        { status: 400 }
      );
    }

    const owner = match[1];
    const repo = match[2].replace(/\.git$/, '');

    // Headers for GitHub API (optionally with token for higher rate limits)
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'DevLedgr-Verification-Engine/1.0',
    };

    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    // 1. Fetch Repo Metadata
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers,
      next: { revalidate: 60 },
    });

    // Note on the status codes below. 404 and "private" answer 200 with
    // valid:false on purpose: SubmitSolutionModal branches on data.valid and
    // never reads res.status, so a non-2xx here surfaces as "failed to connect
    // to the inspection service" instead of the actionable message. The
    // rate-limit case does use 429, because that is worth a distinct status.

    if (repoRes.status === 404) {
      return NextResponse.json({
        valid: false,
        error: `Repository '${owner}/${repo}' was not found. Please ensure the repository is public.`,
      });
    }

    if (repoRes.status === 403 || repoRes.status === 429) {
      // Rate limited. This used to answer with a fabricated commit SHA, 12
      // stars, a "Go 92.4%" language split and a message reading "chore:
      // production verification release", all marked valid: true. The modal
      // rendered that SHA under a green "Public Repository Verified" banner
      // and fingerprinted the submission against it, so a dev whose repo was
      // never fetched got a proof citing a commit that does not exist.
      //
      // Failing closed is the only honest option: a proof that cannot be
      // checked is not yet a proof, and the dev can retry.
      return NextResponse.json(
        {
          valid: false,
          error:
            'GitHub API rate limit reached, so this repository could not be inspected. Wait a moment and try again, or add a GITHUB_TOKEN to raise the limit.',
        },
        { status: 429 }
      );
    }

    if (!repoRes.ok) {
      return NextResponse.json(
        { valid: false, error: `GitHub API error: ${repoRes.statusText}` },
        { status: repoRes.status }
      );
    }

    const repoData: GitHubRepoResponse = await repoRes.json();

    if (repoData.private) {
      return NextResponse.json({
        valid: false,
        error: 'Repository is private. DevLedgr proofs require publicly inspectable code.',
      });
    }

    // 2. Fetch Latest Commit
    type CommitInfo = {
      sha: string | null;
      shortSha: string | null;
      message: string | null;
      author: string | null;
      date: string | null;
    };
    let latestCommit: CommitInfo = {
      // Stays null if the commit listing fails below. It used to default to
      // the invented sha "a3f9d21" / "Initial verified implementation", so a
      // failed commit lookup silently became a plausible-looking commit.
      sha: null,
      shortSha: null,
      message: null,
      author: null,
      date: null,
    };

    try {
      const commitRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
        { headers, next: { revalidate: 30 } }
      );

      if (commitRes.ok) {
        const commitData: GitHubCommitResponse[] = await commitRes.json();
        if (commitData && commitData.length > 0) {
          const c = commitData[0];
          latestCommit = {
            sha: c.sha,
            shortSha: c.sha.slice(0, 7),
            message: c.commit.message.split('\n')[0],
            author: c.commit.author.name,
            date: c.commit.author.date,
          };
        }
      }
    } catch {
      // Fallback to repo default if commit listing fails
    }

    // 3. Fetch Language Stats
    const languages: { name: string; percentage: number }[] = [];
    try {
      const langRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/languages`,
        { headers, next: { revalidate: 120 } }
      );

      if (langRes.ok) {
        const langData: Record<string, number> = await langRes.json();
        const totalBytes = Object.values(langData).reduce((a, b) => a + b, 0);

        if (totalBytes > 0) {
          for (const [lang, bytes] of Object.entries(langData)) {
            const pct = Math.round((bytes / totalBytes) * 1000) / 10;
            if (pct >= 1.0) {
              languages.push({ name: lang, percentage: pct });
            }
          }
        }
      }
    } catch {
      // Non-critical, continue without detailed language breakdown
    }

    // An empty breakdown is the honest answer when /languages could not be
    // read. This used to push { name: 'Source Code', percentage: 100 }, so a
    // failed call — or a repository GitHub reports as having no detected
    // languages — rendered as a confident "Stack: Source Code 100%" on the
    // submission modal, which reads as a language split the platform never
    // obtained. The modal only draws the stack line when the list is non-empty,
    // so an empty array shows nothing instead of something false.

    return NextResponse.json({
      valid: true,
      owner,
      repo,
      fullName: repoData.full_name,
      description: repoData.description,
      stars: repoData.stargazers_count,
      defaultBranch: repoData.default_branch,
      latestCommit,
      languages,
    });
  } catch {
    return NextResponse.json(
      { valid: false, error: 'Internal server error while inspecting repository.' },
      { status: 500 }
    );
  }
}
