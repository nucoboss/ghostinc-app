import "server-only";

type ManagementToken = { token: string; expiresAt: number };
let cachedToken: ManagementToken | null = null;

export type Auth0User = {
  user_id: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
  blocked?: boolean;
  logins_count?: number;
  last_login?: string;
  created_at: string;
};

type Auth0Role = {
  id: string;
  name: string;
};

function managementConfig() {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_MANAGEMENT_CLIENT_ID;
  const clientSecret = process.env.AUTH0_MANAGEMENT_CLIENT_SECRET;
  if (!domain || !clientId || !clientSecret) return null;
  return { domain: domain.replace(/^https?:\/\//, "").replace(/\/$/, ""), clientId, clientSecret };
}

export function isManagementConfigured() {
  return managementConfig() !== null;
}

async function getManagementToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const config = managementConfig();
  if (!config) throw new Error("AUTH0_MANAGEMENT_NOT_CONFIGURED");

  const response = await fetch(`https://${config.domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      audience: `https://${config.domain}/api/v2/`,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("Auth0 Management token request failed.");
  const payload = await response.json() as { access_token: string; expires_in: number };
  cachedToken = { token: payload.access_token, expiresAt: Date.now() + payload.expires_in * 1000 };
  return cachedToken.token;
}

async function managementRequest<T>(path: string, init?: RequestInit) {
  const config = managementConfig();
  if (!config) throw new Error("AUTH0_MANAGEMENT_NOT_CONFIGURED");
  const token = await getManagementToken();
  const response = await fetch(`https://${config.domain}/api/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(7_000),
  });
  if (!response.ok) throw new Error(`Auth0 Management API returned ${response.status}.`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function listAuth0Users() {
  return managementRequest<{ users: Auth0User[]; total: number }>("/users?per_page=50&page=0&include_totals=true&search_engine=v3");
}

export async function getAuth0UserRoles(userId: string) {
  return managementRequest<Auth0Role[]>(`/users/${encodeURIComponent(userId)}/roles`);
}

export async function setAuth0UserBlocked(userId: string, blocked: boolean) {
  return managementRequest<Auth0User>(`/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify({ blocked }),
  });
}
