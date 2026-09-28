'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { IdeaItem, SubmissionEntry, JobOpportunity, UserProfile, EngineeringTrack, ExperienceLevel } from '@/types';
import { INITIAL_IDEAS, INITIAL_SUBMISSIONS, INITIAL_JOBS, DEFAULT_USER } from './mock-data';
import { setAuthCookies, clearAuthCookies } from './cookies';

interface AppState {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;

  isHydrated: boolean;
  setHydrated: (isHydrated: boolean) => void;
  refreshData: () => void;

  user: UserProfile;
  setUser: (user: Partial<UserProfile>) => void;
  isLoggedIn: boolean;
  loginAsGitHub: (username?: string, name?: string) => void;
  logout: () => void;

  // Auth & Onboarding Modal
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  completeOnboarding: (data: {
    username: string;
    name: string;
    headline?: string;
    skills: string[];
    engineeringTrack?: EngineeringTrack;
    targetRole?: string;
    experienceLevel?: ExperienceLevel;
    githubConnected?: boolean;
    githubUsername?: string;
  }) => void;
  connectGitHubAccount: (githubUsername: string) => void;

  ideas: IdeaItem[];
  submissions: SubmissionEntry[];
  jobs: JobOpportunity[];

  addIdea: (idea: IdeaItem) => void;
  addSubmission: (
    submission: Omit<SubmissionEntry, 'hash' | 'timestamp' | 'status' | 'testResults'> & {
      hash?: string;
      proofSignature?: string;
      testResults?: { passed: number; total: number; suiteName: string };
      metrics?: { latencyP99?: string; throughput?: string; coverage?: string };
    }
  ) => SubmissionEntry;
  verifySubmission: (hash: string) => void;
  getSubmissionByHash: (hash: string) => SubmissionEntry | undefined;
  getUserSubmissions: (username: string) => SubmissionEntry[];

  // Dynamic Job Matcher
  getJobMatchDetails: (job: JobOpportunity) => {
    score: number;
    hasGap: boolean;
    solvedProofTitles: string[];
    gapProblem?: IdeaItem;
  };

  // CV generation cache
  generatedCvs: Record<string, { cvMarkdown: string; coverLetter: string; createdAt: string }>;
  saveGeneratedCv: (jobId: string, cv: { cvMarkdown: string; coverLetter: string }) => void;

  // Active notification toast
  activeToast: { title: string; message: string; hash?: string } | null;
  showToast: (toast: { title: string; message: string; hash?: string }) => void;
  clearToast: () => void;
}

