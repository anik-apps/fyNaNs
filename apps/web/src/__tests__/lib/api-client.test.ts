import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  apiFetch,
  ApiError,
  setAccessToken,
  getAccessToken,
} from "@/lib/api-client";

function makeToken(expiresInSeconds: number): string {
  const payload = btoa(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds })
  );
  return `header.${payload}.signature`;
}

describe("API Client", () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  it("stores and retrieves access token", () => {
    setAccessToken("test-token");
    expect(getAccessToken()).toBe("test-token");
  });

  it("clears access token", () => {
    setAccessToken("test-token");
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });
});

describe("ApiError", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setAccessToken(null);
  });

  it("is an Error carrying the HTTP status", () => {
    const err = new ApiError("boom", 500);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ApiError");
    expect(err.status).toBe(500);
    expect(err.message).toBe("boom");
  });

  it("apiFetch throws ApiError with the response status on non-OK responses", async () => {
    setAccessToken(makeToken(3600));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ detail: "Not found" }),
      })
    );

    const promise = apiFetch("/api/missing");
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      status: 404,
      message: "Not found",
    });
  });
});
