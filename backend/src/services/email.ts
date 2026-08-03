import { config } from "../config.js";

const RESEND_API_URL = "https://api.resend.com";
const RESEND_TIMEOUT_MS = 10_000;
const DOMAIN_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
};

export type SendEmailError = Error & { code?: string };

export type EmailTransport = {
  send(message: EmailMessage): Promise<void>;
};

class ResendError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

let domainCache: { domains: string[]; at: number } | null = null;

export async function verifiedResendDomains(): Promise<string[]> {
  if (!config.resendApiKey) return [];
  const now = Date.now();
  if (domainCache && now - domainCache.at < DOMAIN_CACHE_TTL_MS) return domainCache.domains;

  let domains: string[] = [];
  const response = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${config.resendApiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new ResendError(`Resend domains returned ${response.status}`, "RESEND_UNAVAILABLE");
  }
  const payload = await response.json() as { data?: Array<{ name?: string; status?: "verified" | "pending" }> };
  domains = (payload.data ?? [])
    .filter((domain) => domain.status === "verified" && typeof domain.name === "string")
    .map((domain) => domain.name!);

  domainCache = { domains, at: now };
  return domains;
}

export async function assertSenderVerified(): Promise<void> {
  if (!config.resendApiKey || !config.resendFromEmail) return;
  const domain = config.resendFromEmail.split("@").at(-1) ?? "";
  const verified = await verifiedResendDomains();
  if (!domain || !verified.includes(domain)) {
    throw new ResendError(
      `Dominio remitente ${domain} no está verificado en Resend`,
      "SENDER_DOMAIN_UNVERIFIED",
    );
  }
}

export const emailOutbox: EmailMessage[] = [];

const simTransport: EmailTransport = {
  async send(message) {
    emailOutbox.push(message);
  },
};

const resendTransport: EmailTransport = {
  async send(message) {
    await assertSenderVerified();
    const response = await fetch(`${RESEND_API_URL}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.resendFromEmail,
        to: [message.to],
        subject: message.subject,
        html: message.html,
      }),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new ResendError(`Resend returned ${response.status}`, "RESEND_SEND_FAILED");
    }
  },
};

export function resolveTransport(): EmailTransport {
  return config.resendApiKey ? resendTransport : simTransport;
}

export async function sendAuthEmail(args: {
  to: string;
  link: string;
  expiredAt: Date;
  kind: "registration" | "password_reset";
}, transport: EmailTransport = resolveTransport()) {
  const isReset = args.kind === "password_reset";
  await transport.send({
    to: args.to,
    subject: isReset ? "Recupera tu contraseña · Ghostinc" : "Crea tu contraseña · Ghostinc",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="color:#111">Ghostinc</h2>
        <p>${isReset ? "Recibimos una solicitud para recuperar tu contraseña." : "Para activar tu cuenta, crea una contraseña."}</p>
        <p>Cada enlace es de uso único y expira el ${new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(args.expiredAt)}.</p>
        <p style="margin:28px 0">
          <a href="${args.link}" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;border-radius:6px;text-decoration:none">
            ${isReset ? "Establecer nueva contraseña" : "Crear contraseña"}
          </a>
        </p>
        <p style="color:#666;font-size:12px">Si no solicitaste esto, ignora este correo y contacta a soporte.</p>
      </div>`,
  });
}