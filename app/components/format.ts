export function formatDate(timestamp?: number) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

export function statusLabel(status: "draft" | "drawn" | "published") {
  return {
    draft: "Brouillon",
    drawn: "Tirée",
    published: "Publiée"
  }[status];
}

export function parseExcludedNumbers(value: string) {
  if (!value.trim()) return [];
  return value
    .split(/[,\s;]+/)
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value));
}
