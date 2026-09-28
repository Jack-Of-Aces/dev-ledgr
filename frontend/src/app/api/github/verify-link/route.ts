/**
 * @file route.ts
 * @description Next.js Route Handler for strict GitHub account ownership verification.
 * Enforces that a candidate linking a GitHub account must own it by verifying that
 * their registered DevLedgr email matches the GitHub profile email or public commit author emails.
 */

import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limiter';

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

export async function POST(req: Request) {
  // Rate limit: 20 verifications per minute per IP
  const rl = checkRateLimit(req, 'github-verify-link', { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        valid: false,
        error: `Rate limit exceeded. Please wait ${rl.resetInSeconds} seconds before trying again.`,
      },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const rawUsername = body.username?.trim();
    const rawEmail = body.userEmail?.trim()?.toLowerCase();

    if (!rawUsername) {
      return NextResponse.json(
        { valid: false, error: 'GitHub username is required.' },
        { status: 400 }
      );
    }

    if (!rawEmail) {
      return NextResponse.json(
        { valid: false, error: 'Registered user email is required for identity verification.' },
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
    const userRes = await fetch(`https://api.github.com/users/${cleanUsername}`, {
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
    if (userData.email && userData.email.toLowerCase() === rawEmail) {
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
      `https://api.github.com/users/${cleanUsername}/repos?sort=pushed&per_page=6`,
      { headers, next: { revalidate: 60 } }
    );

    const foundEmails = new Set<string>();
    let matchingRepo: string | null = null;

    if (reposRes.ok) {
      const repos = (await reposRes.json()) as GitHubRepoResponse[];

      for (const repo of repos) {
        try {
          const commitsRes = await fetch(
            `https://api.github.com/repos/${cleanUsername}/${repo.name}/commits?per_page=6`,
            { headers, next: { revalidate: 60 } }
          );

          if (commitsRes.ok) {
            const commits = (await commitsRes.json()) as GitHubCommitResponse[];
            if (Array.isArray(commits)) {
              for (const c of commits) {
                const authorEmail = c.commit?.author?.email?.toLowerCase();
                const committerEmail = c.commit?.committer?.email?.toLowerCase();

                if (authorEmail) foundEmails.add(authorEmail);
                if (committerEmail) foundEmails.add(committerEmail);

                if (authorEmail === rawEmail || committerEmail === rawEmail) {
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

    // 4. Check if matched via commit signatures
    if (matchingRepo) {
      return NextResponse.json({
        valid: true,
        matched: true,
        matchSource: 'commit-author',
        matchedEmail: rawEmail,
        repoProof: matchingRepo,
        githubUsername: userData.login,
        name: userData.name || userData.login,
        avatarUrl: userData.avatar_url,
      });
    }

    // 5. Check standard GitHub noreply emails
    const expectedNoreply1 = `${userData.id}+${userData.login.toLowerCase()}@users.noreply.github.com`;
    const expectedNoreply2 = `${userData.login.toLowerCase()}@users.noreply.github.com`;

    if (rawEmail === expectedNoreply1 || rawEmail === expectedNoreply2) {
      return NextResponse.json({
        valid: true,
        matched: true,
        matchSource: 'noreply-email',
        matchedEmail: rawEmail,
        githubUsername: userData.login,
        name: userData.name || userData.login,
        avatarUrl: userData.avatar_url,
      });
    }

    // 6. Email mismatch rejection
    return NextResponse.json(
      {
        valid: false,
        matched: false,
        error: `Identity verification failed: The registered email (${rawEmail}) does not match the email associated with GitHub account @${userData.login}. You can only link a GitHub account that belongs to you.`,
        details: {
          checkedUsername: userData.login,
          registeredEmail: rawEmail,
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
