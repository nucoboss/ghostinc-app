"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LogoutButton({ className = "account-reauth" }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await fetch("/api/auth/session", { method: "POST", headers: { "X-Ghostinc-Request": "1" } });
    } catch {
      // La rotación previa al cierre es opcional; el logout continúa igual.
    }
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", headers: { "X-Ghostinc-Request": "1" } });
      if (!response.ok) throw new Error("LOGOUT_FAILED");
    } catch {
      setPending(false);
      setError("No fue posible cerrar la sesión. Intenta nuevamente.");
      return;
    }
    setPending(false);
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <button className={className} type="submit" disabled={pending}>
        {pending ? "Cerrando sesión…" : "Cerrar sesión"}
      </button>
      {error && <p className="search-feedback" role="alert">{error}</p>}
    </form>
  );
}
