import { describe, expect, it } from "vitest";
import { bearerToken, createSessionToken, secretsMatch, SESSION_DAYS, verifySessionToken } from "./auth";

const secret = "test-secret-3f9a";

describe("session tokens", () => {
  it("round-trips a fresh token", async () => {
    const token = await createSessionToken(secret);
    expect(await verifySessionToken(token, secret)).toBe(true);
  });

  it("rejects a token signed with another secret", async () => {
    const token = await createSessionToken("other-secret");
    expect(await verifySessionToken(token, secret)).toBe(false);
  });

  it("rejects a tampered timestamp", async () => {
    const token = await createSessionToken(secret);
    const [, sig] = token.split(".");
    expect(await verifySessionToken(`${Math.floor(Date.now() / 1000) + 60}.${sig}`, secret)).toBe(false);
  });

  it("expires after the session window", async () => {
    const issuedAt = Date.UTC(2026, 0, 1);
    const token = await createSessionToken(secret, issuedAt);
    const justInside = issuedAt + (SESSION_DAYS * 86_400 - 60) * 1000;
    const justOutside = issuedAt + (SESSION_DAYS * 86_400 + 60) * 1000;
    expect(await verifySessionToken(token, secret, justInside)).toBe(true);
    expect(await verifySessionToken(token, secret, justOutside)).toBe(false);
  });

  it("rejects missing and malformed tokens", async () => {
    expect(await verifySessionToken(undefined, secret)).toBe(false);
    expect(await verifySessionToken("garbage", secret)).toBe(false);
    expect(await verifySessionToken("abc.def", secret)).toBe(false);
  });
});

describe("secretsMatch", () => {
  it("matches only identical strings", async () => {
    expect(await secretsMatch("hunter2-but-longer", "hunter2-but-longer")).toBe(true);
    expect(await secretsMatch("hunter2-but-longer", "hunter3-but-longer")).toBe(false);
    expect(await secretsMatch("", "x")).toBe(false);
  });
});

describe("bearerToken", () => {
  it("extracts the token from an Authorization header", () => {
    expect(bearerToken("Bearer abc123")).toBe("abc123");
    expect(bearerToken("bearer   abc123 ")).toBe("abc123");
    expect(bearerToken("Basic abc123")).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});
