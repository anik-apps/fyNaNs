import { openLink, LinkSuccess, LinkExit } from "react-native-plaid-link-sdk";
import { apiFetch } from "./api-client";

interface LinkTokenResponse {
  link_token: string;
  expiration: string;
}

interface ExchangeTokenResponse {
  plaid_item_id: string;
  institution_name: string;
  accounts_linked: number;
}

export async function createLinkToken(): Promise<string> {
  const data = await apiFetch<LinkTokenResponse>("/api/plaid/link-token", {
    method: "POST",
  });
  return data.link_token;
}

export async function exchangePublicToken(
  publicToken: string,
  institutionId: string,
  institutionName: string
): Promise<ExchangeTokenResponse> {
  return apiFetch<ExchangeTokenResponse>("/api/plaid/exchange-token", {
    method: "POST",
    body: JSON.stringify({
      public_token: publicToken,
      institution_id: institutionId,
      institution_name: institutionName,
    }),
  });
}

export function openPlaidLink(
  linkToken: string,
  onSuccess: (result: ExchangeTokenResponse) => void,
  onExit: (error?: string) => void
): void {
  openLink({
    tokenConfig: { token: linkToken },
    onSuccess: async (success: LinkSuccess) => {
      try {
        const result = await exchangePublicToken(
          success.publicToken,
          success.metadata.institution?.id || "",
          success.metadata.institution?.name || ""
        );
        onSuccess(result);
      } catch (e: any) {
        onExit(e.message || "Failed to link account");
      }
    },
    onExit: (exit: LinkExit) => {
      if (exit.error) {
        onExit(exit.error.displayMessage || exit.error.errorMessage);
      } else {
        onExit();
      }
    },
  });
}
