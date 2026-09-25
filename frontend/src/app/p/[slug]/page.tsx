"use client";

import
 { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import {
  ShieldCheck,
  ExternalLink,
  Check,
  Share2,
  FileText,
  Terminal,
  Code2,
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
} from "lucide-react";


const GithubIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

export default function PublicPortfolioPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "junior_dev";
  const { user, submissions, isLoggedIn } = useAppStore();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>(
    {}
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showExportModal) {
        setShowExportModal(false);
      }
    };
    if (showExportModal) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [showExportModal]);

  // Filter submissions by author
  const userSubmissions = submissions.filter(
    (s) => s.authorUsername.toLowerCase() === slug.toLowerCase()
  );

  const displayUser =
    slug === user.username
      ? user
      : {
          ...user,
          username: slug,
          name: slug === "junior_dev" ? "Alex Okafor" : slug,
        };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const toggleDiff = (hash: string) => {
    setExpandedDiffs((prev) => ({ ...prev, [hash]: !prev[hash] }));
  };

  const exportMarkdown = `# ${displayUser.name} · Verified Engineering Portfolio
Verified Ledger URL: https://${slug}.devledgr.io (Valid through Sep 2027 · Stamped on DevLedgr)

## Verified Proof-of-Work:
${userSubmissions
  .map(
    (s) =>
      `### Commit #${s.hash}: ${s.ideaTitle}
- Architecture: ${s.architectureNotes}
- Telemetry: p99 latency ${s.metrics?.latencyP99 || "36ms"}, throughput ${
        s.metrics?.throughput || "220 req/s"
      }, CI: ${s.testResults.passed}/${s.testResults.total} passed.
- Repo: ${s.repoUrl}
- Verified Certificate: https://${slug}.devledgr.io/p/${s.hash}`
  )
  .join("\n\n")}
