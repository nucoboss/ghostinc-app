"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type LoginPayload = {
  error?: string;
  status?: "authenticated" | "mfa_required";
  mfaEnrollmentRequired?: boolean;
};

type Enrollment = { qrCode: string; manualCode: string };

export function LoginForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [manualCodeCopied, setManualCodeCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ghostinc-Request": "1" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({})) as LoginPayload;
      if (!response.ok) {
        setError(payload.error ?? "No fue posible ingresar.");
        return;
      }
      if (payload.status === "mfa_required") {
        setMfaRequired(true);
        if (payload.mfaEnrollmentRequired) {
          const enrollmentResponse = await fetch("/api/account/totp", {
            method: "POST",
            headers: { "X-Ghostinc-Request": "1" },
          });
          const enrollmentPayload = await enrollmentResponse.json().catch(() => ({})) as Enrollment & { error?: string };
          if (!enrollmentResponse.ok) {
            setError(enrollmentPayload.error ?? "No fue posible iniciar el enrolamiento MFA.");
            return;
          }
          setEnrollment(enrollmentPayload);
        }
        setError(null);
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

  async function handleEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/account/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ghostinc-Request": "1" },
        body: JSON.stringify({ code }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; recoveryCodes?: string[] };
      if (!response.ok || !payload.recoveryCodes) {
        setError(payload.error ?? "Código inválido.");
        return;
      }
      setRecoveryCodes(payload.recoveryCodes);
      setEnrollment(null);
      setCode("");
    } catch {
      setError("No fue posible conectar con el servicio de acceso.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyManualCode() {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.manualCode);
      setManualCodeCopied(true);
    } catch {
      setError("No fue posible copiar el código. Selecciónalo manualmente.");
    }
  }

  if (enrollment) {
    return (
      <form className="account-form" onSubmit={handleEnrollment}>
        <p className="search-feedback">Escanea el QR en tu aplicación autenticadora y confirma el código.</p>
        <img src={enrollment.qrCode} alt="QR para enrolar TOTP" width={280} height={280} />
        <p>
          Código manual: <code>{enrollment.manualCode.match(/.{1,4}/g)?.join(" ")}</code>
        </p>
        <button type="button" className="button-secondary" onClick={copyManualCode}>
          {manualCodeCopied ? "Código copiado" : "Copiar código manual"}
        </button>
        <label>
          <span>Código TOTP</span>
          <input
            type="text"
            name="enrollmentCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={6}
            pattern="[0-9]{6}"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        {error && <p className="search-feedback" role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Confirmando…" : "Confirmar TOTP"}
        </button>
      </form>
    );
  }

  async function handleMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ghostinc-Request": "1" },
        body: JSON.stringify({ code }),
      });
      const payload = await response.json().catch(() => ({})) as LoginPayload;
      if (!response.ok) {
        setError(payload.error ?? "Código inválido.");
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

  if (mfaRequired) {
    return (
      <form className="account-form" onSubmit={handleMfa}>
        {recoveryCodes.length > 0 && (
          <div className="search-feedback" role="status">
            <p>Guarda estos códigos de recuperación. Se muestran una sola vez:</p>
            <ul>{recoveryCodes.map((item) => <li key={item}><code>{item}</code></li>)}</ul>
          </div>
        )}
        <p className="search-feedback">Ingresa el siguiente código TOTP o uno de recuperación.</p>
        <label>
          <span>Código TOTP o recuperación</span>
          <input
            type="text"
            name="code"
            autoComplete="one-time-code"
            required
            maxLength={64}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        {error && <p className="search-feedback" role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Verificando…" : "Verificar"}
        </button>
      </form>
    );
  }

  return (
    <form className="account-form" onSubmit={handleLogin}>
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
