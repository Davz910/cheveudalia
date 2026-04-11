/** Heures ouvrées Paris : lundi–vendredi, 9h–18h (9:00 inclus, strictement avant 18:00). */

export function getParisClock(d: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = parseInt(parts.find((x) => x.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((x) => x.type === "minute")?.value ?? "0", 10);
  const weekday = parts.find((x) => x.type === "weekday")?.value ?? "";
  return { hour, minute, weekday };
}

export function isParisBusinessHours(now = new Date()): boolean {
  const { hour, minute, weekday } = getParisClock(now);
  if (weekday === "Sat" || weekday === "Sun") return false;
  const mins = hour * 60 + minute;
  return mins >= 9 * 60 && mins < 18 * 60;
}

/** Ticket email non assigné depuis plus de 2h (horloge), pendant les heures ouvrées Paris. */
export function showUnassignedEmailAlert(createdAt: string | null, assignedTo: string | null): boolean {
  if (assignedTo) return false;
  if (!createdAt) return false;
  if (!isParisBusinessHours()) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  const twoH = 2 * 60 * 60 * 1000;
  return Date.now() - created > twoH;
}
