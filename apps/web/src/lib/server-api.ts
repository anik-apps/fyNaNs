import { cookies } from "next/headers";
import { API_URL } from "./constants";

/**
 * Server-side API fetch helper. Reads the refresh token from cookies
 * and obtains an access token, then fetches the requested endpoint.
 * Used in server components for SSR.
 */
export async function serverFetch<T>(path: string): Promise<T> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refresh_token")?.value;

  if (!refreshToken) {
    throw new Error("Not authenticated");
  }

  // Get a fresh access token using the refresh token cookie
  const refreshResponse = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: {
      Cookie: `refresh_token=${refreshToken}`,
    },
  });

  if (!refreshResponse.ok) {
    throw new Error("Session expired");
  }

  const { access_token } = await refreshResponse.json();

  // Fetch the actual data
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
