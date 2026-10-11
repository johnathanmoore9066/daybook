import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { config as appConfig, gateMode } from "@/lib/config";

export async function proxy(request: NextRequest) {
  const mode = gateMode();
  if (mode === "open") return NextResponse.next();

  const isApi = request.nextUrl.pathname.startsWith("/api/");
  if (mode === "misconfigured") {
    const message = "DASHBOARD_PASSWORD is not set. Add it in the Vercel project settings and redeploy.";
    return isApi
      ? NextResponse.json({ error: message }, { status: 503 })
      : new NextResponse(message, { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token, appConfig.sessionSecret!)) return NextResponse.next();

  if (isApi) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const login = new URL("/login", request.url);
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    // Everything except the login page, the ingest endpoint (token-protected), and static assets.
    "/((?!login|api/ingest|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest).*)",
  ],
};
