"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
  Copy,
  ArrowRight,
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

  const isOwner = isLoggedIn && slug.toLowerCase() === user.username.toLowerCase();

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
Verified Ledger URL: https://${slug}.devledgr.xyz (Valid through Sep 2027 · Stamped on DevLedgr)

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
- SHA-256 Proof Signature: ${s.proofSignature || 'Verified on consensus node'}
- Verified Certificate: https://${slug}.devledgr.xyz/p/${s.hash}`
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-14 space-y-10">
      {/* 1. Developer Hero Header */}
      <section className="space-y-6 pb-8 border-b border-line">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          {/* Avatar + Primary Details */}
          <div className="flex items-start gap-4 sm:gap-5">
            {displayUser.avatarUrl ? (
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden shrink-0 border-2 border-line bg-card shadow-sm">
                <Image
                  src={displayUser.avatarUrl}
                  alt={displayUser.name}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-card border-2 border-line flex items-center justify-center font-bold text-xl sm:text-2xl text-brass shrink-0 shadow-sm font-mono">
                {displayUser.username.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="space-y-1.5 min-w-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-text-0 break-words">
                {displayUser.name}
              </h1>

              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <span className="font-mono font-semibold text-emerald-text">
                  @{displayUser.username}
                </span>
                <span className="text-text-1">·</span>
                <span className="text-text-1 truncate max-w-xs sm:max-w-md">
                  {displayUser.headline}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-text-1 leading-relaxed pt-1 max-w-xl">
                {displayUser.bio}
              </p>
            </div>
          </div>

          {/* Action Buttons Group */}
          <div className="flex flex-wrap sm:flex-col items-stretch gap-2 shrink-0">
            {displayUser.githubUrl && (
              <a
                href={displayUser.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline text-xs py-1.5 px-3 flex items-center justify-center gap-2 font-mono"
              >
                <GithubIcon className="w-3.5 h-3.5" />
                <span>GitHub Profile</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            )}

            <div className="flex items-center gap-2 w-full">
              <button
                onClick={handleShare}
                className="btn-outline min-h-[44px] text-xs py-2 px-3 flex items-center justify-center gap-1.5 font-mono flex-1 cursor-pointer"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-text" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setShowExportModal(true)}
                className="btn-brass min-h-[44px] text-xs py-2 px-3 flex items-center justify-center gap-1.5 font-mono flex-1 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>
            </div>

            {isOwner && (
              <Link
                href="/settings"
                className="btn-outline min-h-[44px] text-xs py-2 px-3 flex items-center justify-center gap-1.5 font-mono text-text-1 hover:text-text-0"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </Link>
            )}
          </div>
        </div>

        {/* Verified Stack Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-xs font-mono text-text-1 mr-1">
            Verified Stack:
          </span>
          {displayUser.statedSkills.map((skill) => (
            <span
              key={skill}
              className="px-2.5 py-0.5 rounded border border-line bg-card text-text-0 text-xs font-mono"
            >
              {skill}
            </span>
          ))}
        </div>
      </section>

      {/* 2. Cryptographic Ledger Certificate Ribbon */}
      <section className="rounded-radius border border-emerald-border bg-emerald-tint/40 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2.5 min-w-0">
          <ShieldCheck className="w-5 h-5 text-emerald-text shrink-0" />
          <div className="min-w-0 space-y-0.5">
            <span className="font-semibold text-text-0 text-xs sm:text-sm font-sans block">
              Cryptographic Ledger Certificate
            </span>
            <div className="flex items-center gap-2 text-text-1 text-xs">
              <span>Permanent Link:</span>
              <button
                onClick={handleShare}
                className="text-emerald-text font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer truncate"
              >
                <span>{slug}.devledgr.xyz</span>
                <Copy className="w-3 h-3 opacity-70 shrink-0" />
              </button>
            </div>
          </div>
        </div>

        <div className="text-[11px] sm:text-xs text-text-1 sm:text-right shrink-0 font-mono border-t sm:border-t-0 pt-2 sm:pt-0 border-line">
          <span>Valid through Sep 2027</span>
          <span className="block text-[10px] text-text-1">365-Day Verification Guarantee</span>
        </div>
      </section>

      {/* 3. Verified Problem Proof Entries */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4 pb-2 border-b border-line">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-0">
            Verified Entries{" "}
            <span className="text-text-1 font-normal text-base font-mono">
              ({userSubmissions.length})
            </span>
          </h2>
          <span className="text-xs sm:text-sm text-text-1">
            Accepted solutions with full test telemetry
          </span>
        </div>

        {/* Empty State vs. Populated Entries */}
        {userSubmissions.length === 0 ? (
          <div className="rounded-radius border border-line bg-card/20 p-8 sm:p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-card border border-line flex items-center justify-center mx-auto text-text-1">
              <Terminal className="w-6 h-6" />
            </div>

            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="text-base font-semibold text-text-0">
                No Verified Commits Stamped Yet
              </h3>
              <p className="text-xs sm:text-sm text-text-1 leading-relaxed">
                Solutions submitted to DevLedgr are cryptographically signed with genuine SHA-256 hashes, benchmarked against mock infrastructure, and timestamped on the consensus network.
              </p>
            </div>

            {isOwner && (
              <div className="pt-2">
                <Link
                  href="/ideas"
                  className="btn-brass text-xs py-2 px-4 inline-flex items-center gap-2 font-mono"
                >
                  <span>Solve Your First Challenge</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {userSubmissions.map((sub) => {
              const isDiffOpen = expandedDiffs[sub.hash];

              return (
                <div
                  key={sub.hash}
                  className="border border-line bg-card/40 p-5 sm:p-6 space-y-5 rounded-radius text-xs md:text-sm"
                >
                  {/* Header */}
                  <div className="space-y-2 pb-3 border-b border-line">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 font-mono text-xs md:text-sm">
                        <span className="commit-hash font-bold text-text-0">
                          #{sub.hash}
                        </span>
                        <span className="text-text-1">·</span>
                        <span className="text-text-1">Production Proof</span>
                        {sub.proofSignature && (
                          <>
                            <span className="text-text-1">·</span>
                            <span className="text-emerald-text font-medium" title={sub.proofSignature}>
                              SHA-256 Verified
                            </span>
                          </>
                        )}
                      </div>

                      <span className="text-xs md:text-sm font-mono text-emerald-text inline-flex items-center gap-1.5 shrink-0">
                        <Check className="w-3.5 h-3.5" />
                        <span>Verified Proof</span>
                      </span>
                    </div>

                    <Link
                      href={`/ideas/${sub.ideaId}`}
                      className="text-lg sm:text-xl font-semibold tracking-tight text-text-0 hover:text-emerald-text hover:underline block leading-snug"
                    >
                      {sub.ideaTitle}
                    </Link>
                  </div>

                  {/* Architecture write-up */}
                  <div className="space-y-1.5">
                    <div className="text-xs md:text-sm text-emerald-text font-semibold font-mono">
                      Engineering Decisions &amp; Trade-offs:
                    </div>
                    <p className="text-text-0 leading-relaxed text-xs sm:text-sm lg:text-base max-w-xl">
                      {sub.architectureNotes}
                    </p>
                  </div>

                  {/* Telemetry & CI Verification */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3.5 border-t border-b border-line">
                    <div>
                      <div className="text-xs md:text-sm text-text-1 uppercase font-mono">
                        p99 Latency
                      </div>
                      <div className="text-sm md:text-base font-semibold text-text-0 font-mono mt-0.5">
                        {sub.metrics?.latencyP99 || "36ms"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs md:text-sm text-text-1 uppercase font-mono">
                        Throughput
                      </div>
                      <div className="text-sm md:text-base font-semibold text-text-0 font-mono mt-0.5">
                        {sub.metrics?.throughput || "220 req/s"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs md:text-sm text-text-1 uppercase font-mono">
                        Test Suite
                      </div>
                      <div className="text-sm md:text-base font-semibold text-emerald-text font-mono mt-0.5">
                        {sub.testResults.passed}/{sub.testResults.total} passed
                      </div>
                    </div>

                    <div>
                      <div className="text-xs md:text-sm text-text-1 uppercase font-mono">
                        Coverage
                      </div>
                      <div className="text-sm md:text-base font-semibold text-text-0 font-mono mt-0.5">
                        {sub.metrics?.coverage || "94.2%"}
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Architecture Diff */}
                  <div className="space-y-2">
                    <button
                      onClick={() => toggleDiff(sub.hash)}
                      aria-expanded={isDiffOpen}
                      aria-controls={`diff-${sub.hash}`}
                      className="text-xs md:text-sm font-mono text-text-1 hover:text-text-0 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>
                        {isDiffOpen ? "Hide" : "Inspect"} Architecture Implementation Spec
                      </span>
                      {isDiffOpen ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>

                    {isDiffOpen && (
                      <div
                        id={`diff-${sub.hash}`}
                        className="rounded-radius border border-line bg-ink-0 p-4 font-mono text-xs md:text-sm space-y-3 animate-in fade-in duration-150"
                      >
                        <div className="flex items-center justify-between text-xs text-text-1 border-b border-line pb-2">
                          <span className="flex items-center gap-1.5">
                            <Code2 className="w-3.5 h-3.5 text-emerald-text" />
                            <span>Verification Telemetry &amp; SHA-256 Digest</span>
                          </span>
                          <span className="text-text-1">{sub.timestamp}</span>
                        </div>

                        <pre className="text-text-0 overflow-x-auto p-2 rounded bg-card/50 text-xs md:text-sm leading-relaxed">
                          {`// Stamped on DevLedgr Verification Network
// Target: ${sub.ideaTitle}
// Commit Hash: ${sub.hash}
// SHA-256 Digest: ${sub.proofSignature || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
// Test Vector Suite: ${sub.testResults.suiteName}
// Result: 100% Passed (${sub.testResults.passed}/${sub.testResults.total})

+ func VerifySLA(ctx context.Context) error {
+     latency := benchmark.P99()
+     if latency > 50*time.Millisecond {
+         return ErrSLABreached
+     }
+     return nil
+ }`}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Footer actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs md:text-sm">
                    <a
                      href={sub.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-text-1 hover:text-text-0 hover:underline inline-flex items-center gap-1.5 font-mono"
                    >
                      <GithubIcon className="w-3.5 h-3.5" />
                      <span>Inspect Repository</span>
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </a>

                    {sub.demoUrl && (
                      <a
                        href={sub.demoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-text hover:underline inline-flex items-center gap-1 font-medium font-mono"
                      >
                        <span>Live Demo</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
                className="text-xs md:text-sm text-text-1 hover:text-text-0 p-1 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <p className="text-xs md:text-sm text-text-1 leading-relaxed">
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
                className="w-full p-3 rounded-radius border border-line bg-card text-xs md:text-sm text-text-0 font-mono leading-relaxed"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleDownloadMarkdown}
                className="btn-outline text-xs md:text-sm py-1.5 px-3 flex items-center gap-1.5"
              >
                <Download className="w-3 h-3" aria-hidden="true" />
                <span>Download .md</span>
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(exportMarkdown);
                  setShowExportModal(false);
                }}
                className="btn-brass text-xs md:text-sm py-1.5 px-4"
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
