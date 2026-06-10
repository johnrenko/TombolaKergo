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

  const excluded = new Set<number>();
  const tokenPattern = /(-?\d+)\s*(?:(?:-|–|—|\.\.|à|a)\s*(-?\d+))?/gi;
  for (const match of value.matchAll(tokenPattern)) {
    const start = Number.parseInt(match[1], 10);
    const end = match[2] === undefined ? start : Number.parseInt(match[2], 10);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

    const min = Math.min(start, end);
    const max = Math.max(start, end);
    for (let number = min; number <= max; number += 1) {
      excluded.add(number);
    }
  }

  return [...excluded].sort((a, b) => a - b);
}
