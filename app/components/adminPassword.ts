export function getAdminPassword() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("tombola-admin-password") ?? "";
}
