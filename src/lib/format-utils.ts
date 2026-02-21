/**
 * Format a column/table name for display.
 * Converts snake_case and camelCase to Title Case.
 */
export function formatTitle(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
