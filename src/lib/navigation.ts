export type AppRole = "tutor" | "student";

export function roleHome(role: AppRole | undefined) {
  return role === "tutor" ? "/tutor" : "/student";
}

export function safeInternalPath(
  value: string | null | undefined,
  fallback: string,
) {
  if (!value || !value.startsWith("/")) {
    return fallback;
  }
  try {
    const base = "https://app.local";
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
