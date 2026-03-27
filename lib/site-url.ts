/**
 * Base URL for this app (LAN or production). Prefer NEXTAUTH_URL so it matches what browsers use.
 * Use only when server code must call this same origin (rare); client code should use relative `/api/...`.
 */
export function getAppBaseUrl(): string {
  const explicit =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (explicit) {
    return explicit.startsWith("http") ? explicit.replace(/\/$/, "") : `https://${explicit.replace(/\/$/, "")}`;
  }
  const port = process.env.PORT || "3000";
  return `http://127.0.0.1:${port}`;
}
