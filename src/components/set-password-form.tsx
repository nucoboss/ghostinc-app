"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

export function SetPasswordForm() {
  const [token, setToken] = useState<string | null>(null);
  const [mode, setMode] = useState<"registration" | "reset">("registration");
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const linkToken = params.get("token");
    const linkMode = params.get("mode");
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    if (linkToken && linkToken.length <= 128) setToken(linkToken);
    if (linkMode === "reset") setMode("reset");
    setReady(true);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError("El enlace no es válido o ya fue usado.");
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ghostinc-Request": "1" },
        body: JSON.stringify({ token, password }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "No fue posible completar la solicitud.");
        return;
      }
      setDone(true);
    } catch {
      setError("No fue posible conectar con el servicio.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) return <p className="auth-config-note">Validando enlace…</p>;

  if (!token) {
    return (
      <div className="account-confirmation">
        <span className="section-tag">Enlace no válido</span>
        <p>El enlace es inválido, expiró o ya fue usado.</p>
        <Link className="button-secondary" href="/recuperar">Solicitar un nuevo enlace</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="account-confirmation">
        <span className="section-tag">{mode === "reset" ? "Contraseña actualizada" : "Cuenta activada"}</span>
        <p>Tu contraseña quedó definida. Ya puedes ingresar a tu portal.</p>
        <Link className="button-primary" href="/auth/login">Ir a ingresar</Link>
      </div>
    );
  }

  return (
    <form className="account-form" onSubmit={handleSubmit}>
      <label>
        <span>Nueva contraseña</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label>
        <span>Repite la contraseña</span>
        <input
          type="password"
          name="confirmation"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </label>
      {error && <p className="search-feedback" role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Guardando…" : mode === "reset" ? "Cambiar contraseña" : "Crear contraseña"}
      </button>
      <p className="auth-config-note">Mínimo 12 caracteres. El enlace es de uso único y expira en 30 minutos.</p>
    </form>
  );
}
