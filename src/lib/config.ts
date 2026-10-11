import { TZ } from "./dates";

const env = (name: string) => {
  const value = process.env[name]?.trim();
  return value ? value : null;
};

/** First env var matching `test`, so stores connected with a custom variable prefix still work. */
function findEnv(test: (name: string, value: string) => boolean): string | null {
  for (const [name, raw] of Object.entries(process.env)) {
    const value = raw?.trim();
    if (value && test(name, value)) return value;
  }
  return null;
}

export const config = {
  tz: TZ,
  password: env("DASHBOARD_PASSWORD"),
  sessionSecret: env("SESSION_SECRET") ?? env("DASHBOARD_PASSWORD"),
  ingestToken: env("INGEST_TOKEN"),
  // Vercel connects a Blob store one of two ways: a read-write token, or a store ID used with the
  // deployment's automatic OIDC credentials. Newer stores often get only the store ID.
  blobToken:
    env("BLOB_READ_WRITE_TOKEN") ??
    findEnv((name, value) => name.endsWith("_READ_WRITE_TOKEN") && value.startsWith("vercel_blob_rw_")),
  blobStoreId:
    env("BLOB_STORE_ID") ?? findEnv((name) => name.endsWith("_STORE_ID") && name.toUpperCase().includes("BLOB")),
  blobAccess: (env("BLOB_ACCESS") === "public" ? "public" : "private") as "public" | "private",
  anthropicKey: env("ANTHROPIC_API_KEY"),
  schoolFeedUrl: env("SCHOOL_ICS_URL")?.replace(/^webcal:\/\//i, "https://") ?? null,
  onVercel: Boolean(process.env.VERCEL),
  production: process.env.NODE_ENV === "production",
};

/** Names (never values) of env vars that look Blob-related, for the setup page's diagnosis. */
export function blobEnvNames(): string[] {
  return Object.keys(process.env)
    .filter((name) => name.toUpperCase().includes("BLOB"))
    .sort();
}

/** The login gate is optional on a dev machine and mandatory once deployed. */
export function gateMode(): "open" | "locked" | "misconfigured" {
  if (config.password) return "locked";
  return config.production ? "misconfigured" : "open";
}
