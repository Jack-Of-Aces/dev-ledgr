'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import {
  ArrowRight,
  Search,
  Clock,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  X,
  CheckCircle2,
  ArrowUpDown,
  Check,
} from 'lucide-react';
import { getDomainStyle, getDifficultyStyle } from '@/lib/colors';
import { IdeaGridSkeleton } from '@/components/ui/skeletons';
import { getTrackById } from '@/lib/tracks';
import { launchpadService } from '@/services/launchpad/launchpadService';
import { IdeaItem } from '@/types';

type SortOption = 'relevance' | 'proofs-desc' | 'hours-asc' | 'hours-desc';
type StatusOption = 'solved' | 'unsolved';

/**
 * The skill vocabulary a problem advertises. Tags are editorial and often
 * empty on scraped rows, while the suggested stack is what the developer is
 * actually asked to build with, so both are counted and matched.
 */
function ideaSkillLabels(idea: IdeaItem & { suggestedStack?: string[] }): string[] {
  return Array.from(new Set([...(idea.tags ?? []), ...(idea.suggestedStack ?? [])]));
}

/** Display names for the domains the product recognises. */
const DOMAIN_LABELS: Record<string, string> = {
  fintech: 'Fintech',
  systems: 'Systems',
  logistics: 'Logistics',
  ai: 'AI',
  security: 'Security',
  devtools: 'DevTools',
  infrastructure: 'Infrastructure',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  foundational: 'Foundational',
  intermediate: 'Intermediate',
  'production-grade': 'Production-Grade',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

/**
 * Counts the distinct values present in the bank, keeping the order of the
 * supplied label map first and appending anything unrecognised after it. A
 * value with no label still appears, so an unmapped domain is filterable
 * rather than invisible.
 */
function facetCounts(
  values: string[],
  labels: Record<string, string>
): { label: string; value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = (value || 'unspecified').trim() || 'unspecified';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const ordered = Object.keys(labels).filter((key) => counts.has(key));
  const extra = [...counts.keys()].filter((key) => !(key in labels)).sort();
  return [...ordered, ...extra].map((key) => ({
    label: labels[key] ?? key.replace(/(^|[\s_-])([a-z])/g, (_, sep, ch: string) => sep + ch.toUpperCase()),
    value: key,
    count: counts.get(key) ?? 0,
  }));
}

export default function IdeasPage() {
  const { ideas, user, submissions, setIdeas } = useAppStore();
  const [mounted, setMounted] = useState(false);
  const [liveProblems, setLiveProblems] = useState<IdeaItem[]>([]);

  // Multi-select and search states
  const [search, setSearch] = useState('');
  const [filterMyTrack, setFilterMyTrack] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<StatusOption[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');

  // Mobile / drawer toggle for advanced secondary filters
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setMounted(true);
    launchpadService.getProblems().then((problems) => {
      if (problems && problems.length > 0) {
        setLiveProblems(problems);
        setIdeas(problems);
      }
    }).catch(() => {});
  }, [setIdeas]);

  const activeIdeas = liveProblems.length > 0 ? liveProblems : ideas;

  // Compute user solved set
  const solvedIdeaIds = useMemo(() => {
    const userSubs = submissions.filter(
      (s) => s.authorUsername.toLowerCase() === user.username.toLowerCase()
    );
    return new Set(userSubs.map((s) => s.ideaId));
  }, [submissions, user.username]);

  // Extract all unique tags dynamically. Scraped problems carry their stack in
  // suggestedStack and leave tags empty, so counting only idea.tags hides the
  // entire vocabulary the bank actually has.
  const allTags = useMemo(() => {
    const tagMap = new Map<string, number>();
    activeIdeas.forEach((i) => {
      ideaSkillLabels(i).forEach((t) => {
        tagMap.set(t, (tagMap.get(t) || 0) + 1);
      });
    });
    return Array.from(tagMap.entries())
      .sort((a, b) => b[1] - a[1]) // most frequent first
      .map(([name, count]) => ({ name, count }));
  }, [activeIdeas]);

  // Domain and difficulty facets are counted from the bank rather than from a
  // fixed list. A hardcoded vocabulary silently drops whatever the data
  // actually contains, which left the real domain unfilterable and the visible
  // options all reading zero.
  const domains: { label: string; value: string; count: number }[] = useMemo(
    () => facetCounts(activeIdeas.map((i) => i.domain), DOMAIN_LABELS),
    [activeIdeas]
  );

  const difficulties: { label: string; value: string; count: number }[] = useMemo(
    () => facetCounts(activeIdeas.map((i) => i.difficulty), DIFFICULTY_LABELS),
    [activeIdeas]
  );

  // Multi-select toggle helpers
  const toggleDomain = (val: string) => {
    if (val === 'all') {
      setSelectedDomains([]);
      return;
    }
    setSelectedDomains((prev) =>
      prev.includes(val) ? prev.filter((d) => d !== val) : [...prev, val]
    );
  };

  const toggleDifficulty = (val: string) => {
    setSelectedDifficulties((prev) =>
      prev.includes(val) ? prev.filter((d) => d !== val) : [...prev, val]
    );
  };

  const toggleTag = (val: string) => {
    setSelectedTags((prev) =>
      prev.includes(val) ? prev.filter((t) => t !== val) : [...prev, val]
    );
  };

  const toggleStatus = (val: StatusOption) => {
    setSelectedStatuses((prev) =>
      prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val]
    );
  };

  const currentTrack = useMemo(
    () => getTrackById(user.engineeringTrack || 'backend-systems'),
    [user.engineeringTrack]
  );

  // Filter and sort logic with multi-selection support
  const filteredIdeas = useMemo(() => {
    const searchLower = search.trim().toLowerCase();

    const matches = activeIdeas.filter((idea) => {
      const skills = ideaSkillLabels(idea);

      // 1. Text Search
      const matchesSearch =
        !searchLower ||
        idea.title.toLowerCase().includes(searchLower) ||
        (idea.tagline || '').toLowerCase().includes(searchLower) ||
        skills.some((t) => t.toLowerCase().includes(searchLower)) ||
        (idea.problemStatement || '').toLowerCase().includes(searchLower);

      // 2. Multi-select Domains: Match if no domains selected OR idea.domain is in selectedDomains
      const matchesDomain =
        selectedDomains.length === 0 || selectedDomains.includes(idea.domain);

      // 3. Multi-select Difficulties: Match if empty OR idea.difficulty is in selectedDifficulties
      const matchesDifficulty =
        selectedDifficulties.length === 0 || selectedDifficulties.includes(idea.difficulty);

      // 4. Multi-select Tags: Match if empty OR idea advertises AT LEAST ONE of selectedTags
      const matchesTag =
        selectedTags.length === 0 || selectedTags.some((t) => skills.includes(t));

      // 5. Multi-select Status: Solved vs Unsolved
      const isSolved = solvedIdeaIds.has(idea.id);
      const matchesStatus =
        selectedStatuses.length === 0 ||
        (selectedStatuses.includes('solved') && isSolved) ||
        (selectedStatuses.includes('unsolved') && !isSolved);

      // 6. Track Filter
      const matchesTrack =
        !filterMyTrack ||
        currentTrack.recommendedIdeaIds.includes(idea.id) ||
        skills.some((t) => currentTrack.defaultSkills.includes(t));

      return matchesSearch && matchesDomain && matchesDifficulty && matchesTag && matchesStatus && matchesTrack;
    });

    // Sorting
    return matches.sort((a, b) => {
      if (sortBy === 'proofs-desc') {
        return b.submissionCount - a.submissionCount;
      }
      if (sortBy === 'hours-asc') {
        return a.estimatedHours - b.estimatedHours;
      }
      if (sortBy === 'hours-desc') {
        return b.estimatedHours - a.estimatedHours;
      }
      return 0;
    });
  }, [
    activeIdeas,
    search,
    filterMyTrack,
    currentTrack,
    selectedDomains,
    selectedDifficulties,
    selectedTags,
    selectedStatuses,
    sortBy,
    solvedIdeaIds,
  ]);

  // Check if any non-default filters are active
  const hasActiveFilters =
    search.trim() !== '' ||
    filterMyTrack ||
    selectedDomains.length > 0 ||
    selectedDifficulties.length > 0 ||
    selectedTags.length > 0 ||
    selectedStatuses.length > 0 ||
    sortBy !== 'relevance';

  const resetAllFilters = () => {
    setSearch('');
    setFilterMyTrack(false);
    setSelectedDomains([]);
    setSelectedDifficulties([]);
    setSelectedTags([]);
    setSelectedStatuses([]);
    setSortBy('relevance');
  };

  const activeFilterCount =
    (search.trim() !== '' ? 1 : 0) +
    (filterMyTrack ? 1 : 0) +
    selectedDomains.length +
    selectedDifficulties.length +
    selectedTags.length +
    selectedStatuses.length +
    (sortBy !== 'relevance' ? 1 : 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-emerald-text font-semibold px-2.5 py-0.5 rounded-full bg-emerald-tint border border-emerald-border">
            Curated Engineering Specs
          </span>
          <span className="text-xs font-mono text-text-1">
            {activeIdeas.length} production problems ready to seal
          </span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-text-0">
          Idea Bank
        </h1>
        <p className="text-sm lg:text-base text-text-1 max-w-2xl leading-relaxed">
          Real-world operational problems sourced from production environments, translated into technical specs with mock infrastructure ready to build against.
        </p>
      </div>

      <hr className="rule" />

      {/* ========================================================= */}
      {/* MULTI-SELECT SEARCH & FILTER CONTROLS                      */}
      {/* ========================================================= */}
      <div className="space-y-3">
        {/* Tier 1: Search bar + Multi-Select Domain Pills + Filter Drawer Trigger.
            The search owns its row and the pills get the next one, so a long
            query never squeezes the domain filters into a scrolling sliver. */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-0 w-full">
            <Search
              className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-1 shrink-0"
              aria-hidden="true"
            />
            <input
              id="ideas-search-input"
              type="text"
              aria-label="Filter problems by keyword"
              placeholder="Search specs, tags, or concepts (e.g. Go, Redis, CRDT, lock)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-9 py-2 rounded-radius border border-line bg-card text-text-0 placeholder:text-text-1 focus:border-emerald focus:ring-1 focus:ring-emerald/30 outline-none text-xs sm:text-sm font-sans"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Clear search query"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-1 hover:text-text-0 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Advanced Filters Expand Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`btn-outline text-xs py-2 px-3 shrink-0 inline-flex items-center justify-center gap-1.5 font-mono cursor-pointer transition-colors ${
              showAdvanced || activeFilterCount > 0
                ? 'border-emerald text-emerald-text bg-emerald-tint/40'
                : ''
            }`}
            aria-expanded={showAdvanced}
            aria-controls="advanced-filters-panel"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald text-white text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Quick Domain Multi-Select Pills (Toggle multiple domains simultaneously) */}
        <div
          role="group"
          aria-label="Filter problems by engineering domains"
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-4 px-4 sm:mx-0 sm:px-0 min-w-0"
        >
          {/* "All" Reset Button */}
          <button
            onClick={() => toggleDomain('all')}
            className={`px-3 py-1.5 rounded-radius transition-all cursor-pointer text-xs font-sans whitespace-nowrap shrink-0 border ${
              selectedDomains.length === 0
                ? 'bg-text-0 text-ink-0 font-semibold border-text-0 shadow-xs'
                : 'bg-card border-line text-text-1 hover:text-text-0 hover:border-text-1/60'
            }`}
          >
            <span>All Domains</span>
            <span className={`ml-1.5 font-mono text-[11px] ${selectedDomains.length === 0 ? 'opacity-80' : 'opacity-60'}`}>
              ({activeIdeas.length})
            </span>
          </button>

          {/* Personalized Track Filter Pill */}
          <button
            onClick={() => setFilterMyTrack((prev) => !prev)}
            aria-pressed={filterMyTrack}
            className={`px-3 py-1.5 rounded-radius transition-all cursor-pointer text-xs font-sans whitespace-nowrap shrink-0 border inline-flex items-center gap-1.5 ${
              filterMyTrack
                ? 'bg-emerald text-white font-semibold border-emerald shadow-xs'
                : 'bg-card border-line text-emerald-text hover:text-emerald-text hover:border-emerald/40'
            }`}
            title={`Highlight challenges curated for your ${currentTrack.title} track`}
          >
            {filterMyTrack && <Check className="w-3 h-3 shrink-0" />}
            <span>🎯 My Track ({currentTrack.shortTitle})</span>
          </button>

          {domains.map((d) => {
            const isSelected = selectedDomains.includes(d.value);
            return (
              <button
                key={d.value}
                onClick={() => toggleDomain(d.value)}
                className={`px-3 py-1.5 rounded-radius transition-all cursor-pointer text-xs font-sans whitespace-nowrap shrink-0 border inline-flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald text-white font-semibold border-emerald shadow-xs'
                    : 'bg-card border-line text-text-1 hover:text-text-0 hover:border-text-1/60'
                }`}
                aria-pressed={isSelected}
              >
                {isSelected && <Check className="w-3 h-3 shrink-0" />}
                <span>{d.label}</span>
                <span className={`font-mono text-[11px] ${isSelected ? 'opacity-90' : 'opacity-60'}`}>
                  ({d.count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Tier 2: Advanced Refinement Panel (Multi-Select Matrix) */}
        {showAdvanced && (
          <div
            id="advanced-filters-panel"
            className="p-4 sm:p-5 rounded-radius border border-line bg-card/70 space-y-5 text-xs font-mono animate-in fade-in duration-200"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* 1. Multi-Select Difficulty Level */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-text-1 uppercase tracking-wider font-semibold text-[11px]">
                    Difficulty Level (Multi-Select)
                  </span>
                  {selectedDifficulties.length > 0 && (
                    <button
                      onClick={() => setSelectedDifficulties([])}
                      className="text-[11px] text-text-1 hover:text-rose-500 cursor-pointer"
                    >
                      Clear ({selectedDifficulties.length})
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {difficulties.map((diff) => {
                    const isChecked = selectedDifficulties.includes(diff.value);
                    return (
                      <button
                        key={diff.value}
                        type="button"
                        onClick={() => toggleDifficulty(diff.value)}
                        className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer border inline-flex items-center gap-1.5 ${
                          isChecked
                            ? 'bg-emerald text-white border-emerald font-semibold'
                            : 'bg-card border-line text-text-1 hover:text-text-0 hover:border-text-1'
                        }`}
                        aria-pressed={isChecked}
                      >
                        <span className={`w-2 h-2 rounded-full border ${isChecked ? 'bg-white border-white' : 'border-line'}`} />
                        <span>{diff.label}</span>
                        <span className="opacity-70 text-[11px]">({diff.count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Multi-Select Status */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-text-1 uppercase tracking-wider font-semibold text-[11px]">
                    Ledger Status (Multi-Select)
                  </span>
                  {selectedStatuses.length > 0 && (
                    <button
                      onClick={() => setSelectedStatuses([])}
                      className="text-[11px] text-text-1 hover:text-rose-500 cursor-pointer"
                    >
                      Clear ({selectedStatuses.length})
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleStatus('solved')}
                    className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer border inline-flex items-center gap-1.5 ${
                      selectedStatuses.includes('solved')
                        ? 'bg-emerald text-white border-emerald font-semibold'
                        : 'bg-card border-line text-text-1 hover:text-text-0 hover:border-text-1'
                    }`}
                    aria-pressed={selectedStatuses.includes('solved')}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Sealed ({solvedIdeaIds.size})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleStatus('unsolved')}
                    className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer border inline-flex items-center gap-1.5 ${
                      selectedStatuses.includes('unsolved')
                        ? 'bg-emerald text-white border-emerald font-semibold'
                        : 'bg-card border-line text-text-1 hover:text-text-0 hover:border-text-1'
                    }`}
                    aria-pressed={selectedStatuses.includes('unsolved')}
                  >
                    <span className="w-2 h-2 rounded-full border border-line" />
                    <span>Unsolved ({activeIdeas.length - solvedIdeaIds.size})</span>
                  </button>
                </div>
              </div>

              {/* 3. Sort Sequence */}
              <div className="space-y-2">
                <span className="text-text-1 uppercase tracking-wider font-semibold block text-[11px]">
                  Sort Sequence
                </span>
                <div className="relative">
                  <select
                    id="filter-sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="w-full appearance-none px-3 py-1.5 rounded-radius border border-line bg-card text-text-0 focus:border-emerald outline-none pr-8 cursor-pointer"
                  >
                    <option value="relevance">Curated Relevance</option>
                    <option value="proofs-desc">Most Proofs Verified</option>
                    <option value="hours-asc">Estimated Time: Low → High</option>
                    <option value="hours-desc">Estimated Time: High → Low</option>
                  </select>
                  <ArrowUpDown className="w-3.5 h-3.5 text-text-1 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* 4. Multi-Select Tech Stacks / Tags Matrix */}
            <div className="pt-3 border-t border-line/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-text-1 uppercase tracking-wider font-semibold text-[11px]">
                  Select Tech Stacks & Topics (Multi-Select)
                </span>
                {selectedTags.length > 0 && (
                  <button
                    onClick={() => setSelectedTags([])}
                    className="text-[11px] text-text-1 hover:text-rose-500 cursor-pointer"
                  >
                    Clear Selected Tags ({selectedTags.length})
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {allTags.map((tag) => {
                  const isChecked = selectedTags.includes(tag.name);
                  return (
                    <button
                      key={tag.name}
                      type="button"
                      onClick={() => toggleTag(tag.name)}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer border inline-flex items-center gap-1 ${
                        isChecked
                          ? 'bg-emerald text-white border-emerald font-semibold shadow-xs'
                          : 'bg-card border-line text-text-1 hover:text-text-0 hover:border-text-1'
                      }`}
                      aria-pressed={isChecked}
                    >
                      {isChecked && <Check className="w-3 h-3 shrink-0" />}
                      <span>{tag.name}</span>
                      <span className="opacity-60 text-[10px]">({tag.count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tier 3: Active Filters Summary Ribbon & One-Click Dismissal */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-text-1">
              Showing <strong className="text-text-0 font-semibold">{filteredIdeas.length}</strong> of{' '}
              {activeIdeas.length} specs
            </span>

            {/* Active Track Filter Chip */}
            {filterMyTrack && (
              <button
                onClick={() => setFilterMyTrack(false)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald/10 border border-emerald/30 text-emerald-text hover:border-rose-500/50 hover:text-rose-500 transition-colors cursor-pointer"
              >
                <span>Track: {currentTrack.shortTitle}</span>
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Active Domain Chips */}
            {selectedDomains.map((dom) => (
              <button
                key={dom}
                onClick={() => toggleDomain(dom)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-card border border-line text-text-0 hover:border-rose-500/50 hover:text-rose-500 transition-colors cursor-pointer capitalize"
              >
                <span>Domain: {dom}</span>
                <X className="w-3 h-3" />
              </button>
            ))}

            {/* Active Difficulty Chips */}
            {selectedDifficulties.map((diff) => (
              <button
                key={diff}
                onClick={() => toggleDifficulty(diff)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-card border border-line text-text-0 hover:border-rose-500/50 hover:text-rose-500 transition-colors cursor-pointer capitalize"
              >
                <span>Level: {diff}</span>
                <X className="w-3 h-3" />
              </button>
            ))}

            {/* Active Tag Chips */}
            {selectedTags.map((t) => (
              <button
                key={t}
                onClick={() => toggleTag(t)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-card border border-line text-text-0 hover:border-rose-500/50 hover:text-rose-500 transition-colors cursor-pointer"
              >
                <span>Tag: {t}</span>
                <X className="w-3 h-3" />
              </button>
            ))}

            {/* Active Status Chips */}
            {selectedStatuses.map((st) => (
              <button
                key={st}
                onClick={() => toggleStatus(st)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-card border border-line text-text-0 hover:border-rose-500/50 hover:text-rose-500 transition-colors cursor-pointer capitalize"
              >
                <span>Status: {st}</span>
                <X className="w-3 h-3" />
              </button>
            ))}

            {/* Active Sort Chip */}
            {sortBy !== 'relevance' && (
              <button
                onClick={() => setSortBy('relevance')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-card border border-line text-text-0 hover:border-rose-500/50 hover:text-rose-500 transition-colors cursor-pointer"
              >
                <span>Sorted: {sortBy}</span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="text-text-1 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center gap-1 transition-colors cursor-pointer font-medium ml-auto"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* PROBLEMS GRID                                             */}
      {/* ========================================================= */}
      {!mounted ? (
        <IdeaGridSkeleton count={6} />
      ) : filteredIdeas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredIdeas.map((idea) => {
            const domainStyle = getDomainStyle(idea.domain);
            const diffStyle = getDifficultyStyle(idea.difficulty);
            const isSolved = solvedIdeaIds.has(idea.id);
            const skills = ideaSkillLabels(idea);
            const hasMockInfra = Boolean(idea.mockInfra?.baseUrl);

            return (
              <div
                key={idea.id}
                className={`rounded-radius border bg-card transition-all p-5 sm:p-6 flex flex-col justify-between space-y-5 ${
                  isSolved
                    ? 'border-emerald/40 hover:border-emerald ring-1 ring-emerald/20'
                    : 'border-line hover:border-zinc-700/80'
                }`}
              >
                <div className="space-y-4">
                  {/* Meta tags ribbon */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm font-mono">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded border text-xs font-semibold ${domainStyle.badge}`}>
                        {domainStyle.name}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded border text-xs font-medium ${diffStyle.badge}`}>
                        {diffStyle.name}
                      </span>
                      {isSolved && (
                        <span className="px-2 py-0.5 rounded bg-emerald text-white text-[11px] font-bold inline-flex items-center gap-1 font-mono">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Sealed</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-text-1 text-xs">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        ~{idea.estimatedHours}h
                      </span>
                      <span>·</span>
                      <span className="text-emerald-text font-medium">
                        {idea.submissionCount} proofs
                      </span>
                    </div>
                  </div>

                  {/* Title & Tagline */}
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-text-0 leading-snug">
                      {idea.title}
                    </h2>
                    {idea.tagline && (
                      <p className="text-xs sm:text-sm text-text-1 mt-2 leading-relaxed">
                        {idea.tagline}
                      </p>
                    )}
                  </div>

                  {/* Origin Story Quote. Hidden when empty: a pair of empty
                      quotation marks reads as corrupted data. */}
                  {idea.originStory && (
                    <p className="text-xs text-text-1 leading-relaxed italic pl-3 border-l-2 border-line">
                      &ldquo;{idea.originStory}&rdquo;
                    </p>
                  )}

                  {/* Tags & suggested stack */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {skills.map((tag) => {
                      const isTagSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            toggleTag(tag);
                            setShowAdvanced(true);
                          }}
                          className={`text-xs px-2.5 py-0.5 rounded border font-mono transition-colors cursor-pointer inline-flex items-center gap-1 ${
                            isTagSelected
                              ? 'bg-emerald text-white border-emerald font-semibold'
                              : 'bg-card border-line text-text-1 hover:text-text-0 hover:border-text-1'
                          }`}
                        >
                          {isTagSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{tag}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-4 border-t border-line flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm">
                  {/* Only claim mock infra where there is some. */}
                  <span
                    className={`text-xs font-mono flex items-center gap-1.5 font-medium ${
                      hasMockInfra ? 'text-emerald-text' : 'text-text-1'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        hasMockInfra ? 'bg-emerald' : 'bg-line'
                      }`}
                    />
                    {hasMockInfra ? 'Mock Infra Ready' : 'Self-Hosted Fixture'}
                  </span>
                  <Link
                    href={`/ideas/${idea.id}`}
                    className="btn-brass text-xs py-1.5 px-3.5 inline-flex items-center justify-center gap-1.5 font-medium"
                  >
                    <span>{isSolved ? 'Inspect Sealed Spec' : 'Inspect Spec'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty Search/Filter State */
        <div className="p-12 rounded-radius border border-dashed border-line text-center space-y-4 bg-card/40">
          <div className="w-10 h-10 rounded-full bg-line flex items-center justify-center mx-auto text-text-1">
            <Search className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-text-0 text-base">No matching engineering specs</h3>
            <p className="text-xs sm:text-sm text-text-1 max-w-sm mx-auto">
              No problem entries matched your current combination of keywords, domains, levels, or stacks.
            </p>
          </div>
          <button
            onClick={resetAllFilters}
            className="btn-outline text-xs py-2 px-4 inline-flex items-center gap-1.5 font-mono cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All Filters</span>
          </button>
        </div>
      )}
    </div>
  );
}
