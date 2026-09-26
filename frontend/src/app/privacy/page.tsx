import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandMark } from '@/components/brand/BrandMark';
import {
  ShieldCheck,
  Lock,
  Eye,
  Key,
  Database,
  Cpu,
  Server,
  UserCheck,
  CheckCircle2,
  Mail,
  ArrowRight,
  Globe,
  FileCheck,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy Policy for DevLedgr: how we handle developer telemetry, cryptographic commit hashes, BYOK AI keys, and public portfolios.',
  alternates: {
    canonical: '/privacy',
  },
};

const SECTIONS = [
  { id: 'philosophy', title: '1. Privacy Philosophy & Overview' },
  { id: 'data-collected', title: '2. Information We Collect' },
  { id: 'how-we-use', title: '3. How We Use Telemetry & Data' },
  { id: 'public-vs-private', title: '4. Public vs. Private Boundary' },
  { id: 'ai-training-policy', title: '5. AI Processing & Zero-Training Guarantee' },
  { id: 'byok-security', title: '6. BYOK (Bring Your Own Key) Security' },
  { id: 'third-party-sharing', title: '7. Third-Party Disclosures & Infra' },
  { id: 'retention-cycles', title: '8. Data Retention & 365-Day Lifecycles' },
  { id: 'user-rights', title: '9. Your Rights (GDPR, CCPA/CPRA, NDPR)' },
  { id: 'cookies-storage', title: '10. Cookies & Local Storage Disclosures' },
  { id: 'security-controls', title: '11. Security & Cryptographic Controls' },
  { id: 'international-transfers', title: '12. International Data Transfers' },
  { id: 'children', title: '13. Children\'s Privacy' },
  { id: 'contact-dpo', title: '14. DPO & Contact Information' },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-20 font-sans text-text-0 space-y-12">
      {/* Header & Badges */}
      <header className="space-y-6 border-b border-line pb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandMark size={36} />
            <div>
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-text">
                Data Protection & Trust
              </span>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text-0">
                Privacy Policy
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-text-1">
            <span className="px-2.5 py-1 rounded bg-card border border-line">
              Version 2.4.0
            </span>
            <span className="px-2.5 py-1 rounded bg-card border border-line">
              Effective: September 26, 2026
            </span>
          </div>
        </div>

        <p className="text-base sm:text-lg text-text-1 leading-relaxed max-w-3xl">
          At <strong className="text-text-0">DevLedgr</strong> (&ldquo;DevLedgr,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;),
          we treat developer data with the same rigorous standard we apply to distributed systems code.
          Our guiding philosophy is <strong className="text-text-0">Proof, Not Surveillance</strong>: we collect only what is strictly necessary
          to verify engineering competencies, execute automated test harnesses, and sign permanent proof-of-work certificates.
        </p>

        {/* Quick Nav Pill between Terms and Privacy */}
        <div className="flex items-center gap-3 pt-2 text-xs font-mono">
          <span className="text-text-1">Document Switcher:</span>
          <Link
            href="/terms"
            className="px-3 py-1 rounded-radius bg-card/60 border border-line text-text-1 hover:text-text-0 hover:border-text-1 transition-colors flex items-center gap-1"
          >
            <span>Terms of Service</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
          <span className="px-3 py-1 rounded-radius bg-card border border-emerald/50 text-emerald-text font-semibold">
            Privacy Policy (Active)
          </span>
        </div>
      </header>

      {/* Core Privacy Guarantees Callout */}
      <section aria-labelledby="privacy-guarantees" className="p-6 rounded-radius border border-emerald/25 bg-emerald/5 space-y-4">
        <div className="flex items-center gap-2.5 text-emerald-text font-semibold text-sm font-mono uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          <h2 id="privacy-guarantees" className="text-sm font-mono uppercase font-semibold">
            The DevLedgr Privacy Contract
          </h2>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm text-text-1">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald shrink-0 mt-0.5" />
            <span><strong>No Selling of Data:</strong> We never sell your personal information, resumes, or code telemetry to advertisers or data brokers.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald shrink-0 mt-0.5" />
            <span><strong>Zero Model Training:</strong> We do NOT use your private code or problem submissions to train public AI foundation models.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald shrink-0 mt-0.5" />
            <span><strong>Encrypted BYOK Keys:</strong> Personal Gemini or OpenAI API keys are kept encrypted or client-side and never logged in plain text.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald shrink-0 mt-0.5" />
            <span><strong>Explicit Public Boundary:</strong> You control what appears on your public portfolio (<code className="font-mono text-xs bg-card px-1 py-0.5 rounded border border-line">/p/[username]</code>) versus what remains private.</span>
          </li>
        </ul>
      </section>

      {/* Table of Contents */}
      <nav aria-label="Table of contents" className="p-5 rounded-radius border border-line bg-card/40 space-y-3">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-text-1">
          Index of Privacy Sections
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs md:text-sm font-mono">
          {SECTIONS.map((sec) => (
            <a
              key={sec.id}
              href={`#${sec.id}`}
              className="text-text-1 hover:text-emerald-text hover:underline transition-colors flex items-center gap-1.5"
            >
              <span className="text-line">›</span>
              <span>{sec.title}</span>
            </a>
          ))}
        </div>
      </nav>

      {/* Detailed Sections */}
      <article className="space-y-12 text-sm sm:text-base leading-relaxed text-text-1">
        {/* Section 1 */}
        <section id="philosophy" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <ShieldCheck className="w-5 h-5 text-emerald-text" />
            <h2>1. Privacy Philosophy & Platform Scope</h2>
          </div>
          <p>
            Traditional developer recruitment platforms harvest resumes, monitor keystrokes, and trade candidate profiles across shadowy lead lists.
            DevLedgr was created to build a clean cryptographic ledger for software engineers.
          </p>
          <p>
            We adhere to data minimization principles: we collect only what is strictly required to verify that your code solves realistic systems problems,
            generate verifiable SHA-256 commit hashes, and host your 365-day public proof portfolio.
          </p>
        </section>

        {/* Section 2 */}
        <section id="data-collected" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <Database className="w-5 h-5 text-emerald-text" />
            <h2>2. Information We Collect</h2>
          </div>
          <p>We collect information in three categories:</p>

          <div className="space-y-4">
            <div className="p-4 rounded-radius border border-line bg-card/50 space-y-2">
              <h3 className="font-semibold text-text-0 text-sm">
                A. Information You Directly Provide
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                <li><strong>Identity & Profile:</strong> Full name, canonical username handle (<code className="font-mono text-xs">@username</code>), bio, headline, avatar URL, and GitHub profile link.</li>
                <li><strong>Verified Recruiter Contact:</strong> The email address you designate for direct hiring inquiries.</li>
                <li><strong>Stated Technical Stacks:</strong> Programming languages, frameworks, databases, and architectural paradigms you manually select or tag in your settings.</li>
                <li><strong>BYOK AI Credentials:</strong> Personal API keys (e.g., Google Gemini or OpenAI) that you optionally input in Settings to power architectural reviews and CV synthesis.</li>
              </ul>
            </div>

            <div className="p-4 rounded-radius border border-line bg-card/50 space-y-2">
              <h3 className="font-semibold text-text-0 text-sm">
                B. Authentication & Repository Information (Via OAuth)
              </h3>
              <p className="text-xs sm:text-sm">
                When you connect via GitHub or Google through Supabase Auth, we receive:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                <li>Third-party OAuth ID, avatar image, and verified primary email;</li>
                <li>Public repository references and commit SHA hashes that you explicitly submit for challenge verification;</li>
                <li>PGP commit signing identities where available to confirm author cryptographic origin.</li>
              </ul>
              <p className="text-xs sm:text-sm font-mono text-text-1">
                Note: We never request or receive write access to your private GitHub repositories.
              </p>
            </div>

            <div className="p-4 rounded-radius border border-line bg-card/50 space-y-2">
              <h3 className="font-semibold text-text-0 text-sm">
                C. Telemetry, Execution Logs & Cryptographic Hashes
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                <li><strong>CI Execution Telemetry:</strong> CPU cycles, memory usage, latency percentiles, and test pass/fail logs recorded when your solution runs inside our mock fleet runners;</li>
                <li><strong>Deterministic Hashes:</strong> SHA-256 digest of your solution files and Ed25519 cryptographic signatures generated by the DevLedgr consensus engine;</li>
                <li><strong>Technical Diagnostics:</strong> Standard HTTP request data including IP address, user-agent, operating system, and access timestamps for rate-limiting and intrusion detection.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section id="how-we-use" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <Cpu className="w-5 h-5 text-emerald-text" />
            <h2>3. How We Use Telemetry & Data</h2>
          </div>
          <p>DevLedgr utilizes collected information exclusively for the following operational purposes:</p>
          <ul className="list-disc pl-6 space-y-2 text-xs sm:text-sm">
            <li><strong>Challenge Verification:</strong> Running automated CI test harnesses against your code and generating verified solution badges;</li>
            <li><strong>Cryptographic Stamping:</strong> Calculating and timestamping immutable SHA-256 commit hashes and Ed25519 signature guarantees;</li>
            <li><strong>Public Portfolio Hosting:</strong> Serving your verifiable developer portfolio at <code className="font-mono text-xs bg-card px-1 py-0.5 rounded border border-line">/p/[username]</code> for 365 days;</li>
            <li><strong>ATS-Safe Resume Generation:</strong> Translating verified proof-of-work telemetry into recruiter-readable Markdown CV packages;</li>
            <li><strong>Algorithmic Job Matching:</strong> Comparing verified candidate technical telemetry against production constraints in company requisitions;</li>
            <li><strong>Security & Abuse Prevention:</strong> Detecting runner container escapes, cryptomining scripts, DDoS attempts, and automated plagiarism.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section id="public-vs-private" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <Eye className="w-5 h-5 text-emerald-text" />
            <h2>4. Public vs. Private Information Boundary</h2>
          </div>
          <p>
            Transparency is central to the DevLedgr ledger, but personal privacy is equally sacrosanct.
            Here is the clear demarcation of what is public versus what remains strictly confidential:
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border border-line rounded-radius overflow-hidden">
              <thead className="bg-card font-mono uppercase text-text-1 border-b border-line">
                <tr>
                  <th className="p-3">Data Field</th>
                  <th className="p-3">Visibility</th>
                  <th className="p-3">Where It Appears</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr>
                  <td className="p-3 font-medium text-text-0">Public Handle & Name</td>
                  <td className="p-3 text-emerald-text font-mono">PUBLIC</td>
                  <td className="p-3">Public portfolio (<code className="font-mono text-xs">/p/[slug]</code>) & ledger index</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-text-0">Completed Challenges & Badges</td>
                  <td className="p-3 text-emerald-text font-mono">PUBLIC</td>
                  <td className="p-3">Proof list & cryptographic certificate payload</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-text-0">SHA-256 Commit Hashes & Timestamps</td>
                  <td className="p-3 text-emerald-text font-mono">PUBLIC</td>
                  <td className="p-3">Ledger entry inspection rows & verification tools</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-text-0">Stated Skills Cloud</td>
                  <td className="p-3 text-emerald-text font-mono">PUBLIC</td>
                  <td className="p-3">Portfolio technical stack section</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-text-0">Personal BYOK API Keys</td>
                  <td className="p-3 text-rose-600 dark:text-rose-400 font-mono font-bold">STRICTLY PRIVATE</td>
                  <td className="p-3">Client storage / encrypted memory only; never displayed</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-text-0">Recruiter Contact Email</td>
                  <td className="p-3 text-amber-500 font-mono">CONTROLLED ACCESS</td>
                  <td className="p-3">Revealed only to verified hiring partners upon match</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-text-0">Failed Test Stderr & Debug Dumps</td>
                  <td className="p-3 text-text-1 font-mono">PRIVATE TO CANDIDATE</td>
                  <td className="p-3">Private candidate dashboard; never published to employers</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 5 */}
        <section id="ai-training-policy" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <Lock className="w-5 h-5 text-emerald-text" />
            <h2>5. AI Processing & Zero-Training Guarantee</h2>
          </div>
          <div className="p-5 rounded-radius border border-emerald/30 bg-emerald/5 space-y-3">
            <div className="text-base font-semibold text-text-0">
              Our Zero Foundation Model Training Guarantee
            </div>
            <p className="text-xs sm:text-sm text-text-1 leading-relaxed">
              DevLedgr does <strong>NOT</strong> sell, license, or provide your source code, submitted pull requests,
              or test outputs to third parties to train generalized artificial intelligence foundation models.
            </p>
          </div>
          <p>
            When our AI Scrutiny engine evaluates your architecture or drafts an ATS-compatible resume, your code snippets are transmitted
            to model inference endpoints (such as Google Gemini via Google Cloud Vertex or OpenAI API) under enterprise data-privacy terms
            where data retention for model improvement is disabled by default.
          </p>
        </section>

        {/* Section 6 */}
        <section id="byok-security" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <Key className="w-5 h-5 text-emerald-text" />
            <h2>6. BYOK (Bring Your Own Key) Security</h2>
          </div>
          <p>
            DevLedgr offers a first-class Bring-Your-Own-Key (&ldquo;BYOK&rdquo;) tier for developers who wish to retain absolute ownership
            over their AI compute:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-xs sm:text-sm">
            <li><strong>Local / Encrypted Storage:</strong> Your API keys are stored within your browser&apos;s secured local storage or encrypted in memory during transient API calls.</li>
            <li><strong>No Centralized Harvest:</strong> We do not log, persist in plaintext databases, or aggregate BYOK keys across users.</li>
            <li><strong>Instant Revocation:</strong> You can clear or update your key at any moment with one click in your <Link href="/settings" className="text-emerald-text underline">Account Settings</Link>.</li>
          </ul>
        </section>

        {/* Section 7 */}
        <section id="third-party-sharing" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <Server className="w-5 h-5 text-emerald-text" />
            <h2>7. Third-Party Disclosures & Infrastructure Partners</h2>
          </div>
          <p>We do not share your personal information except with trusted service providers who assist us in operating our platform:</p>
          <ul className="list-disc pl-6 space-y-2 text-xs sm:text-sm">
            <li><strong>Supabase:</strong> For enterprise authentication, session tokens, and database infrastructure.</li>
            <li><strong>Cloud Runner Fleets:</strong> Containerized Linux environments orchestrating isolated test suites.</li>
            <li><strong>AI Gateway Providers:</strong> Google Cloud and OpenAI for code scrutiny and CV compilation.</li>
            <li><strong>Verified Employers & Recruiters:</strong> Only when you affirmatively submit a solution to an employer-sponsored problem or authorize candidate matching outreach.</li>
            <li><strong>Legal Compliance:</strong> When required by lawful summons, court order, or to prevent immediate physical harm or cyberattacks.</li>
          </ul>
        </section>

        {/* Section 8 */}
        <section id="retention-cycles" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <FileCheck className="w-5 h-5 text-emerald-text" />
            <h2>8. Data Retention & 365-Day Lifecycles</h2>
          </div>
          <p>
            <strong>8.1 365-Day Portfolio Validity:</strong> Successful ledger entries are guaranteed to be verifiable at your canonical URL
            for 365 days from the date of consensus stamping. Following the 365-day active period, you may re-stamp your solution or archive the record.
          </p>
          <p>
            <strong>8.2 Transient Test Logs:</strong> Raw stderr and standard execution logs from failed sandbox attempts are automatically purged after 30 days.
          </p>
          <p>
            <strong>8.3 Account Deletion:</strong> If you delete your account, your profile, contact email, and private drafts are purged within 14 business days.
            Public cryptographic hashes already signed into the immutable ledger may remain indexed in an anonymized, detached form to preserve network consensus integrity.
          </p>
        </section>

        {/* Section 9 */}
        <section id="user-rights" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <UserCheck className="w-5 h-5 text-emerald-text" />
            <h2>9. Your Privacy Rights (GDPR, CCPA/CPRA, NDPR)</h2>
          </div>
          <p>
            Regardless of where you reside, DevLedgr extends comprehensive privacy rights to all developers:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div className="p-3.5 rounded-radius border border-line bg-card/40 space-y-1">
              <strong className="text-text-0 font-mono">Right to Access & Portability</strong>
              <p className="text-text-1">You may export all stamped solution metadata, telemetry records, and your ATS-safe CV in open JSON and Markdown formats.</p>
            </div>
            <div className="p-3.5 rounded-radius border border-line bg-card/40 space-y-1">
              <strong className="text-text-0 font-mono">Right to Rectification</strong>
              <p className="text-text-1">You can update your name, headline, bio, contact email, and technical stack index at any time in Settings.</p>
            </div>
            <div className="p-3.5 rounded-radius border border-line bg-card/40 space-y-1">
              <strong className="text-text-0 font-mono">Right to Erasure (&ldquo;To Be Forgotten&rdquo;)</strong>
              <p className="text-text-1">You may request the deletion of your account and the unpublishing of your public portfolio URL.</p>
            </div>
            <div className="p-3.5 rounded-radius border border-line bg-card/40 space-y-1">
              <strong className="text-text-0 font-mono">Right to Non-Discrimination</strong>
              <p className="text-text-1">We will never penalize, degrade service, or alter fees if you exercise any of your legal privacy rights.</p>
            </div>
          </div>
          <p className="text-xs sm:text-sm pt-2">
            To exercise any of these rights, email our data desk at <a href="mailto:privacy@devledgr.xyz" className="text-emerald-text underline">privacy@devledgr.xyz</a>.
          </p>
        </section>

        {/* Section 10 */}
        <section id="cookies-storage" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <Database className="w-5 h-5 text-emerald-text" />
            <h2>10. Cookies & Local Storage Disclosures</h2>
          </div>
          <p>
            DevLedgr does <strong>NOT</strong> use third-party behavioral advertising cookies, Facebook pixels, or invasive surveillance scripts.
            We use strictly necessary and functional browser storage:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-xs sm:text-sm">
            <li><code className="font-mono text-xs bg-card px-1.5 py-0.5 rounded border border-line">sb-auth-token / devledgr_token</code>: Secure HTTP-only cookies maintaining your authenticated developer session.</li>
            <li><code className="font-mono text-xs bg-card px-1.5 py-0.5 rounded border border-line">devledgr_storage_v1</code>: Client-side local storage storing your selected theme (dark/light) and active UI preferences.</li>
          </ul>
        </section>

        {/* Section 11 */}
        <section id="security-controls" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <ShieldCheck className="w-5 h-5 text-emerald-text" />
            <h2>11. Security & Cryptographic Safeguards</h2>
          </div>
          <p>
            We implement layered defense-in-depth security to protect your code and telemetry:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-xs sm:text-sm">
            <li>All network communications are encrypted in transit via TLS 1.3 with strict HSTS enforcement;</li>
            <li>Database instances utilize AES-256 encryption at rest with automated backup snapshots;</li>
            <li>Test runner execution sandboxes run under non-root ephemeral containers with seccomp, AppArmor, and disabled network access during untrusted code execution;</li>
            <li>Root consensus signing keys are isolated in hardware security modules (HSM) or encrypted secrets managers with multi-party access control.</li>
          </ul>
        </section>

        {/* Section 12 */}
        <section id="international-transfers" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <Globe className="w-5 h-5 text-emerald-text" />
            <h2>12. International Data Transfers</h2>
          </div>
          <p>
            DevLedgr operates globally. By using the platform, you acknowledge that your information may be processed on servers
            located in the United States, the European Union, and other cloud provider regions. Where data is transferred across international
            borders, we ensure appropriate safeguards including Standard Contractual Clauses (SCCs) are in effect.
          </p>
        </section>

        {/* Section 13 */}
        <section id="children" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <Lock className="w-5 h-5 text-text-1" />
            <h2>13. Children&apos;s Privacy</h2>
          </div>
          <p>
            DevLedgr is designed for software engineers and is not intended for children under the age of 13 (or under 16 in the EEA/UK).
            We do not knowingly collect personal data from minors. If you believe a minor has registered an account without parental consent,
            please notify us immediately at <a href="mailto:privacy@devledgr.xyz" className="text-emerald-text underline">privacy@devledgr.xyz</a>.
          </p>
        </section>

        {/* Section 14 */}
        <section id="contact-dpo" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <Mail className="w-5 h-5 text-emerald-text" />
            <h2>14. Data Protection Officer (DPO) & Privacy Inquiries</h2>
          </div>
          <p>
            If you have questions, concerns, or requests regarding this Privacy Policy or our handling of your telemetry and cryptographic proofs,
            our Data Protection Officer is directly reachable:
          </p>

          <div className="p-5 rounded-radius border border-line bg-card space-y-3 mt-4">
            <h3 className="font-semibold text-text-0 text-sm">
              DevLedgr Privacy & Data Protection Office
            </h3>
            <div className="text-xs sm:text-sm font-mono space-y-1">
              <div>Email: <a href="mailto:privacy@devledgr.xyz" className="text-emerald-text underline font-semibold">privacy@devledgr.xyz</a></div>
              <div>Data Protection Officer: <a href="mailto:dpo@devledgr.xyz" className="text-emerald-text underline font-semibold">dpo@devledgr.xyz</a></div>
              <div>Security Vulnerabilities: <a href="mailto:security@devledgr.xyz" className="text-emerald-text underline font-semibold">security@devledgr.xyz</a></div>
            </div>
            <p className="text-xs text-text-1 pt-2">
              We respond to all verified privacy and data-rights inquiries within thirty (30) calendar days.
            </p>
          </div>
        </section>
      </article>

      {/* Footer Navigation Strip */}
      <footer className="pt-8 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-text-1">
        <div>Document: DevLedgr Privacy Policy v2.4 (2026)</div>
        <div className="flex items-center gap-4">
          <Link href="/terms" className="text-emerald-text hover:underline">
            Read Terms of Service →
          </Link>
          <a href="#main-content" className="hover:text-text-0">
            Back to Top ↑
          </a>
        </div>
      </footer>
    </div>
  );
}
