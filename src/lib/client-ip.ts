import type { NextRequest } from "next/server";

const IP_PATTERN = /^[0-9a-f:.]{3,64}$/i;

export function clientIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || request.headers.get("x-real-ip")?.trim();
  return candidate && IP_PATTERN.test(candidate) ? candidate : undefined;
}
