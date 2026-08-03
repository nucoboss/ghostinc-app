"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ghostinc-Request": "1" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "No fue posible ingresar.");
        return;
      }
      router.push(returnTo);
      router.refresh();
    } catch {
      setError("No fue posible conectar con el servicio de acceso.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      <label>
        <span>Correo</span>
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={254}
        />
      </label>
      <label>
        <span>Contraseña</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          maxLength={128}
        />
      </label>
      {error && <p className="search-feedback" role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
