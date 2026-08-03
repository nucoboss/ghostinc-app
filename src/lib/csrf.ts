import type { NextRequest } from "next/server";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-id" : "ghostinc_session";
export const SESSION_ABSOLUTE_SECONDS = Number(process.env.SESSION_ABSOLUTE_SECONDS ?? 28_800);

function appOrigin(): string | null {
  const baseUrl = process.env.APP_BASE_URL;
  if (!baseUrl) return null;
  try {
    return new URL(baseUrl).origin;
  } catch {
    return null;
  }
}

function sameOrigin(value: string): boolean {
  const expected = appOrigin();
  if (!expected) return false;
  try {
    return new URL(value).origin === expected;
  } catch {
    return false;
  }
}

export function isSameOriginRequest(request: NextRequest): boolean {
  if (request.headers.get("x-ghostinc-request") !== "1") return false;
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin") return false;

  const origin = request.headers.get("origin");
  if (origin) return sameOrigin(origin);

  const referer = request.headers.get("referer");
  if (referer) return sameOrigin(referer);

  return secFetchSite === "same-origin";
}
