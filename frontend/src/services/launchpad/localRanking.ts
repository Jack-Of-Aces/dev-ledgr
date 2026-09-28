/**
 * @file localRanking.ts
 * @description Client-side mirror of the backend's problem ranking, used only
 * in mock/offline mode so the console orders problems the way
 * GET /api/launchpad/problems/recommended would. When the live endpoint is
 * reachable its ranking is authoritative; this never overrides it.
 */

import { ExperienceLevel, LaunchpadProblem, ProblemRecommendation } from '@/types';

const LEVEL_RANKS: Record<ExperienceLevel, number> = {
  junior: 1,
  mid: 2,
  senior: 3,
  lead: 3,
};

const DIFFICULTY_RANKS: Record<string, number> = {
  foundational: 1,
  beginner: 1,
  easy: 1,
  intermediate: 2,
  medium: 2,
  advanced: 3,
  'production-grade': 3,
  hard: 3,
  expert: 3,
};

/**
 * Scores 0-10 how well a difficulty suits a seniority level: 10 on the nose,
 * 5 one step away, 0 further. Unrecognised labels stay neutral.
 */
export function difficultyFit(difficulty: string, level?: ExperienceLevel): number {
  const d = DIFFICULTY_RANKS[difficulty.trim().toLowerCase()];
  const l = level ? LEVEL_RANKS[level] : undefined;
  if (d === undefined || l === undefined) return 0;
  const gap = Math.abs(d - l);
  return gap >= 2 ? 0 : 10 - gap * 5;
}

/**
 * Ranks problems by skill overlap, breaking ties with the seniority fit. A
 * first challenge has to be claimable, so only open problems are considered;
 * ties keep the incoming order, as the backend's stable sort does.
 */
export function rankLocally(
  problems: LaunchpadProblem[],
  skills: string[] = [],
  level?: ExperienceLevel
): ProblemRecommendation {
  const have = new Set(
    skills
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );

  const scored = problems
    .filter((p) => p.status === 'open')
    .map((problem) => {
      const matchedSkills: string[] = [];
      const missingSkills: string[] = [];
      for (const want of [...problem.tags, ...(problem.suggestedStack ?? [])]) {
        (have.has(want.trim().toLowerCase()) ? matchedSkills : missingSkills).push(want);
      }
      const total = matchedSkills.length + missingSkills.length;
      const score = total > 0 ? Math.round((matchedSkills.length * 100) / total) : 0;
      return {
        problem,
        match: {
          score,
          matchedSkills,
          missingSkills,
          difficultyFit: difficultyFit(problem.difficulty, level),
        },
      };
    })
    .sort(
      (a, b) =>
        b.match.score + b.match.difficultyFit - (a.match.score + a.match.difficultyFit)
    );

  return {
    problems: scored.map(({ problem, match }) => ({ ...problem, match })),
    total: scored.length,
    personalized: true,
    devSkills: skills,
  };
}
