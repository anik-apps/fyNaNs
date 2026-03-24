import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

// Server-side needs the actual backend URL (not the proxy)
const SERVER_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8888";

/**
 * Cached per-request function to get an access token.
 * React.cache ensures this only runs once per server request.
 */
const getServerAccessToken = cache(async (): Promise<string> => {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refresh_token")?.value;

  if (!refreshToken) {
    redirect("/login");
  }

  const refreshResponse = await fetch(`${SERVER_API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: {
      Cookie: `refresh_token=${refreshToken}`,
    },
  });

  if (!refreshResponse.ok) {
    redirect("/login");
  }

  const { access_token } = await refreshResponse.json();
  return access_token;
});

/**
 * Server-side API fetch helper. Reads the refresh token from cookies
 * and obtains an access token, then fetches the requested endpoint.
 * Used in server components for SSR.
 */
export async function serverFetch<T>(path: string): Promise<T> {
  let accessToken: string;
  try {
    accessToken = await getServerAccessToken();
  } catch (error) {
    // redirect() throws a special Next.js error — always rethrow it
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    // For any other error from the refresh call, redirect to login
    redirect("/login");
  }

  // Fetch the actual data
  const response = await fetch(`${SERVER_API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
