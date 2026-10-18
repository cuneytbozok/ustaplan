import { createHmac, timingSafeEqual } from "node:crypto";

// Customer link tokens (plan §5, T-3): <jobId>.<base64url(HMAC-SHA256(secret,
// "ustaplan:job-link:v1:" + jobId + ":" + share_version))>. Pure functions so
// they can be tested; the secret comes from shareLinkEnv() in the caller.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SIGNATURE = /^[A-Za-z0-9_-]{43}$/; // 32 bytes, base64url without padding

export function signJobLink(secret: string, jobId: string, version: number) {
  return createHmac("sha256", secret).update(`ustaplan:job-link:v1:${jobId}:${version}`).digest("base64url");
}

export function createShareToken(secret: string, jobId: string, version: number) {
  return `${jobId}.${signJobLink(secret, jobId, version)}`;
}

/** Splits a token; null for anything malformed (no database access needed). */
export function parseShareToken(token: string): { jobId: string; signature: string } | null {
  if (typeof token !== "string" || token.length > 200) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const jobId = token.slice(0, dot).toLowerCase();
  const signature = token.slice(dot + 1);
  return UUID.test(jobId) && SIGNATURE.test(signature) ? { jobId, signature } : null;
}

/** Constant-time comparison against the signature for the job's current version. */
export function verifySignature(secret: string, jobId: string, version: number, signature: string) {
  const expected = Buffer.from(signJobLink(secret, jobId, version));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
