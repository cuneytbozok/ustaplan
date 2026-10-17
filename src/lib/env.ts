import "server-only";
import { z } from "zod";

/**
 * Lazy, per-feature environment getters (IMPLEMENTATION_PLAN §11.3).
 *
 * Nothing is validated at import or build time: each getter checks only its
 * own variables the first time its feature runs, so the build and earlier
 * features never depend on later secrets. Browser code must not import this
 * module; client components read the public NEXT_PUBLIC_* values directly.
 */

const SERVER_SECRETS = [
  "SUPABASE_SECRET_KEY",
  "SHARE_LINK_SECRET",
  "CRON_SECRET",
  "VAPID_PRIVATE_KEY",
] as const;

function assertNoPublicSecrets() {
  for (const name of SERVER_SECRETS) {
    if (process.env[`NEXT_PUBLIC_${name}`] !== undefined) {
      throw new Error(
        `NEXT_PUBLIC_${name} is set. Server secrets must never use the NEXT_PUBLIC_ prefix; rename it to ${name}.`,
      );
    }
  }
}

function read<T extends z.ZodRawShape>(feature: string, shape: T): z.infer<z.ZodObject<T>> {
  assertNoPublicSecrets();
  const values = Object.fromEntries(Object.keys(shape).map((key) => [key, process.env[key]]));
  const result = z.object(shape).safeParse(values);
  if (!result.success) {
    // Only variable names are reported, never values.
    const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new Error(`Missing or invalid environment variables for ${feature}: ${names.join(", ")}`);
  }
  return result.data;
}

const url = z.url();
const secret = z.string().min(32);

/** Public Supabase settings (introduced in M0.3). */
export function supabaseEnv() {
  const env = read("Supabase", {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  });
  return { url: env.NEXT_PUBLIC_SUPABASE_URL, publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
}

/** Canonical origin for share links and Origin checks. */
export function appEnv() {
  const env = read("app base URL", { APP_BASE_URL: url });
  return { baseUrl: env.APP_BASE_URL.replace(/\/+$/, "") };
}

/** Admin (secret key) Supabase client settings (introduced in M1.2). */
export function adminEnv() {
  const env = read("Supabase admin", {
    NEXT_PUBLIC_SUPABASE_URL: url,
    SUPABASE_SECRET_KEY: z.string().min(1),
  });
  return { url: env.NEXT_PUBLIC_SUPABASE_URL, secretKey: env.SUPABASE_SECRET_KEY };
}

/** HMAC secret for customer share links (introduced in M4.3). */
export function shareLinkEnv() {
  const env = read("share links", { SHARE_LINK_SECRET: secret });
  return { secret: env.SHARE_LINK_SECRET };
}

/** Web Push VAPID settings (introduced in M5.6). */
export function pushEnv() {
  const env = read("Web Push", {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1),
    VAPID_PRIVATE_KEY: z.string().min(1),
    VAPID_SUBJECT: z.string().regex(/^(mailto:|https:\/\/)/),
  });
  return {
    publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  };
}

/** Bearer secret for /api/internal/dispatch (introduced in M5.8). */
export function cronEnv() {
  const env = read("cron dispatcher", { CRON_SECRET: secret });
  return { secret: env.CRON_SECRET };
}
