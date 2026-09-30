/**
 * @file route.ts
 * @description Next.js Route Handler for strict GitHub account ownership verification.
 * Enforces that a candidate linking a GitHub account must own it by verifying that
 * their registered DevLedgr email matches the GitHub profile email or public commit author emails.
 *
 * The registered address is read from the authenticated session, never the body.
 */

import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limiter';
import { resolveRegisteredEmail } from '@/lib/server-session';

interface GitHubUserResponse {
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  id: number;
}

interface GitHubRepoResponse {
  name: string;
  full_name: string;
}

interface GitHubCommitResponse {
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer?: {
      email: string;
    };
  };
}

/**
 * How many repositories one verification may dig through.
 *
 * Each repo costs a further commit listing against a single shared GitHub hourly
 * quota (60 requests/hour unless GITHUB_TOKEN is set), and the loop used to walk
 * all 6 repos it had fetched. Capping the walk at 3 bounds one call at 5 GitHub
 * requests and stops a link-verification button from being a way to exhaust the
 * quota the rest of the app depends on.
 */
const MAX_REPOS_INSPECTED = 3;

/** GitHub's own guidance for a verification scan is the most recently pushed work. */
const COMMITS_PER_REPO = 5;

export async function POST(req: Request) {
  // Rate limit: 10 verifications per minute per IP. Tighter than the 20 it used
  // to allow, because one call is several upstream GitHub requests.
  const rl = checkRateLimit(req, 'github-verify-link', { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        valid: false,
        error: `Rate limit exceeded. Please wait ${rl.resetInSeconds} seconds before trying again.`,
      },
      { status: 429 }
    );
  }

  // Identity. The address used to come from body.userEmail, which made this an
  // oracle: call it with any handle and any address and it would answer whether
  // that address appears anywhere on that account. The registered address now
  // comes from the session, so a caller can only ever be checked against their
  // own identity.
  const identity = await resolveRegisteredEmail(req);
  if (!identity.ok) {
    return NextResponse.json(
      { valid: false, error: identity.error, code: identity.code },
      { status: identity.status }
    );
  }
  const registeredEmail = identity.email;

  try {
    const body = await req.json();
    const rawUsername = body.username?.trim();

    if (!rawUsername) {
      return NextResponse.json(
        { valid: false, error: 'GitHub username is required.' },
        { status: 400 }
      );
    }

    const cleanUsername = rawUsername.replace(/^@/, '').trim();

    // Headers for GitHub API
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'DevLedgr-Identity-Verification-Engine/1.0',
    };

    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    // 1. Fetch GitHub User profile
    const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}`, {
      headers,
      next: { revalidate: 30 },
    });

    if (userRes.status === 404) {
      return NextResponse.json(
        {
          valid: false,
          error: `GitHub user @${cleanUsername} does not exist. Please check the spelling.`,
        },
        { status: 404 }
      );
    }

    if (userRes.status === 403 || userRes.status === 429) {
      return NextResponse.json(
        {
          valid: false,
          error:
            'GitHub API rate limit reached, so this account could not be verified. Wait a moment and try again, or add a GITHUB_TOKEN to raise the limit.',
        },
        { status: 429 }
      );
    }

    if (!userRes.ok) {
      return NextResponse.json(
        {
          valid: false,
          error: `GitHub API temporarily unavailable (HTTP ${userRes.status}). Please try again shortly.`,
        },
        { status: 502 }
      );
    }

    const userData = (await userRes.json()) as GitHubUserResponse;

    // 2. Direct Profile Email Match
    if (userData.email && userData.email.toLowerCase() === registeredEmail) {
      return NextResponse.json({
        valid: true,
        matched: true,
        matchSource: 'public-profile',
        matchedEmail: userData.email,
        githubUsername: userData.login,
        name: userData.name || userData.login,
        avatarUrl: userData.avatar_url,
      });
    }

    // 3. Inspect Recent Public Repositories & Commit Author Emails
    const reposRes = await fetch(
      `https://api.github.com/users/${encodeURIComponent(
        cleanUsername
      )}/repos?sort=pushed&per_page=${MAX_REPOS_INSPECTED}`,
      { headers, next: { revalidate: 60 } }
    );

    let matchingRepo: string | null = null;
    let inspected = 0;
    let upstreamRateLimited = false;

    if (reposRes.status === 403 || reposRes.status === 429) {
      // Stop before spending the rest of this call's budget on a quota that is
      // already gone. Falling through to "no match" would report a confident
      // "that is not your account" for an answer GitHub never gave.
      upstreamRateLimited = true;
    } else if (reposRes.ok) {
      const repos = (await reposRes.json()) as GitHubRepoResponse[];

      for (const repo of Array.isArray(repos) ? repos : []) {
        if (inspected >= MAX_REPOS_INSPECTED) break;
        inspected += 1;

        try {
          const commitsRes = await fetch(
            `https://api.github.com/repos/${encodeURIComponent(
              cleanUsername
            )}/${encodeURIComponent(repo.name)}/commits?per_page=${COMMITS_PER_REPO}`,
            { headers, next: { revalidate: 60 } }
          );

          if (commitsRes.status === 403 || commitsRes.status === 429) {
            upstreamRateLimited = true;
            break;
          }

          if (commitsRes.ok) {
            const commits = (await commitsRes.json()) as GitHubCommitResponse[];
            if (Array.isArray(commits)) {
              for (const c of commits) {
                const authorEmail = c.commit?.author?.email?.toLowerCase();
                const committerEmail = c.commit?.committer?.email?.toLowerCase();

                if (authorEmail === registeredEmail || committerEmail === registeredEmail) {
                  matchingRepo = repo.name;
                  break;
                }
              }
            }
          }
        } catch {
          // Continue inspecting next repo
        }

        if (matchingRepo) break;
      }
    }

    if (upstreamRateLimited) {
      return NextResponse.json(
        {
          valid: false,
          error:
            'GitHub API rate limit reached part-way through verification, so this account could not be checked. Wait a moment and try again, or add a GITHUB_TOKEN to raise the limit.',
        },
        { status: 429 }
      );
    }

    // 4. Check if matched via commit signatures
    if (matchingRepo) {
      return NextResponse.json({
        valid: true,
        matched: true,
        matchSource: 'commit-author',
        matchedEmail: registeredEmail,
        repoProof: matchingRepo,
        githubUsername: userData.login,
        name: userData.name || userData.login,
        avatarUrl: userData.avatar_url,
        // Surfaced so a partial scan is visible rather than looking complete:
        // "no match in the first 3 repos" is a weaker statement than "no match
        // anywhere", and the UI says so.
        reposInspected: inspected,
      });
    }

    // 5. Check standard GitHub noreply emails
    const expectedNoreply1 = `${userData.id}+${userData.login.toLowerCase()}@users.noreply.github.com`;
    const expectedNoreply2 = `${userData.login.toLowerCase()}@users.noreply.github.com`;

    if (registeredEmail === expectedNoreply1 || registeredEmail === expectedNoreply2) {
      return NextResponse.json({
        valid: true,
        matched: true,
        matchSource: 'noreply-email',
        matchedEmail: registeredEmail,
        githubUsername: userData.login,
        name: userData.name || userData.login,
        avatarUrl: userData.avatar_url,
      });
    }

    // 6. Email mismatch rejection
    //
    // The registered address is not echoed back. It is the caller's own, so
    // echoing it is not a disclosure to them, but the response used to quote it
    // into an error string and a `details` object that any layer between here
    // and the browser could log.
    return NextResponse.json(
      {
        valid: false,
        matched: false,
        error: `Identity verification failed: the email registered to this account does not match the email associated with GitHub account @${userData.login}. You can only link a GitHub account that belongs to you.`,
        details: {
          checkedUsername: userData.login,
          reposInspected: inspected,
        },
      },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json(
      {
        valid: false,
        error: `Failed to verify GitHub ownership: ${message}`,
      },
      { status: 500 }
    );
  }
}
