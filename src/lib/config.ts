import { TZ } from "./dates";

const env = (name: string) => {
  const value = process.env[name]?.trim();
  return value ? value : null;
};

export const config = {
  tz: TZ,
  password: env("DASHBOARD_PASSWORD"),
  sessionSecret: env("SESSION_SECRET") ?? env("DASHBOARD_PASSWORD"),
  ingestToken: env("INGEST_TOKEN"),
  blobToken: env("BLOB_READ_WRITE_TOKEN"),
  blobAccess: (env("BLOB_ACCESS") === "public" ? "public" : "private") as "public" | "private",
  anthropicKey: env("ANTHROPIC_API_KEY"),
  schoolFeedUrl: env("SCHOOL_ICS_URL")?.replace(/^webcal:\/\//i, "https://") ?? null,
  onVercel: Boolean(process.env.VERCEL),
  production: process.env.NODE_ENV === "production",
};

/** The login gate is optional on a dev machine and mandatory once deployed. */
export function gateMode(): "open" | "locked" | "misconfigured" {
  if (config.password) return "locked";
  return config.production ? "misconfigured" : "open";
}
