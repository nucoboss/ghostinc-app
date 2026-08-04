"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Enrollment = { qrCode: string; manualCode: string };
type TotpStatus = { enabled: boolean; recoveryCodesAvailable: number };

export function TotpSettings({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<TotpStatus | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/account/totp", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("STATUS_FAILED");
        return response.json() as Promise<TotpStatus>;
      })
      .then((result) => {
        if (active) setStatus(result);
      })
      .catch(() => {
        if (active) setError("No fue posible consultar la configuración TOTP.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function startEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedPassword = String(new FormData(event.currentTarget).get("password") ?? "");
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/account/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ghostinc-Request": "1" },
        body: JSON.stringify({ password: submittedPassword }),
      });
      const payload = await response.json().catch(() => ({})) as Enrollment & { error?: string };
      if (!response.ok) {
        setError(response.status === 401 ? "La contraseña no es válida." : "No fue posible configurar TOTP.");
        return;
      }
      setEnrollment(payload);
      setPassword("");
    } catch {
      setError("No fue posible conectar con el servicio de acceso.");
    } finally {
      setPending(false);
    }
  }

  async function confirmEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/account/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ghostinc-Request": "1" },
        body: JSON.stringify({ code }),
      });
      const payload = await response.json().catch(() => ({})) as { recoveryCodes?: string[] };
      if (!response.ok || !payload.recoveryCodes) {
        setError("El código TOTP no es válido.");
        return;
      }
      setStatus({ enabled: true, recoveryCodesAvailable: payload.recoveryCodes.length });
      setRecoveryCodes(payload.recoveryCodes);
      setEnrollment(null);
      setCode("");
    } catch {
      setError("No fue posible conectar con el servicio de acceso.");
    } finally {
      setPending(false);
    }
  }

  async function disableTotp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedPassword = String(new FormData(event.currentTarget).get("password") ?? "");
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/account/totp", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "X-Ghostinc-Request": "1" },
        body: JSON.stringify({ password: submittedPassword }),
      });
      if (!response.ok) {
        setError(response.status === 401 ? "La contraseña no es válida." : "No fue posible desactivar TOTP.");
        return;
      }
      setStatus({ enabled: false, recoveryCodesAvailable: 0 });
      setPassword("");
      setRecoveryCodes([]);
      router.push("/auth/login?returnTo=/dashboard/profile");
      router.refresh();
    } catch {
      setError("No fue posible conectar con el servicio de acceso.");
    } finally {
      setPending(false);
    }
  }

  if (!status && !error) return <p className="placeholder-notice">Consultando verificación en dos pasos…</p>;

  if (isAdmin) {
    return (
      <div>
        <p className="placeholder-notice">
          TOTP {status?.enabled ? "está activo" : "debe configurarse durante el próximo inicio de sesión"}.
          Los administradores no pueden desactivarlo desde el portal.
        </p>
        {error && <p className="search-feedback" role="alert">{error}</p>}
      </div>
    );
  }

  if (enrollment) {
    return (
      <form className="account-form" onSubmit={confirmEnrollment}>
        <p>Escanea el QR y confirma el código generado por tu aplicación autenticadora.</p>
        <img src={enrollment.qrCode} alt="QR para enrolar TOTP" width={280} height={280} />
        <p>Código manual: <code>{enrollment.manualCode.match(/.{1,4}/g)?.join(" ")}</code></p>
        <label>
          <span>Código TOTP</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        {error && <p className="search-feedback" role="alert">{error}</p>}
        <button type="submit" disabled={pending}>{pending ? "Confirmando…" : "Confirmar TOTP"}</button>
      </form>
    );
  }

  return (
    <div>
      {recoveryCodes.length > 0 && (
        <div className="search-feedback" role="status">
          <p>Guarda estos códigos de recuperación. Se muestran una sola vez:</p>
          <ul>{recoveryCodes.map((item) => <li key={item}><code>{item}</code></li>)}</ul>
        </div>
      )}
      <p className="placeholder-notice">
        TOTP está {status?.enabled ? "activo" : "desactivado"}.
        {status?.enabled ? ` Códigos de recuperación disponibles: ${status.recoveryCodesAvailable}.` : ""}
      </p>
      <form className="account-form" onSubmit={status?.enabled ? disableTotp : startEnrollment}>
        <label>
          <span>Contraseña actual</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            maxLength={128}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <p className="search-feedback" role="alert">{error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? "Verificando…" : status?.enabled ? "Desactivar TOTP" : "Configurar TOTP"}
        </button>
      </form>
    </div>
  );
}
