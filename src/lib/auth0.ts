import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

const auth0Domain = process.env.AUTH0_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "");
export const myAccountAudience = auth0Domain ? `https://${auth0Domain}/me/` : "";
export const myAccountScope = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "read:me:authentication_methods",
  "create:me:authentication_methods",
  "delete:me:authentication_methods",
  "read:me:factors",
].join(" ");

async function auth0Fetch(input: RequestInfo | URL, init?: RequestInit) {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const attempts = method === "GET" || method === "HEAD" ? 3 : 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      const cause = error instanceof Error && typeof error.cause === "object" && error.cause !== null
        ? error.cause as { code?: unknown }
        : null;
      const code = typeof cause?.code === "string" ? cause.code : "unknown";
      console.error("Auth0 network request failed", {
        error: error instanceof Error ? error.name : "unknown",
        code,
        attempt,
      });
      if (attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }

  throw new Error("AUTH0_FETCH_EXHAUSTED");
}

export function isAuth0Configured() {
  return Boolean(
    process.env.AUTH0_DOMAIN
    && process.env.AUTH0_CLIENT_ID
    && process.env.AUTH0_CLIENT_SECRET
    && process.env.AUTH0_SECRET,
  );
}

export const auth0 = isAuth0Configured()
  ? new Auth0Client({
      authorizationParameters: {
        audience: myAccountAudience,
        scope: myAccountScope,
      },
      customFetch: auth0Fetch,
      onCallback: async (error, context) => {
        const appBaseUrl = context.appBaseUrl ?? process.env.APP_BASE_URL ?? "http://localhost:3002";
        if (error) {
          console.warn("Auth0 authorization rejected", { code: error.code });
          return NextResponse.redirect(new URL("/error-de-acceso", appBaseUrl));
        }

        const returnTo = context.returnTo?.startsWith("/") && !context.returnTo.startsWith("//")
          ? context.returnTo
          : "/";
        return NextResponse.redirect(new URL(returnTo, appBaseUrl));
      },
      session: {
        rolling: true,
        absoluteDuration: 60 * 60 * 8,
        inactivityDuration: 60 * 30,
      },
    })
  : null;
