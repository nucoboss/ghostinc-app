import "server-only";

export type AdminOverview = {
  metrics: {
    users: number;
    active_keys: number;
    available_credits: number;
    requests_24h: number;
    errors_24h: number;
    credits_24h: number;
  };
  activity: Array<{
    request_id: string;
    account: string;
    key_name: string | null;
    status_code: number;
    duration_ms: number;
    credits_charged: number;
    created_at: string;
  }>;
  accounts: Array<{
    id: string;
    email: string;
    credit_balance: number;
    api_keys: number;
    requests_30d: number;
    created_at: string;
  }>;
};

export async function getAdminOverview(sessionToken: string) {
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!token) throw new Error("INTERNAL_SERVICE_TOKEN is not configured.");
  const backendUrl = (process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000").replace(/\/$/, "");
  const response = await fetch(`${backendUrl}/internal/admin/overview`, {
    headers: { "X-Internal-Token": token, "X-Session-Token": sessionToken, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Admin backend returned ${response.status}.`);
  const payload = await response.json() as { data: AdminOverview };
  return payload.data;
}
