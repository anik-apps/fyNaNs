/**
 * In-memory store for the MFA pending token.
 * Avoids sessionStorage to prevent clear-text storage accessible via DOM APIs (CodeQL).
 * The token is short-lived (5 min) and only authorizes MFA verification, not full access.
 * Stored in module scope — survives client-side navigation but not page reload,
 * which is acceptable since MFA must be completed in the same session.
 */
let pendingMfaToken: string | null = null;

export function setMfaToken(token: string): void {
  pendingMfaToken = token;
}

export function getMfaToken(): string | null {
  return pendingMfaToken;
}

export function clearMfaToken(): void {
  pendingMfaToken = null;
}
