/**
 * @file crypto.ts
 * @description Web Crypto API SHA-256 fingerprint generator and verifier for DevLedgr.
 * Works seamlessly in modern browsers and Node.js environments.
 *
 * There is no non-cryptographic fallback. A proof signature is the thing a
 * reviewer and a recruiter treat as a fingerprint of a commit, so a function
 * that quietly returned something else under the same name would be worse than
 * a failure: see DigestUnavailableError.
 */

/** A SHA-256 digest in hex is exactly this many characters. */
export const SHA256_HEX_LENGTH = 64;

/**
 * Thrown when no real SHA-256 implementation is reachable.
 *
 * The old code fell back to a 32-bit `hash * 31 + charCode` accumulated over
 * the string, then `padStart(64, '0')` and returned it as though it were a
 * digest. That produced a 64-character hex-looking value that was neither
 * SHA-256 nor 32 bits wide (the arithmetic is 32-bit and the padding is leading
 * zeros), and `padStart` cannot shorten anything, so an over-long result would
 * have been returned over-long too. It rendered in the UI as a proof
 * fingerprint and was compared for equality in verifyProofSignature, so a
 * collision in a 32-bit space — or two different inputs colliding by accident —
 * read as a match. Failing is the only honest outcome.
 */
export class DigestUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DigestUnavailableError';
  }
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Computes a genuine SHA-256 hexadecimal digest for any input string.
 *
 * Always returns exactly SHA256_HEX_LENGTH lowercase hex characters, or throws.
 */
export async function sha256(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);

  // globalThis.crypto.subtle is the one lookup that covers every runtime this
  // app runs in: browsers, Node 18+, and the edge/worker isolates Next.js can
  // deploy to. The previous version only looked at window.crypto, so any
  // server-side or worker call fell through to the non-cryptographic hash.
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    return toHex(await subtle.digest('SHA-256', data));
  }

  // Node without a global WebCrypto (older runtimes, and some bundlers strip
  // the global). A real digest, so it is a legitimate second choice.
  try {
    const { createHash } = await import('crypto');
    return createHash('sha256').update(data).digest('hex');
  } catch (err) {
    throw new DigestUnavailableError(
      'No SHA-256 implementation is available in this runtime, so a proof fingerprint cannot be computed. ' +
        'Load the page over HTTPS (or on localhost) in a browser with Web Crypto support.',
      { cause: err }
    );
  }
}

export interface CanonicalProofInput {
  authorUsername: string;
  repoUrl: string;
  commitSha: string;
  testPassed: number;
  testTotal: number;
  timestamp: string;
}

/**
 * Creates canonical payload string for cryptographic stamping.
 */
export function buildProofCanonicalPayload(input: CanonicalProofInput): string {
  return `${input.authorUsername.toLowerCase()}|${input.repoUrl.trim().toLowerCase()}|${input.commitSha.trim()}|${input.testPassed}/${input.testTotal}|${input.timestamp}`;
}

/**
 * Computes full 64-char SHA-256 cryptographic proof fingerprint
 * and a 7-character short commit hash.
 */
export async function generateProofSignature(input: CanonicalProofInput): Promise<{
  shortHash: string;
  proofSignature: string;
}> {
  const canonical = buildProofCanonicalPayload(input);
  const proofSignature = await sha256(canonical);
  const shortHash = proofSignature.slice(0, 7);

  return { shortHash, proofSignature };
}

/**
 * Verifies that a given proof signature matches the canonical data.
 */
export async function verifyProofSignature(
  input: CanonicalProofInput,
  expectedSignature: string
): Promise<boolean> {
  const canonical = buildProofCanonicalPayload(input);
  const calculated = await sha256(canonical);
  return calculated.toLowerCase() === expectedSignature.trim().toLowerCase();
}
