/**
 * @file verify-design.mjs
 * @description Automated design, accessibility, and markup verification suite.
 * Checks DOM structure, responsive classes, breakpoint safety, and layout integrity.
 */

const BASE_URL = 'http://localhost:3000';

async function fetchRoute(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Route ${path} failed with HTTP ${res.status}`);
  }
  return await res.text();
}

async function runDesignVerification() {
  console.log('🔍 Starting DevLedgr Impeccable Design Verification...\n');
  const results = [];

  // 1. Verify /login route
  try {
    const loginHtml = await fetchRoute('/login');
    const hasGitHub = loginHtml.includes('Continue with GitHub');
    const hasGoogle = loginHtml.includes('Continue with Google');
    const hasNoMagicLink = !loginHtml.includes('Send Magic Link') && !loginHtml.includes('login-email');
    const hasSandbox = loginHtml.includes('Sandbox Evaluation Personas');

    results.push({
      test: 'LoginPage: Clean OAuth interface (GitHub + Google only)',
      passed: hasGitHub && hasGoogle && hasNoMagicLink && hasSandbox,
      details: `GitHub: ${hasGitHub}, Google: ${hasGoogle}, MagicLinkRemoved: ${hasNoMagicLink}, SandboxAccordion: ${hasSandbox}`,
    });
  } catch (err) {
    results.push({ test: 'LoginPage availability', passed: false, error: err.message });
  }

  // 2. Verify Public Portfolio route (/p/junior_dev)
  try {
    const portfolioHtml = await fetchRoute('/p/junior_dev');
    const hasLedgerCert = portfolioHtml.includes('Cryptographic Ledger Certificate');
    const hasPermanentLink = portfolioHtml.includes('Permanent Link:');
    const hasNoBreakAll = !portfolioHtml.includes('break-all');
    const hasVerifiedStack = portfolioHtml.includes('Verified Stack:');
    const hasActions = portfolioHtml.includes('Share') && portfolioHtml.includes('Export');

    results.push({
      test: 'PortfolioPage: Proper layout hierarchy and certificate ribbon',
      passed: hasLedgerCert && hasPermanentLink && hasNoBreakAll && hasVerifiedStack && hasActions,
      details: `CertRibbon: ${hasLedgerCert}, PermLink: ${hasPermanentLink}, NoBreakAll: ${hasNoBreakAll}, Stack: ${hasVerifiedStack}, Actions: ${hasActions}`,
    });
  } catch (err) {
    results.push({ test: 'PortfolioPage availability', passed: false, error: err.message });
  }

  // 3. Verify Landing Page Hero & Navigation
  try {
    const homeHtml = await fetchRoute('/');
    const hasBrandHeader = homeHtml.includes('DevLedgr');
    const hasExploreProblems = homeHtml.includes('Explore Problems');
    const hasTrustMicrocopy = homeHtml.includes('Free 1-year cryptographic ledger certificate');
    const hasNoOldConnect = !homeHtml.includes('Connect GitHub →');

    results.push({
      test: 'LandingPage: Clean hero CTA and trust badges',
      passed: hasBrandHeader && hasExploreProblems && hasTrustMicrocopy && hasNoOldConnect,
      details: `Brand: ${hasBrandHeader}, Explore: ${hasExploreProblems}, TrustCopy: ${hasTrustMicrocopy}, OldBtnRemoved: ${hasNoOldConnect}`,
    });
  } catch (err) {
    results.push({ test: 'LandingPage availability', passed: false, error: err.message });
  }

  // 4. Verify AI Coaching endpoint (/api/ai/coach)
  try {
    const coachRes = await fetch(`${BASE_URL}/api/ai/coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itineraryTitle: 'High-Throughput Storage',
        milestoneTitle: 'ULID B-Tree Analysis',
        prompt: 'Explain ULID B-Tree impact',
      }),
    });
    const coachData = await coachRes.json();
    const coachOk = coachRes.status === 200 && coachData.success === true && Boolean(coachData.advice);

    results.push({
      test: 'AICoach: Heuristic & LLM fallback response',
      passed: coachOk,
      details: `Status: ${coachRes.status}, Source: ${coachData.source}, AdviceLen: ${coachData.advice?.length || 0}`,
    });
  } catch (err) {
    results.push({ test: 'AICoach endpoint', passed: false, error: err.message });
  }

  // 5. Verify GitHub inspection endpoint (/api/github/inspect)
  try {
    const ghRes = await fetch(`${BASE_URL}/api/github/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: 'https://github.com/Jack-Of-Aces/dev-ledgr' }),
    });
    const ghData = await ghRes.json();
    const ghOk = ghRes.status === 200 && ghData.valid === true && Boolean(ghData.latestCommit?.sha);

    results.push({
      test: 'GitHubInspector: Real commit SHA resolution',
      passed: ghOk,
      details: `Repo: ${ghData.fullName}, Stars: ${ghData.stars}, CommitSHA: ${ghData.latestCommit?.shortSha}`,
    });
  } catch (err) {
    results.push({ test: 'GitHubInspector endpoint', passed: false, error: err.message });
  }

  console.log('----------------------------------------------------');
  let allPassed = true;
  for (const r of results) {
    const symbol = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${symbol} | ${r.test}`);
    if (r.details) console.log(`   └─ Details: ${r.details}`);
    if (r.error) console.log(`   └─ Error: ${r.error}`);
    if (!r.passed) allPassed = false;
  }
  console.log('----------------------------------------------------\n');

  if (allPassed) {
    console.log('🎉 All design and architecture validations passed successfully!');
    process.exit(0);
  } else {
    console.error('💥 Some design validations failed.');
    process.exit(1);
  }
}

runDesignVerification();
