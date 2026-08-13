const ROUTE_KEYS = [
  "view",
  "profile",
  "lesson",
  "exam",
  "topic",
  "presentation",
  "map",
  "scope",
  "scopeId",
  "chronogram",
  "discipline",
  "at",
  "week",
  "edit",
  "q",
];

export function readRoute(location = window.location) {
  const params = new URLSearchParams(location.search);
  return Object.fromEntries(
    ROUTE_KEYS.map((key) => [key, params.get(key) || ""]),
  );
}

export function routeHref(route, location = window.location) {
  const url = new URL(location.href);
  const params = new URLSearchParams();
  ROUTE_KEYS.forEach((key) => {
    const value = String(route?.[key] || "").trim();
    if (value) params.set(key, value);
  });
  if (!params.has("view")) params.set("view", "dashboard");
  url.search = params.toString();
  url.hash = "";
  return `${url.pathname}${url.search}`;
}

export function writeRoute(route, { replace = false } = {}) {
  const href = routeHref(route);
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === href) return false;
  window.history[replace ? "replaceState" : "pushState"]({ route }, "", href);
  return true;
}
