/** The desk belongs to one person; her first name is used for the greeting. */
export const OWNER_FIRST_NAME = "Fadeke";
export const APP_NAME = "Fadeke's Job Desk";

/** "morning" / "afternoon" / "evening" in Lagos time. */
export function lagosPartOfDay(now = new Date()): "morning" | "afternoon" | "evening" {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", hour12: false }).format(now)
  );
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  return "evening";
}