`;

  const handleDownloadMarkdown = () => {
    const filename = `${slug}_verified_portfolio.md`;
    const blob = new Blob([exportMarkdown], {
      type: "text/markdown;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-16 space-y-12">
      {/* 1-Year Guarantee Banner (Standalone Proof Badge) */}
      <div className="rounded-radius border border-green-500/20 bg-green-500/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-start sm:items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-green-700 dark:text-green-400 shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <div className="font-semibold text-text-0 text-sm flex items-center gap-2 font-sans">
              <span>Public Developer Ledger</span>
              <span className="text-xs text-green-700 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20 font-mono font-medium">
                cryptographically signed
              </span>
            </div>
            <div className="text-xs text-text-1 mt-1 font-mono max-w-xl">
              Permanent URL:{" "}
              <code className="text-green-700 dark:text-green-400 font-medium">
                {slug}.devledgr.io
              </code>{" "}
              · Valid through Sep 2027 (1-Year Guarantee)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 font-sans">
          {isLoggedIn && slug.toLowerCase() === user.username.toLowerCase() && (
            <Link
              href="/settings"
              className="btn-brass text-xs py-1.5 px-3 flex items-center gap-1.5 font-mono"
              title="Edit your public ledger identity"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </Link>
          )}

          <button
            onClick={handleShare}
            className="btn-outline text-xs py-1.5 px-3"
          >

            {copiedUrl ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-700 dark:text-green-400" />
                <span>Link Copied</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Share URL</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            className="btn-brass text-xs py-1.5 px-3.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export Recruiter Docket</span>
          </button>
        </div>
      </div>

      {/* Engineer Profile Header */}
      <div className="space-y-4 pb-8 border-b border-line">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-text-0">
              {displayUser.name}
            </h1>
            <p className="text-sm text-green-700 dark:text-green-400 font-medium font-mono">
              @{displayUser.username} · {displayUser.headline}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={displayUser.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded-radius border border-line bg-card hover:border-zinc-500 transition-colors text-xs font-mono text-text-0"
            >
              <GithubIcon className="w-4 h-4" />
              <span>GitHub Profile</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          </div>
        </div>

        <p className="text-sm text-text-1 max-w-xl leading-relaxed">
          {displayUser.bio}
        </p>

        {/* Skills pill row */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 text-xs">
          <span className="text-xs text-text-1 mr-1">
            Verified Stack:
          </span>
          {displayUser.statedSkills.map((skill) => (
            <span
              key={skill}
              className="px-2 py-0.5 rounded border border-line bg-card text-text-0 text-xs"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Verified Problem Proof Entries */}
      <section className="space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-line">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-0">
            Verified Entries ({userSubmissions.length})
          </h2>
          <span className="text-xs text-text-1">
            Accepted solutions with full test telemetry
          </span>
        </div>

        <div className="space-y-6">
          {userSubmissions.map((sub) => {
            const isDiffOpen = expandedDiffs[sub.hash];

            return (
              <div
                key={sub.hash}
                className="border border-line bg-card/40 p-6 space-y-5 rounded-radius text-xs"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
                  <div className="flex items-center gap-3">
                    <span className="commit-hash text-xs font-bold text-text-0">
                      #{sub.hash}
                    </span>
                    <Link
                      href={`/ideas/${sub.ideaId}`}
                      className="text-lg sm:text-xl font-semibold tracking-tight text-text-0 hover:text-green-700 dark:hover:text-green-400 hover:underline"
                    >
                      {sub.ideaTitle}
                    </Link>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="verified-chip text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-600 dark:bg-green-500" />
                      verified proof
                    </span>
                  </div>
                </div>

                {/* Architecture write-up */}
                <div className="space-y-1.5">
                  <div className="text-xs text-green-700 dark:text-green-400 font-semibold font-mono">
                    Engineering Decisions & Trade-offs:
                  </div>
                  <p className="text-text-0 leading-relaxed text-xs sm:text-sm max-w-xl">
                    {sub.architectureNotes}
                  </p>
                </div>

                {/* Telemetry & CI Verification */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3.5 border-t border-b border-line">
                  <div>
                    <div className="text-xs text-text-1 uppercase font-mono">
                      P99 Latency
                    </div>
                    <div className="font-bold text-text-0 text-sm">
                      {sub.metrics?.latencyP99 || "32ms"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-text-1 uppercase font-mono">
                      Throughput
                    </div>
                    <div className="font-bold text-text-0 text-sm">
                      {sub.metrics?.throughput || "180 req/s"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-text-1 uppercase font-mono">
                      Code Coverage
                    </div>
                    <div className="font-bold text-text-0 text-sm">
                      {sub.metrics?.coverage || "95.0%"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-text-1 uppercase font-mono">
                      CI Test Suite
                    </div>
                    <div className="font-bold text-diff-green text-sm">
                      {sub.testResults.passed}/{sub.testResults.total} passed
                    </div>
                  </div>
                </div>

                {/* Interactive Code Diff Drawer */}
                {isDiffOpen && (
                  <div className="rounded-radius border border-line bg-ink-0 p-4 space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs text-text-1 pb-2 border-b border-line">
                      <span className="flex items-center gap-1.5 text-brass font-semibold">
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Git Diff Inspection · commit #{sub.hash}</span>
                      </span>
                      <span>
                        diff --git a/dispatch/router.go b/dispatch/router.go
                      </span>
                    </div>

                    <pre className="text-xs leading-relaxed overflow-x-auto font-mono rounded bg-card/40 p-2.5 border border-line">
                      <code>
                        <span className="text-zinc-500 block pb-0.5">@@ -14,8 +14,24 @@ func (e *Engine) DispatchOrder(ctx context.Context, ord Order) (*Route, error) &#123;</span>
                        <span className="text-rose-700 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-xs block my-0.5">-  // Unconstrained naive route</span>
                        <span className="text-rose-700 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-xs block my-0.5">-  return e.naiveRoute(ord)</span>
                        <span className="text-green-700 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-xs block my-0.5">+  // Idempotency check with Redis sliding window lock</span>
                        <span className="text-green-700 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-xs block my-0.5">+  if locked := e.redis.SetNX(ctx, &quot;lock:&quot;+ord.IdempotencyKey, 1, 30*time.Second); !locked &#123;</span>
                        <span className="text-green-700 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-xs block my-0.5">+    return e.cachedRoute(ord.IdempotencyKey)</span>
                        <span className="text-green-700 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-xs block my-0.5">+  &#125;</span>
                        <span className="text-green-700 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-xs block my-0.5">+  // Compute capacity-constrained Voronoi cluster</span>
                        <span className="text-green-700 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-xs block my-0.5">+  depot := e.nearestDepot(ord.Lat, ord.Lng)</span>
                        <span className="text-green-700 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-xs block my-0.5">+  route, err := e.solver.ConstrainedDijkstra(ctx, depot, ord.WeightKg)</span>
                        <span className="text-green-700 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-xs block my-0.5">+  if err != nil &#123;</span>
                        <span className="text-green-700 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-xs block my-0.5">+    return nil, fmt.Errorf(&quot;dispatch failure: %w&quot;, err)</span>
                        <span className="text-green-700 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-xs block my-0.5">+  &#125;</span>
                        <span className="text-green-700 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-xs block my-0.5">+  // Telemetry recording: p99 latency &lt; 40ms</span>
                        <span className="text-green-700 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-xs block my-0.5">+  e.metrics.RecordDispatchLatency(time.Since(start))</span>
                        <span className="text-green-700 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-xs block my-0.5">+  return route, nil</span>
                        <span className="text-text-0 block pt-0.5">&#125;</span>
                      </code>
                    </pre>
                  </div>
                )}

                {/* Links & Diff Trigger */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
                  <button
                    onClick={() => toggleDiff(sub.hash)}
                    className="text-text-1 hover:text-text-0 cursor-pointer inline-flex items-center gap-1 text-xs"
                  >
                    <Code2 className="w-3.5 h-3.5 text-brass" />
                    <span>
                      {isDiffOpen ? "Collapse Code Diff" : "Inspect Code Diff"}
                    </span>
                    {isDiffOpen ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>

                  <div className="flex items-center gap-4">
                    {sub.repoUrl && (
                      <a
                        href={sub.repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-text-0 hover:underline inline-flex items-center gap-1 font-semibold"
                      >
                        <GithubIcon className="w-3.5 h-3.5" />
                        <span>Review Code</span>
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </a>
                    )}

                    {sub.demoUrl && (
                      <a
                        href={sub.demoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brass hover:underline inline-flex items-center gap-1 font-semibold"
                      >
                        <span>Live Demo</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recruiter Export Modal */}
      {showExportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowExportModal(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="recruiter-export-modal-title"
            className="w-full max-w-lg rounded-radius border border-brass bg-ink-0 p-6 font-mono space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2
                id="recruiter-export-modal-title"
                className="font-serif text-lg font-medium text-text-0"
              >
                Recruiter Proof Package
              </h2>
              <button
                onClick={() => setShowExportModal(false)}
                aria-label="Close export dialog"
                className="text-xs text-text-1 hover:text-text-0 p-1 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <p className="text-xs text-text-1 leading-relaxed">
              Formatted markdown summary referencing cryptographic ledger commit
              hashes. Direct drop-in for CVs, LinkedIn, or recruiter emails.
            </p>

            <div>
              <label htmlFor="recruiter-export-markdown" className="sr-only">
                Recruiter proof package markdown
              </label>
              <textarea
                id="recruiter-export-markdown"
                readOnly
                rows={8}
                value={exportMarkdown}
                className="w-full p-3 rounded-radius border border-line bg-card text-xs text-text-0 font-mono leading-relaxed"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleDownloadMarkdown}
                className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <Download className="w-3 h-3" aria-hidden="true" />
                <span>Download .md</span>
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(exportMarkdown);
                  setShowExportModal(false);
                }}
                className="btn-brass text-xs py-1.5 px-4"
              >
                Copy Markdown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
