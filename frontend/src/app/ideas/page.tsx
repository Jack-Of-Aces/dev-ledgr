'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { ArrowRight, Search, Clock, RotateCcw } from 'lucide-react';
import { getDomainStyle, getDifficultyStyle } from '@/lib/colors';

export default function IdeasPage() {
  const { ideas } = useAppStore();
  const [search, setSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');

  const filteredIdeas = ideas.filter((idea) => {
    const matchesSearch =
      idea.title.toLowerCase().includes(search.toLowerCase()) ||
      idea.tagline.toLowerCase().includes(search.toLowerCase()) ||
      idea.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));

    const matchesDomain = selectedDomain === 'all' || idea.domain === selectedDomain;
    const matchesDifficulty = selectedDifficulty === 'all' || idea.difficulty === selectedDifficulty;

    return matchesSearch && matchesDomain && matchesDifficulty;
  });

  const domains: { label: string; value: string; count?: number }[] = [
    { label: 'All Domains', value: 'all', count: ideas.length },
    { label: 'Logistics', value: 'logistics', count: ideas.filter((i) => i.domain === 'logistics').length },
    { label: 'Fintech', value: 'fintech', count: ideas.filter((i) => i.domain === 'fintech').length },
    { label: 'Systems', value: 'systems', count: ideas.filter((i) => i.domain === 'systems').length },
    { label: 'DevTools', value: 'devtools', count: ideas.filter((i) => i.domain === 'devtools').length },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-10">
      {/* Header */}
      <div className="space-y-3">
        <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-text-0">
          Idea Bank
        </h1>
        <p className="text-sm sm:text-base text-text-1 max-w-2xl leading-relaxed">
          Real-world operational problems sourced from production environments, translated into technical specs with mock infrastructure ready to build against.
        </p>
      </div>

      <hr className="rule my-2" />

      {/* Filters & Search */}
      <div className="space-y-4 font-mono text-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-1" aria-hidden="true" />
            <input
              id="ideas-search-input"
              type="text"
              aria-label="Filter problems by keyword"
              placeholder="Filter by keyword (e.g. Go, Redis, CRDT, spatial)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-radius border border-line bg-card text-text-0 placeholder:text-text-1 focus:border-green-500 outline-none text-xs"
            />
          </div>

          <div
            role="tablist"
            aria-label="Filter problems by domain"
            className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 border-b border-line sm:border-b-0"
          >
            {domains.map((d) => (
              <button
                key={d.value}
                role="tab"
                aria-selected={selectedDomain === d.value}
                onClick={() => setSelectedDomain(d.value)}
                className={`px-3 py-1.5 transition-colors cursor-pointer text-xs font-sans whitespace-nowrap border-b-2 ${
                  selectedDomain === d.value
                    ? 'border-green-500 text-text-0 font-medium'
                    : 'border-transparent text-text-1 hover:text-text-0'
                }`}
              >
                <span>{d.label}</span>
                {d.count !== undefined && (
                  <span className="ml-1.5 opacity-70 text-xs font-mono">({d.count})</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Problems Grid */}
      {filteredIdeas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredIdeas.map((idea) => {
            const domainStyle = getDomainStyle(idea.domain);
            const diffStyle = getDifficultyStyle(idea.difficulty);

            return (
              <div
                key={idea.id}
                className="rounded-radius border border-line bg-card hover:border-zinc-700/80 transition-all p-6 flex flex-col justify-between space-y-5"
              >
                <div className="space-y-4">
                  {/* Meta tags */}
                  <div className="flex items-center justify-between gap-2 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded border text-xs font-semibold ${domainStyle.badge}`}>
                        {domainStyle.name}
                      </span>
                      <span className={`px-2 py-0.5 rounded border text-xs font-medium ${diffStyle.badge}`}>
                        {diffStyle.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-text-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        ~{idea.estimatedHours}h
                      </span>
                      <span>·</span>
                      <span className="text-green-700 dark:text-green-400 font-medium">
                        {idea.submissionCount} verified proofs
                      </span>
                    </div>
                  </div>

                {/* Title & Tagline */}
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-text-0 leading-snug">
                    {idea.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-text-1 mt-2 leading-relaxed">
                    {idea.tagline}
                  </p>
                </div>

                {/* Origin Story Quote - Plain Typographic Style without Nested Card */}
                <p className="text-xs text-text-1 leading-relaxed italic pl-3 border-l-2 border-line">
                  &ldquo;{idea.originStory}&rdquo;
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {idea.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2.5 py-1 rounded border border-line bg-card text-text-1 font-mono"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 border-t border-line flex items-center justify-between gap-4 text-xs">
                <span className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1.5 font-medium font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-600 dark:bg-green-500" />
                  Mock Infra Ready
                </span>
                <Link
                  href={`/ideas/${idea.id}`}
                  className="btn-brass text-xs py-1.5 px-3.5 inline-flex items-center gap-1.5"
                >
                  <span>Inspect Spec</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          );
        })}
        </div>
      ) : (
        <div className="p-12 rounded-radius border border-dashed border-line text-center text-xs space-y-3">
          <p className="text-text-1">No problems matched your current filter criteria.</p>
          <button
            onClick={() => {
              setSearch('');
              setSelectedDomain('all');
              setSelectedDifficulty('all');
            }}
            className="btn-outline text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        </div>
      )}
    </div>
  );
}
