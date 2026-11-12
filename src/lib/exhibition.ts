import "server-only";

/**
 * Exhibition mode (JADARAH_EXHIBITION_MODE=true, server-only): the interface shows the platform as in live operation.
 * Labels that mark records or accounts as demonstration data are hidden from every screen. The data itself is
 * unchanged: `is_demo` flags, test-address email suppression and every internal filter keep working.
 * Unset or any other value: the normal behaviour, labels included.
 */
export function exhibitionMode(): boolean {
  return process.env.JADARAH_EXHIBITION_MODE === "true";
}
