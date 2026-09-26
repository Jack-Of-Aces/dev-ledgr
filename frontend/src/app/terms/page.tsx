import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandMark } from '@/components/brand/BrandMark';
import {
  FileText,
  Shield,
  Scale,
  Key,
  Cpu,
  Server,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  Mail,
  ArrowRight,
  Lock,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms of Service and Master Platform Agreement for DevLedgr: verifiable proof of work, cryptographic portfolio guarantees, CI sandboxing, and AI compute.',
  alternates: {
    canonical: '/terms',
  },
};

const SECTIONS = [
  { id: 'acceptance', title: '1. Acceptance & Overview' },
  { id: 'eligibility-identity', title: '2. Identity & Account Integrity' },
  { id: 'platform-services', title: '3. Problem Specs & CI Sandboxes' },
  { id: 'cryptographic-ledger', title: '4. Cryptographic Stamping & Guarantees' },
  { id: 'ip-ownership', title: '5. Intellectual Property & Code Rights' },
  { id: 'acceptable-use', title: '6. Acceptable Use & Security Rules' },
  { id: 'ai-byok', title: '7. AI Compute & BYOK (Bring Your Own Key)' },
  { id: 'recruiter-matching', title: '8. Recruiter Matching & Opportunities' },
  { id: 'subscriptions-fees', title: '9. Subscriptions, Fees & Billing' },
  { id: 'disclaimers', title: '10. Disclaimers & "As Is" Operations' },
  { id: 'liability', title: '11. Limitation of Liability' },
  { id: 'suspension-delisting', title: '12. Suspension & Revocation' },
  { id: 'governing-law', title: '13. Dispute Resolution & Governing Law' },
  { id: 'contact', title: '14. Amendments & Legal Contact' },
];

