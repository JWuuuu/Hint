/** Reload into an app route after changing the device-local owner. */
export function localProfileDestination(baseUrl: string, location: Pick<Location, "pathname" | "search" | "hash">): string {
  const base = baseUrl.startsWith("/") && !baseUrl.startsWith("//") ? baseUrl.replace(/\/$/, "") : "";
  const pathname = base && location.pathname.startsWith(`${base}/`) ? location.pathname.slice(base.length) : location.pathname;
  const destination = /^\/app\/compatibility\/invite\/[A-Za-z0-9_-]+\/?$/.test(pathname)
    ? `${pathname}${location.search}${location.hash}` : "/app/profile";
  return `${base}${destination}`;
}
