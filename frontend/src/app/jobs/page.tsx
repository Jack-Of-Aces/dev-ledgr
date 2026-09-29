'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { jobService } from '@/services/jobs/jobService';
import { JobOpportunity } from '@/types';
import { getTrackById } from '@/lib/tracks';
import { JobGridSkeleton } from '@/components/ui/skeletons';
import { CVAuditModal } from '@/components/ui/CVAuditModal';
import { parseJobDescription } from '@/components/jobs/JobDescription';
import {
  ArrowRight,
  Sparkles,
  Building2,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Search,
  SlidersHorizontal,
  X,
  ExternalLink,
  FileCheck2,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp,
  Briefcase,
} from 'lucide-react';

type SortOption = 'personalized' | 'score-desc' | 'newest' | 'salary';
type MatchFilterOption = 'all' | 'high' | 'good' | 'gap';
type LevelOption = 'all' | 'junior' | 'mid' | 'senior' | 'lead' | 'intern';

export default function JobsPage() {
  const { jobs, user, submissions, getJobMatchDetails, setJobs } = useAppStore();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [liveJobs, setLiveJobs] = useState<JobOpportunity[]>([]);

  // Search and Filter States
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<LevelOption>('all');
  const [matchFilter, setMatchFilter] = useState<MatchFilterOption>('all');
  const [trackFilter, setTrackFilter] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('personalized');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // ATS Modal state
  const [auditJob, setAuditJob] = useState<JobOpportunity | undefined>(undefined);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Description expand state
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(new Set());

  const toggleExpand = (jobId: string) => {
    setExpandedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  useEffect(() => {
    setMounted(true);
    let active = true;

    jobService
      .getJobs()
      .then((fetched) => {
        if (active && fetched && fetched.length > 0) {
          setLiveJobs(fetched);
          setJobs(fetched);
        }
      })
      .catch((err) => {
        console.warn('Jobs fetch note:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [setJobs]);

  const activeJobs = liveJobs.length > 0 ? liveJobs : jobs;

  // Extract all unique skills across opportunities for quick filtering
  const allSkills = useMemo(() => {
    const map = new Map<string, number>();
    activeJobs.forEach((j) => {
      const combined = [...(j.requiredSkills || []), ...(j.tags || [])];
      combined.forEach((s) => {
        if (s && s.trim()) {
          const trimmed = s.trim();
          map.set(trimmed, (map.get(trimmed) || 0) + 1);
        }
      });
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, count]) => ({ name, count }));
  }, [activeJobs]);

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  // Filter and sort opportunities
  const filteredJobs = useMemo(() => {
    const searchLower = search.trim().toLowerCase();

    const matched = activeJobs.map((job) => {
      const match = getJobMatchDetails(job);
      return { job, match };
    }).filter(({ job, match }) => {
      // 1. Text Search
      if (searchLower) {
        const inTitle = job.title.toLowerCase().includes(searchLower);
        const inCompany = job.company.toLowerCase().includes(searchLower);
        const inDesc = job.description?.toLowerCase().includes(searchLower);
        const inSkills = [...(job.requiredSkills || []), ...(job.tags || [])].some((s) =>
          s.toLowerCase().includes(searchLower)
        );
        if (!inTitle && !inCompany && !inDesc && !inSkills) return false;
      }

      // 2. Experience Level
      if (levelFilter !== 'all') {
        const jobLevel = (job.level || '').toLowerCase();
        const jobTitle = job.title.toLowerCase();
        const jobDesc = job.description?.toLowerCase() || '';

        if (levelFilter === 'senior') {
          const isSenior =
            jobLevel.includes('senior') ||
            jobTitle.includes('senior') ||
            jobTitle.includes('sr.') ||
            jobDesc.includes('5+ years') ||
            jobDesc.includes('6+ years') ||
            jobDesc.includes('senior engineer');
          if (!isSenior) return false;
        } else if (levelFilter === 'lead') {
          const isLead =
            jobLevel.includes('lead') ||
            jobTitle.includes('lead') ||
            jobTitle.includes('principal') ||
            jobTitle.includes('staff') ||
            jobDesc.includes('lead engineer') ||
            jobDesc.includes('head of');
          if (!isLead) return false;
        } else if (levelFilter === 'junior') {
          const isJunior =
            jobLevel.includes('junior') ||
            jobTitle.includes('junior') ||
            jobTitle.includes('entry') ||
            jobTitle.includes('associate') ||
            jobDesc.includes('0-2 years') ||
            jobDesc.includes('1-2 years') ||
            jobDesc.includes('entry level') ||
            jobDesc.includes('junior');
          if (!isJunior) return false;
        } else if (levelFilter === 'mid') {
          const isMid =
            jobLevel.includes('mid') ||
            (!jobTitle.includes('senior') &&
              !jobTitle.includes('lead') &&
              !jobTitle.includes('principal') &&
              !jobTitle.includes('intern'));
          if (!isMid) return false;
        } else if (levelFilter === 'intern') {
          const isIntern =
            jobLevel.includes('intern') ||
            jobTitle.includes('intern') ||
            jobDesc.includes('internship');
          if (!isIntern) return false;
        }
      }

      // 3. Match Score Filter
      if (matchFilter === 'high' && match.score < 80) return false;
      if (matchFilter === 'good' && (match.score < 60 || match.score >= 80)) return false;
      if (matchFilter === 'gap' && match.score >= 60) return false;

      // 4. Track Filter
      if (trackFilter && user.engineeringTrack) {
        const trackDef = getTrackById(user.engineeringTrack);
        const trackKeywords = [
          ...(trackDef.inferredKeywords || []),
          ...trackDef.targetRoles.map((r) => r.toLowerCase()),
          ...trackDef.defaultSkills.map((s) => s.toLowerCase()),
        ];
        const jobTitleLower = job.title.toLowerCase();
        const jobDescLower = job.description?.toLowerCase() || '';
        const jobSkillsLower = [...(job.requiredSkills || []), ...(job.tags || [])].map((s) => s.toLowerCase());

        const matchesTrack = trackKeywords.some((keyword) => {
          if (keyword.length < 3) return false;
          return (
            jobTitleLower.includes(keyword) ||
            jobSkillsLower.some((s) => s === keyword || s.includes(keyword) || keyword.includes(s)) ||
            jobDescLower.includes(keyword)
          );
        });

        if (!matchesTrack) return false;
      }

      // 5. Skill Pills
      if (selectedSkills.length > 0) {
        const jobSkills = [...(job.requiredSkills || []), ...(job.tags || [])].map((s) => s.toLowerCase());
        const hasAllSelected = selectedSkills.every((s) =>
          jobSkills.some((js) => js.includes(s.toLowerCase()))
        );
        if (!hasAllSelected) return false;
      }

      return true;
    });

    // Sort sequence
    return matched.sort((a, b) => {
      if (sortBy === 'personalized' || sortBy === 'score-desc') {
        return b.match.score - a.match.score;
      }
      if (sortBy === 'newest') {
        const timeB = b.job.scrapedAt ? new Date(b.job.scrapedAt).getTime() : 0;
        const timeA = a.job.scrapedAt ? new Date(a.job.scrapedAt).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === 'salary') {
        return (b.job.salary || '').localeCompare(a.job.salary || '');
      }
      return 0;
    });
  }, [
    activeJobs,
    search,
    levelFilter,
    matchFilter,
    trackFilter,
    selectedSkills,
    sortBy,
    user.engineeringTrack,
    getJobMatchDetails,
  ]);

  const hasActiveFilters =
    search.trim() !== '' ||
    levelFilter !== 'all' ||
    matchFilter !== 'all' ||
    trackFilter ||
    selectedSkills.length > 0 ||
    sortBy !== 'personalized';

  const resetFilters = () => {
    setSearch('');
    setLevelFilter('all');
    setMatchFilter('all');
    setTrackFilter(false);
    setSelectedSkills([]);
    setSortBy('personalized');
  };

  const userSubmissions = submissions.filter(
    (s) => s.authorUsername.toLowerCase() === user.username.toLowerCase()
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-8 font-sans">
      {/* ─── 1. Header ────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-emerald-text font-semibold px-2.5 py-0.5 rounded-full bg-emerald-tint border border-emerald-border">
            Verified Opportunities
          </span>
          <span className="text-xs font-mono text-text-1">
            {activeJobs.length} live engineering roles ranked by proof-of-work
          </span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-text-0">
          Opportunities
        </h1>
        <p className="text-sm lg:text-base text-text-1 max-w-3xl leading-relaxed">
          Real job openings matched against your cryptographic proofs and stated skills. Run automated AI Scrutiny to generate ATS-safe cover letters or benchmark your CV before applying.
        </p>
      </div>

      {/* ─── 2. Personalization Telemetry Summary Ribbon ─────────── */}
      <div className="rounded-radius border border-line bg-card p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs md:text-sm shadow-xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-9 h-9 rounded-full bg-emerald-tint border border-emerald-border flex items-center justify-center shrink-0 text-emerald-text">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <div className="font-semibold text-text-0 text-sm flex flex-wrap items-center gap-2">
              <span>Personalized Match Engine Active</span>
              {user.engineeringTrack && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-ink-0 border border-line text-text-1">
                  Track: {user.engineeringTrack}
                </span>
              )}
            </div>
            <div className="text-xs font-mono text-text-1">
              Evaluated against <span className="text-emerald-text font-bold">{userSubmissions.length} verified ledger proofs</span> and skills: <span className="text-text-0 font-medium">{(user.statedSkills || ['Go', 'TypeScript', 'PostgreSQL']).join(', ')}</span>.
            </div>
          </div>
        </div>
        <Link
          href="/ideas"
          className="btn-outline text-xs py-2 px-3.5 self-start md:self-auto shrink-0 inline-flex items-center gap-1.5 font-mono"
        >
          <span>Solve Challenge to Boost Match</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <hr className="rule" />

      {/* ─── 3. Interactive Filter & Search Controls ────────────── */}
      <div className="space-y-4">
        {/* Search Bar + Drawer Trigger */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-1" />
            <input
              type="text"
              placeholder="Search roles by title, company, skills (e.g. Go, Python, Power Apps, Distributed)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2 rounded-radius border border-line bg-card text-text-0 placeholder:text-text-1/60 focus:border-emerald-border focus:ring-1 focus:ring-emerald-border outline-none text-xs sm:text-sm font-sans"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-1 hover:text-text-0 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            className={`btn-outline text-xs py-2 px-3.5 inline-flex items-center justify-center gap-1.5 cursor-pointer font-sans shrink-0 ${
              showAdvancedFilters || selectedSkills.length > 0 || levelFilter !== 'all' || matchFilter !== 'all'
                ? 'border-emerald-border text-emerald-text bg-emerald-tint/30'
                : ''
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {(selectedSkills.length > 0 || levelFilter !== 'all' || matchFilter !== 'all' || trackFilter) && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald shrink-0" />
            )}
          </button>
        </div>

        {/* Quick Match Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 text-xs min-w-0">
          <span className="font-mono text-text-1 text-[11px] uppercase tracking-wider shrink-0 mr-1">
            Match:
          </span>
          {[
            { id: 'all', label: 'All Matches' },
            { id: 'high', label: 'High Match (80%+)' },
            { id: 'good', label: 'Good Match (60–79%)' },
            { id: 'gap', label: 'Skill Gap (<60%)' },
          ].map((opt) => {
            const isSelected = matchFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMatchFilter(opt.id as MatchFilterOption)}
                className={`px-3 py-1.5 rounded-radius transition-all cursor-pointer font-sans whitespace-nowrap shrink-0 border ${
                  isSelected
                    ? 'bg-text-0 text-ink-0 font-semibold border-text-0 shadow-xs'
                    : 'bg-card border-line text-text-1 hover:text-text-0 hover:border-text-1/60'
                }`}
              >
                {opt.label}
              </button>
            );
          })}

          {user.engineeringTrack && (
            <button
              type="button"
              onClick={() => setTrackFilter((prev) => !prev)}
              className={`px-3 py-1.5 rounded-radius transition-all cursor-pointer font-sans whitespace-nowrap shrink-0 border inline-flex items-center gap-1.5 ${
                trackFilter
                  ? 'bg-emerald text-white font-semibold border-emerald shadow-xs'
                  : 'bg-card border-line text-text-1 hover:text-text-0 hover:border-text-1/60'
              }`}
            >
              <Briefcase className="w-3 h-3" />
              <span>My Track Only</span>
            </button>
          )}
        </div>

        {/* Advanced Filters Expandable Drawer */}
        {showAdvancedFilters && (
          <div className="p-4 rounded-radius border border-line bg-card/60 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Experience Level */}
              <div className="space-y-1.5">
                <label className="font-mono text-[11px] uppercase text-text-1 font-semibold block">
                  Experience Level
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all', label: 'All Levels' },
                    { id: 'senior', label: 'Senior' },
                    { id: 'mid', label: 'Mid-Level' },
                    { id: 'junior', label: 'Junior' },
                    { id: 'lead', label: 'Lead / Principal' },
                    { id: 'intern', label: 'Intern' },
                  ].map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setLevelFilter(lvl.id as LevelOption)}
                      className={`px-2.5 py-1 rounded transition-all cursor-pointer border ${
                        levelFilter === lvl.id
                          ? 'bg-text-0 text-ink-0 font-semibold border-text-0'
                          : 'bg-ink-0 border-line text-text-1 hover:text-text-0'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sorting Sequence */}
              <div className="space-y-1.5">
                <label className="font-mono text-[11px] uppercase text-text-1 font-semibold block">
                  Sort Opportunities
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'personalized', label: 'Best Match (Personalized)' },
                    { id: 'score-desc', label: 'Score: High to Low' },
                    { id: 'newest', label: 'Newest Scraped' },
                    { id: 'salary', label: 'Salary Stated' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSortBy(s.id as SortOption)}
                      className={`px-2.5 py-1 rounded transition-all cursor-pointer border ${
                        sortBy === s.id
                          ? 'bg-text-0 text-ink-0 font-semibold border-text-0'
                          : 'bg-ink-0 border-line text-text-1 hover:text-text-0'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Popular Skill Tags Filter */}
            {allSkills.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-line/60">
                <label className="font-mono text-[11px] uppercase text-text-1 font-semibold block">
                  Filter by Technology / Skill Requirement
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {allSkills.map((tag) => {
                    const isChecked = selectedSkills.includes(tag.name);
                    return (
                      <button
                        key={tag.name}
                        type="button"
                        onClick={() => toggleSkill(tag.name)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono transition-all cursor-pointer border ${
                          isChecked
                            ? 'bg-emerald text-white border-emerald font-medium'
                            : 'bg-ink-0 border-line text-text-1 hover:text-text-0'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3" />}
                        <span>{tag.name}</span>
                        <span className="opacity-60 text-[10px]">({tag.count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results Count & Reset Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs font-mono">
          <div className="text-text-1">
            Showing <strong className="text-text-0 font-semibold">{filteredJobs.length}</strong> of{' '}
            {activeJobs.length} verified opportunities
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-emerald-text hover:underline inline-flex items-center gap-1 cursor-pointer font-mono"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset all filters</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── 4. Jobs List ───────────────────────────────────────── */}
      {!mounted || loading ? (
        <JobGridSkeleton count={4} />
      ) : filteredJobs.length === 0 ? (
        <div className="rounded-radius border border-line bg-card p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-ink-0 border border-line flex items-center justify-center mx-auto text-text-1">
            <Search className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-text-0">No matching opportunities found</h3>
            <p className="text-xs text-text-1 max-w-sm mx-auto leading-relaxed">
              No live roles match the selected filter criteria. Try adjusting your search query, clearing skill pills, or resetting filters.
            </p>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="btn-brass text-xs py-2 px-4 inline-flex items-center gap-1.5 cursor-pointer font-mono"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All Filters</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map(({ job, match }) => {
            const isHighMatch = !match.hasGap && match.score >= 80;
            const isExpanded = expandedJobIds.has(job.id);
            // Collapse on a block boundary rather than a character count. The
            // old 280-character cut landed mid-sentence and could slice a
            // section heading in half, which read as a rendering fault rather
            // than a deliberate truncation.
            const descriptionBlocks = parseJobDescription(job.description);
            const COLLAPSED_BLOCKS = 2;
            const isLongDescription = descriptionBlocks.length > COLLAPSED_BLOCKS;
            const visibleBlocks = isExpanded
              ? descriptionBlocks
              : descriptionBlocks.slice(0, COLLAPSED_BLOCKS);

            return (
              <div
                key={job.id}
                className="rounded-radius border border-line bg-card hover:border-zinc-700/80 transition-all p-5 sm:p-6 space-y-4 text-xs md:text-sm shadow-xs"
              >
                {/* Header Row: Company, Role, Level & Match Badge */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-line">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-emerald-text font-medium">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-semibold">{job.company}</span>
                      </div>
                      <span className="text-text-1">·</span>
                      <div className="flex items-center gap-1 text-text-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span>{job.location || 'Remote'}</span>
                      </div>
                      {job.level && job.level !== 'unspecified' && (
                        <>
                          <span className="text-text-1">·</span>
                          <span className="px-1.5 py-0.5 rounded bg-ink-0 border border-line text-[10px] text-text-1 uppercase">
                            {job.level}
                          </span>
                        </>
                      )}
                      {job.type && (
                        <>
                          <span className="text-text-1">·</span>
                          <span className="text-text-1">{job.type}</span>
                        </>
                      )}
                    </div>

                    <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-text-0 font-sans break-words">
                      {job.title}
                    </h2>
                  </div>

                  {/* Match Score Badge */}
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-line/40">
                    <div
                      className={`text-base sm:text-lg font-mono font-bold ${
                        isHighMatch ? 'text-emerald-text' : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {match.score}% Match
                    </div>
                    <div
                      className={`text-[11px] font-mono font-semibold ${
                        isHighMatch ? 'text-emerald-text' : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {isHighMatch ? '✓ Ready to apply' : `${match.missingSkills?.length || 1} Skill gap`}
                    </div>
                  </div>
                </div>

                {/* Job Description */}
                <div className="space-y-1">
                  {visibleBlocks.length === 0 ? (
                    <p className="text-xs sm:text-sm text-text-1 italic">
                      No description provided for this opening.
                    </p>
                  ) : (
                    <div className="text-xs sm:text-sm space-y-2">
                      {visibleBlocks.map((block, blockIdx) =>
                        block.kind === 'heading' ? (
                          <h3
                            key={blockIdx}
                            className="text-sm font-semibold text-text-0 font-sans tracking-tight"
                          >
                            {block.text}
                          </h3>
                        ) : (
                          <p key={blockIdx} className="text-text-1 leading-relaxed">
                            {block.text}
                          </p>
                        )
                      )}
                    </div>
                  )}
                  {isLongDescription && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(job.id)}
                      className="text-[11px] font-mono text-emerald-text hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isExpanded ? 'Show less' : 'Read full spec'}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>

                {/* Skills Analysis: Matched vs Missing */}
                <div className="space-y-2 pt-2 border-t border-line/40">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono uppercase tracking-wider text-text-1 font-semibold">
                    <span>Proof-of-Work Verification Analysis:</span>
                    {job.salary && (
                      <span className="text-text-0 normal-case font-medium">
                        Comp: {job.salary}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {/* Matched Skills */}
                    {match.matchedSkills && match.matchedSkills.length > 0 ? (
                      match.matchedSkills.map((skill, idx) => (
                        <span
                          key={`matched-${idx}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-emerald-border/60 bg-emerald-tint/20 text-emerald-text text-xs font-mono"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{skill}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] font-mono text-text-1 italic py-0.5">
                        No stated skills match this spec yet
                      </span>
                    )}

                    {/* Missing Skills */}
                    {(match.missingSkills || []).slice(0, 4).map((skill, idx) => (
                      <span
                        key={`missing-${idx}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-mono"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{skill}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Gap Bridge Route */}
                {match.hasGap && match.gapProblem && (
                  <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>
                        Missing required proof for <strong className="font-semibold">{match.gapSkill || 'this role'}</strong>.
                      </span>
                    </div>
                    <Link
                      href={`/ideas/${match.gapProblem.id}`}
                      className="text-emerald-text hover:underline font-mono inline-flex items-center gap-1 shrink-0 font-medium"
                    >
                      <span>Close gap: {match.gapProblem.title}</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}

                {/* Actions Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-line text-xs font-sans">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAuditJob(job);
                        setIsAuditModalOpen(true);
                      }}
                      className="btn-outline text-xs py-1.5 px-3 inline-flex items-center gap-1.5 cursor-pointer font-sans"
                    >
                      <FileCheck2 className="w-3.5 h-3.5 text-emerald-text" />
                      <span>ATS Resume Audit</span>
                    </button>

                    {(job.applyUrl || job.sourceUrl) && (
                      <a
                        href={job.applyUrl || job.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-outline text-xs py-1.5 px-3 inline-flex items-center gap-1.5 font-sans"
                      >
                        <span>External Listing</span>
                        <ExternalLink className="w-3 h-3 text-text-1" />
                      </a>
                    )}
                  </div>

                  <Link
                    href={`/jobs/${job.id}/apply`}
                    className="btn-brass text-xs py-1.5 px-3.5 inline-flex items-center justify-center gap-1.5 font-medium shrink-0 w-full sm:w-auto"
                  >
                    <span>Run AI Scrutiny</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── 5. ATS Resume Audit Modal ──────────────────────────── */}
      <CVAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => {
          setIsAuditModalOpen(false);
          setAuditJob(undefined);
        }}
        job={auditJob}
      />
    </div>
  );
}
