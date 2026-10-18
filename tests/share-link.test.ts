import { describe, expect, it } from "vitest";
import { createShareToken, parseShareToken, signJobLink, verifySignature } from "@/lib/share-link";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const JOB = "11111111-2222-4333-8444-555555555555";

describe("share-link", () => {
  it("signs deterministically and verifies its own signature", () => {
    const token = createShareToken(SECRET, JOB, 1);
    const parsed = parseShareToken(token)!;
    expect(parsed.jobId).toBe(JOB);
    expect(parsed.signature).toBe(signJobLink(SECRET, JOB, 1));
    expect(verifySignature(SECRET, JOB, 1, parsed.signature)).toBe(true);
  });

  it("is a 43-char base64url signature (no padding, URL-safe)", () => {
    expect(signJobLink(SECRET, JOB, 1)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("rejects an old version after the link is regenerated", () => {
    const old = parseShareToken(createShareToken(SECRET, JOB, 1))!;
    expect(verifySignature(SECRET, JOB, 2, old.signature)).toBe(false);
  });

  it("rejects tampering with the signature, the job id or the secret", () => {
    const { signature } = parseShareToken(createShareToken(SECRET, JOB, 3))!;
    const flipped = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
    expect(verifySignature(SECRET, JOB, 3, flipped)).toBe(false);
    expect(verifySignature(SECRET, "11111111-2222-4333-8444-555555555556", 3, signature)).toBe(false);
    expect(verifySignature("another-secret-that-is-also-32-characters", JOB, 3, signature)).toBe(false);
  });

  it("rejects malformed tokens before any lookup", () => {
    const sig = signJobLink(SECRET, JOB, 1);
    for (const bad of ["", "abc", JOB, `${JOB}.`, `.${sig}`, `${JOB}.${sig}x`, `${JOB}.${sig.slice(1)}`, `not-a-uuid.${sig}`, `${JOB}.${sig.replace(/./, "+")}`, `${JOB}.${sig}.extra`, "x".repeat(300)]) {
      expect(parseShareToken(bad)).toBeNull();
    }
  });

  it("does not throw on a wrong-length signature", () => {
    expect(verifySignature(SECRET, JOB, 1, "short")).toBe(false);
  });
});
