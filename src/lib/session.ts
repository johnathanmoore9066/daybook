import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./auth";
import { config, gateMode } from "./config";

/** Server Actions are reachable by direct POST, so each one re-checks the session the proxy already checked. */
export async function requireSession(): Promise<void> {
  const mode = gateMode();
  if (mode === "open") return;
  if (mode === "misconfigured") throw new Error("DASHBOARD_PASSWORD is not set.");
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token, config.sessionSecret!))) throw new Error("Not signed in.");
}
