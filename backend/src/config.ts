import "dotenv/config";
import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.string().min(1).optional(),
);
const optionalEmail = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.string().email().optional(),
);
const hexString = (length: number) => z.string().regex(new RegExp(`^[0-9a-fA-F]{${length}}$`));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url().default("postgresql://ghostinc:ghostinc@localhost:5432/ghostinc"),
  FRONTEND_ORIGIN: z.string().default("http://localhost:3002"),
  PJUD_API_BASE_URL: z.string().url().default("http://localhost:18080/api/v1"),
  PJUD_API_KEY: z.string().optional(),
  API_KEY_PEPPER: z.string().min(32).default("local-development-pepper-change-me-now"),
  INTERNAL_SERVICE_TOKEN: z.string().min(32).default("local-internal-service-token-change-me"),
  SESSION_ABSOLUTE_SECONDS: z.coerce.number().int().positive().max(604_800).default(28_800),
  SESSION_INACTIVITY_SECONDS: z.coerce.number().int().positive().max(28_800).default(1_800),
  SESSION_ROTATION_SECONDS: z.coerce.number().int().nonnegative().max(3_600).default(900),
  APP_BASE_URL: z.string().url().default("http://localhost:3002"),
  RESEND_API_KEY: optionalNonEmptyString,
  RESEND_FROM_EMAIL: optionalEmail,
  TOTP_ENCRYPTION_KEY: hexString(64).default("deadbeef".repeat(8)),
  RECOVERY_CODE_PEPPER: z.string().min(32).default("local-recovery-code-pepper-change-me-now"),
  ADMIN_MFA_REAUTH_SECONDS: z.coerce.number().int().positive().max(604_800).default(1_800),
})
  .refine(
    (env) => env.NODE_ENV !== "production" || Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL),
    { message: "RESEND_API_KEY y RESEND_FROM_EMAIL son obligatorios en producción." },
  )
  .refine(
    (env) => Boolean(env.RESEND_API_KEY) === Boolean(env.RESEND_FROM_EMAIL),
    { message: "RESEND_API_KEY y RESEND_FROM_EMAIL deben configurarse juntos." },
  )
  .refine(
    (env) => env.NODE_ENV !== "production" || !env.TOTP_ENCRYPTION_KEY.startsWith("deadbeef"),
    { message: "TOTP_ENCRYPTION_KEY debe ser un secreto real de 64 caracteres hexadecimales en producción." },
  )
  .refine(
    (env) => env.NODE_ENV !== "production" || !env.RECOVERY_CODE_PEPPER.startsWith("local-"),
    { message: "RECOVERY_CODE_PEPPER debe ser un secreto real en producción." },
  );

const env = schema.parse(process.env);

export const config = {
  nodeEnv: env.NODE_ENV,
  host: env.HOST,
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  frontendOrigins: env.FRONTEND_ORIGIN.split(",").map((origin) => origin.trim()),
  pjudBaseUrl: env.PJUD_API_BASE_URL.replace(/\/$/, ""),
  pjudApiKey: env.PJUD_API_KEY,
  apiKeyPepper: env.API_KEY_PEPPER,
  internalServiceToken: env.INTERNAL_SERVICE_TOKEN,
  appBaseUrl: env.APP_BASE_URL.replace(/\/$/, ""),
  resendApiKey: env.RESEND_API_KEY,
  resendFromEmail: env.RESEND_FROM_EMAIL,
  totpEncryptionKey: Buffer.from(env.TOTP_ENCRYPTION_KEY, "hex"),
  recoveryCodePepper: env.RECOVERY_CODE_PEPPER,
  adminMfaReauthSeconds: env.ADMIN_MFA_REAUTH_SECONDS,
  sessionPolicy: {
    absoluteSeconds: env.SESSION_ABSOLUTE_SECONDS,
    inactivitySeconds: env.SESSION_INACTIVITY_SECONDS,
    rotationSeconds: env.SESSION_ROTATION_SECONDS,
  },
};
