/**
 * Centralized Date & Timezone utilities for company-local attendance calculations.
 * Ensures consistent day-of-week, midnight boundaries, and time adjustments
 * independently of host OS or process.env.TZ settings.
 */

export function getCompanyTimezone(configuredTimezone?: string | null): string {
  const tz = configuredTimezone?.trim() || process.env.TIMEZONE || "Africa/Casablanca";
  try {
    // Validate timezone string validity
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch (_) {
    return "Africa/Casablanca";
  }
}

export interface LocalDateComponents {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  hour: number;
  minute: number;
  second: number;
}

/**
 * Extracts exact calendar components for a given timestamp in the specified company timezone.
 */
export function getLocalDateComponents(date: Date, timezone: string): LocalDateComponents {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false
  });

  const parts = dtf.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const weekdayStr = partMap["weekday"] || "";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  const hourRaw = parseInt(partMap["hour"] || "0", 10);
  const hour = hourRaw === 24 ? 0 : hourRaw;

  return {
    year: parseInt(partMap["year"] || "1970", 10),
    month: parseInt(partMap["month"] || "1", 10),
    day: parseInt(partMap["day"] || "1", 10),
    dayOfWeek: weekdayMap[weekdayStr] ?? 0,
    hour,
    minute: parseInt(partMap["minute"] || "0", 10),
    second: parseInt(partMap["second"] || "0", 10)
  };
}

/**
 * Returns UTC midnight Date for the company-local calendar day.
 */
export function getCompanyDayStart(date: Date, timezone: string): Date {
  const c = getLocalDateComponents(date, timezone);
  return new Date(Date.UTC(c.year, c.month - 1, c.day, 0, 0, 0, 0));
}

/**
 * Returns UTC end-of-day Date (23:59:59.999) for the company-local calendar day.
 */
export function getCompanyDayEnd(date: Date, timezone: string): Date {
  const c = getLocalDateComponents(date, timezone);
  return new Date(Date.UTC(c.year, c.month - 1, c.day, 23, 59, 59, 999));
}

/**
 * Checks if a given timestamp falls on a Sunday in the company timezone.
 */
export function isCompanySunday(date: Date, timezone: string): boolean {
  const c = getLocalDateComponents(date, timezone);
  return c.dayOfWeek === 0;
}

/**
 * Checks if a given timestamp falls on a Saturday in the company timezone.
 */
export function isCompanySaturday(date: Date, timezone: string): boolean {
  const c = getLocalDateComponents(date, timezone);
  return c.dayOfWeek === 6;
}

/**
 * Returns local time in minutes from midnight (0..1439).
 */
export function getCompanyTimeMinutes(date: Date, timezone: string): number {
  const c = getLocalDateComponents(date, timezone);
  return c.hour * 60 + c.minute;
}