function generateCommitHash(): string {
  const chars = '0123456789abcdef';
  let hash = '';
  for (let i = 0; i < 7; i++) {
    hash += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return hash;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      isHydrated: false,
      setHydrated: (isHydrated) => set({ isHydrated }),
      refreshData: () => {
        set((state) => {
          // Merge newly added ideas without losing custom-created ones
          const existingIdeaIds = new Set(state.ideas.map((i) => i.id));
          const freshIdeas = INITIAL_IDEAS.filter((i) => !existingIdeaIds.has(i.id));
          const updatedIdeas = state.ideas.map((idea) => {
            const canonical = INITIAL_IDEAS.find((i) => i.id === idea.id);
            return canonical ? { ...canonical, submissionCount: Math.max(canonical.submissionCount, idea.submissionCount) } : idea;
          });

          // Merge fresh submissions
          const existingHashes = new Set(state.submissions.map((s) => s.hash.toLowerCase()));
          const freshSubs = INITIAL_SUBMISSIONS.filter((s) => !existingHashes.has(s.hash.toLowerCase()));

          return {
            ideas: [...updatedIdeas, ...freshIdeas],
            submissions: [...freshSubs, ...state.submissions],
            jobs: INITIAL_JOBS,
          };
        });
      },
      setTheme: (theme) => {
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', theme);
          if (theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
        set({ theme });
      },
      toggleTheme: () => {
        const next = get().theme === 'light' ? 'dark' : 'light';
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', next);
          if (next === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
        set({ theme: next });
      },

      user: DEFAULT_USER,
      setUser: (updates) => set((state) => ({ user: { ...state.user, ...updates } })),
      isLoggedIn: false,

      loginAsGitHub: (username = 'developer', name = 'Candidate Engineer') => {
        setAuthCookies(`mock_token_${username}`, 'user');
        set({
          isLoggedIn: true,
          user: {
            ...get().user,
            username,
            name,
          },
          activeToast: {
            title: `Authenticated via GitHub: @${username}`,
            message: `Connected to DevLedgr consensus network.`,
          },
        });
      },

      logout: () => {
        clearAuthCookies();
        set({
          isLoggedIn: false,
          activeToast: {
            title: 'Logged Out',
            message: 'Signed out of DevLedgr session.',
          },
        });
      },

      isAuthModalOpen: false,
      openAuthModal: () => set({ isAuthModalOpen: true }),
      closeAuthModal: () => set({ isAuthModalOpen: false }),

      completeOnboarding: ({
        username,
        name,
        headline,
        skills,
        engineeringTrack,
        targetRole,
        experienceLevel,
        githubConnected,
        githubUsername,
      }) => {
        setAuthCookies('devledgr_onboarded_session', 'user');
        set((state) => ({
          isLoggedIn: true,
          isAuthModalOpen: false,
          user: {
            ...state.user,
            username,
            name,
            headline: headline || state.user.headline,
            statedSkills: skills.length > 0 ? skills : state.user.statedSkills,
            engineeringTrack: engineeringTrack || state.user.engineeringTrack || 'backend-systems',
            targetRole: targetRole || state.user.targetRole || 'Backend Engineer',
            experienceLevel: experienceLevel || state.user.experienceLevel || 'junior',
            onboardingCompleted: true,
            githubConnected: githubConnected ?? state.user.githubConnected ?? Boolean(githubUsername),
            githubUsername: githubUsername || state.user.githubUsername || (state.user.authProvider === 'github' ? username : undefined),
            githubVerifiedAt: (githubConnected || githubUsername) ? new Date().toISOString() : state.user.githubVerifiedAt,
          },
          activeToast: {
            title: 'Onboarding Complete',
            message: `Profile initialized! Matched roles and problems have been personalized for ${targetRole || 'your track'}.`,
          },
        }));
      },

      connectGitHubAccount: (githubUsername: string) => {
        const cleanUsername = githubUsername.replace(/^@/, '').trim();
        set((state) => ({
          user: {
            ...state.user,
            githubConnected: true,
            githubUsername: cleanUsername,
            githubUrl: `https://github.com/${cleanUsername}`,
            githubVerifiedAt: new Date().toISOString(),
          },
          activeToast: {
            title: 'GitHub Connected & Verified',
            message: `Linked @${cleanUsername}. You can now record cryptographic proof-of-work and submit solutions.`,
          },
        }));
      },

      ideas: INITIAL_IDEAS,
      submissions: INITIAL_SUBMISSIONS,
      jobs: INITIAL_JOBS,

      addIdea: (idea) => {
        set((state) => ({
          ideas: [idea, ...state.ideas],
          activeToast: {
            title: 'New Problem Seeded',
            message: `"${idea.title}" is now live in the Idea Bank.`,
          },
        }));
      },

      addSubmission: (subData) => {
        const hash = subData.hash || generateCommitHash();
        const newEntry: SubmissionEntry = {
          ...subData,
          hash,
          proofSignature: subData.proofSignature,
          timestamp: new Date().toISOString(),
          status: 'verified',
          testResults: subData.testResults || {
            passed: 20,
            total: 20,
            suiteName: 'Automated CI & Contract Test Suite v2.0',
          },
          metrics: subData.metrics || {
            latencyP99: '34ms',
            throughput: '260 req/s',
            coverage: '96.4%',
          },
        };

        set((state) => ({
          submissions: [newEntry, ...state.submissions],
          ideas: state.ideas.map((idea) =>
            idea.id === subData.ideaId
              ? { ...idea, submissionCount: idea.submissionCount + 1 }
              : idea
          ),
          activeToast: {
            title: `Entry Recorded: #${hash}`,
            message: `Solution verified and permanently stamped into the DevLedgr.`,
            hash,
          },
        }));

        return newEntry;
      },

      verifySubmission: (hash) => {
        set((state) => ({
          submissions: state.submissions.map((s) =>
            s.hash === hash ? { ...s, status: 'verified' } : s
          ),
          activeToast: {
            title: `Proof Verified: #${hash}`,
            message: 'Reviewed and permanently stamped with consensus mark ✓.',
            hash,
          },
        }));
      },

      getSubmissionByHash: (hash) => {
        return get().submissions.find((s) => s.hash.toLowerCase() === hash.toLowerCase());
      },

      getUserSubmissions: (username) => {
        return get().submissions.filter(
          (s) => s.authorUsername.toLowerCase() === username.toLowerCase()
        );
      },

      getJobMatchDetails: (job) => {
        const userSubs = get().getUserSubmissions(get().user.username);
        const solvedIdeaIds = new Set(userSubs.map((s) => s.ideaId));

        // Check if user solved matched ideas
        const solvedMatched = job.matchedIdeaIds.filter((id) => solvedIdeaIds.has(id));
        const hasSolvedGap = job.gapIdeaId ? solvedIdeaIds.has(job.gapIdeaId) : true;

        const gapProblem = job.gapIdeaId
          ? get().ideas.find((i) => i.id === job.gapIdeaId)
          : undefined;

        let score = 50;
        if (solvedMatched.length > 0) score += 30;
        if (hasSolvedGap) score += 18;

        const hasGap = !hasSolvedGap && job.matchScore < 80;

        return {
          score: hasGap ? Math.min(score, 72) : Math.max(score, 94),
          hasGap,
          solvedProofTitles: userSubs
            .filter((s) => job.matchedIdeaIds.includes(s.ideaId) || s.ideaId === job.gapIdeaId)
            .map((s) => s.ideaTitle),
          gapProblem,
        };
      },

      generatedCvs: {},
      saveGeneratedCv: (jobId, cv) => {
        set((state) => ({
          generatedCvs: {
            ...state.generatedCvs,
            [jobId]: { ...cv, createdAt: new Date().toISOString() },
          },
        }));
      },

      activeToast: null,
      showToast: (toast) => set({ activeToast: toast }),
      clearToast: () => set({ activeToast: null }),
    }),
    {
      name: 'devledgr_storage_v2',
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
        state?.refreshData();
      },
      partialize: (state) => ({
        theme: state.theme,
        user: state.user,
        isLoggedIn: state.isLoggedIn,
        submissions: state.submissions,
        ideas: state.ideas,
        generatedCvs: state.generatedCvs,
      }),
    }
  )
);
