"use client";

import { useState, type FormEvent } from "react";

export function EmailForm({
  endpoint,
  submitLabel,
  successText,
  heading,
}: {
  endpoint: string;
  submitLabel: string;
  successText: string;
  heading: string;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ghostinc-Request": "1" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "No fue posible completar la solicitud.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("No fue posible conectar con el servicio.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="account-confirmation">
        <span className="section-tag">Revisa tu correo</span>
        <p>{successText}</p>
      </div>
    );
  }

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      <label>
        <span>Correo</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={254}
        />
      </label>
      {error && <p className="search-feedback" role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Enviando…" : submitLabel}
      </button>
      <p className="auth-config-note">{heading}</p>
    </form>
  );
}
