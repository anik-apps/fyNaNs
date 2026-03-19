import { describe, it, expect, beforeEach } from "vitest";
import { setAccessToken, getAccessToken } from "@/lib/api-client";

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