export default function TermsOfServicePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 md:py-20 font-sans text-text-0 space-y-12">
      {/* Header & Badges */}
      <header className="space-y-6 border-b border-line pb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandMark size={36} />
            <div>
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-text">
                Protocol Legal Framework
              </span>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text-0">
                Terms of Service
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
          Welcome to <strong className="text-text-0">DevLedgr</strong> (&ldquo;DevLedgr,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;).
          These Terms of Service govern your access to and use of devledgr.xyz, our automated continuous integration (CI) test runners,
          cryptographic consensus stamping, Bring-Your-Own-Key (BYOK) AI evaluation mesh, public portfolio URLs (<code className="font-mono text-xs bg-card px-1.5 py-0.5 rounded border border-line">/p/[username]</code>),
          and developer matching systems.
        </p>

        {/* Quick Nav Pill between Terms and Privacy */}
        <div className="flex items-center gap-3 pt-2 text-xs font-mono">
          <span className="text-text-1">Document Switcher:</span>
          <span className="px-3 py-1 rounded-radius bg-card border border-emerald/50 text-emerald-text font-semibold">
            Terms of Service (Active)
          </span>
          <Link
            href="/privacy"
            className="px-3 py-1 rounded-radius bg-card/60 border border-line text-text-1 hover:text-text-0 hover:border-text-1 transition-colors flex items-center gap-1"
          >
            <span>Privacy Policy</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </header>

      {/* Summary Box */}
      <section aria-labelledby="tldr-summary" className="p-6 rounded-radius border border-emerald/25 bg-emerald/5 space-y-4">
        <div className="flex items-center gap-2.5 text-emerald-text font-semibold text-sm font-mono uppercase tracking-wider">
          <Shield className="w-4 h-4" />
          <h2 id="tldr-summary" className="text-sm font-mono uppercase font-semibold">
            Executive Summary for Software Engineers
          </h2>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm text-text-1">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald shrink-0 mt-0.5" />
            <span><strong>You own your code:</strong> You retain complete intellectual property rights to your solution source code.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald shrink-0 mt-0.5" />
            <span><strong>Proof, not tutorial clones:</strong> We run automated test harnesses against your code to issue cryptographic SHA-256 validity guarantees.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald shrink-0 mt-0.5" />
            <span><strong>Zero sandbox exploits:</strong> Denial-of-service, escape attacks, or cryptomining on mock infrastructure result in permanent ban and hash revocation.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald shrink-0 mt-0.5" />
            <span><strong>BYOK privacy:</strong> When bringing your own Gemini or OpenAI API key, your credentials are never stored unencrypted or used for model training.</span>
          </li>
        </ul>
      </section>

      {/* Table of Contents */}
      <nav aria-label="Table of contents" className="p-5 rounded-radius border border-line bg-card/40 space-y-3">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-text-1">
          Index of Articles
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

      {/* Detailed Articles */}
      <article className="space-y-12 text-sm sm:text-base leading-relaxed text-text-1">
        {/* Section 1 */}
        <section id="acceptance" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <Scale className="w-5 h-5 text-emerald-text" />
            <h2>1. Acceptance of Terms & Overview of DevLedgr</h2>
          </div>
          <p>
            By accessing, browsing, registering for, or using DevLedgr (including any subdomains, public APIs, command-line interfaces,
            and verification test runners), you acknowledge that you have read, understood, and agreed to be bound by these Terms of Service
            and our accompanying <Link href="/privacy" className="text-emerald-text underline hover:text-text-0">Privacy Policy</Link>.
            If you do not agree to these terms, you must immediately terminate use of the platform.
          </p>
          <p>
            DevLedgr operates as an immutable engineering consensus platform. Rather than serving as an unverified resume host or tutorial repository,
            DevLedgr tests real engineering code against simulated production conditions (such as network partitions, distributed lock contention,
            and database write-ahead logging failover) and issues verifiable cryptographic proof-of-work certificates.
          </p>
        </section>

        {/* Section 2 */}
        <section id="eligibility-identity" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <Key className="w-5 h-5 text-emerald-text" />
            <h2>2. Eligibility, Account Identity & Cryptographic Anchor</h2>
          </div>
          <p>
            <strong>2.1 Eligibility:</strong> You must be at least 18 years of age (or the age of legal majority in your jurisdiction)
            to form a binding contract. If you are between 13 and 17, you may use DevLedgr solely under the supervision and consent of a parent
            or legal guardian who agrees to be bound by these Terms.
          </p>
          <p>
            <strong>2.2 GitHub & Third-Party Authentication:</strong> DevLedgr relies on verified third-party identity providers (principally GitHub OAuth
            and Google OAuth via Supabase Auth) to anchor proof-of-work to your authentic developer identity. You agree to provide accurate,
            current, and complete information and maintain the security of your authenticated session.
          </p>
          <p>
            <strong>2.3 Anti-Sybil & Account Integrity:</strong> You may not create false identities, register automated bot farms, impersonate another developer,
            or submit pull requests or commit hashes generated by third parties under fraudulent claims of authorship. Any attempt to artificially manipulate
            ledger standing or forge commit timestamps constitutes grounds for immediate account termination and cryptographic hash blacklisting.
          </p>
        </section>

        {/* Section 3 */}
        <section id="platform-services" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <Terminal className="w-5 h-5 text-emerald-text" />
            <h2>3. Problem Specifications, Mock Fleets & CI Sandboxes</h2>
          </div>
          <p>
            <strong>3.1 Operational Challenges:</strong> DevLedgr provides complex system design and engineering specifications via our Idea Bank
            (e.g., distributed log aggregators, rate-limiting reverse proxies, idempotency keys, CRDT collaborative editors).
            These specifications are designed to evaluate engineering rigor under realistic edge cases.
          </p>
          <p>
            <strong>3.2 Live Mock Infrastructure:</strong> When you submit a solution via git repository URL or commit reference, DevLedgr orchestrates
            isolated containerized environments running live test harnesses and simulated mock infrastructure. These test suites inspect functional
            correctness, algorithmic efficiency, memory consumption, latency percentiles, and resilience under fault injection.
          </p>
          <p>
            <strong>3.3 Automated Telemetry:</strong> Execution results, stderr/stdout logs, test metrics, and benchmark percentiles are collected
            into an immutable execution trace used to substantiate ledger issuance.
          </p>
        </section>

        {/* Section 4 */}
        <section id="cryptographic-ledger" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <Lock className="w-5 h-5 text-emerald-text" />
            <h2>4. Cryptographic Stamping, Ledger Immutability & 365-Day Validity</h2>
          </div>
          <p>
            <strong>4.1 The Ledger Record:</strong> Once a submitted solution satisfies all mandatory test suites and verification constraints,
            DevLedgr stamps the verified solution with a deterministic SHA-256 checksum and signs the entry using Ed25519 platform root keys.
          </p>
          <p>
            <strong>4.2 365-Day Portfolio URL Guarantee:</strong> For active stamped entries, DevLedgr guarantees public portfolio availability
            at your designated handle (<code className="font-mono text-xs bg-card px-1.5 py-0.5 rounded border border-line">/p/[username]</code>)
            for a continuous period of 365 days from the date of verification, subject to your account remaining in good standing and not violating
            these Terms.
          </p>
          <p>
            <strong>4.3 Certificate Integrity & Tamper-Evidence:</strong> Every public portfolio entry features a verifiable certificate payload.
            DevLedgr reserves the right to rotate root signing keys in accordance with cryptographic best practices while maintaining backward-verifiable
            signature chains.
          </p>
        </section>

        {/* Section 5 */}
        <section id="ip-ownership" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <FileText className="w-5 h-5 text-emerald-text" />
            <h2>5. Intellectual Property & Code Rights</h2>
          </div>
          <p>
            <strong>5.1 Developer Ownership:</strong> You retain 100% of your copyright, title, and ownership in all original source code,
            architectural designs, and technical solutions you author and submit to DevLedgr. DevLedgr claims no proprietary ownership over your solutions.
          </p>
          <p>
            <strong>5.2 Limited Platform License:</strong> In order to provide the platform services, you grant DevLedgr a worldwide, royalty-free,
            non-exclusive license to:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-xs sm:text-sm">
            <li>Fetch, compile, and execute your submitted repository code inside isolated CI test sandboxes;</li>
            <li>Extract telemetry, compute cryptographic checksums, and generate test assertions;</li>
            <li>Render your code snippets, commit metadata, and verification badges on your public portfolio page (<code className="font-mono text-xs bg-card px-1.5 py-0.5 rounded border border-line">/p/[username]</code>);</li>
            <li>Synthesize anonymized, aggregated benchmarking metrics to calibrate industry difficulty curves.</li>
          </ul>
          <p>
            <strong>5.3 DevLedgr Intellectual Property:</strong> All DevLedgr trademarks, logos, domain names, UI layouts, mock fleet simulators,
            problem test suites, consensus algorithms, and proprietary scrutiny prompts remain the exclusive property of DevLedgr and its licensors.
          </p>
        </section>

        {/* Section 6 */}
        <section id="acceptable-use" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2>6. Acceptable Use & Infrastructure Security</h2>
          </div>
          <p>
            DevLedgr executes untrusted code inside sandboxed execution runners. We maintain strict zero-tolerance policies regarding malicious actions.
            You agree NOT to:
          </p>
          <div className="p-4 rounded-radius border border-line bg-card/50 space-y-2 text-xs sm:text-sm">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Attempt container escapes, kernel privilege escalation, or host filesystem traversal on our CI runner clusters;</li>
              <li>Execute cryptocurrency mining, distributed denial-of-service (DDoS) traffic, network scans, or spam floods;</li>
              <li>Exfiltrate environment secrets, neighbor container memory, or proprietary test harness validation secrets;</li>
              <li>Bypass, reverse engineer, or defeat anti-cheat harnesses, rate-limiters, or automated grading oracles;</li>
              <li>Submit malicious code containing ransomware, trojans, worms, rootkits, or destructive payloads;</li>
              <li>Scrape, bulk-harvest, or mirror other developers&apos; private data or ATS resumes without authorization.</li>
            </ul>
          </div>
          <p className="text-xs sm:text-sm text-rose-600 dark:text-rose-400">
            Violations will result in immediate termination of all accounts, permanent revocation of cryptographic ledger certificates,
            and where appropriate, reporting to competent law enforcement and cybersecurity incident response authorities.
          </p>
        </section>

        {/* Section 7 */}
        <section id="ai-byok" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <Cpu className="w-5 h-5 text-emerald-text" />
            <h2>7. AI Compute, Code Scrutiny & BYOK (Bring Your Own Key)</h2>
          </div>
          <p>
            <strong>7.1 AI Mesh & Architectural Scrutiny:</strong> DevLedgr integrates artificial intelligence models (such as Google Gemini and OpenAI)
            to analyze your code architecture, evaluate test edge-cases, offer personalized coaching tracks, and synthesize ATS-safe Markdown resumes.
          </p>
          <p>
            <strong>7.2 BYOK (Bring Your Own Key):</strong> If you select the BYOK Compute Tier, you provide your own personal API key.
            Under BYOK:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-xs sm:text-sm">
            <li>Your API key is stored client-side in your browser storage or transmitted via encrypted channels solely for invoking your desired LLM inferences;</li>
            <li>DevLedgr never sells, rents, or uses your API key for other users;</li>
            <li>You are solely responsible for all API fees and quotas incurred with your chosen model provider (e.g. Google Cloud, OpenAI);</li>
            <li>You agree to comply with your model provider&apos;s acceptable use and privacy terms.</li>
          </ul>
          <p>
            <strong>7.3 Automated AI Advice Disclaimer:</strong> AI-generated scrutiny scores, architectural recommendations, and resume synthesis
            are provided for educational guidance and portfolio presentation. DevLedgr does not warrant that AI critiques reflect the unanimous consensus
            of every prospective employer.
          </p>
        </section>

        {/* Section 8 */}
        <section id="recruiter-matching" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <Server className="w-5 h-5 text-emerald-text" />
            <h2>8. Recruiter Matching & Opportunity Requisitions</h2>
          </div>
          <p>
            <strong>8.1 Algorithmic Match Scoring:</strong> DevLedgr indexes candidate skills, proven test telemetry, and problem completions
            to surface matched opportunities from verified engineering partners.
          </p>
          <p>
            <strong>8.2 No Employment Agency Guarantee:</strong> DevLedgr is a technical proof-of-work infrastructure platform, not an employment agency
            or staffing firm. We do not guarantee job interviews, placement, offer letters, or compensation levels.
          </p>
          <p>
            <strong>8.3 Recruiter Inquiries:</strong> By making your portfolio public and opting into recruiter inquiries, you authorize verified hiring
            operators to contact you via your designated email. You retain full autonomy to accept, reject, or ignore any match opportunity.
          </p>
        </section>

        {/* Section 9 */}
        <section id="subscriptions-fees" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <Scale className="w-5 h-5 text-emerald-text" />
            <h2>9. Subscriptions, Fees & Billing</h2>
          </div>
          <p>
            <strong>9.1 Tiers:</strong> DevLedgr provides both free tiers (including BYOK compute) and paid Full-Service subscriptions
            (e.g., ~₦5,000 / month or local currency equivalent) that provide managed cloud CI runners, accelerated test queues, and hosted AI scrutiny.
          </p>
          <p>
            <strong>9.2 Billing & Renewal:</strong> Paid subscriptions are billed in advance on a recurring monthly or annual basis.
            Unless cancelled prior to the billing renewal date, subscriptions automatically renew at the then-current standard rates.
          </p>
          <p>
            <strong>9.3 Cancellations & Refunds:</strong> You may cancel your subscription at any time via your Account Settings.
            Upon cancellation, you will continue to have access through the end of your prepaid billing period. Except where mandated by applicable law,
            all payments are non-refundable.
          </p>
        </section>

        {/* Section 10 */}
        <section id="disclaimers" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <AlertTriangle className="w-5 h-5 text-text-1" />
            <h2>10. Disclaimers & &ldquo;As Is&rdquo; Operations</h2>
          </div>
          <p className="uppercase text-xs font-mono font-medium tracking-wide text-text-1">
            Please read this section carefully, as it limits the legal liability of DevLedgr.
          </p>
          <p>
            THE PLATFORM, INCLUDING ALL TEST HARNESSES, IDEA BANK SPECIFICATIONS, PUBLIC PORTFOLIOS, AND AI EVALUATION MESHES,
            IS PROVIDED ON AN <strong>&ldquo;AS IS&rdquo;</strong> AND <strong>&ldquo;AS AVAILABLE&rdquo;</strong> BASIS WITHOUT WARRANTIES OF ANY KIND,
            WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE.
          </p>
          <p>
            DEVLEDGR EXPRESSLY DISCLAIMS ALL IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, QUIET ENJOYMENT,
            ACCURACY, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, BUG-FREE, SECURE, OR FREE OF HARMFUL COMPONENTS,
            OR THAT THIRD-PARTY INTEGRATIONS (SUCH AS GITHUB APIS OR LLM PROVIDERS) WILL REMAIN CONSTANTLY ACCESSIBLE.
          </p>
        </section>

        {/* Section 11 */}
        <section id="liability" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <Scale className="w-5 h-5 text-text-1" />
            <h2>11. Limitation of Liability</h2>
          </div>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL DEVLEDGR, ITS FOUNDERS, DIRECTORS, EMPLOYEES, AGENTS,
            OR PARTNERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING DAMAGES FOR
            LOSS OF PROFITS, GOODWILL, REPUTATION, DATA, EMPLOYMENT OPPORTUNITIES, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR IN CONNECTION WITH
            YOUR ACCESS TO OR USE OF (OR INABILITY TO USE) THE PLATFORM.
          </p>
          <p>
            IN NO EVENT SHALL DEVLEDGR&apos;S TOTAL AGGREGATE LIABILITY EXCEED THE GREATER OF: (A) THE TOTAL AMOUNT PAID BY YOU TO DEVLEDGR FOR ACCESS
            TO THE SERVICES IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED UNITED STATES DOLLARS ($100.00 USD).
          </p>
        </section>

        {/* Section 12 */}
        <section id="suspension-delisting" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <Shield className="w-5 h-5 text-rose-500" />
            <h2>12. Account Suspension, Termination & Ledger Delisting</h2>
          </div>
          <p>
            <strong>12.1 By You:</strong> You may close your DevLedgr account at any time via your Settings page. Upon closure, private data will be
            erased in accordance with our Privacy Policy.
          </p>
          <p>
            <strong>12.2 By DevLedgr:</strong> We reserve the right to immediately suspend or permanently terminate your access, revoke public portfolio
            URLs, and invalidate cryptographic commit hashes if:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-xs sm:text-sm">
            <li>You breach any provision of these Terms or our Acceptable Use policy;</li>
            <li>Your solutions are proven to involve automated plagiarism, unauthorized decompilation, or exploit injection;</li>
            <li>We are required to do so by a court order, regulatory mandate, or legal authority;</li>
            <li>Your account remains inactive for extended durations following notice.</li>
          </ul>
        </section>

        {/* Section 13 */}
        <section id="governing-law" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <Scale className="w-5 h-5 text-emerald-text" />
            <h2>13. Dispute Resolution & Governing Law</h2>
          </div>
          <p>
            <strong>13.1 Informal Resolution First:</strong> Before filing a formal legal claim, you and DevLedgr agree to attempt in good faith
            to resolve any dispute, controversy, or claim through informal negotiation by contacting <a href="mailto:legal@devledgr.xyz" className="text-emerald-text underline">legal@devledgr.xyz</a>.
          </p>
          <p>
            <strong>13.2 Governing Law:</strong> These Terms shall be governed by and construed in accordance with the laws of the jurisdiction
            in which DevLedgr operates, without regard to conflict of law principles.
          </p>
          <p>
            <strong>13.3 Severability:</strong> If any provision of these Terms is found to be unlawful, void, or unenforceable, that provision will be
            severable and will not affect the validity and enforceability of any remaining provisions.
          </p>
        </section>

        {/* Section 14 */}
        <section id="contact" className="space-y-4 pt-6 border-t border-line">
          <div className="flex items-center gap-2 text-text-0 font-semibold text-lg sm:text-xl">
            <Mail className="w-5 h-5 text-emerald-text" />
            <h2>14. Amendments & Legal Contact</h2>
          </div>
          <p>
            We may revise these Terms of Service from time to time to reflect operational modifications, platform enhancements, or regulatory developments.
            If a revision is material, we will provide at least 15 days&apos; notice by displaying an alert banner on the platform or sending an email
            to your registered contact address. Continued use of the platform following the effective date of updated Terms constitutes your binding acceptance.
          </p>

          <div className="p-5 rounded-radius border border-line bg-card space-y-3 mt-4">
            <h3 className="font-semibold text-text-0 text-sm">
              Official Legal Notices & Compliance Inquiries
            </h3>
            <p className="text-xs sm:text-sm text-text-1">
              For formal legal notices, DMCA/copyright inquiries, or partnership questions, please contact our legal desk:
            </p>
            <div className="text-xs sm:text-sm font-mono space-y-1">
              <div>Email: <a href="mailto:legal@devledgr.xyz" className="text-emerald-text underline font-semibold">legal@devledgr.xyz</a></div>
              <div>Security & Sandboxing: <a href="mailto:security@devledgr.xyz" className="text-emerald-text underline font-semibold">security@devledgr.xyz</a></div>
              <div>DevLedgr Operations: <a href="mailto:partners@devledgr.xyz" className="text-emerald-text underline font-semibold">partners@devledgr.xyz</a></div>
            </div>
          </div>
        </section>
      </article>

      {/* Footer Navigation Strip */}
      <footer className="pt-8 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-text-1">
        <div>Document: DevLedgr Master Terms v2.4 (2026)</div>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="text-emerald-text hover:underline">
            Read Privacy Policy →
          </Link>
          <a href="#main-content" className="hover:text-text-0">
            Back to Top ↑
          </a>
        </div>
      </footer>
    </div>
  );
}
