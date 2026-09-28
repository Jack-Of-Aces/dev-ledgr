import { NextResponse } from 'next/server';
import { inferTrackFromRepoData, ENGINEERING_TRACKS, getTrackById } from '@/lib/tracks';
import { EngineeringTrack } from '@/types';

interface GitHubRepoItem {
  name: string;
  language: string | null;
  description: string | null;
  fork: boolean;
  topics?: string[];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawUsername = body.username as string | undefined;
    const cleanUsername = rawUsername
      ? rawUsername.replace(/^@/, '').replace(/https?:\/\/github\.com\//, '').replace(/\/.*$/, '').trim()
      : '';

    if (!cleanUsername) {
      // Default recommendation when no username provided
      return NextResponse.json({
        success: true,
        inferredTrack: 'backend-systems',
        track: ENGINEERING_TRACKS['backend-systems'],
        confidence: 0.5,
        rationale: 'Choose your primary engineering track to customize your problem feed and recruiter matching.',
        topLanguages: [],
        detectedKeywords: [],
      });
    }

    let languages: string[] = [];
    let repoNames: string[] = [];
    let bio = '';

    // Fetch user public repos from GitHub API
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'DevLedgr-Track-Inferrer/2.0',
      };
      if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
      }

      const [userRes, reposRes] = await Promise.all([
        fetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}`, {
          headers,
          next: { revalidate: 3600 },
        }),
        fetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}/repos?sort=updated&per_page=15`, {
          headers,
          next: { revalidate: 3600 },
        }),
      ]);

      if (userRes.ok) {
        const userData = await userRes.json();
        bio = userData.bio || '';
      }

      if (reposRes.ok) {
        const reposData: GitHubRepoItem[] = await reposRes.json();
        const nonForks = reposData.filter((r) => !r.fork);
        const targetRepos = nonForks.length > 0 ? nonForks : reposData;

        repoNames = targetRepos.map((r) => r.name);
        languages = Array.from(
          new Set(
            targetRepos
              .map((r) => r.language)
              .filter((l): l is string => Boolean(l))
          )
        );

        // Include topics and descriptions into repoNames for semantic keyword search
        targetRepos.forEach((r) => {
          if (r.description) repoNames.push(r.description);
          if (r.topics && Array.isArray(r.topics)) repoNames.push(...r.topics);
        });
      }
    } catch (err) {
      console.warn('[InferTrack] GitHub API lookup notice (using fallback):', err);
    }

    // Heuristically infer track from gathered signals
    const inferred = inferTrackFromRepoData(languages, repoNames, bio);

    return NextResponse.json({
      success: true,
      inferredTrack: inferred.track.id as EngineeringTrack,
      track: inferred.track,
      confidence: inferred.confidence,
      rationale: inferred.rationale,
      topLanguages: inferred.topLanguages,
      detectedKeywords: inferred.detectedKeywords,
    });
  } catch (error) {
    console.error('[InferTrack] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        inferredTrack: 'backend-systems',
        track: getTrackById('backend-systems'),
        confidence: 0.5,
        rationale: 'Select your preferred engineering track manually.',
        topLanguages: [],
        detectedKeywords: [],
      },
      { status: 200 }
    );
  }
}
