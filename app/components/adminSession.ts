const sessionKey = "tombola-admin-session";

export function getAdminSessionToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(sessionKey) ?? "";
}

export function setAdminSessionToken(token: string) {
  window.localStorage.setItem(sessionKey, token);
}

export function clearAdminSessionToken() {
  window.localStorage.removeItem(sessionKey);
}
