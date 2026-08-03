"use client";

import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function SessionRefresh() {
  useEffect(() => {
    async function refresh() {
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "X-Ghostinc-Request": "1" },
      }).catch(() => {});
    }

    void refresh();
    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  return null;
}
