'use client';

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";

import { IdeaItem, Domain, Difficulty } from "@/types";
import { ShieldCheck, Plus, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/AuthGuard";

export default function AdminPage() {
  const { submissions, ideas, addIdea, verifySubmission } = useAppStore();
  const [activeTab, setActiveTab] = useState<"submissions" | "ideas">(
    "submissions"
  );
  const [seedModalOpen, setSeedModalOpen] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && seedModalOpen) {
        setSeedModalOpen(false);
      }
    };
    if (seedModalOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [seedModalOpen]);

  // Form states for seeding problem
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [domain, setDomain] = useState<Domain>("fintech");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [estimatedHours, setEstimatedHours] = useState(12);
  const [originStory, setOriginStory] = useState("");
  const [problemStatement, setProblemStatement] = useState("");
  const [techReqs, setTechReqs] = useState("");
  const [tags, setTags] = useState("Go, Redis, Distributed");

  const handleSeedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !tagline) return;

    const newIdeaId = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const newIdea: IdeaItem = {
      id: newIdeaId,
      title,
      tagline,
      domain,
      difficulty,
      estimatedHours: Number(estimatedHours) || 10,
      originStory:
        originStory || "Sourced from active production infrastructure leads.",
      problemStatement:
        problemStatement ||
        "Implement production-grade solution with high concurrency safety.",
      technicalRequirements: techReqs
        .split("\\n")
        .filter((r) => r.trim().length > 0),
      mockInfra: {
        baseUrl: `https://mock-infra.devledgr.xyz/api/v1/${newIdeaId}`,
        starterRepoUrl: "https://github.com/devledgr-starters/base-starter",
        curlExample: `curl -X GET https://mock-infra.devledgr.xyz/api/v1/${newIdeaId}/health`,
        endpoints: [
          {
            method: "GET",
            path: "/health",
            description: "Healthcheck and synthetic test harness trigger.",
            responseSample: { status: "healthy", cluster_nodes: 3 },
          },
        ],
        testCriteria: [
          "Passes all unit test suites under load simulation.",
          "P95 latency strictly below 50ms.",
        ],
      },
      tags: tags.split(",").map((t) => t.trim()),
      submissionCount: 0,
    };

    addIdea(newIdea);
    setSeedModalOpen(false);
    // Reset fields
    setTitle("");
    setTagline("");
    setOriginStory("");
    setProblemStatement("");
    setTechReqs("");
    setEstimatedHours(12);
    setTags("Go, Redis, Distributed");
  };

  return (
    <AuthGuard allowedRoles={['admin', 'reviewer']}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-10 text-sm lg:text-base font-sans">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-text-0">
              Ledger Review &amp; Problem Seeder
            </h1>
            <p className="text-text-1 mt-1 text-xs md:text-sm max-w-md leading-relaxed">
              Gated review console for verifiers to audit incoming code and seed
              new real-world problems.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab("submissions")}
              className={`px-3 py-1.5 rounded-radius cursor-pointer text-xs md:text-sm font-medium ${
                activeTab === "submissions"
                  ? "bg-card text-text-0 border border-green-500"
                  : "text-text-1"
              }`}
            >
              Review Queue ({submissions.length})
            </button>
            <button
              onClick={() => setActiveTab("ideas")}
              className={`px-3 py-1.5 rounded-radius cursor-pointer text-xs md:text-sm font-medium ${
                activeTab === "ideas"
                  ? "bg-card text-text-0 border border-green-500"
                  : "text-text-1"
              }`}
            >
              Manage Ideas ({ideas.length})
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "submissions" ? (
          <div className="space-y-4">
            <div className="text-xs md:text-sm text-text-1 max-w-md">
              Incoming proof submissions awaiting reviewer stamp or automated consensus:
            </div>
            <div className="rounded-radius border border-line bg-card/40 divide-y divide-line overflow-hidden">
              {submissions.map((sub) => (
                <div
                  key={sub.hash}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs md:text-sm"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="commit-hash font-mono shrink-0">#{sub.hash}</span>
                      <span className="font-semibold text-text-0 break-words">{sub.ideaTitle}</span>
                      <span className="text-text-1 font-mono shrink-0">by @{sub.authorUsername}</span>
                    </div>
                    <p className="text-text-1 text-xs md:text-sm max-w-md line-clamp-1">
                      {sub.architectureNotes}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => verifySubmission(sub.hash)}
                      className="text-green-700 dark:text-green-400 font-medium flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Stamped</span>
                    </button>
                    <a
                      href={sub.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-outline text-xs md:text-sm py-1 px-2.5 flex items-center gap-1 font-mono"
                    >
                      <span>Inspect Code</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs md:text-sm text-text-1">
              <span>
                Currently active problem specifications in the Idea Bank ({ideas.length}):
              </span>
              <button
                onClick={() => setSeedModalOpen(true)}
                className="btn-brass text-xs md:text-sm py-1.5 px-3 cursor-pointer self-start sm:self-auto shrink-0"
              >
                <Plus className="w-3 h-3" />
                <span>Seed New Problem</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ideas.map((idea) => (
                <div
                  key={idea.id}
                  className="p-4 rounded-radius border border-line bg-card/40 space-y-2 text-xs md:text-sm"
                >
                  <div className="flex justify-between items-center text-xs md:text-sm text-green-700 dark:text-green-400 font-mono uppercase font-semibold">
                    <span>{idea.domain}</span>
                    <span>{idea.submissionCount} proofs</span>
                  </div>
                  <Link
                    href={`/ideas/${idea.id}`}
                    className="text-base font-semibold tracking-tight text-text-0 hover:text-green-400 hover:underline block"
                  >
                    {idea.title}
                  </Link>
                  <p className="text-text-1 line-clamp-2 text-xs md:text-sm leading-relaxed">
                    {idea.tagline}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Seed New Problem Modal */}
        {seedModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSeedModalOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="seed-modal-title"
              className="w-full max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-radius border border-line bg-ink-0 p-5 sm:p-6 text-xs md:text-sm space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <h2
                  id="seed-modal-title"
                  className="text-lg font-semibold tracking-tight text-text-0"
                >
                  Seed New Real-World Problem Spec
                </h2>
                <button
                  onClick={() => setSeedModalOpen(false)}
                  aria-label="Close problem seeder dialog"
                  className="text-text-1 hover:text-text-0 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              <form onSubmit={handleSeedSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="seed-title"
                    className="block text-xs md:text-sm uppercase tracking-wider text-text-1 font-semibold mb-1"
                  >
                    Problem Title *
                  </label>
                  <input
                    id="seed-title"
                    type="text"
                    required
                    placeholder="e.g. Distributed Rate Limiter with Token Bucket"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-line bg-card text-text-0 outline-none focus:border-brass"
                  />
                </div>
                <div>
                  <label
                    htmlFor="seed-tagline"
                    className="block text-xs md:text-sm uppercase tracking-wider text-text-1 font-semibold mb-1"
                  >
                    Tagline / High-Level Thesis *
                  </label>
                  <input
                    id="seed-tagline"
                    type="text"
                    required
                    placeholder="Sliding window counter with Redis clusters..."
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-line bg-card text-text-0 outline-none focus:border-brass"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="seed-domain"
                      className="block text-xs md:text-sm uppercase tracking-wider text-text-1 font-semibold mb-1"
                    >
                      Domain
                    </label>
                    <select
                      id="seed-domain"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value as Domain)}
                      className="w-full px-3 py-1.5 rounded border border-line bg-card text-text-0 outline-none"
                    >
                      <option value="fintech">Fintech</option>
                      <option value="systems">Systems</option>
                      <option value="logistics">Logistics</option>
                      <option value="devtools">DevTools</option>
                      <option value="ai">AI</option>
                      <option value="security">Security</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="seed-difficulty"
                      className="block text-xs md:text-sm uppercase tracking-wider text-text-1 font-semibold mb-1"
                    >
                      Difficulty
                    </label>
                    <select
                      id="seed-difficulty"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                      className="w-full px-3 py-1.5 rounded border border-line bg-card text-text-0 outline-none"
                    >
                      <option value="foundational">Foundational</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="production-grade">Production-Grade</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="seed-hours"
                      className="block text-xs md:text-sm uppercase tracking-wider text-text-1 font-semibold mb-1"
                    >
                      Estimated Hours
                    </label>
                    <input
                      id="seed-hours"
                      type="number"
                      min={1}
                      max={200}
                      value={estimatedHours}
                      onChange={(e) => setEstimatedHours(Number(e.target.value) || 1)}
                      className="w-full px-3 py-1.5 rounded border border-line bg-card text-text-0 outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="seed-tags"
                      className="block text-xs md:text-sm uppercase tracking-wider text-text-1 font-semibold mb-1"
                    >
                      Tags (comma separated)
                    </label>
                    <input
                      id="seed-tags"
                      type="text"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      className="w-full px-3 py-1.5 rounded border border-line bg-card text-text-0 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="seed-origin"
                    className="block text-xs md:text-sm uppercase tracking-wider text-text-1 font-semibold mb-1"
                  >
                    Origin Context / Quote
                  </label>
                  <input
                    id="seed-origin"
                    type="text"
                    placeholder="Sourced from infrastructure leads..."
                    value={originStory}
                    onChange={(e) => setOriginStory(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-line bg-card text-text-0 outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="seed-problem"
                    className="block text-xs md:text-sm uppercase tracking-wider text-text-1 font-semibold mb-1"
                  >
                    Problem Description
                  </label>
                  <textarea
                    id="seed-problem"
                    rows={3}
                    placeholder="Explain background constraints, concurrency requirements..."
                    value={problemStatement}
                    onChange={(e) => setProblemStatement(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-line bg-card text-text-0 outline-none leading-relaxed"
                  />
                </div>
                <div>
                  <label
                    htmlFor="seed-tech-reqs"
                    className="block text-xs md:text-sm uppercase tracking-wider text-text-1 font-semibold mb-1"
                  >
                    Technical Requirements (one per line)
                  </label>
                  <textarea
                    id="seed-tech-reqs"
                    rows={3}
                    placeholder="Atomic Lua scripts in Redis\nSub-millisecond latency check\nGraceful HTTP 429 response"
                    value={techReqs}
                    onChange={(e) => setTechReqs(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-line bg-card text-text-0 outline-none leading-relaxed"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-line">
                  <button
                    type="button"
                    onClick={() => setSeedModalOpen(false)}
                    className="btn-outline text-xs md:text-sm py-1.5 px-4"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-brass text-xs md:text-sm py-1.5 px-4">
                    Publish to Idea Bank
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
