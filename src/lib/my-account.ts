import "server-only";
import { auth0, myAccountAudience, myAccountScope } from "./auth0";

export type AuthenticationMethod = {
  id: string;
  type: string;
  confirmed?: boolean;
  created_at?: string;
};

export async function myAccountRequest<T>(path: string, init?: RequestInit) {
  if (!auth0 || !myAccountAudience) throw new Error("AUTH0_NOT_CONFIGURED");
  const { token } = await auth0.getAccessToken({
    audience: myAccountAudience,
    scope: myAccountScope,
  });
  const response = await fetch(`${myAccountAudience.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`MY_ACCOUNT_API_${response.status}`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
