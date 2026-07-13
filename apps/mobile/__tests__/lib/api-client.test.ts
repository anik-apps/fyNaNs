import {
  apiFetch,
  setAccessToken,
  getAccessToken,
  ApiError,
} from "@/src/lib/api-client";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock auth-storage
jest.mock("@/src/lib/auth-storage", () => ({
  getRefreshToken: jest.fn().mockResolvedValue(null),
  setRefreshToken: jest.fn().mockResolvedValue(undefined),
  deleteRefreshToken: jest.fn().mockResolvedValue(undefined),
  getDeviceInfo: jest.fn().mockResolvedValue("test-device"),
}));

describe("api-client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setAccessToken(null);
  });

  it("makes requests with Authorization header when token is set", async () => {
    // Create a non-expired JWT token (expires in 1 hour)
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = Buffer.from(JSON.stringify({ exp })).toString("base64");
    const token = `header.${payload}.sig`;
    setAccessToken(token);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: "test" }),
    });

    await apiFetch("/api/test");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/test"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${token}`,
        }),
      })
    );
  });

  it("makes requests without Authorization header when no token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: "test" }),
    });

    await apiFetch("/api/test");

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBeUndefined();
  });

  it("handles 204 No Content", async () => {
    setAccessToken(null);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    const result = await apiFetch("/api/test");
    expect(result).toBeNull();
  });

  it("throws on non-ok responses", async () => {
    setAccessToken(null);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: "Server error" }),
    });

    await expect(apiFetch("/api/test")).rejects.toThrow("Server error");
  });

  it("throws ApiError carrying the HTTP status", async () => {
    setAccessToken(null);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ detail: "Not found" }),
    });

    const err: unknown = await apiFetch("/api/test").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
    expect((err as ApiError).message).toBe("Not found");
  });

  it("joins msg fields when a 422 detail is an array of validation errors", async () => {
    setAccessToken(null);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        detail: [
          { loc: ["body", "amount"], msg: "field required", type: "missing" },
          { loc: ["body", "name"], msg: "string too short", type: "value_error" },
        ],
      }),
    });

    await expect(apiFetch("/api/test")).rejects.toThrow(
      "field required; string too short"
    );
  });

  it("falls back to a status message when detail is unusable", async () => {
    setAccessToken(null);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: { nested: "object" } }),
    });

    await expect(apiFetch("/api/test")).rejects.toThrow("API error: 500");
  });

  it("sets and gets access token", () => {
    expect(getAccessToken()).toBeNull();
    setAccessToken("test-token");
    expect(getAccessToken()).toBe("test-token");
  });
});
