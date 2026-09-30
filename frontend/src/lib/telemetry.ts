/**
 * @file telemetry.ts
 * @description Formatters for submission telemetry that refuse to invent values.
 *
 * WHY THIS EXISTS
 * Metrics and test results are measured or they are nothing. The UI used to
 * substitute placeholder constants whenever a value was missing:
 *
 *   p99 latency  -> "36ms"        portfolio card
 *   throughput    -> "220 req/s"   portfolio card
 *   coverage      -> "94.2%"       portfolio card
 *   p99 latency  -> "28ms"        AI CV generator, recruiter-facing
 *   digest        -> SHA-256 of the empty string
 *
 * Those are not styling defaults. They were rendered in the same weight and
 * colour as real measurements, and the CV generator fed them into documents
 * sent to employers. A dev with no telemetry was given a portfolio asserting
 * 36ms p99 at 220 req/s with 94.2% coverage, and a CV asserting 28ms p99
 * under "simulated high-throughput production load".
 *
 * Every helper here returns null (or omits the line) when the underlying value
 * is absent. Callers decide how to present the absence. Nothing is defaulted.
 */

/** True when a metric was actually recorded. Blank/whitespace counts as absent. */
function present(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * A recorded metric value, or null when there is none.
 * Use in JSX; render null as an explicit "not recorded" state upstream.
 */
export function recordedMetric(
  value: string | null | undefined
): string | null {
  return present(value) ? value.trim() : null;
}

/**
 * The measured test result as "18/20", or null when no suite ever ran.
 *
 * A total of zero is treated as absent rather than as a pass: 0/0 means nothing
 * was executed, and printing it invites the reader to treat it as a result. The
 * backend refuses to mint a certificate for a 0/0 submission for the same
 * reason, so a null here is a submission that has not been verified.
 */
export function recordedTestResult(
  testResults: { passed: number; total: number } | null | undefined
): string | null {
  if (!testResults) return null;
  const { passed, total } = testResults;
  if (!Number.isFinite(passed) || !Number.isFinite(total) || total <= 0) {
    return null;
  }
  return `${passed}/${total}`;
}

/**
 * Telemetry as a single comma-separated clause, omitting anything unrecorded.
 *
 *   measuredP99('28ms', '240 req/s')   -> "p99 latency 28ms, throughput 240 req/s"
 *   measuredP99('28ms', undefined)     -> "p99 latency 28ms"
 *   measuredP99(undefined, undefined)  -> null
 */
export function measuredP99(
  latencyP99: string | null | undefined,
  throughput: string | null | undefined
): string | null {
  const parts: string[] = [];
  const latency = recordedMetric(latencyP99);
  const tp = recordedMetric(throughput);
  if (latency) parts.push(`p99 latency ${latency}`);
  if (tp) parts.push(`throughput ${tp}`);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * The submission's test suite name, or null when unset.
 * The backend substitutes "Manual Reviewer Audit" at stamp time, so an empty
 * string here means the submission was never reviewed.
 */
export function recordedSuiteName(
  testResults: { suiteName?: string } | null | undefined
): string | null {
  const name = testResults?.suiteName;
  return present(name) ? name.trim() : null;
}

/**
 * A proof digest, or null when none was recorded.
 *
 * The portfolio previously fell back to the SHA-256 of the empty string —
 * e3b0c442...b7852b855 — and printed it under "SHA-256 Digest". That is the
 * well-known digest of nothing, presented as a verification artefact.
 */
export function recordedDigest(
  proofSignature: string | null | undefined
): string | null {
  return recordedMetric(proofSignature);
}
